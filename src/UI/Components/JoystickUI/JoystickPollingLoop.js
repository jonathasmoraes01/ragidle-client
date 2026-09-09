/**
 * UI/Components/JoystickUI/JoystickPollingLoop.js
 *
 * Provides a high-frequency interval loop to poll the Gamepad API
 * and trigger input state updates at a consistent rate.
 *
 * @author AoShinHo
 */

import InputService from './JoystickInputService.js';

let timeoutHandle = null;
const POLL_RATE_ACTIVE = 100; // 10 FPS
const POLL_RATE_IDLE = 1000; // 1 FPS
export default {
	start: function () {
		if (timeoutHandle) {
			return;
		}
		this.run();
	},
	/**
	 * A JANELA ESTA NA FRENTE DO JOGADOR?
	 *
	 * Relato do alfa (09/09/2026): com o jogo em SEGUNDO PLANO e um volante
	 * ligado, o personagem andava sozinho. A causa e estrutural: o laco de
	 * desenho usa `requestAnimationFrame` e PARA quando a aba sai da frente;
	 * este usa `setTimeout` e CONTINUA. Sem foco e com a aba visivel, ele roda
	 * a 10 Hz cheios — e como o eixo vira `Network.sendPacket` direto, o
	 * personagem anda no servidor sem nada ser desenhado.
	 *
	 * A especificacao da Gamepad API diz que so documento focado recebe dados,
	 * e o Chrome cumpre — mas este fork tambem e empacotado em Electron, onde
	 * a janela pode manter foco de sistema com o jogador achando que fechou. O
	 * codigo nao pode depender de uma protecao que ele nao controla.
	 *
	 * O laco NAO para: ele continua girando devagar, para reagir na hora em
	 * que o jogador volta. O que para e a LEITURA.
	 */
	estaNaFrente: function () {
		if (typeof document === 'undefined') {
			return true;
		}
		if (document.hidden) {
			return false;
		}
		// `hasFocus` pode nao existir em ambiente de teste; ausente = na frente.
		return typeof document.hasFocus === 'function' ? document.hasFocus() : true;
	},

	run: function () {
		const naFrente = this.estaNaFrente();
		const isConnected = naFrente ? InputService.update() : false;

		const nextDelay = isConnected ? POLL_RATE_ACTIVE : POLL_RATE_IDLE;
		const self = this;
		timeoutHandle = setTimeout(function () {
			self.run();
		}, nextDelay);
	},
	stop: function () {
		if (timeoutHandle) {
			clearTimeout(timeoutHandle);
			timeoutHandle = null;
		}
	}
};
