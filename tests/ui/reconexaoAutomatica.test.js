/**
 * A ESCALADA DA RECONEXAO AUTOMATICA (R12, 14/09/2026) — `Network/reconexao.js`.
 *
 * A interpretacao operacional do pedido do dono: esperar 10s pela primeira
 * tentativa; falhas seguintes usam intervalos ENTRE OS INICIOS de 20, 30,
 * 30s fixo desde 16/09/2026 (t aproximado: 10, 30, 60, 90, 120, 150).
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
// A volta de uma queda confere a versao por um `import()` que ninguem espera
// (reconexao.js). Sem o mock ele puxa o grafo da UI inteira e, sob a carga da
// suite cheia, termina depois do fim do ambiente (EnvironmentTeardownError).
vi.mock('UI/atualizacaoAutomatica.js', () => ({ conferirVersaoAgora: () => {} }));
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

describe('a escalada — t aproximado 10, 30, 60, 90, 120, 150...', () => {
	beforeEach(() => {
		Reconexao.armar('127.0.0.1', 5121, 'prontera');
	});

	it('a primeira tentativa so' + ' acontece depois de 10s, nunca antes', async () => {
		cair();

		await vi.advanceTimersByTimeAsync(9000);
		expect(mocks.mapEngineInit, 'tentou antes dos 10s').not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1000);
		expect(mocks.mapEngineInit).toHaveBeenCalledTimes(1);
		// D-2576: a tentativa avisa o MapEngine que e a VOLTA do mesmo personagem.
		expect(mocks.mapEngineInit).toHaveBeenCalledWith('127.0.0.1', 5121, 'prontera', expect.any(Function), { volta: true });
	});

	it('falhas sucessivas respeitam 20/30/30/30s entre os INICIOS (t=10,30,60,90,120)', async () => {
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
		await vi.advanceTimersByTimeAsync(29000);
		expect(mocks.mapEngineInit, 'o teto de 30s encolheu').toHaveBeenCalledTimes(3);
		await vi.advanceTimersByTimeAsync(1000); // t=90
		expect(mocks.mapEngineInit).toHaveBeenCalledTimes(4);

		mocks.mapEngineInit.mock.calls[3][3]();
		await vi.advanceTimersByTimeAsync(30000); // t=120
		expect(mocks.mapEngineInit).toHaveBeenCalledTimes(5);
	});

	it('depois da escalada esgotar, o intervalo fica FIXO em 30s (nunca cresce mais)', async () => {
		cair();
		await vi.advanceTimersByTimeAsync(10000); // t=10 (tentativa 1)
		mocks.mapEngineInit.mock.calls[0][3]();
		await vi.advanceTimersByTimeAsync(20000); // t=30 (2)
		mocks.mapEngineInit.mock.calls[1][3]();
		await vi.advanceTimersByTimeAsync(30000); // t=60 (3, primeiro no teto de 30s)
		mocks.mapEngineInit.mock.calls[2][3]();
		await vi.advanceTimersByTimeAsync(30000); // t=90 (4)
		mocks.mapEngineInit.mock.calls[3][3]();
		await vi.advanceTimersByTimeAsync(30000); // t=120 (5)
		expect(mocks.mapEngineInit).toHaveBeenCalledTimes(5);
		mocks.mapEngineInit.mock.calls[4][3]();

		// O pedido do dono (16/09/2026): nunca mais que 30s entre tentativas.
		await vi.advanceTimersByTimeAsync(29000);
		expect(mocks.mapEngineInit, 'o intervalo passou de 30s').toHaveBeenCalledTimes(5);
		await vi.advanceTimersByTimeAsync(1000); // t=150
		expect(mocks.mapEngineInit).toHaveBeenCalledTimes(6);
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

describe('cancelarParaFechamentoDeliberado (o "Acordar agora", F09 da auditoria de 22/09)', () => {
	it('para a escalada E deixa um gancho que nao faz nada — sem ele a caixa "Disconnected" abre', async () => {
		Reconexao.armar('127.0.0.1', 5121, 'prontera');

		Reconexao.cancelarParaFechamentoDeliberado();

		// `null` faz o NetworkManager.onClose mostrar "Disconnected from Server.":
		// o gancho tem de EXISTIR, e ser um no-op.
		expect(typeof mocks.network.onDisconnect, 'o gancho ficou null e a caixa inglesa abre').toBe('function');
		cair();
		await vi.advanceTimersByTimeAsync(120000);
		expect(mocks.mapEngineInit, 'o fechamento deliberado virou tentativa de reconexao').not.toHaveBeenCalled();
		expect(mocks.gameEngineReload).not.toHaveBeenCalled();
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

	it('depois de desistir, o gancho e um NO-OP (nao `null`) — o fechamento seguinte nao abre caixa nem ciclo', async () => {
		Reconexao.armar('127.0.0.1', 5121, 'prontera');
		cair();
		await vi.advanceTimersByTimeAsync(10000);
		expect(Reconexao.aoSerRecusado()).toBe(true);
		// `null` faria o NetworkManager mostrar "Disconnected from Server." no
		// fechamento que o servidor faz logo depois da recusa (16/09/2026).
		expect(mocks.network.onDisconnect).toBeTypeOf('function');
		mocks.mapEngineInit.mockClear();
		mocks.network.onDisconnect({ code: 1006, reason: '' });
		await vi.advanceTimersByTimeAsync(60000);
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

/**
 * A RECONEXAO NAO DESISTE (D-2575, 15/10/2026). De 16/09 a 15/10 havia um teto
 * de 12 tentativas e depois o login; ele nasceu quando a recusa do servidor era
 * muda. Desde D-1520 a recusa fala (`SC_NOTIFY_BAN` 0 -> `aoSerRecusado`, coberta
 * em "sessao invalida" acima), e o dono pediu que a volta do segundo plano nunca
 * passe pela tela de login enquanto o servidor aceitar. O teto saiu.
 *
 * O CONTROLE e o caso "sessao invalida" deste arquivo: a recusa continua levando
 * ao login, na primeira tentativa recusada.
 */
describe('a reconexao nao desiste (D-2575)', () => {
	beforeEach(() => {
		Reconexao.armar('127.0.0.1', 5121, 'prontera');
	});

	it('100 tentativas falhas (quase uma hora sem servidor) e nenhuma ida ao login', async () => {
		cair();
		await vi.advanceTimersByTimeAsync(10000);
		for (let i = 0; i < 100; i++) {
			expect(mocks.mapEngineInit, 'a tentativa ' + (i + 1) + ' nao aconteceu').toHaveBeenCalledTimes(i + 1);
			mocks.mapEngineInit.mock.calls[i][3]();
			await vi.advanceTimersByTimeAsync(i === 0 ? 20000 : 30000);
		}
		expect(mocks.gameEngineReload, 'desistiu e mandou ao login sem recusa do servidor').not.toHaveBeenCalled();
		expect(mocks.uiMostrar).not.toHaveBeenCalledWith(expect.objectContaining({ titulo: 'Sessão expirada' }));
		// E o intervalo segue no teto do dono (30 s), sem crescer.
		expect(mocks.mapEngineInit).toHaveBeenCalledTimes(101);
	});

	it('a recusa, mesmo depois de muitas tentativas, ainda leva ao login', async () => {
		cair();
		await vi.advanceTimersByTimeAsync(10000);
		for (let i = 0; i < 30; i++) {
			mocks.mapEngineInit.mock.calls[i][3]();
			await vi.advanceTimersByTimeAsync(30000);
		}
		expect(Reconexao.aoSerRecusado()).toBe(true);
		await vi.advanceTimersByTimeAsync(2500);
		expect(mocks.gameEngineReload).toHaveBeenCalledTimes(1);
	});
});
