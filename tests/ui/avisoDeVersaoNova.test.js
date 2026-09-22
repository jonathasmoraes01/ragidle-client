/**
 * O aviso de versao nova (13/09/2026, relato do dono com print do iPhone:
 * *"Nao consigo clicar em recarregar ou depois. E possivel fazer isso
 * automaticamente tambem, num prazo de 10 segundos?"*).
 *
 * DOIS defeitos/pedidos, e este arquivo cobra os dois:
 *
 * 1. **O toque nao chegava nos botoes.** O aviso e montado a mao pela casca
 *    (`applications/pwa/registrar-sw.js`), fora dos componentes do jogo — e em
 *    producao ele mora no MESMO documento do jogo. O ouvinte de toque do jogo
 *    (`Core/Mobile.js`) da `preventDefault` em todo toque que nao nasceu na UI,
 *    e isso SUPRIME o clique sintetico do toque (D-932). Quem responde "nasceu
 *    na UI?" e `ehEventoDaUI`, pela marca `data-gui-component` — que o aviso
 *    nao tinha.
 * 2. **Recarregar sozinho em 10 s**, com a contagem na tela; "Depois" cancela e
 *    "Recarregar" age na hora.
 *
 * O arquivo da casca e um script solto (nao um modulo): ele e lido e rodado no
 * jsdom. Sem `navigator.serviceWorker` no jsdom, o registro nao acontece — so a
 * funcao do aviso, exposta em `window.RagIdlePWA`, e exercitada.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ehEventoDaUI } from 'Controls/ehEventoDaUI.js';

const FONTE = readFileSync(resolve(__dirname, '../../applications/pwa/registrar-sw.js'), 'utf8');

function carregarCasca() {
	// eslint-disable-next-line no-new-func
	new Function(FONTE)();
	return window.RagIdlePWA;
}

function aviso() {
	return document.getElementById('ri-aviso-versao');
}

function botao(texto) {
	return Array.from(aviso().querySelectorAll('button')).find(b => b.textContent.trim().startsWith(texto));
}

beforeEach(() => {
	vi.useFakeTimers();
	document.body.innerHTML = '';
	delete window.RagIdlePWA;
});

afterEach(() => {
	vi.useRealTimers();
	document.body.innerHTML = '';
	delete window.RagIdlePWA;
});

describe('o aviso de versao nova', () => {
	it('o toque num botao do aviso e reconhecido como UI — senao o jogo engole o clique no celular', () => {
		const pwa = carregarCasca();
		pwa.mostrarAvisoDeVersao(() => {});
		const recarregar = botao('Recarregar');
		const evento = { composedPath: () => [recarregar, aviso(), document.body, document.documentElement] };
		expect(ehEventoDaUI(evento)).toBe(true);
	});

	it('recarrega SOZINHO em 10 s, e nao antes', () => {
		const pwa = carregarCasca();
		const aoRecarregar = vi.fn();
		pwa.mostrarAvisoDeVersao(aoRecarregar);
		vi.advanceTimersByTime(9_900);
		expect(aoRecarregar).not.toHaveBeenCalled();
		vi.advanceTimersByTime(200);
		expect(aoRecarregar).toHaveBeenCalledTimes(1);
	});

	it('a contagem aparece e desce', () => {
		const pwa = carregarCasca();
		pwa.mostrarAvisoDeVersao(() => {});
		expect(aviso().textContent).toContain('10');
		vi.advanceTimersByTime(3_000);
		expect(aviso().textContent).toContain('7');
	});

	it('"Recarregar" age na hora, e a contagem nao recarrega de novo depois', () => {
		const pwa = carregarCasca();
		const aoRecarregar = vi.fn();
		pwa.mostrarAvisoDeVersao(aoRecarregar);
		botao('Recarregar').click();
		expect(aoRecarregar).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(20_000);
		expect(aoRecarregar).toHaveBeenCalledTimes(1);
	});

	it('toque duplo, ou toque depois de a contagem disparar, recarrega UMA vez so', () => {
		const pwa = carregarCasca();
		const aoRecarregar = vi.fn();
		pwa.mostrarAvisoDeVersao(aoRecarregar);
		botao('Recarregar').click();
		botao('Recarregar').click();
		expect(aoRecarregar).toHaveBeenCalledTimes(1);

		document.body.innerHTML = '';
		const outro = vi.fn();
		pwa.mostrarAvisoDeVersao(outro);
		vi.advanceTimersByTime(10_100);
		botao('Recarregar').click();
		expect(outro).toHaveBeenCalledTimes(1);
	});

	it('"Depois" cancela a recarga e tira o aviso', () => {
		const pwa = carregarCasca();
		const aoRecarregar = vi.fn();
		pwa.mostrarAvisoDeVersao(aoRecarregar);
		botao('Depois').click();
		vi.advanceTimersByTime(20_000);
		expect(aoRecarregar).not.toHaveBeenCalled();
		expect(aviso()).toBeNull();
	});

	it('um segundo aviso nao duplica a caixa nem a contagem', () => {
		const pwa = carregarCasca();
		const aoRecarregar = vi.fn();
		pwa.mostrarAvisoDeVersao(aoRecarregar);
		pwa.mostrarAvisoDeVersao(aoRecarregar);
		expect(document.querySelectorAll('#ri-aviso-versao')).toHaveLength(1);
		vi.advanceTimersByTime(10_100);
		expect(aoRecarregar).toHaveBeenCalledTimes(1);
	});
});

describe('a sessao longa descobre a versao nova (F30, auditoria de 22/09/2026)', () => {
	/*
	 * Tres lacunas: o worker que JA esperava no carregamento nunca disparava
	 * `statechange` (o aviso nunca aparecia), nada chamava `registro.update()`
	 * (uma sessao aberta por horas nunca via o deploy), e o "Depois" sumia com
	 * o aviso para sempre.
	 */
	let sw;
	beforeEach(() => {
		sw = navigator.serviceWorker;
		Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { controller: {} } });
	});
	afterEach(() => {
		Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: sw });
	});

	function registroFalso(esperando) {
		return {
			waiting: esperando ? { state: 'installed', postMessage: vi.fn(), addEventListener: vi.fn() } : null,
			installing: null,
			addEventListener: vi.fn(),
			update: vi.fn(() => Promise.resolve())
		};
	}

	it('o worker que ja estava ESPERANDO no carregamento gera o aviso na hora', () => {
		const pwa = carregarCasca();
		pwa.acompanharRegistro(registroFalso(true));
		expect(aviso()).not.toBeNull();
	});

	it('sem versao esperando, nenhum aviso (CONTROLE)', () => {
		const pwa = carregarCasca();
		pwa.acompanharRegistro(registroFalso(false));
		expect(aviso()).toBeNull();
	});

	it('pergunta ao servidor a cada 30 min', () => {
		const pwa = carregarCasca();
		const registro = registroFalso(false);
		pwa.acompanharRegistro(registro);
		vi.advanceTimersByTime(30 * 60 * 1000);
		expect(registro.update).toHaveBeenCalledTimes(1);
	});

	it('depois do "Depois", a volta da aba oferece de novo', () => {
		const pwa = carregarCasca();
		pwa.acompanharRegistro(registroFalso(true));
		botao('Depois').click();
		expect(aviso()).toBeNull();
		Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
		document.dispatchEvent(new Event('visibilitychange'));
		expect(aviso()).not.toBeNull();
	});
});
