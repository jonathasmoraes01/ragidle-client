/**
 * O REENVIO INTEIRO DA MOCHILA SUBSTITUI A LISTA LOCAL (16/10/2026).
 *
 * Relato de producao: "quando ta upando o item pra +1 +2 etc... esta
 * duplicando o item" — a Mochila mostrava ~14 Orc Bows. O servidor reenvia a
 * mochila INTEIRA depois do refino (ZC_INVENTORY_START 0x0b08, lista normal,
 * lista de equipamento, ZC_INVENTORY_END 0x0b0b), mas o cliente so trocava
 * pelo indice (`setItems`): o indice que a lista nova nao trazia ficava como
 * fantasma.
 *
 * O teste percorre o caminho de verdade: os hooks REAIS de Item.js e
 * Storage.js (quem ouve 0x0b08/0x0b0b) e o `createInventory` REAL (a fabrica
 * de InventoryV0..V3). So a janela de equipamento, o carrinho e o armazem
 * sao duble — para provar que o carrinho e o armazem NAO sao tocados.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	const equipados = {};
	return {
		hooks: new Map(),
		inventario: null,
		equipados,
		equipUI: {
			equip(item, location) {
				item.equipped = location || item.WearState;
				equipados[item.index] = item;
			},
			unEquip(index) {
				const item = equipados[index];
				delete equipados[index];
				return item;
			},
			getEquippedList() {
				return Object.keys(equipados).map(k => equipados[k]);
			},
			getNumber() {
				return Object.keys(equipados).length;
			}
		},
		cart: { setItems: vi.fn() },
		storageUI: { append: vi.fn(), setItems: vi.fn() }
	};
});

vi.mock('Network/NetworkManager.js', () => ({
	default: { hookPacket: (pkt, cb) => mocks.hooks.set(pkt, cb), sendPacket: () => {} }
}));
vi.mock('Network/PacketVerManager.js', () => ({ default: { value: 20211103 } }));
vi.mock('DB/DBManager.js', () => ({
	default: { getMessage: () => '', getItemName: () => 'Item de Teste', getItemInfo: () => ({}) }
}));
vi.mock('Core/Configs.js', () => ({ default: { get: () => null } }));
vi.mock('Core/Client.js', () => ({ default: { getFilePath: () => '', loadFile: () => {} } }));
vi.mock('Core/Preferences.js', () => ({ default: { get: (_name, defaults) => ({ ...defaults }) } }));
vi.mock('Renderer/Renderer.js', () => ({ default: { render: () => {}, remove: () => {} } }));
vi.mock('Controls/MouseEventHandler.js', () => ({ default: {} }));
vi.mock('UI/UIManager.js', () => ({ default: { addComponent: c => c, getComponent: () => ({ name: '' }) } }));
vi.mock('UI/UIVersionManager.js', () => ({ default: { getInventoryVersion: () => 2 } }));
vi.mock('Renderer/ItemObject.js', () => ({ default: { add: () => {}, remove: () => {} } }));
vi.mock('Renderer/Map/Altitude.js', () => ({ default: { getCellHeight: () => 0 } }));
vi.mock('Renderer/EffectManager.js', () => ({ default: { add: () => {} } }));
vi.mock('Engine/SessionStorage.js', () => ({ default: { Entity: null } }));
vi.mock('UI/Components/ChatBox/ChatBox.js', () => ({
	default: { addText: () => {}, TYPE: { ERROR: 1, BLUE: 2 }, FILTER: { ITEM: 1, FARM_ITEM: 2 } }
}));
vi.mock('UI/Components/ItemObtain/ItemObtain.js', () => ({ default: { append: () => {}, set: () => {} } }));
vi.mock('UI/Components/HuntAnalyzer/registroDaCaca.js', () => ({
	ehDropDeCaca: () => false,
	registrarItem: () => {}
}));
vi.mock('UI/Components/ItemSelection/ItemSelection.js', () => ({ default: {} }));
vi.mock('UI/Components/Inventory/Inventory.js', () => ({ default: { getUI: () => mocks.inventario } }));
vi.mock('UI/Components/CartItems/CartItems.js', () => ({ default: mocks.cart }));
vi.mock('UI/Components/Equipment/Equipment.js', () => ({ default: { getUI: () => mocks.equipUI } }));
vi.mock('UI/Components/PlayerViewEquip/PlayerViewEquip.js', () => ({ default: {} }));
vi.mock('UI/Components/SwitchEquip/SwitchEquip.js', () => ({ default: {} }));
vi.mock('UI/Components/Storage/Storage.js', () => ({ default: { getUI: () => mocks.storageUI } }));
vi.mock('UI/Components/MakeItemSelection/MakeItemSelection.js', () => ({ default: {} }));
vi.mock('UI/Components/MakeItemSelection/ItemListWindowSelection.js', () => ({ default: {} }));
vi.mock('UI/Components/InputBox/InputBox.js', () => ({ default: { append: () => {} } }));
vi.mock('UI/Components/ItemCompare/ItemCompare.js', () => ({ default: {} }));
vi.mock('UI/Components/ItemInfo/ItemInfo.js', () => ({ default: { append: () => {}, set: () => {} } }));
vi.mock('UI/Components/BasicInfo/BasicInfo.js', () => ({ default: { getUI: () => ({}) } }));
vi.mock('UI/Components/Refine/Refine.js', () => ({ default: {} }));
vi.mock('UI/Components/EnchantGrade/EnchantGrade.js', () => ({ default: {} }));
vi.mock('UI/Components/Enchant/Enchant.js', () => ({ default: {} }));
vi.mock('UI/Components/Mail/Mail.js', () => ({ default: {} }));
vi.mock('UI/Components/Rodex/WriteRodex.js', () => ({ default: {} }));
vi.mock('Utils/ItemArt.js', () => ({ itemIconUrl: () => '', preferirArtePublicada: () => false }));

const { default: PACKET } = await import('Network/PacketStructure.js');
const { default: ItemEngine } = await import('Engine/MapEngine/Item.js');
const { default: StorageEngine } = await import('Engine/MapEngine/Storage.js');
const { createInventory } = await import('UI/Components/Inventory/InventoryCommon.js');
const { fantasmasDoReenvio } = await import('UI/Components/Inventory/fantasmasDoReenvio.js');

const ARCO = 1107; // Orc Bow (o do print)
const POCAO = 501;
const ORIDECON = 984;
const TIPO_ARMA = 5;
const TIPO_CURA = 0;
const TIPO_ETC = 3;
const MAO_DIREITA = 2;

function arco(index, extra = {}) {
	return { index, ITID: ARCO, type: TIPO_ARMA, location: MAO_DIREITA, WearState: 0, RefiningLevel: 0, ...extra };
}
function pocao(index, count) {
	return { index, ITID: POCAO, type: TIPO_CURA, count, WearState: 0 };
}
function oridecon(index, count) {
	return { index, ITID: ORIDECON, type: TIPO_ETC, count, WearState: 0 };
}

/** O que o servidor manda em `enviarInventario`, na mesma ordem. */
function reenviar(invType, normais, equips) {
	mocks.hooks.get(PACKET.ZC.SPLIT_SEND_ITEMLIST_SET)({ invType, name: '' });
	mocks.hooks.get(PACKET.ZC.SPLIT_SEND_ITEMLIST_NORMAL)({ invType, ItemInfo: normais });
	mocks.hooks.get(PACKET.ZC.SPLIT_SEND_ITEMLIST_EQUIP2)({ invType, ItemInfo: equips });
	mocks.hooks.get(PACKET.ZC.SPLIT_SEND_ITEMLIST_RESULT)({ invType, flag: 0 });
}

function indicesDaMochila() {
	return mocks.inventario.list.map(i => i.index);
}

describe('o reenvio inteiro da mochila (0x0b08..0x0b0b) substitui a lista local', () => {
	beforeEach(() => {
		mocks.hooks.clear();
		for (const k of Object.keys(mocks.equipados)) delete mocks.equipados[k];
		mocks.cart.setItems.mockClear();
		mocks.storageUI.append.mockClear();
		mocks.storageUI.setItems.mockClear();

		const inv = createInventory({
			name: 'InventoryTesteReenvio',
			htmlText: '<div class="container"><div class="content"></div></div>',
			cssText: '',
			defaultHeight: 100
		});
		inv._host = document.createElement('div');
		inv._host.innerHTML = '<div class="container"><div class="content"></div></div>';
		inv._shadow = null;
		inv.onUpdateItem = vi.fn();
		mocks.inventario = inv;

		ItemEngine();
		StorageEngine();
	});

	it('o FANTASMA (indice que a lista nova nao traz) some depois do reenvio — o arco do refino', () => {
		// O estado do relato: o arco refinado (indice 5) e uma copia velha num
		// indice que o servidor nao usa mais (12).
		reenviar(0, [pocao(2, 10), oridecon(3, 4)], [arco(5)]);
		mocks.inventario.list.push(arco(12));
		expect(mocks.inventario.list.filter(i => i.ITID === ARCO)).toHaveLength(2);

		// O refino: o Oridecon acaba (indice 3 some), o arco vira +1.
		reenviar(0, [pocao(2, 10)], [arco(5, { RefiningLevel: 1 })]);

		expect(indicesDaMochila()).toEqual([2, 5]);
		const arcos = mocks.inventario.list.filter(i => i.ITID === ARCO);
		expect(arcos, 'o arco ficou duplicado na mochila').toHaveLength(1);
		expect(arcos[0].RefiningLevel).toBe(1);
		expect(mocks.inventario.getItemByIndex(3), 'a pilha de Oridecon esgotada ficou na mochila').toBeNull();
		// O atalho do item que saiu e avisado.
		expect(mocks.inventario.onUpdateItem).toHaveBeenCalledWith(ORIDECON, 0);
	});

	it('dez refinos seguidos nao acumulam copia nenhuma', () => {
		reenviar(0, [oridecon(3, 40)], [arco(5)]);
		for (let nivel = 1; nivel <= 10; ++nivel) {
			reenviar(0, [oridecon(3, 40 - nivel * 2)], [arco(5, { RefiningLevel: nivel })]);
		}
		expect(mocks.inventario.list.filter(i => i.ITID === ARCO)).toHaveLength(1);
		expect(mocks.inventario.list).toHaveLength(2);
	});

	it('o reenvio NORMAL (nada sumiu) mantem todos os itens, na ordem do servidor', () => {
		// Objetos NOVOS a cada reenvio, como os do fio: `setItems` guarda o
		// proprio objeto do pacote na lista.
		const normais = () => [pocao(2, 10), oridecon(3, 4), pocao(7, 1)];
		const equips = () => [arco(5), arco(9)];
		reenviar(0, normais(), equips());
		const antes = indicesDaMochila();
		expect(antes).toEqual([2, 3, 7, 5, 9]);

		reenviar(0, normais(), equips());

		expect(indicesDaMochila()).toEqual(antes);
		expect(mocks.inventario.getItemByIndex(2).count).toBe(10);
	});

	it('a peca VESTIDA continua vestida (e fora da grade) depois do reenvio', () => {
		reenviar(0, [pocao(2, 10)], [arco(5, { WearState: MAO_DIREITA })]);
		expect(mocks.equipados[5]).toBeDefined();

		reenviar(0, [pocao(2, 10)], [arco(5, { WearState: MAO_DIREITA, RefiningLevel: 1 })]);

		expect(mocks.equipados[5], 'o arco vestido saiu do equipamento').toBeDefined();
		expect(mocks.equipados[5].RefiningLevel).toBe(1);
		expect(mocks.inventario.getItemByIndex(5), 'o arco vestido apareceu tambem na grade').toBeNull();
	});

	it('a peca que o servidor diz estar na MOCHILA sai do equipamento (sem aparecer nos dois)', () => {
		reenviar(0, [], [arco(5, { WearState: MAO_DIREITA })]);
		reenviar(0, [], [arco(5)]);

		expect(mocks.equipados[5]).toBeUndefined();
		expect(indicesDaMochila()).toEqual([5]);
	});

	it('o CARRINHO e o ARMAZEM (outro invType) seguem o caminho de sempre e a mochila nao e tocada', () => {
		reenviar(0, [pocao(2, 10)], [arco(5)]);

		reenviar(1, [oridecon(4, 1)], []);
		reenviar(2, [oridecon(6, 1)], []);

		expect(mocks.cart.setItems).toHaveBeenCalledWith([oridecon(4, 1)]);
		expect(mocks.storageUI.setItems).toHaveBeenCalledWith([oridecon(6, 1)]);
		expect(indicesDaMochila()).toEqual([2, 5]);
	});

	it('lista sem o START/END continua aplicando na hora (o caminho de antes)', () => {
		mocks.hooks.get(PACKET.ZC.SPLIT_SEND_ITEMLIST_NORMAL)({ invType: 0, ItemInfo: [pocao(2, 3)] });
		expect(indicesDaMochila()).toEqual([2]);
	});
});

describe('fantasmasDoReenvio', () => {
	it('a flecha vestida nao e tirada do equipamento pelo reenvio', () => {
		const flecha = { index: 8, ITID: 1750, type: 10, equipped: 1 << 15 };
		const r = fantasmasDoReenvio([flecha], [flecha], [{ ...flecha, WearState: 1 << 15 }], 1 << 15);
		expect(r.vestidos).toEqual([]);
		expect(r.daLista).toEqual([]);
	});

	it('peca vestida que a lista nova nao traz e fantasma vestido', () => {
		const vestido = { index: 5, ITID: ARCO, equipped: MAO_DIREITA };
		const r = fantasmasDoReenvio([], [vestido], [], 1 << 15);
		expect(r.vestidos).toEqual([vestido]);
	});
});
