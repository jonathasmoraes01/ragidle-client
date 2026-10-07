/**
 * A BUSCA E O FILTRO DE ABA DO ARMAZEM ABREM (06/10/2026 — o erro do
 * `/analytics`: "Class constructor GUIComponent cannot be invoked without
 * 'new'"). `StorageFilter` era funcao construtora chamando
 * `GUIComponent.call(this, ...)`, e `GUIComponent` e `class`: o `new
 * StorageFilter(...)` de `StorageCommon.js` lancava SEMPRE. Este caso reprovava.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('DB/DBManager.js', () => ({
	default: {
		INTERFACE_PATH: 'data/texture/',
		getItemInfo: vi.fn(() => ({ identifiedResourceName: 'Red_Potion', unidentifiedResourceName: 'Red_Potion' })),
		getItemName: vi.fn(item => 'Item ' + item.ITID)
	}
}));
vi.mock('Core/Client.js', () => ({ default: { loadFile: vi.fn() } }));
vi.mock('Renderer/Renderer.js', () => ({ default: { width: 1280, height: 720 } }));
vi.mock('Controls/MouseEventHandler.js', () => ({ default: { screen: { x: 0, y: 0 } } }));
vi.mock('UI/Components/ItemInfo/ItemInfo.js', () => ({ default: {} }));
vi.mock('UI/Components/ContextMenu/ContextMenu.js', () => ({ default: {} }));

const { default: StorageFilter } = await import('UI/Components/Storage/StorageV3/StorageFilter.js');
const { default: GUIComponent } = await import('UI/GUIComponent.js');

describe('o filtro do armazem', () => {
	it('abre: o construtor nao lanca, e o filtro e um GUIComponent de verdade', () => {
		let filtro;
		expect(() => {
			filtro = new StorageFilter(0);
		}).not.toThrow();
		expect(filtro).toBeInstanceOf(GUIComponent);
		expect(filtro.name).toBe('StorageFilter_0');
		expect(filtro.getCurrentTab()).toBe(-1);
		expect(typeof filtro.setItems).toBe('function');
	});

	it('monta a janela e lista os itens filtrados', () => {
		const filtro = new StorageFilter(3);
		filtro.prepare();
		filtro.setItems('Busca', [{ ITID: 501, index: 7, count: 12, IsIdentified: true }], 3);
		const root = filtro.getRoot();
		expect(root.querySelector('.titlebar .text').textContent).toBe('Busca');
		const itens = root.querySelectorAll('.content .item');
		expect(itens).toHaveLength(1);
		expect(itens[0].getAttribute('data-index')).toBe('7');
		expect(filtro.getCurrentTab()).toBe(3);
	});
});
