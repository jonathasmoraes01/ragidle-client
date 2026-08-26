/**
 * A TABELA DOS 22 NOMES LOCAIS (25/08/2026) — a frente que o dono abriu.
 *
 * Ver o cabecalho de `src/DB/Items/nomesLocais.js` para o que ela e. O que
 * estes casos guardam sao as tres formas de ela apodrecer:
 *
 *  1. o nome local deixar de chegar a ficha (o fio `completarFicha`);
 *  2. o nome local ATROPELAR um nome de verdade vindo do GRF;
 *  3. a lista apontar para id que o jogo nao dropa (typo de id — e um typo
 *     aqui e invisivel na tela: o item continuaria "desconhecido" e a linha
 *     errada nomearia um item que nunca cai).
 *
 * O caso 3 cruza com o `conteudo.json` do jogo na arvore irma, no MESMO
 * padrao de skipIf que `servidor/protocolo/faixa-ragidle.test.ts` usa na
 * direcao contraria (la o jogo le este fork; aqui o fork le o jogo).
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NOMES_LOCAIS } from 'DB/Items/nomesLocais.js';
import { completarFicha, unknownItem } from 'DB/Items/FichaDoItem.js';

describe('o nome local chega a ficha', () => {
	it('o caso do dono: 4545 com estube vira "Novice Poring Card", nao "Item desconhecido"', () => {
		// O estube real do ItemTable.js que causou o "undefined".
		const ficha = completarFicha(4545, { ClassNum: 0 });
		expect(ficha.identifiedDisplayName).toBe('Novice Poring Card');
		expect(ficha.unidentifiedDisplayName).toBe('Novice Poring Card');
	});

	it('id local AUSENTE da tabela inteira tambem sai batizado', () => {
		// Dos 22, so o 4545 tem estube; os outros 21 caem no caminho !ficha.
		const ficha = completarFicha(25729, null);
		expect(ficha.identifiedDisplayName).toBe('Shadowdecon');
		// ...e o resto continua sendo a ficha de sobra (icone de maca, 0 slot).
		expect(ficha.identifiedResourceName).toBe(unknownItem.identifiedResourceName);
		expect(ficha.slotCount).toBe(0);
	});

	it('id fora da lista continua "Item desconhecido (id)" — a tabela nao vaza', () => {
		expect(completarFicha(999999, {}).identifiedDisplayName).toBe('Item desconhecido (999999)');
		expect(completarFicha(999999, null).identifiedDisplayName).toBe('Unknown Item');
	});

	it('nome do GRF VENCE o local: ficha ja nomeada volta intocada', () => {
		const doGrf = {
			identifiedDisplayName: 'Nome Do GRF',
			unidentifiedDisplayName: 'Nome Do GRF'
		};
		// 4545 esta na tabela local — e mesmo assim o GRF manda.
		expect(completarFicha(4545, doGrf)).toBe(doGrf);
	});
});

describe('a lista aponta so para item que o jogo conhece', () => {
	const CONTEUDO = join(
		process.cwd(),
		'..',
		'Rag Idle 2.0',
		'assets-build',
		'game',
		'conteudo.json'
	);
	const temConteudo = existsSync(CONTEUDO);

	it.skipIf(!temConteudo)('todo id de NOMES_LOCAIS existe no conteudo.json do jogo', () => {
		const conteudo = JSON.parse(readFileSync(CONTEUDO, 'utf8'));
		const lista = Array.isArray(conteudo.tabelas.itens)
			? conteudo.tabelas.itens
			: Object.values(conteudo.tabelas.itens);
		const ids = new Set();
		for (const entrada of lista) {
			const item = Array.isArray(entrada) ? entrada[1] : entrada;
			if (item && typeof item.id === 'number') {
				ids.add(item.id);
			}
		}

		/*
		 * O CONTROLE POSITIVO vem antes do veredito: se a leitura do pacote
		 * mudar de forma e `ids` sair vazio (ou minusculo), "todo id existe"
		 * passaria de graca — o criterio que passa com zero, de novo.
		 */
		expect(ids.size).toBeGreaterThan(500);
		expect(ids.has(501), 'a Pocao Vermelha sumiu do pacote? a leitura quebrou').toBe(true);

		const orfaos = Object.keys(NOMES_LOCAIS)
			.map(Number)
			.filter((id) => !ids.has(id));
		expect(
			orfaos,
			'estes ids da tabela local nao existem no conteudo do jogo — typo de id, ou o item saiu do elenco'
		).toEqual([]);
	});

	it('sao exatamente os 22 da rodada — crescimento passa por aqui', () => {
		/*
		 * Nao e um pino por vaidade: um id somado sem passar pelo cruzamento
		 * acima (na maquina sem a arvore irma, onde ele PULA) entraria cego.
		 * Quem somar o 23o atualiza este numero no mesmo commit — e roda o
		 * cruzamento numa arvore que tenha o conteudo.
		 */
		expect(Object.keys(NOMES_LOCAIS)).toHaveLength(22);
	});
});
