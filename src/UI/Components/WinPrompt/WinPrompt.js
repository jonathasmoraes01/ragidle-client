/**
 * UI/Components/WinPrompt/WinPrompt.js
 *
 * Prompt window
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import UIManager from 'UI/UIManager.js';
import WinPopup from 'UI/Components/WinPopup.js';

/**
 * Create Component
 */
const WinPrompt = WinPopup.clone('WinPrompt');

/* Dialogo entra/sai com a animacao unica (Fase 3, 01/09/2026). */
WinPrompt.riAnimaJanela = true;

/**
 * Initialize popup
 */
WinPrompt.init = function init() {
	this.draggable();
};

/**
 * Ask for something
 *
 * @param {string} text - question to ask
 * @param {string} btn_yes - first button name
 * @param {string} btn_no - second button name
 * @param {function} onYes - callback for first button
 * @param {function} onNo - callback for second button
 */
WinPrompt.ask = function ask(text, btn_yes, btn_no, onYes, onNo) {
	if (!this.__loaded) this.prepare();

	const root = this.getRoot();

	// Set text
	const textEl = root.querySelector('.text');
	if (textEl) {
		textEl.textContent = text;
	}

	// Clear existing buttons
	const btnsEl = root.querySelector('.btns');
	if (btnsEl) {
		btnsEl.innerHTML = '';

		/* Fase 3 (01/09/2026): os bitmaps btn_*.bmp sairam — mesmo padrao do
		   _createButton de UIManager: pele .ri-btn, rotulo em texto PT. */
		const rotulo = nome => ({ ok: 'OK', cancel: 'Cancelar', yes: 'Sim', no: 'Não' })[nome] || nome;

		// Create YES button
		const yesBtn = document.createElement('button');
		yesBtn.className = 'btn ri-btn';
		yesBtn.textContent = rotulo(btn_yes);
		yesBtn.addEventListener(
			'click',
			function () {
				WinPrompt.remove();
				if (onYes) {
					onYes();
				}
			},
			{ once: true }
		);

		// Create NO button
		const noBtn = document.createElement('button');
		noBtn.className = 'btn ri-btn ri-btn--sec';
		noBtn.textContent = rotulo(btn_no);
		noBtn.addEventListener(
			'click',
			function () {
				WinPrompt.remove();
				if (onNo) {
					onNo();
				}
			},
			{ once: true }
		);

		btnsEl.appendChild(yesBtn);
		btnsEl.appendChild(noBtn);
	}

	// Append and process remaining data-* attrs
	this.append();
};

/**
 * Create component based on view file and export it
 */
export default UIManager.addComponent(WinPrompt);
