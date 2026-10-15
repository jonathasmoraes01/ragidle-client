/**
 * O KEEPALIVE EM DOBRO (auditoria de desempenho de 15/10/2026).
 *
 * O `setInterval` de `Network.setPing` e o Worker do `BackgroundTicker` chamam
 * o MESMO `sendKeepAlive` a cada 10 s. Saiam dois `CZ_REQUEST_TIME2` por
 * janela, e o segundo sobrescrevia o carimbo do medidor de ping. Tres metades:
 *  1. o freio puro (`criarFreioDoKeepAlive`): duas fontes dentro da janela
 *     geram UM envio, o forcado passa sempre, e o intervalo entre envios nunca
 *     passa dos ~10 s (a ressincronia do servidor e > 15 s);
 *  2. o `BackgroundTicker` marca a volta da aba como forcada;
 *  3. a costura no MapEngine: o freio fica entre a vigia e o envio.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	criarFreioDoKeepAlive,
	INTERVALO_MINIMO_DO_KEEPALIVE_MS,
	tiqueForcado
} from 'Network/freioDoKeepAlive.js';
import { criarMedidorDePing } from 'Network/medidorDePing.js';

/** Simula as duas fontes de 10 s com uma defasagem e conta os envios. */
function simularDuasFontes({ defasagemMs, duracaoMs, comFreio }) {
	const freio = criarFreioDoKeepAlive();
	const eventos = [];
	for (let t = 10000; t <= duracaoMs; t += 10000) {
		eventos.push(t); // o setInterval do setPing
		eventos.push(t + defasagemMs); // o Worker do BackgroundTicker
	}
	eventos.sort((a, b) => a - b);
	const envios = [];
	for (const t of eventos) {
		if (!comFreio || freio.deveEnviar(t, false)) {
			envios.push(t);
		}
	}
	return envios;
}

describe('o freio do keepalive (a decisao pura)', () => {
	it('duas fontes chamando dentro de 10 s geram UM envio', () => {
		const freio = criarFreioDoKeepAlive();
		expect(freio.deveEnviar(10000, false)).toBe(true);
		expect(freio.deveEnviar(10000 + 300, false)).toBe(false);
		expect(freio.deveEnviar(10000 + 7999, false)).toBe(false);
		expect(freio.deveEnviar(10000 + INTERVALO_MINIMO_DO_KEEPALIVE_MS, false)).toBe(true);
	});

	it('o envio forcado (a volta da aba) passa sempre, e carimba', () => {
		const freio = criarFreioDoKeepAlive();
		expect(freio.deveEnviar(1000, false)).toBe(true);
		expect(freio.deveEnviar(1100, true)).toBe(true);
		// o carimbo do forcado vale para o proximo periodico
		expect(freio.deveEnviar(1100 + 5000, false)).toBe(false);
	});

	it('relogio que volta para tras nunca prende o keepalive', () => {
		const freio = criarFreioDoKeepAlive();
		expect(freio.deveEnviar(50000, false)).toBe(true);
		expect(freio.deveEnviar(40000, false)).toBe(true);
	});

	it('com qualquer defasagem entre as fontes: ~metade dos envios e nenhum intervalo acima de 10 s', () => {
		for (const defasagemMs of [0, 1, 500, 3000, 5000, 7999, 8000, 9500, 9999]) {
			const sem = simularDuasFontes({ defasagemMs, duracaoMs: 600000, comFreio: false });
			const com = simularDuasFontes({ defasagemMs, duracaoMs: 600000, comFreio: true });
			expect(sem.length).toBe(120);
			// 60 por padrao; com a defasagem >= 8 s o primeiro par passa inteiro
			// (os dois envios estao a 8 s ou mais), e dali em diante segue um so
			expect(com.length).toBeGreaterThanOrEqual(60);
			expect(com.length).toBeLessThanOrEqual(61);
			for (let i = 1; i < com.length; i++) {
				const intervalo = com[i] - com[i - 1];
				expect(intervalo).toBeGreaterThanOrEqual(INTERVALO_MINIMO_DO_KEEPALIVE_MS);
				// a ressincronia do servidor e com lacuna > 15 s
				expect(intervalo).toBeLessThanOrEqual(10000 + 9999);
				expect(intervalo).toBeLessThan(15000);
			}
		}
	});

	it('o motivo: com o envio em dobro o medidor mede contra o carimbo errado', () => {
		const medidor = criarMedidorDePing();
		// RTT real de 200 ms; a segunda fonte manda 150 ms depois da primeira
		medidor.enviou(0);
		medidor.enviou(150);
		expect(medidor.respondeu(200)).toBe(50); // 50, e nao 200
	});

	it('tiqueForcado so aceita o objeto marcado', () => {
		expect(tiqueForcado(undefined)).toBe(false);
		expect(tiqueForcado(null)).toBe(false);
		expect(tiqueForcado(0)).toBe(false); // Firefox antigo passava a "lateness"
		expect(tiqueForcado({})).toBe(false);
		expect(tiqueForcado({ forcado: true })).toBe(true);
	});
});

describe('BackgroundTicker: a volta da aba e forcada', () => {
	afterEach(async () => {
		const { default: BackgroundTicker } = await import('Network/BackgroundTicker.js');
		BackgroundTicker.stop();
	});

	it('o visibilitychange para visible chama o callback com { forcado: true }', async () => {
		const { default: BackgroundTicker } = await import('Network/BackgroundTicker.js');
		const chamadas = [];
		BackgroundTicker.start(opcoes => chamadas.push(opcoes));
		Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
		document.dispatchEvent(new Event('visibilitychange'));
		expect(chamadas).toHaveLength(1);
		expect(tiqueForcado(chamadas[0])).toBe(true);
	});
});

describe('a costura no MapEngine', () => {
	const fonte = readFileSync(join(process.cwd(), 'src/Engine/MapEngine.js'), 'utf8');

	it('o sendKeepAlive consulta o freio depois da vigia e antes do envio', () => {
		const inicio = fonte.indexOf('const sendKeepAlive');
		expect(inicio).toBeGreaterThan(0);
		const corpo = fonte.slice(inicio, fonte.indexOf('Network.setPing(sendKeepAlive)', inicio));
		const vigia = corpo.indexOf('vigiaDeSilencio.conferir');
		const freio = corpo.indexOf('freioDoKeepAlive.deveEnviar(Date.now(), tiqueForcado(opcoes))');
		const envio = corpo.indexOf('Network.sendPacket(ping)');
		expect(vigia).toBeGreaterThan(0);
		expect(freio).toBeGreaterThan(vigia);
		expect(envio).toBeGreaterThan(freio);
		expect(fonte.slice(inicio - 600, inicio)).toMatch(/const freioDoKeepAlive = criarFreioDoKeepAlive\(\);/);
	});
});

vi.restoreAllMocks();
