/**
 * O RASTREADOR DE MISSOES SO ESCREVE O QUE MUDOU (auditoria de desempenho de
 * 15/10/2026).
 *
 * O `syncPosition` roda a cada 250 ms e escrevia `top`/`left`/`display`/
 * `maxHeight` e o `--hud-coluna-fundo` no `:root` a cada passe, quase sempre
 * com o MESMO valor (e o `getBoundingClientRect` seguinte pagava um layout por
 * escrita). O cartao e montado de verdade (os mocks sao os de
 * `missoesSimultaneas.test.js`), com o painel de personagem como ancora.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { contarEscritasDeEstilo } from './contarEscritasDeEstilo.js';

const ancora = { rect: { top: 20, bottom: 120, left: 16, right: 216, width: 200, height: 100 } };

vi.mock('Network/NetworkManager.js', () => ({
	default: { sendPacket: vi.fn(), hookPacket: vi.fn() }
}));
vi.mock('Renderer/Renderer.js', () => ({
	default: { render: vi.fn(), stop: vi.fn(), width: 1280, height: 720 }
}));
vi.mock('UI/UIManager.js', () => ({ default: { showErrorBox: vi.fn(), addComponent: c => c } }));
vi.mock('UI/Components/ChatBox/ChatBox.js', () => ({
	default: { addText: vi.fn(), TYPE: { ERROR: 1 }, FILTER: { PUBLIC_LOG: 1 } }
}));
vi.mock('UI/Components/BasicInfoIdle/BasicInfoIdle.js', () => ({
	default: { _host: { getBoundingClientRect: () => ancora.rect } }
}));
vi.mock('UI/Components/LFGIdle/LFGIdle.js', () => ({ default: { toggle: vi.fn() } }));
vi.mock('UI/Components/CodexIdle/CodexIdle.js', () => ({ default: { abrirNaEntrada: vi.fn() } }));

async function montar() {
	const { default: html } = await import('UI/Components/MissoesTrackerIdle/MissoesTrackerIdle.html?raw');
	const { default: MissoesIdle } = await import('UI/Components/MissoesIdle/MissoesIdle.js');
	const { default: Tracker } = await import('UI/Components/MissoesTrackerIdle/MissoesTrackerIdle.js');
	MissoesIdle.missoes = [];
	MissoesIdle.execucao = null;
	Tracker._host = document.createElement('div');
	Tracker._host.innerHTML = html;
	Tracker._shadow = null;
	// o proprio cartao tem altura: e o que publica o fundo da coluna
	Tracker._host.getBoundingClientRect = () => ({ top: 128, bottom: 228, left: 16, width: 200, height: 100 });
	document.body.appendChild(Tracker._host);
	Tracker.limparEstadoDoPersonagem();
	Tracker.init();
	return Tracker;
}

describe('o tique de 250 ms do rastreador', () => {
	let Tracker;

	beforeEach(async () => {
		vi.useFakeTimers();
		vi.resetModules();
		document.body.innerHTML = '';
		document.documentElement.style.removeProperty('--hud-coluna-fundo');
		ancora.rect = { top: 20, bottom: 120, left: 16, right: 216, width: 200, height: 100 };
		Tracker = await montar();
	});

	afterEach(() => {
		Tracker.onRemove();
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('com a ancora parada, quatro segundos de tique nao escrevem estilo nem a propriedade da raiz', () => {
		Tracker.onAppend();
		const top = Tracker._host.style.top;
		const left = Tracker._host.style.left;
		const fundo = document.documentElement.style.getPropertyValue('--hud-coluna-fundo');
		expect(top).toMatch(/px$/);
		expect(fundo).toMatch(/px$/);

		const escritas = contarEscritasDeEstilo(['top', 'left', 'display', 'maxHeight']);
		const publicar = vi.spyOn(document.documentElement.style, 'setProperty');
		vi.advanceTimersByTime(4000);

		expect(escritas.n).toBe(0);
		expect(publicar).not.toHaveBeenCalled();
		expect(Tracker._host.style.top).toBe(top);
		expect(Tracker._host.style.left).toBe(left);
		expect(document.documentElement.style.getPropertyValue('--hud-coluna-fundo')).toBe(fundo);
	});

	it('a ancora que anda move o cartao no passe seguinte, para o mesmo lugar de antes', () => {
		Tracker.onAppend();
		const topAntes = parseFloat(Tracker._host.style.top);
		ancora.rect = { ...ancora.rect, top: 60, bottom: 160 };
		vi.advanceTimersByTime(250);
		expect(parseFloat(Tracker._host.style.top)).toBe(topAntes + 40);
	});

	it('a propriedade tirada da raiz por outro caminho volta no passe seguinte', () => {
		Tracker.onAppend();
		const fundo = document.documentElement.style.getPropertyValue('--hud-coluna-fundo');
		document.documentElement.style.removeProperty('--hud-coluna-fundo');
		vi.advanceTimersByTime(250);
		expect(document.documentElement.style.getPropertyValue('--hud-coluna-fundo')).toBe(fundo);
	});
});
