/**
 * A TABELA DOS NOMES LOCAIS — 22 drops (25/08/2026) + 14 cosmeticos de loja
 * (31/08/2026) + 5 de loja de NPC (01/09/2026), e os 35 icones que vieram
 * com as rodadas 2 a 5.
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
	it('o estube do ItemTable vira o nome local, e nao "Item desconhecido"', () => {
		/*
		 * O caso do dono era o 4545 (Novice Poring Card), que saiu do jogo com a
		 * virada para pre-renewal (22/09/2026). O mecanismo continua: o 12849
		 * (Combination Kit) tambem e um estube `{ ClassNum: 0 }` no ItemTable.js,
		 * e o estube e truthy — sem a tabela local ele voltaria sem nome.
		 */
		const ficha = completarFicha(12849, { ClassNum: 0 });
		expect(ficha.identifiedDisplayName).toBe('Combination Kit');
		expect(ficha.unidentifiedDisplayName).toBe('Combination Kit');
	});

	it('id local AUSENTE da tabela inteira tambem sai batizado', () => {
		// O 20500 (Archangel Wing) nao esta no ItemTable.js e nao tem icone local
		// (o `.bmp` derivado nao existe no GRF): cai no caminho !ficha. A cobaia
		// era o 28382, que saiu do jogo com a virada para pre-renewal.
		const ficha = completarFicha(20500, null);
		expect(ficha.identifiedDisplayName).toBe('Archangel Wing');
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
		// 12849 esta na tabela local — e mesmo assim o GRF manda.
		expect(completarFicha(12849, doGrf)).toBe(doGrf);
	});
});

describe('a lista aponta so para item que o jogo conhece', () => {
	/*
	 * A arvore irma tem NOME diferente por maquina — "Rag Idle 2.0" na do
	 * dono, `rag-idle-master` no snapshot de zip do GitHub. O caminho unico
	 * fazia este cruzamento PULAR calado onde a pasta existia com o outro
	 * nome, que e a forma mais silenciosa de um guarda-costas sumir.
	 */
	/*
	 * `RAG_JOGO` vem PRIMEIRO (08/09/2026): numa WORKTREE, `..` aponta para
	 * dentro do proprio repositorio do cliente e nenhum dos dois nomes existe
	 * — o cruzamento PULAVA calado justamente na arvore onde a tabela estava
	 * sendo mudada. E a irma da `RAG_FORK` que o repositorio do jogo usa para
	 * achar este fork.
	 */
	const CONTEUDO = [
		process.env.RAG_JOGO ? join(process.env.RAG_JOGO, 'assets-build', 'game', 'conteudo.json') : null,
		...['Rag Idle 2.0', 'rag-idle-master'].map(pasta =>
			join(process.cwd(), '..', pasta, 'assets-build', 'game', 'conteudo.json')
		)
	]
		.filter(Boolean)
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

	it('sao exatamente os 61 que sobraram das nove rodadas — crescimento passa por aqui', () => {
		/*
		 * Nao e um pino por vaidade: um id somado sem passar pelo cruzamento
		 * acima (na maquina sem a arvore irma, onde ele PULA) entraria cego.
		 * Quem somar o 84o atualiza este numero no mesmo commit — e roda o
		 * cruzamento numa arvore que tenha o conteudo.
		 *
		 * **Rodada 7 (14/09/2026, D-1420 — o corte da fonte de spawn):** +3, e
		 * eles sao a prova de que a porta contraria funciona. Nenhum dos tres e
		 * item NOVO no `item_db`: o que mudou foi CAIREM DE BICHO QUE AGORA
		 * NASCE, porque 9 especies entraram com a fonte pre-renewal. Quem
		 * perguntou foi exatamente o `servidor/drop-com-nome.test.ts` que o
		 * paragrafo abaixo descreve — ele reprovou dizendo que 3 drops
		 * chegariam ao jogador como "Item desconhecido (id)": o 25508
		 * (Orc Warlord Token, do Orc Hero em `gef_fild02`) e os 28106 e 28380
		 * (Crimson Two-Handed Axe e Fresh Grass Necklace, dos Kobold de
		 * `gef_fild06`/`gef_fild08`). Os dois ultimos sao irmaos de familias que
		 * esta tabela ja conhecia.
		 *
		 * 22 dos drops (25/08) + 14 da Loja de Cosmeticos (31/08) + o 420010,
		 * o cosmetico de CABECA que o dono pediu no mesmo dia (D-796) + os 5
		 * das LOJAS DE NPC do catalogo (01/09, D-900) + os **34 dos MAPAS
		 * NOVOS** (08/09, D-1226 — o relato do alfa sobre o 1680, e os outros
		 * 33 que a mesma medicao achou) + os **4 do MERCADO DE EDEN**
		 * (11/09, D-1330): a loja entrou em `LOJAS_DO_JOGO` DEPOIS da medicao de
		 * 01/09 — que a tinha excluido de proposito, com o "rode de novo quando
		 * ela entrar" escrito — e ninguem refez o cruzamento. Mesma causa da
		 * Rodada 6: a MEDIDA, e nao o item.
		 *
		 * **E o pino deixou de ser a unica defesa.** Ele existia porque o
		 * cruzamento acima PULA na maquina sem a arvore irma, e um pino nao
		 * responde "falta alguem?" — so "entrou alguem?". Foi por isso que os
		 * 34 puderam crescer em silencio: o catalogo de mapas quadruplicou e
		 * nada perguntava pela direcao contraria. Quem pergunta agora e
		 * `servidor/drop-com-nome.test.ts`, no repositorio do jogo, que cruza
		 * TODO drop de TODO monstro contra esta tabela — e, desde D-1330, as SEIS portas
		 * por onde item chega ao jogador (drop, loja, forja, flecha, Velha Caixa
		 * e recompensa de missao), com piso por porta para porta muda reprovar.
		 */
		/*
		 * **Rodada 8 (22/09/2026):** +26, os visuais custom da Season 1
		 * (9.000.300-9.000.325). Eles sao a primeira leva que NAO vem de um
		 * buraco do GRF: os ids sao NOSSOS, entao tabela nenhuma do cliente
		 * podia te-los. Medido no jogo vivo com a Pocao Vermelha de CONTROLE.
		 */
		/*
		 * **As Rodadas 1 e 6 SAIRAM (22/09/2026): -59, de 109 para 50.** O
		 * cruzamento acima reprovava apontando os 59 — todos itens do ramo
		 * renewal (os 22 drops, os 24 dos mapas novos, os 3 de D-1420 e as 10
		 * cartas), que a virada para pre-renewal tirou do `conteudo.json`. Ele
		 * passava verde na maquina que nao tem a arvore irma, porque la ele PULA
		 * — e o que o paragrafo acima avisa. Sobram as Rodadas 2, 3, 5, 7 e 8:
		 * 14 + 1 + 5 + 4 + 26.
		 */
		/*
		 * **Rodada 9 (22/09/2026, RO Shop):** +11, os consumiveis de cash
		 * 9.000.100-9.000.110 (os dois Manuais que ja existiam e os nove itens
		 * novos do RO Shop). O cruzamento acima so os aceita com o
		 * `conteudo.json` regerado pela branch do RO Shop (B-RS-08 do servidor).
		 */
		expect(Object.keys(NOMES_LOCAIS)).toHaveLength(61);
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

	it('todo id de ICONES_LOCAIS tem nome em NOMES_LOCAIS', () => {
		/*
		 * Icone sem nome seria um item com a arte certa e o rotulo "Item
		 * desconhecido (id)" — meia correcao, e a metade que o dono ve.
		 */
		const semNome = Object.keys(ICONES_LOCAIS).filter(id => NOMES_LOCAIS[id] === undefined);
		expect(semNome, 'estes ids tem icone local e nenhum nome local').toEqual([]);
	});

	it('sao exatamente 15: 10 derivados de cosmetico + 1 DESENHADO + 4 siropes', () => {
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
		 * Os 4 da Rodada 5 (01/09/2026) sao os siropes do Advanced Potion
		 * Merchant: 상급포션-<cor>, a traducao literal de `High_*Potion`, com
		 * dono UNICO cada e nenhum id reivindicando o `.bmp` na tabela do GRF
		 * (`.tmp-scratch/provar-icone-siropes.ts`, no repositorio do jogo).
		 *
		 * **Eram 56 ate 22/09/2026.** Os 41 icones das Rodadas 4, 4b, 4c e 6
		 * (Crimson, Doram, Foxtail, as cartas no 이름없는카드 e os cinco ASCII)
		 * sairam junto com os nomes deles: eram todos itens do ramo renewal, e a
		 * virada para pre-renewal os tirou do jogo. A pesquisa de cada derivacao
		 * continua no historico: `git log -S "진홍의" -- src/DB/Items/nomesLocais.js`.
		 */
		expect(Object.keys(ICONES_LOCAIS)).toHaveLength(15);
	});
});

describe('as LOJAS DE NPC do catalogo (Rodada 5, 01/09/2026 — D-900)', () => {
	/** 상급포션 (sanggeup posyeon, "posao de grau superior") + a cor. */
	const SANGGEUP_POSYEON = '\xbb\xf3\xb1\xde\xc6\xf7\xbc\xc7-';

	it('a queixa do dono: os 4 do Advanced Potion Merchant saem nomeados e com icone', () => {
		/*
		 * O print era a loja com QUATRO linhas "Unknown Item" e a mesma maca
		 * nas quatro — o dono leu como "esse npc esta sem itens", e nao como
		 * "os nomes sumiram", porque uma vitrine sem nome nem icone nao parece
		 * uma vitrine. Este caso guarda as DUAS metades.
		 */
		const casos = {
			11621: 'Red Syrup',
			11622: 'Yellow Syrup',
			11623: 'White Syrup',
			11624: 'Blue Syrup'
		};
		for (const [id, nome] of Object.entries(casos)) {
			// Os 4 nao estao no ItemTable.js: caem no caminho `!ficha`, o que
			// dava o "Unknown Item" cru (e nao o "Item desconhecido (id)").
			const ficha = completarFicha(Number(id), null);
			expect(ficha.identifiedDisplayName).toBe(nome);
			expect(ficha.identifiedResourceName.startsWith(SANGGEUP_POSYEON), `${id} deveria comecar com 상급포션-`).toBe(true);
			expect(ficha.identifiedResourceName).not.toBe(unknownItem.identifiedResourceName);
		}
	});

	it('cada sirope tem o SEU arquivo — a cor nao pode colar quatro no mesmo icone', () => {
		/*
		 * O modo de falha barato desta rodada seria copiar a linha e esquecer
		 * de trocar os bytes da cor: os quatro passariam no caso acima (todos
		 * comecam com o prefixo) e a vitrine mostraria quatro frascos iguais —
		 * exatamente o sintoma que estamos consertando, com outra arte.
		 */
		const recursos = [11621, 11622, 11623, 11624].map(id => ICONES_LOCAIS[id]);
		expect(new Set(recursos).size).toBe(4);
	});

	it('12849 (Combination Kit) ganha NOME e continua com a maca — ausencia real de arte', () => {
		// Mesmo veredito do 28382: o GRF nao tem 조합/합성 em icone nenhum, e
		// os 3 키트 que existem sao outros itens. Nomear sem icone e o estado
		// correto dele.
		const ficha = completarFicha(12849, null);
		expect(ficha.identifiedDisplayName).toBe('Combination Kit');
		expect(ICONES_LOCAIS[12849]).toBeUndefined();
		expect(ficha.identifiedResourceName).toBe(unknownItem.identifiedResourceName);
	});

	it('o lado NAO-IDENTIFICADO dos siropes nao recebe o icone — a loja vende identificado', () => {
		// Mesma regra da Rodada 2: `ICONES_LOCAIS` so alimenta o lado
		// identificado, e a loja marca `IsIdentified` em tudo que vende.
		expect(completarFicha(11621, null).unidentifiedResourceName).toBe(unknownItem.unidentifiedResourceName);
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
