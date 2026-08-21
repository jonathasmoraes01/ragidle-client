/**
 * O RESUMO QUE REPETIA O TITULO (D-476, achado 4 da rodada 3).
 *
 * `descricao` significa duas coisas diferentes nos dois lados. O servidor manda
 * a CAIXA INTEIRA da descricao do cliente oficial, uma linha do array por linha
 * renderizada — o produtor declara isso por extenso em
 * `tools/skill-name/index.ts`. O cliente lia `descricao[0]` e mais nada.
 *
 * Medido nas 20 arvores jogaveis: **239 de 239** entradas perdiam linhas, num
 * total de **2.194**, e em **237** delas a linha 0 e o proprio nome PT da skill
 * — que o titulo logo acima ja mostra. O paragrafo embaixo de "Bencao" dizia
 * "Bencao (Blessing)", e a frase que diz o que a Bencao FAZ nunca chegava a
 * tela. O ponto de habilidade e irreversivel, e e nesta janela que ele e gasto.
 *
 * Os casos abaixo usam o dado LITERAL do `skilldescript.lua`, e nao um exemplo
 * inventado: as formas foram levantadas antes de a regra ser escrita.
 */

import { describe, expect, it } from 'vitest';
import buildResumo from 'UI/Components/IdleSkills/resumoDaDescricao.js';

/** AL_BLESSING, literal — a forma que 238 das 239 seguem. */
const BLESSING = [
	'Bênção (Blessing)',
	'Nível máximo: 10',
	'Pré-requisitos: Proteção Divina 5',
	'Tipo: Suporte',
	'Descrição:',
	'Aumenta a DES, INT, FOR, Precisão e retira',
	'os efeitos de [Maldição] e [Petrificação].',
	'Em Demônios e Mortos-Vivos, reduz DES,',
	'INT e FOR em 50%.',
	'Nível l DES, INT, FOR l Precisão l Duração',
	'[Nv 1]: +1 l +2 l 60 segundos',
	'[Nv 2]: +2 l +4 l 80 segundos'
];

/** MO_DODGE, literal — a UNICA com marcador e texto na mesma linha. */
const DODGE = [
	'Cair das Pétalas (Dodge)',
	'Nível máximo: 10',
	'Pré-requisitos: Punhos de Ferro 5,',
	'Invocar Esfera Espiritual 5',
	'Tipo: Passiva',
	'Descrição: Aumenta a Esquiva.'
];

/** NV_BASIC, literal — a UNICA cuja linha antes do `[Nv` e prosa de verdade. */
const BASIC = [
	'Habilidades Básicas (Basic Skill)',
	'Nível máximo: 9',
	'Tipo: Passiva',
	'Descrição:',
	'Libera os controles básicos de interface.',
	'[Nv 1]: Sentar',
	'[Nv 2]: Conversar'
];

/** AL_CURE, literal — uma das 38 SEM bloco `[Nv]` nenhum. */
const CURE = [
	'Medicar (Cure)',
	'Nível máximo: 1',
	'Pré-requisitos: Cura 2',
	'Tipo: Suporte',
	'Descrição:',
	'Remove Silêncio, Caos e Cegueira do alvo.',
	'Consome 15 de SP.'
];

describe('D-476: o resumo diz o que a skill FAZ', () => {
	it('O DEFEITO: o resumo nao pode ser o nome que o titulo ja mostra', () => {
		/*
		 * O nucleo do achado. Antes de D-476 esta assercao era o comportamento:
		 * `buildResumo` devolvia exatamente `descricao[0]`.
		 */
		const resumo = buildResumo({ descricao: BLESSING });
		expect(resumo).not.toBe('Bênção (Blessing)');
		expect(resumo).not.toContain('(Blessing)');
	});

	it('junta as linhas quebradas da fonte numa frase so', () => {
		/*
		 * A fonte quebra no meio da frase e o cliente nao reflui, entao as
		 * linhas sao juntadas por espaco. Sem isso o texto sairia picado.
		 */
		expect(buildResumo({ descricao: BLESSING })).toBe(
			'Aumenta a DES, INT, FOR, Precisão e retira os efeitos de [Maldição] e ' +
				'[Petrificação]. Em Demônios e Mortos-Vivos, reduz DES, INT e FOR em 50%.'
		);
	});

	it('o cabecalho da tabela por nivel NAO entra no resumo', () => {
		/*
		 * `"Nível l DES, INT, FOR l Precisão l Duração"` e cabecalho de tabela,
		 * nao prosa — o `l` minusculo e o separador de coluna do lua. Medido:
		 * 200 das 201 com bloco `[Nv]` tem uma linha dessas logo antes.
		 */
		expect(buildResumo({ descricao: BLESSING })).not.toContain(' l ');
	});

	it('mas a prosa que POR ACASO fica antes do bloco continua entrando', () => {
		/*
		 * A FRONTEIRA, e ela tem sujeito: NV_BASIC e a unica das 201 cuja linha
		 * antes do `[Nv` e prosa. Uma regra por POSICAO ("descarta a ultima
		 * linha") a comeria e o Aprendiz ficaria sem resumo nenhum. Por isso o
		 * cabecalho e reconhecido pelo CONTEUDO.
		 */
		expect(buildResumo({ descricao: BASIC })).toBe(
			'Libera os controles básicos de interface.'
		);
	});

	it('marcador e texto na MESMA linha tambem funciona', () => {
		// MO_DODGE e a unica assim nas 239. Uma regra que so olhasse as linhas
		// SEGUINTES ao marcador a deixaria sem resumo.
		expect(buildResumo({ descricao: DODGE })).toBe('Aumenta a Esquiva.');
	});

	it('as 38 SEM bloco `[Nv]` sao as que mais ganham', () => {
		/*
		 * Nelas o painel "Mecanica por nivel" cai no fallback numerico, entao a
		 * prosa descartada era 100% do conteudo util do bloco. A AL_CURE ficava
		 * com "Medicar (Cure)" e mais nada.
		 */
		expect(buildResumo({ descricao: CURE })).toBe(
			'Remove Silêncio, Caos e Cegueira do alvo. Consome 15 de SP.'
		);
	});

	it('sem descricao devolve `null`, e nao uma string vazia', () => {
		expect(buildResumo({ descricao: [] })).toBeNull();
		expect(buildResumo({})).toBeNull();
		expect(buildResumo(null)).toBeNull();
	});

	it('sem marcador cai no comportamento ANTIGO, e nao em nada', () => {
		/*
		 * Ramo conservador: nenhuma das 239 cai aqui hoje, e ele existe para
		 * forma de descricao que esta medicao nao viu. Devolver `null` faria a
		 * janela perder o resumo que ja tinha.
		 */
		expect(buildResumo({ descricao: ['Alguma Skill (Some Skill)', 'outra linha'] })).toBe(
			'Alguma Skill (Some Skill)'
		);
		// E uma descricao que comeca no bloco por nivel nao vira resumo.
		expect(buildResumo({ descricao: ['[Nv 1]: alguma coisa'] })).toBeNull();
	});
});
