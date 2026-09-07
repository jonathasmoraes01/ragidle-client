/**
 * B1 (2ª metade) — OS MOBS ATRAVESSAVAM A VIAGEM (06/09/2026).
 *
 * ---------------------------------------------------------------------------
 * A QUEIXA, E A PISTA QUE A FECHOU
 * ---------------------------------------------------------------------------
 * Reporte do playtest: *"essa prova de vocação tá liberando antes do 10 de job
 * e tá levando pra Prontera com os mobs"*.
 *
 * A metade do job 10 fechou no servidor (D-1150). A dos mobs ficou aberta
 * porque as quatro portas do SERVIDOR estavam todas fechadas — `viajar` chama
 * `encerrarEncontro` e `mundo.sair` antes do MAPMOVE, o cérebro para com
 * `carregandoMapa`, e `difundirNoMapa` filtra por `estado.mapaAtual`.
 *
 * **A pista decisiva veio do dono:** *"quando eu dei ctrl f5 (sem cache) eu
 * estava em Prontera, e aí foi quando eu dei ctrl f5, e 'desbugou'"*. Um
 * recarregamento conserta estado do CLIENTE, e só dele — foi isso que tirou o
 * diagnóstico do servidor e o trouxe para cá.
 *
 * ---------------------------------------------------------------------------
 * A CAUSA — a limpeza acontecia CEDO DEMAIS
 * ---------------------------------------------------------------------------
 * `MapRenderer.setMap` limpa as entidades no COMEÇO do carregamento:
 *
 *     Background.setLoading(function () {
 *         MapRenderer.free();          // <- EntityManager.free()
 *         Thread.send('LOAD_MAP', ...) // <- o mapa parseia num worker, SEGUNDOS
 *     });
 *
 * Entre esse `free()` e o fim do carregamento a rede continua sendo processada.
 * Todo pacote de entidade do mapa VELHO que ainda estava em voo quando o
 * `viajar` rodou — os mobs que o jogador estava batendo, os passos deles, os
 * que nasceram no mesmo tique — chega DEPOIS da limpeza, entra no
 * `EntityManager` e **sobrevive para o mapa novo**, porque ninguém limpa de
 * novo.
 *
 * Por isso o defeito só aparece quando a viagem acontece NO MEIO DA LUTA — que
 * é exatamente o que a Prova de Vocação faz, já que o primeiro passo dela é
 * `{ tipo: 'travel', mapa: 'prontera' }`.
 *
 * ---------------------------------------------------------------------------
 * O CONSERTO, E POR QUE ELE É SEGURO
 * ---------------------------------------------------------------------------
 * A limpeza passa a acontecer TAMBÉM no fim, dentro de `MapRenderer.onLoad`,
 * imediatamente antes de o cliente mandar `CZ_NOTIFY_ACTORINIT`.
 *
 * **É o instante certo por construção:** o servidor só desce o lote do mapa
 * novo DEPOIS de receber o `ACTORINIT` (`enviarLoteDoMapa`, com
 * `carregandoMapa = false`). Então nada de legítimo existe no
 * `EntityManager` naquele ponto — o que estiver lá é resto do mapa anterior.
 *
 * A limpeza do começo FICA: ela é que apaga a tela enquanto a arte do
 * carregamento sobe. As duas juntas fecham a janela inteira.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const MAP_ENGINE = readFileSync('src/Engine/MapEngine.js', 'utf8');
const MAP_RENDERER = readFileSync('src/Renderer/MapRenderer.js', 'utf8');

/** O corpo de `onMapChange` — o recorte evita casar com o resto do arquivo. */
const ON_MAP_CHANGE = (() => {
	const i = MAP_ENGINE.indexOf('function onMapChange(pkt)');
	const f = MAP_ENGINE.indexOf('function onServerChange', i);
	expect(i).toBeGreaterThan(0);
	expect(f).toBeGreaterThan(i);
	return MAP_ENGINE.slice(i, f);
})();

describe('B1 — nenhuma entidade do mapa velho atravessa a viagem', () => {
	it('a limpeza do COMEÇO continua lá — ela apaga a tela durante a arte', () => {
		expect(MAP_RENDERER).toContain('MapRenderer.free();');
	});

	it('`onLoad` limpa o EntityManager ANTES de readicionar o jogador', () => {
		const limpeza = ON_MAP_CHANGE.indexOf('EntityManager.free()');
		const readiciona = ON_MAP_CHANGE.indexOf('EntityManager.add(Session.Entity)');
		expect(limpeza).toBeGreaterThan(0);
		expect(readiciona).toBeGreaterThan(limpeza);
	});

	it('a limpeza vem ANTES do CZ_NOTIFY_ACTORINIT — o lote novo desce depois dele', () => {
		/*
		 * Esta é a ordem que torna o conserto seguro: o servidor só manda as
		 * entidades do mapa novo ao receber o ACTORINIT. Limpar depois dele
		 * apagaria o que acabou de chegar.
		 */
		const limpeza = ON_MAP_CHANGE.indexOf('EntityManager.free()');
		const actorinit = ON_MAP_CHANGE.indexOf('CZ.NOTIFY_ACTORINIT');
		expect(actorinit).toBeGreaterThan(0);
		expect(actorinit).toBeGreaterThan(limpeza);
	});

	it('o motivo está escrito no código, e cita a viagem no meio da luta', () => {
		// Comentário como memória de decisão: quem mexer aqui de novo precisa
		// saber que a limpeza dupla é deliberada, e não sobra de refatoração.
		expect(ON_MAP_CHANGE).toMatch(/em voo|in flight|ainda chegando/i);
	});
});

describe('B1 — um carregamento que falha não tranca todas as viagens seguintes', () => {
	/*
	 * Vizinho da mesma família, achado no mesmo lugar: `setMap` começa com
	 * `if (this.loading) return;` e `loading` só voltava a `false` no caminho de
	 * SUCESSO. Um mapa que falhasse ao carregar deixava a bandeira presa em
	 * `true`, e daí em diante TODA troca de mapa era descartada em silêncio —
	 * o servidor movia o personagem e o cliente ficava no mapa velho.
	 *
	 * É a outra metade do "só o Ctrl+F5 desbuga".
	 */
	it('o ramo de falha solta a bandeira `loading`', () => {
		const i = MAP_RENDERER.indexOf('function onMapComplete');
		expect(i).toBeGreaterThan(0);
		const corpo = MAP_RENDERER.slice(i, i + 1200);
		const falha = corpo.indexOf('if (!success)');
		expect(falha).toBeGreaterThan(0);
		const ramo = corpo.slice(falha, corpo.indexOf('}', corpo.indexOf('return;', falha)));
		expect(ramo).toContain('loading = false');
	});

	it('a guarda de reentrada continua existindo — o conserto não a removeu', () => {
		expect(MAP_RENDERER).toContain('if (this.loading) {');
	});
});
