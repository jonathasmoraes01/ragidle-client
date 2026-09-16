/**
 * "TUDO NO MAX" SO ALCANCA A VISTA — E AGORA ISSO E' VISIVEL (C-1, 14/09/2026).
 *
 * `encherOuLimparAVista` sempre operou so sobre `_visiveis` (a aba/busca
 * atual) — de proposito, e documentado no proprio codigo. O problema que o
 * coordenador apontou nao era a REGRA, era a AUSENCIA de aviso: o botao
 * dizia "Tudo no máx" tanto com quanto sem filtro, e so o `title` (tooltip
 * que ninguem ve no toque) contava a diferenca. Um jogador com a aba
 * "Diversos" ativa podia clicar "Tudo no máx" achando que encheu a loja
 * inteira e sair vendendo so uma fatia.
 *
 * O conserto: o TEXTO do botao muda quando ha filtro ("Tudo à vista"), e um
 * segundo botao (".ns-tudo-lista") aparece oferecendo o alcance cheio sem
 * exigir que o jogador limpe o filtro sozinho.
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
	},
	// ITID 501 = arma (categoria "armas"); ITID 502 = etc (categoria "diversos").
	// Valores reais de DB/Items/ItemType.js (WEAPON=5, ETC=3) — nao adianta
	// inventar numero aqui, e' `categoriaDoTipo` (vitrine.js) quem decide a
	// aba a partir DELES.
	tipos: { 501: 5 /* ItemType.WEAPON */, 502: 3 /* ItemType.ETC */ }
}));

vi.mock('Network/NetworkManager.js', () => ({ default: mocks.network }));
vi.mock('DB/DBManager.js', () => ({
	default: { getMessage: () => '', getItemInfo: () => ({}), getItemName: item => `Item ${item.ITID}` }
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
	tipoDeItem: itid => mocks.tipos[itid] ?? 3
}));

const { default: NpcStore } = await import('UI/Components/NpcStore/NpcStoreV2/NpcStoreV2.js');
const { default: htmlDoComponente } = await import('UI/Components/NpcStore/NpcStoreV2/NpcStoreV2.html?raw');

const ARMA = { index: 1, ITID: 501, IsIdentified: 1, count: 3, PlaceETCTab: 0 };
const ETC = { index: 2, ITID: 502, IsIdentified: 1, count: 5, PlaceETCTab: 0 };

function qtd(index) {
	return Number(NpcStore.getRoot().querySelector(`[data-index="${index}"] .ns-qtd-in`).value);
}

/**
 * `desenharVista()` so ANEXA ao DOM as linhas da categoria/busca atual — uma
 * linha fora do filtro continua existindo (o valor digitado sobrevive, e' a
 * razao do `_nos` no proprio arquivo), mas fica ORFA, fora de
 * `getRoot().querySelector(...)`. Para ler a quantidade de um item que ficou
 * de fora do filtro no momento do clique, este helper volta a aba "Tudo"
 * (pelo MESMO caminho de clique real) antes de ler.
 */
function voltarParaTudo() {
	const root = NpcStore.getRoot();
	root.querySelector('.ns-abas').innerHTML = '<button class="ns-aba" data-categoria="tudo"></button>';
	root.querySelector('.ns-aba').dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function irParaAba(categoria) {
	const root = NpcStore.getRoot();
	root.querySelector('.ns-abas').innerHTML = `<button class="ns-aba" data-categoria="${categoria}"></button>`;
	root.querySelector('.ns-aba').dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('o botao de acao em massa avisa quando o alcance encolhe, e oferece a lista inteira', () => {
	beforeEach(async () => {
		NpcStore._host = document.createElement('div');
		NpcStore._host.innerHTML = htmlDoComponente;
		// `_shadow = _host` (e nao `null`): este teste precisa dos ouvintes de
		// clique de verdade (`init()`), e `draggable('.ns-header')` dentro dele
		// le `this._shadow.querySelector(...)` direto — com `_shadow` nulo isso
		// estoura. Reusar o proprio host como "shadow" mantem `getRoot()`
		// (`_shadow || _host`) apontando pro mesmo elemento de sempre.
		NpcStore._shadow = NpcStore._host;
		NpcStore._container = NpcStore._host;
		NpcStore.init();

		mocks.inventoryUI.itens = new Map([
			[ARMA.index, { ...ARMA }],
			[ETC.index, { ...ETC }]
		]);

		NpcStore.setType(NpcStore.Type.SELL);
		NpcStore.setList([
			{ index: ARMA.index, price: 100, overchargeprice: 100 },
			{ index: ETC.index, price: 10, overchargeprice: 10 }
		]);
		// `carregarFichasDeItem` resolve async (mesmo mockada como `false`) —
		// espera o microtask antes de cada asserção, para o teste nao correr
		// contra a promise do proprio setList.
		await Promise.resolve();
	});

	it('sem filtro, o botao principal diz "a lista" e o segundo botao fica escondido', () => {
		const root = NpcStore.getRoot();
		expect(root.querySelector('.ns-tudo').textContent).toBe('Tudo no máx');
		expect(root.querySelector('.ns-tudo-lista').hidden).toBe(true);
	});

	it('com uma aba ativa, o botao principal avisa "à vista" e enche SO a aba', () => {
		const root = NpcStore.getRoot();
		irParaAba('armas');

		expect(root.querySelector('.ns-tudo').textContent).toBe('Tudo à vista');
		expect(root.querySelector('.ns-tudo-lista').hidden).toBe(false);
		expect(root.querySelector('.ns-tudo-lista').textContent).toBe('Lista inteira');

		root.querySelector('.ns-tudo').click();
		voltarParaTudo();

		expect(qtd(ARMA.index), 'a arma (na aba ativa) deveria ter enchido').toBe(3);
		expect(qtd(ETC.index), 'o item de outra aba NAO pode encher pelo botao de vista').toBe(0);
	});

	it('"lista inteira" enche TODAS as categorias, ignorando a aba ativa', () => {
		const root = NpcStore.getRoot();
		irParaAba('armas');

		root.querySelector('.ns-tudo-lista').click();
		voltarParaTudo();

		expect(qtd(ARMA.index)).toBe(3);
		expect(qtd(ETC.index), 'a lista inteira devia alcancar o item fora da aba tambem').toBe(5);
	});
});
