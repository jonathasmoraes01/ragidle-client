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
/**
 * Quantos pixels de movimento sao necessarios para o gesto DECIDIR o que e.
 * Abaixo disto e tremor de mao, e alternar entre pinca e giro a cada quadro
 * daria uma camera epileptica.
 */
const C_LIMIAR_DE_GESTO = 8;

/**
 * Quantos pixels de pinca valem UM passo de zoom da camera.
 *
 * `Camera.setZoom(d)` faz `zoomFinal += d * zoomStep` com `zoomStep = 15`,
 * entao 60px de pinca movem 15 unidades — cerca de um oitavo da faixa util
 * numa altitude tipica. Foi escolhido para a pinca de uma mao (~150px de
 * curso) atravessar a faixa sem exigir um segundo gesto, e sem estourar a
 * faixa inteira num tranco.
 */
const C_PIXELS_POR_PASSO_DE_ZOOM = 120;

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

	/*
	 * ═══════════════════════════════════════════════════════════════════
	 * A PINCA VOLTA A SER ZOOM (08/09/2026, pedido do dono)
	 * ═══════════════════════════════════════════════════════════════════
	 * *"O gesto de pinca sobre a area de jogo deve controlar o zoom da
	 * camera, mantendo a HUD no mesmo tamanho."*
	 *
	 * O codigo de zoom JA EXISTIA aqui embaixo, e nunca rodava. Tres
	 * defeitos, e o primeiro engolia os outros dois:
	 *
	 *   1. **a ROTACAO vinha antes e dava `return`.** Ela dispara com
	 *      `x > 10 || y > 10` — o deslocamento medio dos dois dedos. Numa
	 *      pinca os dedos SEMPRE se deslocam (e o que uma pinca e), entao a
	 *      condicao casava primeiro e o gesto virava giro de camera. O
	 *      bloco de zoom era inalcancavel na pratica;
	 *   2. **`_scale` nunca era atualizado.** O delta era sempre contra a
	 *      distancia do INICIO do gesto, entao ele crescia sozinho a cada
	 *      quadro: a mesma pinca aplicaria 10, 20, 30... de zoom. Se o
	 *      bloco rodasse, ele daria um salto e nao um movimento;
	 *   3. **escrevia `Camera.zoomFinal` na mao**, com um piso cravado de
	 *      `2.0` e sem o teto de INTERIOR (`MAX_ZOOM_INDOOR`, que e metade
	 *      do de fora). Os limites do jogo ficavam de fora do gesto.
	 *
	 * ── COMO ELE DECIDE AGORA ───────────────────────────────────────────
	 * Pinca e giro sao gestos diferentes e a diferenca e MEDIVEL: na pinca
	 * o que mudou foi a DISTANCIA entre os dedos; no giro, a POSICAO dos
	 * dois. Comparar as duas grandezas responde qual gesto e — em vez de
	 * "quem chegou primeiro no `if`", que era o criterio antigo.
	 *
	 * O limiar existe para o tremor da mao nao alternar entre os dois a
	 * cada quadro: enquanto nenhum dos dois passa dele, nada acontece.
	 * ═══════════════════════════════════════════════════════════════════
	 */
	const distanciaAgora = touchDistance(touches);
	const mudouADistancia = distanciaAgora - _scale;
	const x = Math.abs(touchTranslationX(_touches, touches));
	const y = Math.abs(touchTranslationY(_touches, touches));
	const deslocou = Math.max(x, y);

	/* Nem pinca nem giro ainda: mao parada tremendo. */
	if (Math.abs(mudouADistancia) < C_LIMIAR_DE_GESTO && deslocou < C_LIMIAR_DE_GESTO) {
		return;
	}

	if (Math.abs(mudouADistancia) >= deslocou) {
		/*
		 * PINCA. `Camera.setZoom()` e nao `zoomFinal` na mao: e ela quem
		 * conhece `MIN_ZOOM`, `MAX_ZOOM` e o teto menor de INTERIOR, e quem
		 * grava a preferencia. Os limites do gesto passam a ser os limites
		 * da camera, sem um segundo numero para envelhecer.
		 *
		 * SINAL: afastar os dedos aproxima a camera. `setZoom` SOMA ao
		 * `zoomFinal`, e `zoomFinal` menor e camera mais perto — dai o
		 * menos.
		 *
		 * `_scale` e reancorado AQUI: o delta passa a ser o do quadro, e
		 * nao o do gesto inteiro. Era o defeito 2.
		 */
		Camera.setZoom(-mudouADistancia / C_PIXELS_POR_PASSO_DE_ZOOM);
		_scale = distanciaAgora;
		_touches = touches;
		return;
	}

	if (!Camera.action.active) {
		KEYS.SHIFT = y > x;
		Camera.rotate(true);
	}
}

// Add full screen on mobile (sux to have the browser title bar)
if (Math.max(screen.availHeight, screen.availWidth) <= 800) {
	// Fullscreen on action
	window.addEventListener('touchstart', evento => {
		/*
		 * NUNCA NO TOQUE QUE ABRE UM CAMPO DE TEXTO (10/09/2026). Nos celulares
		 * com o lado maior ate 800px cada toque pede tela cheia — e no PWA
		 * instalado (`display: fullscreen`) o `isFullScreen()` nao enxerga o
		 * modo, entao o pedido se repete a cada toque. Uma transicao de tela
		 * cheia no mesmo toque que foca o campo do chat pode derrubar o
		 * teclado. HIPOTESE, nao medida em aparelho (o Chromium sem cabeca nao
		 * abre teclado de sistema); pular o campo de texto nao custa nada.
		 */
		const alvo = evento.composedPath ? evento.composedPath()[0] : evento.target;
		if (alvo && (alvo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName || ''))) {
			return;
		}
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
