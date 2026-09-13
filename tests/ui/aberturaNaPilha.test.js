import { describe, expect, it, vi } from 'vitest';
import { avisarAoAbrir } from 'UI/aberturaNaPilha.js';

describe('o aviso de abertura para a pilha (a tarefa 25)', () => {
	it('o onAppend de sempre roda — com o this e o retorno dele — e a pilha fica sabendo', () => {
		const original = vi.fn(function () {
			return this.nome;
		});
		const janela = { nome: 'loja', onAppend: original };
		const aoAbrir = vi.fn();
		expect(avisarAoAbrir(janela, aoAbrir)).toBe(true);
		expect(janela.onAppend()).toBe('loja');
		expect(original).toHaveBeenCalledTimes(1);
		expect(aoAbrir).toHaveBeenCalledTimes(1);
	});

	it('embrulhar DE NOVO (o mapa seguinte) nao aninha: cada abertura avisa uma vez so', () => {
		const janela = { onAppend: vi.fn() };
		const aoAbrir = vi.fn();
		avisarAoAbrir(janela, aoAbrir);
		expect(avisarAoAbrir(janela, aoAbrir)).toBe(false);
		avisarAoAbrir(janela, aoAbrir);
		janela.onAppend();
		expect(aoAbrir).toHaveBeenCalledTimes(1);
	});

	it('a janela sem onAppend proprio tambem avisa', () => {
		const janela = {};
		const aoAbrir = vi.fn();
		avisarAoAbrir(janela, aoAbrir);
		janela.onAppend();
		expect(aoAbrir).toHaveBeenCalledTimes(1);
	});

	it('CONTROLE: sem componente, nada', () => {
		expect(avisarAoAbrir(null, vi.fn())).toBe(false);
	});
});
