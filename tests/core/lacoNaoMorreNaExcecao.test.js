/**
 * O LACO NAO MORRE NUMA EXCECAO (D-2055, achados A1 e A2 de 06/10/2026).
 *
 * A1: `Events.process` corria os eventos vencidos sem guarda, e o
 * `Renderer._render` so pedia o proximo `requestAnimationFrame` na ULTIMA
 * linha. Um evento que lancava (no celular, o toque roda por `Events`) matava
 * o laco de render: a tela congelava sem erro visivel.
 *
 * A2: o toque na selecao de personagem ligava `Mouse.intersect` com
 * `Session.Entity` nulo, e o `onRequestWalk` seguinte lancava TypeError - o
 * erro "Session.Entity null" do `/analytics`. O andar que comecava no mapa
 * atravessava a volta a selecao pelo mesmo caminho.
 *
 * O `Renderer`, o `MapEngine`, o `Mobile` e o `MapControl` nao carregam em
 * jsdom (puxam meia arvore do jogo), entao as costuras deles sao lidas do
 * fonte, sem comentarios; a decisao e o `Events` sao exercitados de verdade.
 */
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Events from 'Core/Events.js';
import { temPersonagemNoMundo } from 'Controls/guardaDoMundo.js';

const semComentario = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const fonte = caminho => semComentario(readFileSync(caminho, 'utf8'));

afterEach(() => {
	Events.free();
	vi.restoreAllMocks();
});

describe('A1: um evento que lanca nao para os outros', () => {
	it('o segundo evento roda mesmo com o primeiro lancando, e process nao lanca', () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const ordem = [];
		Events.setTimeout(() => {
			ordem.push('primeiro');
			throw new TypeError("Cannot read properties of null (reading 'action')");
		}, 0);
		Events.setTimeout(() => ordem.push('segundo'), 0);
		expect(() => Events.process(Date.now() + 10)).not.toThrow();
		expect(ordem).toEqual(['primeiro', 'segundo']);
	});

	it('o evento que lancou sai da fila: nao lanca de novo a cada quadro', () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const lancador = vi.fn(() => {
			throw new Error('x');
		});
		Events.setTimeout(lancador, 0);
		Events.process(Date.now() + 10);
		Events.process(Date.now() + 20);
		expect(lancador).toHaveBeenCalledTimes(1);
	});

	it('o Renderer pede o proximo quadro num finally, e os eventos rodam dentro de try', () => {
		const r = fonte('src/Renderer/Renderer.js');
		const inicio = r.indexOf('static _render(time) {');
		const fim = r.indexOf('static render(fn) {');
		const corpo = r.slice(inicio, fim);
		expect(corpo).toMatch(/try \{\s*Events\.process\(this\.tick\);\s*\} catch \(e\) \{/);
		expect(corpo).toMatch(
			/\} finally \{\s*if \(pedirOutroQuadro\) \{\s*this\.updateId = _requestAnimationFrame\(this\._renderBound\);/
		);
		// O pedido do proximo quadro depois de desenhar existe UMA vez, no finally
		// (o outro e o do quadro descartado pelo limitador, antes do try).
		const pedidos = corpo.match(/this\.updateId = _requestAnimationFrame\(this\._renderBound\);/g) || [];
		expect(pedidos).toHaveLength(2);
		// O contexto perdido continua sendo a unica saida sem novo quadro.
		expect(corpo).toMatch(/isContextLost\(\)\) \{\s*pedirOutroQuadro = false;\s*return;/);
	});
});

describe('A2: sem personagem, o mundo nao responde ao toque', () => {
	it('a pergunta: so com um personagem na sessao', () => {
		expect(temPersonagemNoMundo({ Entity: null })).toBe(false);
		expect(temPersonagemNoMundo({})).toBe(false);
		expect(temPersonagemNoMundo(null)).toBe(false);
		expect(temPersonagemNoMundo({ Entity: { GID: 1 } })).toBe(true);
	});

	it('o toque so liga o mundo com personagem (Core/Mobile.js)', () => {
		const m = fonte('src/Core/Mobile.js');
		expect(m).toMatch(
			/if \(!Session\.FreezeUI && temPersonagemNoMundo\(Session\)\) \{\s*Mouse\.intersect = true;/
		);
		expect(m).not.toMatch(/if \(!Session\.FreezeUI\) \{\s*Mouse\.intersect = true;/);
	});

	it('pedir para andar e o andar em curso param sem personagem (MapEngine)', () => {
		const m = fonte('src/Engine/MapEngine.js');
		const andar = m.slice(m.indexOf('function onRequestWalk() {'), m.indexOf('function onRequestStopWalk() {'));
		expect(andar.indexOf('if (!temPersonagemNoMundo(Session)) {')).toBeGreaterThan(-1);
		expect(andar.indexOf('if (!temPersonagemNoMundo(Session)) {')).toBeLessThan(andar.indexOf('Session.Entity.action'));
		const passo = m.slice(m.indexOf('function walkIntervalProcess() {'), m.indexOf('function checkFreeCell('));
		const guarda = passo.indexOf('if (!temPersonagemNoMundo(Session)) {');
		expect(guarda).toBeGreaterThan(-1);
		expect(guarda).toBeLessThan(passo.indexOf('Session.Entity.position'));
		expect(passo.slice(guarda, guarda + 120)).toContain('Events.clearTimeout(_walkTimer);');
	});

	it('soltar o botao com o mundo desligado ainda para o andar (MapControl)', () => {
		const c = fonte('src/Controls/MapControl.js');
		const up = c.slice(c.indexOf('function onMouseUp(event) {'));
		expect(up).toMatch(/if \(!Mouse\.intersect\) \{\s*if \(this && this\.onRequestStopWalk\) \{\s*this\.onRequestStopWalk\(\);\s*\}\s*return;/);
	});
});
