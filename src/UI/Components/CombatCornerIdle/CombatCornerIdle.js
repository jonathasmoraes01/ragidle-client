/**
 * Botao flutuante de ataque automatico no canto inferior direito.
 * O estado exibido sempre vem da configuracao aceita pelo servidor.
 */

import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import IdleConfig from 'UI/Components/IdleConfig/IdleConfig.js';
import RiIcones from 'UI/ri-icones.js';
import htmlText from './CombatCornerIdle.html?raw';
import cssText from './CombatCornerIdle.css?raw';

const POLL_INTERVAL_MS = 250;
const CombatCornerIdle = new GUIComponent('CombatCornerIdle', cssText);

CombatCornerIdle.render = () => htmlText.replace(/<!--RI_ICONE:(\w+)-->/g, (_, chave) => RiIcones[chave] || '');
CombatCornerIdle.mouseMode = GUIComponent.MouseMode.CROSS;
CombatCornerIdle.needFocus = false;

let pollTimer = null;

function root() {
	return CombatCornerIdle._shadow || CombatCornerIdle._host;
}

CombatCornerIdle.init = function init() {
	root().querySelector('.cc-btn--auto').addEventListener('click', onClickAuto);
};

CombatCornerIdle.onAppend = function onAppend() {
	if (!IdleConfig.serverConfig) {
		IdleConfig.pedirConfig();
	}
	syncAutoState();
	startPolling();
};

CombatCornerIdle.onRemove = function onRemove() {
	stopPolling();
};

function startPolling() {
	stopPolling();
	pollTimer = setInterval(syncAutoState, POLL_INTERVAL_MS);
}

function stopPolling() {
	if (pollTimer !== null) {
		clearInterval(pollTimer);
		pollTimer = null;
	}
}

function syncAutoState() {
	const button = root().querySelector('.cc-btn--auto');
	if (!button) {
		return;
	}

	const enabled = Boolean(IdleConfig.serverConfig && IdleConfig.serverConfig.cacaAutomatica);
	button.classList.toggle('is-on', enabled);
	button.setAttribute('aria-pressed', String(enabled));
}

function onClickAuto(event) {
	event.stopImmediatePropagation();
	IdleConfig.alternarCacaAutomatica();
}

export default UIManager.addComponent(CombatCornerIdle);
