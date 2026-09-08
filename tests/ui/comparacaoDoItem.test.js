/**
 * A COMPARAÇÃO COM O EQUIPADO — pedido do alfa (08/09/2026).
 *
 * *"Exiba a diferença dos atributos ao substituir o equipamento atual pelo
 * novo... Deixe claro qual é o item atual e qual é o candidato. Use cores para
 * ganhos e perdas, acompanhadas dos sinais + e -."*
 *
 * Quem CALCULA é o servidor (a régua é a `derivarStats` da janela de status,
 * com bateria própria em `comparacao-de-equipamento`); aqui se mede a
 * MONTAGEM (`htmlDaComparacao`, pura) e a costura da janela, no fonte.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { htmlDaComparacao } from 'UI/Components/MochilaIdle/comparacaoDoItem.js';

const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const RESPOSTA = {
	v: 1,
	acao: 'comparar',
	indice: 5,
	candidato: { itemId: 1108, nome: 'Blade' },
	saem: [{ itemId: 1201, nome: 'Faca' }],
	difs: [
		{ rotulo: 'ATQ', antes: 27, depois: 39, delta: 12 },
		{ rotulo: 'DEF', antes: 9, depois: 4, delta: -5 },
		{ rotulo: 'DES', antes: 1, depois: 3, delta: 2 },
	],
	avisos: ['So o que entra na ficha e comparado.'],
	recusa: null,
};

describe('htmlDaComparacao', () => {
	it('ganho e perda saem com COR e com SINAL — a cor nunca é o único portador', () => {
		const html = htmlDaComparacao(RESPOSTA, esc);
		expect(html).toContain('class="dif-ganho">ATQ +12<');
		expect(html).toContain('class="dif-perda">DEF -5<');
		expect(html).toContain('class="dif-ganho">DES +2<');
	});

	it('diz QUEM sai — o atual é nomeado, e a arma de duas mãos lista os dois', () => {
		expect(htmlDaComparacao(RESPOSTA, esc)).toContain('no lugar de Faca');
		const duasMaos = {
			...RESPOSTA,
			saem: [
				{ itemId: 1201, nome: 'Faca' },
				{ itemId: 2101, nome: 'Guard' },
			],
		};
		expect(htmlDaComparacao(duasMaos, esc)).toContain('no lugar de Faca + Guard');
	});

	it('espaço VAZIO diz que é vazio, em vez de fingir um rival', () => {
		expect(htmlDaComparacao({ ...RESPOSTA, saem: [] }, esc)).toContain('em espaço vazio');
	});

	it('a RECUSA do servidor vira frase — e não um diff em branco', () => {
		const html = htmlDaComparacao({ ...RESPOSTA, recusa: 'exige nivel base 40' }, esc);
		expect(html).toContain('exige nivel base 40');
		expect(html).not.toContain('dif-ganho');
	});

	it('troca sem mudança de ficha diz isso com palavras', () => {
		expect(htmlDaComparacao({ ...RESPOSTA, difs: [] }, esc)).toContain('sem mudança na ficha');
	});

	it('todo texto do servidor passa pelo escapador — nome de item não vira HTML', () => {
		const sujo = { ...RESPOSTA, saem: [{ itemId: 1, nome: '<img src=x>' }] };
		const html = htmlDaComparacao(sujo, esc);
		expect(html).not.toContain('<img src=x>');
		expect(html).toContain('&lt;img');
	});

	it('payload que não é da comparação devolve null — resposta órfã morre calada', () => {
		expect(htmlDaComparacao(null, esc)).toBeNull();
		expect(htmlDaComparacao({ acao: 'outra' }, esc)).toBeNull();
	});
});

describe('a costura da janela', () => {
	const mochila = readFileSync(
		join(process.cwd(), 'src/UI/Components/MochilaIdle/MochilaIdle.js'),
		'utf8',
	);
	const ficha = readFileSync(join(process.cwd(), 'src/UI/Components/ItemInfo/ItemInfo.js'), 'utf8');

	it('só EQUIPÁVEL fora do corpo pede comparação — e o lado a lado abre junto', () => {
		const trecho = mochila.slice(
			mochila.indexOf('function abrirDetalhes'),
			mochila.indexOf('function aoChegarComparacao'),
		);
		expect(trecho).toContain('item.location');
		expect(trecho).toContain('item.WearState');
		expect(trecho).toContain('isInEquipList(item.location)');
		expect(trecho).toContain("JSON.stringify({ acao: 'comparar', indice: item.index })");
	});

	it('a resposta só entra se for do índice PEDIDO e com a ficha aberta', () => {
		const trecho = mochila.slice(mochila.indexOf('function aoChegarComparacao'));
		expect(trecho).toContain('dados.indice !== _indiceComparado');
		expect(trecho).toContain('ItemInfo.uid === -1');
	});

	it('trocar de item na ficha LIMPA o painel — o veredito da espada não vale para a poção', () => {
		const trecho = ficha.slice(ficha.indexOf('ItemInfo.setItem = function setItem'));
		expect(trecho.slice(0, 900)).toContain('ItemInfo.setComparacao(null)');
	});
});
