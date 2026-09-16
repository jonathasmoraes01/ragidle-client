/**
 * A FAIXA DE EXP do Mapa de Caça (D-1338, tarefa 4 do dono): o tooltip que diz
 * ao jogador se ele ganha bônus ou leva penalidade de EXP no mapa.
 *
 * A tabela usada aqui é a que o servidor manda HOJE (`taxasPorDiferenca` sobre
 * `PENALIDADE_DE_EXP_DO_DONO`), transcrita por diferença para o teste rodar sem
 * servidor. Se o servidor mudar a tabela, este arquivo não sabe — quem garante
 * que o número do tooltip é o número do abate é o teste do lado do servidor
 * (`game/penalidade-de-exp-do-dono.test.ts`). Aqui se mede a LEITURA.
 */
import { describe, expect, it } from 'vitest';
import { faixaDeExp, textoDaFaixaDeExp } from '../../src/UI/Components/HuntMap/atlasDeCaca.js';

// -31..+16, uma taxa por diferença — a saída de `taxasPorDiferenca` hoje.
const TAXAS = [
	10, 35, 35, 35, 35, 35, 60, 60, 60, 60, 60, 85, 85, 85, 85, 85, 90, 90, 90, 90, 90, 95, 95, 95, 95, 95,
	100, 100, 100, 100, 100, 100, 100, 100, 102, 105, 107, 110, 112, 115, 117, 120, 117, 115, 112, 110, 107, 40
];
const TABELA = { de: -31, taxas: TAXAS };

describe('faixaDeExp', () => {
	it('CONTROLE: a tabela transcrita tem o tamanho das pontas e o pico no lugar certo', () => {
		// Sem isto, uma transcrição torta faria todos os casos abaixo medirem outra coisa.
		expect(TAXAS.length).toBe(16 - -31 + 1);
		expect(TAXAS[10 - -31]).toBe(120);
		expect(TAXAS[0 - -31]).toBe(100);
	});

	it('mapa só com monstros no seu nível é NEUTRO', () => {
		expect(faixaDeExp(30, { nivelMinimo: 28, nivelMaximo: 32 }, TABELA)).toEqual({
			min: 100,
			max: 100,
			cls: 'neutro'
		});
	});

	it('mapa com monstros 10 acima dá o pico de +20%', () => {
		expect(faixaDeExp(30, { nivelMinimo: 40, nivelMaximo: 40 }, TABELA)).toEqual({
			min: 120,
			max: 120,
			cls: 'bonus'
		});
	});

	it('mapa muito abaixo é PENALIDADE', () => {
		const f = faixaDeExp(60, { nivelMinimo: 20, nivelMaximo: 30 }, TABELA);
		expect(f.cls).toBe('penalidade');
		expect(f.max).toBeLessThan(100);
	});

	it('mapa que atravessa as duas zonas é MISTO — um número só esconderia metade', () => {
		const f = faixaDeExp(40, { nivelMinimo: 30, nivelMaximo: 56 }, TABELA);
		expect(f.cls).toBe('misto');
		expect(f.min).toBe(40); // o monstro 16 acima ainda cabe na faixa
		expect(f.max).toBe(120);
	});

	it('fora das pontas o grampo usa a taxa da ponta, e não undefined', () => {
		expect(faixaDeExp(1, { nivelMinimo: 90, nivelMaximo: 90 }, TABELA).min).toBe(40);
		expect(faixaDeExp(99, { nivelMinimo: 1, nivelMaximo: 1 }, TABELA).min).toBe(10);
	});

	it('servidor antigo (sem a tabela) não desenha nada — e não inventa 100%', () => {
		expect(faixaDeExp(30, { nivelMinimo: 28, nivelMaximo: 32 }, undefined)).toBeNull();
		expect(faixaDeExp(30, { nivelMinimo: 28, nivelMaximo: 32 }, { de: 0, taxas: [] })).toBeNull();
	});
});

describe('textoDaFaixaDeExp', () => {
	it('um número quando a faixa é plana, dois quando não é', () => {
		expect(textoDaFaixaDeExp({ min: 120, max: 120 })).toBe('EXP aqui: 120%');
		expect(textoDaFaixaDeExp({ min: 95, max: 110 })).toBe('EXP aqui: 95%–110%');
	});

	it('sem faixa, texto vazio', () => {
		expect(textoDaFaixaDeExp(null)).toBe('');
	});
});
