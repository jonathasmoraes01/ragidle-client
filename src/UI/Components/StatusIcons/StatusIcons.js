/**
 * UI/Components/StatusIcons/StatusIcons.js
 *
 * Status Icons UI
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import StatusTable from 'DB/Status/StatusInfo.js';
import { emPortugues } from '../../../DB/Status/StatusInfoPtBr.js';
import SC from 'DB/Status/StatusConst.js';
import DB from 'DB/DBManager.js';
import Texture from 'Utils/Texture.js';
import Client from 'Core/Client.js';
import Renderer from 'Renderer/Renderer.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import ScreenEffectManager from 'Renderer/ScreenEffectManager.js';
import Session from 'Engine/SessionStorage.js';
import htmlText from './StatusIcons.html?raw';
import cssText from './StatusIcons.css?raw';
import { getStatusEnd, getStatusIconsPerColumn, getStatusLabel, isStatusActive } from './statusTiming.js';

/**
 * Create component
 */
const StatusIcons = new GUIComponent('StatusIcons', cssText);

StatusIcons.render = () => htmlText;

/**
 * Mouse can cross this UI
 */
StatusIcons.mouseMode = GUIComponent.MouseMode.CROSS;

/**
 * @var {boolean} do not focus this UI
 */
StatusIcons.needFocus = false;

/**
 * @var {Array} status list
 */
let _status = {};

/**
 * @var {int} last updated time
 */
let _last_updated_time = Date.now();

/**
 * @var {int} render wait time
 */
const _render_time = 500;

const TKM_ICON_OVERRIDE = {
	[SC.ASPERSIO]: 'i_p_SAINT.tga',
	[SC.PROPERTYFIRE]: 'i_p_FIRE.tga',
	[SC.PROPERTYWATER]: 'i_p_WATER.tga',
	[SC.PROPERTYWIND]: 'i_p_WIND.tga',
	[SC.PROPERTYGROUND]: 'i_p_EARTH.tga',
	[SC.PROPERTYDARK]: 'i_p_DARK.tga',
	[SC.PROPERTYTELEKINESIS]: 'i_p_TELE.tga'
};

/**
 * Start rendering icons
 */
StatusIcons.onAppend = function onAppend() {
	resetElementsPosition();
	Renderer.render(rendering);
};

/**
 * Stop rendering icons
 */
StatusIcons.onRemove = function onRemove() {
	Renderer.stop(rendering);
};

/**
 * Clean up component
 */
StatusIcons.clean = function clean() {
	const root = StatusIcons.getRoot();
	const container = root.querySelector('#StatusIcons');
	if (container) {
		container.innerHTML = '';
	}
	_status = {};
	ScreenEffectManager.clean();
};

/**
 * Update icon on screen
 *
 * @param {number} status id
 * @param {number} enable/disable
 * @param {number} life time
 */
StatusIcons.update = function update(index, state, life) {
	const active = isStatusActive(state);

	// Um `state` explicito em zero e autoritativo, mesmo quando uma variante
	// de servidor conserva RemainMS no pacote de remocao.
	if (!active) {
		removeElementIndex(index);
		resetElementsPosition();
		return;
	}

	// Intialize slot
	if (!(index in _status)) {
		createElement(index);
	}

	// Save tick for progressbar
	_status[index].start = Renderer.tick;
	_status[index].end = getStatusEnd(Renderer.tick, life);

	// O cliente desta instalacao roda com loadLua:false porque o conjunto de
	// dados nao possui todos os LUBs. Um EFST legitimo sem entrada hardcoded
	// ainda precisa existir na HUD; recebe fallback ate haver arte oficial.
	if (!StatusTable[index] || !StatusTable[index].icon) {
		addFallbackStatusIcon(index);
		ScreenEffectManager.parseStatus(index);
		return;
	}

	// Image already loaded.
	//
	// For statuses with a TKM (Warm Wind) icon override, the variant
	// can flip when the player's job changes (e.g. @job from a
	// TaeKwon-tree class to another, or vice versa). The official
	// client also re-resolves the icon path on every status update —
	// so as long as the server re-emits the status (re-cast, refresh
	// scroll), we pick up the new variant. If the buff is held
	// without any re-emit, the cached icon stays, which matches the
	// official client behaviour.
	if (_status[index].img) {
		if (TKM_ICON_OVERRIDE[index]) {
			const isTKM = Session.Entity && DB.isTaeKwon(Session.Entity._job);
			const wantVariant = (isTKM && TKM_ICON_OVERRIDE[index]) || null;
			if (_status[index].tkmVariant !== wantVariant) {
				_status[index].img = null;
			} else {
				return;
			}
		} else {
			return;
		}
	}
	if (_status[index].loading) {
		return;
	}

	loadStatusIcon(index);

	ScreenEffectManager.parseStatus(index);
};

function loadStatusIcon(index) {
	const isTKM = Session.Entity && DB.isTaeKwon(Session.Entity._job);
	const tkmVariant = (isTKM && TKM_ICON_OVERRIDE[index]) || null;
	const iconName = tkmVariant || StatusTable[index].icon;
	_status[index].tkmVariant = tkmVariant;
	_status[index].loading = true;
	Client.loadFile(
		`data/texture/effect/${iconName}`,
		data => {
			Texture.load(data, function (success) {
				if (_status[index] && !_status[index].img) {
					_status[index].loading = false;
					if (!success || !this) {
						addFallbackStatusIcon(index);
						return;
					}
					addResizedStatusIcon(this, index);
				}
			});
		},
		() => addFallbackStatusIcon(index)
	);
}

/**
 * Um arquivo ausente nao pode transformar silenciosamente um buff ativo em
 * "nada". O fallback preserva o slot e o tooltip ate o GRF ser corrigido.
 */
function addFallbackStatusIcon(index) {
	if (!_status[index] || _status[index].img) {
		return;
	}

	const canvas = document.createElement('canvas');
	canvas.width = 32;
	canvas.height = 32;
	const ctx = canvas.getContext('2d');
	const gradient = ctx.createLinearGradient(0, 0, 0, 32);
	gradient.addColorStop(0, '#4b81b8');
	gradient.addColorStop(1, '#12315a');
	ctx.fillStyle = gradient;
	ctx.beginPath();
	ctx.roundRect(1, 1, 30, 30, 6);
	ctx.fill();
	ctx.strokeStyle = '#e9cc8f';
	ctx.stroke();
	ctx.fillStyle = '#ffffff';
	ctx.font = '700 10px Arial';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	const initials = getStatusLabel(SC, index)
		.split(' ')
		.slice(0, 2)
		.map(word => word.charAt(0))
		.join('')
		.toUpperCase();
	ctx.fillText(initials || '?', 16, 16);

	_status[index].loading = false;
	_status[index].img = canvas;
	addElement(_status[index].element);
}

function addResizedStatusIcon(img, index) {
	if (img.width < 33 && img.height < 33) {
		_status[index].img = img;
		addElement(_status[index].element);
		return;
	}

	const canvas = document.createElement('canvas');
	canvas.width = 32;
	canvas.height = 32;
	const ctx = canvas.getContext('2d');

	ctx.save();
	ctx.translate(0, 32); // Move to left
	ctx.scale(1, -1); // flip vertical  (official client does)

	// resize with scale
	const scale = Math.min(32 / img.width, 32 / img.height);
	const width = img.width * scale;
	const height = img.height * scale;
	const x = (32 - width) / 2;
	const y = (32 - height) / 2;

	ctx.drawImage(img, x, y, width, height);
	ctx.restore();

	const resizedImg = new Image();
	resizedImg.src = canvas.toDataURL();
	resizedImg.onload = () => {
		if (!_status[index]) {
			return;
		}
		_status[index].img = resizedImg;
		addElement(_status[index].element);
	};
}

/**
 * Reset elements position.
 *
 * Used when one element is removed.
 */
function resetElementsPosition() {
	const root = StatusIcons.getRoot();
	const elements = root.querySelectorAll('.state');
	const count = elements.length;
	const perColumn = getIconsPerColumn();

	for (let i = 0; i < count; ++i) {
		const element = elements[i];
		element.style.top = `${(i % perColumn) * 36}px`;
		element.style.right = `${Math.floor(i / perColumn) * 45}px`;
	}
}

function getIconsPerColumn() {
	const hostTop =
		StatusIcons._host && StatusIcons._host.isConnected ? StatusIcons._host.getBoundingClientRect().top : 0;
	return getStatusIconsPerColumn(Renderer.height, hostTop);
}

/**
 * Remove an element from list and DOM
 *
 * @param {number} index
 */
function removeElementIndex(index) {
	if (!(index in _status)) {
		return;
	}

	const element = _status[index].element;

	if (element && element.parentNode) {
		element.parentNode.removeChild(element);
	}

	ScreenEffectManager.cleanStatusEffect(index);

	delete _status[index];
}

/**
 * Create an element
 *
 * @param {number} index
 */
function createElement(index) {
	const state = document.createElement('div');
	state.className = 'state';

	const canvas = document.createElement('canvas');
	canvas.width = 32;
	canvas.height = 32;

	state.appendChild(canvas);

	_status[index] = {};
	_status[index].element = state;
	_status[index].ctx = canvas.getContext('2d');

	// Add description. Sem os LUBs stateicon, o nome do EFST e melhor que um
	// icone mudo: deixa o jogador e o diagnostico identificarem o buff ausente.
	const descriptions =
		StatusTable[index] && StatusTable[index].descript && StatusTable[index].descript.length
			? StatusTable[index].descript
			: [[getStatusLabel(SC, index)]];
	if (descriptions.length) {
		const info = document.createElement('div');
		info.className = 'description';

		const lines = descriptions;
		const count = lines.length;

		for (let i = 0; i < count; ++i) {
			const line = document.createElement('div');
			// A dica sai em PORTUGUES (03/09/2026). Frase sem traducao passa
			// direto — ver `StatusInfoPtBr.js` para o porque do dicionario.
			line.textContent = emPortugues(lines[i][0]);

			// Custom color
			if (lines[i][1]) {
				line.style.color = lines[i][1];
			}

			// Time value
			line.innerHTML = line.innerHTML.replace('%s', '<span class="time">0</span>');
			info.appendChild(line);
		}

		const time = info.getElementsByClassName('time');
		if (time.length) {
			_status[index].time = time[0];
			_status[index].timeTick = 0;
		}

		state.appendChild(info);
	}
}

/**
 * Add element to the list, helper for multi-column
 *
 * @param {CanvasElement}
 */
function addElement(element) {
	const root = StatusIcons.getRoot();
	const elements = root.querySelectorAll('.state');
	const max = getIconsPerColumn();
	const count = elements.length;
	const x = ((count / max) | 0) * 45;
	const y = (count % max) * 36;

	element.style.top = `${y}px`;
	element.style.right = `${x}px`;

	const container = root.querySelector('#StatusIcons');
	if (container) {
		container.appendChild(element);
	}
}

/**
 * Rendering a status icon
 *
 * @param {object} status
 * @param {number} tick
 */
function renderStatus(status, now) {
	if (!status.img) {
		return;
	}

	const ctx = status.ctx;
	const start = status.start;
	let end = status.end;
	let color, perc;

	if (now > end) {
		end = now;
	}

	if (end < now + 60000) {
		color = 'rgba(255,150,50,0.65)';
		perc = 1 - (end - now) / 60000;
	} else {
		color = 'rgba(255,255,255,0.65)';
		perc = (now - start) / (end - 60000 - start);
	}

	ctx.clearRect(0, 0, 32, 32);
	ctx.drawImage(status.img, 0, 0);
	ctx.fillStyle = color;

	ctx.beginPath();
	ctx.arc(16, 16, 24, 1.5 * Math.PI, ((1.5 + perc * 2) % 2) * Math.PI);
	ctx.lineTo(16, 16);
	ctx.fill();

	if (status.time && status.timeTick + 1000 < now) {
		status.timeTick = now;

		const tick = ((end - now) / 1000) | 0;
		const seconds = tick % 60;
		const minutes = (tick / 60) | 0;

		/*
		 * O TEMPO EM PORTUGUES, E O PLURAL CERTO (03/09/2026).
		 *
		 * O upstream escrevia `17 minute(s) 13 second(s)`: ingles, e com o `(s)`
		 * que evita decidir o plural. Em portugues da para decidir — 1 minuto, 2
		 * minutos —, e o `(s)` num HUD inteiro em portugues le como texto nao
		 * traduzido, que e o que o dono reportou.
		 *
		 * `DB.getMessage(1807/1808)` vem do `msgstringtable` do cliente oficial:
		 * quando ele existe, manda ele; o segundo argumento e so o fallback. Por
		 * isso a traducao passa por `emPortugues` DEPOIS — assim ela cobre os dois
		 * casos, a tabela e o fallback.
		 */
		const unidade = (n, chave, padrao) => `${n} ${emPortugues(DB.getMessage(chave, padrao))}${n === 1 ? '' : 's'}`;
		status.time.textContent =
			now >= end || end === Infinity
				? ''
				: (minutes ? `${unidade(minutes, 1807, 'minute')} ` : '') + unidade(seconds, 1808, 'second');
	}
}

/**
 * Rendering status icons progressbar
 *
 * @param {number} tick
 */
function rendering(tick) {
	const indexes = Object.keys(_status);
	const count = indexes.length;

	const time_now = Date.now();
	if (time_now - _last_updated_time > _render_time) {
		_last_updated_time = time_now;
		for (let i = 0; i < count; ++i) {
			renderStatus(_status[indexes[i]], tick);
		}
	}
}

/**
 * Create component and return it
 */
export default UIManager.addComponent(StatusIcons);
