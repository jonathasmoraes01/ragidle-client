/**
 * Core/baixarComVigia.js
 *
 * O PEDIDO DE ARQUIVO QUE NAO RESPONDE NAO FICA PENDURADO PARA SEMPRE
 * (06/10/2026, D-2055 — relatos de producao: "a tela de carregamento trava em
 * 2% e nunca termina", sobretudo no celular, com o servidor a 97% de CPU).
 *
 * ---------------------------------------------------------------------------
 * POR QUE ELE EXISTE
 * ---------------------------------------------------------------------------
 * A nova tentativa de 23/09/2026 (`tentativasDeArquivo.js`) cobre a falha que
 * CHEGA: rede caida, 408, 429, 5xx. Ela nao cobre a falha que NUNCA chega: um
 * `fetch` cuja resposta nao vem (o tunel que segura a conexao, o celular que
 * troca de antena no meio do download, o servidor sufocado) nao rejeita nunca,
 * e o `MapLoader` espera aquele arquivo para sempre. Os 2% da barra sao
 * exatamente isso: o `.rsw` e o `.gat` chegaram (1% e 2%, `MapLoader.load`) e
 * o `.gnd` - o maior dos tres, 5 a 13 MB sem compressao - nao chegou.
 *
 * ---------------------------------------------------------------------------
 * O PRAZO E DE SILENCIO, E NAO DE DURACAO
 * ---------------------------------------------------------------------------
 * Um prazo de duracao total mataria o download LENTO e legitimo: 8 MB num
 * celular a 1 Mbps levam mais de um minuto, chegando bytes o tempo todo. E
 * repetir um download lento so o deixa mais lento. O que prova que o pedido
 * morreu e o SILENCIO: nem cabecalho nem bytes por `SILENCIO_MAXIMO_MS`. Cada
 * pedaco do corpo que chega rearma o relogio.
 *
 * Quem decide se tenta de novo continua sendo `devoTentarDeNovo` (o silencio
 * conta como rede caida, `status === null`), com o mesmo recuo de 1, 2 e 4 s
 * e o mesmo teto de tres novas tentativas.
 */

/**
 * Silencio que prova o pedido morto. ESCOLHIDO, e nao medido (a medida por
 * fase nasce junto, em `Renderer/relatoDoCarregamento.js`, e e ela que vai
 * dizer se 15 s e cedo ou tarde): longe do primeiro byte normal de um arquivo
 * do mapa, e curto o bastante para que quatro silencios seguidos mais o recuo
 * (1 + 2 + 4 s) caibam em pouco mais de um minuto.
 */
export const SILENCIO_MAXIMO_MS = 15000;

/**
 * Baixa `url` e devolve `{ ok, status, buffer, total, bytes, doCacheHttp }`.
 *
 * - resposta nao-ok, ou pagina HTML no lugar do binario: `ok: false` com o
 *   status (o HTML de 200 conta como 404, como sempre contou);
 * - silencio maior que o prazo: REJEITA com `erro.silencio === true`, e o
 *   pedido e abortado (o navegador solta a conexao);
 * - `sinal` (um `AbortSignal`) abortado por fora: REJEITA com
 *   `erro.cancelado === true` - quem cancelou nao quer nova tentativa.
 *
 * @param {string} url
 * @param {object} [opcoes]
 * @param {number} [opcoes.limiteMs]
 * @param {function(number, number):void} [opcoes.aoReceber] - (recebidos, total ou 0)
 * @param {AbortSignal} [opcoes.sinal]
 * @param {function} [opcoes.buscar] - o `fetch` (injetavel no teste)
 * @param {function} [opcoes.agendar]
 * @param {function} [opcoes.cancelar]
 * @returns {Promise<{ok: boolean, status: number, buffer?: ArrayBuffer, total?: number, bytes?: number, doCacheHttp?: boolean}>}
 */
export function baixarComVigia(url, opcoes = {}) {
	const limiteMs = opcoes.limiteMs || SILENCIO_MAXIMO_MS;
	const buscar = opcoes.buscar || fetch;
	const agendar = opcoes.agendar || setTimeout;
	const cancelar = opcoes.cancelar || clearTimeout;
	const aoReceber = opcoes.aoReceber;
	const sinalDeFora = opcoes.sinal;
	const controlador = typeof AbortController !== 'undefined' ? new AbortController() : null;

	return new Promise((resolver, rejeitar) => {
		let relogio = null;
		let acabou = false;

		const terminar = () => {
			acabou = true;
			if (relogio !== null) {
				cancelar(relogio);
				relogio = null;
			}
			if (sinalDeFora) {
				sinalDeFora.removeEventListener('abort', aoCancelarDeFora);
			}
		};
		const falhar = erro => {
			if (acabou) return;
			terminar();
			rejeitar(erro);
		};
		const entregar = valor => {
			if (acabou) return;
			terminar();
			resolver(valor);
		};
		const abortar = () => {
			try {
				if (controlador) controlador.abort();
			} catch {
				/* abortar e melhor esforco */
			}
		};
		const armar = () => {
			if (acabou) return;
			if (relogio !== null) cancelar(relogio);
			relogio = agendar(() => {
				relogio = null;
				const erro = new Error('Silencio de ' + limiteMs + ' ms em ' + url);
				erro.silencio = true;
				falhar(erro);
				abortar();
			}, limiteMs);
		};
		function aoCancelarDeFora() {
			const erro = new Error('Pedido cancelado: ' + url);
			erro.cancelado = true;
			falhar(erro);
			abortar();
		}

		if (sinalDeFora) {
			if (sinalDeFora.aborted) {
				aoCancelarDeFora();
				return;
			}
			sinalDeFora.addEventListener('abort', aoCancelarDeFora);
		}

		armar();
		const pedido = controlador ? buscar(url, { signal: controlador.signal }) : buscar(url);
		Promise.resolve(pedido)
			.then(resposta => {
				if (acabou) return undefined;
				armar();
				if (!resposta.ok) {
					entregar({ ok: false, status: resposta.status });
					return undefined;
				}
				const tipo = (resposta.headers && resposta.headers.get && resposta.headers.get('content-type')) || '';
				if (tipo.indexOf('text/html') !== -1) {
					entregar({ ok: false, status: 404 });
					return undefined;
				}
				const total =
					Number((resposta.headers && resposta.headers.get && resposta.headers.get('content-length')) || 0) ||
					0;
				const corpo = resposta.body;
				if (corpo && typeof corpo.getReader === 'function') {
					return lerEmPedacos(corpo.getReader(), total, resposta.status);
				}
				return resposta.arrayBuffer().then(buffer => {
					if (aoReceber) aoReceber(buffer.byteLength, total);
					entregar({
						ok: true,
						status: resposta.status,
						buffer,
						total,
						bytes: buffer.byteLength,
						doCacheHttp: veioDoCacheHttp(url)
					});
				});
			})
			.catch(erro => {
				falhar(erro);
			});

		function lerEmPedacos(leitor, total, status) {
			const pedacos = [];
			let recebidos = 0;
			const passo = () =>
				leitor.read().then(({ done, value }) => {
					if (acabou) {
						try {
							leitor.cancel();
						} catch {
							/* o pedido ja acabou por outro caminho */
						}
						return undefined;
					}
					if (done) {
						const buffer = juntar(pedacos, recebidos);
						entregar({
							ok: true,
							status,
							buffer,
							total,
							bytes: recebidos,
							doCacheHttp: veioDoCacheHttp(url)
						});
						return undefined;
					}
					armar();
					pedacos.push(value);
					recebidos += value.byteLength;
					if (aoReceber) aoReceber(recebidos, total);
					return passo();
				});
			return passo();
		}
	});
}

/**
 * Junta os pedacos num `ArrayBuffer` so.
 *
 * @param {Uint8Array[]} pedacos
 * @param {number} tamanho
 * @returns {ArrayBuffer}
 */
function juntar(pedacos, tamanho) {
	if (pedacos.length === 1 && pedacos[0].byteOffset === 0 && pedacos[0].buffer.byteLength === tamanho) {
		return pedacos[0].buffer;
	}
	const saida = new Uint8Array(tamanho);
	let posicao = 0;
	for (let i = 0; i < pedacos.length; i++) {
		saida.set(pedacos[i], posicao);
		posicao += pedacos[i].byteLength;
	}
	return saida.buffer;
}

/**
 * O arquivo veio do cache HTTP do navegador? A medida e o `transferSize` zero
 * com corpo, que o navegador so expoe entre origens com `Timing-Allow-Origin`
 * (o servidor de assets o manda desde D-2055). Sem a entrada, ou sem o
 * cabecalho, a resposta e `false` - "nao sei" conta como rede, que e o lado
 * conservador para a pergunta "o cache ajudaria?".
 *
 * @param {string} url
 * @returns {boolean}
 */
export function veioDoCacheHttp(url) {
	try {
		if (typeof performance === 'undefined' || typeof performance.getEntriesByName !== 'function') {
			return false;
		}
		const absoluta = typeof location !== 'undefined' ? new URL(url, location.href).href : url;
		const entradas = performance.getEntriesByName(absoluta);
		const ultima = entradas[entradas.length - 1];
		const resposta = !!ultima && ultima.transferSize === 0 && ultima.decodedBodySize > 0;
		// O buffer de entradas do worker tem teto (250 no Chrome): sem limpar,
		// depois de uma cena cheia de sprites a pergunta pararia de ter resposta.
		if (
			typeof performance.clearResourceTimings === 'function' &&
			performance.getEntriesByType('resource').length > 200
		) {
			performance.clearResourceTimings();
		}
		return resposta;
	} catch {
		return false;
	}
}
