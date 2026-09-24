/**
 * A CONEXAO QUE MORRE CALADA (lacuna 1 da auditoria da reconexao, 24/09/2026).
 *
 * Tres metades, e cada uma sozinha nao reconecta ninguem:
 *  1. a DECISAO pura (`conexaoMorreuEmSilencio`) e a vigia que sabe quando a
 *     pagina estava congelada (`criarVigiaDeSilencio`);
 *  2. o TRANSPORTE: `Network.derrubarPorSilencio()` tem de chegar ao
 *     `onDisconnect` — o `Network.close()` de sempre NAO chega, de proposito
 *     (e o que cala a reconexao no logout), e este teste prova a diferenca;
 *  3. a COSTURA no MapEngine: a vigia confere no relogio do keepalive, antes
 *     de mandar o keepalive.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	conexaoMorreuEmSilencio,
	criarVigiaDeSilencio,
	LIMITE_DE_SILENCIO_MS,
	LIMITE_APOS_DESPERTAR_MS
} from 'Network/vigiaDeSilencio.js';

vi.mock('Network/PacketVersions.js', () => ({ default: {} }));
vi.mock('Network/PacketRegister.js', () => ({ default: {} }));

const { default: Network } = await import('Network/NetworkManager.js');

describe('conexaoMorreuEmSilencio (a decisao pura)', () => {
	it('silencio abaixo do limite nao derruba; no limite, derruba', () => {
		expect(conexaoMorreuEmSilencio(1000, 1000 + 34999, 35000)).toBe(false);
		expect(conexaoMorreuEmSilencio(1000, 1000 + 35000, 35000)).toBe(true);
		expect(conexaoMorreuEmSilencio(1000, 1000 + 600000, 35000)).toBe(true);
	});

	it('sem nenhum pacote registrado (null) nunca derruba — a entrada que nao responde e do watchdog', () => {
		expect(conexaoMorreuEmSilencio(null, 10 ** 9, 35000)).toBe(false);
		expect(conexaoMorreuEmSilencio(undefined, 10 ** 9, 35000)).toBe(false);
		expect(conexaoMorreuEmSilencio(NaN, 10 ** 9, 35000)).toBe(false);
	});

	it('o limite padrao e de 35 s', () => {
		expect(LIMITE_DE_SILENCIO_MS).toBe(35000);
	});
});

describe('criarVigiaDeSilencio (a pagina acordada vs a pagina congelada)', () => {
	it('conferindo a cada 10 s sem pacote nenhum, derruba quando o silencio passa de 35 s', () => {
		const vigia = criarVigiaDeSilencio();
		const recebido = 0;
		expect(vigia.conferir(recebido, 10000)).toBe(false);
		expect(vigia.conferir(recebido, 20000)).toBe(false);
		expect(vigia.conferir(recebido, 30000)).toBe(false);
		expect(vigia.conferir(recebido, 40000)).toBe(true);
	});

	it('conexao viva (pacote chegando) nunca e derrubada', () => {
		const vigia = criarVigiaDeSilencio();
		for (let t = 10000; t <= 600000; t += 10000) {
			expect(vigia.conferir(t - 300, t), `derrubou uma conexao viva em t=${t}`).toBe(false);
		}
	});

	it('a VOLTA de um congelamento nao derruba na hora, mesmo com 20 min de silencio', () => {
		const vigia = criarVigiaDeSilencio();
		expect(vigia.conferir(9000, 10000)).toBe(false);
		// A pagina ficou congelada 20 minutos: a vigia nao rodou e nada foi recebido.
		const acordou = 10000 + 20 * 60 * 1000;
		expect(vigia.conferir(9000, acordou), 'derrubou no instante do despertar').toBe(false);
	});

	it('depois de acordar, se o pacote represado chega, a conexao segue viva', () => {
		const vigia = criarVigiaDeSilencio();
		vigia.conferir(9000, 10000);
		const acordou = 10000 + 20 * 60 * 1000;
		vigia.conferir(9000, acordou);
		expect(vigia.conferir(acordou + 500, acordou + 10000)).toBe(false);
		expect(vigia.conferir(acordou + 500, acordou + 20000)).toBe(false);
		expect(vigia.conferir(acordou + 500, acordou + 30000)).toBe(false);
		// E volta a regra normal: 35 s de silencio desde o ultimo pacote.
		expect(vigia.conferir(acordou + 500, acordou + 40000)).toBe(true);
	});

	it('depois de acordar SEM rede, derruba no prazo curto (~20 s), e nao em 35 s', () => {
		const vigia = criarVigiaDeSilencio();
		vigia.conferir(9000, 10000);
		const acordou = 10000 + 20 * 60 * 1000;
		expect(vigia.conferir(9000, acordou)).toBe(false);
		expect(vigia.conferir(9000, acordou + 10000)).toBe(false);
		expect(vigia.conferir(9000, acordou + 20000)).toBe(true);
		expect(LIMITE_APOS_DESPERTAR_MS).toBeLessThan(LIMITE_DE_SILENCIO_MS);
	});
});

describe('Network.derrubarPorSilencio (o transporte)', () => {
	let socketsCriados;

	function socketFalso() {
		return {
			connected: false,
			fechado: false,
			send() {},
			close() {
				this.fechado = true;
			}
		};
	}

	function conectar(isZone) {
		const socket = Network.connect('127.0.0.1', 5121, () => {}, isZone);
		socket.connected = true;
		socket.onComplete(true);
		return socket;
	}

	beforeEach(() => {
		socketsCriados = [];
		Network.setSocketFactory(() => {
			const s = socketFalso();
			socketsCriados.push(s);
			return s;
		});
		Network.onDisconnect = null;
	});

	afterEach(() => {
		Network.setSocketFactory(null);
		Network.onDisconnect = null;
		Network.close();
	});

	it('CONTROLE: o Network.close() de sempre NAO chama onDisconnect (e o que cala o logout)', () => {
		const quedas = [];
		conectar(true);
		Network.onDisconnect = info => quedas.push(info);
		Network.close();
		expect(quedas).toHaveLength(0);
	});

	it('derrubar o socket de mapa chama onDisconnect UMA vez e fecha o socket', () => {
		const quedas = [];
		const socket = conectar(true);
		Network.onDisconnect = info => quedas.push(info);

		expect(Network.derrubarPorSilencio()).toBe(true);
		expect(quedas).toHaveLength(1);
		expect(quedas[0]).toEqual({ code: null, reason: 'silencio' });
		expect(socket.fechado).toBe(true);

		// O `onclose` nativo que chegar depois nao pode notificar a queda de novo.
		if (socket.onClose) {
			socket.onClose();
		}
		expect(quedas, 'a mesma queda foi notificada duas vezes').toHaveLength(1);
	});

	it('depois de derrubar nao ha socket: derrubar de novo e no-op', () => {
		const quedas = [];
		conectar(true);
		Network.onDisconnect = info => quedas.push(info);
		Network.derrubarPorSilencio();
		expect(Network.derrubarPorSilencio()).toBe(false);
		expect(quedas).toHaveLength(1);
	});

	it('nao age fora do mapa (login e selecao de personagem)', () => {
		const quedas = [];
		const socket = conectar(false);
		Network.onDisconnect = info => quedas.push(info);
		expect(Network.derrubarPorSilencio()).toBe(false);
		expect(quedas).toHaveLength(0);
		expect(socket.fechado).toBe(false);
	});

	it('o connect bem-sucedido carimba a hora, e o socket novo nao herda o silencio do anterior', () => {
		vi.useFakeTimers();
		try {
			vi.setSystemTime(123456);
			conectar(true);
			expect(Network.ultimoRecebidoEm).toBe(123456);
		} finally {
			vi.useRealTimers();
		}
	});

	it('todo pacote recebido carimba a hora', () => {
		vi.useFakeTimers();
		try {
			vi.setSystemTime(1000);
			const socket = conectar(true);
			vi.setSystemTime(50000);
			socket.onMessage(new ArrayBuffer(0));
			expect(Network.ultimoRecebidoEm).toBe(50000);
		} finally {
			vi.useRealTimers();
		}
	});
});

describe('a costura no MapEngine', () => {
	const fonte = readFileSync(join(process.cwd(), 'src/Engine/MapEngine.js'), 'utf8');

	it('a vigia confere no corpo do keepalive, ANTES de o keepalive sair', () => {
		const inicio = fonte.indexOf('const sendKeepAlive = () => {');
		expect(inicio, 'sendKeepAlive sumiu do MapEngine').toBeGreaterThan(-1);
		const corpo = fonte.slice(inicio, fonte.indexOf('Network.setPing(sendKeepAlive)', inicio));
		const conferencia = corpo.indexOf('vigiaDeSilencio.conferir(Network.ultimoRecebidoEm');
		const derrubada = corpo.indexOf('Network.derrubarPorSilencio()');
		const envio = corpo.indexOf('Network.sendPacket(ping)');
		expect(conferencia).toBeGreaterThan(-1);
		expect(derrubada).toBeGreaterThan(conferencia);
		expect(envio).toBeGreaterThan(derrubada);
	});

	it('uma vigia NOVA por conexao de mapa (criada junto do keepalive)', () => {
		const criacao = fonte.indexOf('const vigiaDeSilencio = criarVigiaDeSilencio()');
		const keepalive = fonte.indexOf('const sendKeepAlive = () => {');
		expect(criacao).toBeGreaterThan(-1);
		expect(criacao).toBeLessThan(keepalive);
		// O mesmo relogio que sobrevive a aba escondida e dispara na volta da aba.
		expect(fonte).toContain('BackgroundTicker.start(sendKeepAlive)');
	});
});
