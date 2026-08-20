/**
 * UI/Background.js
 *
 * Background Manager
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

/**
 * Load dependencies
 */
import DB from 'DB/DBManager.js';
import Client from 'Core/Client.js';
import Configs from 'Core/Configs.js';
import PACKETVER from 'Network/PacketVerManager.js';
import { animateElement } from 'Utils/HtmlHelper.js';

/**
 * @var {HTMLElement} Background overlay (used for transition)
 */
const _overlay = document.createElement('div');
Object.assign(_overlay.style, {
	position: 'absolute',
	top: '0',
	left: '0',
	zIndex: '1000',
	backgroundColor: 'black',
	opacity: '0'
});

const _container = document.createElement('div');
Object.assign(_container.style, {
	position: 'absolute',
	top: '0',
	left: '0',
	zIndex: '1',
	width: '100%',
	height: '100%',
	backgroundColor: 'black'
});

/**
 * @var {HTMLCanvasElement} Background canvas element
 *
 * A barra de progresso NAO desenha mais aqui (era rgb(0,255,255) / rgb(140,140,140) /
 * rgb(66,99,165) / rgb(255,255,0), cores cravadas de 2002). O canvas nao tem mais
 * nenhum desenho proprio; fica so como camada de compatibilidade para o z-index
 * que o resto do arquivo ja gerenciava (Renderer/MapRenderer esperam poder
 * empilhar sobre ela). A barra virou DOM (ver _barLayer abaixo) para poder usar
 * os tokens do design system (Common.css/:root) em vez de replicar valores.
 */
const _canvas = document.createElement('canvas');
Object.assign(_canvas.style, { position: 'absolute', top: '0', left: '0', zIndex: '2' });

/**
 * @var {CanvasRenderingContext2D} Background context
 */
const _ctx = _canvas.getContext('2d');

/**
 * ------------------------------------------------------------------
 * Barra de progresso em DOM (nao em canvas)
 *
 * Por que DOM em vez de canvas: os tokens do design system (--blue-500,
 * --gold-500, --font-display etc.) sao custom properties CSS. Num canvas
 * eles teriam que ser lidos com getComputedStyle e replicados a mao em
 * fillStyle/font a cada frame -- e o texto customizado (Marcellus) exige
 * medir a fonte carregada via FontFace API antes de desenhar, ou o primeiro
 * frame cai no fallback. Em DOM, a barra e so HTML/CSS: pega os tokens
 * direto de --root (Common.css e injetado global pelo UIManager, ver
 * UI/UIManager.js:injectCommonCSS), reflow e' automatico no resize, e a
 * fonte troca sozinha quando carrega (sem novo desenho). O canvas continua
 * existindo so pelo z-index (ver nota acima) -- nao teve motivo pra apagar
 * o elemento e arriscar quebrar quem espera por ele.
 * ------------------------------------------------------------------
 */

/** @var {HTMLDivElement} camada da barra + nome do jogo, irma do _canvas */
const _barLayer = document.createElement('div');
Object.assign(_barLayer.style, {
	position: 'absolute',
	top: '0',
	left: '0',
	zIndex: '1',
	display: 'none',
	pointerEvents: 'none'
});

const _barName = document.createElement('div');
_barName.className = 'rag-loadbar-name';
_barName.textContent = 'Ragnarok Classic Idle';

const _barTrack = document.createElement('div');
_barTrack.className = 'rag-loadbar-track';

const _barFill = document.createElement('div');
_barFill.className = 'rag-loadbar-fill';

const _barPct = document.createElement('div');
_barPct.className = 'rag-loadbar-pct';
_barPct.textContent = '0%';

_barTrack.appendChild(_barFill);
_barTrack.appendChild(_barPct);
_barLayer.appendChild(_barName);
_barLayer.appendChild(_barTrack);

/**
 * Injeta o CSS da barra uma vez por documento (mesmo padrao de
 * UIManager.js:injectCommonCSS). Usa os tokens de Common.css, que ja
 * chegam em :root porque o UIManager injeta Common.css globalmente.
 */
(function injectLoadbarCSS() {
	if (document.querySelector('style[data-ragidle-loadbar]')) {
		return;
	}
	const style = document.createElement('style');
	style.setAttribute('data-ragidle-loadbar', '');
	style.textContent = `
		.rag-loadbar-name {
			position: absolute;
			left: 50%;
			bottom: calc(25% + 18px);
			transform: translateX(-50%);
			white-space: nowrap;
			font: var(--type-hero);
			font-size: clamp(30px, 2.4vw, 46px);
			letter-spacing: var(--ls-title);
			color: var(--gold-300);
			background: var(--surface-dark-glass);
			backdrop-filter: var(--blur-glass);
			-webkit-backdrop-filter: var(--blur-glass);
			border: 1px solid var(--border-gold);
			border-radius: var(--radius-pill);
			padding: clamp(6px, 0.6vw, 10px) clamp(24px, 2.4vw, 40px);
			text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
		}
		.rag-loadbar-track {
			position: absolute;
			left: 50%;
			top: 75%;
			transform: translateX(-50%);
			width: clamp(320px, 30vw, 640px);
			height: 16px;
			background: var(--bar-track);
			border: 1px solid var(--border-gold);
			border-radius: var(--radius-bar);
			box-shadow: var(--shadow-inset), var(--rim-gold);
			overflow: hidden;
		}
		.rag-loadbar-fill {
			height: 100%;
			width: 0%;
			background: linear-gradient(180deg, var(--blue-400) 0%, var(--blue-500) 45%, var(--blue-600) 100%);
			box-shadow: var(--rim-light);
			border-radius: var(--radius-bar);
			transition: width var(--dur-base) var(--ease-out);
		}
		.rag-loadbar-pct {
			position: absolute;
			inset: 0;
			display: flex;
			align-items: center;
			justify-content: center;
			font: var(--type-numeric);
			font-size: 11px;
			letter-spacing: var(--ls-caps);
			color: var(--white);
			text-shadow: 0 1px 2px rgba(0, 0, 0, 0.65);
		}
	`;
	document.head.appendChild(style);
})();

/**
 * Background loading progress
 * @var {number} percent
 */
let _progress = -1;

/**
 * @var {object|null} current overlay animation handle
 */
let _overlayAnim = null;

/**
 * Render background (or a black background if no image is loaded yet)
 */
function render() {
	_ctx.clearRect(0, 0, _canvas.width, _canvas.height);

	if (_progress > -1) {
		Background.setPercent(_progress);
	} else {
		_barLayer.style.display = 'none';
	}
}
let _loading = [];

/**
 * Background Namespace
 */
class Background {
	/**
	 * Initialize Background component
	 *
	 * @param {Array} loading - Array of loading filenames stored in clientinfo.xml
	 */
	static init(loading) {
		let i;

		_progress = 0;
		_canvas.style.zIndex = '1';
		_barLayer.style.zIndex = '1';

		render();

		if (loading) {
			_loading = loading;
			return;
		}

		// Generate default loadings
		_loading.length = 10;
		for (i = 1; i <= 10; ++i) {
			_loading[i - 1] = `loading${i < 10 ? '0' + i : i}.jpg`;
		}
	}

	/**
	 * Resize the background
	 */
	static resize(width, height) {
		_canvas.width = width;
		_canvas.height = height;
		Object.assign(_overlay.style, { width: width + 'px', height: height + 'px' });
		Object.assign(_container.style, { width: width + 'px', height: height + 'px' });
		Object.assign(_barLayer.style, { width: width + 'px', height: height + 'px' });

		_ctx.clearRect(0, 0, width, height);

		render();
	}

	/**
	 * Set an image as background
	 *
	 * @param {string|Array<string>} filename
	 * @param {function} callback once the image is loaded (optional)
	 */
	static setImage(filename, callback) {
		const exist = !!_container.parentNode;
		_progress = -1;

		_container.innerHTML = '';
		_container.style.backgroundImage = 'none';
		render();

		if (Array.isArray(filename)) {
			let loadedCount = 0;
			const total = filename.length;
			const divs = [];

			// Pre-create the grid cells in exact order
			for (let i = 0; i < total; i++) {
				const div = document.createElement('div');
				Object.assign(div.style, {
					width: '25%',
					height: '33.333%',
					float: 'left',
					backgroundSize: '100% 100%'
				});
				divs.push(div);
				_container.appendChild(div);
			}

			filename.forEach((file, index) => {
				const fullPath = DB.INTERFACE_PATH + file;

				Client.loadFile(
					fullPath,
					url => {
						divs[index].style.backgroundImage = `url(${url})`;

						loadedCount++;
						if (loadedCount === total) {
							if (exist && callback) callback();
						}
					},
					() => {
						loadedCount++;
						if (loadedCount === total) {
							if (exist && callback) callback();
						}
					}
				);
			});
		} else {
			const fullPath = DB.INTERFACE_PATH + filename;
			// Get and load Image
			Client.loadFile(
				fullPath,
				url => {
					Object.assign(_container.style, {
						backgroundImage: `url(${url})`,
						backgroundSize: '100% 100%'
					});
					if (exist && callback) callback();
				},
				() => {
					if (exist && callback) callback();
				}
			);
		}

		// Add transition only if the background isn't here
		if (!exist) {
			transition(() => {
				document.body.appendChild(_container);
				document.body.appendChild(_canvas);
				document.body.appendChild(_barLayer);
				if (callback) {
					callback();
				}
			});
		}
	}

	/**
	 * Helper method to return the right login background filename(s) based on packet version.
	 */
	static getLoginBackgroundName() {
		if (PACKETVER.value >= 20221207) {
			return 't_login.jpg';
		}
		if (PACKETVER.value >= 20181114) {
			return [
				't_\xB9\xE8\xB0\xE61-1.bmp',
				't_\xB9\xE8\xB0\xE61-2.bmp',
				't_\xB9\xE8\xB0\xE61-3.bmp',
				't_\xB9\xE8\xB0\xE61-4.bmp',
				't_\xB9\xE8\xB0\xE62-1.bmp',
				't_\xB9\xE8\xB0\xE62-2.bmp',
				't_\xB9\xE8\xB0\xE62-3.bmp',
				't_\xB9\xE8\xB0\xE62-4.bmp',
				't_\xB9\xE8\xB0\xE63-1.bmp',
				't_\xB9\xE8\xB0\xE63-2.bmp',
				't_\xB9\xE8\xB0\xE63-3.bmp',
				't_\xB9\xE8\xB0\xE63-4.bmp'
			];
		}
		return 'bgi_temp.bmp';
	}

	/**
	 * Add versioned login background
	 *
	 * @param {function} callback once the background is display (optional)
	 */
	static setLoginBackground(callback) {
		Background.setImage(Background.getLoginBackgroundName(), callback);
	}

	/**
	 * Add loading background
	 *
	 * @param {function} callback once the loading is display (optional)
	 */
	static setLoading(callback) {
		const index = Math.floor(Math.random() * _loading.length);

		Background.setImage(_loading[index] || 'loading01.jpg', () => {
			_canvas.style.zIndex = '999';
			_barLayer.style.zIndex = '999';
			Background.setPercent(0.0);

			if (callback) {
				callback();
			}
		});
	}

	/**
	 * Remove background
	 *
	 * @param {function} callback once the overlay hide the window (optional)
	 */
	static remove(callback) {
		const exist = !!_container.parentNode;

		if (!exist) {
			if (callback) {
				callback();
			}
			return;
		}

		transition(() => {
			_progress = -1;
			_container.style.zIndex = '0';
			_canvas.style.zIndex = '0';
			_barLayer.style.zIndex = '0';
			_barLayer.style.display = 'none';
			if (_container.parentNode) _container.parentNode.removeChild(_container);
			if (_canvas.parentNode) _canvas.parentNode.removeChild(_canvas);
			if (_barLayer.parentNode) _barLayer.parentNode.removeChild(_barLayer);
			_container.innerHTML = '';
			_container.style.backgroundImage = 'none';

			if (callback) {
				callback();
			}
		});
	}

	/**
	 * Adding progress bar to background
	 *
	 * Antes desenhava num <canvas> com cores cravadas (ciano/cinza/amarelo, ver
	 * historico do arquivo); agora e' DOM (_barLayer), estilizado por
	 * injectLoadbarCSS() acima com os tokens do design system.
	 *
	 * @param {number} percent
	 */
	static setPercent(percent) {
		_progress = Math.min(Math.floor(percent), 100);

		_barLayer.style.display = 'block';
		_barFill.style.width = _progress + '%';
		_barPct.textContent = _progress + '%';
	}
}

/**
 * Play with the overlay
 *
 * @param {function} callback once the overlay hide the window
 */
function transition(callback) {
	const transitionDuration = Configs.get('transitionDuration') ? Configs.get('transitionDuration') : 500;

	if (_overlayAnim) {
		_overlayAnim.stop();
	}

	_overlay.style.opacity = '0.01';
	document.body.appendChild(_overlay);

	_overlayAnim = animateElement(_overlay, { opacity: 1.0 }, transitionDuration, () => {
		callback();

		_overlayAnim = animateElement(_overlay, { opacity: 0.01 }, transitionDuration, () => {
			if (_overlay.parentNode) {
				_overlay.parentNode.removeChild(_overlay);
			}
		});
	});
}

/**
 * Export
 */
export default Background;
