/**
 * O MINIMAPA NAO TRABALHA QUANDO NINGUEM O VE (13/09/2026, auditoria do iPhone).
 *
 * No celular em pe o minimapa sai da tela por CSS
 * (`html.ri-vertical #MiniMapV2 { display: none !important }`, Common.css), mas
 * continuava montado e o `render` dele seguia registrado no laco do jogo: todo
 * quadro limpava o canvas, redesenhava o mapa, os icones, os pontos e a seta, e
 * gravava as coordenadas no DOM — para um elemento invisivel. E a mesma familia
 * do boneco invisivel da D-957 (6,7% da thread principal), no jogador de iPhone.
 *
 * As duas perguntas moram aqui, puras, para o teste alcanca-las:
 *   - o minimapa esta visivel? Pela CLASSE da raiz, e nao por `offsetParent`:
 *     ler geometria todo quadro forcaria o recalculo de estilo que o resto do
 *     quadro ja sujou. So o V2 e escondido pela regra; o V1 nunca e pulado.
 *   - o texto mudou? Gravar `textContent` igual ainda e uma MUTACAO de DOM, e o
 *     `MutationObserver` de `GUIComponent` escuta cada uma.
 * Teste: `tests/ui/minimapaNoQuadro.test.js`.
 */
import { MARCA_VERTICAL } from 'UI/hudVertical.js';

/** O unico minimapa que a HUD vertical esconde. */
export const MINIMAPA_ESCONDIDO_EM_PE = 'MiniMapV2';

/**
 * @param {Document} doc
 * @param {string} nome - o nome do componente (`MiniMapV2`, `MiniMap`)
 * @return {boolean}
 */
export function minimapaVisivel(doc, nome) {
	if (nome !== MINIMAPA_ESCONDIDO_EM_PE) {
		return true;
	}
	const raiz = doc && doc.documentElement;
	return !(raiz && raiz.classList.contains(MARCA_VERTICAL));
}

/**
 * Grava o texto so se ele mudou.
 *
 * @param {Element|null} el
 * @param {number|string} valor
 * @return {boolean} se gravou
 */
export function escreverSeMudou(el, valor) {
	if (!el) {
		return false;
	}
	const texto = String(valor);
	if (el.textContent === texto) {
		return false;
	}
	el.textContent = texto;
	return true;
}
