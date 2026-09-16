/**
 * O BOTAO "Máx" RESPEITA O PESO LIVRE (R17/C2-6, 14/09/2026).
 *
 * Antes, `tetoDoItem` (NpcStoreV2.js) so' olhava ESTOQUE — 9999 numa loja
 * infinita. Comprar flecha/pocao no "Máx" quase sempre pedia mais do que o
 * peso livre aguentava, e o jogador so' descobria no FAIL_WEIGHT do
 * servidor. Formula exigida: floor((pesoMax - pesoAtual) / pesoUnitario),
 * piso 0, depois limitado por dinheiro/preco e estoque, nessa ordem.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	session: { zeny: 1000, cash: 500, Entity: { weight: 0, max_weight: 1000 } },
	pesos: {}, // ITID -> peso em decigramas
	inventoryUI: {
		npcsalelock: false,
		getItemByIndex: () => null,
		getItemById: () => null
	}
}));

vi.mock('Network/NetworkManager.js', () => ({ default: { sendPacket: () => {}, hookPacket: () => {} } }));
vi.mock('DB/DBManager.js', () => ({
	default: { getMessage: () => '', getItemInfo: () => ({}), getItemName: () => '' }
}));
vi.mock('Core/Client.js', () => ({ default: { getFilePath: () => '', loadFile: () => {} } }));
vi.mock('Engine/SessionStorage.js', () => ({ default: mocks.session }));
vi.mock('Controls/KeyEventHandler.js', () => ({ default: { ESCAPE: 27 } }));
vi.mock('UI/UIManager.js', () => ({
	default: { addComponent: c => c, getComponent: () => ({ name: 'InventoryV2' }) }
}));
vi.mock('UI/Components/ItemInfo/ItemInfo.js', () => ({ default: { append: () => {}, set: () => {} } }));
vi.mock('UI/Components/InputBox/InputBox.js', () => ({ default: { append: () => {}, cb: null } }));
vi.mock('UI/Components/Inventory/Inventory.js', () => ({ default: { getUI: () => mocks.inventoryUI } }));
vi.mock('Utils/ItemOptionsView.js', () => ({ RARIDADE_LABEL: {} }));
vi.mock('DB/Items/fichasDeItem.js', () => ({
	CLASSE_DE_RARIDADE: {},
	carregarFichasDeItem: () => Promise.resolve(false),
	pesoDeItem: itid => (itid in mocks.pesos ? mocks.pesos[itid] : null),
	raridadeDeItem: () => null,
	tipoDeItem: () => 'etc'
}));

const { default: NpcStore } = await import('UI/Components/NpcStore/NpcStoreV2/NpcStoreV2.js');
const { default: htmlDoComponente } = await import('UI/Components/NpcStore/NpcStoreV2/NpcStoreV2.html?raw');

function qtd(index) {
	return Number(NpcStore.getRoot().querySelector(`[data-index="${index}"] .ns-qtd-in`).value);
}

function clicarMax(index) {
	NpcStore.getRoot().querySelector(`[data-index="${index}"] .ns-max`).click();
}

describe('o Máx da compra respeita o peso livre (BUY)', () => {
	beforeEach(() => {
		NpcStore._host = document.createElement('div');
		NpcStore._host.innerHTML = htmlDoComponente;
		NpcStore._shadow = NpcStore._host;
		NpcStore._container = NpcStore._host;
		NpcStore.init();
		mocks.pesos = {};
		mocks.session.zeny = 100000;
		mocks.session.cash = 500;
		mocks.session.Entity = { weight: 0, max_weight: 1000 };
		NpcStore.setType(NpcStore.Type.BUY);
	});

	it('peso 100 (decigramas) e 1000 livres -> Máx = 10, mesmo com estoque/zeny maiores', () => {
		mocks.pesos[900] = 100;
		NpcStore.setList([{ index: 0, ITID: 900, price: 1, count: 9999 }]);

		clicarMax(0);

		expect(qtd(0)).toBe(10);
	});

	it('capacidade ja quase cheia (50 livres, peso 100) trava em 0 — nunca negativo', () => {
		mocks.pesos[900] = 100;
		mocks.session.Entity = { weight: 950, max_weight: 1000 };
		NpcStore.setList([{ index: 0, ITID: 900, price: 1, count: 9999 }]);

		clicarMax(0);

		expect(qtd(0)).toBe(0);
	});

	it('dinheiro manda quando e' + ' o teto mais apertado (peso permitiria mais)', () => {
		mocks.pesos[900] = 10; // 1000 livres / 10 = 100 pelo peso
		mocks.session.zeny = 250; // so' da pra 50 a 5 cada
		NpcStore.setList([{ index: 0, ITID: 900, price: 5, count: 9999 }]);

		clicarMax(0);

		expect(qtd(0)).toBe(50);
	});

	it('estoque manda quando e' + ' o teto mais apertado (peso e dinheiro permitiriam mais)', () => {
		mocks.pesos[900] = 1; // 1000 livres / 1 = 1000 pelo peso
		mocks.session.zeny = 100000; // 100000/1 = 100000 pelo dinheiro
		NpcStore.setList([{ index: 0, ITID: 900, price: 1, count: 7 }]); // so' 7 em estoque

		clicarMax(0);

		expect(qtd(0)).toBe(7);
	});

	it('peso zero (item que nao pesa) nao cria teto nenhum pelo peso', () => {
		mocks.pesos[900] = 0;
		mocks.session.Entity = { weight: 999, max_weight: 1000 }; // so' 1 decigrama livre
		mocks.session.zeny = 30;
		NpcStore.setList([{ index: 0, ITID: 900, price: 10, count: 9999 }]);

		clicarMax(0);

		// Sem peso, o teto vira dinheiro: 30/10 = 3.
		expect(qtd(0)).toBe(3);
	});

	it('peso DESCONHECIDO (ficha nao publicada) nao inventa teto — regra 1 do projeto', () => {
		// ITID 901 nao entra em mocks.pesos: pesoDeItem devolve null.
		mocks.session.Entity = { weight: 999, max_weight: 1000 };
		mocks.session.zeny = 100000;
		NpcStore.setList([{ index: 0, ITID: 901, price: 1, count: 42 }]);

		clicarMax(0);

		// Sem dado de peso, so' estoque/dinheiro contam: aqui e' o estoque (42).
		expect(qtd(0)).toBe(42);
	});
});

describe('o Máx da venda (SELL) nunca leva peso em conta', () => {
	beforeEach(() => {
		NpcStore._host = document.createElement('div');
		NpcStore._host.innerHTML = htmlDoComponente;
		NpcStore._shadow = NpcStore._host;
		NpcStore._container = NpcStore._host;
		NpcStore.init();
		mocks.pesos = { 900: 500 }; // pesado de proposito
		mocks.session.Entity = { weight: 999, max_weight: 1000 }; // quase sem peso livre
		mocks.inventoryUI.getItemByIndex = index =>
			index === 0 ? { index: 0, ITID: 900, count: 12, IsIdentified: 1, PlaceETCTab: 0 } : null;
		NpcStore.setType(NpcStore.Type.SELL);
	});

	it('vender nao pesa: o teto e' + ' so' + ' o que o jogador TEM (12), nao o peso livre', () => {
		NpcStore.setList([{ index: 0, price: 10, overchargeprice: 10 }]);

		clicarMax(0);

		expect(qtd(0)).toBe(12);
	});
});
