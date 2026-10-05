/**
 * A CURA COMO ATAQUE TAMBEM NA ABA ATAQUE (05/10/2026, D-1990).
 *
 * Relato: uma jogadora procurou o "Usar como ataque contra morto-vivo" (R101,
 * D-1963) na aba Ataque, junto dos golpes, e ele so existia em Suporte. A aba
 * Ataque ganha o MESMO interruptor, ligado a MESMA marca
 * (`cura.habilidades.<id>.comoAtaque`): um lugar de verdade so, as duas abas o
 * leem da mesma config e o mesmo handler grava.
 *
 * As funcoes puras saem de `curaComoAtaque.js`; a costura no IdleConfig (que
 * depende do DOM do roBrowser) e lida no fonte, como os vizinhos desta pasta.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
	curaComAtaqueAlterado,
	htmlDaCuraNaAbaAtaque,
	htmlDoAtaqueDaCura
} from '../../src/UI/Components/IdleConfig/curaComoAtaque.js';

const AQUI = dirname(fileURLToPath(import.meta.url));
const JS = readFileSync(join(AQUI, '..', '..', 'src', 'UI', 'Components', 'IdleConfig', 'IdleConfig.js'), 'utf8').replaceAll('\r\n', '\n');
const RENDER_ATAQUE = JS.slice(JS.indexOf('function renderAtaque()'), JS.indexOf('function bindNiveis('));
const BIND_ATAQUE = JS.slice(JS.indexOf('function bindAtaqueExtra('), JS.indexOf('function renderSuporte()'));
const BIND_SUPORTE = JS.slice(JS.indexOf('function bindSuporteExtra('), JS.indexOf('function renderSobrevivencia()'));

const SERVIDO = { capacidades: { curaComoAtaque: true } };
const CURAR = { skillId: 'AL_HEAL', nome: 'Curar', fereMortoVivo: true };
const SOCORROS = { skillId: 'NV_FIRSTAID', nome: 'Primeiros Socorros' };
const escapar = s => String(s);

const NOTA = 'Com o HP acima do limite de cura, usa a Cura no monstro morto-vivo; abaixo, cura você primeiro.';

function naAbaAtaque(cura, ctx = SERVIDO, curas = [CURAR, SOCORROS]) {
	return htmlDaCuraNaAbaAtaque({ curas, cura, ctx, escapar });
}

function naAbaSuporte(cura, ligada = true) {
	const ajuste = (cura.habilidades && cura.habilidades.AL_HEAL) || {};
	return htmlDoAtaqueDaCura({ cura: CURAR, ajuste, ligada, ctx: SERVIDO, escapar });
}

describe('a aba Ataque mostra a cura que fere morto-vivo', () => {
	it('com o interruptor da Curar, o mesmo da aba Suporte, e a linha que explica', () => {
		const html = naAbaAtaque({ ligada: true, habilidades: {} });
		expect(html).toContain('data-action="cura-ataque-toggle" data-skill="AL_HEAL"');
		expect(html).toContain('Usar como ataque contra morto-vivo');
		expect(html).toContain(NOTA);
		expect(html).toContain('Curar');
		expect(html).not.toContain('checked');
	});

	it('so a cura que fere morto-vivo: os Primeiros Socorros nao aparecem', () => {
		const html = naAbaAtaque({ ligada: true, habilidades: {} });
		expect(html).not.toContain('NV_FIRSTAID');
		expect(html).not.toContain('Primeiros Socorros');
	});

	it('sem cura que fere, ou num servidor que nao cumpre a marca, nao desenha nada', () => {
		expect(naAbaAtaque({ ligada: true }, SERVIDO, [SOCORROS])).toBe('');
		expect(naAbaAtaque({ ligada: true }, SERVIDO, [])).toBe('');
		expect(htmlDaCuraNaAbaAtaque({ curas: undefined, cura: { ligada: true }, ctx: SERVIDO, escapar })).toBe('');
		expect(naAbaAtaque({ ligada: true }, { capacidades: {} })).toBe('');
	});

	it('com a Curar desligada, fica travado e aponta para a aba Suporte', () => {
		const html = naAbaAtaque({ ligada: true, habilidades: { AL_HEAL: { ligada: false, comoAtaque: true } } });
		expect(html).toContain('disabled');
		expect(html).toContain('is-desligada');
		expect(html).toContain('Ligue esta cura na seção Suporte para usar o ataque.');
		expect(html).not.toContain('Ligue a cura acima');
	});
});

describe('um lugar de verdade so: as duas abas leem e escrevem a mesma marca', () => {
	it('ligar por uma aba aparece ligado nas duas; desligar apaga a marca nas duas', () => {
		const original = { ligada: true, alvo: 'grupo', curarAbaixoDe: 60, habilidades: { AL_HEAL: { ligada: true, alvo: 'eu' } } };
		const ligada = curaComAtaqueAlterado(original, 'AL_HEAL', true);
		expect(ligada.habilidades.AL_HEAL).toEqual({ ligada: true, alvo: 'eu', comoAtaque: true });
		expect(ligada.curarAbaixoDe).toBe(60);
		expect(original.habilidades.AL_HEAL).toEqual({ ligada: true, alvo: 'eu' });
		expect(naAbaAtaque(ligada)).toContain('checked');
		expect(naAbaSuporte(ligada)).toContain('checked');

		const desligada = curaComAtaqueAlterado(ligada, 'AL_HEAL', false);
		expect('comoAtaque' in desligada.habilidades.AL_HEAL).toBe(false);
		expect(naAbaAtaque(desligada)).not.toContain('checked');
		expect(naAbaSuporte(desligada)).not.toContain('checked');
	});

	it('a cura sem ajuste proprio herda o ligado e o alvo do geral', () => {
		const geral = { ligada: true, alvo: 'eu', habilidades: {} };
		expect(curaComAtaqueAlterado(geral, 'AL_HEAL', true).habilidades.AL_HEAL).toEqual({ ligada: true, alvo: 'eu', comoAtaque: true });
		const desligadaNoGeral = { ligada: false, habilidades: {} };
		expect(curaComAtaqueAlterado(desligadaNoGeral, 'AL_HEAL', true).habilidades.AL_HEAL).toEqual({ ligada: false, alvo: 'grupo', comoAtaque: true });
	});
});

describe('a costura no IdleConfig', () => {
	it('a aba Ataque desenha o cartao da cura a partir da config', () => {
		expect(RENDER_ATAQUE).toContain('htmlDaCuraNaAbaAtaque({ curas: ctx.skillsDeCura, cura: garantirCura(cfg, ctx), ctx, escapar: escapeHtml })');
	});

	it('o MESMO handler liga o interruptor nas duas abas, e ele grava pela funcao pura', () => {
		expect(BIND_ATAQUE).toContain('bindAtaqueDaCura(pane);');
		expect(BIND_SUPORTE).toContain('bindAtaqueDaCura(pane);');
		expect(JS.split('[data-action="cura-ataque-toggle"]').length).toBe(2);
		expect(JS).toContain('cfg.cura = curaComAtaqueAlterado(garantirCura(cfg, IdleConfig.contexto), ataqueToggle.dataset.skill, !!ataqueToggle.checked);');
	});
});
