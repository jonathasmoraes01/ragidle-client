/**
 * Core/Mobile.js
 *
 * Help to handle touch devices
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */
// TODO: resize event on mobile keyboard bug
// TODO: body overflow
// TODO: responsive design

/**
 * Import dependencies
 */
import Context from 'Core/Context.js';
import Events from 'Core/Events.js';
import Camera from 'Renderer/Camera.js';
import Session from 'Engine/SessionStorage.js';
import Mouse from 'Controls/MouseEventHandler.js';
import KEYS from 'Controls/KeyEventHandler.js';
import MobileUI from 'UI/Components/MobileUI/MobileUI.js';
import { ehEventoDaUI } from 'Controls/ehEventoDaUI.js'; // D-932: o toque para na UI, como o clique ja parava

/**
 * @var {boolean} is doing a gesture ?
 */
let _processGesture = false;

/**
 * @var {number} save angle and scale value
 */
let _scale, _angle, _touches, _intersect;

/**
 * Timer to detect delayed click
 */
let _timer = -1;

/**
 * O gesto ATUAL comecou dentro da UI? (D-932)
 *
 * O `touchend` e o `touchmove` nao trazem a resposta de graca: o alvo deles
 * pode ser outro elemento, porque o dedo anda. Quem decide e o `touchstart`,
 * e a decisao vale ate o dedo sair da tela — e a mesma logica de captura de
 * ponteiro que o arrasto ja usa.
 */
let _daUI = false;

/**
 * @namespace Mobile
 */
class Mobile {
	/**
	 * Initialize
	 */
	static init() {}
}

/**
 * Remove autofocus on mobile.
 * Let the user decide to focus an input/textarea by himself
 */
const remoteAutoFocus = (function removeAutoFocusClosure() {
	let _done = false;

	return function removeAutoFocus() {
		if (_done) {
			return;
		}
		_done = true;
	};
})();

/**
 * Return distance between touches
 *
 * @param {TouchList} touches
 * @return {number} distance
 */
function touchDistance(touches) {
	const x = touches[0].pageX - touches[1].pageX;
	const y = touches[0].pageY - touches[1].pageY;

	return Math.sqrt(x * x + y * y);
}

/**
 * Get angle from touches
 *
 * @param {TouchList} touches
 * @return {number} rotation angle
 */
function touchAngle(touches) {
	const x = touches[0].pageX - touches[1].pageX;
	const y = touches[0].pageY - touches[1].pageY;

	return (Math.atan2(y, x) * 180) / Math.PI;
}

/**
 * Get translation size (width)
 *
 * @param {TouchList} old touches
 * @param {TouchList} new touches
 */
function touchTranslationX(oldTouches, touches) {
	const x1 = touches[0].pageX - oldTouches[0].pageX;
	const x2 = touches[1].pageX - oldTouches[1].pageX;

	if (
		x1 &&
		x2 && // need a direction
		x1 < 0 === x2 < 0 && // same direction
		Math.abs(1 - x1 / x2) < 0.25 // need a coordinate movement
	) {
		return (x1 + x2) >> 1;
	}

	return 0;
}

/**
 * Get translation size (height)
 *
 * @param {TouchList} old touches
 * @param {TouchList} new touches
 */
function touchTranslationY(oldTouches, touches) {
	const y1 = touches[0].pageY - oldTouches[0].pageY;
	const y2 = touches[1].pageY - oldTouches[1].pageY;

	if (
		y1 &&
		y2 && // need a direction
		y1 < 0 === y2 < 0 && // same direction
		Math.abs(1 - y1 / y2) < 0.25 // need a coordinate movement
	) {
		return (y1 + y2) >> 1;
	}

	return 0;
}

/**
 * Start touching the screen
 * Process gesture, or action
 */
const onTouchStart = (function onTouchStartClosure() {
	function delayedClick() {
		// Only process mousedown if not doing a gesture
		if (!_processGesture) {
			_timer = -1;

			if (Mobile.onTouchStart) {
				Mobile.onTouchStart();
			}

			if (!_intersect) {
				if (Mobile.onTouchEnd) {
					Mobile.onTouchEnd();
				}
			}

			Mouse.intersect = _intersect;
		}
	}

	return function (event) {
		/*
		 * ═══════════════════════════════════════════════════════════════
		 * D-932 — O TOQUE PARA NA UI, COMO O CLIQUE JA PARAVA.
		 *
		 * Este ouvinte mora no `window` com `passive:false` e dava
		 * `preventDefault()` + `stopImmediatePropagation()` em TODO
		 * `touchstart`, sem perguntar onde o dedo encostou.
		 *
		 * Pela especificacao de Touch Events, `preventDefault` num
		 * `touchstart` SUPRIME os eventos de mouse sinteticos daquele toque
		 * — `mousedown`, `mouseup` e `click`. Consequencia: **todo elemento
		 * que so escuta `click` ficava inalcancavel por toque**. Isso cobre
		 * as abas do chat, o `ContextMenu` inteiro (82 chamadores no jogo),
		 * o botao de fechar do sussurro e a fonte do chat.
		 *
		 * A prova de que isso era sabido esta no proprio fork: o
		 * `MobileUI.js` reimplementa CADA botao dele com `touchstart`
		 * manual, em vez de confiar em `click`. Era o sintoma tratado um
		 * botao por vez.
		 *
		 * Este e o MESMO defeito que o mouse teve em 19/08/2026 ("clicar
		 * num botao fazia o personagem andar"), e a resposta e a MESMA
		 * pergunta: o evento nasceu dentro da UI? O predicado agora e um
		 * modulo so (`Controls/ehEventoDaUI.js`), lido pelos dois lados,
		 * porque duplica-lo faria o toque e o clique divergirem no dia em
		 * que alguem somasse um marcador novo de UI.
		 *
		 * `_daUI` guarda a resposta para o `touchend`/`touchmove` do MESMO
		 * gesto: um dedo que comecou num botao e escorregou para o mapa nao
		 * pode virar um passo do personagem no meio do caminho.
		 * ═══════════════════════════════════════════════════════════════
		 */
		_daUI = ehEventoDaUI(event);
		if (_daUI) {
			return;
		}

		remoteAutoFocus();
		_touches = event.touches;
		event.preventDefault();
		event.stopImmediatePropagation();

		// Delayed click (to detect gesture)
		if (_timer > -1) {
			Events.clearTimeout(_timer);
			_timer = -1;
		}

		// Gesture
		if (_touches.length > 1) {
			_scale = touchDistance(_touches);
			_angle = touchAngle(_touches);
			_processGesture = true;
			return;
		}

		Mouse.screen.x = _touches[0].pageX;
		Mouse.screen.y = _touches[0].pageY;

		if (!Session.FreezeUI) {
			Mouse.intersect = true;
			_intersect = true;
		}

		_timer = Events.setTimeout(delayedClick, 200);
	};
})();

/**
 * Hook touch end to know when a gesture end
 * process OnMouseUp if no gesture detected
 */

function onTouchEnd(event) {
	if (_daUI) {
		_daUI = false;
		return;
	}
	if (_processGesture) {
		_processGesture = false;
		KEYS.SHIFT = false;
		Camera.rotate(false);
		return;
	}

	if (_timer > -1) {
		_intersect = false;
		return;
	}

	if (Mobile.onTouchEnd) {
		Mobile.onTouchEnd();
	}

	Mouse.intersect = false;
}

/**
 * Process gesture (scale, rotate)
 * Else move.
 */
function onTouchMove(event) {
	/* D-932: rolar a lista de uma janela nao pode girar a camera. */
	if (_daUI) {
		return;
	}
	event.stopImmediatePropagation();

	const touches = event.touches;

	Mouse.screen.x = touches[0].pageX;
	Mouse.screen.y = touches[0].pageY;

	// Not in gesture, just process
	if (!_processGesture) {
		return;
	}

	const scale = touchDistance(touches) - _scale;
	//var angle = touchAngle(touches) / _angle;
	const x = Math.abs(touchTranslationX(_touches, touches));
	const y = Math.abs(touchTranslationY(_touches, touches));

	if (!Camera.action.active && (x > 10 || y > 10)) {
		KEYS.SHIFT = y > x;
		Camera.rotate(true);
		return;
	}

	// Process zoom
	if (Math.abs(scale) > 10) {
		Camera.zoomFinal -= scale * 0.1;
		Camera.zoomFinal = Math.min(
			Camera.zoomFinal,
			Math.abs(Camera.altitudeTo - Camera.altitudeFrom) * Camera.MAX_ZOOM
		);
		Camera.zoomFinal = Math.max(Camera.zoomFinal, 2.0);
	}
}

// Add full screen on mobile (sux to have the browser title bar)
if (Math.max(screen.availHeight, screen.availWidth) <= 800) {
	// Fullscreen on action
	window.addEventListener('touchstart', () => {
		if (!Context.isFullScreen()) {
			Context.requestFullScreen();
		}
	});
}

//Add mobile UI on touch
function touchDevice() {
	Session.isTouchDevice = true;

	if (Session.Playing) {
		//Already playing, don't wait for map change, just show it
		MobileUI.show();
	}
}
window.addEventListener('touchstart', touchDevice, { once: true });

// Touch controls
window.addEventListener('touchstart', onTouchStart, { passive: false });
window.addEventListener('touchend', onTouchEnd);
window.addEventListener('touchmove', onTouchMove);

/**
 * Export
 */
export default Mobile;
