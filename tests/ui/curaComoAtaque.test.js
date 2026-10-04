/**
 * "USAR COMO ATAQUE CONTRA MORTO-VIVO" NA CONFIG IDLE (04/10/2026, D-1963).
 *
 * As funcoes puras (`curaComoAtaque.js`) e a costura no componente, lida no
 * fonte como os vizinhos desta pasta: o IdleConfig depende do DOM do roBrowser
 * e nao importa em Node.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
	ataqueDaCuraLigado,
	comAtaqueDaCura,
	curaComoAtaqueServida,
	htmlDoAtaqueDaCura,
	ofereceAtaqueDaCura
} from '../../src/UI/Components/IdleConfig/curaComoAtaque.js';

const AQUI = dirname(fileURLToPath(import.meta.url));
const JS = readFileSync(join(AQUI, '..', '..', 'src', 'UI', 'Components', 'IdleConfig', 'IdleConfig.js'), 'utf8');
const CSS = readFileSync(join(AQUI, '..', '..', 'src', 'UI', 'Components', 'IdleConfig', 'IdleConfig.css'), 'utf8');
const RENDER = JS.slice(JS.indexOf('function renderCura()'), JS.indexOf('function bindSuporteExtra('));

const SERVIDO = { capacidades: { curaComoAtaque: true } };
const CURAR = { skillId: 'AL_HEAL', fereMortoVivo: true };
const SOCORROS = { skillId: 'NV_FIRSTAID' };
const escapar = s => String(s);

describe('quando a janela oferece o interruptor', () => {
	it('so num servidor que o cumpre, e so na cura que fere morto-vivo', () => {
		expect(curaComoAtaqueServida(SERVIDO)).toBe(true);
		expect(curaComoAtaqueServida({ capacidades: {} })).toBe(false);
		expect(curaComoAtaqueServida(undefined)).toBe(false);
		expect(ofereceAtaqueDaCura(CURAR, SERVIDO)).toBe(true);
		expect(ofereceAtaqueDaCura(SOCORROS, SERVIDO)).toBe(false);
		expect(ofereceAtaqueDaCura(CURAR, { capacidades: {} })).toBe(false);
	});

	it('a cura que nao o ganha nao desenha nada', () => {
		expect(htmlDoAtaqueDaCura({ cura: SOCORROS, ajuste: {}, ligada: true, ctx: SERVIDO, escapar })).toBe('');
		expect(htmlDoAtaqueDaCura({ cura: CURAR, ajuste: {}, ligada: true, ctx: {}, escapar })).toBe('');
	});
});

describe('o interruptor', () => {
	it('nasce DESLIGADO: so `comoAtaque: true` liga', () => {
		expect(ataqueDaCuraLigado(undefined)).toBe(false);
		expect(ataqueDaCuraLigado({ ligada: true })).toBe(false);
		expect(ataqueDaCuraLigado({ ligada: true, comoAtaque: 'sim' })).toBe(false);
		expect(ataqueDaCuraLigado({ ligada: true, comoAtaque: true })).toBe(true);
		const html = htmlDoAtaqueDaCura({ cura: CURAR, ajuste: { ligada: true }, ligada: true, ctx: SERVIDO, escapar });
		expect(html).toContain('data-action="cura-ataque-toggle" data-skill="AL_HEAL"');
		expect(html).not.toContain('checked');
		expect(html).toContain('Usar como ataque contra morto-vivo');
	});

	it('ligado, diz a prioridade: ataque com o HP acima do limite, cura abaixo', () => {
		const html = htmlDoAtaqueDaCura({ cura: CURAR, ajuste: { ligada: true, comoAtaque: true }, ligada: true, ctx: SERVIDO, escapar });
		expect(html).toContain('checked');
		expect(html).toContain('Abaixo do limite, cura você primeiro.');
		expect(html).not.toContain('disabled');
	});

	it('com a cura desligada, fica apagado e travado, com o motivo', () => {
		const html = htmlDoAtaqueDaCura({ cura: CURAR, ajuste: { ligada: false, comoAtaque: true }, ligada: false, ctx: SERVIDO, escapar });
		expect(html).toContain('is-desligada');
		expect(html).toContain('disabled');
		expect(html).toContain('Ligue a cura acima para usar o ataque.');
	});

	it('ligar grava `true`; desligar APAGA a marca, sem tocar o resto nem o original', () => {
		const ajuste = { ligada: true, alvo: 'eu', nivelDeUso: 5 };
		const ligado = comAtaqueDaCura(ajuste, true);
		expect(ligado).toEqual({ ligada: true, alvo: 'eu', nivelDeUso: 5, comoAtaque: true });
		expect(ajuste).toEqual({ ligada: true, alvo: 'eu', nivelDeUso: 5 });
		const desligado = comAtaqueDaCura(ligado, false);
		expect(desligado).toEqual({ ligada: true, alvo: 'eu', nivelDeUso: 5 });
		expect('comoAtaque' in desligado).toBe(false);
	});
});

describe('a costura no IdleConfig', () => {
	it('cada bloco de cura desenha o interruptor dele', () => {
		expect(RENDER).toContain('${htmlDoAtaqueDaCura({ cura: c, ajuste, ligada, ctx, escapar: escapeHtml })}');
	});

	it('o handler grava a marca POR habilidade, pela funcao pura', () => {
		expect(JS).toContain("pane.querySelectorAll('[data-action=\"cura-ataque-toggle\"]').forEach(ataqueToggle =>");
		expect(JS).toContain('[skillId]: comAtaqueDaCura(atual, !!ataqueToggle.checked)');
	});

	it('no dedo, a linha do interruptor tem a altura de toque', () => {
		expect(CSS).toMatch(/@media \(pointer: coarse\) \{\s*#IdleConfig \.ic-ataque-da-cura \.ic-switch-row \{\s*min-height: var\(--hit-touch, 44px\);/);
	});
});
