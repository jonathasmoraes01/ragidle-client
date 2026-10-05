/**
 * OS ATALHOS DE QUANTIDADE DA COMPRA: "70%" e "Máx" (05/10/2026, sugestao de
 * jogador: *"comprar ate 70% (para cacar) ou deixar sem limite"*).
 *
 * A regra mora em `quantidadeDeCompra.js` e e medida aqui sem DOM; a janela de
 * verdade (`NpcStoreV2.js`) e montada no jsdom, com o mesmo arreio de
 * `maxRespeitaOPeso.test.js`, para provar o clique.
 *
 * 70% e o `natural_heal_weight_rate`: com `floor(peso * 100 / teto) >= 70` a
 * regeneracao natural para (pc.cpp:3012-3030, `game/peso.ts`). O "Máx" vai ao
 * teto que o servidor aceita: `peso + compra > teto` recusa, igual passa.
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
const { atalhosDaLinha, cabeAtePercentual, cabeNoDinheiro, cabeNoPeso, PERCENTUAL_PARA_CACAR } = await import(
	'UI/Components/NpcStore/NpcStoreV2/quantidadeDeCompra.js'
);

describe('a conta dos atalhos (sem DOM)', () => {
	it('o degrau e 70, o natural_heal_weight_rate', () => {
		expect(PERCENTUAL_PARA_CACAR).toBe(70);
	});

	it('70%: a maior quantidade que fica ABAIXO de 70 (exatamente 70 ja e sobrecarga)', () => {
		// teto 1000, vazio, item 100: 6 unidades = 600 (60%); 7 = 700 (70%, ja para).
		expect(cabeAtePercentual({ pesoAtual: 0, pesoMaximo: 1000, pesoDoItem: 100, pesoDoResto: 0 })).toBe(6);
		// item 99: 7 = 693 (69%), 8 = 792.
		expect(cabeAtePercentual({ pesoAtual: 0, pesoMaximo: 1000, pesoDoItem: 99, pesoDoResto: 0 })).toBe(7);
		// 1 decigrama: 699 e o ultimo abaixo de 70%.
		expect(cabeAtePercentual({ pesoAtual: 0, pesoMaximo: 1000, pesoDoItem: 1, pesoDoResto: 0 })).toBe(699);
	});

	it('70%: o resto da compra e o que ja se carrega entram na conta', () => {
		expect(cabeAtePercentual({ pesoAtual: 300, pesoMaximo: 1000, pesoDoItem: 100, pesoDoResto: 200 })).toBe(1);
		expect(cabeAtePercentual({ pesoAtual: 700, pesoMaximo: 1000, pesoDoItem: 1, pesoDoResto: 0 })).toBe(0);
		expect(cabeAtePercentual({ pesoAtual: 900, pesoMaximo: 1000, pesoDoItem: 1, pesoDoResto: 0 })).toBe(0);
	});

	it('70%: sem peso do item ou sem teto, a conta nao inventa (null); item sem peso nao limita', () => {
		expect(cabeAtePercentual({ pesoAtual: 0, pesoMaximo: 1000, pesoDoItem: null, pesoDoResto: 0 })).toBeNull();
		expect(cabeAtePercentual({ pesoAtual: 0, pesoMaximo: 0, pesoDoItem: 10, pesoDoResto: 0 })).toBeNull();
		expect(cabeAtePercentual({ pesoAtual: 0, pesoMaximo: 1000, pesoDoItem: 0, pesoDoResto: 0 })).toBe(Infinity);
	});

	it('Máx: o peso vai ate o teto do servidor (igual passa)', () => {
		expect(cabeNoPeso({ pesoAtual: 0, pesoMaximo: 1000, pesoDoItem: 100, pesoDoResto: 0 })).toBe(10);
		expect(cabeNoPeso({ pesoAtual: 50, pesoMaximo: 1000, pesoDoItem: 100, pesoDoResto: 350 })).toBe(6);
		expect(cabeNoPeso({ pesoAtual: 1100, pesoMaximo: 1000, pesoDoItem: 100, pesoDoResto: 0 })).toBe(0);
		expect(cabeNoPeso({ pesoAtual: 0, pesoMaximo: 1000, pesoDoItem: null, pesoDoResto: 0 })).toBe(Infinity);
	});

	it('o dinheiro desconta o resto da compra', () => {
		expect(cabeNoDinheiro({ saldo: 1000, preco: 15, custoDoResto: 100 })).toBe(60);
		expect(cabeNoDinheiro({ saldo: 100, preco: 15, custoDoResto: 200 })).toBe(0);
		expect(cabeNoDinheiro({ saldo: 0, preco: 0, custoDoResto: 0 })).toBe(Infinity);
	});

	it('a linha: o 70% nunca passa do Máx, e o Máx nunca passa do teto da linha', () => {
		const base = { pesoAtual: 0, pesoMaximo: 1000, pesoDoItem: 10, pesoDoResto: 0, preco: 1, custoDoResto: 0 };
		expect(atalhosDaLinha({ ...base, tetoDaLinha: 9999, saldo: 100000 })).toEqual({ maximo: 89, ateParaCacar: 69 });
		expect(atalhosDaLinha({ ...base, tetoDaLinha: 9999, saldo: 30 })).toEqual({ maximo: 30, ateParaCacar: 30 });
		expect(atalhosDaLinha({ ...base, tetoDaLinha: 5, saldo: 100000 })).toEqual({ maximo: 5, ateParaCacar: 5 });
	});

	it('a linha: peso do resto desconhecido -> Máx volta ao teto da linha e o 70% some', () => {
		const p = {
			tetoDaLinha: 42,
			pesoAtual: 0,
			pesoMaximo: 1000,
			pesoDoItem: 10,
			pesoDoResto: null,
			saldo: 100000,
			preco: 1,
			custoDoResto: 0
		};
		expect(atalhosDaLinha(p)).toEqual({ maximo: 42, ateParaCacar: null });
	});

	it('a linha: escambo (saldo null) nao limita pelo dinheiro', () => {
		const p = {
			tetoDaLinha: 9999,
			pesoAtual: 0,
			pesoMaximo: 1000,
			pesoDoItem: 10,
			pesoDoResto: 0,
			saldo: null,
			preco: 50,
			custoDoResto: 0
		};
		expect(atalhosDaLinha(p).maximo).toBe(89);
	});
});

function qtd(index) {
	return Number(NpcStore.getRoot().querySelector(`[data-index="${index}"] .ns-qtd-in`).value);
}

function botao(index, cls) {
	return NpcStore.getRoot().querySelector(`[data-index="${index}"] .${cls}`);
}

function montar(tipo) {
	NpcStore._host = document.createElement('div');
	NpcStore._host.innerHTML = htmlDoComponente;
	NpcStore._shadow = NpcStore._host;
	NpcStore._container = NpcStore._host;
	NpcStore.init();
	NpcStore.setType(tipo);
}

describe('os atalhos na janela de compra (BUY)', () => {
	beforeEach(() => {
		mocks.pesos = { 501: 50, 602: 0 };
		mocks.session.zeny = 1000000;
		mocks.session.Entity = { weight: 2000, max_weight: 10000 };
		montar(NpcStore.Type.BUY);
	});

	it('"70%" enche ate ficar abaixo de 70% da capacidade', () => {
		NpcStore.setList([{ index: 0, ITID: 501, price: 15, count: 9999 }]);
		const b = botao(0, 'ns-cacar');
		expect(b.disabled).toBe(false);
		expect(b.textContent).toBe('70%');
		b.click();
		// 2000 + 99 * 50 = 6950 (69%); 100 seriam 7000 (70%).
		expect(qtd(0)).toBe(99);
	});

	it('"Máx" trava abaixo de 90% (ordem do dono: 89%), onde ataque e habilidade param', () => {
		NpcStore.setList([{ index: 0, ITID: 501, price: 15, count: 9999 }]);
		botao(0, 'ns-max').click();
		// 2000 + 139 * 50 = 8950 (89%); 140 seriam 9000 (90%). O servidor aceitaria 160.
		expect(qtd(0)).toBe(139);
	});

	it('a segunda linha desconta a primeira (peso e zeny), e o Comprar nao trava', () => {
		NpcStore.setList([
			{ index: 0, ITID: 501, price: 15, count: 9999 },
			{ index: 1, ITID: 501, price: 15, count: 9999 }
		]);
		botao(0, 'ns-cacar').click();
		expect(qtd(0)).toBe(99);
		// a primeira linha ja levou a mochila ao degrau: o 70% da segunda apaga
		expect(botao(1, 'ns-cacar').disabled).toBe(true);
		botao(1, 'ns-cacar').click();
		expect(qtd(1)).toBe(0);
		botao(1, 'ns-max').click();
		// 2000 + 99*50 = 6950; abaixo de 9000 (90%) cabem 40 (8950).
		expect(qtd(1)).toBe(40);
		expect(NpcStore.getRoot().querySelector('.ns-agir').disabled).toBe(false);
	});

	it('a propria linha nao entra no resto: 70% e depois Máx na MESMA linha vai ao degrau de 89%', () => {
		NpcStore.setList([{ index: 0, ITID: 501, price: 15, count: 9999 }]);
		botao(0, 'ns-cacar').click();
		expect(qtd(0)).toBe(99);
		botao(0, 'ns-max').click();
		expect(qtd(0)).toBe(139);
		botao(0, 'ns-cacar').click();
		expect(qtd(0)).toBe(99);
	});

	it('o "70%" apaga quando a mochila ja esta no degrau', () => {
		mocks.session.Entity = { weight: 7000, max_weight: 10000 };
		NpcStore.setList([{ index: 0, ITID: 501, price: 15, count: 9999 }]);
		expect(botao(0, 'ns-cacar').disabled).toBe(true);
	});

	it('o "70%" apaga para item de peso desconhecido (regra 1)', () => {
		NpcStore.setList([{ index: 0, ITID: 999, price: 15, count: 9999 }]);
		expect(botao(0, 'ns-cacar').disabled).toBe(true);
	});

	it('o zeny que a outra linha ja gastou sai do Máx da segunda', () => {
		mocks.session.zeny = 1500; // 100 pocoes a 15
		NpcStore.setList([
			{ index: 0, ITID: 602, price: 15, count: 9999 }, // nao pesa: so o zeny limita
			{ index: 1, ITID: 602, price: 15, count: 9999 }
		]);
		NpcStore.getRoot().querySelector('[data-index="0"] .ns-qtd-in').value = '60';
		NpcStore.getRoot().querySelector('[data-index="0"] .ns-qtd-in').dispatchEvent(new Event('change', { bubbles: true }));
		expect(qtd(0)).toBe(60);
		botao(1, 'ns-max').click();
		expect(qtd(1)).toBe(40);
		expect(NpcStore.getRoot().querySelector('.ns-agir').disabled).toBe(false);
	});

	it('o zeny aperta os dois atalhos', () => {
		mocks.session.zeny = 300;
		NpcStore.setList([{ index: 0, ITID: 501, price: 15, count: 9999 }]);
		botao(0, 'ns-cacar').click();
		expect(qtd(0)).toBe(20);
	});
});

describe('a venda nao ganha o "70%"', () => {
	it('so o Máx de sempre', () => {
		mocks.pesos = { 900: 500 };
		mocks.session.Entity = { weight: 999, max_weight: 1000 };
		mocks.inventoryUI.getItemByIndex = index =>
			index === 0 ? { index: 0, ITID: 900, count: 12, IsIdentified: 1, PlaceETCTab: 0 } : null;
		montar(NpcStore.Type.SELL);
		NpcStore.setList([{ index: 0, price: 10, overchargeprice: 10 }]);
		expect(botao(0, 'ns-cacar')).toBeNull();
		botao(0, 'ns-max').click();
		expect(qtd(0)).toBe(12);
	});
});
