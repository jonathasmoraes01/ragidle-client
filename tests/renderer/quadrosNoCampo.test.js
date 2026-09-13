/**
 * O FPS que o aparelho do jogador desenha, contado e mandado ao balcao
 * (13/09/2026, auditoria do iPhone). Ver `src/Renderer/quadrosNoCampo.js`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({ jogando: true }));
vi.mock('Engine/SessionStorage.js', () => ({
	default: {
		get Playing() {
			return estado.jogando;
		}
	}
}));
vi.mock('Core/Configs.js', () => ({
	default: { get: (chave, padrao) => (chave === 'cadastroUrl' ? 'https://api.exemplo.com' : padrao) }
}));

import {
	INTERVALO_MAXIMO_MS,
	MINIMO_DE_QUADROS,
	enviarRelatoDeDesempenho,
	quadrosNaAmostra,
	registrarQuadro,
	resumirIntervalos,
	zerarAmostra
} from 'Renderer/quadrosNoCampo.js';

function desenhar(quadros, passoMs) {
	let t = 1000;
	for (let i = 0; i <= quadros; i++) {
		registrarQuadro(t);
		t += passoMs;
	}
}

describe('resumirIntervalos', () => {
	it('60 quadros de 16,7 ms sao ~60 fps com mediana 16,7', () => {
		const r = resumirIntervalos(new Array(60).fill(16.7), 60);
		expect(r.fps).toBeCloseTo(59.9, 1);
		expect(r.p50Ms).toBe(16.7);
		expect(r.quadros).toBe(60);
	});

	it('o p95 pega o quadro lento que a media esconde', () => {
		const intervalos = new Array(95).fill(16.7).concat(new Array(5).fill(50));
		const r = resumirIntervalos(intervalos, 100);
		expect(r.p50Ms).toBe(16.7);
		expect(r.p95Ms).toBe(50);
	});

	it('so a parte USADA do vetor conta', () => {
		const vetor = new Float32Array(10);
		vetor.set([20, 20, 999, 999]);
		expect(resumirIntervalos(vetor, 2).p95Ms).toBe(20);
	});

	it('amostra vazia nao vira relato', () => {
		expect(resumirIntervalos([], 0)).toBeNull();
	});
});

describe('registrarQuadro', () => {
	beforeEach(() => zerarAmostra());

	it('conta os intervalos entre quadros', () => {
		desenhar(10, 16.7);
		expect(quadrosNaAmostra()).toBe(10);
	});

	it('a volta da aba escondida nao e um quadro de varios minutos', () => {
		registrarQuadro(1000);
		registrarQuadro(1000 + INTERVALO_MAXIMO_MS + 1);
		registrarQuadro(1000 + INTERVALO_MAXIMO_MS + 18);
		expect(quadrosNaAmostra()).toBe(1);
	});
});

describe('enviarRelatoDeDesempenho', () => {
	let fetch;
	beforeEach(() => {
		zerarAmostra();
		estado.jogando = true;
		fetch = vi.fn(() => Promise.resolve({ ok: true }));
		vi.stubGlobal('fetch', fetch);
	});
	afterEach(() => vi.unstubAllGlobals());

	it('em jogo e com amostra suficiente, manda ao balcao do servidor', () => {
		desenhar(MINIMO_DE_QUADROS, 16.7);
		expect(enviarRelatoDeDesempenho()).toBe(true);
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(fetch.mock.calls[0][0]).toBe('https://api.exemplo.com/analytics/desempenho');
		const corpo = JSON.parse(fetch.mock.calls[0][1].body);
		expect(corpo.fps).toBeGreaterThan(55);
		expect(corpo.p95Ms).toBeCloseTo(16.7, 1);
		expect(typeof corpo.dpr).toBe('number');
		expect(typeof corpo.dedo).toBe('boolean');
	});

	it('fora do jogo (login, selecao) nao manda', () => {
		estado.jogando = false;
		desenhar(MINIMO_DE_QUADROS * 2, 16.7);
		expect(enviarRelatoDeDesempenho()).toBe(false);
		expect(fetch).not.toHaveBeenCalled();
	});

	it('amostra pequena nao vira relato', () => {
		desenhar(MINIMO_DE_QUADROS - 1, 16.7);
		expect(enviarRelatoDeDesempenho()).toBe(false);
		expect(fetch).not.toHaveBeenCalled();
	});

	it('cada relato comeca uma amostra nova', () => {
		desenhar(MINIMO_DE_QUADROS, 16.7);
		enviarRelatoDeDesempenho();
		expect(quadrosNaAmostra()).toBe(0);
	});
});
