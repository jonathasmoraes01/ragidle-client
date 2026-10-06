/**
 * OS PERFIS DE COMBATE DO MONGE NA CONFIG IDLE (06/10/2026, ordem do dono).
 *
 * O cartao so existe com o `contexto.monge` do servidor (a linha do Monge),
 * mostra o perfil em uso e o porque, o que cada perfil faz e o recomendado, e
 * o seletor grava `perfilDoMonge` pelo segmentado generico (`data-set`). A
 * costura no IdleConfig e lida no fonte, como os vizinhos desta pasta.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
	DESCRICAO_DO_PERFIL,
	htmlDoPerfilDoMonge,
	MOTIVO_DO_PERFIL,
	PERFIL_RECOMENDADO,
	perfilEscolhido,
	temPerfilDoMonge
} from '../../src/UI/Components/IdleConfig/perfilDoMonge.js';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PASTA = join(AQUI, '..', '..', 'src', 'UI', 'Components', 'IdleConfig');
const JS = readFileSync(join(PASTA, 'IdleConfig.js'), 'utf8').replaceAll('\r\n', '\n');
const CSS = readFileSync(join(PASTA, 'IdleConfig.css'), 'utf8').replaceAll('\r\n', '\n');
const RENDER_ATAQUE = JS.slice(JS.indexOf('function renderAtaque()'), JS.indexOf('function bindNiveis('));

const escapar = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const MONGE = (perfilAtivo, motivo) => ({ monge: { perfilAtivo, motivo } });

function cartao(cfg, ctx) {
	return htmlDoPerfilDoMonge({ cfg, ctx, escapar });
}

describe('so a linha do Monge ve o cartao', () => {
	it('sem contexto.monge (outra classe, ou servidor antigo) nao desenha nada', () => {
		expect(cartao({}, {})).toBe('');
		expect(cartao({}, null)).toBe('');
		expect(cartao({}, { monge: { perfilAtivo: 'inventado', motivo: 'sem-alvo' } })).toBe('');
		expect(temPerfilDoMonge(MONGE('farm', 'sem-alvo'))).toBe(true);
	});
});

describe('o perfil em uso e o porque', () => {
	it('chefe contra MVP: o selo diz Chefe e a linha diz o motivo', () => {
		const html = cartao({}, MONGE('chefe', 'alvo-chefe'));
		expect(html).toContain('Em uso agora:');
		expect(html).toContain('data-perfil-ativo="chefe"');
		expect(html).toContain('ri-badge--vermelho">Chefe</span>');
		expect(html).toContain(MOTIVO_DO_PERFIL['alvo-chefe']);
	});

	it('farm sem luta: o selo diz Farm e explica a proxima', () => {
		const html = cartao({}, MONGE('farm', 'sem-alvo'));
		expect(html).toContain('ri-badge--verde">Farm</span>');
		expect(html).toContain(MOTIVO_DO_PERFIL['sem-alvo']);
	});

	it('os quatro motivos do servidor tem texto', () => {
		for (const m of ['alvo-chefe', 'alvo-comum', 'sem-alvo', 'escolhido']) {
			expect(MOTIVO_DO_PERFIL[m]).toBeTruthy();
			expect(cartao({}, MONGE('farm', m))).toContain(MOTIVO_DO_PERFIL[m]);
		}
	});
});

describe('o seletor e o que cada perfil faz', () => {
	it('tres botoes do segmentado generico, gravando perfilDoMonge', () => {
		const html = cartao({}, MONGE('farm', 'alvo-comum'));
		for (const v of ['automatico', 'farm', 'chefe']) {
			expect(html).toContain(`data-set="perfilDoMonge" data-valor="${v}"`);
		}
		expect(html.split('class="ic-seg-btn').length).toBe(4);
	});

	it('ausente na config, o selecionado e o Automatico (o recomendado)', () => {
		expect(PERFIL_RECOMENDADO).toBe('automatico');
		expect(perfilEscolhido({})).toBe('automatico');
		expect(perfilEscolhido({ perfilDoMonge: 'nada' })).toBe('automatico');
		const html = cartao({}, MONGE('farm', 'alvo-comum'));
		expect(html).toContain('is-selected" data-set="perfilDoMonge" data-valor="automatico" aria-pressed="true"');
		expect(html).toContain('data-valor="farm" aria-pressed="false"');
	});

	it('o escolhido fica selecionado e destacado na lista', () => {
		const html = cartao({ perfilDoMonge: 'chefe' }, MONGE('chefe', 'escolhido'));
		expect(html).toContain('is-selected" data-set="perfilDoMonge" data-valor="chefe"');
		expect(html).toContain('ic-perfil-item is-escolhido">\n\t\t\t\t\t<strong>Chefe</strong>');
	});

	it('cada perfil diz o que faz, e o Automatico leva o selo Recomendado', () => {
		const html = cartao({}, MONGE('farm', 'alvo-comum'));
		for (const v of ['automatico', 'farm', 'chefe']) expect(html).toContain(DESCRICAO_DO_PERFIL[v]);
		expect(html.split('Recomendado').length).toBe(2);
		expect(html).toContain('<strong>Automático</strong> <span class="ri-badge ri-badge--verde">Recomendado</span>');
		expect(DESCRICAO_DO_PERFIL.farm).toContain('Sem Asura e sem Fúria');
		expect(DESCRICAO_DO_PERFIL.chefe).toContain('Asura só sai contra MVP ou chefe');
	});
});

describe('a costura no IdleConfig e o celular', () => {
	it('a aba Ataque desenha o cartao primeiro, com a config em edicao e o contexto', () => {
		expect(RENDER_ATAQUE).toContain('${htmlDoPerfilDoMonge({ cfg, ctx, escapar: escapeHtml })}');
		expect(RENDER_ATAQUE.indexOf('htmlDoPerfilDoMonge')).toBeLessThan(RENDER_ATAQUE.indexOf('<h3>Ordem de uso</h3>'));
	});

	it('o seletor usa o handler generico do data-set (nenhum handler proprio)', () => {
		expect(JS).toContain("el.querySelectorAll('[data-set]')");
		expect(JS).toContain('setPath(IdleConfig.editConfig, btn.dataset.set, btn.dataset.valor);');
	});

	it('no toque, cada botao do seletor tem 44px; os tres dividem a largura e o texto quebra', () => {
		const bloco = CSS.slice(CSS.indexOf('#IdleConfig .ic-seg--perfil .ic-seg-btn {'));
		expect(bloco).toMatch(/flex: 1 1 0;[\s\S]*white-space: normal;/);
		expect(CSS).toMatch(/@media \(pointer: coarse\) \{\s*#IdleConfig \.ic-seg--perfil \.ic-seg-btn \{\s*min-height: var\(--hit-touch, 44px\);/);
	});
});
