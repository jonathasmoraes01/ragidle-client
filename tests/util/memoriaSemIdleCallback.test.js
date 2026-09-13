/**
 * A LIMPEZA DE MEMORIA NUM NAVEGADOR SEM `requestIdleCallback` (13/09/2026).
 *
 * O Safari do iOS NAO expoe `requestIdleCallback` em versao estavel nenhuma, e
 * o Chrome do iPhone e o mesmo WebKit. `MemoryManager.clean` ligava a trava
 * `_cleaningInProgress` e LOGO DEPOIS chamava a funcao sem guarda: no iPhone a
 * chamada lancava, a trava nunca soltava, e nenhuma limpeza acontecia ate a
 * pagina recarregar. Medido com o jogo de verdade
 * (`Rag Idle 2.0/scripts/sonda-memoria-sem-idle-callback.ts`): 0 limpezas sem a
 * funcao, contra 4 limpezas e 583 arquivos liberados no mesmo tempo com ela.
 *
 * O jsdom tambem nao tem a funcao — este arquivo roda no mesmo mundo do iPhone.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Um modulo novo por teste: `_memory` e a trava sao estado do modulo. */
async function memoriaNova() {
	vi.resetModules();
	return (await import('Core/MemoryManager.js')).default;
}

/** Depois de 30 s (`_rememberTime`) sem uso, o arquivo pode sair. */
const DEPOIS_DE_OCIOSO = 60_000;

describe('MemoryManager sem requestIdleCallback (o WebKit do iPhone)', () => {
	let original;

	beforeEach(() => {
		original = globalThis.requestIdleCallback;
		delete globalThis.requestIdleCallback;
		vi.useFakeTimers();
		vi.spyOn(console, 'log').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
		if (original) {
			globalThis.requestIdleCallback = original;
		}
	});

	it('o ambiente do teste e o do iPhone: a funcao nao existe', () => {
		expect(typeof globalThis.requestIdleCallback).toBe('undefined');
	});

	it('a limpeza acontece mesmo sem a funcao', async () => {
		const Memoria = await memoriaNova();
		Memoria.set('data/a.txt', 'a');
		Memoria.set('data/b.txt', 'b');

		expect(() => Memoria.clean(null, Date.now() + DEPOIS_DE_OCIOSO)).not.toThrow();
		await vi.runAllTimersAsync();

		expect(Memoria.exist('data/a.txt')).toBe(false);
		expect(Memoria.exist('data/b.txt')).toBe(false);
	});

	it('a trava solta: a SEGUNDA limpeza tambem acontece', async () => {
		const Memoria = await memoriaNova();
		const t0 = Date.now();
		Memoria.set('data/a.txt', 'a');
		Memoria.clean(null, t0 + DEPOIS_DE_OCIOSO);
		await vi.runAllTimersAsync();

		Memoria.set('data/c.txt', 'c');
		Memoria.clean(null, t0 + 2 * DEPOIS_DE_OCIOSO);
		await vi.runAllTimersAsync();

		expect(Memoria.exist('data/c.txt')).toBe(false);
	});

	it('uma excecao no meio da limpeza nao deixa a trava presa', async () => {
		const Memoria = await memoriaNova();
		const t0 = Date.now();
		Memoria.set('data/a.txt', 'a');
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const remover = Memoria.remove;
		Memoria.remove = () => {
			throw new Error('falha de proposito');
		};
		Memoria.clean(null, t0 + DEPOIS_DE_OCIOSO);
		await vi.runAllTimersAsync();
		Memoria.remove = remover;

		Memoria.clean(null, t0 + 2 * DEPOIS_DE_OCIOSO);
		await vi.runAllTimersAsync();

		expect(Memoria.exist('data/a.txt')).toBe(false);
	});
});
