/** O som de efeito nao nasce nem toca fora de hora (F47, auditoria de 22/09/2026). */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SOM_VENCIDO_MS, deveAgendarSom, somAindaVale } from 'Renderer/somDeEfeito.js';

describe('deveAgendarSom', () => {
	it('com a aba oculta, nao agenda', () => {
		expect(deveAgendarSom({ hidden: true })).toBe(false);
	});

	it('com a aba visivel, ou sem documento (teste, worker), agenda', () => {
		expect(deveAgendarSom({ hidden: false })).toBe(true);
		expect(deveAgendarSom(undefined)).toBe(true);
	});
});

describe('somAindaVale', () => {
	it('no horario, ou atrasado dentro da tolerancia da fila, toca', () => {
		expect(somAindaVale(1000, 1000)).toBe(true);
		expect(somAindaVale(1000 + SOM_VENCIDO_MS, 1000)).toBe(true);
	});

	it('vencido alem da tolerancia (a volta de uma aba oculta), nao toca', () => {
		expect(somAindaVale(1001 + SOM_VENCIDO_MS, 1000)).toBe(false);
		expect(somAindaVale(1000 + 5 * 60 * 1000, 1000)).toBe(false);
	});

	it('a tolerancia cobre a rajada espalhada pelo orcamento da fila (~meio segundo no pior quadro medido)', () => {
		expect(SOM_VENCIDO_MS).toBeGreaterThanOrEqual(500);
	});
});

describe('o EffectManager usa as duas guardas (F47)', () => {
	const fonte = readFileSync('src/Renderer/EffectManager.js', 'utf8')
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/^[ \t]*\/\/.*$/gm, '');

	it('o som do efeito so e agendado com a aba visivel', () => {
		expect(fonte).toMatch(/if \(Params\.effect\.wav && deveAgendarSom\(/);
	});

	it('o som que venceu na fila e descartado antes de tocar', () => {
		expect(fonte).toMatch(
			/Events\.setTimeout\(function \(\) \{\s*if \(!somAindaVale\(Renderer\.tick, quandoTocar\)\) \{\s*return;\s*\}[^}]*Sound\.playPosition\(/
		);
	});
});
