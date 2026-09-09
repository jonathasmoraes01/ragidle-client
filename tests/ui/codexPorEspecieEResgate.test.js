/**
 * O CODEX POR ESPÉCIE, A BOLINHA E O RESGATE (D-1231/D-1232, 08/09/2026).
 *
 * ---------------------------------------------------------------------------
 * O QUE ESTE ARQUIVO MEDE, E POR QUE ELE LÊ O FONTE
 * ---------------------------------------------------------------------------
 * `CodexIdle.js` é janela: Shadow DOM, `Renderer`, `Network` e o
 * `UIManager.addComponent` no fim do arquivo. Importá-lo num vitest sobe meia
 * interface, e o que se quer cobrar aqui não é o pixel — é que as LIGAÇÕES
 * existam:
 *
 *  - a linha por espécie usa o `falta` que o servidor manda, em vez de subtrair
 *    sozinha (D-1231);
 *  - o botão de resgate obedece ao `aResgatar` do servidor, e não a um
 *    `cumprida && tem prêmio` reescrito aqui (D-1232);
 *  - a bolinha do menu lê o módulo de um fato só, e o menu não recalcula regra;
 *  - o aviso é zerado na troca de personagem.
 *
 * É o mesmo instrumento de `mobNaoAtravessaAViagem.test.js`: portão de fonte
 * para "a chamada continua no lugar". Quem mede o NÚMERO é o repositório do
 * jogo (`servidor/codex-marcos-e-aviso.test.ts`), e as duas metades se cobrem.
 *
 * O módulo `avisoDoCodex.js` é puro, então ele é testado DE VERDADE embaixo.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
	anotarAvisoDoCodex,
	limparAvisoDoCodex,
	temAvisoDoCodex
} from 'UI/Components/avisoDoCodex.js';

const CODEX = readFileSync('src/UI/Components/CodexIdle/CodexIdle.js', 'utf8');
/**
 * O MESMO código, sem comentário.
 *
 * Portão de fonte tem dois modos de mentir conhecidos neste projeto, e o
 * primeiro é casar dentro de COMENTÁRIO. Ele mordeu na primeira corrida deste
 * arquivo: o comentário que explica por que o resgate vem antes do "+" CITA
 * `closest('.cx-mais')`, e a comparação de posição leu o comentário como
 * código. Ver `semComentarios` em `costura-do-codex.test.ts`, no repo do jogo.
 */
const CODEX_CODIGO = CODEX.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const TOP_MENU = readFileSync('src/UI/Components/TopMenuIdle/TopMenuIdle.js', 'utf8');
const TOP_MENU_HTML = readFileSync('src/UI/Components/TopMenuIdle/TopMenuIdle.html', 'utf8');
const MISSOES = readFileSync('src/UI/Components/MissoesIdle/MissoesIdle.js', 'utf8');
const CODEX_CSS = readFileSync('src/UI/Components/CodexIdle/CodexIdle.css', 'utf8');

describe('D-1231 — o progresso por espécie', () => {
	it('o aparelho enxerga o arquivo — controle positivo', () => {
		expect(CODEX.length).toBeGreaterThan(10_000);
		expect(CODEX).toContain('function missoesHtml');
	});

	it('desenha uma linha POR espécie, e não só os nomes', () => {
		// Antes de D-1231 a linha era `m.alvos.map(a => a.monstro).join(' · ')`.
		expect(CODEX).not.toContain("m.alvos.map(a => escapeHtml(a.monstro)).join(' · ')");
		expect(CODEX).toContain('cx-especie-nome');
		expect(CODEX).toContain('cx-especie-conta');
		expect(CODEX).toContain('cx-especie-falta');
	});

	it('o que falta VEM do servidor — a janela não subtrai', () => {
		/*
		 * `falta` é campo do retrato (`LinhaDoCodex.alvos[].falta`). Uma
		 * subtração local acertaria hoje e divergiria no dia em que o servidor
		 * capasse o contador de outro jeito — que é justamente o que ele faz
		 * (`Math.min(abates, alvo)`).
		 */
		expect(CODEX).toContain('const falta = Number(a.falta) || 0;');
		expect(CODEX).toContain("'faltam ' + escapeHtml(falta)");
	});

	it('a barra somada CONTINUA — ela é o progresso da entrada', () => {
		expect(CODEX).toContain('cx-missao-barra');
		// O contador da entrada (a SOMA) continua ao lado da barra: tirar a
		// soma trocaria um defeito por outro — ela é o progresso da ENTRADA,
		// e é ela que o jogador reconhece.
		expect(CODEX_CODIGO).toContain('cx-missao-progresso');
		expect(CODEX_CODIGO).toContain('escapeHtml(abates)');
		expect(CODEX_CODIGO).toContain('escapeHtml(alvo)');
	});

	it('a linha da espécie reflui no celular em pé', () => {
		expect(CODEX_CSS).toContain('@media (max-width: 599px), (pointer: coarse)');
		const i = CODEX_CSS.indexOf('@media (max-width: 599px), (pointer: coarse)');
		const bloco = CODEX_CSS.slice(i);
		expect(bloco).toContain('.cx-especie {');
		expect(bloco).toContain('grid-template-columns: auto 1fr;');
	});
});

describe('D-1232 — o resgate', () => {
	it('o botão obedece ao `aResgatar` do servidor', () => {
		expect(CODEX).toContain('const resgate = m.aResgatar');
		// E NÃO a uma regra reescrita aqui: `pagas` mora no servidor.
		expect(CODEX).not.toContain('m.cumprida && premio ?');
	});

	it('o clique manda o verbo `resgatar` com o id da entrada', () => {
		expect(CODEX).toContain("enviarAcao({ acao: 'resgatar', id: id })");
	});

	it('o resgate é tratado ANTES do "+" na mesma delegação', () => {
		const resgatar = CODEX_CODIGO.indexOf("closest('.cx-resgatar')");
		const mais = CODEX_CODIGO.indexOf("closest('.cx-mais')");
		expect(resgatar).toBeGreaterThan(0);
		expect(mais).toBeGreaterThan(0);
		// Depois do "+" o `return` de "não é o botão que eu esperava" engoliria
		// o clique de resgate em silêncio.
		expect(resgatar).toBeLessThan(mais);
	});

	it('o botão de resgate trava até a resposta — o "+" não', () => {
		expect(CODEX_CODIGO).toContain('resgatar.disabled = true;');
		// O comentário do "+" continua explicando por que ELE não trava.
		expect(CODEX).toContain('O BOTAO NAO TRAVA ATE A RESPOSTA');
	});

	it('o botão tem alvo tátil de 44px', () => {
		const i = CODEX_CSS.indexOf('#CodexIdle .cx-resgatar {');
		expect(i).toBeGreaterThan(0);
		expect(CODEX_CSS.slice(i, i + 300)).toContain('min-height: 44px');
	});
});

describe('D-1232 — a bolinha do menu', () => {
	it('o item do Codex tem o `.ri-dot` do design system', () => {
		const i = TOP_MENU_HTML.indexOf('data-action="codex"');
		expect(i).toBeGreaterThan(0);
		const bloco = TOP_MENU_HTML.slice(i, TOP_MENU_HTML.indexOf('</button>', i));
		expect(bloco).toContain('class="ri-dot"');
	});

	it('o menu LÊ o veredito, e não o recalcula', () => {
		expect(TOP_MENU).toContain("import { temAvisoDoCodex } from 'UI/Components/avisoDoCodex.js'");
		expect(TOP_MENU).toContain('function syncCodexDot()');
		expect(TOP_MENU).toContain('const tem = temAvisoDoCodex();');
		// Nenhuma regra de negócio do lado de cá: sem `pagas`, sem `vistas`.
		const i = TOP_MENU.indexOf('function syncCodexDot()');
		const bloco = TOP_MENU.slice(i, i + 700);
		expect(bloco).not.toContain('vistas');
		expect(bloco).not.toContain('pagas');
	});

	it('o sync entra no tique que já existe, e nos DOIS sítios que sincronizam', () => {
		const chamadas = TOP_MENU.match(/syncCodexDot\(\);/g) ?? [];
		// Um no `onAppend` e um no `pollEstado` — o mesmo par de `syncCorreioDot`.
		expect(chamadas.length).toBe(2);
		const correio = (TOP_MENU.match(/syncCorreioDot\(\);/g) ?? []).length;
		expect(chamadas.length).toBe(correio);
	});

	it('o pacote de missões é quem traz o valor — ele chega antes da janela abrir', () => {
		expect(MISSOES).toContain('anotarAvisoDoCodex(dados.codexComNovidade === true)');
	});

	it('trocar de personagem zera o aviso', () => {
		const i = MISSOES.indexOf('MissoesIdle.limparEstadoDoPersonagem');
		expect(i).toBeGreaterThan(0);
		expect(MISSOES.slice(i, i + 600)).toContain('limparAvisoDoCodex()');
	});
});

describe('avisoDoCodex — o módulo puro', () => {
	it('começa apagado, acende e apaga', () => {
		limparAvisoDoCodex();
		expect(temAvisoDoCodex()).toBe(false);
		anotarAvisoDoCodex(true);
		expect(temAvisoDoCodex()).toBe(true);
		anotarAvisoDoCodex(false);
		expect(temAvisoDoCodex()).toBe(false);
	});

	it('só `true` acende — `undefined` de um servidor velho não acende nada', () => {
		limparAvisoDoCodex();
		anotarAvisoDoCodex(undefined);
		expect(temAvisoDoCodex()).toBe(false);
		anotarAvisoDoCodex('sim');
		expect(temAvisoDoCodex()).toBe(false);
	});

	it('limpar apaga mesmo aceso — a troca de personagem', () => {
		anotarAvisoDoCodex(true);
		limparAvisoDoCodex();
		expect(temAvisoDoCodex()).toBe(false);
	});
});
