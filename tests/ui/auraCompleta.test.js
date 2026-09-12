/**
 * A AURA DO NIVEL 99 NASCE COMPLETA (tarefa 6 do dono, 12/09/2026).
 *
 * O dono: "hoje tem um efeito nada a ver (umas bolinhas/esferas ao redor do
 * player), preciso que isso seja 100% fiel ao Ragnarok Online". As bolinhas
 * eram o efeito 202 sozinho — o modo SIMPLIFICADO, que era o padrao deste fork.
 *
 * Le o FONTE, e nao importa os modulos: `EntityAura` puxa o gerenciador de
 * efeitos inteiro, e a pergunta aqui e sobre tres literais.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ler = (caminho) => readFileSync(fileURLToPath(new URL(caminho, import.meta.url)), 'utf8');

const MAPA = ler('../../src/Preferences/Map.js');
const AURA = ler('../../src/Renderer/Entity/EntityAura.js');
const COMANDOS = ler('../../src/Controls/ProcessCommand.js');

describe('a aura do nivel 99', () => {
	it('CONTROLE: a regra do modo continua sendo "menor que 2 e simplificada"', () => {
		// Se esta regra mudar, o numero do padrao abaixo passa a significar outra coisa.
		expect(AURA).toContain('MapPreferences.aura < 2 ? simpleEffects : normalEffects');
		expect(AURA).toContain(
			'const normalEffects = [EffectConst.EF_LEVEL99, EffectConst.EF_LEVEL99_2, EffectConst.EF_LEVEL99_3];'
		);
	});

	it('o padrao e a aura COMPLETA (2), e nao a simplificada (1)', () => {
		expect(MAPA).toMatch(/\n\t\taura: 2,/);
		expect(MAPA).not.toMatch(/\n\t\taura: 1,/);
	});

	it('a versao das preferencias subiu, senao o padrao novo nao alcanca quem ja jogou', () => {
		// Core/Preferences.js:43 so troca o gravado pelo padrao quando a versao muda.
		// `\r?` porque o arquivo tem finais CRLF (a cicatriz de D-1093).
		expect(MAPA).toMatch(/\n\t1\.2\r?\n\);/);
	});

	it('o /aura2 religa na aura completa', () => {
		expect(COMANDOS).toContain('MapPreferences.aura = MapPreferences.aura ? 0 : 2;');
	});
});
