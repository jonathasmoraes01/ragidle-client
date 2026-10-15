/**
 * O FILTRO POR CLASSE DO MAPA DE CACA (J7, 15/10/2026, D-2470): a regra pura
 * (`HuntMap/filtroPorClasse.js`) com uma tabela de mentira, e o arquivo
 * PUBLICADO de verdade (`public/ragidle/classes-dos-itens.json`, gerado no
 * repositorio do jogo) lido pelo carregador - a falha provavel e a publicacao
 * sair vazia ou na versao errada, e um fixture esconderia isso.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
	dropsComId,
	equipamentosDaClasse,
	equipamentosDoMapaParaAClasse,
	motivoDaClasse
} from '../../src/UI/Components/HuntMap/filtroPorClasse.js';
import { resumoDoMotivo } from '../../src/UI/Components/HuntMap/atlasDeCaca.js';
import {
	absorverClassesDosItens,
	classeUsaItem,
	classesParaOFiltro
} from '../../src/DB/Items/classesDosItens.js';

/* A tabela de mentira: a classe 0 usa as espadas (10, 11), a classe 1 usa o arco (20). */
const USA = {
	0: new Set([10, 11]),
	1: new Set([20])
};
const classeUsa = (indice, itemId) => {
	if (![10, 11, 20, 30].includes(itemId)) return null; // 30: nao e equipamento
	return USA[indice] ? USA[indice].has(itemId) : false;
};

/* Os dois formatos de monstro: o indice (nomes + dropIds) e a ficha (objetos). */
const poring = { nome: 'Poring', drops: ['Espada Curta', 'Geleia'], dropIds: [10, 909] };
const lunatic = { nome: 'Lunatic', drops: ['Espada Curta', 'Arco'], dropIds: [10, 20] };
const ficha = { nome: 'Drops', drops: [{ itemId: 11, nome: 'Espada', nomeLocal: 'Espada Longa' }, { itemId: 909, nome: 'Jellopy' }] };

describe('dropsComId', () => {
	it('o indice: o nome vem de `drops` e o id de `dropIds`, no mesmo indice', () => {
		expect(dropsComId(poring)).toEqual([
			{ itemId: 10, nome: 'Espada Curta' },
			{ itemId: 909, nome: 'Geleia' }
		]);
	});

	it('a ficha: o objeto traz o id, e o nome local vence o do servidor', () => {
		expect(dropsComId(ficha)).toEqual([
			{ itemId: 11, nome: 'Espada Longa' },
			{ itemId: 909, nome: 'Jellopy' }
		]);
	});

	it('o drop sem id conhecido nao conta (nao se adivinha pelo nome)', () => {
		expect(dropsComId({ nome: 'X', drops: ['Espada Curta'] })).toEqual([]);
		expect(dropsComId({ nome: 'X', drops: ['A', 'B'], dropIds: [5] })).toEqual([{ itemId: 5, nome: 'A' }]);
		expect(dropsComId(null)).toEqual([]);
	});
});

describe('equipamentosDaClasse', () => {
	const usa0 = id => classeUsa(0, id);

	it('lista so o que a classe usa, sem repetir o item que cai de dois monstros', () => {
		const lista = equipamentosDaClasse([poring, lunatic], usa0);
		expect(lista).toEqual([{ itemId: 10, nome: 'Espada Curta', monstros: ['Poring', 'Lunatic'] }]);
	});

	it('o MESMO monstro com o item duas vezes na lista aparece uma vez so', () => {
		const repetido = { nome: 'Poring', drops: ['Espada Curta', 'Espada Curta'], dropIds: [10, 10] };
		expect(equipamentosDaClasse([repetido], usa0)).toEqual([{ itemId: 10, nome: 'Espada Curta', monstros: ['Poring'] }]);
	});

	it('o que nao e equipamento (null) e o que outra classe usa ficam de fora', () => {
		expect(equipamentosDaClasse([poring], id => classeUsa(1, id))).toEqual([]);
		expect(equipamentosDaClasse([lunatic], id => classeUsa(1, id))).toEqual([
			{ itemId: 20, nome: 'Arco', monstros: ['Lunatic'] }
		]);
	});

	it('a ordem e a do primeiro aparecimento', () => {
		const lista = equipamentosDaClasse([lunatic, ficha], usa0);
		expect(lista.map(e => e.itemId)).toEqual([10, 11]);
	});

	it('lista de monstros vazia ou ausente da lista vazia', () => {
		expect(equipamentosDaClasse([], usa0)).toEqual([]);
		expect(equipamentosDaClasse(undefined, usa0)).toEqual([]);
	});
});

describe('equipamentosDoMapaParaAClasse (a pergunta do filtro)', () => {
	it('sem classe escolhida (-1, NaN, lixo) devolve null: nao e filtro', () => {
		for (const indice of [-1, Number.NaN, undefined, null, 1.5]) {
			expect(equipamentosDoMapaParaAClasse([poring], indice, classeUsa), String(indice)).toBeNull();
		}
	});

	it('com classe escolhida devolve a lista (vazia quer dizer: o mapa sai da lista)', () => {
		expect(equipamentosDoMapaParaAClasse([poring], 0, classeUsa)).toHaveLength(1);
		expect(equipamentosDoMapaParaAClasse([poring], 1, classeUsa)).toEqual([]);
	});

	it('o indice 0 e uma classe valida (nao e "sem filtro")', () => {
		expect(equipamentosDoMapaParaAClasse([poring], 0, classeUsa)).not.toBeNull();
	});
});

describe('motivoDaClasse e a linha do cartao', () => {
	it('tem a forma do motivo da busca: `resumoDoMotivo` desenha "item (monstro)"', () => {
		const lista = equipamentosDaClasse([lunatic, poring], id => classeUsa(0, id));
		const motivo = motivoDaClasse(lista);
		expect(motivo.peloNome).toBe(false);
		expect(resumoDoMotivo(motivo)).toBe('Espada Curta (Lunatic)');
	});

	it('mais de tres itens: mostra tres e conta o resto', () => {
		const equipamentos = [1, 2, 3, 4, 5].map(i => ({ itemId: i, nome: `Item ${i}`, monstros: ['M'] }));
		expect(resumoDoMotivo(motivoDaClasse(equipamentos))).toBe('Item 1 (M) · Item 2 (M) · Item 3 (M) +2');
	});
});

describe('o arquivo publicado (classes-dos-itens.json)', () => {
	let publicado;

	beforeAll(() => {
		publicado = JSON.parse(readFileSync(join(process.cwd(), 'public', 'ragidle', 'classes-dos-itens.json'), 'utf8'));
		absorverClassesDosItens(publicado);
	});

	const indiceDe = id => classesParaOFiltro().find(c => c.id === id).indice;

	it('traz as 20 classes jogaveis, com o nome em portugues', () => {
		const classes = classesParaOFiltro();
		expect(classes).toHaveLength(20);
		expect(classes.find(c => c.id === 'Swordman').nome).toBe('Espadachim');
		expect(classes.find(c => c.id === 'Dancer').nome).toBe('Odalisca');
	});

	it('a espada e do Espadachim e nao do Mago; o cajado e do Mago e nao do Espadachim', () => {
		expect(classeUsaItem(indiceDe('Swordman'), 1101)).toBe(true); // Sword
		expect(classeUsaItem(indiceDe('Mage'), 1101)).toBe(false);
		expect(classeUsaItem(indiceDe('Mage'), 1601)).toBe(true); // Rod
		expect(classeUsaItem(indiceDe('Swordman'), 1601)).toBe(false);
	});

	it('o arco e do Arqueiro e do Cacador, e do Bardo, mas nao do Sacerdote', () => {
		for (const id of ['Archer', 'Hunter', 'Bard']) expect(classeUsaItem(indiceDe(id), 1701), id).toBe(true); // Bow
		expect(classeUsaItem(indiceDe('Priest'), 1701)).toBe(false);
	});

	it('o que nao e equipamento (pocao) e o item desconhecido devolvem null, e nao false', () => {
		expect(classeUsaItem(indiceDe('Swordman'), 501)).toBeNull();
		expect(classeUsaItem(0, 99999999)).toBeNull();
	});

	it('o arquivo cobre centenas de equipamentos (publicacao vazia reprova aqui)', () => {
		expect(Object.keys(publicado.itens).length).toBeGreaterThan(300);
	});

	it('versao desconhecida ou arquivo torto e recusado, nao engolido', () => {
		expect(() => absorverClassesDosItens({ v: 2, classes: [], nomes: [], conjuntos: [], itens: {} })).toThrow();
		expect(() => absorverClassesDosItens(null)).toThrow();
		expect(() => absorverClassesDosItens({ v: 1 })).toThrow();
		// o estado bom do beforeAll nao pode ter sido perdido pelas recusas acima
		absorverClassesDosItens(publicado);
		expect(classesParaOFiltro()).toHaveLength(20);
	});
});
