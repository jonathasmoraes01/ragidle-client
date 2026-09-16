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
		/*
		 * A conta MUDOU DE CASA em D-1492 e este caso mudou junto: ela virou
		 * `fileirasQueCabemNaAltura`, porque passou a ter DOIS leitores — o
		 * numero de colunas e o teto de rolagem do caso impossivel. Duas copias
		 * da mesma conta divergem na primeira vez que alguem mexe numa delas.
		 *
		 * **Este caso reprovou na extracao, e isso foi ele funcionando**: ele
		 * cobra o ACOPLAMENTO (o numero e medido, e nao cravado), e uma conta
		 * que some do arquivo e indistinguivel de uma conta que virou constante.
		 */
		expect(JS_CRU, 'sumiu a funcao que decide o numero de colunas').toContain('function colunasPorLadoDoLeque');
		expect(JS_CRU, 'sumiu a conta da altura livre').toContain('function fileirasQueCabemNaAltura');

		const i = JS_CRU.indexOf('function fileirasQueCabemNaAltura');
		const corpo = JS_CRU.slice(i, i + 1200);
		expect(corpo, 'parou de olhar a altura da janela').toContain('window.innerHeight');
		expect(
			corpo,
			'parou de descontar a coluna da direita — e ela que diz ate onde o minimapa e os botoes ocupam'
		).toContain('--hud-td-abaixo-da-coluna');

		// E quem escolhe as colunas tem de CONSUMIR a conta, e nao ter a sua.
		const escolha = JS_CRU.slice(
			JS_CRU.indexOf('function colunasPorLadoDoLeque'),
			JS_CRU.indexOf('function colunasPorLadoDoLeque') + 900
		);
		expect(escolha, 'a escolha de colunas deixou de consultar a altura livre').toContain(
			'fileirasQueCabemNaAltura()'
		);
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

	/*
	 * ---------------------------------------------------------------------
	 * OS DOIS DEFEITOS DE `afastarMenuDaDoca` (D-1495, 15/09/2026)
	 * ---------------------------------------------------------------------
	 * O conserto de altura acima criou um encosto no eixo HORIZONTAL: com mais
	 * colunas o leque ficou mais largo e alcancou a barra de atalhos. A
	 * `prove:hud-responsiva` mediu `tm-menu x ShortCut` em tres telas — 20x42,
	 * 89x42 e 173x33 — e a causa e DUPLA, um defeito por tela.
	 *
	 * A medicao de verdade continua sendo a prova no navegador. O que estes dois
	 * casos prendem e a REGRESSAO barata, que e exatamente a forma que o defeito
	 * ja teve: alguem devolver a chamada para antes do `is-mounted`, ou trocar o
	 * degrau medido por uma constante "que da no mesmo".
	 */
	it('a conta da doca so roda com o leque JA montado', () => {
		/*
		 * O defeito de 1024x768. Antes, a chamada vinha 30 linhas ANTES de
		 * `is-mounted`, entao ela media o menu FECHADO (198px de `min-width`) e
		 * concluia que ele nao cruzava a doca — um quadro depois o leque montava
		 * com 2 colunas por lado e cruzava, e ninguem refazia a conta.
		 */
		const i = JS_CRU.indexOf('function aplicarEstadoDoLeque');
		expect(i, 'sumiu a funcao que abre o leque').toBeGreaterThan(-1);
		const corpo = JS_CRU.slice(i, JS_CRU.indexOf('\nfunction ', i + 10));

		const montou = corpo.indexOf("classList.add('is-mounted')");
		const afastou = corpo.indexOf('afastarMenuDaDoca', montou);
		expect(montou, 'o leque parou de ser montado por classe').toBeGreaterThan(-1);
		expect(
			afastou,
			'a conta da doca voltou para antes do `is-mounted`: ela mede o menu FECHADO e nao levanta'
		).toBeGreaterThan(montou);

		// E ela tem de vir antes do `is-open`, senao a transicao parte da posicao
		// errada e o menu "escorrega" para cima na frente do jogador.
		const abriu = corpo.indexOf("classList.add('is-open')", montou);
		expect(afastou, 'a conta da doca passou para depois do `is-open`').toBeLessThan(abriu);
	});

	it('o degrau acima da doca e MEDIDO, e nao uma constante', () => {
		/*
		 * O defeito de 768x1024. Antes, ela escrevia `var(--hud-acima-da-doca)`,
		 * que e a distancia do chao ate o PE da barra — e nas faixas em que a
		 * barra tambem esta ancorada nesse token os dois dividiam a mesma linha
		 * de base, e o menu cobria os 42px dela inteiros.
		 *
		 * Nem o `calc(... + 50px)` que o resto do CSS usa serve aqui: aquele 50 e
		 * "42 da fileira + 8", e a barra vai de UMA a QUATRO fileiras
		 * (`MAX_ROW_COUNT`, `ShortCut.js`). `caixaDaDoca.top` ja sabe de tudo.
		 */
		const i = JS_CRU.indexOf('function afastarMenuDaDoca');
		expect(i, 'sumiu a funcao que afasta o menu da doca').toBeGreaterThan(-1);
		const corpo = JS_CRU.slice(i, JS_CRU.indexOf('\nfunction ', i + 10));

		expect(
			corpo,
			'o degrau voltou a sair de um token do CSS em vez da doca medida'
		).not.toContain('--hud-acima-da-doca');
		expect(corpo, 'a conta parou de medir o topo da doca').toContain('caixaDaDoca.top');
		expect(corpo, 'o respiro acima da doca sumiu da conta').toContain('RESPIRO_ACIMA_DA_DOCA');
		// E o valor escrito continua sendo px, e nao uma expressao do CSS: e o que
		// permite ele mudar com o numero de fileiras da barra.
		expect(corpo).toMatch(/setProperty\(\s*'--tm-base-do-menu'[\s\S]{0,120}'px'/);
	});

	it('o menu VOLTA para o chao quando o leque fecha', () => {
		/*
		 * Sem isto, o menu ficaria levantado para sempre depois da primeira
		 * abertura — fechado ele e estreito e quase nunca cruza a doca, e a altura
		 * que ele ocupa levantado e a que o minimapa e os botoes de caca querem.
		 */
		const i = JS_CRU.indexOf('function aplicarEstadoDoLeque');
		const corpo = JS_CRU.slice(i, JS_CRU.indexOf('\nfunction ', i + 10));
		const depoisDoFecha = corpo.slice(corpo.indexOf("classList.remove('is-open')"));
		const quantas = (depoisDoFecha.match(/afastarMenuDaDoca/g) || []).length;
		expect(
			quantas,
			'os dois caminhos de fechar (imediato e com transicao) precisam refazer a conta'
		).toBe(2);
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
