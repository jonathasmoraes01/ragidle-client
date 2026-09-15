/**
 * O LEQUE DO MENU CABE NA ALTURA DA TELA (D-1490, 15/09/2026).
 *
 * ---------------------------------------------------------------------------
 * O RELATO, E A CAUSA MEDIDA
 * ---------------------------------------------------------------------------
 * Dono, com print: os discos do menu caem EM CIMA do minimapa e dos botoes
 * "Cacar"/"Retornar para Prontera".
 *
 * **A causa e ALTURA, e nao largura.** O leque cresce PARA CIMA a partir do
 * botao Menu, 60px por fileira, e o numero de fileiras era sempre
 * `ceil(visiveis / 2)` — sem olhar para a tela. Com as 15 entradas de hoje sao
 * 8 fileiras = 566px, e o topo para a 667px do chao; a coluna da direita esta
 * ocupada ate 288px do topo.
 *
 * Medido no navegador, em 1366x768 (uma tela que JA ESTAVA na matriz de provas):
 *
 *   | | com o conserto | com UMA coluna (o de antes) |
 *   |---|---|---|
 *   | topo do leque | y=347 | **y=35** |
 *   | altura | 318px | **630px** |
 *   | invade o minimapa | nao | **SIM** |
 *   | invade os botoes | nao | **SIM** |
 *
 * E em 1920x1080 o valor volta a **1** e nada muda: 630px de altura, 204 de
 * largura, o leque de sempre.
 *
 * ---------------------------------------------------------------------------
 * POR QUE NENHUMA PROVA PEGOU ISSO
 * ---------------------------------------------------------------------------
 * `prove:hud-responsiva` mede 15 telas e NENHUMA abre o menu: o `.tm-fan` fica
 * `display: none` a corrida inteira, e fechado ele nao colide com nada. A lista
 * de paineis dela tambem nao inclui a folha.
 *
 * E o cabecalho da propria prova ja conta essa historia uma vez: *"Ela aprovou
 * 18/18 com os oito discos do menu caindo EM CIMA do rastreador de missoes,
 * porque o rastreador nao tem alvo com os seletores de cima e nao estava na
 * lista."* O mesmo buraco, um nivel abaixo.
 *
 * ---------------------------------------------------------------------------
 * O QUE ESTE ARQUIVO PRENDE
 * ---------------------------------------------------------------------------
 * A medicao de verdade esta acima e foi feita no navegador — o defeito so
 * existe com layout resolvido, que o jsdom nao faz. O que este portao impede e
 * a REGRESSAO barata: alguem devolver o numero fixo de colunas, ou desligar o
 * recalculo no `resize` (que e a metade do conserto: sem ele, quem abre o jogo
 * grande e encolhe a janela fica com o arranjo da largada para sempre).
 *
 * Ele le o fonte com os comentarios REMOVIDOS — sem isso passaria pela propria
 * prosa que explica o conserto.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const JS = readFileSync('src/UI/Components/TopMenuIdle/TopMenuIdle.js', 'utf8');
const CSS = readFileSync('src/UI/Components/TopMenuIdle/TopMenuIdle.css', 'utf8');

const semComentario = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const JS_CRU = semComentario(JS);
const CSS_CRU = semComentario(CSS);

describe('o leque do menu cabe na altura da tela', () => {
	it('a coluna do leque e uma GRADE cuja largura vem de variavel', () => {
		const i = CSS_CRU.indexOf('.tm-col {');
		expect(i, 'sumiu a regra da coluna').toBeGreaterThan(-1);
		const regra = CSS_CRU.slice(i, CSS_CRU.indexOf('}', i));
		expect(
			regra,
			'a coluna voltou a ser uma fila unica: cada item novo volta a empurrar o leque para cima, contra o minimapa'
		).toMatch(/grid-template-columns:\s*repeat\(var\(--tm-leque-colunas/);
	});

	it('quem escolhe o numero MEDE a altura livre, em vez de cravar', () => {
		expect(JS_CRU, 'sumiu a funcao que decide o numero de colunas').toContain('function colunasPorLadoDoLeque');
		const i = JS_CRU.indexOf('function colunasPorLadoDoLeque');
		const corpo = JS_CRU.slice(i, i + 1200);
		expect(corpo, 'parou de olhar a altura da janela').toContain('window.innerHeight');
		expect(
			corpo,
			'parou de descontar a coluna da direita — e ela que diz ate onde o minimapa e os botoes ocupam'
		).toContain('--hud-td-abaixo-da-coluna');
	});

	it('o valor chega ao CSS, e sai da metade MAIS CHEIA', () => {
		const i = JS_CRU.indexOf('function distribuirColunas');
		const corpo = JS_CRU.slice(i, i + 900);
		expect(corpo, 'o numero de colunas nao e publicado no leque').toMatch(
			/setProperty\(\s*'--tm-leque-colunas'/
		);
		// `naEsquerda` e `ceil(visiveis/2)`: a metade cheia. Passar a metade
		// VAZIA subestimaria as fileiras e o leque voltaria a estourar.
		expect(corpo, 'o calculo deixou de usar a metade mais cheia').toMatch(
			/colunasPorLadoDoLeque\(\s*naEsquerda\s*\)/
		);
	});

	it('o arranjo e refeito quando a janela muda de tamanho', () => {
		/*
		 * Metade do conserto. Antes, `distribuirFileiras` e `distribuirColunas`
		 * so rodavam na montagem e na troca de visibilidade do Admin — o unico
		 * ouvinte de `resize` do arquivo republicava a POSICAO do cluster e mais
		 * nada. Quem abrisse grande e encolhesse ficava com o arranjo da largada.
		 */
		const ouvintes = JS_CRU.match(/addEventListener\('resize'/g) || [];
		expect(ouvintes.length, 'o ouvinte de resize do arranjo sumiu').toBeGreaterThanOrEqual(2);
		const i = JS_CRU.lastIndexOf("addEventListener('resize'");
		const corpo = JS_CRU.slice(i, i + 220);
		expect(corpo, 'o resize parou de redistribuir as colunas do leque').toContain('distribuirColunas');
		expect(corpo, 'o resize parou de redistribuir as fileiras do cluster').toContain('distribuirFileiras');
	});
});
