/**
 * O BÔNUS DO REFINO NA FICHA DO ITEM (16/09/2026, D-1516 do servidor).
 *
 * Quem calcula é o servidor; aqui se mede o TEXTO (`textoDoRefino`, pura) e a
 * costura, no fonte: a ficha pede por item e nível, e a resposta passa pela
 * MochilaIdle, que é quem tem o único tratador do `ZC_RAGIDLE_ITEM`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { textoDoRefino } from 'UI/Components/ItemInfo/linhaDoRefino.js';

const ler = rel => readFileSync(join(process.cwd(), rel), 'utf8');

describe('textoDoRefino', () => {
	it('arma: ATQ e MATQ', () => {
		expect(textoDoRefino({ nivel: 7, atributo: 'ATQ', valor: 14, matq: 14, sobreRefinoMaximo: 0 })).toBe(
			'Bônus do refino +7: ATQ +14 · MATQ +14'
		);
	});

	it('arco: sem MATQ', () => {
		expect(textoDoRefino({ nivel: 7, atributo: 'ATQ', valor: 14, matq: 0, sobreRefinoMaximo: 0 })).toBe(
			'Bônus do refino +7: ATQ +14'
		);
	});

	it('sobre-refino aparece com o teto', () => {
		expect(textoDoRefino({ nivel: 7, atributo: 'ATQ', valor: 49, matq: 49, sobreRefinoMaximo: 42 })).toContain(
			'sobre-refino: +1 a +42 de dano por golpe'
		);
	});

	it('armadura: centésimos viram DEF com vírgula', () => {
		expect(textoDoRefino({ nivel: 7, atributo: 'DEF', valor: 840, matq: 0, sobreRefinoMaximo: 0 })).toBe(
			'Bônus do refino +7: DEF +8,4'
		);
		expect(textoDoRefino({ nivel: 4, atributo: 'DEF', valor: 400, matq: 0, sobreRefinoMaximo: 0 })).toBe(
			'Bônus do refino +4: DEF +4'
		);
	});

	it('sem dado, nada', () => {
		expect(textoDoRefino(null)).toBeNull();
		expect(textoDoRefino({ nivel: 7, atributo: 'X', valor: 1 })).toBeNull();
	});
});

describe('a costura', () => {
	const ficha = ler('src/UI/Components/ItemInfo/ItemInfo.js');
	const mochila = ler('src/UI/Components/MochilaIdle/MochilaIdle.js');

	it('a ficha pede o bônus por item e nível para peça refinada', () => {
		expect(ficha).toContain("acao: 'refino', itemId: item.ITID, nivel: item.RefiningLevel");
		expect(ficha).toContain('if (item.RefiningLevel > 0 && item.ITID > 0)');
	});

	it('a ficha só desenha a resposta da peça que está aberta', () => {
		expect(ficha).toContain('dados.itemId !== _refinoPedido.itemId || dados.nivel !== _refinoPedido.nivel');
	});

	it('a mochila repassa a resposta de refino antes do filtro da comparação', () => {
		const repasse = mochila.indexOf("dados.acao === 'refino'");
		const filtro = mochila.indexOf("dados.acao !== 'comparar'");
		expect(repasse).toBeGreaterThan(0);
		expect(repasse).toBeLessThan(filtro);
		expect(mochila).toContain('ItemInfo.receberRefino(dados);');
	});
});
