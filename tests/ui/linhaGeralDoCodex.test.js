/**
 * O DETALHE DE "GERAIS" SE ANUNCIA (25/09/2026).
 *
 * Primeiro o dono pediu tirar o "Codex +x%" sempre visivel embaixo do numero e
 * mostra-lo so sob demanda. A primeira versao pos o detalhe no `title` e o dono
 * voltou no mesmo dia: *"e impossivel o player saber que ele pode clicar ali ou
 * colocar o mouse em cima"*. O que este arquivo mede, no jsdom e com o CSS DE
 * VERDADE da janela:
 *
 *   - toda linha com detalhe mostra um "i" VISIVEL e e um <button>;
 *   - fechada, o numero aparece e o detalhe NAO (computado);
 *   - o balao nativo (title) saiu;
 *   - o clique/toque abre o detalhe embaixo da linha -- a parte do Codex em
 *     destaque e a explicacao do numero -- e o segundo fecha;
 *   - a secao diz, em texto, que a linha abre.
 *
 * A janela inteira (StatusIdle.js) arrasta UIManager e a cadeia de render, que
 * nao sobem no jsdom; por isso a linha mora em linhaGeral.js, e a LIGACAO dela
 * na janela e cobrada lendo o fonte, no fim.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { linhasParaDesenhar, alternarDetalhe, detalheAberto } from '../../src/UI/Components/StatusIdle/geraisDaFicha.js';
import {
	montarLinhaGeral,
	marcarLinhaAberta,
	linhaComDetalheDoEvento
} from '../../src/UI/Components/StatusIdle/linhaGeral.js';

const DIR = join(process.cwd(), 'src/UI/Components/StatusIdle');
const CSS = readFileSync(join(DIR, 'StatusIdle.css'), 'utf8');
const JS = readFileSync(join(DIR, 'StatusIdle.js'), 'utf8');
const HTML = readFileSync(join(DIR, 'StatusIdle.html'), 'utf8');

const LINHAS = linhasParaDesenhar([
	{ chave: 'hpMaximo', unidade: 'pontos', valor: 5230, codex: 26, codexPorcento: 0.5 },
	{ chave: 'esquivaPerfeita', unidade: 'porcento', valor: 2.5, codex: 0 }
]);

/** A lista com as linhas e o mesmo ouvinte delegado que StatusIdle.init poe. */
function montarLista(abertasIniciais = [], linhas = LINHAS) {
	document.head.innerHTML = '';
	document.body.innerHTML = '';
	const estilo = document.createElement('style');
	estilo.textContent = CSS;
	document.head.appendChild(estilo);
	const lista = document.createElement('div');
	lista.className = 'st-gerais-lista';
	document.body.appendChild(lista);
	const estado = { abertas: abertasIniciais };
	for (const linha of linhas) {
		lista.appendChild(montarLinhaGeral(document, linha, detalheAberto(estado.abertas, linha.chave)));
	}
	// A mesma receita de `onClickGeral` (StatusIdle.js).
	lista.addEventListener('click', e => {
		const row = linhaComDetalheDoEvento(e);
		if (!row) return;
		estado.abertas = alternarDetalhe(estado.abertas, row.dataset.geral);
		marcarLinhaAberta(row, detalheAberto(estado.abertas, row.dataset.geral));
	});
	return { lista, estado };
}

function linha(lista, chave) {
	return lista.querySelector(`[data-geral="${chave}"]`);
}
function visivel(el) {
	return el !== null && getComputedStyle(el).display !== 'none';
}
function detalhe(row) {
	return row.querySelector('.st-geral-detalhe');
}

describe('a linha com detalhe', () => {
	let lista;
	beforeEach(() => {
		({ lista } = montarLista());
	});

	it('controle: o CSS da janela chegou ao documento (sem ele "escondido" seria de graca)', () => {
		const row = linha(lista, 'hpMaximo');
		marcarLinhaAberta(row, true);
		expect(visivel(detalhe(row))).toBe(true);
	});

	it('o "i" esta na linha e VISIVEL, fechada ou aberta', () => {
		const row = linha(lista, 'hpMaximo');
		const info = row.querySelector('.st-geral-info');
		expect(info).not.toBeNull();
		expect(info.textContent).toBe('i');
		expect(info.getAttribute('aria-hidden')).toBe('true');
		expect(visivel(info)).toBe(true);
	});

	it('toda linha que o jogo desenha tem detalhe (todas tem dica), e nao so a que tem Codex', () => {
		for (const chave of ['hpMaximo', 'esquivaPerfeita']) {
			const row = linha(lista, chave);
			expect(row.tagName).toBe('BUTTON');
			expect(row.querySelector('.st-geral-info')).not.toBeNull();
		}
	});

	it('fechada: o numero aparece, o detalhe NAO, e o balao nativo (title) saiu', () => {
		const row = linha(lista, 'hpMaximo');
		expect(row.querySelector('.st-geral-value').textContent).toBe('5.230');
		expect(visivel(detalhe(row))).toBe(false);
		expect(row.getAttribute('aria-expanded')).toBe('false');
		expect(row.hasAttribute('title')).toBe(false);
	});

	it('a linha diz que e clicavel: mao do mouse no CSS', () => {
		expect(CSS).toMatch(/button\.st-geral-row\s*\{[^}]*cursor:\s*pointer/);
	});

	it('o toque/clique abre o detalhe embaixo, com o Codex em destaque e a explicacao; o segundo fecha', () => {
		const row = linha(lista, 'hpMaximo');
		row.querySelector('.st-geral-label').click(); // toque em qualquer ponto da linha
		expect(visivel(detalhe(row))).toBe(true);
		expect(row.getAttribute('aria-expanded')).toBe('true');
		expect(row.querySelector('.st-geral-codex').textContent).toBe('Codex +26 (+0,5%)');
		expect(detalhe(row).textContent).toContain('HP máximo atual');
		// a primeira linha do title ("HP maximo: 5.230") NAO se repete: a linha ja a mostra
		expect(detalhe(row).textContent).not.toContain('HP máximo: 5.230');
		row.click();
		expect(visivel(detalhe(row))).toBe(false);
		expect(row.getAttribute('aria-expanded')).toBe('false');
	});

	it('sem Codex, o detalhe traz so a explicacao, sem linha "Codex"', () => {
		const row = linha(lista, 'esquivaPerfeita');
		row.click();
		expect(visivel(detalhe(row))).toBe(true);
		expect(row.querySelector('.st-geral-codex')).toBeNull();
		expect(detalhe(row).textContent).toContain('Chance de anular o golpe inteiro');
	});

	it('acessivel: <button type=button> com aria-controls apontando o detalhe', () => {
		const row = linha(lista, 'hpMaximo');
		expect(row.type).toBe('button');
		const alvo = row.getAttribute('aria-controls');
		expect(alvo).toBeTruthy();
		expect(document.getElementById(alvo)).toBe(detalhe(row));
	});

	it('redesenhada com a chave aberta (a ficha chega de novo), continua aberta', () => {
		({ lista } = montarLista(['hpMaximo']));
		const row = linha(lista, 'hpMaximo');
		expect(visivel(detalhe(row))).toBe(true);
		expect(row.getAttribute('aria-expanded')).toBe('true');
	});
});

describe('a linha sem detalhe', () => {
	it('e so texto: nem botao, nem "i", nem aria-expanded; o clique nao faz nada', () => {
		const semDetalhe = { chave: 'x', rotulo: 'X', valor: '1', codex: '', detalhe: [] };
		const { lista, estado } = montarLista([], [semDetalhe]);
		const row = linha(lista, 'x');
		expect(row.tagName).toBe('DIV');
		expect(row.querySelector('.st-geral-info')).toBeNull();
		expect(row.hasAttribute('aria-expanded')).toBe(false);
		row.click();
		expect(estado.abertas).toEqual([]);
	});
});

describe('o celular e a janela', () => {
	it('dedo: a linha com detalhe tem 44px de alvo, como o titulo das secoes', () => {
		const bloco = CSS.match(/@media \(pointer: coarse\)\s*\{\s*\.st-geral-row--detalhe\s*\{[^}]*\}/);
		expect(bloco, 'sem a regra de alvo tatil da linha').not.toBeNull();
		expect(bloco[0]).toContain('min-height: 44px');
	});

	it('o realce de hover so vale onde ha mouse (no toque ele grudaria)', () => {
		expect(CSS).toMatch(/@media \(hover: hover\)\s*\{\s*\.st-geral-row--detalhe:hover/);
	});

	it('a secao diz em texto que a linha abre', () => {
		expect(HTML).toMatch(/class="st-gerais-dica">[^<]*toque numa linha/i);
	});

	it('StatusIdle.js desenha pela linhaGeral e ouve o clique na lista', () => {
		expect(JS).toContain('montarLinhaGeral(document, linha, detalheAberto(_geraisAbertas, linha.chave))');
		expect(JS).toContain("root.querySelector('.st-gerais-lista').addEventListener('click', onClickGeral)");
		expect(JS).toContain('const row = linhaComDetalheDoEvento(e);');
		// e a troca de personagem fecha o que estava aberto
		expect(JS).toMatch(/limparEstadoDoPersonagem[\s\S]{0,400}_geraisAbertas = \[\];/);
	});
});
