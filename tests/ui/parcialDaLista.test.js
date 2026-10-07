/**
 * O PARCIAL DE LISTA DE MISSOES (07/10/2026, D-2071) - a metade pura do
 * cliente (`MissoesIdle/parcialDaLista.js`) e a declaracao das bases na
 * entrada no mapa (`Engine/declaracaoDasBases.js`). A janela de verdade esta
 * em `listaDeMissoesPorParcial.test.js`; as duas pontas do contrato, no
 * repositorio do jogo (`parcial-das-missoes-no-cliente.test.ts`).
 */
import { describe, expect, it } from 'vitest';

import {
	VERSAO_DO_PARCIAL_DA_LISTA,
	aplicarParcialDaLista,
	caiSobreARevisao,
	declaracaoDasBases,
	ehParcialDaLista,
	pedidoDaLista,
	revisaoDoCorpo
} from 'UI/Components/MissoesIdle/parcialDaLista.js';
import { declararBasesDasJanelas } from 'Engine/declaracaoDasBases.js';

function m(id, estado, progresso, pronta = false) {
	return { id, estado, pronta, objetivos: progresso.map((p, i) => ({ id: id + i, progresso: p, alvo: 9 })) };
}

describe('o parcial de lista: a forma', () => {
	it('so `v: 4` com `parcial: lista` e o parcial', () => {
		expect(VERSAO_DO_PARCIAL_DA_LISTA).toBe(4);
		expect(ehParcialDaLista({ v: 4, parcial: 'lista' })).toBe(true);
		expect(ehParcialDaLista({ v: 4, parcial: 'progresso' })).toBe(false);
		expect(ehParcialDaLista({ v: 3, parcial: 'lista' })).toBe(false);
		expect(ehParcialDaLista(null)).toBe(false);
	});

	it('a revisao do corpo e o `rev` numero, senao nula', () => {
		expect(revisaoDoCorpo({ rev: 5 })).toBe(5);
		expect(revisaoDoCorpo({ rev: '5' })).toBeNull();
		expect(revisaoDoCorpo({})).toBeNull();
		expect(revisaoDoCorpo(null)).toBeNull();
	});

	it('sem `de` o parcial cai sempre (o servidor antigo); com `de`, so sobre a mesma revisao', () => {
		expect(caiSobreARevisao(null, { v: 3 })).toBe(true);
		expect(caiSobreARevisao(7, { v: 3 })).toBe(true);
		expect(caiSobreARevisao(7, { de: 7 })).toBe(true);
		expect(caiSobreARevisao(7, { de: 6 })).toBe(false);
		expect(caiSobreARevisao(null, { de: 6 })).toBe(false);
	});

	it('o pedido e a declaracao levam as chaves SEMPRE (numero ou null)', () => {
		expect(pedidoDaLista(9)).toEqual({ acao: 'pedir', base: 9 });
		expect(pedidoDaLista(null)).toEqual({ acao: 'pedir', base: null });
		expect(pedidoDaLista('9')).toEqual({ acao: 'pedir', base: null });
		expect(declaracaoDasBases(3, 4)).toEqual({ acao: 'bases', missoes: 3, skills: 4 });
		expect(declaracaoDasBases(null, undefined)).toEqual({ acao: 'bases', missoes: null, skills: null });
	});
});

describe('o parcial de lista: a aplicacao', () => {
	it('troca a que mudou, funde o progresso das outras e acende as prontas', () => {
		const antes = [m('a', 'disponivel', [0]), m('b', 'em-andamento', [1])];
		const r = aplicarParcialDaLista(antes, {
			v: 4,
			parcial: 'lista',
			missoes: [m('a', 'em-andamento', [0])],
			progressos: { b: [9] },
			prontas: ['b'],
			campos: { codexComNovidade: true }
		});
		expect(r.missoes).toEqual([m('a', 'em-andamento', [0]), m('b', 'em-andamento', [9], true)]);
		expect(r.campos).toEqual({ codexComNovidade: true });
		expect(r.temRastreador).toBe(false);
		// A lista de antes fica intacta.
		expect(antes[0].estado).toBe('disponivel');
	});

	it('com ordem, a missao que veio troca a de antes (e nao o contrario)', () => {
		const r = aplicarParcialDaLista([m('a', 'disponivel', [0]), m('b', 'disponivel', [0])], {
			v: 4,
			parcial: 'lista',
			missoes: [m('a', 'em-andamento', [0]), m('c', 'disponivel', [0])],
			ordem: ['a', 'c', 'b'],
			prontas: []
		});
		expect(r.missoes.map(x => [x.id, x.estado])).toEqual([
			['a', 'em-andamento'],
			['c', 'disponivel'],
			['b', 'disponivel']
		]);
	});

	it('a ordem nova traz a que nasceu e tira a que sumiu', () => {
		const r = aplicarParcialDaLista([m('a', 'disponivel', [0]), m('b', 'disponivel', [0])], {
			v: 4,
			parcial: 'lista',
			missoes: [m('c', 'disponivel', [0])],
			ordem: ['c', 'a'],
			prontas: []
		});
		expect(r.missoes.map(x => x.id)).toEqual(['c', 'a']);
	});

	it('o rastreador, mesmo vazio, e trocado quando vem', () => {
		const r = aplicarParcialDaLista([m('a', 'disponivel', [0])], { v: 4, parcial: 'lista', prontas: [], codexRastreado: [] });
		expect(r.temRastreador).toBe(true);
		expect(r.codexRastreado).toEqual([]);
	});

	it('o que nao cai devolve null: missao da ordem que nao ha, missao nova sem ordem, progresso que nao casa, lixo', () => {
		const lista = [m('a', 'disponivel', [0])];
		expect(aplicarParcialDaLista(lista, { v: 4, parcial: 'lista', ordem: ['a', 'z'], prontas: [] })).toBeNull();
		expect(aplicarParcialDaLista(lista, { v: 4, parcial: 'lista', missoes: [m('z', 'disponivel', [0])], prontas: [] })).toBeNull();
		expect(aplicarParcialDaLista(lista, { v: 4, parcial: 'lista', progressos: { a: [1, 2] }, prontas: [] })).toBeNull();
		expect(aplicarParcialDaLista(lista, { v: 4, parcial: 'lista', missoes: [{ titulo: 'sem id' }], prontas: [] })).toBeNull();
		expect(aplicarParcialDaLista(lista, { v: 4, parcial: 'lista', missoes: [{ titulo: 'sem id' }], ordem: ['a'], prontas: [] })).toBeNull();
		expect(aplicarParcialDaLista(lista, { v: 3, parcial: 'progresso' })).toBeNull();
		expect(aplicarParcialDaLista(null, { v: 4, parcial: 'lista', prontas: [] })).toBeNull();
	});

	it('sem prontas no parcial, o `pronta` de cada uma fica', () => {
		const r = aplicarParcialDaLista([m('a', 'em-andamento', [9], true)], { v: 4, parcial: 'lista' });
		expect(r.missoes[0].pronta).toBe(true);
	});
});

describe('a declaracao das bases na entrada no mapa', () => {
	function fio() {
		const enviados = [];
		function RAGIDLE_MISSAO_ACAO() {}
		return {
			enviados,
			Network: { sendPacket: p => enviados.push(p) },
			PACKET: { CZ: { RAGIDLE_MISSAO_ACAO } }
		};
	}

	it('manda a revisao da lista e a da arvore no 0x0feb', () => {
		const f = fio();
		declararBasesDasJanelas({
			MissoesIdle: { revisaoDaLista: () => 12 },
			IdleSkills: { revisaoDaArvore: () => 34 },
			Network: f.Network,
			PACKET: f.PACKET
		});
		expect(f.enviados).toHaveLength(1);
		expect(f.enviados[0]).toBeInstanceOf(f.PACKET.CZ.RAGIDLE_MISSAO_ACAO);
		expect(JSON.parse(f.enviados[0].json)).toEqual({ acao: 'bases', missoes: 12, skills: 34 });
	});

	it('sem as janelas (ou sem o metodo), declara as duas como nulas', () => {
		const f = fio();
		declararBasesDasJanelas({ MissoesIdle: {}, IdleSkills: {}, Network: f.Network, PACKET: f.PACKET });
		expect(JSON.parse(f.enviados[0].json)).toEqual({ acao: 'bases', missoes: null, skills: null });
	});
});
