/**
 * UI/Components/ChatBoxSettings/ChatBoxSettings.js
 *
 * Chat Box Settings
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 */

import Preferences from 'Core/Preferences.js';
import Renderer from 'Renderer/Renderer.js';
import Mouse from 'Controls/MouseEventHandler.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import htmlText from './ChatBoxSettings.html?raw';
import cssText from './ChatBoxSettings.css?raw';

/**
 * Create Component
 */
const ChatBoxSettings = new GUIComponent('ChatBoxSettings', cssText);

/* Janela entra/sai com a animacao unica (Fase 3, 01/09/2026). */
ChatBoxSettings.riAnimaJanela = true;

/**
 * Render HTML
 */
ChatBoxSettings.render = () => htmlText;

/**
 * @var {boolean} is ChatBoxSettings open ? (Temporary fix)
 */
ChatBoxSettings.isOpen = false;

ChatBoxSettings.tabOption = [];

ChatBoxSettings.activeTab = 0;

/**
 * @var {Preference} structure to save
 */
const _preferences = Preferences.get(
	'ChatBoxSettings',
	{
		x: 480,
		y: 200,
		width: 7,
		height: 4
	},
	1.0
);

/**
 * Initialize UI
 */
ChatBoxSettings.init = function init() {
	const root = this.getRoot();

	const extendBtn = root.querySelector('.extend');
	if (extendBtn) {
		extendBtn.addEventListener('mousedown', onResize);
	}

	const closeBtn = root.querySelector('.close');
	if (closeBtn) {
		closeBtn.addEventListener('click', () => {
			// via proxy: fecha COM a animacao unica (Fase 3)
			this.ui.hide();
		});
	}

	// Event delegation for option buttons
	const listOption = root.querySelector('.listoption');
	if (listOption) {
		listOption.addEventListener('click', event => {
			const btn = event.target.closest('button');
			if (btn) {
				onClickOption(btn);
			}
		});
	}

	// Nova aba / Remover aba (julgamento do dono, 19/08/2026 rodada 2 --
	// migraram pra ca dos icones "+"/"-" que moravam soltos no canto
	// superior direito do ChatBox, ver ChatBox.css). UIManager.getComponent()
	// em vez de "import ChatBox" no topo do arquivo: ChatBox.js JA importa
	// ChatBoxSettings.js, um import de volta criaria dependencia circular
	// -- mesmo padrao de lookup tardio que ChatBox.js usa pra ItemInfo.
	const addTabBtn = root.querySelector('.cbs-addtab');
	if (addTabBtn) {
		addTabBtn.addEventListener('click', () => {
			const ChatBox = UIManager.getComponent('ChatBox');
			if (ChatBox && ChatBox.tabCount <= 5) {
				ChatBox.addNewTab();
				ChatBox.onAppend();
			}
		});
	}

	const removeTabBtn = root.querySelector('.cbs-removetab');
	if (removeTabBtn) {
		removeTabBtn.addEventListener('click', () => {
			const ChatBox = UIManager.getComponent('ChatBox');
			if (ChatBox && ChatBox.tabCount > 1) {
				ChatBox.removeTab();
			}
		});
	}

	this.draggable('.titlebar');
};

/**
 * Once in HTML
 */
ChatBoxSettings.onAppend = function onAppend() {
	// Call resize first while visible so scrollHeight works and host height is updated
	resize(_preferences.height);

	const rect = this._host.getBoundingClientRect();
	this._host.style.top = Math.min(Math.max(0, _preferences.y), Renderer.height - rect.height) + 'px';
	this._host.style.left = Math.min(Math.max(0, _preferences.x), Renderer.width - rect.width) + 'px';
	this._host.style.display = 'none';
};

/**
 * Key Event Handler
 */
ChatBoxSettings.onKeyDown = function onKeyDown(event) {};

/**
 * Handle option button click
 *
 * Fase 4 (01/09/2026): o indicador ligado/desligado era um bitmap
 * (grp_online.bmp/grp_offline.bmp) trocado a mao a cada clique -- virou a
 * classe ".on", pintada por CSS (ChatBoxSettings.css: .cbs-opt.on). Sem
 * troca de imagem, o estado passa a morar SO na classe.
 */
function onClickOption(btn) {
	const dataId = parseInt(btn.getAttribute('data-id'), 10);
	const isOn = btn.classList.toggle('on');

	if (!isNaN(dataId)) {
		const idsIndex = ChatBoxSettings.tabOption[ChatBoxSettings.activeTab].indexOf(dataId);

		if (isOn) {
			if (idsIndex === -1) {
				ChatBoxSettings.tabOption[ChatBoxSettings.activeTab].push(dataId);
			}
		} else if (idsIndex > -1) {
			ChatBoxSettings.tabOption[ChatBoxSettings.activeTab].splice(idsIndex, 1);
		}
	}
}

/**
 * Resize ChatBoxSettings
 */
function onResize() {
	const rect = ChatBoxSettings._host.getBoundingClientRect();
	const top = rect.top;
	let lastHeight = 0;

	function resizeProcess() {
		const extraY = 31 + 19 - 30;
		let h = Math.floor((Mouse.screen.y - top - extraY) / 32);
		h = Math.min(Math.max(h, 3), 8);
		if (h === lastHeight) {
			return;
		}
		resize(h);
		lastHeight = h;
	}

	const interval = setInterval(resizeProcess, 30);

	const onMouseUp = event => {
		if (event.which === 1) {
			clearInterval(interval);
			window.removeEventListener('mouseup', onMouseUp);
		}
	};
	window.addEventListener('mouseup', onMouseUp);
}

ChatBoxSettings.toggle = function toggle() {
	if (this._host.style.display === 'none') {
		this.ui.show();
	} else {
		this.ui.hide();
	}
};

ChatBoxSettings.updateTab = function updateTab(tabID, tabName) {
	const root = this.getRoot();
	const optList = ChatBoxSettings.tabOption[tabID];
	const buttons = root.querySelectorAll('.content .listoption button');

	this.activeTab = tabID;

	root.querySelector('.tabname').textContent = tabName;

	buttons.forEach(btn => {
		const id = parseInt(btn.getAttribute('data-id'), 10);
		btn.classList.toggle('on', Boolean(optList && optList.includes(id)));
	});
};

/**
 * Extend window size
 */
function resize(height) {
	height = Math.min(Math.max(height, 3), 8);
	const root = ChatBoxSettings.getRoot();
	const content = root.querySelector('.content');
	if (content) {
		content.style.height = height * 32 + 'px';
	}
	const list = root.querySelector('.listoption');
	if (list) {
		list.style.height = height * 32 - 31 + 'px';
	}
	const inner = root.querySelector('#ChatBoxSettings');
	if (inner) {
		ChatBoxSettings._host.style.height = inner.offsetHeight + 'px';
	}
	_preferences.height = height;
	_preferences.save();
}

ChatBoxSettings.onRemove = function onRemove() {
	_preferences.y = parseInt(this._host.style.top, 10) || 0;
	_preferences.x = parseInt(this._host.style.left, 10) || 0;
	_preferences.save();
};

ChatBoxSettings.mouseMode = GUIComponent.MouseMode.STOP;

/**
 * Create component and export it
 */
export default UIManager.addComponent(ChatBoxSettings);
