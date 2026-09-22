/** O "Copiado!" volta ao rotulo original (F49, auditoria de 22/09/2026). */
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DURACAO_DO_COPIADO_MS, confirmarCopia } from 'UI/Components/IndicacaoIdle/confirmarCopia.js';

function botao() {
	const b = document.createElement('button');
	b.textContent = 'Copiar';
	return b;
}

describe('confirmarCopia', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('mostra "Copiado!" e volta ao rotulo depois do prazo', () => {
		const b = botao();
		confirmarCopia(b);
		expect(b.textContent).toBe('Copiado!');
		expect(b.classList.contains('is-copiado')).toBe(true);
		vi.advanceTimersByTime(DURACAO_DO_COPIADO_MS);
		expect(b.textContent).toBe('Copiar');
		expect(b.classList.contains('is-copiado')).toBe(false);
	});

	it('dois cliques dentro do prazo NAO prendem o botao em "Copiado!" (o achado)', () => {
		const b = botao();
		confirmarCopia(b);
		vi.advanceTimersByTime(500);
		confirmarCopia(b);
		vi.advanceTimersByTime(DURACAO_DO_COPIADO_MS * 3);
		expect(b.textContent).toBe('Copiar');
		expect(b.classList.contains('is-copiado')).toBe(false);
	});

	it('o segundo clique recomeca o prazo: o primeiro temporizador nao apaga o "Copiado!" antes da hora', () => {
		const b = botao();
		confirmarCopia(b);
		vi.advanceTimersByTime(1000);
		confirmarCopia(b);
		vi.advanceTimersByTime(DURACAO_DO_COPIADO_MS - 1000);
		expect(b.textContent).toBe('Copiado!');
		vi.advanceTimersByTime(1000);
		expect(b.textContent).toBe('Copiar');
	});
});

describe('a janela de indicacao usa confirmarCopia (F49)', () => {
	it('e nao guarda mais o texto de antes a cada clique', () => {
		const fonte = readFileSync('src/UI/Components/IndicacaoIdle/IndicacaoIdle.js', 'utf8')
			.replace(/\/\*[\s\S]*?\*\//g, '')
			.replace(/^[ \t]*\/\/.*$/gm, '');
		expect(fonte).toContain('confirmarCopia(btn);');
		expect(fonte).not.toContain('const antes = btn.textContent;');
	});
});
