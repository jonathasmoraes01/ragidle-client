/**
 * O teleporte no mesmo mapa nao deixa a vida dos mobs no cache (F48, auditoria
 * de 22/09/2026). Ele passa por `EntityManager.free()` sem `clearLifeCache`:
 * a vida do MOB sai com a entidade, e a do jogador fica (o grupo a le).
 */
import { describe, expect, it, vi } from 'vitest';

const TYPE_PC = 0;
const TYPE_MOB = 5;

vi.doMock('Renderer/Entity/Entity.js', () => ({ default: { TYPE_PC, TYPE_MOB } }));
vi.doMock('Engine/SessionStorage.js', () => ({ default: {} }));
vi.doMock('Renderer/SpriteRenderer.js', () => ({ default: {} }));
vi.doMock('Controls/MouseEventHandler.js', () => ({ default: {} }));
vi.doMock('Controls/KeyEventHandler.js', () => ({ default: {} }));
vi.doMock('Utils/PathFinding.js', () => ({ default: {} }));
vi.doMock('Preferences/Graphics.js', () => ({ default: {} }));
vi.doMock('Renderer/Map/Altitude.js', () => ({ default: {} }));
vi.doMock('Renderer/GR2/GR2ModelRenderer.js', () => ({ default: { release() {}, remove() {} } }));

const { default: EntityManager } = await import('Renderer/EntityManager.js');

function entidade(GID, objecttype) {
	return { GID, objecttype, clean() {} };
}

describe('EntityManager.free e o cache de vida (F48)', () => {
	it('a vida do mob sai com a entidade; a do jogador fica', () => {
		EntityManager.clearLifeCache();
		EntityManager.add(entidade(2, TYPE_MOB));
		EntityManager.add(entidade(5, TYPE_PC));
		EntityManager.storeLife(2, { hp: 700, hp_max: 1000 });
		EntityManager.storeLife(5, { hp: 50, hp_max: 100 });

		EntityManager.free();

		expect(EntityManager.getLife(2)).toBeNull();
		expect(EntityManager.getLife(5)).toEqual({ hp: 50, hp_max: 100 });
	});
});
