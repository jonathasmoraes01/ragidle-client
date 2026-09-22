/**
 * UI/Components/CashShopIcon/CashShopIcon.js
 *
 * CashShop Icon
 *
 * @author Alisonrag
 *
 */

import RoShop from 'UI/Components/RoShop/RoShop.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import 'UI/Elements/Elements.js';
import htmlText from './CashShopIcon.html?raw';
import cssText from './CashShopIcon.css?raw';

/**
 * Create Component
 */
const CashShopIcon = new GUIComponent('CashShopIcon', cssText);

CashShopIcon.render = () => htmlText;

/**
 * One-time setup — bind events here (runs once during prepare)
 */
CashShopIcon.init = function init() {
	const root = this.getRoot();
	const btn = root.querySelector('.cashshop-icon');
	if (btn) {
		btn.addEventListener('mousedown', e => e.stopImmediatePropagation());
		btn.addEventListener('click', onClickCashShopIcon);
	}
};

/**
 * Handle click on CashShop icon
 */
function onClickCashShopIcon() {
	// A ROTA E UNICA (I5, 31/08/2026): o gesto mora na propria janela, e o item
	// "RO Shop" do menu chama o mesmo. Desde 22/09/2026 (D-RS-03) a janela e o
	// RO Shop novo, nao a `CashShop` nativa: a loja nativa deixou de ser caminho
	// de compra. Este icone esta aposentado da tela (`MapEngine.js`), e o
	// componente fica para quem quiser religa-lo - abrindo a MESMA porta.
	RoShop.toggle();
}

CashShopIcon.needFocus = false;
CashShopIcon.mouseMode = GUIComponent.MouseMode.CROSS;

/**
 * Create component and export it
 */
export default UIManager.addComponent(CashShopIcon);
