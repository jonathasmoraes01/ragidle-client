/**
 * UI/Components/ChatBox/linhaNoIdioma.js
 *
 * A LINHA DO CHAT NO IDIOMA DO JOGADOR (D-1929, o jogo em ingles).
 *
 * O chat parte cada linha em pedacos antes de desenhar: o remetente vira um
 * span, cada numero vira outro (`highlightMessage`). O tradutor das janelas
 * so veria esses pedacos — e "{0} curou voce em {1}." nunca casaria com tres
 * nos de texto. Entao a linha do SERVIDOR e traduzida aqui, inteira, ANTES de
 * virar DOM. O corpo do Logs e `"<remetente> : <texto>"` (servidor-mapa.ts,
 * `montarFalaDoSistema`): remetente e texto sao traduzidos cada um por si.
 *
 * A linha de JOGADOR nao passa por aqui (`falaDeJogador`): o que alguem
 * digitou nunca se traduz.
 *
 * @author RagIdle
 */

import { traduzir } from 'Core/Traducao.js';

/** `"<remetente> : <texto>"`: remetente curto, sem dois-pontos. */
const COM_REMETENTE = /^([^:]{1,40}?) : ([\s\S]+)$/;

/**
 * @param {string} texto - a linha como o servidor mandou
 * @returns {string} a linha no idioma do jogador (a mesma, em portugues)
 */
export function linhaNoIdioma(texto) {
	if (typeof texto !== 'string' || texto === '') {
		return texto;
	}
	const inteira = traduzir(texto);
	if (inteira !== texto) {
		return inteira;
	}
	const partes = COM_REMETENTE.exec(texto);
	if (!partes) {
		return texto;
	}
	return traduzir(partes[1]) + ' : ' + traduzir(partes[2]);
}
