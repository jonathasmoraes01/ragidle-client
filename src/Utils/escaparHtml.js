/**
 * Utils/escaparHtml.js
 *
 * O escapador de HTML do projeto -- UM so, que serve para TEXTO e para
 * ATRIBUTO ao mesmo tempo.
 *
 * Por que ele existe (D-1308): quase todo componente tinha o seu proprio
 * `escapeHtml`/`_escapeHTML` montado assim --
 *
 *     const div = document.createElement('div');
 *     div.textContent = valor;
 *     return div.innerHTML;
 *
 * -- e esse round-trip por `textContent` NAO escapa aspas. Em conteudo de
 * texto isso nao importava, mas em ATRIBUTO (`data-tooltip="..."`,
 * `sender="..."`, `title="..."`) uma aspa fechava o atributo e o nome de outro
 * jogador virava HTML executavel. Era esse o furo de XSS que esta funcao
 * fecha, num lugar so.
 *
 * Escapamos os CINCO caracteres. Escapar `"` e `'` num contexto de TEXTO e
 * inocuo -- o navegador reexibe `&quot;`/`&#39;` como `"` e `'` --, entao a
 * MESMA funcao serve nos dois contextos e ninguem precisa lembrar de escolher
 * a versao "de atributo".
 *
 * Sem DOM de proposito: e pura (roda sem navegador, testavel sozinha) e o
 * round-trip por `textContent`/`innerHTML` era, alias, a origem do furo.
 *
 * @param {*} valor
 * @returns {string}
 */
export function escaparHtml(valor) {
	return String(valor === null || valor === undefined ? '' : valor)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

export default escaparHtml;
