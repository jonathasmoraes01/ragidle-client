/**
 * UI/Components/MakeItemSelection/MakeItemSelection.js
 *
 * MakeItemSelection windows
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import DB from 'DB/DBManager.js';
import Client from 'Core/Client.js';
import KEYS from 'Controls/KeyEventHandler.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import Inventory from 'UI/Components/Inventory/Inventory.js';
import { ehDedo } from 'UI/escalaDaHud.js';
import 'UI/Elements/Elements.js';
import htmlText from './MakeItemSelection.html?raw';
import cssText from './MakeItemSelection.css?raw';

/**
 * Create MakeItemSelection namespace
 */
const MakeItemSelection = new GUIComponent('MakeItemSelection', cssText);

MakeItemSelection.render = () => htmlText;

/* Janela entra/sai com a animacao unica (Fase 3, 01/09/2026). */
MakeItemSelection.riAnimaJanela = true;

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

const validMultipleMaterials = [
	1000 //star crumb
];

const validSingleMaterials = [
	997, //great nature
	996, //rough wind
	995, //mystic frozen
	994 //flame heart
];

/** Quantos slots o `CZ_REQMAKINGITEM` tem (`material_ID[3]`). */
const SLOTS_DE_MATERIAL = 3;

/**
 * OS PRODUTOS DO REFINO DE MINERIO (forja elemental, 14/10/2026): o Ferro, o
 * Aco, a Estrelinha e as quatro pedras, as receitas de `BS_IRON`, `BS_STEEL`
 * e `BS_ENCHANTEDSTONE` (rAthena `db/pre-re/produce_db.txt`). Eles nao sao
 * equipamento, e por isso a pedra e a Estrelinha nos slots nao valem nada
 * para eles: o servidor so as le no ramo de ARMA (`equip`, skill.cpp:12926).
 *
 * O `metalprocessitemlist` do cliente oficial descreve os materiais de TODAS
 * as receitas de forja, de minerio e de arma, entao `processitemlist` nao
 * separa as duas. Sem esta lista a janela levava o Ferro para a tela dos
 * opcionais, com tres slots vazios que nao faziam nada.
 */
const PRODUTOS_SEM_MATERIAL_OPCIONAL = new Set([998, 999, 1000, 994, 995, 996, 997]);

/**
 * A receita deste item aceita pedra e Estrelinha?
 *
 * @param {number} itemId
 * @return {boolean}
 */
export function aceitaMaterialOpcional(itemId) {
	if (PRODUTOS_SEM_MATERIAL_OPCIONAL.has(Number(itemId))) {
		return false;
	}
	const it = DB.getItemInfo(itemId);
	return !!it && typeof it.processitemlist === 'string' && it.processitemlist !== '';
}

/**
 * Track current ok/dblclick handlers so we can replace them
 */
let _okHandler = null;
let _dblClickHandler = null;

/**
 * Initialize UI
 */
MakeItemSelection.init = function init() {
	const root = MakeItemSelection.getRoot();

	this.list = root.querySelector('.list');
	this.index = 0;
	this.mkType = 0;
	this.material = [];

	this.draggable(root.querySelector('.head'));

	// Click Events
	root.querySelector('ui-button.cancel').addEventListener('click', () => {
		MakeItemSelection.cancelar();
	});

	// Bind mousedown on items
	root.querySelector('#MakeItemSelection').addEventListener('mousedown', e => {
		const item = e.target.closest('.list .item');
		if (item) {
			MakeItemSelection.setIndex(Math.floor(item.getAttribute('data-index')));
		}
	});

	// on drop item
	const materials = root.querySelector('.materials');
	materials.addEventListener('drop', onDrop);
	materials.addEventListener('dragover', stopPropagation);

	/*
	 * CLIQUE E TOQUE (forja elemental, 14/10/2026): o slot cheio devolve o
	 * material a mochila, e o botao de cada material da mochila o poe no
	 * primeiro slot livre. `click` serve aos dois: o toque tambem o dispara, e
	 * o arrasto do HTML5 (o unico caminho ate aqui) nao existe no celular.
	 */
	materials.addEventListener('click', e => {
		const slot = e.target.closest('.item');
		if (slot) {
			MakeItemSelection.removerMaterial(Number(slot.getAttribute('data-posicao')));
		}
	});
	root.querySelector('.disponiveis').addEventListener('click', e => {
		const botao = e.target.closest('.mat');
		if (botao && !botao.classList.contains('desligado')) {
			MakeItemSelection.colocarDaMochila(Number(botao.getAttribute('data-itid')));
		}
	});

	fecharOpcionais();
};

/**
 * Add elements to the list
 *
 * @param {Array} list object to display
 */
MakeItemSelection.setList = function setList(list) {
	const root = MakeItemSelection.getRoot();
	const listEl = root.querySelector('.list');
	listEl.innerHTML = '';
	listEl.style.backgroundColor = 'var(--surface-inset)';

	fecharOpcionais();
	this.mkType = 0;
	this.material = [];

	for (let i = 0, count = list.length; i < count; ++i) {
		const item = list[i];
		const it = DB.getItemInfo(item.ITID);
		const file = it.identifiedResourceName;
		const name = it.identifiedDisplayName;

		addElement(DB.INTERFACE_PATH + 'item/' + file + '.bmp', list[i].ITID, name);
	}

	this.setIndex(list[0].ITID);
	/*
	 * A TELA DOS OPCIONAIS E POR RECEITA, e nao pela lista inteira (14/10/2026).
	 * Era um booleano so, decidido aqui: bastava UMA receita da lista sem
	 * `processitemlist` para nenhuma ter opcionais, e bastava todas terem para o
	 * Ferro (que nao os aceita) abrir a tela de slots vazios.
	 */
	bindSelectEvents(aceitaMaterialOpcional);
};

/**
 * Add elements to the list
 *
 * @param {Array} list object to display
 */
MakeItemSelection.setCookingList = function setCookingList(list, mkType) {
	const root = MakeItemSelection.getRoot();
	const listEl = root.querySelector('.list');
	listEl.innerHTML = '';
	listEl.style.backgroundColor = 'var(--surface-inset)';

	fecharOpcionais();

	this.mkType = mkType;

	for (let i = 0, count = list.length; i < count; ++i) {
		const item = list[i];
		const it = DB.getItemInfo(item);
		const file = it.identifiedResourceName;
		const name = it.identifiedDisplayName;

		addElement(DB.INTERFACE_PATH + 'item/' + file + '.bmp', list[i], name);
	}

	this.setIndex(list[0].ITID);
	bindSelectEvents(() => false);
};

/**
 * Add an element to the list
 *
 * @param {string} image url
 * @param {number} index in list
 * @param {string} element name
 */
function addElement(url, index, name) {
	const root = MakeItemSelection.getRoot();
	const listEl = root.querySelector('.list');

	const div = document.createElement('div');
	div.className = 'item';
	div.setAttribute('data-index', index);
	div.innerHTML = '<div class="icon ri-tile"></div>' + `<span class="name">${_sanitizeHtml(name)}</span>`;
	listEl.appendChild(div);

	Client.loadFile(url, data => {
		const icon = root.querySelector(`.list div[data-index="${index}"] .icon`);
		if (icon) {
			icon.style.backgroundImage = `url(${data})`;
		}
	});
}

/** Esconde o bloco dos opcionais e esvazia os slots: o espaco some junto. */
function fecharOpcionais() {
	const root = MakeItemSelection.getRoot();
	const lista = root.querySelector('.list');
	if (lista) {
		lista.classList.remove('descricao');
	}
	const opcionais = root.querySelector('.opcionais');
	if (opcionais) {
		opcionais.classList.remove('aberto');
	}
	root.querySelectorAll('.materials .item').forEach(el => el.remove());
}

/**
 * Advances to the next screen of the item creation
 *
 * @param {number} index in list
 */
MakeItemSelection.advance = function advance() {
	const root = MakeItemSelection.getRoot();
	const listEl = root.querySelector('.list');
	listEl.innerHTML = '';

	const it = DB.getItemInfo(this.index);
	const title = `${it.identifiedDisplayName} ${DB.getMessage(426)}`;
	const metal = it.processitemlist;
	MakeItemSelection.setTitle(title);

	const okBtn = root.querySelector('ui-button.ok');
	if (_okHandler) {
		okBtn.removeEventListener('click', _okHandler);
	}
	_okHandler = () => MakeItemSelection.selectIndex();
	okBtn.addEventListener('click', _okHandler);

	listEl.style.backgroundColor = 'var(--surface-card)';
	// A descricao dos materiais tem duas ou tres linhas: a caixa encolhe ate ela,
	// em vez de manter os 130px da lista de receitas em branco por baixo.
	listEl.classList.add('descricao');
	listEl.innerHTML = `<pre>${_sanitizeHtml(it.identifiedDisplayName)} - ${DB.getMessage(427)}\n${_sanitizeHtml(metal)}</pre>`;

	root.querySelector('.opcionais').classList.add('aberto');
	desenharSlots();
	desenharDisponiveis();
};

/**
 * Change selection
 *
 * @param {number} id in list
 */
MakeItemSelection.setIndex = function setIndex(id) {
	const root = MakeItemSelection.getRoot();
	id = id === 0 ? this.index : id;
	const prev = root.querySelector(`.list div[data-index="${this.index}"]`);
	if (prev) {
		prev.classList.remove('select');
	}
	const next = root.querySelector(`.list div[data-index="${id}"]`);
	if (next) {
		next.classList.add('select');
	}
	this.index = id;
};

/**
 * Select a server, callback
 */
MakeItemSelection.selectIndex = function selectIndex() {
	this.onIndexSelected(this.index, this.material, this.mkType);
	if (this.index == -1) {
		this.material.forEach(item => Inventory.getUI().addItem(item));
	}
	this.remove();
};

/**
 * Cancela: o mesmo `index -1` do botao Cancelar, que avisa o servidor (o
 * menu fecha la tambem, `clif_menuskill_clear`) e devolve a mochila o que
 * estava nos slots.
 */
MakeItemSelection.cancelar = function cancelar() {
	MakeItemSelection.index = -1;
	MakeItemSelection.selectIndex();
};

/**
 * A janela abre no MEIO da tela (14/10/2026). O `:host` nasce em 0,0, e ali
 * ela caia em cima do painel de personagem do canto, que ficava por cima e
 * tomava o clique do Confirmar (medido na foto da forja). No celular em pe a
 * regra de painel (D-932) posiciona por cima disto.
 */
MakeItemSelection.onAppend = function onAppend() {
	const host = this._host;
	if (!host || !host.style || typeof window === 'undefined') {
		return;
	}
	const largura = host.offsetWidth || 200;
	const altura = host.offsetHeight || 220;
	host.style.left = Math.max(0, Math.round((window.innerWidth - largura) / 2)) + 'px';
	host.style.top = Math.max(0, Math.round((window.innerHeight - altura) / 3)) + 'px';
};

/**
 * Free variables once removed from HTML
 */
MakeItemSelection.onRemove = function onRemove() {
	this.index = 0;
};

MakeItemSelection.onKeyDown = function onKeyDown(event) {
	if (event.which === KEYS.ESCAPE || event.key === 'Escape') {
		/*
		 * O ESC CANCELA, e nao so fecha (14/10/2026): o `remove()` de antes
		 * deixava os materiais fora da mochila desenhada (eles saem dela ao
		 * entrar no slot) ate o proximo pacote de inventario.
		 */
		this.cancelar();
	}
};

/**
 * Set new window name
 *
 * @param {string} title
 */
MakeItemSelection.setTitle = function setTitle(title) {
	const root = MakeItemSelection.getRoot();
	const text = root.querySelector('.head .text');
	if (text) {
		text.textContent = title;
	}
};

/**
 * Functions to define
 */
MakeItemSelection.onIndexSelected = function onIndexSelected() {};

/**
 * O material cabe nos slots agora? Tres no maximo, e UMA pedra so: a forja le
 * so a primeira (`ele == 0`, rAthena skill.cpp:12893), e a segunda seria
 * gasta a toa.
 *
 * @param {number} itemId
 * @return {boolean}
 */
function cabeNosSlots(itemId) {
	if (MakeItemSelection.material.length >= SLOTS_DE_MATERIAL) {
		return false;
	}
	if (validMultipleMaterials.includes(itemId)) {
		return true;
	}
	if (!validSingleMaterials.includes(itemId)) {
		return false;
	}
	return !MakeItemSelection.material.some(it => validSingleMaterials.includes(it.ITID));
}

/**
 * Insert material to creation
 *
 * @param {object} Item
 */
MakeItemSelection.addMaterial = function AddMaterial(item, from) {
	if (!cabeNosSlots(item.ITID)) {
		return;
	}
	switch (from) {
		case 'Inventory':
			Inventory.getUI().removeItem(item.index, 1);
			break;
	}
	this.material.push(item);
	desenharSlots();
	desenharDisponiveis();
};

/**
 * Poe no primeiro slot livre UMA unidade do material da mochila (clique ou
 * toque no botao dele).
 *
 * @param {number} itemId
 */
MakeItemSelection.colocarDaMochila = function colocarDaMochila(itemId) {
	const naMochila = Inventory.getUI().getItemById(itemId);
	if (!naMochila || !(naMochila.count > 0)) {
		return;
	}
	this.addMaterial(Object.assign({}, naMochila, { count: 1 }), 'Inventory');
};

/**
 * Tira o material do slot e o devolve a mochila desenhada.
 *
 * @param {number} posicao - a posicao nos slots
 */
MakeItemSelection.removerMaterial = function removerMaterial(posicao) {
	const item = this.material[posicao];
	if (!item) {
		return;
	}
	this.material.splice(posicao, 1);
	Inventory.getUI().addItem(Object.assign({}, item, { count: 1 }));
	desenharSlots();
	desenharDisponiveis();
};

/** O icone do item num elemento, pelo `.bmp` do GRF. */
function pintarIcone(elemento, item) {
	const it = DB.getItemInfo(item.ITID);
	Client.loadFile(
		DB.INTERFACE_PATH +
			'item/' +
			(item.IsIdentified === false || item.IsIdentified === 0
				? it.unidentifiedResourceName
				: it.identifiedResourceName) +
			'.bmp',
		data => {
			elemento.style.backgroundImage = `url(${data})`;
		}
	);
}

/**
 * Os tres slots: cheio mostra o item (e sai no clique), vazio e uma caixa
 * tracejada. O icone vai no PROPRIO elemento: duas Estrelinhas da mesma pilha
 * tem o mesmo `index`, e um `querySelector` pelo indice pintava so a primeira.
 */
function desenharSlots() {
	const root = MakeItemSelection.getRoot();
	const content = root.querySelector('.materials');
	content.innerHTML = '';
	for (let posicao = 0; posicao < SLOTS_DE_MATERIAL; posicao++) {
		const item = MakeItemSelection.material[posicao];
		const div = document.createElement('div');
		if (item) {
			div.className = 'item';
			div.setAttribute('data-index', item.index);
			div.setAttribute('data-posicao', String(posicao));
			div.setAttribute('draggable', 'false');
			div.title = DB.getItemInfo(item.ITID).identifiedDisplayName || '';
			const icone = document.createElement('div');
			icone.className = 'icon ri-tile';
			div.appendChild(icone);
			pintarIcone(icone, item);
		} else {
			div.className = 'vazio';
		}
		content.appendChild(div);
	}
}

/**
 * Os materiais que a mochila TEM, um botao por item (a Estrelinha e as quatro
 * pedras), com a quantidade que ainda resta. O que nao cabe mais fica
 * apagado; o que a mochila nao tem nao aparece.
 */
function desenharDisponiveis() {
	const root = MakeItemSelection.getRoot();
	const lista = root.querySelector('.disponiveis');
	const dica = root.querySelector('.dica');
	lista.innerHTML = '';
	let algum = false;
	for (const itemId of [...validMultipleMaterials, ...validSingleMaterials.slice().reverse()]) {
		const naMochila = Inventory.getUI().getItemById(itemId);
		if (!naMochila || !(naMochila.count > 0)) {
			continue;
		}
		algum = true;
		const botao = document.createElement('div');
		botao.className = 'mat' + (cabeNosSlots(itemId) ? '' : ' desligado');
		botao.setAttribute('data-itid', String(itemId));
		botao.title = DB.getItemInfo(itemId).identifiedDisplayName || '';
		const icone = document.createElement('div');
		icone.className = 'icon ri-tile';
		const qtd = document.createElement('span');
		qtd.className = 'qtd';
		qtd.textContent = String(naMochila.count);
		botao.appendChild(icone);
		botao.appendChild(qtd);
		lista.appendChild(botao);
		pintarIcone(icone, naMochila);
	}
	if (!algum) {
		dica.textContent = 'Sem Estrelinha nem pedra elemental na mochila.';
	} else if (ehDedo()) {
		dica.textContent = 'Toque num material para colocar; toque no slot para tirar.';
	} else {
		dica.textContent = 'Clique ou arraste um material; clique no slot para tirar.';
	}
}

/**
 * Drop an item from storage to inventory
 *
 * @param {event}
 */
function onDrop(event) {
	event.preventDefault();
	event.stopImmediatePropagation();

	let data;

	try {
		data = JSON.parse(event.dataTransfer.getData('Text'));
	} catch (_e) {
		// Ignore invalid JSON data
	}

	if (!data || data.type !== 'item' || data.from !== 'Inventory') {
		return false;
	}

	const item = data.data;
	item.count = 1;

	MakeItemSelection.addMaterial(item, data.from);
	return false;
}

/**
 * Stop event propagation
 */
function stopPropagation(event) {
	event.preventDefault();
	event.stopImmediatePropagation();
}

/**
 * O Confirmar e o duplo clique da lista: a receita que aceita opcionais vai
 * para a tela deles, e a que nao aceita sai direto.
 *
 * @param {function(number): boolean} aceitaOpcionais
 */
function bindSelectEvents(aceitaOpcionais) {
	const root = MakeItemSelection.getRoot();
	const okBtn = root.querySelector('ui-button.ok');
	const mainEl = root.querySelector('#MakeItemSelection');

	// Remove old handlers
	if (_okHandler) {
		okBtn.removeEventListener('click', _okHandler);
	}
	if (_dblClickHandler) {
		mainEl.removeEventListener('dblclick', _dblClickHandler);
	}

	const seguir = () => {
		if (aceitaOpcionais(MakeItemSelection.index)) {
			MakeItemSelection.advance();
		} else {
			MakeItemSelection.selectIndex();
		}
	};
	_okHandler = seguir;
	_dblClickHandler = e => {
		const item = e.target.closest('.list .item');
		if (item) {
			seguir();
		}
	};

	okBtn.addEventListener('click', _okHandler);
	mainEl.addEventListener('dblclick', _dblClickHandler);
}

/**
 * Create component based on view file and export it
 */
export default UIManager.addComponent(MakeItemSelection);
