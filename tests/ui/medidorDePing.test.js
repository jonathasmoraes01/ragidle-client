/**
 * O MEDIDOR DE PING (23/09/2026): o tempo real de ida e volta do keepalive, e
 * a mediana das ultimas amostras na HUD.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { criarMedidorDePing, faixaDoPing } from 'Network/medidorDePing.js';

describe('o medidor de ping', () => {
	it('sem amostra nao inventa numero', () => {
		expect(criarMedidorDePing().valor()).toBe(null);
	});

	it('mede o tempo entre o envio e a resposta', () => {
		const m = criarMedidorDePing();
		m.enviou(1000);
		expect(m.respondeu(1045)).toBe(45);
		expect(m.valor()).toBe(45);
	});

	it('resposta sem envio pendente nao conta', () => {
		const m = criarMedidorDePing();
		expect(m.respondeu(500)).toBe(null);
		expect(m.valor()).toBe(null);
	});

	it('mostra a MEDIANA: um atraso isolado (alt-tab) nao vira lag na tela', () => {
		const m = criarMedidorDePing(5);
		for (const rtt of [40, 42, 3000, 41, 43]) {
			m.enviou(0);
			m.respondeu(rtt);
		}
		expect(m.valor()).toBe(42);
	});

	it('guarda so as ultimas amostras', () => {
		const m = criarMedidorDePing(3);
		for (const rtt of [500, 500, 500, 20, 20, 20]) {
			m.enviou(0);
			m.respondeu(rtt);
		}
		expect(m.valor()).toBe(20);
	});

	it('zerar recomeca do zero', () => {
		const m = criarMedidorDePing();
		m.enviou(0);
		m.respondeu(30);
		m.zerar();
		expect(m.valor()).toBe(null);
	});

	it('as faixas de cor', () => {
		expect(faixaDoPing(null)).toBe('sem-medida');
		expect(faixaDoPing(99)).toBe('bom');
		expect(faixaDoPing(100)).toBe('medio');
		expect(faixaDoPing(199)).toBe('medio');
		expect(faixaDoPing(200)).toBe('ruim');
	});

	it('o MapEngine mede de verdade (o `pongTime` nao e mais zerado a mao)', () => {
		const js = readFileSync(join(__dirname, '..', '..', 'src', 'Engine', 'MapEngine.js'), 'utf8');
		expect(js).toContain('medidorDePing.enviou(Date.now());');
		expect(js).toContain('const rtt = medidorDePing.respondeu(Date.now());');
		expect(js).not.toContain('SP.pongTime = 0;');
	});
});
