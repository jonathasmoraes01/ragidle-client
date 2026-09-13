/**
 * QUANTOS PIXELS O MUNDO DESENHA NO CELULAR (13/09/2026, auditoria do iPhone).
 *
 * `Renderer.resize` multiplicava o buffer do mundo pelo `devicePixelRatio` sem
 * teto. No iPhone ele e 3: numa tela de 393x852 o jogo desenhava 1179x2556
 * (3,01 MP) — 9x os pixels da tela em CSS, com antialias por cima, numa GPU de
 * celular. Com teto 2 no toque sao 786x1704 (1,34 MP): menos da metade, e a
 * arte do RO (sprites de 2002 ampliados) nao ganha nitidez nenhuma acima disso.
 *
 * `preserveDrawingBuffer` obriga a GPU de tile da Apple a COPIAR o buffer
 * inteiro no fim de cada quadro em vez de descarta-lo. O unico consumidor dele
 * e o print do Alt+P (`Controls/ScreenShot.js`, via html2canvas), que so existe
 * com teclado — entao ele fica ligado no desktop e desligado no toque.
 *
 * As duas decisoes sao puras e moram aqui para o teste as alcancar sem subir o
 * renderizador inteiro. Quem pergunta "e um dedo?" e `ehDedo()`
 * (`UI/escalaDaHud.js`), o criterio unico do projeto.
 * Teste: `tests/renderer/densidadeDoMundo.test.js`.
 */

/** O teto de densidade quando o ponteiro e um dedo. */
export const DPR_MAXIMO_NO_TOQUE = 2;

/**
 * @param {number} dprReal - `window.devicePixelRatio`
 * @param {boolean} dedo - `ehDedo()`
 * @return {number} a densidade que o buffer do mundo usa
 */
export function densidadeDoMundo(dprReal, dedo) {
	const real = dprReal > 0 ? dprReal : 1;
	return dedo ? Math.min(real, DPR_MAXIMO_NO_TOQUE) : real;
}

/**
 * @param {boolean} dedo - `ehDedo()`
 * @return {boolean} se o contexto WebGL preserva o buffer entre quadros
 */
export function preservarBufferDeDesenho(dedo) {
	return !dedo;
}
