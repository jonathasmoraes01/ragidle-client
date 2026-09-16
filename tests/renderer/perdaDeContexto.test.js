/**
 * Perder o contexto WebGL recarrega a pagina, pelas duas portas (13/09/2026,
 * auditoria do iPhone). Ver `src/Renderer/perdaDeContexto.js`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { MS_ATE_RECARREGAR, agendarRecarga, recarregarAgora } from 'Renderer/perdaDeContexto.js';

function janelaFalsa() {
	return { setTimeout: (fn, ms) => setTimeout(fn, ms), location: { reload: vi.fn() } };
}

describe('perdaDeContexto', () => {
	it('sem o contexto de volta, recarrega depois do aviso', () => {
		vi.useFakeTimers();
		const janela = janelaFalsa();
		agendarRecarga(janela);
		vi.advanceTimersByTime(MS_ATE_RECARREGAR - 1);
		expect(janela.location.reload).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(janela.location.reload).toHaveBeenCalledTimes(1);
		vi.useRealTimers();
	});

	it('com o contexto de volta, recarrega na hora', () => {
		const janela = janelaFalsa();
		recarregarAgora(janela);
		expect(janela.location.reload).toHaveBeenCalledTimes(1);
	});

	it('o aviso fica na tela tempo de ser lido, e nao para sempre', () => {
		expect(MS_ATE_RECARREGAR).toBeGreaterThanOrEqual(1000);
		expect(MS_ATE_RECARREGAR).toBeLessThanOrEqual(5000);
	});
});

/*
 * A LIGACAO no Renderer, lida do fonte: o Renderer importa meia arvore do jogo
 * e subi-lo aqui mediria os mocks. O que importa e que as duas portas chamem o
 * modulo — e que o caminho antigo, que deixava o mundo congelado, tenha saido.
 */
describe('Renderer usa as duas portas', () => {
	const fonte = readFileSync(resolve(__dirname, '../../src/Renderer/Renderer.js'), 'utf8');
	const corpo = nome => {
		const inicio = fonte.indexOf(`static ${nome}(`);
		const fim = fonte.indexOf('\n\t}', inicio);
		return fonte.slice(inicio, fim);
	};

	it('onContextLost agenda a recarga', () => {
		expect(corpo('onContextLost')).toContain('agendarRecarga(window)');
	});

	it('onContextRestored recarrega na hora, e nao religa o laco vazio', () => {
		const restaurar = corpo('onContextRestored');
		expect(restaurar).toContain('recarregarAgora(window)');
		expect(restaurar).not.toContain('this.render()');
	});
});
