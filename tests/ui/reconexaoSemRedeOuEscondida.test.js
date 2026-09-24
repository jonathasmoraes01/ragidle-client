/**
 * SO CONTA PARA O TETO A TENTATIVA QUE PODIA DAR CERTO, E A VOLTA DA REDE
 * TENTA NA HORA (lacuna 5 da auditoria da reconexao, 24/09/2026) —
 * `Network/reconexao.js`.
 *
 * O defeito: as 12 tentativas antes de mandar ao login contavam tambem as
 * feitas sem rede ou com a aba escondida. Quem fechava o notebook no metro
 * voltava ao LOGIN com o servidor ainda segurando o personagem (economia de
 * energia, 4 h). E o evento `online` nunca era ouvido: a rede voltava e o
 * jogador esperava ate 30 s pela proxima tentativa agendada.
 *
 * Mesmo molde de `reconexaoAutomatica.test.js` (mocks e `Math.random` em 0).
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
vi.mock('UI/atualizacaoAutomatica.js', () => ({ conferirVersaoAgora: () => {} }));
vi.mock('UI/Components/Reconexao/Reconexao.js', () => ({
	default: {
		mostrar: (...args) => mocks.uiMostrar(...args),
		esconder: (...args) => mocks.uiEsconder(...args)
	}
}));

let Reconexao;
let tentativaConta;
let deveTentarAgoraNaVolta;
let online;
let visibilidade;

function definirAmbiente({ rede, aba }) {
	online = rede;
	visibilidade = aba;
}

beforeEach(async () => {
	vi.useFakeTimers();
	vi.setSystemTime(0);
	vi.spyOn(Math, 'random').mockReturnValue(0);
	definirAmbiente({ rede: true, aba: 'visible' });
	vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
	vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibilidade);

	mocks.network.onDisconnect = null;
	mocks.mapEngineInit.mockReset().mockImplementation(() => ({ close: vi.fn() }));
	mocks.gameEngineReload.mockReset();
	mocks.uiMostrar.mockReset();
	mocks.uiEsconder.mockReset();

	vi.resetModules();
	({ default: Reconexao, tentativaConta, deveTentarAgoraNaVolta } = await import('Network/reconexao.js'));
});

afterEach(() => {
	// Encerra o ciclo para os ouvintes de `online`/`visibilitychange` sairem
	// do `window` antes do proximo teste importar um modulo novo.
	Reconexao.cancelar();
	vi.useRealTimers();
	vi.restoreAllMocks();
});

/** Faz a tentativa em voo falhar, como o socket que cai. */
function falharTentativa() {
	mocks.network.onDisconnect({ code: 1006, reason: '' });
}

/** Anda o relogio ate a PROXIMA tentativa sair (ou 60 s), e a faz falhar. */
async function proximaTentativaFalha() {
	const antes = mocks.mapEngineInit.mock.calls.length;
	for (let i = 0; i < 60 && mocks.mapEngineInit.mock.calls.length === antes; i++) {
		await vi.advanceTimersByTimeAsync(1000);
	}
	if (mocks.mapEngineInit.mock.calls.length > antes) {
		falharTentativa();
		return true;
	}
	return false;
}

describe('as decisoes puras', () => {
	it('tentativaConta: so com rede E aba visivel', () => {
		expect(tentativaConta({ online: true, visivel: true })).toBe(true);
		expect(tentativaConta({ online: false, visivel: true })).toBe(false);
		expect(tentativaConta({ online: true, visivel: false })).toBe(false);
		expect(tentativaConta({ online: false, visivel: false })).toBe(false);
		expect(tentativaConta(null)).toBe(false);
	});

	it('deveTentarAgoraNaVolta: so dentro de um ciclo e sem tentativa em voo', () => {
		expect(deveTentarAgoraNaVolta({ emCiclo: true, tentativaEmAndamento: false })).toBe(true);
		expect(deveTentarAgoraNaVolta({ emCiclo: true, tentativaEmAndamento: true })).toBe(false);
		expect(deveTentarAgoraNaVolta({ emCiclo: false, tentativaEmAndamento: false })).toBe(false);
		expect(deveTentarAgoraNaVolta(null)).toBe(false);
	});
});

describe('o teto de desistencia', () => {
	beforeEach(() => {
		Reconexao.armar('127.0.0.1', 5121, 'prontera');
	});

	it('CONTROLE: com rede e aba visivel, desiste depois de 12 tentativas', async () => {
		mocks.network.onDisconnect();
		for (let i = 0; i < 13; i++) {
			await proximaTentativaFalha();
		}
		await vi.advanceTimersByTimeAsync(5000);
		expect(mocks.mapEngineInit).toHaveBeenCalledTimes(12);
		expect(mocks.gameEngineReload).toHaveBeenCalledTimes(1);
	});

	it('SEM REDE, as tentativas saem mas nao gastam o teto — ninguem vai ao login', async () => {
		definirAmbiente({ rede: false, aba: 'visible' });
		mocks.network.onDisconnect();
		for (let i = 0; i < 30; i++) {
			await proximaTentativaFalha();
		}
		expect(mocks.mapEngineInit.mock.calls.length).toBeGreaterThan(12);
		expect(mocks.gameEngineReload, 'desistiu contando tentativas sem rede').not.toHaveBeenCalled();
	});

	it('com a ABA ESCONDIDA, as tentativas nao gastam o teto', async () => {
		definirAmbiente({ rede: true, aba: 'hidden' });
		mocks.network.onDisconnect();
		for (let i = 0; i < 30; i++) {
			await proximaTentativaFalha();
		}
		expect(mocks.gameEngineReload, 'desistiu contando tentativas com a aba escondida').not.toHaveBeenCalled();
	});
});

describe('a volta da rede ou da aba', () => {
	beforeEach(() => {
		Reconexao.armar('127.0.0.1', 5121, 'prontera');
	});

	it('o evento `online` durante o ciclo tenta NA HORA, sem esperar a agenda', async () => {
		definirAmbiente({ rede: false, aba: 'visible' });
		mocks.network.onDisconnect();
		await vi.advanceTimersByTimeAsync(2000);
		expect(mocks.mapEngineInit).not.toHaveBeenCalled();

		definirAmbiente({ rede: true, aba: 'visible' });
		window.dispatchEvent(new Event('online'));
		await vi.advanceTimersByTimeAsync(0);
		expect(mocks.mapEngineInit).toHaveBeenCalledTimes(1);
	});

	it('a aba que VOLTA durante o ciclo tenta na hora; a que ESCONDE, nao', async () => {
		mocks.network.onDisconnect();
		await vi.advanceTimersByTimeAsync(2000);

		definirAmbiente({ rede: true, aba: 'hidden' });
		document.dispatchEvent(new Event('visibilitychange'));
		await vi.advanceTimersByTimeAsync(0);
		expect(mocks.mapEngineInit, 'esconder a aba disparou tentativa').not.toHaveBeenCalled();

		definirAmbiente({ rede: true, aba: 'visible' });
		document.dispatchEvent(new Event('visibilitychange'));
		await vi.advanceTimersByTimeAsync(0);
		expect(mocks.mapEngineInit).toHaveBeenCalledTimes(1);
	});

	it('`online` e `visibilitychange` JUNTOS abrem UMA tentativa so', async () => {
		mocks.network.onDisconnect();
		await vi.advanceTimersByTimeAsync(2000);

		window.dispatchEvent(new Event('online'));
		document.dispatchEvent(new Event('visibilitychange'));
		window.dispatchEvent(new Event('online'));
		await vi.advanceTimersByTimeAsync(0);
		expect(mocks.mapEngineInit).toHaveBeenCalledTimes(1);
	});

	it('a volta ZERA o teto: 11 tentativas contadas, a rede volta, e ainda cabem mais 12', async () => {
		mocks.network.onDisconnect();
		for (let i = 0; i < 11; i++) {
			await proximaTentativaFalha();
		}
		expect(mocks.mapEngineInit).toHaveBeenCalledTimes(11);

		window.dispatchEvent(new Event('online'));
		await vi.advanceTimersByTimeAsync(0);
		expect(mocks.mapEngineInit).toHaveBeenCalledTimes(12);
		falharTentativa();

		for (let i = 0; i < 11; i++) {
			await proximaTentativaFalha();
		}
		await vi.advanceTimersByTimeAsync(5000);
		expect(mocks.mapEngineInit).toHaveBeenCalledTimes(23);
		expect(mocks.gameEngineReload, 'a volta da rede nao zerou o teto').not.toHaveBeenCalled();
	});

	it('fora de um ciclo, `online` e a volta da aba nao abrem tentativa nenhuma', async () => {
		window.dispatchEvent(new Event('online'));
		document.dispatchEvent(new Event('visibilitychange'));
		await vi.advanceTimersByTimeAsync(60000);
		expect(mocks.mapEngineInit).not.toHaveBeenCalled();
	});

	it('os ouvintes so existem DENTRO do ciclo (ligados na queda, desligados no sucesso)', async () => {
		const ligados = vi.spyOn(window, 'addEventListener');
		const desligados = vi.spyOn(window, 'removeEventListener');
		mocks.network.onDisconnect();
		expect(ligados.mock.calls.filter(c => c[0] === 'online')).toHaveLength(1);
		Reconexao.aoEntrarComSucesso();
		expect(desligados.mock.calls.filter(c => c[0] === 'online')).toHaveLength(1);
		expect(desligados.mock.calls[0][1]).toBe(ligados.mock.calls.find(c => c[0] === 'online')[1]);
	});

	it('depois do sucesso, os ouvintes saem: a volta da rede nao reabre ciclo', async () => {
		mocks.network.onDisconnect();
		await vi.advanceTimersByTimeAsync(10000);
		expect(mocks.mapEngineInit).toHaveBeenCalledTimes(1);
		Reconexao.aoEntrarComSucesso();

		window.dispatchEvent(new Event('online'));
		await vi.advanceTimersByTimeAsync(60000);
		expect(mocks.mapEngineInit).toHaveBeenCalledTimes(1);
	});
});
