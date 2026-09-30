/**
 * A ROLAGEM DA CONFIGURACAO IDLE AO REDESENHAR (30/09/2026).
 *
 * Achado da prova do celular (`prove:jogador-no-celular`, 360x640): cada toque
 * num chip do filtro de coleta chamava `renderBody()`, que terminava em
 * `pane.scrollTop = 0`, e o chip (~290 px abaixo da dobra) sumia. A regra
 * mora em `rolagemDaSecao.js`; aqui, ela e a ligacao no `renderBody` e na
 * abertura da janela, lidas do fonte sem comentarios.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { rolagemAoRedesenhar } from '../../src/UI/Components/IdleConfig/rolagemDaSecao.js';

const semComentario = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const JS = semComentario(readFileSync('src/UI/Components/IdleConfig/IdleConfig.js', 'utf8'));
const trecho = (inicio, fim) => {
	const i = JS.indexOf(inicio);
	return JS.slice(i, JS.indexOf(fim, i + inicio.length));
};

describe('rolagemAoRedesenhar', () => {
	it('a MESMA secao mantem o lugar (o toque no chip)', () => {
		expect(rolagemAoRedesenhar('caca', 'caca', 290)).toBe(290);
	});

	it('a troca de secao volta ao topo', () => {
		expect(rolagemAoRedesenhar('caca', 'ataque', 290)).toBe(0);
	});

	it('a janela que reabre (sem secao anterior) comeca do topo', () => {
		expect(rolagemAoRedesenhar(null, 'caca', 290)).toBe(0);
	});
});

describe('a ligacao no IdleConfig.js', () => {
	const render = trecho('function renderBody()', '\nfunction ');
	it('o renderBody le a rolagem ANTES de trocar o HTML e a devolve depois', () => {
		const leitura = render.indexOf('rolagemAoRedesenhar(_secaoDoUltimoDesenho, IdleConfig.activeTab, pane.scrollTop)');
		const primeiroHtml = render.indexOf('pane.innerHTML = render');
		expect(leitura).toBeGreaterThan(-1);
		expect(leitura).toBeLessThan(primeiroHtml);
		expect(render).toContain('pane.scrollTop = rolagem;');
		expect(render).toContain('_secaoDoUltimoDesenho = IdleConfig.activeTab;');
		// O zero incondicional de antes nao volta.
		expect(render).not.toContain('pane.scrollTop = 0;');
	});

	it('abrir a janela zera a secao do ultimo desenho', () => {
		const toggle = trecho('IdleConfig.toggle = function toggle()', '\n};');
		const abrir = toggle.slice(toggle.indexOf("win.classList.add('is-open');"));
		expect(abrir).toContain('_secaoDoUltimoDesenho = null;');
	});
});
