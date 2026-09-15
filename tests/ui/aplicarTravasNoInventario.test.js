/**
 * `Inventory.getUI().aplicarTravas`/`estaTravado` (R14/C2-3, 14/09/2026).
 *
 * A metade "fonte" da trava: `InventoryCommon.js` guarda `item.travado` no
 * PROPRIO objeto do inventario (a mesma casa de `PlaceETCTab`), a partir de
 * uma lista de SLOTS (contrato do servidor: `travados: number[]` sao
 * indices de slot, nunca posicoes — a posicao anda quando uma pilha esgota).
 *
 * Este teste chama `createInventory` de verdade (a fabrica que
 * InventoryV0..V3 usam) para provar a mecanica sem depender de nenhuma
 * versao especifica.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('Network/NetworkManager.js', () => ({ default: { sendPacket: () => {}, hookPacket: () => {} } }));
vi.mock('Network/PacketStructure.js', () => ({ default: {} }));
vi.mock('Network/PacketVerManager.js', () => ({ default: { value: 20200000 } }));
vi.mock('DB/DBManager.js', () => ({ default: { getMessage: () => '', getItemInfo: () => ({}), getItemName: () => '' } }));
vi.mock('Core/Client.js', () => ({ default: { getFilePath: () => '', loadFile: () => {} } }));
vi.mock('Core/Preferences.js', () => ({ default: { get: (_name, defaults) => ({ ...defaults }) } }));
vi.mock('Core/Configs.js', () => ({ default: { get: () => null } }));
vi.mock('Renderer/Renderer.js', () => ({ default: { render: () => {}, remove: () => {} } }));
vi.mock('Controls/MouseEventHandler.js', () => ({ default: {} }));
vi.mock('UI/UIManager.js', () => ({ default: { addComponent: c => c, getComponent: () => ({ name: '' }) } }));
vi.mock('UI/UIVersionManager.js', () => ({ default: { getInventoryVersion: () => 2 } }));
vi.mock('UI/Components/CartItems/CartItems.js', () => ({ default: {} }));
vi.mock('UI/Components/InputBox/InputBox.js', () => ({ default: { append: () => {} } }));
vi.mock('UI/Components/ItemCompare/ItemCompare.js', () => ({ default: {} }));
vi.mock('UI/Components/ItemInfo/ItemInfo.js', () => ({ default: { append: () => {}, set: () => {} } }));
vi.mock('UI/Components/ChatBox/ChatBox.js', () => ({ default: { addText: () => {}, TYPE: {}, FILTER: {} } }));
vi.mock('UI/Components/Equipment/Equipment.js', () => ({ default: { getUI: () => ({}) } }));
vi.mock('UI/Components/Storage/Storage.js', () => ({ default: {} }));
vi.mock('UI/Components/SwitchEquip/SwitchEquip.js', () => ({ default: {} }));
vi.mock('UI/Components/BasicInfo/BasicInfo.js', () => ({ default: {} }));
vi.mock('UI/Components/Refine/Refine.js', () => ({ default: {} }));
vi.mock('UI/Components/EnchantGrade/EnchantGrade.js', () => ({ default: {} }));
vi.mock('UI/Components/Enchant/Enchant.js', () => ({ default: {} }));
vi.mock('UI/Components/Mail/Mail.js', () => ({ default: {} }));
vi.mock('UI/Components/Rodex/WriteRodex.js', () => ({ default: {} }));
vi.mock('Utils/ItemArt.js', () => ({ itemIconUrl: () => '', preferirArtePublicada: () => false }));

const { createInventory } = await import('UI/Components/Inventory/InventoryCommon.js');

describe('Inventory.aplicarTravas/estaTravado', () => {
	let Component;

	beforeEach(() => {
		Component = createInventory({
			name: 'InventoryTesteTrava',
			htmlText: '<div class="container"><div class="scroll-host"><div class="content"></div></div></div>',
			cssText: '',
			defaultHeight: 100,
			favoriteTab: true
		});
		// O mesmo truque de host/shadow dos outros testes de componente: poupa
		// o `append()` inteiro, e `requestFilter()` (chamada por
		// `aplicarTravas`) precisa de ALGUM `_host` para nao estourar.
		Component._host = document.createElement('div');
		Component._host.innerHTML =
			'<div class="container"><div class="scroll-host"><div class="content"></div></div></div>';
		Component._shadow = null;

		Component.list = [
			{ index: 3, ITID: 501, count: 1 },
			{ index: 7, ITID: 502, count: 1 },
			{ index: 9, ITID: 503, count: 1 }
		];
	});

	it('marca travado:true SO nos slots listados, e travado:false em todos os outros', () => {
		Component.aplicarTravas([7]);

		expect(Component.estaTravado(3)).toBe(false);
		expect(Component.estaTravado(7)).toBe(true);
		expect(Component.estaTravado(9)).toBe(false);
	});

	it('reaplicar com uma lista diferente DESTRAVA quem saiu — o servidor manda o estado inteiro, nao um delta', () => {
		Component.aplicarTravas([7, 9]);
		expect(Component.estaTravado(7)).toBe(true);
		expect(Component.estaTravado(9)).toBe(true);

		Component.aplicarTravas([3]);

		expect(Component.estaTravado(3)).toBe(true);
		expect(Component.estaTravado(7), 'o slot 7 saiu da lista e continuou marcado').toBe(false);
		expect(Component.estaTravado(9), 'o slot 9 saiu da lista e continuou marcado').toBe(false);
	});

	it('lista vazia (ou ausente) destrava tudo', () => {
		Component.aplicarTravas([7]);
		Component.aplicarTravas([]);

		expect(Component.estaTravado(7)).toBe(false);
	});

	it('slot sem item correspondente (fora do inventario) nao existe, e nao quebra', () => {
		Component.aplicarTravas([999]);
		expect(Component.estaTravado(999)).toBe(false);
	});
});
