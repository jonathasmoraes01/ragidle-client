/**
 * UI/Components/ItemSelection/ItemSelection.js
 *
 * ItemSelection windows
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import DB from 'DB/DBManager.js';
import SkillInfo from 'DB/Skills/SkillInfo.js';
import Client from 'Core/Client.js';
import Renderer from 'Renderer/Renderer.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import Inventory from 'UI/Components/Inventory/Inventory.js';
import 'UI/Elements/Elements.js';
import htmlText from './ItemSelection.html?raw';
import cssText from './ItemSelection.css?raw';

/**
 * Create ItemSelection namespace
 */
const ItemSelection = new GUIComponent('ItemSelection', cssText);

/* Janela entra/sai com a animacao unica (Fase 3, 01/09/2026). */
ItemSelection.riAnimaJanela = true;

ItemSelection.render = () => htmlText;

/**
 * Sanitize HTML, allowing only whitelisted tags (font, i, b)
 */
function _sanitizeHtml(str) {
	const whitelist = ['font', 'i', 'b'];
	const div = document.createElement('div');
	div.innerHTML = str;
	div.querySelectorAll('*').forEach(el => {
		if (!whitelist.includes(el.tagName.toLowerCase())) {
			el.replaceWith(...el.childNodes);
		}
	});
	return div.innerHTML;
}

/**
 * Initialize UI
 */
ItemSelection.init = function init() {
	const root = ItemSelection.getRoot();

	this.list = root.querySelector('.list');
	this.index = 0;

	this.draggable(root.querySelector('.head'));

	// Click Events
	root.querySelector('.ok').addEventListener('click', () => {
		ItemSelection.selectIndex();
	});
	root.querySelector('.cancel').addEventListener('click', () => {
		ItemSelection.index = -1;
		ItemSelection.selectIndex();
	});

	// Bind events
	root.querySelector('#ItemSelection').addEventListener('dblclick', e => {
		const item = e.target.closest('.item');
		if (item) {
			ItemSelection.selectIndex();
		}
	});
	root.querySelector('#ItemSelection').addEventListener('mousedown', e => {
		const item = e.target.closest('.item');
		if (item) {
			ItemSelection.setIndex(Math.floor(item.getAttribute('data-index')));
		}
	});
};

/**
 * Once append to body
 */
ItemSelection.onAppend = function onAppend() {
	this._host.style.top = `${(Renderer.height - 200) / 2}px`;
	this._host.style.left = `${(Renderer.width - 200) / 2}px`;
};

/**
 * Add elements to the list
 *
 * @param {Array} list object to display
 */
ItemSelection.setList = function setList(list, isSkill) {
	const root = ItemSelection.getRoot();
	const listEl = root.querySelector('.list');
	listEl.innerHTML = '';

	for (let i = 0, count = list.length; i < count; ++i) {
		if (isSkill) {
			if (list[i] > 0 && list[i] in SkillInfo) {
				const item = SkillInfo[list[i]];
				const file = item.Name;
				const name = item.SkillName;
				addElement(DB.INTERFACE_PATH + 'item/' + file + '.bmp', list[i], name);
			}
		} else {
			const item = Inventory.getUI().getItemByIndex(list[i]);
			if (item) {
				const it = DB.getItemInfo(item.ITID);
				if (it) {
					const file = item.IsIdentified ? it.identifiedResourceName : it.unidentifiedResourceName;
					const name = DB.getItemName(item, {
						showItemGrade: false,
						showItemSlots: false,
						showItemOptions: false
					});
					addElement(DB.INTERFACE_PATH + 'item/' + file + '.bmp', list[i], name);
				}
			}
		}
	}

	this.setIndex(list[0]);
};

/**
 * Add an element to the list
 *
 * @param {string} image url
 * @param {number} index in list
 * @param {string} element name
 */
function addElement(url, index, name) {
	const root = ItemSelection.getRoot();
	const listEl = root.querySelector('.list');

	const div = document.createElement('div');
	div.className = 'item';
	div.setAttribute('data-index', index);
	div.innerHTML = '<div class="icon ri-tile"></div>' + `<span class="name">${_sanitizeHtml(name)}</span>`;
	listEl.appendChild(div);

	Client.loadFile(url, data => {
		const icon = root.querySelector(`div[data-index="${index}"] .icon`);
		if (icon) {
			icon.style.backgroundImage = `url(${data})`;
		}
	});
}

/**
 * Change selection
 *
 * @param {number} id in list
 */
ItemSelection.setIndex = function setIndex(id) {
	const root = ItemSelection.getRoot();
	const prev = root.querySelector(`div[data-index="${this.index}"]`);
	if (prev) {
		prev.classList.remove('is-selecionado');
	}
	/* Selecionado = borda de acento + tinta (regra do design system), nunca
	   mais cor hardcoded no JS -- ver ".is-selecionado" em ItemSelection.css. */
	const next = root.querySelector(`div[data-index="${id}"]`);
	if (next) {
		next.classList.add('is-selecionado');
	}
	this.index = id;
};

/**
 * Select a server, callback
 */
ItemSelection.selectIndex = function selectIndex() {
	this.onIndexSelected(this.index);
	this.remove();
};

/**
 * Free variables once removed from HTML
 */
ItemSelection.onRemove = function onRemove() {
	this.index = 0;
};

/**
 * Set new window name
 *
 * @param {string} title
 */
ItemSelection.setTitle = function setTitle(title) {
	const root = ItemSelection.getRoot();
	const text = root.querySelector('.head .text');
	if (text) {
		text.textContent = title;
	}
};

/**
 * Functions to define
 */
ItemSelection.onIndexSelected = function onIndexSelected() {};

/**
 * Create component based on view file and export it
 */
export default UIManager.addComponent(ItemSelection);
