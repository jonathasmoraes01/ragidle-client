/**
 * O CURSOR DESENHADO TEM DE SER A CAMADA MAIS ALTA (25/08/2026).
 *
 * Queixa do dono, jogando: morreu, foi clicar em "Voltar para a cidade" e o
 * ponteiro sumiu ao entrar na janela.
 *
 * A causa não era a janela da morte. `.custom-cursor * { cursor: none }`
 * (CursorManager.js e Common.css:173-175, este replicado dentro de cada
 * Shadow DOM) apaga o ponteiro do SISTEMA na árvore inteira, e o substituto
 * que o cliente desenha vinha em `z-index: 9999`. Qualquer camada acima
 * disso o cobria — e havia sete, de 10000 a 2.000.000. Sobre elas o jogador
 * ficava sem ponteiro nenhum: o do sistema apagado, o desenhado por baixo.
 *
 * ── POR QUE ISTO É UM TESTE, E NÃO UM COMENTÁRIO ─────────────────────────
 * O cabeçalho de DeathWindow.css (linhas 44-52) traz um CENSO de z-index
 * feito com getComputedStyle no jogo rodando — faixa de foco 50-88, popup do
 * UIManager 99, maior solto 1000 — e escolhe 2000000 para ficar acima dos
 * três. O censo está certo em tudo que lista. Ele só não lista esta div.
 *
 * Um censo escrito em prosa não tem como reprovar quando alguém acrescenta a
 * oitava camada. Este arquivo tem: ele varre o fork e falha se QUALQUER
 * z-index alcançar o do cursor. É o mesmo papel de despertador que
 * `servidor/protocolo/faixa-ragidle.test.ts` faz pela faixa de pacotes.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(process.cwd(), 'src');

/** Todo .css e .js sob src/, recursivo. */
function arquivos(dir) {
	const saida = [];
	for (const nome of readdirSync(dir)) {
		const caminho = join(dir, nome);
		if (statSync(caminho).isDirectory()) {
			saida.push(...arquivos(caminho));
		} else if (/\.(css|js)$/.test(nome)) {
			saida.push(caminho);
		}
	}
	return saida;
}

/**
 * Casa `z-index: 123`, `z-index:123` e `zIndex: 123` (a forma de objeto de
 * estilo, que MobileUI.js:56 usa). Sem as três o varredor teria pontos cegos
 * exatamente onde o fork já escreveu z-index de verdade.
 */
const PADRAO = /z-?index"?'?\s*[:=]\s*['"]?(\d+)/gi;

const CURSOR = join(RAIZ, 'UI', 'CursorManager.js');

/** O z-index da div `.cursor`, lido da própria folha que o cliente injeta. */
function zDoCursor() {
	const texto = readFileSync(CURSOR, 'utf8');
	/*
	 * A linha precisa ter `.cursor {` E `z-index` — a folha tem DUAS regras
	 * que casam com o primeiro pedaço (`.custom-cursor .cursor { display:
	 * block; }` é a outra), e pegar a errada devolvia null.
	 */
	const linha = texto.split('\n').find(l => l.includes('.cursor {') && l.includes('z-index'));
	expect(linha, 'a regra `.cursor` com z-index sumiu de CursorManager.js').toBeTruthy();
	const m = /z-index:\s*(\d+)/.exec(linha);
	expect(m, 'a regra `.cursor` deixou de declarar z-index').toBeTruthy();
	return Number(m[1]);
}

describe('o cursor desenhado', () => {
	it('esta declarado no teto do navegador', () => {
		/*
		 * 2147483647 e o maior inteiro de 32 bits com sinal, que e o teto de
		 * z-index nos navegadores. No teto ninguem passa na frente -- qualquer
		 * numero menor volta a perder na proxima camada que alguem criar, e o
		 * sintoma (ponteiro sumido) nao parece defeito de z-index para quem o
		 * encontra depois.
		 */
		expect(zDoCursor()).toBe(2147483647);
	});

	it('esta ACIMA de todo z-index do fork', () => {
		const teto = zDoCursor();
		const todos = [];

		for (const caminho of arquivos(RAIZ)) {
			const texto = readFileSync(caminho, 'utf8');
			for (const m of texto.matchAll(PADRAO)) {
				const valor = Number(m[1]);
				// A propria regra do cursor nao compete consigo mesma.
				if (caminho === CURSOR && valor === teto) {
					continue;
				}
				todos.push({ caminho: caminho.slice(RAIZ.length + 1), valor });
			}
		}

		/*
		 * O CONTROLE POSITIVO vem ANTES do veredito, e ele e o coracao do caso.
		 *
		 * "Nenhuma camada acima do cursor" so vale se o varredor SABE achar
		 * camada. Um regex quebrado (ou um `src/` que mudou de lugar) devolve
		 * lista vazia e aprova para sempre -- a forma catalogada "criterio que
		 * passa com zero". DeathWindow.css:56 e a mais alta que existe hoje e
		 * a que criou este arquivo: se a varredura nao a encontra, ela nao
		 * encontraria a proxima tambem.
		 */
		expect(
			todos.some(z => z.caminho.includes('DeathWindow') && z.valor === 2000000),
			'a varredura NAO achou o z-index 2000000 de DeathWindow.css — o veredito abaixo nao vale nada'
		).toBe(true);
		expect(todos.length, 'a varredura nao leu z-index nenhum').toBeGreaterThan(10);

		const acima = todos.filter(z => z.valor >= teto);

		expect(
			acima,
			'esta(s) camada(s) empatam ou passam o cursor desenhado, e sobre elas o jogador fica SEM ponteiro ' +
				'(o do sistema esta apagado por `.custom-cursor * { cursor: none }`). ' +
				'Baixe a camada — o teto do cursor nao deve ser dividido com ninguem.'
		).toEqual([]);
	});
});
