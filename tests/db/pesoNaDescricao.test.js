/**
 * O PESO DA DESCRICAO E O DO JOGO (16/09/2026, D-1526) — relato do dono depois
 * da R30: a descricao da pocao continuava dizendo 7.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { comPesoDaFicha, pesoComoNaDescricao } from 'DB/Items/pesoNaDescricao.js';

describe('comPesoDaFicha', () => {
	it('troca o numero mesmo com codigo de cor no meio, e so ele', () => {
		const pocao = 'Recupera cerca de 45 HP.\nPeso: ^7777777^000000';
		expect(comPesoDaFicha(pocao, 50)).toBe('Recupera cerca de 45 HP.\nPeso: ^7777775^000000');
		expect(comPesoDaFicha('Peso: 15', 50)).toBe('Peso: 5');
		expect(comPesoDaFicha('Peso : ^7777770.2^000000', 1)).toBe('Peso : ^7777770.1^000000');
	});

	it('sem ficha (null) ou sem linha de peso, o texto fica como veio', () => {
		expect(comPesoDaFicha('Peso: 7', null)).toBe('Peso: 7');
		expect(comPesoDaFicha('Aumenta o dano.', 50)).toBe('Aumenta o dano.');
	});

	it('formata como o texto oficial', () => {
		expect(pesoComoNaDescricao(10)).toBe('1');
		expect(pesoComoNaDescricao(1)).toBe('0.1');
	});
});

describe('a costura', () => {
	const db = readFileSync(join(process.cwd(), 'src/DB/DBManager.js'), 'utf8');
	const ficha = readFileSync(join(process.cwd(), 'src/UI/Components/ItemInfo/ItemInfo.js'), 'utf8');

	it('getItemInfo reescreve a descricao com o peso da ficha, uma vez por valor', () => {
		expect(db).toContain('item._pesoNaDescricao !== pesoDaFicha');
		expect(db).toContain('comPesoDaFicha(item.identifiedDescriptionName, pesoDaFicha)');
	});

	it('a ficha do item carrega as fichas de peso e redesenha a mesma peca', () => {
		expect(ficha).toContain('carregarFichasDeItem().then(temFichas => {');
		expect(ficha).toContain('ItemInfo.uid === item.ITID');
	});
});
