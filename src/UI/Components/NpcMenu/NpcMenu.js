/**
 * UI/Components/NpcMenu/NpcMenu.js
 *
 * Display npc menu
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import KEYS from 'Controls/KeyEventHandler.js';
import DB from 'DB/DBManager.js';
import Renderer from 'Renderer/Renderer.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import 'UI/Elements/Elements.js';
import htmlText from './NpcMenu.html?raw';
import cssText from './NpcMenu.css?raw';
import InputBox from 'UI/Components/InputBox/InputBox.js';
import { ehDedo } from 'UI/escalaDaHud.js';
import { posicaoDoMenu, LINHAS_SEM_ROLAR } from './posicaoDoMenu.js';

/**
 * Create NPC Menu component
 */
const NpcMenu = new GUIComponent('NpcMenu', cssText);

/* Dialogo entra/sai com a animacao unica (Fase 3, 01/09/2026). */
NpcMenu.riAnimaJanela = true;

NpcMenu.render = () => htmlText;

/**
 * Freeze mouse — NPC menu blocks interaction
 */
NpcMenu.mouseMode = GUIComponent.MouseMode.FREEZE;

/**
 * @var {number} index selected in menu
 */
let _index = 0;

/**
 * @var {number} NPC ID
 */
let _ownerID = 0;

/**
 * Helper: escape HTML
 */
function _escapeHTML(text) {
	const div = document.createElement('div');
	div.textContent = text;
	return div.innerHTML;
}

/**
 * Initialize component
 */
NpcMenu.init = function init() {
	const root = NpcMenu.getRoot();

	const okBtn = root.querySelector('.ok');
	if (okBtn) {
		okBtn.addEventListener('click', () => validate());
	}

	const cancelBtn = root.querySelector('.cancel');
	if (cancelBtn) {
		cancelBtn.addEventListener('click', () => cancel());
	}

	this._host.style.top = `${Math.max(376, Renderer.height / 2 + 76)}px`;
	this._host.style.left = `${Math.max(Renderer.width / 3, 20)}px`;

	this.draggable();

	const content = root.querySelector('.content');
	if (content) {
		content.addEventListener('mousedown', e => {
			const div = e.target.closest('div');
			if (div && content.contains(div)) {
				selectIndex(div);
			}
			e.stopImmediatePropagation();
		});

		content.addEventListener('dblclick', e => {
			const div = e.target.closest('div');
			if (div && content.contains(div)) {
				validate();
			}
		});
	}
};

/**
 * Clean up events
 */
NpcMenu.onRemove = function onRemove() {
	const root = NpcMenu.getRoot();
	const content = root.querySelector('.content');
	if (content) {
		content.innerHTML = '';
	}
};

/**
 * Bind KeyDown event
 */
NpcMenu.onKeyDown = function onKeyDown(event) {
	if (InputBox._host && InputBox._host.style.display !== 'none' && InputBox.__active) {
		return true;
	}

	if (this._host.style.display === 'none') {
		return true;
	}

	const root = NpcMenu.getRoot();
	const content = root.querySelector('.content');

	switch (event.which) {
		case KEYS.SPACE:
		case KEYS.ENTER:
			validate();
			break;

		case KEYS.ESCAPE:
			cancel();
			break;

		case KEYS.UP: {
			const divs = content.querySelectorAll('div[data-index]');
			_index = Math.max(_index - 1, 0);

			divs.forEach(d => d.classList.remove('selected'));
			if (divs[_index]) {
				divs[_index].classList.add('selected');
				divs[_index].scrollIntoView({ block: 'nearest' });
			}
			break;
		}

		case KEYS.DOWN: {
			const divs = content.querySelectorAll('div[data-index]');
			_index = Math.min(_index + 1, divs.length - 1);

			divs.forEach(d => d.classList.remove('selected'));
			if (divs[_index]) {
				divs[_index].classList.add('selected');
				divs[_index].scrollIntoView({ block: 'nearest' });
			}
			break;
		}

		default:
			return true;
	}

	event.stopImmediatePropagation();
	return false;
};

/**
 * Initialize menu
 *
 * @param {string} menu
 * @param {number} gid - npc id
 */
NpcMenu.setMenu = function setMenu(menu, gid) {
	const root = NpcMenu.getRoot();
	const content = root.querySelector('.content');
	const list = menu.split(':');

	_ownerID = gid;
	_index = 0;

	content.innerHTML = '';

	let j = 0;
	for (let i = 0, count = list.length; i < count; ++i) {
		if (list[i].length) {
			const div = document.createElement('div');
			div.innerHTML = DB.formatMsgToHtml(_escapeHTML(list[i]));
			div.dataset.index = j++;
			content.appendChild(div);
		}
	}

	const first = content.querySelector('div[data-index]');
	if (first) {
		first.classList.add('selected');
	}

	ajustarAoConteudo();
};

/**
 * A JANELA CRESCE COM AS OPCOES, ATE 7 LINHAS (D-2047, 06/10/2026).
 *
 * Mede a janela montada (a moldura, e a altura da lista mostrando 1, 2, ...
 * linhas), pergunta a `posicaoDoMenu` quantas linhas cabem e onde, e escreve o
 * `max-height` da lista e o top/left do host. A regra mora la (pura, com
 * teste e mutante); aqui so se mede e aplica.
 *
 * Tudo em pixels da TELA (`getBoundingClientRect`), e convertido para o CSS
 * do host dividindo pelo `zoom` que `escalaDaHud` poe nele no mouse com a
 * janela pequena (D-934): `zoom` escala tambem o top/left e o max-height.
 *
 * A caixa de fala e lida pelo id do host, e nao por import: o `NpcBox` ja
 * importa este componente.
 */
function ajustarAoConteudo() {
	const host = NpcMenu._host;
	const root = NpcMenu.getRoot();
	const middle = root && root.querySelector('.middle');
	if (!host || !middle || !host.isConnected) {
		return;
	}
	const linhas = middle.querySelectorAll('.content div[data-index]');
	if (!linhas.length) {
		return;
	}
	const zoom = parseFloat(host.style.zoom) || 1;

	// A lista inteira, sem teto, para medir.
	middle.style.maxHeight = 'none';
	const caixa = host.getBoundingClientRect();
	const lista = middle.getBoundingClientRect();
	const moldura = caixa.height - lista.height;
	const alturas = [];
	for (let l = 1; l <= Math.min(linhas.length, LINHAS_SEM_ROLAR); l++) {
		// Mostrar `l` linhas = da boca da lista ate o topo da linha seguinte
		// (a margem entre linhas vai junto); a ultima e a lista inteira.
		const fundo = l < linhas.length ? linhas[l].getBoundingClientRect().top : lista.bottom;
		alturas.push(moldura + (fundo - lista.top));
	}

	const box = document.getElementById('NpcBox');
	const falaVisivel = box && box.isConnected && box.style.display !== 'none' && getComputedStyle(box).display !== 'none';
	const fala = falaVisivel ? box.getBoundingClientRect() : null;

	const p = posicaoDoMenu({
		tela: { largura: window.innerWidth, altura: window.innerHeight },
		fala: fala && fala.height > 0 ? { top: fala.top, bottom: fala.bottom } : null,
		largura: caixa.width,
		alturas,
		preferida: {
			top: Math.max(376, Renderer.height / 2 + 76) * zoom,
			left: Math.max(Renderer.width / 3, 20) * zoom
		},
		centralizar: ehDedo()
	});

	middle.style.maxHeight = `${(alturas[p.linhas - 1] - moldura) / zoom}px`;
	host.style.top = `${p.top / zoom}px`;
	host.style.left = `${p.left / zoom}px`;
}

/**
 * Submit an index
 */
function validate() {
	NpcMenu.onSelectMenu(_ownerID, _index + 1);
}

/**
 * Pressed cancel, client send "255" as value
 */
function cancel() {
	NpcMenu.onSelectMenu(_ownerID, 255);
}

/**
 * Select an index, change background color
 */
function selectIndex(div) {
	const root = NpcMenu.getRoot();
	const content = root.querySelector('.content');
	const divs = content.querySelectorAll('div[data-index]');
	divs.forEach(d => d.classList.remove('selected'));
	div.classList.add('selected');

	_index = parseInt(div.dataset.index, 10);
}

/**
 * Abstract callback to define
 */
NpcMenu.onSelectMenu = function onSelectMenu(/* gid, index */) {};

/**
 * Create component and export it
 */
export default UIManager.addComponent(NpcMenu);
