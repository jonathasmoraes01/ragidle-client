/**
 * O PING DA REDE, SEPARADO DO PING DO JOGO (achados 19 e 20 da varredura de
 * rede, 15/10/2026, D-2540 no repositorio do servidor).
 *
 * A medida pura (`wsproxyRede.js`), o eco do conteudo do ping no pong com um
 * WebSocket de verdade (o RFC 6455 manda ecoar; o navegador e o `ws` ecoam), e
 * a costura na ponte.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import WebSocket, { WebSocketServer } from 'ws';
import { describe, expect, it } from 'vitest';
import {
	FILA_ALTA_BYTES,
	MedidaDaRede,
	TETO_DE_MEDIDAS,
	carimboDoPing,
	idaEVoltaDoPong,
	linhaDaRede
} from '../wsproxyRede.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/* Porta isolada das outras provas da ponte (15972/15973, 15979.., 15992/15993, 15996/15997). */
const PORTA = 15968;

describe('o ida e volta do pong', () => {
	it('o pong que ecoa o carimbo da o tempo desde que o ping saiu', () => {
		expect(idaEVoltaDoPong(carimboDoPing(1_000), 1_180)).toBe(180);
		expect(idaEVoltaDoPong(carimboDoPing(1_000), 1_000)).toBe(0);
	});

	it('pong que nao veio de ping nosso nao conta', () => {
		expect(idaEVoltaDoPong(Buffer.alloc(0), 1_000)).toBeNull();
		expect(idaEVoltaDoPong(Buffer.from('ola'), 1_000)).toBeNull();
		expect(idaEVoltaDoPong(undefined, 1_000)).toBeNull();
		// relogio que voltou: nada de tempo negativo
		expect(idaEVoltaDoPong(carimboDoPing(2_000), 1_000)).toBeNull();
	});
});

describe('a janela da medida', () => {
	it('percentis, maior e fila alta, e a janela zera ao fechar', () => {
		const m = new MedidaDaRede();
		for (let i = 1; i <= 100; i++) m.anotar(i);
		m.anotarFila(0);
		m.anotarFila(FILA_ALTA_BYTES - 1);
		m.anotarFila(FILA_ALTA_BYTES);
		m.anotarFila(300 * 1024);
		const r = m.fechar();
		expect(r).toEqual({ medidas: 100, p50Ms: 50, p95Ms: 95, maiorMs: 100, amostrasDeFila: 4, filasAltas: 2, maiorFilaKiB: 300 });
		expect(m.fechar()).toBeNull();
	});

	it('as medidas chegam fora de ordem (cada conexao no seu tempo): o percentil ordena antes', () => {
		const m = new MedidaDaRede();
		for (const v of [900, 10, 500, 20, 30]) m.anotar(v);
		const r = m.fechar();
		expect(r.p50Ms).toBe(30);
		expect(r.maiorMs).toBe(900);
	});

	it('so fila, sem pong: a linha sai com os tempos em branco', () => {
		const m = new MedidaDaRede();
		m.anotarFila(10);
		const r = m.fechar();
		expect(r.medidas).toBe(0);
		expect(r.p50Ms).toBeNull();
		expect(linhaDaRede(r)).toContain('p50 -,');
	});

	it('o teto segura a memoria; medida invalida nao entra', () => {
		const m = new MedidaDaRede(3);
		for (const v of [NaN, -1, Infinity, 5, 6, 7, 8]) m.anotar(v);
		const r = m.fechar();
		expect(r.medidas).toBe(3);
		expect(r.maiorMs).toBe(7);
		expect(TETO_DE_MEDIDAS).toBeGreaterThanOrEqual(1_000);
	});

	it('a linha tem o nome fixo do grep', () => {
		const m = new MedidaDaRede();
		m.anotar(42);
		expect(linhaDaRede(m.fechar())).toMatch(/^\[wsProxy\] rede \(pong, 60 s\): 1 medidas, p50 42 ms, p95 42 ms, maior 42 ms; /);
	});
});

describe('o pong ecoa o carimbo num WebSocket de verdade', () => {
	it('o ping com o carimbo volta com ele, e da um tempo valido', async () => {
		const servidor = new WebSocketServer({ port: PORTA, host: '127.0.0.1' });
		try {
			const medido = await new Promise((resolve, reject) => {
				servidor.on('connection', (ws) => {
					ws.on('pong', (dados) => resolve(idaEVoltaDoPong(dados, Date.now())));
					ws.ping(carimboDoPing(Date.now()));
				});
				const cliente = new WebSocket(`ws://127.0.0.1:${PORTA}`);
				cliente.on('error', reject);
				setTimeout(() => reject(new Error('sem pong em 5 s')), 5_000);
			});
			expect(medido).not.toBeNull();
			expect(medido).toBeGreaterThanOrEqual(0);
			expect(medido).toBeLessThan(5_000);
		} finally {
			for (const c of servidor.clients) c.terminate();
			await new Promise((r) => servidor.close(r));
		}
	});
});

describe('a costura na ponte', () => {
	const fonte = readFileSync(path.join(RAIZ, 'wsproxy.js'), 'utf8');
	it('o ping leva o carimbo, o pong e medido, a fila e anotada e o minuto escreve a linha', () => {
		expect(fonte).toContain('ws.ping(carimboDoPing(Date.now()));');
		expect(fonte).toContain("ws.on('pong', (dados) => {");
		expect(fonte).toContain('medidaDaRede.anotarFila(ws.bufferedAmount);');
		expect(fonte).toContain('if (resumo !== null) console.log(linhaDaRede(resumo));');
	});
});
