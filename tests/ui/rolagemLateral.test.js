/**
 * A LISTA QUE ROLA PARA O LADO (29/09/2026, relato do dono: "os players nao
 * estao conseguindo visualizar todos os itens arrastando para o lado").
 *
 * O jsdom nao faz layout, entao a largura e a posicao sao declaradas no
 * elemento: 300 px visiveis de 1000 px de conteudo.
 */
import { describe, expect, it, vi } from 'vitest';
import { atualizarSetas, ligarRolagemLateral } from '../../src/UI/rolagemLateral.js';

function lista({ visivel = 300, total = 1000 } = {}) {
	const el = document.createElement('div');
	let left = 0;
	Object.defineProperty(el, 'clientWidth', { get: () => visivel });
	Object.defineProperty(el, 'scrollWidth', { get: () => total });
	Object.defineProperty(el, 'scrollLeft', {
		get: () => left,
		set: v => {
			left = Math.max(0, Math.min(total - visivel, v));
		},
	});
	document.body.appendChild(el);
	return el;
}

function setas() {
	return { esquerda: document.createElement('button'), direita: document.createElement('button') };
}

describe('rolagem lateral', () => {
	it('a roda vertical anda para o lado, e na ponta devolve a roda a janela', () => {
		const el = lista();
		ligarRolagemLateral(el);
		const girar = deltaY => {
			const e = new WheelEvent('wheel', { deltaY, cancelable: true });
			el.dispatchEvent(e);
			return e.defaultPrevented;
		};
		expect(girar(120)).toBe(true);
		expect(el.scrollLeft).toBe(120);
		// Na ponta esquerda, rolar "para cima" nao anda: a roda volta a ser da janela.
		el.scrollLeft = 0;
		expect(girar(-120)).toBe(false);
	});

	it('lista que cabe: a roda e da janela, e as setas somem', () => {
		const el = lista({ visivel: 300, total: 300 });
		const s = setas();
		ligarRolagemLateral(el, s);
		const e = new WheelEvent('wheel', { deltaY: 120, cancelable: true });
		el.dispatchEvent(e);
		expect(e.defaultPrevented).toBe(false);
		expect(s.esquerda.hidden && s.direita.hidden).toBe(true);
	});

	it('as setas acendem conforme a posicao', () => {
		const el = lista();
		const s = setas();
		ligarRolagemLateral(el, s);
		expect([s.esquerda.disabled, s.direita.disabled]).toEqual([true, false]);
		el.scrollLeft = 700;
		atualizarSetas(el, s);
		expect([s.esquerda.disabled, s.direita.disabled]).toEqual([false, true]);
	});

	it('o mouse arrasta a lista, e o toque fica com o nativo', () => {
		const el = lista();
		ligarRolagemLateral(el);
		const ponteiro = (tipo, x, pointerType = 'mouse') =>
			el.dispatchEvent(new PointerEvent(tipo, { clientX: x, button: 0, pointerId: 1, pointerType, cancelable: true }));
		ponteiro('pointerdown', 200);
		ponteiro('pointermove', 50);
		ponteiro('pointerup', 50);
		expect(el.scrollLeft).toBe(150);

		el.scrollLeft = 0;
		ponteiro('pointerdown', 200, 'touch');
		ponteiro('pointermove', 50, 'touch');
		expect(el.scrollLeft).toBe(0);
	});

	it('o clique que fecha o arrasto some, e o engolidor nao sobra para o clique seguinte', () => {
		vi.useFakeTimers();
		try {
			const el = lista();
			ligarRolagemLateral(el);
			const ponteiro = (tipo, x) =>
				el.dispatchEvent(new PointerEvent(tipo, { clientX: x, button: 0, pointerId: 1, pointerType: 'mouse', cancelable: true }));
			const clicar = () => {
				const e = new MouseEvent('click', { bubbles: true, cancelable: true });
				el.dispatchEvent(e);
				return e.defaultPrevented;
			};
			// Arrasto com o clique na mesma tarefa: ele e engolido.
			ponteiro('pointerdown', 200);
			ponteiro('pointermove', 50);
			ponteiro('pointerup', 50);
			expect(clicar()).toBe(true);
			// Arrasto SEM clique (soltou fora): na tarefa seguinte o engolidor saiu.
			ponteiro('pointerdown', 200);
			ponteiro('pointermove', 50);
			ponteiro('pointercancel', 50);
			vi.runAllTimers();
			expect(clicar(), 'o clique de verdade seguinte foi engolido').toBe(false);
		} finally {
			vi.useRealTimers();
		}
	});
});
