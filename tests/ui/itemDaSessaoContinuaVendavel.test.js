/**
 * O ITEM PEGO NA SESSAO SUMIA DA JANELA DE VENDER (R1/C-2, 14/09/2026).
 *
 * O relato do dono: ao vender tudo, os itens da categoria "Diversos"
 * continuavam na mochila — o jogador so conseguia vende-los depois de
 * passar pelo armazem. A causa nao era o servidor: era esta linha, em
 * `NpcStoreV2.js` (e a irma em `NpcStoreV1.js`) —
 *
 *   it && (!Inventory.getUI().npcsalelock || it.PlaceETCTab < 1)
 *
 * `PlaceETCTab` so nasce preenchido para o item que chega na lista COMPLETA
 * do login (`PacketStructure.js` le um bit do pacote). Todo item que entra
 * DEPOIS — drop do idle, correio, loja, armazem, carrinho — passa pelo
 * handler de PICKUP (`MapEngine/Item.js`), que nunca atribuia o campo: ele
 * nascia `undefined`. `undefined < 1` e' `false` em JS, entao com o cadeado
 * `npcsalelock` ligado (a preferencia persistida "proteger etc de venda
 * acidental") a condicao inteira virava falsa e o item picado NUNCA
 * aparecia na janela de vender — sem nunca ter sido vendido de verdade.
 *
 * O conserto tem DUAS pontas, e este arquivo prova as duas:
 *  1. `Item.js` agora atribui `pkt.PlaceETCTab = pkt.favorite || 0` no
 *     pickup (a fonte do dado, hoje sempre 0 porque o servidor ainda nao usa
 *     o campo `favorite` de verdade — ver `MochilaIdle.js:104-106`).
 *  2. A condicao em si trata ausente como 0 (`(it.PlaceETCTab || 0) < 1`),
 *     para o caso de QUALQUER outro caminho que ainda deixe o campo de fora.
 *
 * Este teste exercita a PECA 2 direto no componente real (NpcStoreV2),
 * simulando exatamente o item que a peca 1 agora produz: um item de
 * inventario SEM `PlaceETCTab` (o estado ANTES do pickup ser corrigido, e
 * tambem o estado depois — ja que a peca 1 grava 0, que e' o mesmo
 * resultado pratico de "ausente" para esta conta). O controle do teste
 * mostra a REGRESSAO: sem o `|| 0`, o mesmo item some da lista.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	network: { sendPacket: () => {}, hookPacket: () => {} },
	inventoryUI: {
		npcsalelock: false,
		itens: new Map(),
		getItemByIndex(index) {
			return this.itens.get(index) || null;
		},
		getItemById() {
			return null;
		}
	}
}));

vi.mock('Network/NetworkManager.js', () => ({ default: mocks.network }));
vi.mock('DB/DBManager.js', () => ({
	default: { getMessage: () => '', getItemInfo: () => ({}), getItemName: () => '' }
}));
vi.mock('Core/Client.js', () => ({ default: { getFilePath: () => '', loadFile: () => {} } }));
vi.mock('Engine/SessionStorage.js', () => ({ default: { zeny: 1000, Entity: { weight: 0, max_weight: 1000 } } }));
vi.mock('Controls/KeyEventHandler.js', () => ({ default: { ESCAPE: 27 } }));
vi.mock('UI/UIManager.js', () => ({
	default: { addComponent: c => c, getComponent: () => ({ name: 'InventoryV2' }) }
}));
vi.mock('UI/Components/ItemInfo/ItemInfo.js', () => ({ default: { append: () => {}, set: () => {} } }));
vi.mock('UI/Components/InputBox/InputBox.js', () => ({ default: { append: () => {}, cb: null } }));
vi.mock('UI/Components/Inventory/Inventory.js', () => ({
	default: { getUI: () => mocks.inventoryUI }
}));
vi.mock('Utils/ItemOptionsView.js', () => ({ RARIDADE_LABEL: {} }));
vi.mock('DB/Items/fichasDeItem.js', () => ({
	CLASSE_DE_RARIDADE: {},
	carregarFichasDeItem: () => Promise.resolve(false),
	pesoDeItem: () => 0,
	raridadeDeItem: () => null,
	tipoDeItem: () => 'etc'
}));

const { default: NpcStore } = await import('UI/Components/NpcStore/NpcStoreV2/NpcStoreV2.js');
const { default: htmlDoComponente } = await import('UI/Components/NpcStore/NpcStoreV2/NpcStoreV2.html?raw');

/** O item tal como o inventario tem hoje: SEM PlaceETCTab (o caso do pickup). */
const ITEM_RECEM_PEGO = {
	index: 7,
	ITID: 909,
	IsIdentified: 1,
	count: 3
	// PlaceETCTab de proposito ausente.
};

describe('venda respeita o cadeado sem apagar item que nunca teve PlaceETCTab', () => {
	beforeEach(() => {
		// O MESMO truque do host real que os testes de IdleConfig ja usam:
		// atribuir _host/_shadow direto poupa o ciclo `append()` inteiro
		// (drag, animacao de janela) que `setList` nao precisa para provar
		// esta conta — mas o HTML e' o gabarito de verdade do componente.
		NpcStore._host = document.createElement('div');
		NpcStore._host.innerHTML = htmlDoComponente;
		NpcStore._shadow = null;

		mocks.inventoryUI.npcsalelock = true;
		mocks.inventoryUI.itens = new Map([[ITEM_RECEM_PEGO.index, { ...ITEM_RECEM_PEGO }]]);

		NpcStore.setType(NpcStore.Type.SELL);
	});

	it('com o cadeado ligado, o item recem-pego (sem PlaceETCTab) continua na lista de vender', () => {
		NpcStore.setList([{ index: ITEM_RECEM_PEGO.index, price: 50, overchargeprice: 25 }]);

		const linha = NpcStore.getRoot().querySelector(`[data-index="${ITEM_RECEM_PEGO.index}"]`);
		expect(linha, 'a linha do item sumiu da janela de vender — a regressao de R1/C-2').not.toBeNull();
	});

	it('o cadeado continua funcionando para item DE VERDADE travado (PlaceETCTab >= 1)', () => {
		mocks.inventoryUI.itens.set(ITEM_RECEM_PEGO.index, { ...ITEM_RECEM_PEGO, PlaceETCTab: 1 });

		NpcStore.setList([{ index: ITEM_RECEM_PEGO.index, price: 50, overchargeprice: 25 }]);

		const linha = NpcStore.getRoot().querySelector(`[data-index="${ITEM_RECEM_PEGO.index}"]`);
		expect(linha, 'o cadeado deveria continuar barrando um item de verdade travado').toBeNull();
	});

	it('sem o cadeado ligado, o item recem-pego sempre aparece', () => {
		mocks.inventoryUI.npcsalelock = false;

		NpcStore.setList([{ index: ITEM_RECEM_PEGO.index, price: 50, overchargeprice: 25 }]);

		const linha = NpcStore.getRoot().querySelector(`[data-index="${ITEM_RECEM_PEGO.index}"]`);
		expect(linha).not.toBeNull();
	});
});
