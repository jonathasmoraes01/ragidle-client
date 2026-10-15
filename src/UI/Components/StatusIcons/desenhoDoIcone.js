/**
 * UI/Components/StatusIcons/desenhoDoIcone.js
 *
 * O ICONE DE STATUS SO E PINTADO QUANDO MUDA (auditoria de desempenho de
 * 15/10/2026).
 *
 * O `renderStatus` fazia `clearRect` + `drawImage` do MESMO icone a cada passe
 * de 500 ms, por buff. Isso tinha razao enquanto havia a "torta" de progresso
 * pintada por cima (o pixel mudava a cada passe); a torta saiu em 06/09/2026 e
 * o icone ficou estatico — o passe repintava o mesmo pixel. Com dez buffs no
 * celular, sao 40 operacoes de canvas por segundo que nao mudam nada.
 *
 * Agora o canvas guarda QUAL imagem tem desenhada (`status.desenhado`) e so
 * repinta quando a imagem e outra: o icone que acabou de carregar, a variante
 * TKM trocada (o `update` zera `img` e carrega a nova) ou o fallback. O canvas
 * que perdeu o contexto (o `contextrestored` do Chrome devolve um canvas
 * LIMPO) zera a marca, e o passe seguinte repinta, como antes.
 *
 * E a posicao: `resetElementsPosition` reescrevia `top`/`right` de TODA celula
 * a cada icone que entra ou sai; a escrita igual nao muda nada na tela, mas
 * invalida o estilo. So escreve o que mudou.
 */

/**
 * A imagem ja tem pixel para desenhar? Um `<img>` que ainda nao decodificou
 * desenha NADA; se fosse marcado como desenhado, o icone ficaria vazio para
 * sempre (antes, o passe seguinte o curava). Canvas e o resto: prontos.
 */
function imagemPronta(img) {
	if (typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement) {
		return img.complete === true && img.naturalWidth > 0;
	}
	return true;
}

/**
 * Pinta o icone se a imagem mudou desde a ultima pintura.
 *
 * @param {{ ctx: CanvasRenderingContext2D, img: CanvasImageSource, desenhado?: any }} status
 * @param {number} lado - o lado do canvas do icone
 * @returns {boolean} se pintou
 */
export function pintarIconeSeMudou(status, lado) {
	if (!status || !status.img || !status.ctx) {
		return false;
	}
	if (status.desenhado === status.img) {
		return false;
	}
	status.ctx.clearRect(0, 0, lado, lado);
	status.ctx.drawImage(status.img, 0, 0);
	status.desenhado = imagemPronta(status.img) ? status.img : null;
	return true;
}

/**
 * O canvas perdeu o contexto e voltou limpo: a proxima pintura e obrigatoria.
 */
export function esquecerPintura(status) {
	if (status) {
		status.desenhado = null;
	}
}

/**
 * Escreve `top`/`right` so se mudaram.
 *
 * @param {HTMLElement} element
 * @param {string} top
 * @param {string} right
 */
export function posicionarCelula(element, top, right) {
	const estilo = element.style;
	if (estilo.top !== top) {
		estilo.top = top;
	}
	if (estilo.right !== right) {
		estilo.right = right;
	}
}
