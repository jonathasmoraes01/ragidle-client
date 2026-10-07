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
/* Os tres modulos pesados que o GUIComponent carrega sob demanda no `prepare()`
   (os outros tres ja estao falsos acima). O verdadeiro EntityManager desenha num
   canvas ao ser importado e REJEITA no jsdom; o CursorManager puxa
   Preferences/Graphics.js. Nenhum deles e o que este arquivo mede. */
vi.mock('UI/CursorManager.js', () => ({ default: { ACTION: { DEFAULT: 0, CLICK: 1 }, setType: vi.fn(), getActualType: vi.fn(() => 0) } }));
vi.mock('Renderer/EntityManager.js', () => ({ default: { setOverEntity: vi.fn() } }));
vi.mock('UI/Scrollbar.js', () => ({ default: { applyDOMScrollbar: vi.fn() } }));

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

	it('monta a janela e lista os itens filtrados', async () => {
		const filtro = new StorageFilter(3);
		filtro.prepare();
		/* O `prepare()` dispara a carga dos modulos pesados do GUIComponent
		   (`import('UI/CursorManager.js')`, que importa Preferences/Graphics.js,
		   e mais cinco) sem esperar. Sem esta espera o teste acabava antes, e na
		   suite cheia o `import()` chegava depois do teardown:
		   EnvironmentTeardownError (07/10/2026). Esperar aqui tambem prova que a
		   carga termina sem erro. */
		await GUIComponent.dependenciasCarregadas();
		filtro.setItems('Busca', [{ ITID: 501, index: 7, count: 12, IsIdentified: true }], 3);
		const root = filtro.getRoot();
		expect(root.querySelector('.titlebar .text').textContent).toBe('Busca');
		const itens = root.querySelectorAll('.content .item');
		expect(itens).toHaveLength(1);
		expect(itens[0].getAttribute('data-index')).toBe('7');
		expect(filtro.getCurrentTab()).toBe(3);
	});
});
