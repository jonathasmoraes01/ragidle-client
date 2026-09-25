/**
 * A NOVA TENTATIVA DE ARQUIVO (23/09/2026, relato "Can't find file
 * prt_fild07.rsw" com o arquivo existindo em producao).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	devoTentarDeNovo,
	esperaAntesDaTentativa,
	NOVAS_TENTATIVAS_DE_ARQUIVO
} from 'Core/tentativasDeArquivo.js';
import FileManager from 'Core/FileManager.js';

describe('devoTentarDeNovo', () => {
	it('rede caida, 408, 429 e 5xx tentam de novo', () => {
		for (const status of [null, 408, 429, 500, 502, 503, 504]) {
			expect(devoTentarDeNovo(status, 0), String(status)).toBe(true);
		}
	});

	it('404, 403 e 400 nao tentam: o servidor ja respondeu que nao ha arquivo', () => {
		for (const status of [400, 403, 404, 410]) {
			expect(devoTentarDeNovo(status, 0), String(status)).toBe(false);
		}
	});

	it('para depois de 3 novas tentativas', () => {
		expect(NOVAS_TENTATIVAS_DE_ARQUIVO).toBe(3);
		expect(devoTentarDeNovo(503, 2)).toBe(true);
		expect(devoTentarDeNovo(503, 3)).toBe(false);
	});

	it('as esperas crescem: 1 s, 2 s, 4 s', () => {
		expect([0, 1, 2].map(esperaAntesDaTentativa)).toEqual([1000, 2000, 4000]);
	});
});

describe('FileManager.getHTTP com a nova tentativa', () => {
	const binario = () => ({
		ok: true,
		status: 200,
		headers: { get: () => 'application/octet-stream' },
		arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
	});
	const falha = status => ({ ok: false, status, headers: { get: () => '' } });

	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	async function esvaziar() {
		for (let i = 0; i < 20; i++) {
			await vi.advanceTimersByTimeAsync(1000);
		}
	}

	it('um 503 seguido de 200 entrega o arquivo UMA vez', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(falha(503)).mockResolvedValueOnce(binario());
		vi.stubGlobal('fetch', fetch);
		const callback = vi.fn();
		FileManager.getHTTP('data/prt_fild07.rsw', callback);
		await esvaziar();
		expect(fetch).toHaveBeenCalledTimes(2);
		expect(callback).toHaveBeenCalledTimes(1);
		expect(callback.mock.calls[0][0]).toBeInstanceOf(ArrayBuffer);
	});

	it('a rede caindo tres vezes e voltando entrega o arquivo', async () => {
		const fetch = vi
			.fn()
			.mockRejectedValueOnce(new Error('rede'))
			.mockRejectedValueOnce(new Error('rede'))
			.mockRejectedValueOnce(new Error('rede'))
			.mockResolvedValueOnce(binario());
		vi.stubGlobal('fetch', fetch);
		const callback = vi.fn();
		FileManager.getHTTP('data/prt_fild07.gnd', callback);
		await esvaziar();
		expect(fetch).toHaveBeenCalledTimes(4);
		expect(callback).toHaveBeenCalledTimes(1);
		expect(callback.mock.calls[0][0]).toBeInstanceOf(ArrayBuffer);
	});

	it('um 404 falha na hora, com UM pedido so', async () => {
		const fetch = vi.fn().mockResolvedValue(falha(404));
		vi.stubGlobal('fetch', fetch);
		const callback = vi.fn();
		FileManager.getHTTP('data/sprite/inexistente.spr', callback);
		await esvaziar();
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(callback).toHaveBeenCalledTimes(1);
		expect(callback.mock.calls[0][0]).toBeNull();
	});

	it('503 para sempre desiste depois de 4 pedidos, com o callback UMA vez', async () => {
		const fetch = vi.fn().mockResolvedValue(falha(503));
		vi.stubGlobal('fetch', fetch);
		const callback = vi.fn();
		FileManager.getHTTP('data/prt_fild07.gat', callback);
		await esvaziar();
		expect(fetch).toHaveBeenCalledTimes(4);
		expect(callback).toHaveBeenCalledTimes(1);
		expect(callback.mock.calls[0][0]).toBeNull();
	});

	it('um erro DENTRO do callback nao vira nova tentativa nem segunda entrega', async () => {
		const fetch = vi.fn().mockResolvedValue(binario());
		vi.stubGlobal('fetch', fetch);
		const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
		const callback = vi.fn(() => {
			throw new Error('parser');
		});
		FileManager.getHTTP('data/prt_fild07.rsw', callback);
		await esvaziar();
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(callback).toHaveBeenCalledTimes(1);
		erro.mockRestore();
	});
});

/*
 * O ARQUIVO QUE VEIO E NAO ABRE (25/09/2026, relato "Can't find file
 * pay_fild01.gnd" com o arquivo servido normalmente): a copia e apagada do
 * cache e baixada de novo UMA vez; o que nao existe (404) nao repete.
 */
describe('FileManager.load com o arquivo que nao abre', () => {
	const lixo = () => ({
		ok: true,
		status: 200,
		headers: { get: () => 'application/octet-stream' },
		arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
	});

	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	async function esvaziar() {
		for (let i = 0; i < 20; i++) {
			await vi.advanceTimersByTimeAsync(1000);
		}
	}

	it('o .gnd corrompido e baixado de novo UMA vez, e o erro chega uma vez so', async () => {
		const fetch = vi.fn().mockImplementation(() => Promise.resolve(lixo()));
		vi.stubGlobal('fetch', fetch);
		const callback = vi.fn();
		FileManager.load('data/pay_fild01.gnd', callback);
		await esvaziar();
		expect(fetch).toHaveBeenCalledTimes(2);
		expect(callback).toHaveBeenCalledTimes(1);
		expect(callback.mock.calls[0][0]).toBeNull();
	});

	it('CONTROLE: o que nao existe (404) nao e baixado de novo', async () => {
		const fetch = vi.fn().mockResolvedValue({ ok: false, status: 404, headers: { get: () => '' } });
		vi.stubGlobal('fetch', fetch);
		const callback = vi.fn();
		FileManager.load('data/sprite/nao_existe.spr', callback);
		await esvaziar();
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(callback).toHaveBeenCalledTimes(1);
	});

	it('a regra: so quem veio com bytes, nao abriu, e ainda nao foi rebaixado', async () => {
		const { devoBaixarDeNovo } = await import('Core/tentativasDeArquivo.js');
		expect(devoBaixarDeNovo({ tinhaBytes: true, abriu: false, jaRefez: false })).toBe(true);
		expect(devoBaixarDeNovo({ tinhaBytes: true, abriu: false, jaRefez: true })).toBe(false);
		expect(devoBaixarDeNovo({ tinhaBytes: true, abriu: true, jaRefez: false })).toBe(false);
		expect(devoBaixarDeNovo({ tinhaBytes: false, abriu: false, jaRefez: false })).toBe(false);
	});
});
