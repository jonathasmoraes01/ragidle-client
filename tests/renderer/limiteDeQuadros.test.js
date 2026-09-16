/**
 * O LIMITADOR DE QUADROS COM FOLGA (D-1537, 16/09/2026).
 *
 * O limitador antigo descartava o quadro que chegava uma fracao de ms antes do
 * intervalo: tela de 120 Hz com o limite em 120 desenhava 60. Aqui a tela e
 * simulada (carimbos do rAF com oscilacao) e se conta o que sai em 10 s.
 */
import { describe, expect, it } from 'vitest';
import { decidirQuadro } from 'Renderer/limiteDeQuadros.js';

/** Quadros desenhados por segundo numa tela de `hz`, com `limite`. */
function medir(hz, limite, oscilacaoMs = 0, segundos = 10) {
	const periodo = 1000 / hz;
	let ultimo = 0;
	let desenhados = 0;
	const total = Math.round(segundos * hz);
	for (let i = 1; i <= total; i++) {
		// Oscilacao alternada e deterministica: +o, -o, +o...
		const agora = i * periodo + (i % 2 === 0 ? oscilacaoMs : -oscilacaoMs);
		const d = decidirQuadro(ultimo, agora, limite);
		ultimo = d.ultimo;
		if (d.desenhar) desenhados++;
	}
	return desenhados / segundos;
}

describe('o limitador de quadros (D-1537)', () => {
	it('tela de 120 Hz com limite 120 desenha 120, mesmo com o carimbo oscilando', () => {
		// O defeito medido: com o criterio estrito isto dava ~60.
		expect(medir(120, 120, 0.2)).toBeGreaterThanOrEqual(118);
	});

	it('tela de 120 Hz com limite 90 desenha ~90, e nao 60', () => {
		const fps = medir(120, 90, 0.2);
		expect(fps).toBeGreaterThanOrEqual(85);
		expect(fps).toBeLessThanOrEqual(90);
	});

	it('o limite NUNCA e furado pela folga', () => {
		for (const hz of [60, 90, 120, 144, 165, 240]) {
			for (const limite of [30, 60, 90, 120]) {
				expect(medir(hz, limite, 0.3), `${hz} Hz, limite ${limite}`).toBeLessThanOrEqual(limite + 0.2);
			}
		}
	});

	it('limite 30 e 60 continuam valendo para economizar bateria', () => {
		expect(medir(60, 30)).toBeCloseTo(30, 0);
		expect(medir(120, 30, 0.2)).toBeCloseTo(30, 0);
		expect(medir(120, 60, 0.2)).toBeCloseTo(60, 0);
	});

	it('tela mais lenta que o limite desenha tudo o que a tela da', () => {
		expect(medir(60, 120, 0.3)).toBeCloseTo(60, 0);
	});

	it('sem limite (-1 ou 0) desenha todo quadro', () => {
		expect(medir(144, -1)).toBeCloseTo(144, 0);
		expect(decidirQuadro(0, 5, 0)).toEqual({ desenhar: true, ultimo: 5 });
	});

	it('quem ficou muito para tras realinha, sem rajada de quadros', () => {
		// A aba voltou depois de 5 s: um quadro so, e o marco no limite certo.
		const d = decidirQuadro(0, 5003, 60);
		expect(d.desenhar).toBe(true);
		expect(5003 - d.ultimo).toBeLessThan(1000 / 60);
		expect(decidirQuadro(d.ultimo, 5004, 60).desenhar).toBe(false);
	});

	it('o quadro que chega adiantado alem da folga e descartado', () => {
		// intervalo 16,67; folga 4,17: 12 ms e cedo demais, 13 ms passa.
		expect(decidirQuadro(0, 12, 60).desenhar).toBe(false);
		expect(decidirQuadro(0, 13, 60)).toEqual({ desenhar: true, ultimo: 1000 / 60 });
	});
});
