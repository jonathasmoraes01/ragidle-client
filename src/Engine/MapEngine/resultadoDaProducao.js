/**
 * Engine/MapEngine/resultadoDaProducao.js
 *
 * O RESULTADO DA FORJA E DA FARMACIA NO CHAT (D-2506, 16/10/2026 - pedido de
 * jogador: "poderiam implementar a animacao que exibe que a forja falhou ou
 * que teve sucesso?").
 *
 * A ANIMACAO e o `ZC_NOTIFY_EFFECT` (0x019b) que o servidor difunde depois do
 * resultado, e quem a toca e o `onSpecialEffect` de `Skill.js` (3 = o martelo
 * que brilha, `bs_refinesuccess.str`; 2 = o que quebra, `bs_refinefailed.str`).
 * Este arquivo e a outra metade: o `ZC_ACK_REQMAKINGITEM` (0x018f), que o
 * roBrowser recebia e jogava fora, vira UMA linha no chat dizendo o desfecho e
 * o item - no celular a animacao passa em um segundo, e a linha fica.
 *
 * Os codigos sao os de `clif_produceeffect` (clif.cpp:8186-8192 no emulador):
 * 0 forja saiu, 1 forja falhou, 2 farmacia saiu, 3 farmacia falhou. Os de 4 a
 * 7 sao de habilidades de 3a classe que este jogo nao serve: sem linha.
 *
 * COSMETICO: nada aqui pode lancar para quem chama (D-993). `avisarResultadoDaProducao`
 * engole o erro de quem monta o nome ou escreve no chat.
 */

/** Os codigos de `ZC_ACK_REQMAKINGITEM` que este jogo manda. */
export const RESULTADO_DA_PRODUCAO = Object.freeze({
	FORJA_SAIU: 0,
	FORJA_FALHOU: 1,
	FARMACIA_SAIU: 2,
	FARMACIA_FALHOU: 3
});

/**
 * O resultado deu certo?
 *
 * @param {number} resultado
 * @returns {boolean}
 */
export function producaoSaiu(resultado) {
	return resultado === RESULTADO_DA_PRODUCAO.FORJA_SAIU || resultado === RESULTADO_DA_PRODUCAO.FARMACIA_SAIU;
}

/**
 * A linha do chat para um resultado, ou `null` quando nao ha linha.
 *
 * @param {number} resultado - o `result` do 0x018f
 * @param {string} nomeDoItem - o nome do item pedido (vazio vira "o item")
 * @returns {string|null}
 */
export function textoDoResultadoDaProducao(resultado, nomeDoItem) {
	const nome = typeof nomeDoItem === 'string' && nomeDoItem.trim() !== '' ? nomeDoItem.trim() : 'o item';
	switch (resultado) {
		case RESULTADO_DA_PRODUCAO.FORJA_SAIU:
			return `A forja deu certo: ${nome}.`;
		case RESULTADO_DA_PRODUCAO.FORJA_FALHOU:
			return `A forja falhou: ${nome} não saiu.`;
		case RESULTADO_DA_PRODUCAO.FARMACIA_SAIU:
			return `A preparação deu certo: ${nome}.`;
		case RESULTADO_DA_PRODUCAO.FARMACIA_FALHOU:
			return `A preparação falhou: ${nome} não saiu.`;
		default:
			return null;
	}
}

/**
 * Escreve a linha do resultado. Nunca lanca.
 *
 * @param {{ result: number, ITID: number }} pkt - PACKET.ZC.ACK_REQMAKINGITEM
 * @param {{ nomeDoItem: (itemId: number) => string, escrever: (texto: string, saiu: boolean) => void }} portas
 * @returns {boolean} se escreveu
 */
export function avisarResultadoDaProducao(pkt, portas) {
	try {
		let nome = '';
		try {
			nome = portas.nomeDoItem(pkt.ITID) || '';
		} catch {
			nome = '';
		}
		const texto = textoDoResultadoDaProducao(pkt.result, nome);
		if (texto === null) {
			return false;
		}
		portas.escrever(texto, producaoSaiu(pkt.result));
		return true;
	} catch (erro) {
		console.warn('[producao] a linha do resultado falhou', erro);
		return false;
	}
}
