/**
 * O ITEM 0 DAS POÇÕES AUTOMÁTICAS (D-536).
 *
 * Queixa do dono, jogando: liga as poções automáticas na Configuração idle e
 * a janela responde com dois problemas do servidor —
 *
 *   pocaoDeHp: o item 0 nao e um consumivel de cura do jogo
 *   pocaoDeSp: o item 0 nao e um consumivel de cura do jogo
 *
 * — sendo que o personagem recém-criado recebe pelo correio Poção Vermelha
 * x200 (501) e Poção Azul x200 (505), e o `<select>` da janela MOSTRAVA a
 * poção. Ver `escolhaDePocao.js` para o mecanismo.
 *
 * O dado abaixo é o do kit inicial de verdade (`servidor/kit-inicial.ts`):
 * 501 cura só HP, 505 restaura só SP.
 */

import { describe, expect, it } from 'vitest';
import { escolherPocaoPadrao, pocoesDoEixo } from 'UI/Components/IdleConfig/escolhaDePocao.js';

/** O `contexto.consumiveisDeCura` como o servidor manda desde D-536. */
const DO_KIT = [
	{ itemId: 501, nome: 'Poção Vermelha', estoque: 200, curaHp: true, curaSp: false },
	{ itemId: 505, nome: 'Poção Azul', estoque: 200, curaHp: false, curaSp: true },
	{ itemId: 645, nome: 'Concentration Potion', estoque: 0, curaHp: false, curaSp: false }
];

describe('pocoesDoEixo', () => {
	it('separa os eixos: HP fica com a Vermelha, SP com a Azul', () => {
		expect(pocoesDoEixo(DO_KIT, 'curaHp').map(i => i.itemId)).toEqual([501]);
		expect(pocoesDoEixo(DO_KIT, 'curaSp').map(i => i.itemId)).toEqual([505]);
	});

	it('contrato ANTIGO sem os campos: a lista inteira vale nos dois eixos', () => {
		const semEixo = [{ itemId: 501, nome: 'Poção Vermelha', estoque: 200 }];
		expect(pocoesDoEixo(semEixo, 'curaHp')).toHaveLength(1);
		expect(pocoesDoEixo(semEixo, 'curaSp')).toHaveLength(1);
	});

	it('lista ausente não quebra a janela', () => {
		expect(pocoesDoEixo(undefined, 'curaHp')).toEqual([]);
	});
});

describe('escolherPocaoPadrao', () => {
	it('o BUG DO PRINT: itemId 0 vira a poção que o select já mostrava', () => {
		expect(escolherPocaoPadrao(pocoesDoEixo(DO_KIT, 'curaHp'), 0)).toBe(501);
		expect(escolherPocaoPadrao(pocoesDoEixo(DO_KIT, 'curaSp'), 0)).toBe(505);
	});

	it('não escolhe poção do EIXO ERRADO (D-285 recusaria com "nao restaura SP")', () => {
		// 501 estava escolhida para HP; ligar SP não pode herdar o 501.
		expect(escolherPocaoPadrao(pocoesDoEixo(DO_KIT, 'curaSp'), 501)).toBe(505);
	});

	it('respeita a escolha do jogador quando ela é válida para o eixo', () => {
		const duasDeHp = [
			{ itemId: 501, nome: 'Poção Vermelha', estoque: 200, curaHp: true },
			{ itemId: 502, nome: 'Poção Laranja', estoque: 5, curaHp: true }
		];
		expect(escolherPocaoPadrao(duasDeHp, 502)).toBe(502);
	});

	it('prefere a que TEM estoque — ligar apontando para o que não se carrega é ligar nada', () => {
		const semEstoqueNaFrente = [
			{ itemId: 502, nome: 'Poção Laranja', estoque: 0, curaHp: true },
			{ itemId: 501, nome: 'Poção Vermelha', estoque: 200, curaHp: true }
		];
		expect(escolherPocaoPadrao(semEstoqueNaFrente, 0)).toBe(501);
	});

	it('nada disponível devolve 0 — e aí a janela não deixa ligar', () => {
		expect(escolherPocaoPadrao([], 0)).toBe(0);
	});
});
