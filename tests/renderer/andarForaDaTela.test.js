/**
 * QUEM SAI DA TELA CONTINUA ANDANDO (24/09/2026, passo 14 da auditoria do
 * cerco - achado J10 do Jhow, sem o interruptor do modo classico).
 *
 * Os dois descartes de `EntityManager.render` (distancia e tela) pulavam o
 * `render()` inteiro, e a posicao so anda no `walkProcess` de dentro dele: quem
 * saia da tela congelava no ponto velho e escorregava ao voltar.
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

const { seguirAndandoSemDesenhar } = await import('Renderer/EntityManager.js');

const raiz = join(__dirname, '..', '..');
const ler = (p) => readFileSync(join(raiz, p), 'utf8');

describe('J10: quem sai da tela continua andando', () => {
	it('com rota, anda sem desenhar', () => {
		const walkProcess = vi.fn();
		seguirAndandoSemDesenhar({ walk: { total: 3 }, walkProcess });
		expect(walkProcess).toHaveBeenCalledTimes(1);
	});
	it('CONTROLE: parado (sem rota) nao chama nada', () => {
		const walkProcess = vi.fn();
		seguirAndandoSemDesenhar({ walk: { total: 0 }, walkProcess });
		seguirAndandoSemDesenhar({ walkProcess });
		expect(walkProcess).not.toHaveBeenCalled();
	});
	it('os dois descartes do render andam antes de pular o desenho', () => {
		const fonte = ler('src/Renderer/EntityManager.js');
		for (const contador of ['descartadosPorDistancia++', 'descartadosPorTela++']) {
			const i = fonte.indexOf(contador);
			expect(i, contador).toBeGreaterThan(0);
			const ate = fonte.indexOf('continue;', i);
			expect(fonte.slice(i, ate), contador).toMatch(/seguirAndandoSemDesenhar\(_list\[i\]\)/);
		}
	});
});
