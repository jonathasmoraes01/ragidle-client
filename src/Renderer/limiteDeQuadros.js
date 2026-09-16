/**
 * O LIMITADOR DE QUADROS, COM FOLGA (16/09/2026, D-1537).
 *
 * O limitador antigo (em `Renderer._render`) desenhava so quando o tempo desde
 * o ultimo quadro era >= o intervalo (`1000 / limite`). O carimbo do
 * `requestAnimationFrame` oscila uma fracao de milissegundo: numa tela de
 * 120 Hz com o limite em 120, o quadro que chegava em 8,30 ms contra um
 * intervalo de 8,33 ms era DESCARTADO, e o jogo caia para 60 quadros. Pelo
 * mesmo motivo, o limite em 90 numa tela de 120 Hz tambem dava 60.
 *
 * O conserto tem duas pecas, e as duas sao necessarias:
 *
 *   1. a FOLGA: o quadro que chega ate 1/4 de intervalo adiantado e aceito;
 *   2. o MARCO AVANCA UM INTERVALO, e nao ate `agora`, quando o quadro e
 *      aceito: e isso que impede a folga de furar o limite. A media nunca
 *      passa de `limite` quadros por segundo, qualquer que seja a tela.
 *
 * Quem ficou muito para tras (aba que voltou, travada) realinha pelo resto da
 * divisao, como o codigo antigo fazia, em vez de desenhar uma rajada.
 */

/** A fracao do intervalo aceita como adiantamento. */
export const FOLGA_DO_INTERVALO = 0.25;

/**
 * @param {number} ultimo - o marco do ultimo quadro desenhado (ms)
 * @param {number} agora - o carimbo deste quadro (ms)
 * @param {number} limite - quadros por segundo; <= 0 e sem limite
 * @returns {{ desenhar: boolean, ultimo: number }}
 */
export function decidirQuadro(ultimo, agora, limite) {
	if (!(limite > 0)) {
		return { desenhar: true, ultimo: agora };
	}
	const intervalo = 1000 / limite;
	const passou = agora - ultimo;
	if (passou < intervalo - intervalo * FOLGA_DO_INTERVALO) {
		return { desenhar: false, ultimo };
	}
	if (passou < 2 * intervalo) {
		return { desenhar: true, ultimo: ultimo + intervalo };
	}
	return { desenhar: true, ultimo: agora - (passou % intervalo) };
}
