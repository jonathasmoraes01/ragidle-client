/**
 * UI/Components/ChatBox/chatEmLote.js
 *
 * O FLUSH DO CHAT EM FASES (auditoria de desempenho de 15/10/2026).
 *
 * O `flushMessageBuffer` fazia, POR CANAL: le a geometria (`offsetHeight`,
 * `scrollTop`, `scrollHeight`), anexa as linhas, le `scrollHeight` e escreve
 * `scrollTop`. O canal seguinte lia a geometria DEPOIS da escrita do anterior:
 * cada canal com mensagem forcava um layout inteiro (duas vezes). Numa caca, o
 * Farm, o Logs e o Global recebem no mesmo quadro.
 *
 * Agora sao quatro fases, e o layout e calculado no maximo duas vezes por
 * flush, qualquer que seja o numero de canais:
 *  1. LER de todos os canais se estavam colados no fim (antes de qualquer
 *     escrita: o mesmo valor que cada um lia antes, porque o que um canal anexa
 *     nao mexe na geometria de outro - cada `.content` e um painel proprio);
 *  2. ANEXAR e podar em todos;
 *  3. LER o `scrollHeight` dos que estavam no fim (um layout so);
 *  4. ESCREVER a rolagem, o botao de "novas" e o nao-lido.
 * A ordem das linhas, a rolagem e os badges saem iguais.
 *
 * @param {Array<{ content: HTMLElement }>} entradas - os canais com linhas
 * @param {object} passos
 * @param {function(object): boolean} passos.estavaNoFim - so LE
 * @param {function(object): void} passos.anexar - so ESCREVE (anexa e poda)
 * @param {function(object): void} passos.avisarNovas - o canal que nao estava no fim
 * @param {function(object): boolean} passos.contarNaoLido - devolve se contou
 * @returns {boolean} se algum canal contou nao-lido (os badges sao refeitos uma vez)
 */
export function drenarCanaisEmFases(entradas, { estavaNoFim, anexar, avisarNovas, contarNaoLido }) {
	const noFim = entradas.map(entrada => estavaNoFim(entrada));
	entradas.forEach(entrada => anexar(entrada));
	const alturas = entradas.map((entrada, i) => (noFim[i] ? entrada.content.scrollHeight : null));
	let contou = false;
	entradas.forEach((entrada, i) => {
		/*
		 * ROLAGEM ANCORADA (spec §7): quem subiu no historico NAO e puxado de
		 * volta. Em vez disso o botao "novas mensagens" aparece, e ele e o
		 * caminho de volta.
		 */
		if (noFim[i]) {
			entrada.content.scrollTop = alturas[i];
		} else {
			avisarNovas(entrada);
		}
		if (contarNaoLido(entrada)) {
			contou = true;
		}
	});
	return contou;
}

/**
 * A linha tem `blob:` para revogar na poda? So a linha OVERRIDE pode ter: e
 * HTML que o proprio cliente montou (o link do historico salvo). A linha comum
 * e texto escapado: um "blob:" digitado por alguem nao e URL nossa, e a
 * revogacao dele nunca revogou nada. Antes a poda serializava o `innerHTML` de
 * TODA linha que saia para procurar `blob:`.
 */
export function linhaTemBlob(override, texto) {
	return !!override && typeof texto === 'string' && texto.indexOf('blob:') >= 0;
}

/**
 * Revoga os `blob:` da linha que sai, so se ela foi marcada na criacao.
 *
 * @param {HTMLElement} linha
 * @param {function(string): void} revogar
 */
export function revogarBlobsDaLinha(linha, revogar) {
	if (!linha.dataset || linha.dataset.blob !== '1') {
		return;
	}
	const urls = linha.innerHTML.match(/(blob:[^"]+)/g);
	if (urls) {
		for (let i = 0; i < urls.length; i++) {
			revogar(urls[i]);
		}
	}
}

/** Escreve o texto so se mudou (o badge reescrito igual e uma mutacao a toa). */
export function escreverTextoSeMudou(elemento, texto) {
	if (elemento.textContent !== texto) {
		elemento.textContent = texto;
	}
}

/**
 * O RELOGIO DO REPOUSO POR PRAZO (15/10/2026).
 *
 * Todo flush com mensagem urgente (e todo `mousemove` sobre o painel) acordava
 * o painel, e cada acordar fazia `clearTimeout` + `setTimeout` novo. Aqui
 * acordar so EMPURRA o prazo; o relogio que ja existe, ao vencer, confere o
 * prazo e se rearma pelo que falta. O painel dorme no mesmo instante de antes:
 * `ms` depois do ULTIMO `agendar`.
 *
 * @param {object} o
 * @param {number} o.ms
 * @param {function(): number} o.agora
 * @param {function(function, number): any} o.armar - setTimeout
 * @param {function(any): void} o.desarmar - clearTimeout
 * @param {function(): void} o.dormir - o prazo venceu
 */
export function criarRelogioDoRepouso({ ms, agora, armar, desarmar, dormir }) {
	let relogio = null;
	let ate = 0;

	function vencer() {
		relogio = null;
		const falta = ate - agora();
		if (falta > 0) {
			relogio = armar(vencer, falta);
			return;
		}
		dormir();
	}

	return {
		/** (Re)comeca a contagem de `ms` a partir de agora. */
		agendar() {
			ate = agora() + ms;
			if (relogio === null) {
				relogio = armar(vencer, ms);
			}
		},
		/** O repouso foi desligado: nada dorme. */
		cancelar() {
			if (relogio !== null) {
				desarmar(relogio);
				relogio = null;
			}
		}
	};
}
