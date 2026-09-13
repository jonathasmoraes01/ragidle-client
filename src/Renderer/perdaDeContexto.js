/**
 * PERDER O CONTEXTO WEBGL RECARREGA A PAGINA (13/09/2026, auditoria do iPhone).
 *
 * A recuperacao que existia deixava o mundo CONGELADO e parecia ter dado certo:
 * `Renderer.onContextLost` chama `stop()` sem argumento, que esvazia a lista de
 * render, e `onContextRestored` chamava `render()` sem funcao — o laco voltava
 * sem o `MapRenderer`. Os buffers de sprite tambem nao voltavam
 * (`SpriteRenderer.init` guarda por `if (!_buffer)`), nem chao, modelos e ceu.
 * O aviso sumia, a cena ficava parada, e so recarregar resolvia.
 *
 * Reconstruir cada recurso da GPU e um porte grande; recarregar e o que o
 * jogador ja fazia a mao, so que sem a tela congelada no meio. O personagem
 * esta no servidor, e nada se perde.
 *
 * DUAS portas levam a recarga:
 *   - o navegador devolveu o contexto: recarrega na hora;
 *   - o navegador nao devolveu: recarrega mesmo assim depois de
 *     `MS_ATE_RECARREGAR`. O iOS derruba o contexto sob pressao de memoria e
 *     nem sempre o devolve — esperar o `webglcontextrestored` seria esperar
 *     para sempre.
 * Teste: `tests/renderer/perdaDeContexto.test.js`.
 */

/** O tempo do aviso na tela antes de recarregar. */
export const MS_ATE_RECARREGAR = 1500;

/** O texto que o jogador ve no aviso. */
export const AVISO_DE_PERDA_DE_CONTEXTO =
	'<h2 style="color:#ff6b6b; margin-bottom:10px;">A tela do jogo foi reiniciada</h2>' +
	'<p>O navegador liberou a placa de video.</p>' +
	'<p style="font-size:0.9em; opacity:0.8;">Recarregando o jogo...</p>';

/**
 * @param {{ setTimeout: Function, location: { reload: Function } }} janela
 * @param {number} [ms]
 * @return {*} o identificador do relogio
 */
export function agendarRecarga(janela, ms = MS_ATE_RECARREGAR) {
	return janela.setTimeout(() => janela.location.reload(), ms);
}

/**
 * @param {{ location: { reload: Function } }} janela
 */
export function recarregarAgora(janela) {
	janela.location.reload();
}
