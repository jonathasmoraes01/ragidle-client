/**
 * O NOME DA ARMA FORJADA (lote 5 da comunidade, 14/10/2026).
 *
 * As mensagens abaixo sao as do `msgstringtable_ml.csv` do GRF, decodificadas
 * (colunas ingles e portugues das linhas 450-454 e 459-461). Em portugues elas
 * sao SUFIXOS, e o nome sai "Espada Flamejante Muito Forte de Fulano"; em
 * ingles a ordem de sempre do roBrowser.
 */

import { describe, expect, it } from 'vitest';
import DB from 'DB/DBManager.js';
import {
	elementoDaAssinatura,
	estrelasDaAssinatura,
	partesDoNomeForjado
} from 'DB/Items/nomeDaArmaForjada.js';

const PT = {
	450: ' de ',
	451: ' Flamejante',
	452: ' Glacial',
	453: ' Trovejante',
	454: ' Mineral',
	459: ' Forte',
	460: ' Muito Forte',
	461: ' Fortíssimo'
};
const EN = {
	450: "'s ",
	451: "'s Fire ",
	452: "'s Ice ",
	453: "'s Wind ",
	454: "'s Earth ",
	459: 'Very Strong ',
	460: 'Very Very Strong ',
	461: 'Very Very Very Strong '
};

/** card2 = ((estrelas * 5) << 8) + elemento (rAthena skill.cpp:13247). */
const card2 = (estrelas, elemento) => ((estrelas * 5) << 8) + elemento;

describe('a assinatura lida de card2', () => {
	it('as Estrelinhas: 0, 1, 2 e 3', () => {
		expect([0, 1, 2, 3].map(n => estrelasDaAssinatura(card2(n, 0)))).toEqual([0, 1, 2, 3]);
	});

	it('o elemento e o nibble baixo (status.cpp:4010), com e sem estrelas', () => {
		expect(elementoDaAssinatura(card2(0, 3))).toBe(3);
		expect(elementoDaAssinatura(card2(3, 1))).toBe(1);
		expect(elementoDaAssinatura(card2(2, 0))).toBe(0);
	});
});

describe('partesDoNomeForjado', () => {
	const pt = id => PT[id];
	const en = id => EN[id];

	it('portugues: tudo DEPOIS do nome do item, elemento, Estrelinhas e o dono', () => {
		expect(partesDoNomeForjado(card2(2, 3), 'Fulano', pt)).toEqual({
			prefixo: '',
			sufixo: ' Flamejante Muito Forte de Fulano'
		});
		expect(partesDoNomeForjado(card2(1, 1), 'Fulano', pt).sufixo).toBe(' Glacial Forte de Fulano');
		expect(partesDoNomeForjado(card2(3, 4), 'Fulano', pt).sufixo).toBe(' Trovejante Fortíssimo de Fulano');
		expect(partesDoNomeForjado(card2(0, 2), 'Fulano', pt).sufixo).toBe(' Mineral de Fulano');
	});

	it('portugues sem pedra nem Estrelinha: so "de Fulano"', () => {
		expect(partesDoNomeForjado(card2(0, 0), 'Fulano', pt)).toEqual({ prefixo: '', sufixo: ' de Fulano' });
	});

	it('ingles: a ordem de sempre, tudo antes do nome', () => {
		expect(partesDoNomeForjado(card2(1, 3), 'Fulano', en)).toEqual({
			prefixo: "Very Strong  Fulano's Fire  ",
			sufixo: ''
		});
		expect(partesDoNomeForjado(card2(0, 0), 'Fulano', en).prefixo).toBe(" Fulano's  ");
	});

	it('sem msgstringtable carregado, nada de "undefined" no nome', () => {
		const partes = partesDoNomeForjado(card2(3, 3), 'Fulano', () => undefined);
		expect(partes.prefixo + partes.sufixo).not.toContain('undefined');
	});
});

describe('getItemName com a arma forjada', () => {
	it('o ferreiro de id 65.536 a 131.071 NAO vira "Beloved" (o card4 dele e 1)', () => {
		const GID = 70000; // card4 = 1
		DB.CNameTable[GID] = 'Ferreiro';
		const nome = DB.getItemName({
			ITID: 1101,
			IsIdentified: 1,
			RefiningLevel: 0,
			slot: { card1: 0x00ff, card2: card2(1, 3), card3: GID & 0xffff, card4: (GID >> 16) & 0xffff }
		});
		expect((GID >> 16) & 0xffff).toBe(1);
		expect(nome).not.toContain('NO MSG 756');
		expect(nome).toContain('Ferreiro');
	});

	it('o ovo de pet renomeado continua "Beloved"', () => {
		const nome = DB.getItemName({
			ITID: 9001,
			IsIdentified: 1,
			RefiningLevel: 0,
			slot: { card1: 0xff00, card2: 0, card3: 0, card4: 1 }
		});
		expect(nome).toContain('NO MSG 756');
	});
});
