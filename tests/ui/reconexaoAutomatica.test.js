/**
 * A ESCALADA DA RECONEXAO AUTOMATICA (R12, 14/09/2026) — `Network/reconexao.js`.
 *
 * A interpretacao operacional do pedido do dono: esperar 10s pela primeira
 * tentativa; falhas seguintes usam intervalos ENTRE OS INICIOS de 20, 30,
 * 40, 50, 60s, depois 60s fixo (t aproximado: 10, 30, 60, 100, 150, 210).
 * `Math.random` e' fixado em 0 neste arquivo inteiro para o jitter (pequeno
 * e declarado, ver o cabecalho do modulo) nao tornar os tempos do teste
 * imprevisiveis — o jitter em si nao e' o que estes casos medem.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	network: { onDisconnect: null },
	mapEngineInit: vi.fn(),
	gameEngineReload: vi.fn(),
	uiMostrar: vi.fn(),
	uiEsconder: vi.fn()
}));

vi.mock('Network/NetworkManager.js', () => ({ default: mocks.network }));
vi.mock('Engine/MapEngine.js', () => ({ default: { init: (...args) => mocks.mapEngineInit(...args) } }));
vi.mock('Engine/GameEngine.js', () => ({ default: { reload: (...args) => mocks.gameEngineReload(...args) } }));
vi.mock('UI/Components/Reconexao/Reconexao.js', () => ({
	default: {
		mostrar: (...args) => mocks.uiMostrar(...args),
		esconder: (...args) => mocks.uiEsconder(...args)
	}
}));

/** Um socket falso com `.close()` espionavel — o que o watchdog fecha. */
function socketFalso() {
	return { close: vi.fn() };
}

let Reconexao;

beforeEach(async () => {
	vi.useFakeTimers();
	vi.setSystemTime(0);
	vi.spyOn(Math, 'random').mockReturnValue(0);

	mocks.network.onDisconnect = null;
	mocks.mapEngineInit.mockReset().mockReturnValue(socketFalso());
	mocks.gameEngineReload.mockReset();
	mocks.uiMostrar.mockReset();
	mocks.uiEsconder.mockReset();

	vi.resetModules();
	({ default: Reconexao } = await import('Network/reconexao.js'));
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

/** Dispara uma queda "crua" (sem info de fechamento) via o gancho armado. */
function cair(info) {
	mocks.network.onDisconnect(info);
}

describe('armar', () => {
	it('liga Network.onDisconnect ao gancho da reconexao', () => {
		Reconexao.armar('127.0.0.1', 5121, 'prontera');
		expect(mocks.network.onDisconnect).toBeTypeOf('function');
	});
});

describe('a escalada — t aproximado 10, 30, 60, 100, 150, 210, 270...', () => {
	beforeEach(() => {
		Reconexao.armar('127.0.0.1', 5121, 'prontera');
	});

	it('a primeira tentativa so' + ' acontece depois de 10s, nunca antes', async () => {
		cair();

		await vi.advanceTimersByTimeAsync(9000);
		expect(mocks.mapEngineInit, 'tentou antes dos 10s').not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1000);
		expect(mocks.mapEngineInit).toHaveBeenCalledTimes(1);
		expect(mocks.mapEngineInit).toHaveBeenCalledWith('127.0.0.1', 5121, 'prontera', expect.any(Function));
	});

	it('falhas sucessivas respeitam 20/30/40/50s entre os INICIOS (t=10,30,60,100,150)', async () => {
		cair();
		await vi.advanceTimersByTimeAsync(10000);
		expect(mocks.mapEngineInit).toHaveBeenCalledTimes(1);

		// A 1a tentativa falha rapido (ECONNREFUSED-style) via o callback que
		// MapEngine.init recebeu como 4o argumento.
		mocks.mapEngineInit.mock.calls[0][3]();

		await vi.advanceTimersByTimeAsync(19000);
		expect(mocks.mapEngineInit, 'tentou de novo antes do t=30').toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1000); // t=30
		expect(mocks.mapEngineInit).toHaveBeenCalledTimes(2);

		mocks.mapEngineInit.mock.calls[1][3]();
		await vi.advanceTimersByTimeAsync(29000);
		expect(mocks.mapEngineInit, 'tentou de novo antes do t=60').toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(1000); // t=60
		expect(mocks.mapEngineInit).toHaveBeenCalledTimes(3);

		mocks.mapEngineInit.mock.calls[2][3]();
		await vi.advanceTimersByTimeAsync(40000); // t=100
		expect(mocks.mapEngineInit).toHaveBeenCalledTimes(4);

		mocks.mapEngineInit.mock.calls[3][3]();
		await vi.advanceTimersByTimeAsync(50000); // t=150
		expect(mocks.mapEngineInit).toHaveBeenCalledTimes(5);
	});

	it('depois da escalada esgotar, o intervalo fica FIXO em 60s (nunca cresce mais)', async () => {
		cair();
		await vi.advanceTimersByTimeAsync(10000); // t=10 (tentativa 1)
		mocks.mapEngineInit.mock.calls[0][3]();
		await vi.advanceTimersByTimeAsync(20000); // t=30 (2)
		mocks.mapEngineInit.mock.calls[1][3]();
		await vi.advanceTimersByTimeAsync(30000); // t=60 (3)
		mocks.mapEngineInit.mock.calls[2][3]();
		await vi.advanceTimersByTimeAsync(40000); // t=100 (4)
		mocks.mapEngineInit.mock.calls[3][3]();
		await vi.advanceTimersByTimeAsync(50000); // t=150 (5)
		mocks.mapEngineInit.mock.calls[4][3]();
		await vi.advanceTimersByTimeAsync(60000); // t=210 (6, primeiro no teto de 60s)
		expect(mocks.mapEngineInit).toHaveBeenCalledTimes(6);
		mocks.mapEngineInit.mock.calls[5][3]();

		await vi.advanceTimersByTimeAsync(59000);
		expect(mocks.mapEngineInit, 'o teto de 60s encolheu').toHaveBeenCalledTimes(6);
		await vi.advanceTimersByTimeAsync(1000); // t=270
		expect(mocks.mapEngineInit).toHaveBeenCalledTimes(7);
	});
});

describe('sucesso zera a escalada', () => {
	it('depois de reconectar, uma NOVA queda espera 10s de novo (nao continua a escalada antiga)', async () => {
		Reconexao.armar('127.0.0.1', 5121, 'prontera');
		cair();
		await vi.advanceTimersByTimeAsync(10000);
		mocks.mapEngineInit.mock.calls[0][3](); // falha
		await vi.advanceTimersByTimeAsync(20000); // t=30, tentativa 2

		Reconexao.aoEntrarComSucesso(); // a tentativa 2 "deu certo"
		await vi.advanceTimersByTimeAsync(0); // o aviso passa por um `import()` (microtask)

		expect(mocks.uiMostrar).toHaveBeenCalledWith(expect.objectContaining({ titulo: 'Reconectado' }));

		mocks.mapEngineInit.mockClear();
		cair(); // cai nooutra vez

		await vi.advanceTimersByTimeAsync(9000);
		expect(mocks.mapEngineInit, 'a segunda queda nao esperou os 10s inteiros de novo').not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1000);
		expect(mocks.mapEngineInit).toHaveBeenCalledTimes(1);
	});
});

describe('cancelar (logout voluntario)', () => {
	it('para a escalada de vez — nenhuma tentativa acontece depois', async () => {
		Reconexao.armar('127.0.0.1', 5121, 'prontera');
		cair();
		await vi.advanceTimersByTimeAsync(5000); // no meio da espera dos 10s

		Reconexao.cancelar();

		await vi.advanceTimersByTimeAsync(120000);
		expect(mocks.mapEngineInit, 'tentou reconectar depois de cancelar').not.toHaveBeenCalled();
		expect(mocks.network.onDisconnect, 'o gancho deveria ter sido desarmado').toBeNull();
	});
});

describe('sessao invalida (REFUSE_ENTER durante o ciclo)', () => {
	it('so age quando ha ciclo em curso, e conduz ao login depois de avisar', async () => {
		Reconexao.armar('127.0.0.1', 5121, 'prontera');

		// Fora de um ciclo: nao e' responsabilidade desta funcao.
		expect(Reconexao.aoSerRecusado()).toBe(false);
		expect(mocks.gameEngineReload).not.toHaveBeenCalled();

		cair();
		await vi.advanceTimersByTimeAsync(10000);
		mocks.mapEngineInit.mockClear();

		expect(Reconexao.aoSerRecusado()).toBe(true);
		await vi.advanceTimersByTimeAsync(0); // o aviso passa por um `import()` (microtask)
		expect(mocks.uiMostrar).toHaveBeenCalledWith(expect.objectContaining({ titulo: 'Sessão expirada' }));

		await vi.advanceTimersByTimeAsync(2500);
		expect(mocks.gameEngineReload).toHaveBeenCalledTimes(1);

		// E o ciclo morreu: nao ha tentativa fantasma depois disso.
		await vi.advanceTimersByTimeAsync(120000);
		expect(mocks.mapEngineInit).not.toHaveBeenCalled();
	});
});

describe('a ponte recusando por lotacao (codigo 1013) tem mensagem propria, mesma escalada', () => {
	it('mostra "Servidor cheio" em vez de "Conexão perdida", e ainda assim tenta em 10s', async () => {
		Reconexao.armar('127.0.0.1', 5121, 'prontera');
		cair({ code: 1013, reason: 'ponte no limite: teto total' });

		await vi.advanceTimersByTimeAsync(1000);
		expect(mocks.uiMostrar).toHaveBeenCalledWith(expect.objectContaining({ titulo: 'Servidor cheio' }));

		await vi.advanceTimersByTimeAsync(9000);
		expect(mocks.mapEngineInit).toHaveBeenCalledTimes(1);
	});

	it('qualquer outro fechamento mostra "Conexão perdida"', async () => {
		Reconexao.armar('127.0.0.1', 5121, 'prontera');
		cair({ code: 1006, reason: '' });

		await vi.advanceTimersByTimeAsync(1000);
		expect(mocks.uiMostrar).toHaveBeenCalledWith(expect.objectContaining({ titulo: 'Conexão perdida' }));
	});
});

describe('a tentativa pendurada', () => {
	it('o watchdog fecha o socket sozinho e a proxima tentativa acontece no horario JA agendado', async () => {
		Reconexao.armar('127.0.0.1', 5121, 'prontera');
		cair();
		await vi.advanceTimersByTimeAsync(10000); // tentativa 1 comeca
		const socket1 = mocks.mapEngineInit.mock.results[0].value;

		// NUNCA chama o callback de falha nem de sucesso — a tentativa fica pendurada.
		await vi.advanceTimersByTimeAsync(8000); // o teto da tentativa (8s)
		expect(socket1.close, 'o watchdog nao fechou o socket pendurado').toHaveBeenCalledTimes(1);

		// t=30 (10 + 20) e' o proximo horario JA agendado quando a tentativa 1
		// comecou — o watchdog nao empurrou nada para frente.
		await vi.advanceTimersByTimeAsync(12000); // 8s (ja passados) + 12s = 20s desde t=10
		expect(mocks.mapEngineInit).toHaveBeenCalledTimes(2);
	});
});

describe('um so ciclo — sem tentativa duplicada', () => {
	it('duas quedas seguidas (sem tentativa no meio) nao criam dois relogios', async () => {
		Reconexao.armar('127.0.0.1', 5121, 'prontera');
		cair();
		cair(); // uma segunda notificacao antes de qualquer tentativa comecar

		await vi.advanceTimersByTimeAsync(10000);
		expect(mocks.mapEngineInit, 'duas quedas viraram duas tentativas simultaneas').toHaveBeenCalledTimes(1);
	});
});
