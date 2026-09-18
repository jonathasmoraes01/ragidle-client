/**
 * A TRAVA POR ITEM/PILHA PROTEGE CONTRA VENDA (R14/C2-3, 14/09/2026).
 *
 * Contrato do servidor (D-1462, publicado pelo coordenador): `ZC_RAGIDLE_TRAVAS`
 * manda `{v:1, travados: number[], recusa?}` — `travados` sao SLOTS. O
 * cliente guarda isso em `item.travado` (InventoryCommon.js, `aplicarTravas`/
 * `estaTravado` — a mesma casa de `PlaceETCTab`) e as duas janelas de venda
 * (NpcStoreV2 e a V1 legada) tem de excluir o item travado, **mesmo com o
 * cadeado geral `npcsalelock` DESLIGADO** — a trava e' do servidor, e vale
 * sempre; `npcsalelock` e' preferencia do jogador, e so entra quando a trava
 * NAO se aplica.
 *
 * PENDENCIA DECLARADA (ver o relatorio do agente): os opcodes que o
 * coordenador passou (CZ_RAGIDLE_TRAVA_ACAO = 0x0fc7 / ZC_RAGIDLE_TRAVAS =
 * 0x0fc8) COLIDEM com CZ_RAGIDLE_COMANDOS_ACAO/ZC_RAGIDLE_COMANDOS, ja em
 * producao (PacketStructure.js:16501-16525, PacketRegister.js:1038-1039) —
 * por isso este arquivo testa so o lado CLIENTE da trava (o campo
 * `item.travado` e o que as janelas de venda fazem com ele), sem registrar
 * pacote nenhum em `PacketRegister.js`. A fiacao de rede fica para quando o
 * senior confirmar numeros livres (candidatos verificados: 0x0fc0-0x0fc5,
 * todos sem nenhum uso hoje).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
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

vi.mock('Network/NetworkManager.js', () => ({ default: { sendPacket: () => {}, hookPacket: () => {} } }));
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
vi.mock('UI/Components/Inventory/Inventory.js', () => ({ default: { getUI: () => mocks.inventoryUI } }));
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

const ITEM_TRAVADO = { index: 11, ITID: 700, IsIdentified: 1, count: 2, PlaceETCTab: 0, travado: true };
const ITEM_LIVRE = { index: 12, ITID: 701, IsIdentified: 1, count: 2, PlaceETCTab: 0, travado: false };

describe('a trava por pilha vence a janela de vender, com ou sem o cadeado geral', () => {
	beforeEach(() => {
		NpcStore._host = document.createElement('div');
		NpcStore._host.innerHTML = htmlDoComponente;
		NpcStore._shadow = null;

		mocks.inventoryUI.itens = new Map([
			[ITEM_TRAVADO.index, { ...ITEM_TRAVADO }],
			[ITEM_LIVRE.index, { ...ITEM_LIVRE }]
		]);

		NpcStore.setType(NpcStore.Type.SELL);
	});

	it('com npcsalelock DESLIGADO, o item travado ainda assim some da lista de vender', () => {
		mocks.inventoryUI.npcsalelock = false;

		NpcStore.setList([
			{ index: ITEM_TRAVADO.index, price: 10, overchargeprice: 10 },
			{ index: ITEM_LIVRE.index, price: 10, overchargeprice: 10 }
		]);

		const root = NpcStore.getRoot();
		expect(
			root.querySelector(`[data-index="${ITEM_TRAVADO.index}"]`),
			'o item travado apareceu na venda mesmo com o cadeado geral desligado'
		).toBeNull();
		expect(root.querySelector(`[data-index="${ITEM_LIVRE.index}"]`), 'o item livre nao deveria sumir junto').not.toBeNull();
	});

	it('com npcsalelock LIGADO, o item travado continua fora (e o livre continua vendavel)', () => {
		mocks.inventoryUI.npcsalelock = true;

		NpcStore.setList([
			{ index: ITEM_TRAVADO.index, price: 10, overchargeprice: 10 },
			{ index: ITEM_LIVRE.index, price: 10, overchargeprice: 10 }
		]);

		const root = NpcStore.getRoot();
		expect(root.querySelector(`[data-index="${ITEM_TRAVADO.index}"]`)).toBeNull();
		expect(root.querySelector(`[data-index="${ITEM_LIVRE.index}"]`)).not.toBeNull();
	});

	it('destravar (travado:false, o que o servidor manda ao alternar) devolve o item a lista', () => {
		mocks.inventoryUI.itens.set(ITEM_TRAVADO.index, { ...ITEM_TRAVADO, travado: false });

		NpcStore.setList([{ index: ITEM_TRAVADO.index, price: 10, overchargeprice: 10 }]);

		expect(NpcStore.getRoot().querySelector(`[data-index="${ITEM_TRAVADO.index}"]`)).not.toBeNull();
	});

	/*
	 * A JANELA DIZ QUANTOS ESCONDEU (18/09/2026).
	 *
	 * Esconder e' o comportamento certo — os tres casos acima o pinam. O que
	 * faltava era o jogador SABER: o item travado saia da lista em silencio, e
	 * quem travou semanas antes procura, nao acha, e conclui que perdeu o item.
	 */
	it('a linha de aviso conta quantos a trava escondeu, e some quando nao ha nenhum', () => {
		mocks.inventoryUI.npcsalelock = false;

		NpcStore.setList([
			{ index: ITEM_TRAVADO.index, price: 10, overchargeprice: 10 },
			{ index: ITEM_LIVRE.index, price: 10, overchargeprice: 10 }
		]);

		const aviso = NpcStore.getRoot().querySelector('.ns-travados');
		expect(aviso, 'o elemento do aviso nao existe no HTML da janela').not.toBeNull();
		expect(aviso.hidden, 'havia 1 item travado e o aviso ficou escondido').toBe(false);
		expect(aviso.textContent).toContain('1 item travado');
		// O texto tem de MANDAR a acao: "esta escondido" sem "destrave onde"
		// deixaria o jogador exatamente tao perdido quanto o silencio.
		expect(aviso.textContent).toContain('Mochila');

		/*
		 * CONTROLE: sem nenhum travado o aviso SOME. Sem esta metade, um aviso
		 * cravado em `hidden = false` passaria na de cima.
		 */
		mocks.inventoryUI.itens.set(ITEM_TRAVADO.index, { ...ITEM_TRAVADO, travado: false });
		NpcStore.setList([
			{ index: ITEM_TRAVADO.index, price: 10, overchargeprice: 10 },
			{ index: ITEM_LIVRE.index, price: 10, overchargeprice: 10 }
		]);
		expect(
			NpcStore.getRoot().querySelector('.ns-travados').hidden,
			'nenhum item esta travado e o aviso continuou na tela'
		).toBe(true);
	});

	it('o plural sai certo com dois travados', () => {
		mocks.inventoryUI.itens.set(ITEM_LIVRE.index, { ...ITEM_LIVRE, travado: true });

		NpcStore.setList([
			{ index: ITEM_TRAVADO.index, price: 10, overchargeprice: 10 },
			{ index: ITEM_LIVRE.index, price: 10, overchargeprice: 10 }
		]);

		expect(NpcStore.getRoot().querySelector('.ns-travados').textContent).toContain('2 itens travados');
	});

	/*
	 * NA COMPRA O AVISO NUNCA APARECE: a lista e' do NPC, e a trava do jogador
	 * nao a recorta. Sem este caso, um aviso que ignorasse o tipo de loja
	 * passaria nos dois de cima — e apareceria mentindo numa vitrine.
	 */
	it('a compra nao mostra o aviso, mesmo com item travado na mochila', () => {
		NpcStore.setType(NpcStore.Type.BUY);
		NpcStore.setList([{ index: 0, ITID: 700, price: 10, count: 3, IsIdentified: 1 }]);

		expect(NpcStore.getRoot().querySelector('.ns-travados').hidden).toBe(true);
	});
});
