/**
 * O MAGENTA SAI PELOS BYTES DO ARQUIVO (D-1988).
 *
 * Relato: copas de arvore de `mosk_dun02` como planos MAGENTA solidos num Poco
 * M7 Pro (Android, Mali). As texturas tem o magenta exato; o caminho antigo
 * decide a transparencia pela LEITURA do canvas (`getImageData`), e um aparelho
 * que desloca a cor nessa leitura deixa o magenta inteiro. Num canvas
 * `display-p3` o Chromium devolve 234,51,247 para o 255,0,255 (medido em
 * 05/10/2026) — e o limiar `G < 20` o recusa.
 *
 * O ultimo bloco emula esse aparelho: a leitura do canvas desloca a cor. O
 * caminho antigo entrega a textura com o magenta OPACO; o novo, transparente.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { decodificarBmpComChave, ehMagenta } from 'Utils/bmpComChave.js';

/** Monta um BMP BI_RGB. `pixels` em linhas de cima para baixo (indices ou [r,g,b]). */
function bmp({ bpp, largura, linhas, paleta = [], deCimaParaBaixo = false, compressao = 0 }) {
	const altura = linhas.length;
	const passo = Math.floor((largura * bpp + 31) / 32) * 4;
	const tamanhoDaPaleta = bpp <= 8 ? paleta.length * 4 : 0;
	const inicio = 54 + tamanhoDaPaleta;
	const total = inicio + passo * altura;
	const b = new Uint8Array(total);
	const v = new DataView(b.buffer);
	b[0] = 0x42;
	b[1] = 0x4d;
	v.setUint32(2, total, true);
	v.setUint32(10, inicio, true);
	v.setUint32(14, 40, true);
	v.setInt32(18, largura, true);
	v.setInt32(22, deCimaParaBaixo ? -altura : altura, true);
	v.setUint16(26, 1, true);
	v.setUint16(28, bpp, true);
	v.setUint32(30, compressao, true);
	v.setUint32(46, bpp <= 8 ? paleta.length : 0, true);
	paleta.forEach(([r, g, bl], i) => {
		b[54 + i * 4] = bl;
		b[54 + i * 4 + 1] = g;
		b[54 + i * 4 + 2] = r;
	});
	linhas.forEach((linha, y) => {
		const fileira = deCimaParaBaixo ? y : altura - 1 - y;
		const base = inicio + fileira * passo;
		linha.forEach((px, x) => {
			if (bpp === 24) {
				b[base + x * 3] = px[2];
				b[base + x * 3 + 1] = px[1];
				b[base + x * 3 + 2] = px[0];
			} else {
				const bit = x * bpp;
				b[base + (bit >> 3)] |= px << (8 - bpp - (bit & 7));
			}
		});
	});
	return b;
}

const MAGENTA = [255, 0, 255];
const VERDE = [40, 160, 30];
/** Rosa fora do limiar: fica opaco, como no caminho antigo. */
const ROSA = [200, 0, 200];

function pixel(img, x, y) {
	const o = (y * img.width + x) * 4;
	return Array.from(img.data.slice(o, o + 4));
}

describe('decodificarBmpComChave', () => {
	it('8 bits de baixo para cima, com linha de 3 pixels (preenchimento de 1 byte)', () => {
		const img = decodificarBmpComChave(
			bmp({ bpp: 8, largura: 3, paleta: [MAGENTA, VERDE, ROSA], linhas: [[0, 1, 2], [1, 0, 1]] })
		);
		expect(img.width).toBe(3);
		expect(img.height).toBe(2);
		expect(pixel(img, 0, 0)).toEqual([0, 0, 0, 0]);
		expect(pixel(img, 1, 0)).toEqual([...VERDE, 255]);
		expect(pixel(img, 2, 0)).toEqual([...ROSA, 255]);
		expect(pixel(img, 0, 1)).toEqual([...VERDE, 255]);
		expect(pixel(img, 1, 1)).toEqual([0, 0, 0, 0]);
	});

	it('24 bits de cima para baixo', () => {
		const img = decodificarBmpComChave(
			bmp({ bpp: 24, largura: 2, deCimaParaBaixo: true, linhas: [[MAGENTA, VERDE], [VERDE, [250, 10, 240]]] })
		);
		expect(pixel(img, 0, 0)).toEqual([0, 0, 0, 0]);
		expect(pixel(img, 1, 0)).toEqual([...VERDE, 255]);
		expect(pixel(img, 0, 1)).toEqual([...VERDE, 255]);
		// dentro do limiar, mas nao exato: transparente, como no caminho antigo
		expect(pixel(img, 1, 1)).toEqual([0, 0, 0, 0]);
	});

	it('4 e 1 bit leem o indice pelo bit certo', () => {
		const q = decodificarBmpComChave(
			bmp({ bpp: 4, largura: 3, paleta: [VERDE, MAGENTA], linhas: [[1, 0, 1]] })
		);
		expect([pixel(q, 0, 0)[3], pixel(q, 1, 0)[3], pixel(q, 2, 0)[3]]).toEqual([0, 255, 0]);
		const u = decodificarBmpComChave(
			bmp({ bpp: 1, largura: 9, paleta: [VERDE, MAGENTA], linhas: [[1, 0, 0, 0, 0, 0, 0, 1, 1]] })
		);
		expect(Array.from({ length: 9 }, (_, x) => pixel(u, x, 0)[3])).toEqual([0, 255, 255, 255, 255, 255, 255, 0, 0]);
	});

	it('recusa o que nao sabe ler, para o caminho antigo assumir', () => {
		const ok = bmp({ bpp: 8, largura: 1, paleta: [VERDE], linhas: [[0]] });
		expect(decodificarBmpComChave(ok)).not.toBeNull();
		expect(decodificarBmpComChave(bmp({ bpp: 8, largura: 1, paleta: [VERDE], linhas: [[0]], compressao: 1 }))).toBeNull();
		const png = ok.slice();
		png[0] = 0x89;
		expect(decodificarBmpComChave(png)).toBeNull();
		expect(decodificarBmpComChave(ok.slice(0, ok.length - 1))).toBeNull();
		const trinta = ok.slice();
		new DataView(trinta.buffer).setUint16(28, 32, true);
		expect(decodificarBmpComChave(trinta)).toBeNull();
		// indice fora da paleta
		expect(decodificarBmpComChave(bmp({ bpp: 8, largura: 1, paleta: [VERDE], linhas: [[3]] }))).toBeNull();
	});

	it('o criterio e o mesmo limiar do removeMagenta', () => {
		expect(ehMagenta(255, 0, 255)).toBe(true);
		expect(ehMagenta(231, 19, 231)).toBe(true);
		expect(ehMagenta(230, 0, 255)).toBe(false);
		expect(ehMagenta(255, 20, 255)).toBe(false);
		expect(ehMagenta(255, 0, 230)).toBe(false);
	});
});

describe('Texture.load num aparelho que desloca a cor na leitura do canvas', () => {
	/*
	 * O canvas falso guarda o que se escreve nele, e a LEITURA desloca o magenta
	 * para 234,51,247 (o que o Chromium devolve num canvas display-p3). O `Image`
	 * falso "decodifica" o BMP com a cor certa, como o aparelho faria.
	 */
	let Texture;
	const BMP = bmp({ bpp: 8, largura: 2, paleta: [MAGENTA, VERDE], linhas: [[0, 1]] });

	beforeAll(async () => {
		const criarOriginal = document.createElement.bind(document);
		document.createElement = vi.fn((tag) => {
			if (tag !== 'canvas') return criarOriginal(tag);
			const canvas = { width: 0, height: 0, pixels: null };
			const ctx = {
				clearRect() {},
				drawImage(origem) {
					canvas.pixels = new Uint8ClampedArray(origem.pixels);
				},
				getImageData(_x, _y, w, h) {
					const data = new Uint8ClampedArray(canvas.pixels || w * h * 4);
					for (let i = 0; i < data.length; i += 4) {
						if (data[i] === 255 && data[i + 1] === 0 && data[i + 2] === 255) {
							data[i] = 234;
							data[i + 1] = 51;
							data[i + 2] = 247;
						}
					}
					return { width: w, height: h, data };
				},
				createImageData(w, h) {
					return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
				},
				putImageData(dados) {
					canvas.pixels = new Uint8ClampedArray(dados.data);
				}
			};
			canvas.getContext = () => ctx;
			return canvas;
		});
		globalThis.Image = class {
			set src(_url) {
				this.width = 2;
				this.height = 1;
				this.pixels = new Uint8ClampedArray([255, 0, 255, 255, ...VERDE, 255]);
				setTimeout(() => this.onload && this.onload());
			}
		};
		globalThis.fetch = vi.fn(async () => ({ arrayBuffer: async () => BMP.buffer.slice(0) }));
		URL.revokeObjectURL = vi.fn();
		({ default: Texture } = await import('Utils/Texture.js'));
	});

	it('o plano magenta sai TRANSPARENTE, e o verde fica', async () => {
		const canvas = await new Promise((resolve) => {
			Texture.load('blob:http://jogo/arvore', function (ok) {
				expect(ok).toBe(true);
				resolve(this);
			});
		});
		expect(Array.from(canvas.pixels)).toEqual([0, 0, 0, 0, ...VERDE, 255]);
	});
});
