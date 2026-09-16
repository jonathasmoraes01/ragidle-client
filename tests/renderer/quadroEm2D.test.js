/**
 * Cada quadro de sprite com o proprio canvas, montado uma vez (13/09/2026, os
 * sprites que piscam na selecao no iPhone). Ver `src/Renderer/quadroEm2D.js`.
 *
 * O jsdom nao desenha canvas: a fabrica e injetada, e cada canvas falso guarda
 * o que recebeu no `putImageData`.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { CORES_POR_QUADRO, canvasDoQuadro, esquecerQuadros } from 'Renderer/quadroEm2D.js';

function fabrica() {
	const criados = [];
	const criar = (largura, altura) => {
		const canvas = {
			width: largura,
			height: altura,
			escritas: 0,
			pixels: null,
			getContext: () => ({
				createImageData: (l, a) => ({ data: new Uint8ClampedArray(l * a * 4) }),
				putImageData: imagem => {
					canvas.escritas++;
					canvas.pixels = new Uint32Array(imagem.data.buffer).slice();
				}
			})
		};
		criados.push(canvas);
		return canvas;
	};
	return { criar, criados };
}

/** Uma paleta onde a cor i e (i, 0, 0, 255). */
function paletaDeTeste() {
	const p = new Uint8Array(256 * 4);
	for (let i = 0; i < 256; i++) {
		p[i * 4] = i;
		p[i * 4 + 3] = 255;
	}
	return p;
}

const BRANCO = [1, 1, 1, 1];

beforeEach(() => esquecerQuadros());

describe('canvasDoQuadro', () => {
	it('duas camadas diferentes NUNCA dividem canvas — o rascunho compartilhado era o defeito', () => {
		const { criar } = fabrica();
		const paleta = paletaDeTeste();
		const corpo = { width: 2, height: 1, type: 0, data: new Uint8Array([1, 2]) };
		const cabeca = { width: 2, height: 1, type: 0, data: new Uint8Array([3, 4]) };
		const a = canvasDoQuadro(corpo, paleta, BRANCO, criar);
		const b = canvasDoQuadro(cabeca, paleta, BRANCO, criar);
		expect(a).not.toBe(b);
		// E o primeiro continua com os pixels DELE depois de o segundo ser montado.
		expect(a.pixels[0] & 0xff).toBe(1);
		expect(b.pixels[0] & 0xff).toBe(3);
	});

	it('o mesmo quadro na mesma paleta e cor e montado UMA vez', () => {
		const { criar, criados } = fabrica();
		const paleta = paletaDeTeste();
		const quadro = { width: 2, height: 2, type: 0, data: new Uint8Array([1, 2, 3, 4]) };
		for (let i = 0; i < 60; i++) {
			canvasDoQuadro(quadro, paleta, BRANCO, criar);
		}
		expect(criados).toHaveLength(1);
		expect(criados[0].escritas).toBe(1);
	});

	it('a paleta: a cor 0 e transparente, as outras saem da tabela', () => {
		const { criar } = fabrica();
		const quadro = { width: 3, height: 1, type: 0, data: new Uint8Array([0, 5, 255]) };
		const c = canvasDoQuadro(quadro, paletaDeTeste(), BRANCO, criar);
		expect(c.pixels[0]).toBe(0);
		expect(c.pixels[1] & 0xff).toBe(5);
		expect((c.pixels[1] >>> 24) & 0xff).toBe(255);
		expect(c.pixels[2] & 0xff).toBe(255);
	});

	it('outra paleta (outra cor de cabelo) e outro canvas', () => {
		const { criar } = fabrica();
		const quadro = { width: 1, height: 1, type: 0, data: new Uint8Array([7]) };
		const a = canvasDoQuadro(quadro, paletaDeTeste(), BRANCO, criar);
		const b = canvasDoQuadro(quadro, paletaDeTeste(), BRANCO, criar);
		expect(a).not.toBe(b);
	});

	it('o quadro RGBA e copiado como esta, e a paleta nao importa', () => {
		const { criar, criados } = fabrica();
		const pixel = new Uint8Array([10, 20, 30, 255]);
		const quadro = { width: 1, height: 1, type: 1, data: pixel };
		const a = canvasDoQuadro(quadro, paletaDeTeste(), BRANCO, criar);
		canvasDoQuadro(quadro, paletaDeTeste(), BRANCO, criar);
		expect(a.pixels[0]).toBe(new Uint32Array(pixel.buffer)[0]);
		expect(criados).toHaveLength(1);
	});

	it('a cor modulada multiplica, e tem chave propria', () => {
		const { criar } = fabrica();
		const quadro = { width: 1, height: 1, type: 0, data: new Uint8Array([200]) };
		const paleta = paletaDeTeste();
		const cheio = canvasDoQuadro(quadro, paleta, BRANCO, criar);
		const metade = canvasDoQuadro(quadro, paleta, [0.5, 1, 1, 1], criar);
		expect(metade).not.toBe(cheio);
		expect(metade.pixels[0] & 0xff).toBe(100);
	});

	it('a cor modulada tambem vale no quadro RGBA', () => {
		const { criar } = fabrica();
		const pixel = new Uint8Array([200, 20, 30, 255]);
		const quadro = { width: 1, height: 1, type: 1, data: pixel };
		const metade = canvasDoQuadro(quadro, null, [0.5, 1, 1, 1], criar);
		expect(metade.pixels[0] & 0xff).toBe(100);
		expect((metade.pixels[0] >> 8) & 0xff).toBe(20);
	});

	it('cores demais no mesmo quadro nao enchem a memoria', () => {
		const { criar } = fabrica();
		const quadro = { width: 1, height: 1, type: 0, data: new Uint8Array([1]) };
		const paleta = paletaDeTeste();
		const primeira = canvasDoQuadro(quadro, paleta, [1, 1, 1, 0.01], criar);
		for (let i = 2; i <= CORES_POR_QUADRO; i++) {
			canvasDoQuadro(quadro, paleta, [1, 1, 1, i / 100], criar);
		}
		expect(canvasDoQuadro(quadro, paleta, [1, 1, 1, 0.01], criar)).toBe(primeira);
		canvasDoQuadro(quadro, paleta, [1, 1, 1, 0.99], criar);
		expect(canvasDoQuadro(quadro, paleta, [1, 1, 1, 0.01], criar)).not.toBe(primeira);
	});
});
