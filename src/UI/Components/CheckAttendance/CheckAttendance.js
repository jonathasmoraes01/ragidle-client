/**
 * UI/Components/CheckAttendance/CheckAttendance.js
 *
 * Manage interface for Attendance
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import DB from 'DB/DBManager.js';
import Preferences from 'Core/Preferences.js';
import Renderer from 'Renderer/Renderer.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import htmlText from './CheckAttendance.html?raw';
import cssText from './CheckAttendance.css?raw';
import ChatBox from 'UI/Components/ChatBox/ChatBox.js';
import 'UI/Elements/Elements.js';

/**
 * Create Component
 */
const CheckAttendance = new GUIComponent('CheckAttendance', cssText);

CheckAttendance.render = () => htmlText;

/* Janela entra/sai com a animacao unica (Fase 3, 01/09/2026). */
CheckAttendance.riAnimaJanela = true;

/**
 * @var {object} _checkAttendanceData
 */
let _checkAttendanceData;

/**
 * @var {object} _CheckAttendanceInfo
 */
let _CheckAttendanceInfo;

/**
 * @var {Preferences} structure
 */
const _preferences = Preferences.get(
	'CheckAttendance',
	{
		x: 200,
		y: 200
	},
	1.0
);

/**
 * Initialize the component (event listener, etc.)
 */
CheckAttendance.init = function init() {
	_CheckAttendanceInfo = DB.getCheckAttendanceInfo();
	const root = this.getRoot();

	const baseEl = root.querySelector('.base');
	if (baseEl) {
		baseEl.addEventListener('mousedown', event => {
			event.stopImmediatePropagation();
			event.preventDefault();
		});
	}

	root.querySelector('.close-container-btn').addEventListener('click', () => {
		// via proxy: fecha COM a animacao unica (Fase 3)
		CheckAttendance.ui.hide();
	});

	this.draggable(root.querySelector('.titlebar'));
};

/**
 * Once append to the DOM, start to position the UI
 */
CheckAttendance.onAppend = function onAppend() {
	Object.assign(this._host.style, {
		top: `${Math.min(Math.max(0, _preferences.y), Renderer.height - this._host.getBoundingClientRect().height)}px`,
		left: `${Math.min(Math.max(0, _preferences.x), Renderer.width - this._host.getBoundingClientRect().width)}px`
	});

	if (!_preferences.show) {
		this._host.style.display = 'none';
	}

	if (_checkAttendanceData >= 0 && _CheckAttendanceInfo.Config) {
		CheckAttendance.updateUI();
		this.focus();
	} else {
		ChatBox.addText('Nao ha evento de presenca no momento.', ChatBox.TYPE.ERROR | ChatBox.TYPE.SELF);
	}
};

/**
 * Window Shortcuts
 */
CheckAttendance.onShortCut = function onShortCut(key) {
	switch (key.cmd) {
		case 'TOGGLE':
			if (this._host.style.display === 'none') {
				this.ui.show();
				this.focus();
			} else {
				this.ui.hide();
			}
			break;
	}
};

/**
 * Show/Hide UI
 */
CheckAttendance.toggle = function toggle() {
	if (this._host.style.display !== 'none') {
		this.ui.hide();
	} else {
		const _pkt = new PACKET.CZ.UI_OPEN();
		_pkt.UIType = 5;
		Network.sendPacket(_pkt);
	}
};

/**
 * Set Data to Attendance
 */
CheckAttendance.setData = function setData(data) {
	_checkAttendanceData = data;
};

/**
 * Update CheckAttendance UI
 */
CheckAttendance.updateUI = function updateUI() {
	const root = this.getRoot();
	let already_requested = 0;
	let attendance_count = 0;
	let current_day = 1;

	if (_CheckAttendanceInfo.Config) {
		const regex = /(\d{4})(\d{2})(\d{2})/;
		const start = regex.exec(_CheckAttendanceInfo.Config.StartDate);
		const end = regex.exec(_CheckAttendanceInfo.Config.EndDate);
		const period_string = `Evento: ${start[3]}/${start[2]} até ${end[3]}/${end[2]} às 24:00`;
		const periodEl = root.querySelector('.top-panel-period');
		if (periodEl) {
			periodEl.innerHTML = period_string;
		}

		if (_checkAttendanceData >= 0) {
			already_requested = _checkAttendanceData % 10;
			attendance_count = parseInt(_checkAttendanceData / 10);
			current_day = attendance_count + 1;
			const total_days_string =
				attendance_count >= 20 || already_requested
					? `${attendance_count} ${attendance_count === 1 ? 'dia resgatado' : 'dias resgatados'}`
					: `Clique no item para resgatar o dia ${current_day}`;

			const end_date = new Date(`${end[1]}-${end[2]}-${end[3]}`);
			const now_date = new Date();
			const remaining_days = Math.round(Math.abs((end_date.getTime() - now_date.getTime()) / (1000 * 3600 * 24)));

			const totalDaysEl = root.querySelector('.total-days');
			if (totalDaysEl) {
				totalDaysEl.innerHTML = total_days_string;
			}
			const remainingEl = root.querySelector('.remaining-day-text');
			if (remainingEl) {
				remainingEl.textContent = remaining_days;
			}
		}
	}

	if (_CheckAttendanceInfo.Rewards) {
		const daysList = root.querySelector('.days-list');
		for (let i = 0; i < 20; i++) {
			const item = DB.getItemInfo(_CheckAttendanceInfo.Rewards[i].item_id);
			const day = i + 1;
			/* Fase 3: os bitmaps do slot (bt_slot_a/press/complete/off) sairam —
			   o dia de hoje e classe (event_add_cursor, o CSS acende) e o selo
			   de resgatado e desenhado pelo CSS sobre .checked. So o ICONE DO
			   ITEM continua vindo do cliente, que e arte de jogo legitima. */
			const checked = day <= attendance_count ? 'checked' : 'checked-hidden';
			const item_slot =
				`<li id="attendance_day_${i}" class="attendance-item">` +
				`<div class="item" data-background="${DB.INTERFACE_PATH}item/${item.identifiedResourceName}.bmp">` +
				`<span class="item-quantity">${_CheckAttendanceInfo.Rewards[i].quantity}</span>` +
				`<span class="name">${item.identifiedDisplayName}</span>` +
				`<div class="${checked}"></div>` +
				'</div>' +
				`<div class="day">Dia ${day}</div>` +
				'</li>';
			if (daysList) {
				daysList.insertAdjacentHTML('beforeend', item_slot);
			}
			if (!already_requested && day == current_day) {
				const dayEl = root.querySelector(`#attendance_day_${i}`);
				if (dayEl) {
					dayEl.addEventListener('click', onClickAttendance);
					dayEl.classList.add('event_add_cursor');
				}
			}
		}

		const dataAttrSelector = '[data-background],[data-hover],[data-down],[data-active],[data-text],[data-preload]';
		if (daysList) {
			daysList.querySelectorAll(dataAttrSelector).forEach(node => {
				GUIComponent.processDataAttrs(node);
			});
		}
	}
};

/**
 * Clean CheckAttendance UI
 */
CheckAttendance.cleanUI = function cleanUI() {
	const root = CheckAttendance.getRoot();
	const periodEl = root.querySelector('.top-panel-period');
	if (periodEl) {
		periodEl.innerHTML = '';
	}
	const daysListEl = root.querySelector('.days-list');
	if (daysListEl) {
		daysListEl.innerHTML = '';
	}
	const totalDaysEl = root.querySelector('.total-days');
	if (totalDaysEl) {
		totalDaysEl.innerHTML = '';
	}
	const remainingEl = root.querySelector('.remaining-day-text');
	if (remainingEl) {
		remainingEl.innerHTML = '';
	}
};

/**
 * Close the window
 */
CheckAttendance.onClose = function onClose() {
	CheckAttendance.ui.hide(); // via proxy: fecha COM a animacao unica
};

/**
 * Request Attendance Item
 */
function onClickAttendance(e) {
	const root = CheckAttendance.getRoot();
	const el = e.currentTarget;
	const id = el.id;
	const checkedHidden = root.querySelector(`#${id} .checked-hidden`);
	if (checkedHidden) {
		checkedHidden.className = 'checked';
	}
	/* Fase 3: o selo de resgatado e pintado pelo CSS (.completed) — o .tga
	   bt_slot_complete saiu junto com o resto do bitmap. */
	const completedDiv = document.createElement('div');
	completedDiv.className = 'completed';
	el.appendChild(completedDiv);
	el.classList.remove('event_add_cursor');

	const current_day = parseInt(_checkAttendanceData / 10) + 1;
	const total_days_string = `${current_day} ${current_day === 1 ? 'dia resgatado' : 'dias resgatados'}`;
	const totalDaysEl = root.querySelector('.total-days');
	if (totalDaysEl) {
		totalDaysEl.innerHTML = total_days_string;
	}
	const _pkt = new PACKET.CZ.REQ_CHECK_ATTENDANCE();
	Network.sendPacket(_pkt);
}

/**
 * Export
 */
export default UIManager.addComponent(CheckAttendance);
