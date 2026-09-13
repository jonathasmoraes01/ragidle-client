import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * O SIGHT BLASTER NA TELA (D-1359) — o lugar 601 do EffectTable, que o roBrowser
 * deixou vazio. As tres pecas moram em arquivos que o vitest nao carrega sem o
 * motor inteiro (o EffectTable importa o renderizador), entao os casos leem o
 * FONTE. O que eles nao veem e a bola na tela: isso e pergunta de olho humano
 * (a regra 5).
 */
const TABELA = readFileSync('src/DB/Effects/EffectTable.js', 'utf8');
const EFEITO_DA_SKILL = readFileSync('src/DB/Skills/SkillEffect.js', 'utf8');
const ENTIDADE = readFileSync('src/Engine/MapEngine/Entity.js', 'utf8');

/** O trecho entre `inicio` e a primeira ocorrencia de `fim` depois dele — ou null. */
function recorte(texto, inicio, fim) {
	const i = texto.indexOf(inicio);
	if (i < 0) return null;
	const j = texto.indexOf(fim, i + inicio.length);
	return j < 0 ? null : texto.slice(i, j);
}

describe('o lugar 601 (EF_SIGHT2) tem efeito, com a arte do GRF', () => {
	const entrada = recorte(TABELA, '\t601: [', '\n\t],');

	it('a entrada existe, e o lugar vazio saiu', () => {
		expect(entrada, 'a entrada 601 nao existe').not.toBeNull();
		expect(TABELA).not.toContain('//601: [{}]');
	});

	it('a bola e o sight.spr, e o som e o ef_sight.wav — os dois do GRF', () => {
		expect(entrada).toContain("spriteName: 'sight'");
		expect(entrada).toContain("wav: 'effect/ef_sight'");
	});

	it('o som sai uma vez so: a entrada se repete enquanto o status viver', () => {
		expect(entrada).toMatch(/wav: 'effect\/ef_sight',\s*repeat: false/);
	});
});

describe('quem acende e apaga a bola e o STATUS, e nao a habilidade', () => {
	it('a habilidade nao pede mais o 601 — o dano da detonacao o poria no inimigo', () => {
		const linha = EFEITO_DA_SKILL.split(/\r?\n/).find((l) => l.startsWith('SkillEffect[SK.WZ_SIGHTBLASTER]'));
		expect(linha, 'a linha do Sight Blaster sumiu').toBeDefined();
		expect(linha).not.toMatch(/effectId/);
	});

	it('o EFST do Sight Blaster apaga ANTES de acender, e acende persistente so no ligado', () => {
		const ramo = recorte(ENTIDADE, 'case StatusConst.WZ_SIGHTBLASTER:', 'case StatusConst.');
		expect(ramo, 'o ramo do Sight Blaster sumiu de onEntityStatusChange').not.toBeNull();
		const apaga = ramo.indexOf('EffectManager.remove(null, pkt.AID, EffectConst.EF_SIGHT2);');
		const acende = ramo.indexOf('EffectManager.spam(');
		expect(apaga, 'o ramo nao apaga a bola').toBeGreaterThan(-1);
		// Apagar primeiro: o reenvio do status (entrar na tela de novo) nao soma bola.
		expect(acende, 'o ramo acende antes de apagar, ou nao acende').toBeGreaterThan(apaga);
		expect(ramo).toContain('if (pkt.state == 1) {');
		expect(ramo).toContain('effectId: EffectConst.EF_SIGHT2');
		expect(ramo).toContain('persistent: true');
	});
});
