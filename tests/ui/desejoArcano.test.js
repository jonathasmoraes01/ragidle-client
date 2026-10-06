/**
 * O DESEJO ARCANO NA CONFIG IDLE (06/10/2026, decisao do dono).
 *
 * O cartao so existe com o `contexto.desejoArcano` do servidor (quem aprendeu
 * o SA_AUTOSPELL), mostra a magia que sai, a chance e o nivel, o que
 * recomendamos e por que, e o seletor grava `magiaDoDesejoArcano` pelo
 * `data-set` generico. A costura no IdleConfig e lida no fonte, como os
 * vizinhos desta pasta.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
	htmlDoDesejoArcano,
	magiaEscolhida,
	MOTIVO_DA_RECOMENDACAO,
	SEGUIR_A_RECOMENDACAO,
	temDesejoArcano
} from '../../src/UI/Components/IdleConfig/desejoArcano.js';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PASTA = join(AQUI, '..', '..', 'src', 'UI', 'Components', 'IdleConfig');
const JS = readFileSync(join(PASTA, 'IdleConfig.js'), 'utf8').replaceAll('\r\n', '\n');
const CSS = readFileSync(join(PASTA, 'IdleConfig.css'), 'utf8').replaceAll('\r\n', '\n');
const RENDER_ATAQUE = JS.slice(JS.indexOf('function renderAtaque()'), JS.indexOf('function bindNiveis('));

const escapar = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const NOMES = {
	SA_AUTOSPELL: 'Desejo Arcano',
	MG_FIREBOLT: 'Lanças de Fogo',
	MG_LIGHTNINGBOLT: 'Relâmpago',
	MG_SOULSTRIKE: 'Espíritos Anciões'
};
const nomeDaSkill = id => NOMES[id] || id;

const DESEJO = {
	nivelDoDesejo: 10,
	chance: 25,
	duracaoSegundos: 390,
	magias: [
		{ magia: 'MG_FIREBOLT', nivelMaximo: 3, razaoEsperada: 165, spNoNivelMaximo: 10 },
		{ magia: 'MG_LIGHTNINGBOLT', nivelMaximo: 3, razaoEsperada: 165, spNoNivelMaximo: 10 },
		{ magia: 'MG_SOULSTRIKE', nivelMaximo: 3, razaoEsperada: 115, spNoNivelMaximo: 10 }
	],
	recomendada: { magia: 'MG_FIREBOLT', motivo: 'maior-dano-por-disparo', empatadas: ['MG_LIGHTNINGBOLT'] },
	escolhida: null,
	efetiva: { magia: 'MG_FIREBOLT', nivelMaximo: 3 },
	escolhidaIndisponivel: false
};

function cartao(cfg, desejo) {
	return htmlDoDesejoArcano({ cfg, ctx: desejo === undefined ? {} : { desejoArcano: desejo }, escapar, nomeDaSkill });
}

describe('so quem aprendeu o Desejo ve o cartao', () => {
	it('sem contexto.desejoArcano (outra classe, ou servidor antigo) nao desenha nada', () => {
		expect(cartao({}, undefined)).toBe('');
		expect(htmlDoDesejoArcano({ cfg: {}, ctx: null, escapar, nomeDaSkill })).toBe('');
		expect(cartao({}, { magias: 'x' })).toBe('');
		expect(temDesejoArcano({ desejoArcano: DESEJO })).toBe(true);
	});

	it('menu vazio: o cartao diz o que aprender, sem seletor', () => {
		const html = cartao({}, { ...DESEJO, magias: [], recomendada: null, efetiva: null });
		expect(html).toContain('Nenhuma magia aprendida');
		expect(html).not.toContain('data-set="magiaDoDesejoArcano"');
		// O menu vazio manda, mesmo que um servidor torto mande uma efetiva.
		expect(cartao({}, { ...DESEJO, magias: [] })).toContain('Nenhuma magia aprendida');
	});
});

describe('o que sai, a chance e o seletor', () => {
	it('mostra a magia que sai, a chance, o nivel e a duracao', () => {
		const html = cartao({}, DESEJO);
		expect(html).toContain('data-magia-efetiva="MG_FIREBOLT"');
		expect(html).toContain('ri-badge--verde">Lanças de Fogo</span>');
		expect(html).toContain('Chance de 25% a cada golpe básico, com o Desejo no nível 10, por 390 segundos.');
		expect(html).toContain(MOTIVO_DA_RECOMENDACAO['maior-dano-por-disparo']);
	});

	it('uma opcao por magia do menu, mais "seguir a recomendacao", com o detalhe de cada uma', () => {
		const html = cartao({}, DESEJO);
		const opcoes = html.match(/data-set="magiaDoDesejoArcano"/g) || [];
		expect(opcoes).toHaveLength(4);
		expect(html).toContain(`data-valor="${SEGUIR_A_RECOMENDACAO}" aria-pressed="true"`);
		expect(html).toContain('Até o nível 3 · 165% do ataque mágico por disparo · 10 de SP');
		// So a recomendada leva o selo.
		expect(html.match(/>Recomendada</g) || []).toHaveLength(1);
	});

	it('a escolhida fica marcada; a que saiu do menu volta a "seguir a recomendacao" e o aviso aparece', () => {
		const html = cartao({ magiaDoDesejoArcano: 'MG_SOULSTRIKE' }, { ...DESEJO, efetiva: { magia: 'MG_SOULSTRIKE', nivelMaximo: 3 } });
		expect(html).toContain('data-valor="MG_SOULSTRIKE" aria-pressed="true"');
		// O selo de "sai agora" e o da EFETIVA, e nao o da recomendada.
		expect(html).toContain('ri-badge--verde">Espíritos Anciões</span>');
		expect(magiaEscolhida({ magiaDoDesejoArcano: 'MG_FROSTDIVER' }, { desejoArcano: DESEJO })).toBe(SEGUIR_A_RECOMENDACAO);
		const fora = cartao({ magiaDoDesejoArcano: 'MG_FROSTDIVER' }, { ...DESEJO, escolhida: 'MG_FROSTDIVER', escolhidaIndisponivel: true });
		expect(fora).toContain('ic-desejo-aviso');
		expect(cartao({}, DESEJO)).not.toContain('ic-desejo-aviso');
	});

	it('os dois motivos do servidor tem texto', () => {
		for (const m of ['maior-dano-por-disparo', 'unica-disponivel']) {
			expect(MOTIVO_DA_RECOMENDACAO[m]).toBeTruthy();
		}
	});
});

describe('a costura e o celular', () => {
	it('a aba Ataque desenha o cartao com o nome da habilidade no idioma', () => {
		expect(RENDER_ATAQUE).toContain('htmlDoDesejoArcano({ cfg, ctx, escapar: escapeHtml, nomeDaSkill })');
	});

	it('no celular cada opcao tem 44px, e o seletor e em coluna', () => {
		const bloco = CSS.slice(CSS.indexOf('#IdleConfig .ic-seg--desejo {'));
		expect(bloco).toMatch(/flex-direction: column/);
		expect(CSS).toMatch(/@media \(pointer: coarse\) \{\n\t#IdleConfig \.ic-seg--desejo \.ic-seg-btn \{\n\t\tmin-height: var\(--hit-touch, 44px\);/);
	});
});
