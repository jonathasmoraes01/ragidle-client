import { afterEach, describe, expect, it, vi } from 'vitest';
import { abrirEmAbaNova } from 'UI/abrirEmAbaNova.js';

afterEach(() => {
	vi.restoreAllMocks();
});

describe('abrirEmAbaNova (27/09/2026, o voto e as boas-vindas)', () => {
	it('abriu: devolve true e corta o opener', () => {
		const nova = { opener: 'o jogo' };
		const open = vi.spyOn(window, 'open').mockReturnValue(nova);
		expect(abrirEmAbaNova('https://idlerank.com/vote/x')).toBe(true);
		expect(open).toHaveBeenCalledWith('https://idlerank.com/vote/x', '_blank');
		expect(nova.opener).toBeNull();
	});

	it('o navegador barrou: devolve false, e quem chama mostra o link', () => {
		vi.spyOn(window, 'open').mockReturnValue(null);
		expect(abrirEmAbaNova('https://idlerank.com/vote/x')).toBe(false);
	});

	it('a janela lancou: devolve false em vez de derrubar a janela de voto', () => {
		vi.spyOn(window, 'open').mockImplementation(() => {
			throw new Error('bloqueado');
		});
		expect(abrirEmAbaNova('https://idlerank.com/vote/x')).toBe(false);
	});

	it('nao pede noopener: com ele o open devolve null sempre e o jogo nao saberia se abriu', () => {
		const open = vi.spyOn(window, 'open').mockReturnValue({ opener: null });
		abrirEmAbaNova('https://topidle.com/jogo/x');
		expect(open.mock.calls[0]).toHaveLength(2);
	});
});
