/**
 * As regras SEM DOM do Mapa de Caça redesenhado (D-901, 01/09/2026):
 * `atlasDeCaca.js`. Executa a aritmética — encaixe, medidor, motivo da busca,
 * ordem e formato de chance — em vez de ler o fonte.
 */
import { describe, expect, it } from 'vitest';
import {
	encaixeDeNivel,
	formatarChance,
	medidorDeEncaixe,
	motivoDaBusca,
	ordenarMapas,
	resumoDoMotivo
} from '../../src/UI/Components/HuntMap/atlasDeCaca.js';

const campo = { mapa: 'prt_fild08', rotulo: 'Campo de Prontera', nivelQueAbre: 1, nivelMinimo: 1, nivelMaximo: 16, nivelMedio: 6.5 };
const cemiterio = { mapa: 'gl_chyard', rotulo: 'Cemitério de Glast Heim', nivelQueAbre: 55, nivelMinimo: 55, nivelMaximo: 70, nivelMedio: 62 };

describe('encaixeDeNivel', () => {
	it('a tranca vem antes de tudo', () => {
		expect(encaixeDeNivel(10, cemiterio).cls).toBe('locked');
		expect(encaixeDeNivel(10, cemiterio).rotulo).toBe('Abre no Nv. 55');
	});
	it('dentro da faixa é ideal; acima é fácil; abaixo (mas aberto) é desafio', () => {
		expect(encaixeDeNivel(10, campo).cls).toBe('ideal');
		expect(encaixeDeNivel(16, campo).cls).toBe('ideal');
		expect(encaixeDeNivel(17, campo).cls).toBe('easy');
		const aberto = { ...cemiterio, nivelQueAbre: 50 };
		expect(encaixeDeNivel(52, aberto).cls).toBe('challenge');
	});
});

describe('medidorDeEncaixe', () => {
	it('o meio da faixa cai no meio da régua', () => {
		const { marcador, dentro } = medidorDeEncaixe(8.5, campo);
		expect(marcador).toBe(50);
		expect(dentro).toBe(true);
	});
	it('as bordas da faixa caem em 25% e 75%', () => {
		expect(medidorDeEncaixe(1, campo).marcador).toBe(25);
		expect(medidorDeEncaixe(16, campo).marcador).toBe(75);
	});
	it('fora da faixa o marcador gruda na ponta e diz que está fora', () => {
		expect(medidorDeEncaixe(99, campo)).toEqual({ marcador: 100, dentro: false });
		expect(medidorDeEncaixe(1, cemiterio)).toEqual({ marcador: 0, dentro: false });
	});
	it('faixa de um nível só não colapsa num ponto', () => {
		const um = { nivelMinimo: 30, nivelMaximo: 30 };
		expect(medidorDeEncaixe(30, um).marcador).toBe(50);
		expect(medidorDeEncaixe(31, um).marcador).toBeGreaterThan(50);
		expect(medidorDeEncaixe(31, um).marcador).toBeLessThan(100);
	});
});

describe('motivoDaBusca', () => {
	const poring = { nome: 'Poring', drops: ['Jellopy', 'Maçã'] };
	const lunatic = { nome: 'Lunatic', drops: [{ nome: 'Cenoura' }, { nome: 'Jellopy' }] };
	it('sem termo, tudo casa e o motivo é vazio', () => {
		expect(motivoDaBusca(campo, [poring], '')).toEqual({ peloNome: true, monstros: [], drops: [] });
	});
	it('não casou = null (é o filtro da lista)', () => {
		expect(motivoDaBusca(campo, [poring, lunatic], 'zumbi')).toBeNull();
	});
	it('casa pelo nome do mapa, do monstro e do drop — nas duas formas de drop (índice e ficha)', () => {
		expect(motivoDaBusca(campo, [poring], 'pront').peloNome).toBe(true);
		expect(motivoDaBusca(campo, [poring, lunatic], 'luna').monstros).toEqual(['Lunatic']);
		expect(motivoDaBusca(campo, [poring, lunatic], 'jell').drops).toEqual([
			{ item: 'Jellopy', monstro: 'Poring' },
			{ item: 'Jellopy', monstro: 'Lunatic' }
		]);
	});
	it('casa pelo nome LOCAL do item (o que o jogador lê) e o devolve no motivo', () => {
		const willow = { nome: 'Willow', drops: [{ nome: 'Tree Root', nomeLocal: 'Raiz de Árvore' }] };
		expect(motivoDaBusca(campo, [willow], 'raiz').drops).toEqual([{ item: 'Raiz de Árvore', monstro: 'Willow' }]);
		expect(motivoDaBusca(campo, [willow], 'tree root').drops).toEqual([{ item: 'Raiz de Árvore', monstro: 'Willow' }]);
		expect(motivoDaBusca(campo, [willow], 'jellopy')).toBeNull();
	});
	it('o resumo diz quem trouxe o mapa e corta em três', () => {
		const motivo = motivoDaBusca(campo, [poring, lunatic], 'jell');
		expect(resumoDoMotivo(motivo)).toBe('Jellopy (Poring) · Jellopy (Lunatic)');
		const muitos = { peloNome: false, monstros: ['A', 'B', 'C', 'D'], drops: [] };
		expect(resumoDoMotivo(muitos)).toBe('A · B · C +1');
		expect(resumoDoMotivo({ peloNome: true, monstros: [], drops: [] })).toBe('');
		expect(resumoDoMotivo(null)).toBe('');
	});
});

describe('ordenarMapas', () => {
	const mapas = [cemiterio, campo, { ...campo, mapa: 'x', rotulo: 'Arredores', nivelMinimo: 1, nivelMedio: 3 }];
	it('por nível: faixa crescente, média desempata, nome por último', () => {
		expect(ordenarMapas(mapas, 'nivel', 1).map(m => m.rotulo)).toEqual([
			'Arredores',
			'Campo de Prontera',
			'Cemitério de Glast Heim'
		]);
	});
	it('por nome: alfabética pt-BR', () => {
		expect(ordenarMapas(mapas, 'nome', 1).map(m => m.rotulo)).toEqual([
			'Arredores',
			'Campo de Prontera',
			'Cemitério de Glast Heim'
		]);
	});
	it('para meu nível: o mapa cuja média fica mais perto sobe', () => {
		expect(ordenarMapas(mapas, 'nivel-recomendado', 60)[0]).toBe(cemiterio);
		expect(ordenarMapas(mapas, 'nivel-recomendado', 3)[0].rotulo).toBe('Arredores');
	});
	it('não muda a lista de entrada', () => {
		const copia = mapas.slice();
		ordenarMapas(mapas, 'nome', 1);
		expect(mapas).toEqual(copia);
	});
});

describe('formatarChance', () => {
	it('inteiro de 10% para cima, uma casa entre 1% e 10%, duas abaixo — vírgula e sem zero à direita', () => {
		expect(formatarChance(7000)).toBe('70%');
		expect(formatarChance(5600)).toBe('56%');
		expect(formatarChance(1000)).toBe('10%');
		expect(formatarChance(800)).toBe('8%');
		expect(formatarChance(320)).toBe('3,2%');
		expect(formatarChance(80)).toBe('0,8%');
		expect(formatarChance(16)).toBe('0,16%');
		expect(formatarChance(1)).toBe('0,01%');
		expect(formatarChance(0)).toBe('0%');
		expect(formatarChance(undefined)).toBe('0%');
	});
});
