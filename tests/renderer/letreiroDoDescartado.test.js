/**
 * QUEM E DESCARTADO NAO DEIXA O LETREIRO NA TELA (05/10/2026, relato do dono:
 * depois de 5 minutos de alt-tab, nomes e barras de HP de monstros [EXP]
 * flutuando onde nao havia monstro, e acompanhando a tela).
 *
 * Os descartes de `EntityManager.render` pulam o render da entidade, o unico
 * que reposiciona os canvas da camada fixa; o canvas ficava pregado no ultimo
 * pixel. Aqui: o descartado sai da camada, os interruptores `display` ficam, e
 * o render seguinte o devolve.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.doMock('Renderer/Entity/Entity.js', () => ({ default: { TYPE_PC: 0, TYPE_MOB: 5 } }));
vi.doMock('Engine/SessionStorage.js', () => ({ default: {} }));
vi.doMock('Renderer/SpriteRenderer.js', () => ({ default: {} }));
vi.doMock('Controls/MouseEventHandler.js', () => ({ default: {} }));
vi.doMock('Controls/KeyEventHandler.js', () => ({ default: {} }));
vi.doMock('Utils/PathFinding.js', () => ({ default: {} }));
vi.doMock('Preferences/Graphics.js', () => ({ default: {} }));
vi.doMock('Renderer/Map/Altitude.js', () => ({ default: {} }));
vi.doMock('Renderer/GR2/GR2ModelRenderer.js', () => ({ default: { release() {}, remove() {} } }));

const { esconderLetreirosDoDescartado } = await import('Renderer/EntityManager.js');
const { default: EntityOverlay } = await import('Renderer/Entity/EntityOverlay.js');

const raiz = join(__dirname, '..', '..');
const ler = (p) => readFileSync(join(raiz, p), 'utf8');

function peca() {
	return { display: true, canvas: document.createElement('canvas') };
}

function mobNaTela() {
	const mob = { life: peca(), emblem: peca(), display: peca(), dialog: peca(), cast: peca() };
	for (const nome of ['life', 'emblem', 'display', 'dialog', 'cast']) EntityOverlay.append(mob[nome].canvas);
	return mob;
}

describe('o letreiro do descartado sai da camada fixa', () => {
	it('nome, HP, emblema, balao e conjuracao saem da camada', () => {
		const mob = mobNaTela();
		const camada = EntityOverlay.getLayer();
		expect(mob.life.canvas.parentNode).toBe(camada);
		esconderLetreirosDoDescartado(mob);
		for (const nome of ['life', 'emblem', 'display', 'dialog', 'cast']) {
			expect(mob[nome].canvas.parentNode, nome).toBeNull();
		}
	});

	it('os interruptores ficam: quem volta a ser desenhado volta com o letreiro', () => {
		const mob = mobNaTela();
		esconderLetreirosDoDescartado(mob);
		expect(mob.display.display).toBe(true);
		expect(mob.life.display).toBe(true);
		// O render de volta faz o append, como `EntityDisplay.render`.
		EntityOverlay.append(mob.display.canvas);
		expect(mob.display.canvas.parentNode).toBe(EntityOverlay.getLayer());
	});

	it('CONTROLE: peca sem canvas, ou ja fora, nao lanca', () => {
		const solto = { life: peca(), emblem: {}, display: null, dialog: peca(), cast: undefined };
		expect(() => esconderLetreirosDoDescartado(solto)).not.toThrow();
		expect(solto.life.canvas.parentNode).toBeNull();
	});

	it('os dois descartes do render escondem o letreiro antes de pular o desenho', () => {
		const fonte = ler('src/Renderer/EntityManager.js');
		for (const contador of ['descartadosPorDistancia++', 'descartadosPorTela++']) {
			const i = fonte.indexOf(contador);
			expect(i, contador).toBeGreaterThan(0);
			const ate = fonte.indexOf('continue;', i);
			expect(fonte.slice(i, ate), contador).toMatch(/esconderLetreirosDoDescartado\(_list\[i\]\)/);
		}
	});
});
