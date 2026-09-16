/**
 * O teto de densidade do mundo no celular e o buffer preservado so no desktop
 * (13/09/2026, auditoria do iPhone). Ver `src/Renderer/densidadeDoMundo.js`.
 */
import { describe, expect, it } from 'vitest';
import {
	DPR_MAXIMO_NO_TOQUE,
	densidadeDoMundo,
	preservarBufferDeDesenho
} from 'Renderer/densidadeDoMundo.js';

describe('densidadeDoMundo', () => {
	it('o iPhone (DPR 3, dedo) desenha em 2', () => {
		expect(densidadeDoMundo(3, true)).toBe(2);
	});

	it('o teto e 2, e nao outro numero', () => {
		expect(DPR_MAXIMO_NO_TOQUE).toBe(2);
		expect(densidadeDoMundo(2.625, true)).toBe(2);
	});

	it('celular de densidade baixa nao e AUMENTADO pelo teto', () => {
		expect(densidadeDoMundo(1.5, true)).toBe(1.5);
		expect(densidadeDoMundo(1, true)).toBe(1);
	});

	it('o desktop continua com a densidade real, sem teto', () => {
		expect(densidadeDoMundo(3, false)).toBe(3);
		expect(densidadeDoMundo(1.25, false)).toBe(1.25);
	});

	it('densidade ausente ou zero vira 1 nos dois lados', () => {
		expect(densidadeDoMundo(0, true)).toBe(1);
		expect(densidadeDoMundo(undefined, false)).toBe(1);
	});
});

describe('preservarBufferDeDesenho', () => {
	it('desligado no toque: a GPU de tile descarta o buffer em vez de copia-lo', () => {
		expect(preservarBufferDeDesenho(true)).toBe(false);
	});

	it('ligado no desktop: o print do Alt+P le o canvas do mundo', () => {
		expect(preservarBufferDeDesenho(false)).toBe(true);
	});
});
