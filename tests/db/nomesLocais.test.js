/**
 * A TABELA DOS NOMES LOCAIS — 22 drops (25/08/2026) + 14 cosmeticos de loja
 * (31/08/2026), e os 10 icones derivados que vieram com a segunda rodada.
 *
 * Ver o cabecalho de `src/DB/Items/nomesLocais.js` para o que ela e. O que
 * estes casos guardam sao as tres formas de ela apodrecer:
 *
 *  1. o nome local deixar de chegar a ficha (o fio `completarFicha`);
 *  2. o nome local ATROPELAR um nome de verdade vindo do GRF;
 *  3. a lista apontar para id que o jogo nao tem (typo de id — e um typo
 *     aqui e invisivel na tela: o item continuaria "desconhecido" e a linha
 *     errada nomearia um item que nunca aparece).
 *
 * O caso 3 cruza com o `conteudo.json` do jogo na arvore irma, no MESMO
 * padrao de skipIf que `servidor/protocolo/faixa-ragidle.test.ts` usa na
 * direcao contraria (la o jogo le este fork; aqui o fork le o jogo).
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ICONES_LOCAIS, NOMES_LOCAIS } from 'DB/Items/nomesLocais.js';
import { completarFicha, unknownItem } from 'DB/Items/FichaDoItem.js';

describe('o nome local chega a ficha', () => {
	it('o caso do dono: 4545 com estube vira "Novice Poring Card", nao "Item desconhecido"', () => {
		// O estube real do ItemTable.js que causou o "undefined".
		const ficha = completarFicha(4545, { ClassNum: 0 });
		expect(ficha.identifiedDisplayName).toBe('Novice Poring Card');
		expect(ficha.unidentifiedDisplayName).toBe('Novice Poring Card');
		// Desde a Rodada 4c (31/08/2026): tambem sai com o icone de carta
		// generico (o mesmo do 4001) — nao mais a maca.
		expect(ficha.identifiedResourceName).toBe('\xc0\xcc\xb8\xa7\xbe\xf8\xb4\xc2\xc4\xab\xb5\xe5');
	});

	it('id local AUSENTE da tabela inteira tambem sai batizado', () => {
		// Dos 22, so o 4545 tem estube; os outros 21 caem no caminho !ficha.
		// 28382 (Charm Grass Necklace) e o UNICO dos 21 que continua sem icone
		// local (Rodada 4c, 31/08/2026: nenhum candidato achado em CP949).
		const ficha = completarFicha(28382, null);
		expect(ficha.identifiedDisplayName).toBe('Charm Grass Necklace');
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
	/*
	 * A arvore irma tem NOME diferente por maquina — "Rag Idle 2.0" na do
	 * dono, `rag-idle-master` no snapshot de zip do GitHub. O caminho unico
	 * fazia este cruzamento PULAR calado onde a pasta existia com o outro
	 * nome, que e a forma mais silenciosa de um guarda-costas sumir.
	 */
	const CONTEUDO = ['Rag Idle 2.0', 'rag-idle-master']
		.map(pasta => join(process.cwd(), '..', pasta, 'assets-build', 'game', 'conteudo.json'))
		.find(existsSync);
	const temConteudo = CONTEUDO !== undefined;

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

	it('sao exatamente os 37 das tres rodadas — crescimento passa por aqui', () => {
		/*
		 * Nao e um pino por vaidade: um id somado sem passar pelo cruzamento
		 * acima (na maquina sem a arvore irma, onde ele PULA) entraria cego.
		 * Quem somar o 38o atualiza este numero no mesmo commit — e roda o
		 * cruzamento numa arvore que tenha o conteudo.
		 *
		 * 22 dos drops (25/08) + 14 da Loja de Cosmeticos (31/08) + o 420010,
		 * o cosmetico de CABECA que o dono pediu no mesmo dia (D-796).
		 */
		expect(Object.keys(NOMES_LOCAIS)).toHaveLength(37);
	});
});

describe('o icone local (31/08/2026)', () => {
	/** O 20501 (Costume Mechanic Wing) e o primeiro da lista derivada. */
	const ASA_MECANICA = '\xb8\xde\xc4\xab\xb4\xd0\xc0\xae';

	it('o cosmetico sem recurso no GRF sai com o icone derivado, e nao com a maca', () => {
		// O caminho !ficha: 13 dos 14 nao estao em tabela nenhuma do GRF.
		const ficha = completarFicha(20501, null);
		expect(ficha.identifiedDisplayName).toBe('Costume Mechanic Wing');
		expect(ficha.identifiedResourceName).toBe(ASA_MECANICA);
	});

	it('...e pelo caminho do estube tambem', () => {
		const ficha = completarFicha(20501, { ClassNum: 0 });
		expect(ficha.identifiedResourceName).toBe(ASA_MECANICA);
	});

	it('o RECURSO do GRF vence o derivado — o caso do 20512', () => {
		/*
		 * O 20512 (Costume Adventurer's Backpack) e o unico dos 14 que TEM
		 * recurso na tabela do GRF e nao tem nome: ele chega aqui pela metade,
		 * e o `??` tem de preservar o que veio. Se esta linha inverter, um
		 * item que o GRF ja resolvia passa a usar palpite nosso.
		 */
		const meia = { identifiedResourceName: 'oQueOGrfTrouxe' };
		const ficha = completarFicha(20512, meia);
		expect(ficha.identifiedResourceName).toBe('oQueOGrfTrouxe');
		expect(ficha.identifiedDisplayName).toBe("Costume Adventurer's Backpack");
	});

	it('o lado NAO-IDENTIFICADO continua a maca — o icone derivado nao vaza para la', () => {
		// Medido no GRF: o recurso nao-identificado de todo cosmetico e o capuz
		// generico, e nao o icone do item. Ver o cabecalho de ICONES_LOCAIS.
		expect(completarFicha(20501, null).unidentifiedResourceName).toBe(unknownItem.unidentifiedResourceName);
		expect(completarFicha(20501, {}).unidentifiedResourceName).toBe(unknownItem.unidentifiedResourceName);
	});

	it('id COM nome local e SEM icone local continua com a maca', () => {
		// 20500, 20606 e 400171 ficaram de fora: o `.bmp` derivado nao existe
		// no GRF. Nomear sem icone e o estado correto deles.
		for (const id of [20500, 20606, 400171]) {
			expect(ICONES_LOCAIS[id]).toBeUndefined();
			expect(completarFicha(id, null).identifiedResourceName).toBe(unknownItem.identifiedResourceName);
		}
	});

	it('28382 (Charm Grass Necklace) e o UNICO dos 21 sem arte comprovavel (Rodada 4c, 31/08/2026)', () => {
		// Nao e questao de peneira: nenhum candidato foi achado nos 88
		// arquivos da pasta de colar, nem em transliteracao nem em traducao.
		expect(ICONES_LOCAIS[28382]).toBeUndefined();
		expect(completarFicha(28382, null).identifiedResourceName).toBe(unknownItem.identifiedResourceName);
	});

	it('todo id de ICONES_LOCAIS tem nome em NOMES_LOCAIS', () => {
		/*
		 * Icone sem nome seria um item com a arte certa e o rotulo "Item
		 * desconhecido (id)" — meia correcao, e a metade que o dono ve.
		 */
		const semNome = Object.keys(ICONES_LOCAIS).filter(id => NOMES_LOCAIS[id] === undefined);
		expect(semNome, 'estes ids tem icone local e nenhum nome local').toEqual([]);
	});

	it('sao exatamente 31: 10 derivados de cosmetico + 1 DESENHADO + 5 ASCII + 10 CP949 (familia unica) + 5 CP949 (icone de familia)', () => {
		/*
		 * Os 10 derivados de cosmetico sao 10 e nao 13 porque `View` NAO e
		 * chave unica (20500/20765 dividem o 1; 20606/20727 dividem o 5). Quem
		 * somar mais um roda de novo a derivacao no GRF —
		 * `.tmp-scratch/icone-do-cosmetico.ts`, no repositorio do jogo — em vez
		 * de deduzir da tabela.
		 *
		 * O 11o (420010) e de outra natureza: o `.bmp` nao existe no GRF, foi
		 * FEITO do sprite do item (D-796). Ele nao sai da derivacao e nao entra
		 * naquela contagem.
		 *
		 * Os 5 da Rodada 4 (31/08/2026) tem `.bmp` no GRF sob o proprio
		 * `AegisName` em ASCII — achado, nao derivado
		 * (`.tmp-scratch/buscar-recurso-crimson.ts`).
		 *
		 * Os 10 da Rodada 4b (a contraprova em CP949, mesma data) sao a
		 * derivacao 진홍의<tipo>/도람<peca>, dono UNICO cada — ver o cabecalho
		 * de ICONES_LOCAIS e `.tmp-scratch/gerar-escapes-icones-locais.ts`.
		 *
		 * Os 5 da Rodada 4c (correcao de criterio, mesma data) sao icone DE
		 * FAMILIA — 4 Foxtail dividindo 여우의꼬리 (mesmo recurso, 4 ids
		 * nossos + 51 outros) + o Novice Poring Card dividindo 이름없는카드
		 * com o 4001 e mais 110 cartas do elenco.
		 */
		expect(Object.keys(ICONES_LOCAIS)).toHaveLength(31);
	});

	it('os 5 mob-drop com .bmp proprio no GRF, em ASCII (Rodada 4, 31/08/2026)', () => {
		expect(completarFicha(23256, null).identifiedResourceName).toBe('elixir_bandage');
		expect(completarFicha(25729, null).identifiedResourceName).toBe('shadowdecon');
		expect(completarFicha(25731, null).identifiedResourceName).toBe('zelunium');
		expect(completarFicha(100796, null).identifiedResourceName).toBe('darkness_bible');
		expect(completarFicha(101331, null).identifiedResourceName).toBe('fruits_set_trap');
	});

	it('os 7 Crimson/Scarlet com .bmp em CP949 (진홍의<tipo>, Rodada 4b)', () => {
		// A queixa do dono era exatamente a "Crimson Bible" (28604) — agora com
		// icone de verdade, e nao mais a maca.
		const JINHONG_UI = '\xc1\xf8\xc8\xab\xc0\xc7'; // 진홍의 (jinhong-ui, "de carmesim")
		const casos = {
			1443: 'Crimson Spear',
			13127: 'Crimson Revolver',
			16040: 'Crimson Mace',
			21015: 'Crimson Two-Handed Sword',
			28007: 'Crimson Katar',
			28604: 'Crimson Bible',
			28705: 'Crimson Dagger'
		};
		for (const [id, nome] of Object.entries(casos)) {
			const ficha = completarFicha(Number(id), null);
			expect(ficha.identifiedDisplayName).toBe(nome);
			expect(ficha.identifiedResourceName.startsWith(JINHONG_UI), `${id} deveria comecar com 진홍의`).toBe(true);
			expect(ficha.identifiedResourceName).not.toBe(unknownItem.identifiedResourceName);
		}
	});

	it('os 3 Doram_Only_* com .bmp em CP949 (도람<peca>, Rodada 4b)', () => {
		const DORAM = '\xb5\xb5\xb6\xf7'; // 도람 (doram)
		const casos = {
			15126: 'Private Doram Suits',
			20788: 'Private Doram Manteau',
			22083: 'Private Doram Shoes'
		};
		for (const [id, nome] of Object.entries(casos)) {
			const ficha = completarFicha(Number(id), null);
			expect(ficha.identifiedDisplayName).toBe(nome);
			expect(ficha.identifiedResourceName.startsWith(DORAM), `${id} deveria comecar com 도람`).toBe(true);
			expect(ficha.identifiedResourceName).not.toBe(unknownItem.identifiedResourceName);
		}
	});

	it('os 4 Foxtail dividem o icone DE FAMILIA (여우의꼬리, Rodada 4c) — nao e disputa de identidade', () => {
		/*
		 * Correcao de criterio (31/08/2026): a peneira 2 barra DISPUTA DE
		 * IDENTIDADE (dois itens DIFERENTES competindo por um `.bmp` que so
		 * pertence a um — o caso `View` 1 dos cosmeticos), nao icone DE
		 * FAMILIA compartilhado — o precedente ja aceito e o 20503/20844
		 * (mesma sacola). Os 4 Foxtail SAO Foxtails: recebem o mesmo `.bmp`
		 * dos outros 51 AegisNames da familia, de proposito.
		 */
		const FOXTAIL = '\xbf\xa9\xbf\xec\xc0\xc7\xb2\xbf\xb8\xae'; // 여우의꼬리
		const casos = {
			1690: 'Mysterious Foxtail Staff',
			1691: 'Strange God Foxtail Staff',
			1694: 'Foxtail Model',
			1695: 'Fine Foxtail Replica'
		};
		for (const [id, nome] of Object.entries(casos)) {
			const ficha = completarFicha(Number(id), null);
			expect(ficha.identifiedDisplayName).toBe(nome);
			expect(ficha.identifiedResourceName).toBe(FOXTAIL);
		}
	});

	it('4545 (Novice Poring Card) recebe o icone generico de carta (이름없는카드, Rodada 4c)', () => {
		// O mesmo recurso do 4001 (Poring Card oficial) — comportamento
		// canonico de carta sem ilustracao propria, nao uma brecha.
		const CARTA_GENERICA = '\xc0\xcc\xb8\xa7\xbe\xf8\xb4\xc2\xc4\xab\xb5\xe5'; // 이름없는카드
		const ficha = completarFicha(4545, null);
		expect(ficha.identifiedDisplayName).toBe('Novice Poring Card');
		expect(ficha.identifiedResourceName).toBe(CARTA_GENERICA);
		expect(ficha.identifiedResourceName).not.toBe(unknownItem.identifiedResourceName);
	});
});

describe('o cosmetico de cabeca que o dono pediu (420010, D-796)', () => {
	/** O nome do `.bmp` que fizemos, em `cliente/icones-de-item/`. */
	const ICONE_PROPRIO = '_Cons_Of_Darkness';

	it('sai nomeado e com o icone NOSSO, e nao "Unknown Item" com a maca', () => {
		// O 420010 nao esta em tabela nenhuma do GRF: cai no caminho `!ficha`.
		const ficha = completarFicha(420010, null);
		expect(ficha.identifiedDisplayName).toBe('Costume Dark Master');
		expect(ficha.identifiedResourceName).toBe(ICONE_PROPRIO);
		expect(ficha.identifiedResourceName).not.toBe(unknownItem.identifiedResourceName);
	});

	it('o nome do recurso e ASCII e casa com o `HatTable` — a caixa importa', () => {
		/*
		 * Duas armadilhas num pino so. (1) CP949: nome de recurso do GRF e
		 * coreano e `toLowerCase()` corrompe o byte; escolhendo ASCII o nosso
		 * nome nao entra nessa classe. (2) CAIXA: o servidor de assets acha o
		 * arquivo por comparacao de caminho, e no Linux do contêiner
		 * `_cons_of_darkness.bmp` NAO responde a um pedido de
		 * `_Cons_Of_Darkness.bmp`. As tres grafias — arquivo, receita e esta
		 * tabela — tem de ser a mesma.
		 */
		const recurso = ICONES_LOCAIS[420010];
		// eslint-disable-next-line no-control-regex
		expect(/^[\x20-\x7e]+$/.test(recurso), 'o recurso saiu do ASCII').toBe(true);
		expect(recurso).toBe(ICONE_PROPRIO);
	});

	it('se o GRF um dia ilustrar este item, o dele VENCE', () => {
		// A tabela local e um remendo, nao uma preferencia: no dia em que a
		// arte oficial aparecer, ninguem precisa lembrar de apagar nada.
		const doGrf = { identifiedResourceName: 'oQueOGrfTrouxe' };
		expect(completarFicha(420010, doGrf).identifiedResourceName).toBe('oQueOGrfTrouxe');
	});
});
