/**
 * WinLoginCommon.js
 *
 * Create a common login window for the game.
 *
 * @author AoShinHo
 */

import DB from 'DB/DBManager.js';
import Configs from 'Core/Configs.js';
import Preferences from 'Core/Preferences.js';
import KEYS from 'Controls/KeyEventHandler.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import 'UI/Elements/Elements.js';

export function createWinLogin({ name, htmlText, cssText }) {
	const Component = new GUIComponent(name, cssText);
	Component.render = () => htmlText;
	Component.needFocus = false;

	const _preferences = Preferences.get('WinLogin', { saveID: true, ID: '' }, 1.0);

	let _inputUsername;
	let _inputPassword;
	let _buttonSave;

	Component.init = function init() {
		// SEM this.draggable() de proposito (19/08/2026): GUIComponent#
		// _fixPositionOverflow() so roda pra componente draggable, e ela le
		// Renderer.width/height (UI/ClampToViewport.js) -- que ainda estao no
		// default "0" aqui, porque o WinLogin aparece ANTES do Renderer.init()
		// (a cena 3D so comeca depois do login). Com WIDTH=HEIGHT=0 o clamp
		// achava que a janela sempre estourava a viewport e reescrevia
		// left/top pra "0px" -- prendia a janela no canto superior esquerdo
		// TODA vez, mascarado ate agora porque a V2 antiga nao tinha fundo/
		// botao visivel (bitmap ausente no GRF) pra alguem notar a posicao
		// errada. A pele nao arruma o bug do outro lado (Renderer/
		// ClampToViewport sao codigo de motor, fora do escopo desta tela) --
		// so evita disparar esse caminho aqui, perdendo so o arrastar (que
		// esta janela nunca precisou).
		const root = this.getRoot();
		// Save element references
		_inputUsername = root.querySelector('.user');
		_inputPassword = root.querySelector('.pass');
		_buttonSave = root.querySelector('.save');

		// Preserve typed credentials when positioning the caret or using autofill.
		for (const input of [_inputUsername, _inputPassword]) {
			input.addEventListener('mousedown', event => event.stopImmediatePropagation());
		}

		// Save button toggle
		_buttonSave.addEventListener('click', event => {
			toggleSaveButton();
			event.stopImmediatePropagation();
		});

		// Connect / Signup / Exit
		root.querySelector('.signup').addEventListener('click', signup);
		root.querySelector('.connect').addEventListener('click', connect);
		root.querySelector('.exit').addEventListener('click', exit);

		// Replay Upload, only present on the UI versions supporting replays
		const replayUpload = root.querySelector('.replay-upload');
		const replayButton = root.querySelector('.replay');

		if (!replayUpload || !replayButton) {
			return;
		}

		replayButton.addEventListener('click', () => {
			replayUpload.click();
		});
		replayUpload.addEventListener('change', function () {
			if (!this.files || !this.files.length) {
				return;
			}

			const file = this.files[0];
			this.value = ''; // reset so we can select same file again

			if (!file.name || !file.name.toLowerCase().endsWith('.rrf')) {
				UIManager.showMessageBox('Please select a Ragnarok replay file (.rrf).', 'ok');
				return;
			}

			loadReplay(file);
		});
	};

	Component.onAppend = function onAppend() {
		_inputUsername.value = _preferences.saveID ? _preferences.ID : '';
		_inputPassword.value = '';

		// Pele RAGIDLE (19/08/2026): o checkbox "manter conectado" era um
		// bitmap do cliente (chk_saveon/off.bmp) que a ROLatam GRF deste fork
		// tem, mas pintava a palavra "manter" direto no pixel. Virou marcacao
		// de classe + texto de verdade em WinLoginV2.html/css -- o ESTADO
		// (_preferences.saveID) continua exatamente o mesmo.
		_buttonSave.classList.toggle('is-checked', _preferences.saveID);
		_buttonSave.setAttribute('aria-pressed', String(_preferences.saveID));

		if (_preferences.ID.length) {
			_inputPassword.focus();
		} else {
			_inputUsername.focus();
		}

		Component.placeOnTop();
	};

	Component.onKeyDown = function onKeyDown(event) {
		if (this._host.style.display === 'none') return true;

		switch (event.which) {
			case KEYS.ENTER:
				if (this._shadow.activeElement?.tagName === 'BUTTON') {
					return true;
				}
				connect();
				event.stopImmediatePropagation();
				return false;
			case KEYS.ESCAPE:
				exit();
				event.stopImmediatePropagation();
				return false;
			case KEYS.TAB: {
				const controls = [...this.getRoot().querySelectorAll('input:not([type="file"]), button')].filter(
					el => !el.disabled && el.getClientRects().length
				);
				const index = controls.indexOf(this._shadow.activeElement);
				const target = controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length];
				target.focus();
				event.preventDefault();
				event.stopImmediatePropagation();
				return false;
			}
		}
		return true;
	};

	function toggleSaveButton() {
		_preferences.saveID = !_preferences.saveID;
		_buttonSave.classList.toggle('is-checked', _preferences.saveID);
		_buttonSave.setAttribute('aria-pressed', String(_preferences.saveID));
	}

	function exit() {
		Component.onExitRequest();
		return false;
	}

	function connect() {
		const user = _inputUsername.value;
		const pass = _inputPassword.value;
		if (_preferences.saveID) {
			_preferences.saveID = true;
			_preferences.ID = user;
		} else {
			_preferences.saveID = false;
			_preferences.ID = '';
		}
		_preferences.save();
		Component.onConnectionRequest(user, pass);
		return false;
	}

	async function loadReplay(file) {
		try {
			// Loaded on demand, the replay stack pulls in the whole map engine
			const { default: ReplayPlayer } = await import('Engine/Replay/ReplayPlayer.js');
			const replay = new ReplayPlayer();

			await replay.load(file);
			Component.remove();
			replay.start();
		} catch (err) {
			console.error('[Replay] Error loading replay', err);
			UIManager.showMessageBox(`Could not load the replay file.\n${err.message || err}`, 'ok');
		}
	}

	function signup() {
		const url = Configs.get('registrationweb');
		if (url) {
			UIManager.showPromptBox(
				DB.getMessage(662),
				'ok',
				'cancel',
				() => {
					window.open(url);
				},
				null
			);
		} else {
			UIManager.showPromptBox(
				'No registration URL was provided.\nIf this server uses simplified registration, then input your new:\n - Username followed by _M for Male and _F for Female account (Eg: MyUser_M)\n - Password.',
				'ok',
				'cancel',
				null,
				null
			);
		}
	}

	Component.onConnectionRequest = function onConnectionRequest() {};
	Component.onExitRequest = function onExitRequest() {};

	return UIManager.addComponent(Component);
}
