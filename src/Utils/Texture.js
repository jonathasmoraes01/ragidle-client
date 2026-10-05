/**
 * Utils/Texture.js
 *
 * WebGL Helper function
 *
 * Trying to define here some functions related to textures.
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import Targa from 'Loaders/Targa.js';
import GIF from 'Vendors/libgif.js';
import { decodificarBmpComChave, ehMagenta } from 'Utils/bmpComChave.js';

/**
 * Namespace
 */
const Texture = {};

const procCanvas = document.createElement('canvas');
const procCtx = procCanvas.getContext('2d', { willReadFrequently: true });

/**
 * Texture Constructor
 *
 * @param {string|object} data
 * @param {function} oncomplete callback
 */
Texture.load = function load(data, oncomplete) {
	const args = Array.prototype.slice.call(arguments, 2);

	// Possible missing textures on loaders
	if (!data) {
		args.unshift(false);
		oncomplete.apply(null, args);
		return;
	}

	// TGA Support
	if (data instanceof ArrayBuffer) {
		try {
			const tga = new Targa();
			tga.load(new Uint8Array(data));
			args.unshift(true);
			oncomplete.apply(tga.getCanvas(), args);
		} catch (e) {
			console.error(e.message);
			args.unshift(false);
			oncomplete.apply(null, args);
		}
		return;
	}

	/*
	 * BMP: o magenta sai pelos BYTES do arquivo (D-1988, `Utils/bmpComChave.js`).
	 * O caminho de baixo decide DEPOIS de o aparelho decodificar e devolver os
	 * pixels, e um aparelho que desloca a cor nessa ida e volta (gestao de cor,
	 * ruido anti-impressao-digital) deixa o magenta inteiro na GPU. Todo BMP do
	 * jogo chega aqui como `blob:` (`FileManager`); o que o decodificador recusa
	 * (outro formato, BMP comprimido) cai no caminho antigo, intacto.
	 */
	if (typeof data === 'string' && data.startsWith('blob:') && typeof fetch === 'function') {
		fetch(data)
			.then(function (resposta) {
				return resposta.arrayBuffer();
			})
			.then(
				function (buffer) {
					let pronto = null;
					try {
						pronto = canvasDoBmp(buffer);
					} catch (_e) {
						pronto = null;
					}
					if (!pronto) {
						carregarPelaImagem(data, oncomplete, args);
						return;
					}
					URL.revokeObjectURL(data);
					args.unshift(true);
					try {
						oncomplete.apply(pronto, args);
					} catch (e) {
						// Fora da promessa: o erro de quem chamou continua chegando ao
						// `window.onerror` (e ao relato), como no caminho do `img.onload`.
						setTimeout(function () {
							throw e;
						});
					}
				},
				function () {
					carregarPelaImagem(data, oncomplete, args);
				}
			);
		return;
	}

	carregarPelaImagem(data, oncomplete, args);
};

/**
 * O canvas do BMP com o magenta ja transparente, ou `null` se o arquivo nao e um
 * BMP que o decodificador aceita.
 *
 * @param {ArrayBuffer} buffer
 * @return {HTMLCanvasElement|null}
 */
function canvasDoBmp(buffer) {
	const imagem = decodificarBmpComChave(buffer);
	if (!imagem) {
		return null;
	}
	const canvas = document.createElement('canvas');
	canvas.width = imagem.width;
	canvas.height = imagem.height;
	const ctx = canvas.getContext('2d');
	const dados = ctx.createImageData(imagem.width, imagem.height);
	dados.data.set(imagem.data);
	ctx.putImageData(dados, 0, 0);
	return canvas;
}

/**
 * O caminho de sempre: o navegador decodifica, e o magenta sai pela leitura do
 * canvas (`removeMagenta`). Fica para PNG, JPG, GIF e o BMP que o decodificador
 * proprio recusa.
 */
function carregarPelaImagem(data, oncomplete, args) {
	const img = new Image();
	img.decoding = 'async';
	img.src = data;
	img.onload = function OnLoadClosure() {
		// Clean up blob
		if (data.match(/^blob:/)) {
			URL.revokeObjectURL(data);
		}

		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d', { willReadFrequently: true });

		canvas.width = this.width;
		canvas.height = this.height;

		ctx.drawImage(this, 0, 0, this.width, this.height);
		Texture.removeMagenta(canvas);

		args.unshift(true);
		oncomplete.apply(canvas, args);
	};
}

// Creates a canvas spritesheet with gif metadata to animate in guild display
Texture.processGifToSpriteSheet = function processGifToSpriteSheet(buffer, callback) {
	const args = Array.prototype.slice.call(arguments, 2);
	const dummyParent = document.createElement('div');
	const img = new Image();
	dummyParent.appendChild(img);

	img.onload = function () {
		try {
			const gif = new GIF({
				gif: img,
				auto_play: false,
				vp_w: img.width,
				vp_h: img.height
			});

			gif.load(function () {
				const frameCount = gif.get_length();
				const frameWidth = img.width;
				const frameHeight = img.height;

				const framesData = gif.get_frames();
				const frameDelays = [];

				const fLineCount = Math.ceil(Math.sqrt((frameCount * frameWidth) / frameHeight));
				const spriteSheetWidth = fLineCount * frameWidth;
				const spriteSheetHeight = Math.ceil(frameCount / fLineCount) * frameHeight;

				const canvas = document.createElement('canvas');
				canvas.width = spriteSheetWidth;
				canvas.height = spriteSheetHeight;
				const ctx = canvas.getContext('2d', {
					willReadFrequently: true
				});

				for (let i = 0; i < frameCount; i++) {
					const delay = framesData[i] && framesData[i].delay ? framesData[i].delay : 10;
					frameDelays.push(delay * 10);

					gif.move_to(i);
					const frameCanvas = gif.get_canvas();
					const row = Math.floor(i / fLineCount);
					const col = i % fLineCount;
					ctx.drawImage(frameCanvas, col * frameWidth, row * frameHeight);
				}

				Texture.removeMagenta(canvas);

				canvas.isAnimated = true;
				canvas.frameDelays = frameDelays;
				canvas.frameWidth = frameWidth;
				canvas.frameHeight = frameHeight;
				canvas.frameCount = frameCount;
				canvas.framesPerRow = fLineCount;
				canvas.currentFrame = 0;
				canvas.lastFrameChange = Date.now();

				args.unshift(true);
				callback.apply(canvas, args);
			});
		} catch (_e) {
			args.unshift(false);
			callback.apply(null, args);
		}
	};

	const blob = new Blob([buffer], {
		type: 'image/gif'
	});
	img.src = URL.createObjectURL(blob);
};

/**
 * Remove magenta pixels from image
 *
 * @param {HTMLElement} canvas
 */
Texture.removeMagenta = function removeMagenta(canvas) {
	const w = canvas.width;
	const h = canvas.height;

	procCtx.clearRect(0, 0, w, h);

	if (procCanvas.width !== w || procCanvas.height !== h) {
		procCanvas.width = w;
		procCanvas.height = h;
	}

	procCtx.drawImage(canvas, 0, 0);
	const imageData = procCtx.getImageData(0, 0, w, h);
	const data = imageData.data;

	for (let i = 0; i < data.length; i += 4) {
		if (ehMagenta(data[i], data[i + 1], data[i + 2])) {
			data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 0;
		}
	}

	canvas.getContext('2d').putImageData(imageData, 0, 0);
};

/**
 * Export
 */
export default Texture;
