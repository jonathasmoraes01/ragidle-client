/**
 * Os relatos vao ao BALCAO do servidor, e nao ao site estatico (13/09/2026).
 * Ver `src/UI/enderecoDoBalcao.js`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const configs = vi.hoisted(() => ({ valores: {} }));
vi.mock('Core/Configs.js', () => ({
	default: { get: (chave, padrao) => (chave in configs.valores ? configs.valores[chave] : padrao) }
}));

import { rotaDoBalcao } from 'UI/enderecoDoBalcao.js';
import { relatarErro } from 'UI/relatoDeErro.js';

afterEach(() => {
	configs.valores = {};
	vi.unstubAllGlobals();
});

describe('rotaDoBalcao', () => {
	it('com o cadastroUrl de producao, a rota vai ao balcao', () => {
		configs.valores = { cadastroUrl: 'https://api.roclassicidle.com.br' };
		expect(rotaDoBalcao('/analytics/erro')).toBe('https://api.roclassicidle.com.br/analytics/erro');
	});

	it('barra no fim da base nao dobra', () => {
		configs.valores = { cadastroUrl: 'https://api.exemplo.com/' };
		expect(rotaDoBalcao('/analytics/desempenho')).toBe('https://api.exemplo.com/analytics/desempenho');
	});

	it('sem cadastroUrl (o dev) o caminho continua relativo, como antes', () => {
		expect(rotaDoBalcao('/analytics/erro')).toBe('/analytics/erro');
	});
});

describe('relatarErro usa o balcao', () => {
	it('o relato de erro vai ao endereco do servidor, e nao ao site estatico', () => {
		configs.valores = { cadastroUrl: 'https://api.roclassicidle.com.br' };
		const fetch = vi.fn(() => Promise.resolve({ ok: true }));
		vi.stubGlobal('fetch', fetch);
		relatarErro('um erro unico deste teste', 'pilha');
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(fetch.mock.calls[0][0]).toBe('https://api.roclassicidle.com.br/analytics/erro');
	});
});
