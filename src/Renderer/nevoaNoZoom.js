/**
 * A NEVOA ACOMPANHA A CAMERA (D-538).
 *
 * ## O que o jogador via
 *
 * "Ao dar zoom out a tela fica branca, verde, depende do mapa." Depende do
 * mapa porque a cor E do mapa: `data/fogparametertable.txt` da `0xffffffff`
 * (branco) a Prontera e `0xffBAFF77` (verde) ao Campo de Prontera. Geffen
 * fica lilas, Payon fica ciano.
 *
 * ## Por que
 *
 * `Ground.fs` faz `fogFactor = smoothstep(uFogNear, uFogFar, depth)` e
 * mistura `uFogColor` por esse fator. Com `uFogFar` FIXO, afastar a camera
 * empurra o chao inteiro para depois do limite, `fogFactor` satura em 1, e a
 * mistura devolve a cor da nevoa PURA — a tela inteira.
 *
 * Medido, com o `* 240` que `MapRenderer.setMap` aplica:
 *
 * | mapa | nevoa longe | cor | camera no zoom maximo |
 * |---|---|---|---|
 * | prt_fild08 | 144 | `#BAFF77` | 162,5 — **passa**, verde chapado |
 * | prontera | 216 | `#ffffff` | 162,5 — quase la, lavado de branco |
 *
 * A tabela foi autorada para o cliente OFICIAL, cuja camera nao afasta tanto.
 * O roBrowser aceita `MAX_ZOOM = 5` (`Camera.js`), o que leva a
 * `65 * 5 / 2 = 162,5` de profundidade — uma distancia em que a nevoa daquela
 * tabela nunca foi vista, porque no cliente oficial esse zoom nao existe.
 *
 * ## A escolha
 *
 * Escalar a nevoa com o afastamento, e nao desliga-la nem encurtar o zoom.
 * Desligar tiraria a bruma do horizonte, que e o efeito CERTO na distancia
 * certa; encurtar o zoom tiraria do jogador justamente o que ele estava
 * querendo usar. Escalando, a nevoa fica onde sempre esteve EM RELACAO AO
 * QUE SE VE.
 */

/**
 * O zoom para o qual a tabela de nevoa foi autorada — o padrao do cliente
 * (`Preferences/Camera.js`, `zoom: 125.0`). E a distancia em que a nevoa de
 * cada mapa tem a aparencia que o artista escolheu, e por isso e o ponto onde
 * o fator vale exatamente 1.
 */
export const ZOOM_DE_REFERENCIA = 125.0;

/**
 * A nevoa deste quadro, a partir da que a TABELA escreveu.
 *
 * O fator nunca desce de 1: aproximar a camera nao deve ADIANTAR a nevoa, so
 * afastar deve empurra-la. E `near` e `far` escalam juntos, de forma que a
 * proporcao entre os dois se mantem — o que preserva a bruma como GRADIENTE,
 * em vez de transforma-la numa parede de cor.
 *
 * @param {{near: number, far: number}} base valores da tabela, ja com o *240
 * @param {number} zoom `Camera.zoom` do quadro
 * @returns {{near: number, far: number}}
 */
export function nevoaNoZoom(base, zoom) {
	const fator = Math.max(1, zoom / ZOOM_DE_REFERENCIA);
	return { near: base.near * fator, far: base.far * fator };
}
