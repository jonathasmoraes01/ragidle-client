/**
 * A VOLTA DO SEGUNDO PLANO E INVISIVEL (D-2575, 15/10/2026) — `Network/reconexao.js`.
 *
 * O dono: *"a reconexao por baixo e inevitavel (o navegador corta), mas o
 * jogador nao pode VE-LA"*. A queda que comeca com a aba escondida (ou logo
 * depois de ela voltar) e a do alt-tab: na volta a tentativa sai NA HORA, o aviso
 * "Conexao perdida" fica calado por `PRAZO_DISCRETO_MS`, e o "Reconectado" nao
 * aparece. Se o servidor estiver fora de verdade, o aviso de sempre volta depois
 * do prazo.
 *
 * Cada comportamento tem o CONTROLE ao lado: a queda comum, com o jogador olhando
 * o jogo, continua com a espera de 10 s, o aviso e o "Reconectado".
 *
 * Mesmo molde de `reconexaoAutomatica.test.js` (mocks e `Math.random` em 0).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	network: { onDisconnect: null },
	mapEngineInit: vi.fn(),
	servidorAtual: null,
	gameEngineReload: vi.fn(),
	uiMostrar: vi.fn(),
	uiEsconder: vi.fn()
}));

vi.mock('Network/NetworkManager.js', () => ({ default: mocks.network }));
vi.mock('Engine/MapEngine.js', () => ({
	default: {
		init: (...args) => mocks.mapEngineInit(...args),
		get servidorAtual() {
			return mocks.servidorAtual;
		}
	}
}));
vi.mock('Engine/GameEngine.js', () => ({ default: { reload: (...args) => mocks.gameEngineReload(...args) } }));
vi.mock('UI/atualizacaoAutomatica.js', () => ({ conferirVersaoAgora: () => {} }));
vi.mock('UI/Components/Reconexao/Reconexao.js', () => ({
	default: {
		mostrar: (...args) => mocks.uiMostrar(...args),
		esconder: (...args) => mocks.uiEsconder(...args)
	}
}));

let Reconexao;
let modulo;
let visibilidade;

function aba(estado) {
	visibilidade = estado;
	document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(async () => {
	vi.useFakeTimers();
	vi.setSystemTime(1_000_000);
	vi.spyOn(Math, 'random').mockReturnValue(0);
	visibilidade = 'visible';
	vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => true);
	vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibilidade);

	mocks.network.onDisconnect = null;
	mocks.servidorAtual = null;
	mocks.mapEngineInit.mockReset().mockImplementation(() => ({ close: vi.fn() }));
	mocks.gameEngineReload.mockReset();
	mocks.uiMostrar.mockReset();
	mocks.uiEsconder.mockReset();

	vi.resetModules();
	modulo = await import('Network/reconexao.js');
	Reconexao = modulo.default;
	Reconexao.armar('127.0.0.1', 5121, 'prontera.gat');
});

afterEach(() => {
	Reconexao.cancelar();
	vi.useRealTimers();
	vi.restoreAllMocks();
});

function cair() {
	mocks.network.onDisconnect({ code: 1006, reason: '' });
}

/** Os avisos que o jogador VIU (os `mostrar`), por titulo. */
function titulosVistos() {
	return mocks.uiMostrar.mock.calls.map(c => c[0].titulo);
}

describe('as decisoes puras', () => {
	it('ehVoltaDoFundo: escondida sempre; visivel so dentro da janela depois da volta', () => {
		const { ehVoltaDoFundo, JANELA_DA_VOLTA_MS } = modulo;
		expect(ehVoltaDoFundo({ visivel: false, agora: 0, voltouEm: null })).toBe(true);
		expect(ehVoltaDoFundo({ visivel: true, agora: 100, voltouEm: null })).toBe(false);
		expect(ehVoltaDoFundo({ visivel: true, agora: 100 + JANELA_DA_VOLTA_MS, voltouEm: 100 })).toBe(true);
		expect(ehVoltaDoFundo({ visivel: true, agora: 101 + JANELA_DA_VOLTA_MS, voltouEm: 100 })).toBe(false);
		expect(ehVoltaDoFundo(null)).toBe(false);
	});

	it('discretoAte: 0 fora da volta; Infinity escondida; o prazo visivel', () => {
		const { discretoAte, PRAZO_DISCRETO_MS } = modulo;
		expect(discretoAte({ voltaDoFundo: false, visivel: true, agora: 5 })).toBe(0);
		expect(discretoAte({ voltaDoFundo: true, visivel: false, agora: 5 })).toBe(Infinity);
		expect(discretoAte({ voltaDoFundo: true, visivel: true, agora: 5 })).toBe(5 + PRAZO_DISCRETO_MS);
	});

	it('avisoVisivel: so a partir do instante do prazo', () => {
		const { avisoVisivel } = modulo;
		expect(avisoVisivel(9, 10)).toBe(false);
		expect(avisoVisivel(10, 10)).toBe(true);
		expect(avisoVisivel(0, 0)).toBe(true);
		expect(avisoVisivel(Number.MAX_SAFE_INTEGER, Infinity)).toBe(false);
	});

	it('esperaDaPrimeiraTentativa: na hora so a volta VISIVEL; o resto espera o degrau e o jitter', () => {
		const { esperaDaPrimeiraTentativa } = modulo;
		const base = { primeiroDegrauMs: 10000, jitterMs: 700 };
		expect(esperaDaPrimeiraTentativa({ ...base, voltaDoFundo: true, visivel: true })).toBe(0);
		expect(esperaDaPrimeiraTentativa({ ...base, voltaDoFundo: true, visivel: false })).toBe(10700);
		expect(esperaDaPrimeiraTentativa({ ...base, voltaDoFundo: false, visivel: true })).toBe(10700);
	});

	it('enderecoDaTentativa: o mapa de AGORA quando o servidor e o mesmo; o guardado quando nao', () => {
		const { enderecoDaTentativa } = modulo;
		const guardado = { ip: 1, port: 5121, mapName: 'prontera.gat' };
		expect(enderecoDaTentativa(guardado, { ip: 1, port: 5121, mapName: 'prt_fild08.gat' })).toEqual({
			ip: 1,
			port: 5121,
			mapName: 'prt_fild08.gat'
		});
		expect(enderecoDaTentativa(guardado, { ip: 1, port: 5122, mapName: 'prt_fild08.gat' })).toBe(guardado);
		expect(enderecoDaTentativa(guardado, { ip: 2, port: 5121, mapName: 'prt_fild08.gat' })).toBe(guardado);
		expect(enderecoDaTentativa(guardado, { ip: 1, port: 5121, mapName: '' })).toBe(guardado);
		expect(enderecoDaTentativa(guardado, null)).toBe(guardado);
		expect(enderecoDaTentativa(null, null)).toBeNull();
	});
});

describe('a queda com a aba ESCONDIDA', () => {
	it('enquanto escondida o aviso nunca aparece; a volta tenta NA HORA e fecha sem "Reconectado"', async () => {
		aba('hidden');
		cair();
		await vi.advanceTimersByTimeAsync(5000);
		expect(titulosVistos(), 'o aviso apareceu com a aba escondida').toEqual([]);

		aba('visible');
		await vi.advanceTimersByTimeAsync(0);
		expect(mocks.mapEngineInit, 'a volta da aba nao tentou na hora').toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(800); // o socket novo abre e o servidor aceita
		Reconexao.aoEntrarComSucesso();
		await vi.advanceTimersByTimeAsync(5000);
		expect(titulosVistos(), 'o jogador viu a reconexao').toEqual([]);
		expect(mocks.gameEngineReload).not.toHaveBeenCalled();
	});

	it('a tentativa que ja tinha saido escondida e deu certo: a volta nao ve nada', async () => {
		aba('hidden');
		cair();
		await vi.advanceTimersByTimeAsync(10000);
		expect(mocks.mapEngineInit).toHaveBeenCalledTimes(1);
		Reconexao.aoEntrarComSucesso();
		aba('visible');
		await vi.advanceTimersByTimeAsync(5000);
		expect(titulosVistos()).toEqual([]);
	});

	it('o servidor fora de verdade: o aviso volta DEPOIS do prazo discreto, com a contagem', async () => {
		const { PRAZO_DISCRETO_MS } = modulo;
		aba('hidden');
		cair();
		await vi.advanceTimersByTimeAsync(3000);
		aba('visible');
		await vi.advanceTimersByTimeAsync(0);
		expect(mocks.mapEngineInit).toHaveBeenCalledTimes(1);
		mocks.mapEngineInit.mock.calls[0][3](); // a tentativa da volta falha

		await vi.advanceTimersByTimeAsync(PRAZO_DISCRETO_MS - 1500);
		expect(titulosVistos(), 'mostrou antes do prazo').toEqual([]);
		await vi.advanceTimersByTimeAsync(2000);
		expect(titulosVistos()).toContain('Conexão perdida');
		const ultimo = mocks.uiMostrar.mock.calls.at(-1)[0];
		expect(Number.isFinite(ultimo.segundos), 'o aviso de depois do prazo nao traz a contagem').toBe(true);
	});

	it('o aviso que ja estava na tela antes de esconder sai na volta', async () => {
		cair(); // a queda comum, com o jogador olhando
		await vi.advanceTimersByTimeAsync(3000);
		expect(titulosVistos()).toContain('Conexão perdida');
		aba('hidden');
		await vi.advanceTimersByTimeAsync(2000);
		mocks.uiEsconder.mockClear();
		aba('visible');
		await vi.advanceTimersByTimeAsync(0);
		expect(mocks.uiEsconder, 'o aviso velho ficou por cima da volta').toHaveBeenCalled();
	});
});

describe('a queda LOGO DEPOIS de a aba voltar (a vigia de silencio)', () => {
	it('dentro da janela, tenta na hora e nao mostra nada', async () => {
		aba('hidden');
		await vi.advanceTimersByTimeAsync(60000);
		aba('visible');
		await vi.advanceTimersByTimeAsync(12000); // a vigia prova o socket morto
		cair();
		await vi.advanceTimersByTimeAsync(0);
		expect(mocks.mapEngineInit, 'esperou o degrau de 10 s numa volta').toHaveBeenCalledTimes(1);
		Reconexao.aoEntrarComSucesso();
		await vi.advanceTimersByTimeAsync(3000);
		expect(titulosVistos()).toEqual([]);
	});

	it('CONTROLE: fora da janela, e a queda comum (10 s, aviso e "Reconectado")', async () => {
		const { JANELA_DA_VOLTA_MS } = modulo;
		aba('hidden');
		aba('visible');
		await vi.advanceTimersByTimeAsync(JANELA_DA_VOLTA_MS + 1);
		cair();
		await vi.advanceTimersByTimeAsync(9000);
		expect(mocks.mapEngineInit).not.toHaveBeenCalled();
		expect(titulosVistos()).toContain('Conexão perdida');
		await vi.advanceTimersByTimeAsync(1000);
		expect(mocks.mapEngineInit).toHaveBeenCalledTimes(1);
		Reconexao.aoEntrarComSucesso();
		await vi.advanceTimersByTimeAsync(0);
		expect(titulosVistos()).toContain('Reconectado');
	});
});

describe('a queda comum, com o jogador olhando (CONTROLE)', () => {
	it('espera 10 s, mostra o aviso e o "Reconectado"', async () => {
		cair();
		await vi.advanceTimersByTimeAsync(1500);
		expect(titulosVistos()).toContain('Conexão perdida');
		await vi.advanceTimersByTimeAsync(8500);
		expect(mocks.mapEngineInit).toHaveBeenCalledTimes(1);
		Reconexao.aoEntrarComSucesso();
		await vi.advanceTimersByTimeAsync(0);
		expect(titulosVistos()).toContain('Reconectado');
	});
});

describe('a tentativa reentra no mapa de AGORA', () => {
	it('usa o `servidorAtual` do MapEngine (a viagem por menu na mesma conexao)', async () => {
		mocks.servidorAtual = { ip: '127.0.0.1', port: 5121, mapName: 'prt_fild08.gat' };
		aba('hidden');
		cair();
		aba('visible');
		await vi.advanceTimersByTimeAsync(0);
		expect(mocks.mapEngineInit).toHaveBeenCalledWith('127.0.0.1', 5121, 'prt_fild08.gat', expect.any(Function), {
			volta: true
		});
	});
});
