/**
 * Network/BackgroundTicker.js
 *
 * Keeps the ~10s keepalive cadence alive while the tab is in the background.
 *
 * Browsers throttle requestAnimationFrame to ~0fps and ordinary
 * setTimeout/setInterval down to about once a minute for hidden tabs
 * (see Network/NetworkManager.js:412-417 `setPing`, which is a plain
 * setInterval and gets caught by that throttling). The map-server is
 * authoritative and keeps simulating the character while we're gone; it's
 * the client that goes stale. A Web Worker's timers are NOT throttled by
 * tab visibility, so we delegate only the "when to tick" decision to one and
 * still do all the actual network I/O back on the main thread.
 *
 * This module is additive: it does not replace Network.setPing/the existing
 * setInterval-based ping, it just gives the same keepalive callback a second,
 * background-safe source of ticks. Both can fire in the same second - the
 * server only reads a timestamp off the packet, so a duplicate call is
 * harmless (see PACKET.CZ.REQUEST_TIME2, Network/PacketStructure.js:3387).
 *
 * On top of the periodic tick, it also fires the callback immediately when
 * the tab regains focus (`visibilitychange` -> 'visible'). That keepalive is
 * what makes the server resync: when it sees a gap > 15s between
 * CZ_REQUEST_TIME2 packets it resends the player's position, every visible
 * mob, and stats - so firing one right on return is what unsticks the view.
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 */

/**
 * @const {number} how often the worker asks the main thread to tick, in ms.
 * Matches the cadence of Network.setPing's own setInterval.
 */
const TICK_INTERVAL_MS = 10000;

/**
 * Worker body, kept inline as a string (loaded via a Blob URL) so no extra
 * build step/asset is required. It only ever touches its own timers and
 * posts a message back - no DOM/network access happens inside the worker.
 */
const WORKER_SOURCE = `
	let intervalId = null;
	self.onmessage = function (event) {
		if (event.data === 'start') {
			if (intervalId !== null) {
				clearInterval(intervalId);
			}
			intervalId = setInterval(function () {
				self.postMessage('tick');
			}, ${TICK_INTERVAL_MS});
		} else if (event.data === 'stop') {
			if (intervalId !== null) {
				clearInterval(intervalId);
				intervalId = null;
			}
		}
	};
`;

let _worker = null;
let _workerUrl = null;
let _callback = null;
let _visibilityHandler = null;

/**
 * @return {boolean} whether Worker/Blob/document are available in this env.
 */
function isSupported() {
	return typeof Worker !== 'undefined' && typeof Blob !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Start the background-safe heartbeat.
 * Safe to call again while already running: it restarts cleanly.
 *
 * @param {function} callback - invoked roughly every 10s regardless of tab
 *                               visibility, and immediately when the tab
 *                               returns to the foreground.
 */
function start(callback) {
	stop();

	_callback = callback;

	if (isSupported()) {
		try {
			const blob = new Blob([WORKER_SOURCE], { type: 'application/javascript' });
			_workerUrl = URL.createObjectURL(blob);
			_worker = new Worker(_workerUrl);
			_worker.onmessage = function onWorkerTick(event) {
				if (event.data === 'tick' && _callback) {
					_callback();
				}
			};
			_worker.postMessage('start');
		} catch (e) {
			console.error('[BackgroundTicker] Failed to start worker, background keepalive disabled', e);
			_worker = null;
		}
	} else {
		console.warn('[BackgroundTicker] Worker not supported in this environment, background keepalive disabled');
	}

	if (typeof document !== 'undefined') {
		_visibilityHandler = function onVisibilityChange() {
			if (document.visibilityState === 'visible' && _callback) {
				_callback();
			}
		};
		document.addEventListener('visibilitychange', _visibilityHandler);
	}
}

/**
 * Stop the heartbeat and release the worker/listener.
 */
function stop() {
	if (_worker) {
		try {
			_worker.postMessage('stop');
			_worker.terminate();
		} catch (e) {
			// Worker may already be gone; nothing to do.
		}
		_worker = null;
	}

	if (_workerUrl) {
		URL.revokeObjectURL(_workerUrl);
		_workerUrl = null;
	}

	if (_visibilityHandler && typeof document !== 'undefined') {
		document.removeEventListener('visibilitychange', _visibilityHandler);
		_visibilityHandler = null;
	}

	_callback = null;
}

/**
 * Export
 */
const BackgroundTicker = {
	start: start,
	stop: stop
};

export default BackgroundTicker;
