/**
 * Controls/ehEventoDaUI.js
 *
 * "ESTE EVENTO NASCEU DENTRO DA UI?" — a pergunta que separa o dedo (ou o
 * cursor) que tocou um botão do que tocou o CHÃO do mapa.
 *
 * Ela existia desde 19/08/2026 como uma função local do `MapControl.js`
 * (`ehCliqueDaUI`), escrita para um defeito de MOUSE: o ouvinte de clique do
 * MUNDO mora no `window`, não no canvas, então todo clique — inclusive dentro
 * de uma janela ou de um botão — chegava lá, e clicar num botão fazia o
 * personagem andar.
 *
 * Ela virou módulo em D-932 porque o MESMO defeito existe no TOQUE, e num
 * lugar diferente (`Core/Mobile.js`). Duplicar o predicado deixaria os dois
 * lados divergirem no dia em que alguém somasse um marcador novo de UI — e o
 * sintoma seria "no celular vaza, no computador não", que é a forma mais cara
 * de investigar.
 *
 * COMO ELA SABE: todo host de `GUIComponent` carrega `data-gui-component`
 * (`GUIComponent.js:238`), e o `composedPath()` do evento **atravessa Shadow
 * DOM** — sem isso o caminho pararia no host e todo alvo dentro de um
 * componente pareceria vir do documento.
 */

/**
 * @param {Event} evento um evento de ponteiro, mouse ou toque
 * @returns {boolean} verdadeiro se ele nasceu dentro de um componente de UI
 */
export function ehEventoDaUI(evento) {
	if (!evento || typeof evento.composedPath !== 'function') {
		return false;
	}
	const caminho = evento.composedPath();
	for (let i = 0; i < caminho.length; i++) {
		const no = caminho[i];
		if (!no || no.nodeType !== 1) {
			continue;
		}
		if (no.dataset && no.dataset.guiComponent !== undefined) {
			return true;
		}
		/* O véu do `WinPopup` não é um `GUIComponent`: ele é um overlay solto
		   que cobre a tela, e um toque nele tem de parar aqui do mesmo jeito. */
		if (no.classList && no.classList.contains('win_popup_overlay')) {
			return true;
		}
	}
	return false;
}

export default ehEventoDaUI;
