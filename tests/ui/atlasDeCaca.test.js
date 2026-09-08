/**
 * As regras SEM DOM do Mapa de Caça redesenhado (D-901, 01/09/2026):
 * `atlasDeCaca.js`. Executa a aritmética — encaixe, medidor, motivo da busca,
 * ordem e formato de chance — em vez de ler o fonte.
 */
import { describe, expect, it } from 'vitest';
import {
	classeDeRaridade,
	derivarRaridade,
	encaixeDeNivel,
	medidorDeEncaixe,
	motivoDaBusca,
	ordenarMapas,
	raridadeDoDrop,
	resumoDoMotivo,
	rotuloDeRaridade
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
	const mapas = [cemiterio, campo, { ...campo, mapa: 'x', rotulo: 'Arredores', nivelQueAbre: 1, nivelMinimo: 1, nivelMedio: 3 }];
	it('por nível: TRANCA crescente (o número do cartão), média desempata, nome por último', () => {
		expect(ordenarMapas(mapas, 'nivel', 1).map(m => m.rotulo)).toEqual([
			'Arredores',
			'Campo de Prontera',
			'Cemitério de Glast Heim'
		]);
	});
	it('a chave é a TRANCA, não o mínimo — mapa com bicho fraco e média alta desce na lista', () => {
		// O caso que criou a regra (pay_fild04): mínimo 1, tranca 17. Ordenado
		// pelo mínimo ele apareceria como "mapa de nível 1" acima de mapas que
		// abrem no 10 — a contradição que o dono viu no print do celular.
		const payonzao = { ...campo, mapa: 'pay', rotulo: 'Payonzão', nivelQueAbre: 17, nivelMinimo: 1, nivelMedio: 17.5, nivelMaximo: 37 };
		const meio = { ...campo, mapa: 'meio', rotulo: 'Meio', nivelQueAbre: 10, nivelMinimo: 10, nivelMedio: 12, nivelMaximo: 14 };
		expect(ordenarMapas([payonzao, meio, campo], 'nivel', 1).map(m => m.rotulo)).toEqual([
			'Campo de Prontera',
			'Meio',
			'Payonzão'
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

describe('derivarRaridade', () => {
	it('as bordas da escada defensiva (a mesma do servidor): ≤3 Lendário (ordem do dono 08/09), ≤100 Raro, ≤1000 Incomum, senão Comum', () => {
		expect(derivarRaridade(3)).toBe(3); // 0,03% — o teto do Lendário
		expect(derivarRaridade(4)).toBe(2); // 0,04% — o primeiro Raro
		expect(derivarRaridade(5)).toBe(2); // 0,05% — era Lendário até a emenda; o limiar do ANÚNCIO ficou lá
		expect(derivarRaridade(100)).toBe(2);
		expect(derivarRaridade(101)).toBe(1);
		expect(derivarRaridade(1000)).toBe(1);
		expect(derivarRaridade(1001)).toBe(0);
	});
	it('chance ausente não quebra: cai no mesmo caminho de chance zero', () => {
		expect(derivarRaridade(undefined)).toBe(derivarRaridade(0));
	});
});

describe('raridadeDoDrop', () => {
	it('o campo `raridade` do servidor SEMPRE vence — o cliente não recalcula por cima dele', () => {
		// chance 9000 (90%) derivaria Comum pela escada; o servidor manda
		// Lendário explícito, e é isso que tem que aparecer.
		expect(raridadeDoDrop({ chance: 9000, raridade: 3 })).toBe(3);
		expect(raridadeDoDrop({ chance: 1, raridade: 0 })).toBe(0);
	});
	it('sem `raridade` (servidor velho), deriva DEFENSIVAMENTE da chance pela mesma escada', () => {
		expect(raridadeDoDrop({ chance: 3 })).toBe(3);
		expect(raridadeDoDrop({ chance: 1001 })).toBe(0);
	});
	it('`raridade` fora de 0..3 ou não-inteiro é tratado como ausente (defesa contra payload sujo)', () => {
		expect(raridadeDoDrop({ chance: 3, raridade: 4 })).toBe(3);
		expect(raridadeDoDrop({ chance: 3, raridade: -1 })).toBe(3);
		expect(raridadeDoDrop({ chance: 3, raridade: 1.5 })).toBe(3);
		expect(raridadeDoDrop({ chance: 3, raridade: null })).toBe(3);
	});
});

describe('rotuloDeRaridade', () => {
	it('os quatro rótulos exatos, com acento', () => {
		expect(rotuloDeRaridade(0)).toBe('Comum');
		expect(rotuloDeRaridade(1)).toBe('Incomum');
		expect(rotuloDeRaridade(2)).toBe('Raro');
		expect(rotuloDeRaridade(3)).toBe('Lendário');
	});
	it('índice desconhecido cai em Comum, não fica vazio', () => {
		expect(rotuloDeRaridade(undefined)).toBe('Comum');
		expect(rotuloDeRaridade(9)).toBe('Comum');
	});
});

describe('classeDeRaridade', () => {
	it('r0..r3, uma por raridade', () => {
		expect(classeDeRaridade(0)).toBe('r0');
		expect(classeDeRaridade(1)).toBe('r1');
		expect(classeDeRaridade(2)).toBe('r2');
		expect(classeDeRaridade(3)).toBe('r3');
	});
	it('índice desconhecido cai em r0', () => {
		expect(classeDeRaridade(9)).toBe('r0');
	});
});
