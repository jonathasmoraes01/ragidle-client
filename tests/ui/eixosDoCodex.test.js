/**
 * O CODEX EM PERCENTUAL NA JANELA (25/09/2026).
 *
 * `eixosDoCodex.js` e puro e e testado de verdade. A janela (`CodexIdle.js`)
 * sobe meia interface para importar, entao a LIGACAO dela e cobrada lendo o
 * fonte, sem comentarios.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { desafiosHtml, eixosHtml, formatarPorcento, placarHtml } from 'UI/Components/CodexIdle/eixosDoCodex.js';

const CODEX_CODIGO = readFileSync('src/UI/Components/CodexIdle/CodexIdle.js', 'utf8')
	.replace(/\/\*[\s\S]*?\*\//g, ' ')
	.replace(/\/\/[^\n]*/g, ' ');

const RETRATO = {
	v: 2,
	pontos: { dasEntradas: 18, doNivel: 4, dosDesafios: 4, devolvidos: 7, ganhos: 33, gastos: 3, disponiveis: 30 },
	tetoDeNivel: 20,
	eixos: [
		{ eixo: 'hpMax', nivel: 1, bonus: 50, porNivel: 50, custoDoProximo: 2, recusa: null },
		{ eixo: 'aspd', nivel: 20, bonus: 500, porNivel: 25, custoDoProximo: null, recusa: 'eixo-no-teto' },
		{ eixo: 'spMax', nivel: 4, bonus: 400, porNivel: 100, custoDoProximo: 8, recusa: 'sem-ponto' }
	],
	desafios: {
		diario: { abates: 150, alvo: 300, pontos: 4, cumprido: false },
		semanal: { abates: 3000, alvo: 3000, pontos: 5, cumprido: true }
	}
};

describe('o formato do percentual (virgula brasileira)', () => {
	it('centesimos viram porcentagem legivel', () => {
		expect(formatarPorcento(50)).toBe('0,5%');
		expect(formatarPorcento(25)).toBe('0,25%');
		expect(formatarPorcento(1000)).toBe('10%');
		expect(formatarPorcento(6000)).toBe('60%');
		expect(formatarPorcento(175)).toBe('1,75%');
		expect(formatarPorcento(0)).toBe('0%');
	});
});

describe('o placar', () => {
	it('mostra o saldo e de onde vieram os pontos', () => {
		const html = placarHtml(RETRATO);
		expect(html).toContain('>30<');
		expect(html).toContain('3 de 33');
		expect(html).toContain('Devolvidos 7');
		expect(html).toContain('Desafios 4');
	});
});

describe('os eixos', () => {
	it('cada linha traz o bonus, o nivel e o custo; o veredito apaga o "+"', () => {
		const html = eixosHtml(RETRATO);
		expect(html).toContain('HP máximo');
		expect(html).toContain('+0,5%');
		expect(html).toContain('Nv 1/20');
		expect(html).toContain('2 pts');
		expect(html).toContain('Máx.');
		// dois dos tres com recusa -> dois `disabled`
		expect((html.match(/ disabled/g) || []).length).toBe(2);
		expect(html).toContain('data-eixo="hpMax"');
	});

	it('um retrato ANTIGO (sem eixos) nao desenha botao nenhum', () => {
		const html = eixosHtml({ v: 1, gastos: { str: 1 } });
		expect(html).not.toContain('cx-mais');
		expect(html).toContain('Atualize o jogo');
	});
});

describe('os desafios', () => {
	it('as duas barras, e o cumprido marcado', () => {
		const html = desafiosHtml(RETRATO);
		expect(html).toContain('150/300');
		expect(html).toContain('width:50%');
		expect(html).toContain('is-cumprido');
		expect(html).toContain('Feito');
	});
});

describe('a janela usa o modulo, e nao uma segunda rota', () => {
	it('importa placar, eixos e desafios daqui', () => {
		expect(CODEX_CODIGO).toContain("from './eixosDoCodex.js'");
		expect(CODEX_CODIGO).toContain('desafiosHtml(estado)');
		expect(CODEX_CODIGO).not.toContain('bonusDeAtributo');
		expect(CODEX_CODIGO).not.toContain('pontosDisponiveis');
	});
});
