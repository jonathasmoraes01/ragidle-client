/**
 * UI/Components/CashShopIcon/CashShopIcon.js
 *
 * CashShop Icon
 *
 * @author Alisonrag
 *
 */

import CashShop from 'UI/Components/CashShop/CashShop.js';
import Network from 'Network/NetworkManager.js';
import PACKETVER from 'Network/PacketVerManager.js';
import PACKET from 'Network/PacketStructure.js';
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
	// A ROTA E UNICA (I5, 31/08/2026): o gesto mora no proprio `CashShop`, e o
	// item "RO Shop" do menu chama o mesmo. Este icone esta aposentado da tela
	// (`MapEngine.js`), e o componente fica para quem quiser religa-lo.
	CashShop.toggle();
}

CashShopIcon.needFocus = false;
CashShopIcon.mouseMode = GUIComponent.MouseMode.CROSS;

/**
 * Create component and export it
 */
export default UIManager.addComponent(CashShopIcon);
