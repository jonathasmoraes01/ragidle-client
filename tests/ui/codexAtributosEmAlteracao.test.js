/**
 * OS ATRIBUTOS DO CODEX EM ALTERACAO (23/09/2026 — ordem do dono).
 *
 * O modulo `atributosEmAlteracao.js` e puro e e testado de verdade. A janela
 * (`CodexIdle.js`) sobe meia interface para importar, entao a LIGACAO dela e
 * cobrada lendo o fonte, sem comentarios — o mesmo instrumento de
 * `codexPorEspecieEResgate.test.js`.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
	AVISO_PADRAO_DOS_ATRIBUTOS,
	RECUSA_EM_ALTERACAO,
	avisoDosAtributos,
	eixoEmAlteracao
} from 'UI/Components/CodexIdle/atributosEmAlteracao.js';

const CODEX_CODIGO = readFileSync('src/UI/Components/CodexIdle/CodexIdle.js', 'utf8')
	.replace(/\/\*[\s\S]*?\*\//g, ' ')
	.replace(/\/\/[^\n]*/g, ' ');
const CODEX_CSS = readFileSync('src/UI/Components/CodexIdle/CodexIdle.css', 'utf8');

const DESLIGADO = {
	atributosLigados: false,
	avisoDosAtributos: 'O sistema de atributos está passando por alterações e chega nos próximos dias.',
	recusaPorEixo: {
		str: RECUSA_EM_ALTERACAO,
		agi: RECUSA_EM_ALTERACAO,
		vit: RECUSA_EM_ALTERACAO,
		int: RECUSA_EM_ALTERACAO,
		dex: RECUSA_EM_ALTERACAO,
		luk: RECUSA_EM_ALTERACAO,
		exp: null
	}
};

describe('o aviso dos atributos vem do servidor', () => {
	it('desligado: o aviso e o texto do servidor', () => {
		expect(avisoDosAtributos(DESLIGADO)).toBe(DESLIGADO.avisoDosAtributos);
	});

	it('desligado sem texto: cai no aviso de reserva', () => {
		expect(avisoDosAtributos({ atributosLigados: false })).toBe(AVISO_PADRAO_DOS_ATRIBUTOS);
	});

	it('ligado, ou servidor antigo sem o campo: nenhum aviso', () => {
		expect(avisoDosAtributos({ atributosLigados: true, avisoDosAtributos: null })).toBeNull();
		expect(avisoDosAtributos({})).toBeNull();
		expect(avisoDosAtributos(null)).toBeNull();
	});

	it('os seis atributos estao em alteracao e o exp nao', () => {
		for (const eixo of ['str', 'agi', 'vit', 'int', 'dex', 'luk']) {
			expect(eixoEmAlteracao(DESLIGADO, eixo)).toBe(true);
		}
		expect(eixoEmAlteracao(DESLIGADO, 'exp')).toBe(false);
		expect(eixoEmAlteracao({ recusaPorEixo: { str: 'sem-ponto' } }, 'str')).toBe(false);
	});
});

describe('a janela apaga os botoes pelo veredito do servidor', () => {
	it('o aparelho enxerga o arquivo — controle positivo', () => {
		expect(CODEX_CODIGO).toContain('function eixosHtml');
	});

	it('o "+" continua desabilitado por `recusa !== null` — a recusa nova cai nele', () => {
		expect(CODEX_CODIGO).toContain('const bloqueado = semVeredito || recusa !== null;');
		expect(CODEX_CODIGO).toContain("(bloqueado ? ' disabled' : '')");
	});

	it('a linha ganha a classe e o aviso vai acima das linhas', () => {
		expect(CODEX_CODIGO).toContain('const emAlteracao = eixoEmAlteracao(estado, eixo);');
		expect(CODEX_CODIGO).toContain("(emAlteracao ? ' is-em-alteracao' : '')");
		expect(CODEX_CODIGO).toContain('const aviso = avisoDosAtributos(estado);');
		expect(CODEX_CODIGO).toContain('return faixa + \'<div class="cx-eixos">\'');
	});

	it('o clique no botao desabilitado nao manda nada', () => {
		expect(CODEX_CODIGO).toContain('if (!botao || botao.disabled) {');
	});

	it('o CSS tira o "+" em alteracao do ponteiro (sem hover nem clique)', () => {
		const i = CODEX_CSS.indexOf('#CodexIdle .cx-eixo.is-em-alteracao .cx-mais {');
		expect(i).toBeGreaterThan(-1);
		const bloco = CODEX_CSS.slice(i, CODEX_CSS.indexOf('}', i));
		expect(bloco).toContain('pointer-events: none;');
		expect(bloco).toContain('grayscale(1)');
		expect(CODEX_CSS).toContain('#CodexIdle .cx-aviso-atributos {');
	});
});
