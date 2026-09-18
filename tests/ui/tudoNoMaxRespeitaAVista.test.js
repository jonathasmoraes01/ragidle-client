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
 *
 * ─────────────────────────────────────────────────────────────────────────
 * 18/09/2026 — A `.ns-tudo-lista` SAIU DA VENDA, e este arquivo PINAVA o
 * comportamento que queimou um jogador. Relato dele, textual:
 *
 *   *"tem que dar uma olhada no npc de venda, voce seleciona a aba clica
 *   lista inteira vai tudo mesmo oq nao estava na lista, vendi minha katar
 *   assim kkkk"*
 *
 * O caso `'"lista inteira" enche TODAS as categorias, ignorando a aba ativa'`
 * rodava em modo SELL e aprovava exatamente isso. **O botao nao tinha
 * defeito** — ele fazia o que o `title` prometia; o defeito e' que so aparece
 * DEPOIS de o jogador escolher uma aba, e "lista inteira" ali le como "a
 * lista que estou vendo". A leitura errada e' a natural.
 *
 * Hoje o alcance em massa da VENDA e' sempre o que esta a vista, e o caso da
 * lista inteira migrou para a COMPRA — onde nada sai da mochila ate o botao
 * de agir e o total esta na tela. Sem esse caso de compra, esta rodada
 * estaria apagando a funcionalidade em vez de recorta-la.
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
	tipos: { 501: 5 /* ItemType.WEAPON */, 502: 3 /* ItemType.ETC */ },
	// O prompt da venda: guarda a pergunta e os dois ramos, sem desenhar nada.
	prompt: { texto: null, sim: null, nao: null, vezes: 0 }
}));

vi.mock('Network/NetworkManager.js', () => ({ default: mocks.network }));
vi.mock('DB/DBManager.js', () => ({
	default: { getMessage: () => '', getItemInfo: () => ({}), getItemName: item => `Item ${item.ITID}` }
}));
vi.mock('Core/Client.js', () => ({ default: { getFilePath: () => '', loadFile: () => {} } }));
vi.mock('Engine/SessionStorage.js', () => ({ default: { zeny: 1000, Entity: { weight: 0, max_weight: 1000 } } }));
vi.mock('Controls/KeyEventHandler.js', () => ({ default: { ESCAPE: 27 } }));
vi.mock('UI/UIManager.js', () => ({
	default: {
		addComponent: c => c,
		getComponent: () => ({ name: 'InventoryV2' }),
		showPromptBox: (texto, _sim, _nao, onSim, onNao) => {
			mocks.prompt.texto = texto;
			mocks.prompt.sim = onSim;
			mocks.prompt.nao = onNao;
			mocks.prompt.vezes += 1;
		}
	}
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

/** Monta a janela do zero. `init()` de verdade: os cliques deste teste sao reais. */
function montarJanela() {
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
	mocks.prompt.texto = null;
	mocks.prompt.sim = null;
	mocks.prompt.nao = null;
	mocks.prompt.vezes = 0;
}

describe('o botao de acao em massa avisa quando o alcance encolhe (VENDA)', () => {
	beforeEach(async () => {
		montarJanela();

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
		/*
		 * `_categoria` e' estado de MODULO e sobrevive a remontagem da janela:
		 * sem esta linha, um caso que termina numa aba deixa o SEGUINTE
		 * comecando filtrado, e o "Tudo no máx" dele alcanca so aquela aba.
		 * Custou uma reprovacao (o prompt disse "1 item" onde a conta era 2).
		 */
		voltarParaTudo();
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

		root.querySelector('.ns-tudo').click();
		voltarParaTudo();

		expect(qtd(ARMA.index), 'a arma (na aba ativa) deveria ter enchido').toBe(3);
		expect(qtd(ETC.index), 'o item de outra aba NAO pode encher pelo botao de vista').toBe(0);
	});

	it('NA VENDA o botao "lista inteira" nao existe, nem com aba ativa (18/09/2026)', () => {
		const root = NpcStore.getRoot();
		irParaAba('armas');

		/*
		 * O CONTROLE deste caso e' o de cima: com a aba ativa, o botao
		 * PRINCIPAL muda de texto — entao o filtro esta mesmo ligado, e o
		 * `hidden` abaixo nao esta passando por falta de filtro.
		 */
		expect(root.querySelector('.ns-tudo').textContent).toBe('Tudo à vista');
		expect(
			root.querySelector('.ns-tudo-lista').hidden,
			'a "lista inteira" voltou a venda: e o gesto que vendeu a katar do jogador'
		).toBe(true);
	});

	it('a venda PERGUNTA antes, e o "não" nao manda nada', () => {
		const root = NpcStore.getRoot();
		const enviados = [];
		NpcStore.onSubmit = escolha => enviados.push(escolha);

		root.querySelector('.ns-tudo').click();
		root.querySelector('.ns-agir').click();

		expect(mocks.prompt.vezes, 'a venda saiu sem perguntar').toBe(1);
		expect(enviados.length, 'a venda foi mandada ANTES da resposta').toBe(0);
		// Quantos e quanto: 2 linhas, 8 unidades, 3x100 + 5x10 = 350z.
		expect(mocks.prompt.texto).toContain('2 itens');
		expect(mocks.prompt.texto).toContain('8 unidades');
		expect(mocks.prompt.texto).toContain('350');

		mocks.prompt.nao();
		expect(enviados.length, 'o "não" mandou a venda mesmo assim').toBe(0);
		expect(qtd(ARMA.index), 'o "não" limpou a escolha do jogador').toBe(3);

		mocks.prompt.sim();
		expect(enviados.length, 'o "sim" nao mandou a venda').toBe(1);
		expect(enviados[0].length).toBe(2);
		expect(qtd(ARMA.index), 'depois de vender, a escolha tinha de voltar a zero').toBe(0);
	});
});

describe('na COMPRA a "lista inteira" continua existindo e continua alcancando tudo', () => {
	beforeEach(async () => {
		montarJanela();

		NpcStore.setType(NpcStore.Type.BUY);
		NpcStore.setList([
			{ index: 0, ITID: 501, price: 100, count: 3, IsIdentified: 1 },
			{ index: 1, ITID: 502, price: 10, count: 5, IsIdentified: 1 }
		]);
		await Promise.resolve();
		voltarParaTudo(); // `_categoria` e' de modulo — ver a nota no bloco da venda
	});

	it('com aba ativa o botao aparece, e ele enche a categoria de fora tambem', () => {
		const root = NpcStore.getRoot();
		irParaAba('armas');

		expect(root.querySelector('.ns-tudo-lista').hidden).toBe(false);
		expect(root.querySelector('.ns-tudo-lista').textContent).toBe('Lista inteira');

		root.querySelector('.ns-tudo-lista').click();
		voltarParaTudo();

		expect(qtd(0), 'a arma da aba ativa nao encheu').toBeGreaterThan(0);
		expect(qtd(1), 'a lista inteira devia alcancar o item fora da aba tambem').toBeGreaterThan(0);
	});

	it('a compra NAO pergunta — nada sai da mochila, e o total esta na tela', () => {
		const root = NpcStore.getRoot();
		const enviados = [];
		NpcStore.onSubmit = escolha => enviados.push(escolha);

		root.querySelector('.ns-tudo').click();
		root.querySelector('.ns-agir').click();

		expect(mocks.prompt.vezes, 'a compra passou a perguntar: a pergunta e so da venda').toBe(0);
		expect(enviados.length, 'a compra nao foi mandada').toBe(1);
	});
});
