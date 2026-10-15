/**
 * A VENDA NO NPC NAO VENDE POR ENGANO (16/10/2026 — terceiro relato do dono:
 * jogadores vendendo a mochila inteira no "Vender itens").
 *
 * O pedido: *"tao claro que uma crianca de 5 anos saiba o que esta fazendo e
 * nao consiga errar"*. O que este arquivo prende:
 *
 * 1. a "Lista inteira" nao existe mais (o `hidden` dela nunca valeu no
 *    navegador: `.ri-btn` declara `display:inline-flex`, que vence o [hidden]);
 * 2. o botao de massa diz o alcance e QUANTOS ("Marcar tudo desta aba (2
 *    itens)"), e o "Desmarcar tudo" aparece sempre que ha algo marcado;
 * 3. "Vender" ABRE um modal e nao manda NADA; Cancelar, ESC (pela janela e pela
 *    pilha) e o Enter nao mandam nada; so o botao vermelho manda, UMA vez;
 * 4. o modal avisa carta e equipamento e destaca a linha arriscada;
 * 5. o rodape diz a frase exata ("Vender 8 itens (2 tipos) por 350 z");
 * 6. a municao vestida nao entra na lista.
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
	},
	// Valores reais de DB/Items/ItemType.js: WEAPON=5, ETC=3, CARD=6, AMMO=10.
	tipos: { 501: 5, 502: 3, 503: 6, 504: 10 },
	prompt: { vezes: 0 }
}));

vi.mock('Network/NetworkManager.js', () => ({ default: { sendPacket: () => {}, hookPacket: () => {} } }));
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
		// A pergunta generica de antes: o Enter a confirmava. Ela nao pode mais
		// ser o caminho da venda.
		showPromptBox: () => {
			mocks.prompt.vezes += 1;
		}
	}
}));
vi.mock('UI/Components/ItemInfo/ItemInfo.js', () => ({ default: { append: () => {}, set: () => {} } }));
vi.mock('UI/Components/InputBox/InputBox.js', () => ({ default: { append: () => {}, remove: () => {}, cb: null } }));
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
const balao = await import('UI/balaoDaHud.js');

// A arma vem REFINADA (+7) e com uma carta: e a "katar" do relato de 18/09.
const ARMA = { index: 1, ITID: 501, IsIdentified: 1, count: 3, PlaceETCTab: 0, RefiningLevel: 7, slot: { card1: 4001 } };
const ETC = { index: 2, ITID: 502, IsIdentified: 1, count: 5, PlaceETCTab: 0 };
const CARTA = { index: 3, ITID: 503, IsIdentified: 1, count: 1, PlaceETCTab: 0 };
const FLECHA_VESTIDA = { index: 4, ITID: 504, IsIdentified: 1, count: 500, PlaceETCTab: 0, WearState: 32768 };

let enviados;
let removidas;

const $ = sel => NpcStore.getRoot().querySelector(sel);
const qtd = index => Number($(`[data-index="${index}"] .ns-qtd-in`).value);
const modal = () => $('.ns-conf');

function irParaAba(categoria) {
	$('.ns-abas').innerHTML = `<button class="ns-aba" data-categoria="${categoria}"></button>`;
	$('.ns-aba').dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function tecla(alvo, key, which) {
	const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
	Object.defineProperty(ev, 'which', { value: which });
	alvo.dispatchEvent(ev);
	return ev;
}

async function abrirVenda(itens) {
	document.body.replaceChildren();
	NpcStore._host = document.createElement('div');
	NpcStore._host.innerHTML = htmlDoComponente;
	document.body.appendChild(NpcStore._host);
	NpcStore._shadow = NpcStore._host;
	NpcStore._container = NpcStore._host;
	NpcStore.init();

	mocks.prompt.vezes = 0;
	enviados = [];
	removidas = 0;
	NpcStore.onSubmit = escolha => enviados.push(escolha.map(o => ({ index: o.index, count: o.count })));
	NpcStore.remove = () => {
		removidas += 1;
	};

	mocks.inventoryUI.itens = new Map(itens.map(it => [it.index, { ...it }]));
	NpcStore.setType(NpcStore.Type.SELL);
	NpcStore.setList(itens.map(it => ({ index: it.index, price: it.ITID === 503 ? 20000 : it.ITID === 501 ? 100 : 10 })));
	await Promise.resolve();
	// Aba e busca sao estado de MODULO (so o `onRemove` as zera): um caso que
	// termina filtrado deixaria o seguinte comecando filtrado.
	const busca = $('.ns-busca');
	busca.value = '';
	busca.dispatchEvent(new Event('input', { bubbles: true }));
	irParaAba('tudo');
}

describe('a venda no NPC: marcar em massa e claro, e vender pede confirmacao', () => {
	beforeEach(async () => {
		balao._zerarBaloesDaHud();
		await abrirVenda([ARMA, ETC]);
	});

	it('a "Lista inteira" nao existe mais na janela (o hidden dela nunca valeu no navegador)', () => {
		expect($('.ns-tudo-lista')).toBeNull();
		irParaAba('armas');
		expect($('.ns-tudo-lista')).toBeNull();
	});

	it('o botao de massa diz o alcance e quantos, e o "Desmarcar tudo" so aparece com algo marcado', () => {
		expect($('.ns-tudo').textContent).toBe('Marcar tudo desta aba (2 itens)');
		expect($('.ns-desmarcar').hidden).toBe(true);

		irParaAba('armas');
		expect($('.ns-tudo').textContent).toBe('Marcar tudo desta aba (1 item)');
		$('.ns-tudo').click();
		expect($('.ns-tudo').textContent).toBe('Desmarcar esta aba');
		expect($('.ns-desmarcar').hidden, 'com algo marcado, o desfazer tem de estar a vista').toBe(false);

		irParaAba('tudo');
		expect(qtd(ARMA.index)).toBe(3);
		expect(qtd(ETC.index), 'o botao de massa encheu fora da aba').toBe(0);

		// O "Desmarcar tudo" alcanca TODAS as abas, e nao so a que esta a vista:
		// marca o Etc aqui, volta para Armas e desmarca de la.
		$(`[data-index="${ETC.index}"] .ns-mais`).click();
		irParaAba('armas');
		$('.ns-desmarcar').click();
		expect($('.ns-desmarcar').hidden).toBe(true);
		irParaAba('tudo');
		expect(qtd(ARMA.index)).toBe(0);
		expect(qtd(ETC.index), 'o "Desmarcar tudo" deixou marcado o que estava noutra aba').toBe(0);
	});

	it('com busca, o rotulo diz "da busca"', () => {
		const busca = $('.ns-busca');
		busca.value = '502';
		busca.dispatchEvent(new Event('input', { bubbles: true }));
		expect($('.ns-tudo').textContent).toBe('Marcar tudo da busca (1 item)');
	});

	it('a linha marcada diz "Vender N", e o maximo diz quanto e ("Tudo (3)")', () => {
		const linha = $(`[data-index="${ARMA.index}"]`);
		expect(linha.querySelector('.ns-max').textContent).toBe('Tudo (3)');
		expect(linha.querySelector('.ns-selo').hidden).toBe(true);
		linha.querySelector('.ns-max').click();
		expect(linha.classList.contains('esta-no-carrinho')).toBe(true);
		expect(linha.querySelector('.ns-selo').hidden).toBe(false);
		expect(linha.querySelector('.ns-selo').textContent).toBe('Vender 3');
	});

	it('o rodape diz exatamente o que vai acontecer', () => {
		expect($('.ns-itens-escolhidos').textContent).toBe('Nada selecionado');
		$('.ns-tudo').click();
		expect($('.ns-itens-escolhidos').textContent).toBe('Vender 8 itens (2 tipos) por 350 z');
	});

	it('"Vender" abre o modal e NAO manda nada (nem pelo prompt generico)', () => {
		$('.ns-tudo').click();
		$('.ns-agir').click();

		expect(enviados.length, 'a venda saiu sem a confirmacao').toBe(0);
		expect(mocks.prompt.vezes, 'a venda voltou ao prompt do Enter').toBe(0);
		expect(modal().hidden).toBe(false);
		expect($('.ns-conf-lista').children.length).toBe(2);
		expect($('.ns-conf-total-valor').textContent).toBe('350 z');
		expect($('.ns-conf-vender').textContent).toBe('Vender 8 itens por 350 z');

		// O segundo "Vender" com o modal aberto nao manda nada nem abre outro.
		$('.ns-agir').click();
		expect(enviados.length).toBe(0);
	});

	it('Cancelar nao manda nada e devolve a escolha intacta', () => {
		$('.ns-tudo').click();
		$('.ns-agir').click();
		$('.ns-conf-cancelar').click();

		expect(enviados.length).toBe(0);
		expect(modal().hidden).toBe(true);
		expect(qtd(ARMA.index), 'cancelar apagou o que o jogador marcou').toBe(3);
	});

	it('tocar no fundo escurecido tambem cancela', () => {
		$('.ns-tudo').click();
		$('.ns-agir').click();
		modal().dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(enviados.length).toBe(0);
		expect(modal().hidden).toBe(true);
	});

	it('ESC fecha o MODAL, e nao a loja, e nao vende', () => {
		$('.ns-tudo').click();
		$('.ns-agir').click();
		NpcStore.onKeyDown({ which: 27, key: 'Escape' });
		expect(modal().hidden).toBe(true);
		expect(removidas, 'o ESC fechou a loja inteira').toBe(0);
		expect(enviados.length).toBe(0);

		// Pela tecla dentro do modal tambem.
		$('.ns-agir').click();
		tecla($('.ns-conf-cancelar'), 'Escape', 27);
		expect(modal().hidden).toBe(true);
		expect(enviados.length).toBe(0);
	});

	it('o ESC e o voltar do Android (a pilha, pela lista de baloes) fecham o modal primeiro', () => {
		$('.ns-tudo').click();
		$('.ns-agir').click();
		expect(balao.temBalaoAberto()).toBe(true);
		expect(balao.fecharBalaoDaHud()).toBe(true);
		expect(modal().hidden).toBe(true);
		expect(enviados.length).toBe(0);
		expect(removidas).toBe(0);
	});

	it('o foco nasce no "Cancelar", e o Enter nao confirma (nem no botao vermelho)', () => {
		$('.ns-tudo').click();
		$('.ns-agir').click();
		expect(document.activeElement).toBe($('.ns-conf-cancelar'));

		const ev = tecla($('.ns-conf-cancelar'), 'Enter', 13);
		expect(ev.defaultPrevented, 'o Enter seguiu para o botao').toBe(true);
		const ev2 = tecla($('.ns-conf-vender'), 'Enter', 13);
		expect(ev2.defaultPrevented).toBe(true);
		expect(enviados.length).toBe(0);
		expect(modal().hidden).toBe(false);
	});

	it('o botao vermelho manda EXATAMENTE a escolha, uma vez so (duplo clique seguro)', () => {
		irParaAba('armas');
		$('.ns-tudo').click();
		irParaAba('tudo');
		$(`[data-index="${ETC.index}"] .ns-mais`).click();
		$(`[data-index="${ETC.index}"] .ns-mais`).click();

		$('.ns-agir').click();
		const vender = $('.ns-conf-vender');
		vender.click();
		vender.click();

		expect(enviados.length, 'o duplo clique vendeu duas vezes').toBe(1);
		expect(enviados[0]).toEqual([
			{ index: ARMA.index, count: 3 },
			{ index: ETC.index, count: 2 }
		]);
		expect(modal().hidden).toBe(true);
		expect(qtd(ARMA.index), 'depois de vender, a escolha volta a zero').toBe(0);
		expect($('.ns-itens-escolhidos').textContent).toBe('Nada selecionado');
	});

	it('o modal vende o que MOSTROU: mexer na lista por baixo dele nao muda a venda', () => {
		$(`[data-index="${ETC.index}"] .ns-mais`).click();
		$('.ns-agir').click();
		expect($('.ns-conf-vender').textContent).toBe('Vender 1 item por 10 z');

		// Um toque que atravesse o fundo (ou o motor refazendo a linha) muda a
		// escolha viva; a confirmacao continua sendo a do que estava na tela.
		$(`[data-index="${ETC.index}"] .ns-max`).click();
		$('.ns-conf-vender').click();
		expect(enviados).toEqual([[{ index: ETC.index, count: 1 }]]);
	});

	it('fechar a loja com o modal aberto nao vende', () => {
		$('.ns-tudo').click();
		$('.ns-agir').click();
		NpcStore.onRemove();
		expect(modal().hidden).toBe(true);
		expect(enviados.length).toBe(0);
		expect(balao.temBalaoAberto()).toBe(false);
	});
});

describe('o modal avisa o que costuma ser vendido por engano', () => {
	beforeEach(async () => {
		balao._zerarBaloesDaHud();
		await abrirVenda([ARMA, ETC, CARTA, FLECHA_VESTIDA]);
	});

	it('a municao VESTIDA nao entra na lista de venda', () => {
		expect($(`[data-index="${FLECHA_VESTIDA.index}"]`)).toBeNull();
		expect($('.ns-tudo').textContent).toBe('Marcar tudo desta aba (3 itens)');
	});

	it('carta e equipamento refinado com carta: aviso no topo e linha destacada primeiro', () => {
		$('.ns-tudo').click();
		$('.ns-agir').click();

		const avisos = [...$('.ns-conf-avisos').children].map(el => el.textContent);
		expect(avisos).toEqual(['Atenção: inclui 1 carta.', 'Atenção: inclui 3 equipamentos.']);

		const linhas = [...$('.ns-conf-lista').children];
		expect(linhas.length).toBe(3);
		// A carta (20.000z) e a arma +7 com carta vem antes do Etc comum.
		expect(linhas[0].classList.contains('esta-em-destaque')).toBe(true);
		expect(linhas[1].classList.contains('esta-em-destaque')).toBe(true);
		expect(linhas[2].classList.contains('esta-em-destaque')).toBe(false);
		const etiquetas = linhas.map(l => [...l.querySelectorAll('.ns-conf-etiqueta')].map(e => e.textContent));
		expect(etiquetas).toContainEqual(['Carta', 'Caro']);
		expect(etiquetas).toContainEqual(['Refinado +7', 'Com carta']);
	});

	it('sem nada arriscado, nao ha aviso', () => {
		$(`[data-index="${ETC.index}"] .ns-max`).click();
		$('.ns-agir').click();
		expect($('.ns-conf-avisos').hidden).toBe(true);
		expect($('.ns-conf-vender').textContent).toBe('Vender 5 itens por 50 z');
	});
});

describe('em ingles: toda frase nova da venda tem traducao no catalogo publicado', () => {
	it('o rodape, o botao de massa, o modal e as etiquetas saem em ingles', async () => {
		const fs = await import('node:fs');
		const { absorverCatalogo, desligarTraducao, traduzir } = await import('Core/Traducao.js');
		const { resolve } = await import('node:path');
		absorverCatalogo(JSON.parse(fs.readFileSync(resolve('public/ragidle/i18n/en/catalogo.json'), 'utf-8')));
		try {
			const casos = {
				'Nada selecionado': 'Nothing selected',
				'Vender 12 itens (3 tipos) por 45.000 z': 'Sell 12 items (3 types) for 45,000 z',
				'Vender 5 itens (1 tipo) por 50 z': 'Sell 5 items (1 type) for 50 z',
				'Vender 1 item (1 tipo) por 10 z': 'Sell 1 item (1 type) for 10 z',
				'Marcar tudo desta aba (92 itens)': 'Select all in this tab (92 items)',
				'Marcar tudo desta aba (1 item)': 'Select all in this tab (1 item)',
				'Marcar tudo da busca (4 itens)': 'Select all search results (4 items)',
				'Desmarcar tudo': 'Clear selection',
				'Desmarcar esta aba': 'Clear this tab',
				'Confirmar venda': 'Confirm sale',
				'Cancelar': 'Cancel',
				'Vender 8 itens por 350 z': 'Sell 8 items for 350 z',
				'Vender 1 item por 10 z': 'Sell 1 item for 10 z',
				'Atenção: inclui 2 cartas.': 'Warning: includes 2 cards.',
				'Atenção: inclui 1 equipamento.': 'Warning: includes 1 piece of equipment.',
				'Refinado +7': 'Refined +7',
				'Com carta': 'Carded',
				'Tudo (37)': 'All (37)',
				'Vender todas as 37 unidades': 'Sell all 37 units',
				'Vender 3': 'Sell 3',
				'Isto não tem desfazer.': "This can't be undone."
			};
			for (const [pt, en] of Object.entries(casos)) {
				expect(traduzir(pt), pt).toBe(en);
			}
		} finally {
			desligarTraducao();
		}
	});
});
