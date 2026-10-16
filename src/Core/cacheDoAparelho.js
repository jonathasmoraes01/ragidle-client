/**
 * Core/cacheDoAparelho.js
 *
 * O CACHE DE ARQUIVOS DO APARELHO, sobre o Cache Storage (17/10/2026,
 * D-2547..D-2549). As decisoes moram em `Core/cacheDeArquivos.js`; aqui mora
 * so a conversa com o navegador, e TODA ela e melhor esforco:
 *
 *  - sem `caches` (navegador antigo, contexto sem HTTPS), com `caches` que
 *    lanca (aba anonima do Firefox), cota cheia (`QuotaExceededError`) ou
 *    qualquer outra falha: o arquivo vai a rede, CALADO. Nada daqui lanca para
 *    fora e nenhuma promessa daqui rejeita;
 *  - a leitura tem prazo (`PRAZO_DA_LEITURA_MS`): o Cache Storage travado nao
 *    prende o mapa;
 *  - enquanto a versao do GRF nao e conhecida, `consultavel()` e `false` e o
 *    `FileManager` segue pelo caminho de sempre, sincrono, sem uma volta a mais.
 *
 * Roda no worker dos arquivos (`ThreadEventHandler.js`), e nao no fio
 * principal: nada daqui fica no caminho do `NOTIFY_ACTORINIT`.
 */

import {
	ESPERA_DO_INDICE_MS,
	PRAZO_DA_LEITURA_MS,
	arquivoGuardavel,
	cachesParaApagar,
	despejo,
	erroDeCota,
	indiceConferido,
	indiceVazio,
	nomeDoCache,
	podeGuardar,
	reconciliar,
	tetoTotal,
	versaoValida
} from 'Core/cacheDeArquivos.js';

/** A chave do indice dentro do cache. Uma URL que nunca e pedida a rede. */
export const URL_DO_INDICE = 'https://indice.ragidle.invalid/arquivos';

/** O `caches` do ambiente, ou `undefined` (o getter lanca na aba anonima de alguns navegadores). */
function cachesDoAmbiente() {
	try {
		return typeof caches !== 'undefined' ? caches : undefined;
	} catch {
		return undefined;
	}
}

/** A cota da origem, ou 0 se o navegador nao diz. */
async function cotaDoAmbiente() {
	try {
		const armazenamento = typeof navigator !== 'undefined' ? navigator.storage : undefined;
		if (!armazenamento || typeof armazenamento.estimate !== 'function') return 0;
		const estimativa = await armazenamento.estimate();
		return (estimativa && estimativa.quota) || 0;
	} catch {
		return 0;
	}
}

/**
 * @param {object} [dep]
 * @param {function(): (CacheStorage|undefined)} [dep.caches]
 * @param {function(string, object): Promise<Response>} [dep.buscar] - o `fetch` da rota da versao
 * @param {function(): string} dep.urlDaVersao - onde perguntar a versao (depende do host do cliente)
 * @param {function(): boolean} [dep.ativo] - o cache vale neste aparelho? (o `FileSystem` ausente)
 * @param {function(): Promise<number>} [dep.cota]
 * @param {function} [dep.agendar]
 * @param {function} [dep.cancelar]
 */
export function criarCacheDoAparelho(dep) {
	const obterCaches = dep.caches || cachesDoAmbiente;
	const buscar = dep.buscar || ((url, opcoes) => fetch(url, opcoes));
	const ativo = dep.ativo || (() => true);
	const obterCota = dep.cota || cotaDoAmbiente;
	const agendar = dep.agendar || ((f, ms) => setTimeout(f, ms));
	const cancelar = dep.cancelar || (id => clearTimeout(id));

	/** O servidor ja mandou uma resposta com a versao do GRF (so entao a rota existe). */
	let servidorInforma = false;
	/** A rota da versao respondeu que nao existe: nao se pergunta mais nesta sessao. */
	let semRota = false;
	/** A versao do GRF da sessao (so a rota sem cache a escreve). */
	let versao = null;
	/** O cache aberto da versao, com o indice carregado e reconciliado. */
	let cache = null;
	let indice = indiceVazio();
	let teto = 0;
	/** A cota recusou uma escrita: nao se escreve mais nesta sessao. */
	let escritaBloqueada = false;
	/** A pergunta da versao em curso (uma por vez). */
	let verificando = null;
	/**
	 * As versoes de resposta que a rota ja desmentiu (a copia velha do cache
	 * HTTP, depois de o GRF trocar): elas nao fazem perguntar de novo, senao cada
	 * arquivo velho do cache HTTP viraria um pedido a rota.
	 */
	const desmentidas = new Set();
	/** As escritas e apagamentos, em fila (a regravacao nunca passa na frente do apagar). */
	let fila = Promise.resolve();
	let indicePendente = null;

	const enfileirar = tarefa => {
		fila = fila.then(tarefa).catch(() => {});
		return fila;
	};

	const salvarIndiceDepois = () => {
		if (indicePendente !== null) cancelar(indicePendente);
		const doCache = cache;
		indicePendente = agendar(() => {
			indicePendente = null;
			if (doCache !== cache || cache === null) return;
			const texto = JSON.stringify(indice);
			enfileirar(() =>
				doCache.put(URL_DO_INDICE, new Response(texto, { headers: { 'Content-Type': 'application/json' } }))
			);
		}, ESPERA_DO_INDICE_MS);
	};

	/** Abre o cache da versao `v`, carrega e reconcilia o indice, e apaga os velhos. */
	async function trocarPara(v) {
		const todos = obterCaches();
		if (!todos) return;
		versao = v;
		cache = null;
		indice = indiceVazio();
		const nome = nomeDoCache(v);
		const aberto = await todos.open(nome);
		let lido = indiceVazio();
		try {
			const guardado = await aberto.match(URL_DO_INDICE);
			if (guardado) lido = indiceConferido(await guardado.json());
		} catch {
			lido = indiceVazio();
		}
		const pedidos = await aberto.keys();
		const chaves = pedidos.map(p => p.url).filter(url => url !== URL_DO_INDICE);
		const conferido = reconciliar(lido, chaves);
		for (const orfa of conferido.orfas) {
			await aberto.delete(orfa);
		}
		const novoTeto = tetoTotal(await obterCota());
		if (versao !== v) return; // outra versao chegou enquanto esta abria
		indice = conferido.indice;
		teto = novoTeto;
		cache = aberto;
		if (conferido.orfas.length) salvarIndiceDepois();
		const velhos = cachesParaApagar(await todos.keys(), nome);
		for (const velho of velhos) {
			await todos.delete(velho);
		}
	}

	/**
	 * Pergunta ao servidor a versao do GRF, sem cache. Nunca rejeita.
	 *
	 * @param {string|null} [daResposta] - a versao que motivou a pergunta
	 */
	function verificar(daResposta = null) {
		if (semRota || verificando || !ativo() || !obterCaches()) return verificando || Promise.resolve();
		verificando = (async () => {
			try {
				const resposta = await buscar(dep.urlDaVersao(), { cache: 'no-store' });
				if (!resposta || !resposta.ok) {
					if (resposta && resposta.status === 404) semRota = true;
					return;
				}
				const v = versaoValida(await resposta.text());
				if (daResposta !== null && v !== daResposta) desmentidas.add(daResposta);
				if (v !== null && v !== versao) await trocarPara(v);
			} catch {
				/* a rede ou o Cache Storage falharam: segue sem cache */
			} finally {
				verificando = null;
			}
		})();
		return verificando;
	}

	return {
		/**
		 * O `FileManager` pode perguntar ao cache agora? Falso ate a versao do GRF
		 * ser conhecida e o cache dela estar aberto - e entao o arquivo segue pela
		 * rede, como sempre seguiu.
		 *
		 * @returns {boolean}
		 */
		consultavel() {
			try {
				return cache !== null && ativo();
			} catch {
				return false;
			}
		},

		/**
		 * Os bytes guardados de `url`, ou `null` (nao tem, falhou, demorou). Nunca rejeita.
		 *
		 * @param {string} url
		 * @returns {Promise<ArrayBuffer|null>}
		 */
		ler(url) {
			const doCache = cache;
			if (doCache === null || !(url in indice.arquivos)) return Promise.resolve(null);
			return new Promise(resolver => {
				let respondeu = false;
				const responder = valor => {
					if (respondeu) return;
					respondeu = true;
					cancelar(guarda);
					resolver(valor);
				};
				const guarda = agendar(() => responder(null), PRAZO_DA_LEITURA_MS);
				Promise.resolve()
					.then(() => doCache.match(url))
					.then(resposta => (resposta ? resposta.arrayBuffer() : null))
					.then(buffer => {
						if (doCache !== cache) {
							responder(null);
							return;
						}
						const entrada = indice.arquivos[url];
						if (!buffer || !entrada || buffer.byteLength !== entrada.bytes) {
							// sumiu (outra aba, o navegador despejou) ou nao e o que foi guardado
							if (entrada) {
								delete indice.arquivos[url];
								enfileirar(() => doCache.delete(url));
								salvarIndiceDepois();
							}
							responder(null);
							return;
						}
						indice.uso += 1;
						entrada.uso = indice.uso;
						salvarIndiceDepois();
						responder(buffer);
					})
					.catch(() => responder(null));
			});
		},

		/**
		 * A resposta da rede chegou. Chamado ANTES de o arquivo ser entregue: a
		 * copia dos bytes e feita aqui, sincrona, porque quem recebe o buffer pode
		 * transferi-lo ao fio principal. Sem a versao no cabecalho (o servidor de
		 * hoje) nao faz nada.
		 *
		 * @param {string} url
		 * @param {string} nome - o nome do arquivo (o som nao entra)
		 * @param {ArrayBuffer} buffer
		 * @param {string|null|undefined} cabecalhoDaVersao
		 */
		aoResponder(url, nome, buffer, cabecalhoDaVersao) {
			try {
				const daResposta = versaoValida(cabecalhoDaVersao);
				if (daResposta === null || !ativo()) return;
				servidorInforma = true;
				if (daResposta !== versao) {
					// a primeira da sessao, ou o GRF trocou: so a rota sem cache decide
					if (!desmentidas.has(daResposta)) verificar(daResposta);
					return;
				}
				const doCache = cache;
				if (doCache === null || escritaBloqueada || !arquivoGuardavel(nome) || !buffer) return;
				const bytes = buffer.byteLength;
				if (!podeGuardar({ versaoDaResposta: daResposta, versaoDaSessao: versao, bytes, teto })) return;
				const sai = despejo(indice, teto, url, bytes);
				if (sai === null) return;
				const corpo = new Blob([buffer]);
				for (const u of sai) delete indice.arquivos[u];
				delete indice.arquivos[url];
				enfileirar(async () => {
					for (const u of sai) await doCache.delete(u);
					if (doCache !== cache || escritaBloqueada) return;
					try {
						await doCache.put(
							url,
							new Response(corpo, { headers: { 'Content-Type': 'application/octet-stream' } })
						);
					} catch (erro) {
						if (erroDeCota(erro)) escritaBloqueada = true;
						return;
					}
					if (doCache !== cache) return;
					indice.uso += 1;
					indice.arquivos[url] = { bytes, uso: indice.uso };
					salvarIndiceDepois();
				});
			} catch {
				/* o cache nunca impede a entrega */
			}
		},

		/**
		 * A copia de `url` nao abriu (`FileManager.load`): sai do cache, e a
		 * proxima leitura vai a rede.
		 *
		 * @param {string} url
		 */
		esquecer(url) {
			try {
				const doCache = cache;
				if (doCache === null || !(url in indice.arquivos)) return;
				delete indice.arquivos[url];
				enfileirar(() => doCache.delete(url));
				salvarIndiceDepois();
			} catch {
				/* idem */
			}
		},

		/**
		 * Confere de novo a versao do GRF (a cada mapa novo). So pergunta se o
		 * servidor ja disse que sabe responder.
		 *
		 * @returns {Promise<void>}
		 */
		reverificar() {
			if (!servidorInforma) return Promise.resolve();
			return verificar();
		},

		/** Para os testes e para o diagnostico: o estado, sem os bytes. */
		estado() {
			return {
				servidorInforma,
				semRota,
				versao,
				aberto: cache !== null,
				escritaBloqueada,
				teto,
				arquivos: Object.keys(indice.arquivos).length,
				fila
			};
		}
	};
}
