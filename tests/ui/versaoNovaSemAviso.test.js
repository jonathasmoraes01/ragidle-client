/**
 * A versao nova entra SEM AVISO (23/09/2026, D-996). O relato do dono, com print do
 * iPhone: *"toda vez que eu entro no game aparece a tela de que a nova versao
 * esta disponivel... esta macante; precisa mesmo disso? e eficiente?"*.
 *
 * O print mostrava o aviso de 06/09 — duas semanas depois de o D-1380 o
 * trocar. O `registrar-sw.js` era pedido SEM carimbo e o `sw.js` o servia do
 * cache; na copia velha os botoes nao recebiam toque no iPhone, a versao nova
 * nunca era aceita e o conserto nunca chegava. A causa esta no cabecalho do
 * proprio `registrar-sw.js`.
 *
 * A regra que este arquivo cobra: o worker em espera assume SOZINHO quando e
 * do MESMO build da pagina (a pagina ja e a versao publicada, porque a
 * navegacao e rede primeiro); quando e MAIS NOVO, ele espera a proxima
 * abertura. Em NENHUM caso aparece caixa na tela ou a pagina recarrega.
 *
 * O arquivo da casca e um script solto (nao um modulo): ele e lido e rodado no
 * jsdom, com o service worker falsificado.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const FONTE = readFileSync(resolve(__dirname, '../../applications/pwa/registrar-sw.js'), 'utf8');
const SW = readFileSync(resolve(__dirname, '../../applications/pwa/sw.js'), 'utf8');
const BUILDER = readFileSync(resolve(__dirname, '../../applications/tools/builder-web.mjs'), 'utf8');

/* O literal do fonte: e a versao da pagina no dev, antes de o build o trocar. */
const VERSAO_DA_PAGINA = '__VERSAO_DO_BUILD__';

function carregarCasca() {
	// eslint-disable-next-line no-new-func
	new Function(FONTE)();
	return window.RagIdlePWA;
}

/** Deixa a porta do MessageChannel entregar a resposta (ela e assincrona de verdade). */
async function drenar() {
	for (let i = 0; i < 10; i++) {
		await new Promise(r => setImmediate(r));
	}
}

/**
 * Um worker em espera. `versao: undefined` e o worker de antes de 23/09, que
 * nao conhece a pergunta e nunca responde.
 */
function workerFalso(versao) {
	const recebidas = [];
	return {
		state: 'installed',
		recebidas,
		addEventListener: vi.fn(),
		postMessage(mensagem, portas) {
			recebidas.push(mensagem.tipo);
			if (mensagem.tipo === 'ragidle:versao' && versao !== undefined && portas && portas[0]) {
				portas[0].postMessage({ versao });
			}
		}
	};
}

function registroFalso(esperando) {
	return {
		waiting: esperando,
		installing: null,
		addEventListener: vi.fn(),
		update: vi.fn(() => Promise.resolve())
	};
}

let swOriginal;

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
	document.body.innerHTML = '';
	delete window.RagIdlePWA;
	swOriginal = navigator.serviceWorker;
	Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { controller: {} } });
});

afterEach(() => {
	vi.useRealTimers();
	document.body.innerHTML = '';
	delete window.RagIdlePWA;
	Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: swOriginal });
});

describe('a decisao, pura', () => {
	it('mesma versao: assume; versao diferente: espera', () => {
		const pwa = carregarCasca();
		expect(pwa.decidirVersaoNova('1.0-2026', '1.0-2026')).toBe('assumir');
		expect(pwa.decidirVersaoNova('1.0-2026', '1.0-2027')).toBe('esperar');
	});

	it('qualquer duvida e esperar — worker que nao respondeu, ou pagina sem versao', () => {
		const pwa = carregarCasca();
		expect(pwa.decidirVersaoNova('1.0-2026', null)).toBe('esperar');
		expect(pwa.decidirVersaoNova('', '1.0-2026')).toBe('esperar');
	});
});

describe('o worker em espera, no jogo', () => {
	it('do MESMO build da pagina: assume sozinho, sem caixa na tela', async () => {
		const pwa = carregarCasca();
		const worker = workerFalso(VERSAO_DA_PAGINA);
		pwa.acompanharRegistro(registroFalso(worker));
		await drenar();
		expect(worker.recebidas).toEqual(['ragidle:versao', 'ragidle:assumir']);
		expect(document.body.children).toHaveLength(0);
	});

	it('MAIS NOVO que a pagina (deploy com o jogo aberto): espera, e nao interrompe ninguem', async () => {
		const pwa = carregarCasca();
		const worker = workerFalso('outra-versao');
		pwa.acompanharRegistro(registroFalso(worker));
		await drenar();
		expect(worker.recebidas).toEqual(['ragidle:versao']);
		expect(document.body.children).toHaveLength(0);
	});

	it('worker antigo que nunca responde: pergunta 4 vezes e desiste, sem assumir', async () => {
		const pwa = carregarCasca();
		const worker = workerFalso(undefined);
		const decisao = pwa.decidir(worker);
		vi.advanceTimersByTime(3_000);
		expect(await decisao).toBe('perguntar-de-novo');
		for (let i = 0; i < 3; i++) {
			vi.advanceTimersByTime(5_000);
			await drenar();
			vi.advanceTimersByTime(3_000);
			await drenar();
		}
		vi.advanceTimersByTime(60_000);
		await drenar();
		expect(worker.recebidas).toEqual(['ragidle:versao', 'ragidle:versao', 'ragidle:versao', 'ragidle:versao']);
		expect(pwa.decisoes.map(d => d.decisao)).toEqual(['esperar', 'esperar', 'esperar', 'esperar']);
	});

	it('worker que demora a acordar (so responde na 2a pergunta): ASSUME mesmo assim', async () => {
		/* O caso que a `prove:pwa` pegou numa corrida de tres: sem a nova
		   pergunta, a pagina ja era a nova e o worker ficava esperando. */
		const pwa = carregarCasca();
		const worker = workerFalso(VERSAO_DA_PAGINA);
		const original = worker.postMessage;
		let perguntas = 0;
		worker.postMessage = (mensagem, portas) => {
			if (mensagem.tipo === 'ragidle:versao' && ++perguntas === 1) {
				worker.recebidas.push(mensagem.tipo);
				return;
			}
			original(mensagem, portas);
		};
		pwa.decidir(worker);
		vi.advanceTimersByTime(3_000);
		await drenar();
		vi.advanceTimersByTime(5_000);
		await drenar();
		expect(worker.recebidas).toEqual(['ragidle:versao', 'ragidle:versao', 'ragidle:assumir']);
	});

	it('primeira instalacao (sem controller): nada a decidir', async () => {
		Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { controller: null } });
		const pwa = carregarCasca();
		const worker = workerFalso(VERSAO_DA_PAGINA);
		pwa.acompanharRegistro(registroFalso(worker));
		await drenar();
		expect(worker.recebidas).toEqual([]);
	});

	it('o mesmo worker nao e perguntado de novo a cada conferencia', async () => {
		const pwa = carregarCasca();
		const worker = workerFalso('outra-versao');
		const registro = registroFalso(worker);
		pwa.acompanharRegistro(registro);
		await drenar();
		vi.advanceTimersByTime(30 * 60 * 1000);
		await drenar();
		expect(registro.update).toHaveBeenCalledTimes(1);
		expect(worker.recebidas).toEqual(['ragidle:versao']);
	});

	it('a volta da aba confere o servidor (F30)', () => {
		const pwa = carregarCasca();
		const registro = registroFalso(null);
		pwa.acompanharRegistro(registro);
		Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
		document.dispatchEvent(new Event('visibilitychange'));
		expect(registro.update).toHaveBeenCalledTimes(1);
	});
});

describe('nada recarrega a pagina, e nada fica preso no cache', () => {
	it('o registrador nao tem caminho de recarga (nem aviso)', () => {
		expect(FONTE).not.toMatch(/location\.reload/);
		expect(FONTE).not.toMatch(/ri-aviso-versao/);
	});

	it('o registrador e o api.js sao pedidos COM o carimbo do build', () => {
		expect(BUILDER.match(/registrar-sw\.js\?v=\$\{startTime\}/g)).toHaveLength(2);
		expect(BUILDER).toContain('<script src="api.js?v=${startTime}">');
		expect(BUILDER).not.toContain('<script src="./registrar-sw.js" defer>');
	});

	it('o build injeta a versao no registrador, a mesma do worker', () => {
		expect(BUILDER).toMatch(/registrar-sw\.js'[\s\S]{0,80}\.replace\('__VERSAO_DO_BUILD__', versaoDoBuild\)/);
	});

	it('o worker responde a versao e so serve do cache o que tem carimbo', () => {
		expect(SW).toContain("tipo === 'ragidle:versao'");
		expect(SW).toContain('porta.postMessage({ versao: VERSAO })');
		expect(SW).toMatch(/if \(!url\.searchParams\.has\('v'\)\)/);
	});
});
