/**
 * A FALHA NO WORKER NAO PRENDE NADA PARA SEMPRE (D-2055, achado A3).
 *
 *  - o `Thread` ouvia so `message`: o erro solto no worker e a mensagem que
 *    nao se le (`messageerror`) eram mudos;
 *  - o arquivo que falhou uma vez ficava guardado como falha para sempre
 *    (`MemoryManager`): cada pedido renovava o item e a limpeza nunca o tirava;
 *  - os buffers grandes do mapa viajavam COPIADOS ao fio principal.
 */
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Thread from 'Core/Thread.js';
import MemoryManager, { PRAZO_PARA_REPETIR_FALHA_MS } from 'Core/MemoryManager.js';
import { transferiveisDoMapa } from 'Loaders/transferiveisDoMapa.js';

afterEach(() => {
	Thread.hook('THREAD_FALHOU', undefined);
	vi.restoreAllMocks();
});

describe('o Thread avisa a falha do worker', () => {
	it('messageerror e error chegam ao gancho THREAD_FALHOU com o tipo e a mensagem', () => {
		const gancho = vi.fn();
		Thread.hook('THREAD_FALHOU', gancho);
		Thread.aoFalharNoWorker({ type: 'messageerror' });
		Thread.aoFalharNoWorker({ type: 'error', message: 'Uncaught RangeError: Array buffer allocation failed' });
		expect(gancho.mock.calls).toEqual([
			[{ tipo: 'messageerror', mensagem: '' }],
			[{ tipo: 'error', mensagem: 'Uncaught RangeError: Array buffer allocation failed' }]
		]);
	});

	it('sem gancho, ou com o gancho lancando, nada sobe', () => {
		expect(() => Thread.aoFalharNoWorker({ type: 'error' })).not.toThrow();
		vi.spyOn(console, 'error').mockImplementation(() => {});
		Thread.hook('THREAD_FALHOU', () => {
			throw new Error('x');
		});
		expect(() => Thread.aoFalharNoWorker({ type: 'error' })).not.toThrow();
	});
});

describe('a falha guardada de um arquivo nao e para sempre', () => {
	it('a falha velha e esquecida; a nova, e o item que ainda carrega, nao', () => {
		const agora = Date.now();
		MemoryManager.set('data/sprite/falhou.spr', null, "Can't get file");
		expect(MemoryManager.esquecerFalhaVelha('data/sprite/falhou.spr', agora + 1000)).toBe(false);
		expect(MemoryManager.exist('data/sprite/falhou.spr')).toBe(true);
		expect(MemoryManager.esquecerFalhaVelha('data/sprite/falhou.spr', agora + PRAZO_PARA_REPETIR_FALHA_MS + 10)).toBe(true);
		expect(MemoryManager.exist('data/sprite/falhou.spr')).toBe(false);

		// Ainda carregando (com alguem esperando): fica.
		MemoryManager.get('data/sprite/carregando.spr', () => {});
		expect(MemoryManager.esquecerFalhaVelha('data/sprite/carregando.spr', agora + 10 * PRAZO_PARA_REPETIR_FALHA_MS)).toBe(false);
		// Carregado com sucesso: fica.
		MemoryManager.set('data/sprite/bom.spr', { ok: true });
		expect(MemoryManager.esquecerFalhaVelha('data/sprite/bom.spr', agora + 10 * PRAZO_PARA_REPETIR_FALHA_MS)).toBe(false);
	});

	it('o Client pergunta pela falha velha antes de decidir se pede o arquivo', () => {
		const fonte = readFileSync('src/Core/Client.js', 'utf8');
		for (const metodo of ['static getFile(', 'static loadFile(']) {
			const corpo = fonte.slice(fonte.indexOf(metodo), fonte.indexOf(metodo) + 400);
			expect(corpo.indexOf('Memory.esquecerFalhaVelha(filename);'), metodo).toBeGreaterThan(-1);
			expect(corpo.indexOf('Memory.esquecerFalhaVelha(filename);'), metodo).toBeLessThan(corpo.indexOf('if (!Memory.exist(filename))'));
		}
	});
});

describe('os buffers grandes do mapa vao transferidos', () => {
	it('a malha do chao e da agua, e o buffer dos modelos', () => {
		const mesh = new Float32Array(12);
		const waterMesh = new Float32Array(5);
		expect(transferiveisDoMapa('MAP_GROUND', { mesh, waterMesh, lightmap: new Uint8Array(4) })).toEqual([
			mesh.buffer,
			waterMesh.buffer
		]);
		const buffer = new Float32Array(9);
		expect(transferiveisDoMapa('MAP_MODELS', { buffer, infos: [] })).toEqual([buffer.buffer]);
	});

	it('nada de vista parcial (ela divide o buffer com outra coisa), nem de outro tipo de mensagem', () => {
		const grande = new ArrayBuffer(64);
		const parcial = { mesh: new Float32Array(grande, 0, 4), waterMesh: new Float32Array(grande, 16, 4) };
		expect(transferiveisDoMapa('MAP_GROUND', parcial)).toEqual([]);
		expect(transferiveisDoMapa('MAP_ALTITUDE', { cells: new Float32Array(10) })).toEqual([]);
		expect(transferiveisDoMapa('MAP_WORLD', { mesh: new Float32Array(10) })).toEqual([]);
		expect(transferiveisDoMapa('MAP_GROUND', null)).toEqual([]);
	});

	it('o mesmo buffer nao entra duas vezes', () => {
		const mesh = new Float32Array(8);
		expect(transferiveisDoMapa('MAP_GROUND', { mesh, waterMesh: mesh })).toEqual([mesh.buffer]);
	});
});
