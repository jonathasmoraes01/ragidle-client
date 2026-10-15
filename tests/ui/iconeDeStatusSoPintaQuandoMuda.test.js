/**
 * O ICONE DE STATUS SO E PINTADO QUANDO MUDA (auditoria de desempenho de
 * 15/10/2026).
 *
 * Tres desperdicios no `StatusIcons`:
 *  1. `renderStatus` fazia clearRect + drawImage do MESMO icone a cada passe
 *     de 500 ms, por buff (a torta saiu em 06/09; o pixel nao muda);
 *  2. `resetElementsPosition` reescrevia top/right de toda celula;
 *  3. `rendering` montava `Object.keys(_status)` a cada QUADRO, antes do
 *     teste de tempo.
 * As decisoes moram em `desenhoDoIcone.js` e sao exercitadas de verdade; o
 * `StatusIcons` nao carrega no jsdom (canvas nulo no import do Renderer), entao
 * a costura e lida do fonte, como em `relogioDoStatusNasceCheio.test.js`.
 */
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	esquecerPintura,
	pintarIconeSeMudou,
	posicionarCelula
} from '../../src/UI/Components/StatusIcons/desenhoDoIcone.js';
import { contarEscritasDeEstilo } from './contarEscritasDeEstilo.js';

function ctxContado() {
	const ctx = { limpezas: 0, desenhos: [] };
	ctx.clearRect = () => ctx.limpezas++;
	ctx.drawImage = img => ctx.desenhos.push(img);
	return ctx;
}

function canvasPronto() {
	const c = document.createElement('canvas');
	c.width = 24;
	c.height = 24;
	return c;
}

describe('o icone e pintado uma vez por imagem', () => {
	it('vinte passes de 500 ms com o mesmo icone: UM drawImage', () => {
		const status = { ctx: ctxContado(), img: canvasPronto() };
		for (let i = 0; i < 20; i++) pintarIconeSeMudou(status, 24);
		expect(status.ctx.desenhos).toHaveLength(1);
		expect(status.ctx.limpezas).toBe(1);
	});

	it('a imagem trocada (variante TKM, fallback) e repintada uma vez', () => {
		const status = { ctx: ctxContado(), img: canvasPronto() };
		pintarIconeSeMudou(status, 24);
		const nova = canvasPronto();
		status.img = nova;
		pintarIconeSeMudou(status, 24);
		pintarIconeSeMudou(status, 24);
		expect(status.ctx.desenhos).toHaveLength(2);
		expect(status.ctx.desenhos[1]).toBe(nova);
	});

	it('sem imagem (carregando) nao pinta nada', () => {
		const status = { ctx: ctxContado(), img: null };
		expect(pintarIconeSeMudou(status, 24)).toBe(false);
		expect(status.ctx.desenhos).toHaveLength(0);
	});

	it('o canvas que perdeu o contexto e repintado no passe seguinte', () => {
		const status = { ctx: ctxContado(), img: canvasPronto() };
		pintarIconeSeMudou(status, 24);
		esquecerPintura(status);
		pintarIconeSeMudou(status, 24);
		expect(status.ctx.desenhos).toHaveLength(2);
	});

	it('um <img> ainda sem pixel nao fica marcado: o passe seguinte tenta de novo', () => {
		const img = new Image(); // jsdom: complete sem naturalWidth
		const status = { ctx: ctxContado(), img };
		pintarIconeSeMudou(status, 24);
		pintarIconeSeMudou(status, 24);
		expect(status.ctx.desenhos).toHaveLength(2);
	});
});

describe('a celula so recebe o estilo que mudou', () => {
	it('reposicionar no mesmo lugar nao escreve estilo; mudar escreve so o que mudou', () => {
		const el = document.createElement('div');
		posicionarCelula(el, '0px', '0px');
		const escritas = contarEscritasDeEstilo(['top', 'right']);
		for (let i = 0; i < 10; i++) posicionarCelula(el, '0px', '0px');
		expect(escritas.n).toBe(0);
		posicionarCelula(el, '44px', '0px');
		expect(escritas.n).toBe(1);
		expect(el.style.top).toBe('44px');
		expect(el.style.right).toBe('0px');
	});
});

describe('a costura no StatusIcons', () => {
	const src = fs.readFileSync('src/UI/Components/StatusIcons/StatusIcons.js', 'utf8').replace(/\r\n/g, '\n');
	const corpo = nome => {
		const i = src.indexOf(`function ${nome}(`);
		expect(i, `${nome} sumiu`).toBeGreaterThan(-1);
		return src.slice(i, src.indexOf('\n}\n', i));
	};

	it('renderStatus pinta pela decisao, e nao direto no contexto', () => {
		const r = corpo('renderStatus');
		expect(r).toContain('pintarIconeSeMudou(status, LADO_DO_ICONE);');
		expect(r).not.toMatch(/\.drawImage\(/);
		expect(r).not.toMatch(/\.clearRect\(/);
	});

	it('resetElementsPosition passa por posicionarCelula', () => {
		const r = corpo('resetElementsPosition');
		expect(r).toContain('posicionarCelula(');
		expect(r).not.toMatch(/\.style\.(top|right) =/);
	});

	it('rendering so monta Object.keys dentro do passe de 500 ms', () => {
		const r = corpo('rendering');
		const passe = r.indexOf('if (time_now - _last_updated_time > _render_time)');
		const chaves = r.indexOf('Object.keys(_status)');
		expect(passe).toBeGreaterThan(-1);
		expect(chaves).toBeGreaterThan(passe);
	});

	it('o canvas do icone esquece a pintura quando o contexto volta', () => {
		expect(corpo('createElement')).toMatch(/addEventListener\('contextrestored', \(\) => esquecerPintura\(registro\)\)/);
	});
});
