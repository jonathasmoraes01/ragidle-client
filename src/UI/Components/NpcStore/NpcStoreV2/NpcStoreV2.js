/**
 * UI/Components/NpcStore/NpcStoreV2/NpcStoreV2.js
 *
 * A loja de NPC moderna (01/09/2026, pedido do dono: "mais moderno e atual,
 * mais facil de comprar, para QUALQUER janela de comercio de NPC, inspirado
 * no Ragnarok Origin").
 *
 * O que mudou em relacao a V1 (a classica de duas janelas):
 *
 * - UMA janela. O carrinho deixou de ser uma segunda janela para onde se
 *   ARRASTA item: a quantidade mora na propria linha, num degrau [- qtd +]
 *   com "Max". Arrastar era o passo que mais custava — no Origin (e em todo
 *   comercio moderno) escolher quantidade e apertar um botao e o fluxo
 *   inteiro. A organizacao vem do gabarito (lista + total vivo + UMA acao
 *   primaria); a forma e 100% do nosso design system.
 * - Busca por nome no topo — lojas do rAthena passam de 40 itens.
 * - Total SEMPRE visivel no rodape, com o zeny do jogador na faixa de cima:
 *   quando o total passa do que da pra pagar, os dois numeros avisam em
 *   vermelho e o botao trava. Antes o jogador descobria no "nao tem zeny"
 *   do servidor.
 * - Desconto legivel: preco velho riscado, preco novo em verde (verde =
 *   ganho do jogador, a mesma semantica da EXP no DS) — no lugar do
 *   "1.000 -> 800" em texto corrido.
 *
 * ## A rodada de 02/09/2026 (D-920/D-921) — as tres coisas que o dono pediu
 *
 * 1. **A lista e dividida por CATEGORIA**, e nao mais um rolo unico: abas por
 *    familia de item (so as que tem item — ver `vitrine.js`) e, na aba
 *    "Tudo", cada familia com seu titulo. A regra de agrupamento mora fora
 *    deste arquivo, testada sem DOM.
 * 2. **Ordem escolhida pelo jogador** — raridade, quantidade, preco ou nome.
 *    O pedido era para a hora de VENDER ("saber o que nao vender por engano"),
 *    e vale nas duas pontas. A ordem escolhida sobrevive ao fechar da janela
 *    dentro da mesma sessao; a busca e a aba nao (elas sao do momento).
 * 3. **O peso da compra no rodape**, com a mesma trava do servidor: quando
 *    `peso atual + peso da compra` passa do teto, o botao para. Antes o
 *    jogador so descobria no FAIL_WEIGHT, com a janela ja fechada.
 *
 * A RARIDADE e a peca que nao existia: o rAthena nao tem esse campo. Ela e
 * derivada da CHANCE DE DROP (o dono escolheu, entre chance, preco e a
 * raridade das runas) e chega pronta em `/ragidle/fichas-de-item.json` —
 * `DB/Items/fichasDeItem.js` de um lado, `scripts/publicar-fichas-de-item.ts`
 * no repositorio do jogo do outro. O PESO vem pelo mesmo caminho, e pelo
 * mesmo motivo: o cliente nunca soube quanto pesa um item.
 *
 * O CONTRATO com o motor (Engine/MapEngine/Store.js) e o mesmo da V1, metodo
 * a metodo — incluindo os ganchos de DOM que ele cutuca por seletor
 * (.seller, .cashuser .buyer, .cashuser .cashpoints, .priceLimit) — entao os
 * OITO tipos passam pela mesma janela: BUY, SELL, VENDING_STORE,
 * BUYING_STORE, MARKETSHOP, BARTER_MARKET(_EXTENDED) e CASH_SHOP.
 *
 * Acessibilidade (diretrizes ui-ux-pro-max aplicadas): degrau com alvos de
 * 24px, input com inputmode numerico e aria-label por item, estado nunca
 * troca em 0ms (transicoes nos tokens), rotulo visivel em toda acao.
 *
 * @author RagIdle
 */

import DB from 'DB/DBManager.js';
import Client from 'Core/Client.js';
import Session from 'Engine/SessionStorage.js';
import Network from 'Network/NetworkManager.js';
import PACKETVER from 'Network/PacketVerManager.js';
import PACKET from 'Network/PacketStructure.js';
import KEYS from 'Controls/KeyEventHandler.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import ItemInfo from 'UI/Components/ItemInfo/ItemInfo.js';
import InputBox from 'UI/Components/InputBox/InputBox.js';
import Inventory from 'UI/Components/Inventory/Inventory.js';
import { RARIDADE_LABEL } from 'Utils/ItemOptionsView.js';
import {
	CLASSE_DE_RARIDADE,
	carregarFichasDeItem,
	pesoDeItem,
	raridadeDeItem,
	tipoDeItem
} from 'DB/Items/fichasDeItem.js';
import {
	CATEGORIA_TUDO,
	ORDEM_PADRAO,
	abasDaVitrine,
	categoriaDoTipo,
	indicesDaVista,
	montarVista,
	ordensDaVitrine,
	tipoEfetivo
} from './vitrine.js';
import htmlText from './NpcStoreV2.html?raw';
import cssText from './NpcStoreV2.css?raw';

const NpcStore = new GUIComponent('NpcStoreV2', cssText);

NpcStore.render = () => htmlText;

/**
 * Mesmo enum da V1 — o motor compara contra ele.
 */
NpcStore.Type = {
	BUY: 0,
	SELL: 1,
	VENDING_STORE: 2,
	BUYING_STORE: 3,
	MARKETSHOP: 4,
	BARTER_MARKET: 5,
	BARTER_MARKET_EXTENDED: 6,
	CASH_SHOP: 7
};

NpcStore.mouseMode = GUIComponent.MouseMode.FREEZE;

/* Janela de comercio entra/sai com a animacao unica (append/remove de
   GUIComponent le esta bandeira). */
NpcStore.riAnimaJanela = true;

/**
 * @let {Array} catalogo (indexado por item.index, como na V1)
 */
const _input = [];

/**
 * @let {Array} quantidades escolhidas (mesmo indice)
 */
const _output = [];

/**
 * @let {Map<number, HTMLElement>} a linha de cada indice. Ela e CRIADA uma vez
 * por vitrine e depois so MUDA DE LUGAR (`appendChild` move o no, nao o
 * recria): reordenar sem destruir e o que preserva o valor digitado no campo
 * de quantidade e o foco de quem esta usando o teclado.
 */
const _nos = new Map();

/**
 * @let {Array} a vitrine em forma de dado puro — o que `vitrine.js` consome.
 */
let _vitrine = [];

/**
 * @let {Array<number>} os indices que a vista MOSTRA agora, na ordem da tela.
 * E o alcance do "Tudo no maximo" — ver `indicesDaVista` em `vitrine.js`.
 */
let _visiveis = [];

let _type;
let _closePacketSent = false;

/** A vista atual: busca e aba sao do momento; a ordem sobrevive (ver o topo). */
let _termo = '';
let _categoria = CATEGORIA_TUDO;
let _ordem = ORDEM_PADRAO;

/**
 * Cada `setList` abre uma geracao. A carga das fichas de item e assincrona e
 * pode voltar DEPOIS de a loja ter fechado (ou de outra ter aberto): sem este
 * carimbo, a resposta atrasada redesenharia a lista de uma vitrine que nao
 * existe mais.
 */
let _geracao = 0;

/** Rotulo do titulo e do botao por tipo. Voz do DS: verbo no botao. */
const TEXTOS = {
	[NpcStore.Type.BUY]: { titulo: 'Loja', botao: 'Comprar', escolha: 'compra' },
	[NpcStore.Type.SELL]: { titulo: 'Vender itens', botao: 'Vender', escolha: 'venda' },
	[NpcStore.Type.VENDING_STORE]: { titulo: 'Loja de jogador', botao: 'Comprar', escolha: 'compra' },
	[NpcStore.Type.BUYING_STORE]: { titulo: 'Itens procurados', botao: 'Vender', escolha: 'venda' },
	[NpcStore.Type.MARKETSHOP]: { titulo: 'Mercado', botao: 'Comprar', escolha: 'compra' },
	[NpcStore.Type.BARTER_MARKET]: { titulo: 'Escambo', botao: 'Trocar', escolha: 'troca' },
	[NpcStore.Type.BARTER_MARKET_EXTENDED]: { titulo: 'Escambo', botao: 'Trocar', escolha: 'troca' },
	[NpcStore.Type.CASH_SHOP]: { titulo: 'Loja de pontos', botao: 'Comprar', escolha: 'compra' }
};

const eDeVenda = () => _type === NpcStore.Type.SELL || _type === NpcStore.Type.BUYING_STORE;
const eEscambo = () => _type === NpcStore.Type.BARTER_MARKET || _type === NpcStore.Type.BARTER_MARKET_EXTENDED;

/** "1.234.567" — separador PT-BR, mesmo formato do resto do jogo. */
function prettyZeny(val) {
	return (Number(val) || 0).toLocaleString('pt-BR');
}

/**
 * Peso em decigramas -> o numero que o jogo mostra. O `Weight` do item_db e o
 * `Session.Entity.weight` do pacote andam em DECIMOS de unidade, e a divisao
 * por 10 e a mesma de BasicInfoIdle/MochilaIdle — nao arredondar aqui faria a
 * Red Potion pesar "70" numa tela e "7" na outra.
 */
function prettyPeso(decigramas) {
	return (Number(decigramas) / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}

function precoUnitario(item) {
	return item.discountprice ?? item.overchargeprice ?? item.price ?? 0;
}

/**
 * O peso de UMA unidade do item.
 *
 * O pacote de escambo ja traz `weight` do servidor (PacketStructure.js) — ele
 * VENCE a tabela publicada, porque e o numero da sessao e nao o do build.
 *
 * @returns {number|null} null quando ninguem sabe (e ai a tela nao inventa)
 */
function pesoUnitario(item) {
	if (typeof item.weight === 'number') {
		return item.weight;
	}
	return pesoDeItem(item.ITID);
}

/**
 * Limite de preco do BUYING_STORE (quanto zeny o comprador ainda tem).
 * -1 = sem limite conhecido.
 */
let _limiteZeny = -1;

/* ─── Ciclo de vida ──────────────────────────────────────────────────────── */

NpcStore.init = function init() {
	const root = NpcStore.getRoot();

	this.draggable('.ns-header');

	root.querySelector('.ns-fechar').addEventListener('click', () => this.remove());
	root.querySelector('.ns-agir').addEventListener('click', () => this.submit());

	root.querySelector('.ns-busca').addEventListener('input', e => {
		_termo = e.target.value;
		desenharVista();
	});

	root.querySelector('.ns-ordem').addEventListener('change', e => {
		_ordem = e.target.value;
		desenharVista();
	});

	root.querySelector('.ns-abas').addEventListener('click', e => {
		const aba = e.target.closest('.ns-aba');
		if (!aba) {
			return;
		}
		_categoria = aba.dataset.categoria;
		desenharVista();
	});

	root.querySelector('.ns-tudo').addEventListener('click', () => encherOuLimparAVista());

	/* Delegacao: as linhas nascem e morrem com setList, os ouvintes ficam na
	   lista — um por evento, nao um por item. */
	const lista = root.querySelector('.ns-lista');
	lista.addEventListener('click', onCliqueNaLista);
	lista.addEventListener('change', onQuantidadeDigitada);
};

NpcStore.onAppend = function onAppend() {
	_closePacketSent = false;
};

NpcStore.onRemove = function onRemove() {
	_input.length = 0;
	_output.length = 0;
	_nos.clear();
	_vitrine = [];
	_visiveis = [];
	_limiteZeny = -1;
	_geracao++;

	// A busca e a aba sao do momento e voltam ao zero; a ORDEM nao — quem
	// vende pela raridade vende varias lojas seguidas, e reescolher a cada
	// abertura seria o atrito que o pedido queria tirar.
	_termo = '';
	_categoria = CATEGORIA_TUDO;

	const root = NpcStore.getRoot();
	root.querySelector('.ns-lista').replaceChildren();
	root.querySelector('.ns-busca').value = '';

	if (!_closePacketSent) {
		NpcStore.StoreClosePacket(_type);
	}
};

NpcStore.onKeyDown = function onKeyDown(event) {
	if (event.which === KEYS.ESCAPE || event.key === 'Escape') {
		this.remove();
	}
};

/* ─── O contrato com o motor ─────────────────────────────────────────────── */

NpcStore.setType = function setType(type) {
	_type = type;
	const root = NpcStore.getRoot();
	const textos = TEXTOS[type] || TEXTOS[NpcStore.Type.BUY];

	root.querySelector('.ns-title').textContent = textos.titulo;
	root.querySelector('.ns-agir').textContent = textos.botao;

	// Faixa de contexto: cada tipo mostra so o que lhe pertence.
	root.querySelector('.ns-vendedor').hidden = !(
		type === NpcStore.Type.VENDING_STORE || type === NpcStore.Type.BUYING_STORE
	);
	root.querySelector('.cashuser').hidden = type !== NpcStore.Type.CASH_SHOP;
	root.querySelector('.priceLimit').hidden = type !== NpcStore.Type.BUYING_STORE;

	// A bolsa do jogador: zeny em compra normal; nada em escambo/cash (la a
	// moeda e outra e o proprio motor escreve os pontos em .cashpoints).
	const bolsa = root.querySelector('.ns-bolsa');
	const mostraBolsa = !eEscambo() && type !== NpcStore.Type.CASH_SHOP;
	bolsa.hidden = !mostraBolsa;
	if (mostraBolsa) {
		root.querySelector('.ns-bolsa-valor').textContent = prettyZeny(Session.zeny);
		root.querySelector('.ns-bolsa-unidade').textContent = 'Zeny';
	}

	// Total: escondido no escambo (o custo e por item, em itens).
	root.querySelector('.ns-total').hidden = eEscambo();
	root.querySelector('.ns-unidade').textContent = type === NpcStore.Type.CASH_SHOP ? 'Pontos' : 'Zeny';

	atualizarResumo();
};

/**
 * Monta o catalogo. O formato dos itens e o MESMO que a V1 recebia — a
 * normalizacao (index, count=Infinity, IsIdentified) tambem.
 */
NpcStore.setList = function setList(items) {
	const root = NpcStore.getRoot();
	root.querySelector('.ns-lista').replaceChildren();
	_input.length = 0;
	_output.length = 0;
	_nos.clear();
	_vitrine = [];
	_visiveis = [];

	const geracao = ++_geracao;

	const registrar = item => {
		const escolhido = Object.assign({}, item);
		escolhido.count = 0;
		_input[item.index] = item;
		_output[item.index] = escolhido;
		_nos.set(item.index, montarLinha(item));
		_vitrine.push(fichaDaVitrine(item, _vitrine.length));
	};

	switch (_type) {
		case NpcStore.Type.BUY:
		case NpcStore.Type.VENDING_STORE:
		case NpcStore.Type.MARKETSHOP:
		case NpcStore.Type.CASH_SHOP:
		case NpcStore.Type.BARTER_MARKET:
		case NpcStore.Type.BARTER_MARKET_EXTENDED:
			for (let i = 0; i < items.length; ++i) {
				if (!('index' in items[i])) {
					items[i].index = i;
				}
				items[i].count = items[i].count || Infinity;
				items[i].IsIdentified = true;
				registrar(items[i]);
			}
			break;

		case NpcStore.Type.SELL: {
			// A lista de venda nasce do INVENTARIO (preco vem do servidor).
			const InventoryVersion = UIManager.getComponent('Inventory').name;
			for (let i = 0; i < items.length; ++i) {
				const it = Inventory.getUI().getItemByIndex(items[i].index);
				const condition =
					InventoryVersion !== 'InventoryV0'
						? it && (!Inventory.getUI().npcsalelock || it.PlaceETCTab < 1)
						: it;
				if (condition) {
					const item = Object.assign({}, it);
					item.price = items[i].price;
					item.overchargeprice = items[i].overchargeprice;
					item.count = 'count' in item ? item.count : 1;
					registrar(item);
				}
			}
			break;
		}

		case NpcStore.Type.BUYING_STORE:
			// Vender para a loja de compra de outro jogador: so aparece o que
			// VOCE tem e ELE quer; o teto e o menor dos dois lados.
			for (let i = 0; i < items.length; ++i) {
				if (!('index' in items[i])) {
					items[i].index = i;
				}
				items[i].count = items[i].count || Infinity;
				const meu = Inventory.getUI().getItemById(items[i].ITID);
				if (meu) {
					const item = Object.assign({}, meu);
					item.price = items[i].price;
					item.count = 'count' in item ? item.count : 1;
					item.maxCount = isFinite(items[i].count) ? items[i].count : 0;
					registrar(item);
				}
			}
			break;
	}

	montarControles();
	desenharVista();
	atualizarResumo();

	/*
	 * Peso e raridade chegam de um arquivo publicado, e a PRIMEIRA loja da
	 * sessao costuma abrir antes dele. Quando ele chega, a vitrine e refeita
	 * — mas so se ainda for ESTA (ver `_geracao`).
	 */
	carregarFichasDeItem().then(temFichas => {
		if (!temFichas || geracao !== _geracao) {
			return;
		}
		for (const [index, no] of _nos) {
			enfeitarLinha(no, _input[index]);
		}
		_vitrine = _vitrine.map((ficha, i) => fichaDaVitrine(_input[ficha.index], i));
		montarControles();
		desenharVista();
		atualizarResumo();
	});
};

NpcStore.setPriceLimit = function setPriceLimit(price) {
	_limiteZeny = price;
	const root = NpcStore.getRoot();
	const el = root.querySelector('.priceLimit');
	el.textContent = DB.getMessage(1735).replace('%s', prettyZeny(price));
};

/**
 * Envia a escolha. Mesmo formato de saida da V1: os itens de _output com
 * count > 0 — o motor monta o pacote em cima disso.
 */
NpcStore.submit = function submit() {
	const escolha = [];
	for (let i = 0; i < _output.length; ++i) {
		if (_output[i] && _output[i].count) {
			escolha.push(_output[i]);
		}
	}
	if (!escolha.length) {
		return;
	}

	NpcStore.onSubmit(escolha);

	for (let i = 0; i < _output.length; ++i) {
		if (_output[i]) {
			_output[i].count = 0;
		}
	}
	const root = NpcStore.getRoot();
	root.querySelectorAll('.ns-qtd-in').forEach(el => {
		el.value = '0';
	});
	root.querySelectorAll('.ns-item.esta-no-carrinho').forEach(el => el.classList.remove('esta-no-carrinho'));
	atualizarResumo();
};

NpcStore.calculateCost = function calculateCost() {
	let total = 0;
	for (let i = 0; i < _output.length; ++i) {
		if (_output[i]) {
			total += precoUnitario(_output[i]) * _output[i].count;
		}
	}
	return total;
};

/**
 * O peso do que esta escolhido, em decigramas.
 *
 * Mesma assinatura da V1 (o motor e a propria janela chamam), mas devolvendo
 * o peso de TODO tipo de loja, e nao so do escambo: a V1 so somava
 * `item.total_weight`, um campo que unicamente o caminho de barter escrevia.
 *
 * @returns {number|null} null se algum item escolhido nao tem peso conhecido —
 *          um total parcial seria pior que nenhum, porque a trava de peso
 *          desta janela decide em cima dele.
 */
NpcStore.calculateWeight = function calculateWeight() {
	let peso = 0;
	for (let i = 0; i < _output.length; ++i) {
		const o = _output[i];
		if (o && o.count > 0) {
			const unitario = pesoUnitario(o);
			if (unitario === null) {
				return null;
			}
			peso += unitario * o.count;
		}
	}
	return peso;
};

NpcStore.closeStore = function () {
	NpcStore.remove();
};

/** Identico a V1 — e protocolo, nao visual. */
NpcStore.StoreClosePacket = function (type) {
	InputBox.remove();

	let pkt;

	if (PACKETVER.value < 20131223) {
		pkt = type === NpcStore.Type.SELL ? new PACKET.CZ.PC_SELL_ITEMLIST() : new PACKET.CZ.PC_PURCHASE_ITEMLIST();
	} else {
		switch (type) {
			case NpcStore.Type.MARKETSHOP:
				pkt = new PACKET.CZ.NPC_MARKET_CLOSE();
				break;
			case NpcStore.Type.BARTER_MARKET:
				pkt = new PACKET.CZ.NPC_BARTER_MARKET_CLOSE();
				break;
			case NpcStore.Type.BARTER_MARKET_EXTENDED:
				pkt = new PACKET.CZ.NPC_EXPANDED_BARTER_MARKET_CLOSE();
				break;
			case NpcStore.Type.VENDING_STORE:
			case NpcStore.Type.BUYING_STORE:
				_closePacketSent = true;
				return;
			default:
				pkt = new PACKET.CZ.NPC_TRADE_QUIT();
				break;
		}
	}
	_closePacketSent = true;
	Network.sendPacket(pkt);
};

NpcStore.getCurrentType = function () {
	return _type;
};

/**
 * Resultado do Marketshop: em vez da 4a janela da V1, a PROPRIA lista vira o
 * recibo — cada linha comprada mostra a quantidade que veio no pacote e o
 * degrau some ate a proxima compra (o servidor ja atualizou o estoque).
 */
NpcStore.onMarketShopResultUI = function (itemList) {
	if (!itemList || !itemList.length) {
		return;
	}
	const total = itemList.reduce((soma, c) => soma + (c.price || 0) * (c.amount || 0), 0);
	const nomes = itemList
		.map(c => {
			const info = DB.getItemInfo(c.ITID);
			return `${c.amount}× ${info ? info.identifiedDisplayName : c.ITID}`;
		})
		.join(', ');
	const root = NpcStore.getRoot();
	root.querySelector('.ns-itens-escolhidos').textContent = `Comprado: ${nomes} — ${prettyZeny(total)} Zeny`;
};

NpcStore.onSubmit = function onSubmit(/* itemList */) {};

NpcStore.setClosePacketSent = function (bool) {
	_closePacketSent = bool;
};

/* ─── A linha da lista ───────────────────────────────────────────────────── */

function tetoDoItem(item) {
	// O teto de compra/venda de UMA linha: estoque da loja, ou o que voce tem
	// (venda), ou o que o comprador ainda quer (buying store).
	if (_type === NpcStore.Type.BUYING_STORE) {
		return Math.min(item.count || 0, item.maxCount || 0) || 0;
	}
	if (isFinite(item.count)) {
		return item.count;
	}
	return 9999; // loja infinita: o limite pratico do protocolo por clique
}

/**
 * O item em forma de DADO — o que `vitrine.js` filtra, agrupa e ordena. Nada
 * de DOM aqui: e a fronteira entre a regra (testavel) e o desenho.
 */
function fichaDaVitrine(item, ordem) {
	// `item.type` pode ser 0 (HEALING) — a queda para a tabela e por AUSENCIA,
	// nunca por `||`; o porque esta em `tipoEfetivo`.
	const tipo = tipoEfetivo(item.type, tipoDeItem(item.ITID));

	return {
		ordem,
		index: item.index,
		nome: DB.getItemName(item),
		preco: precoUnitario(item),
		quantidade: item.count,
		raridade: raridadeDeItem(item.ITID),
		categoria: categoriaDoTipo(tipo)
	};
}

function montarLinha(item) {
	const nome = DB.getItemName(item);
	const teto = tetoDoItem(item);
	const unitario = precoUnitario(item);
	const temDesconto = 'discountprice' in item && item.discountprice !== item.price;
	const temSobretaxa = 'overchargeprice' in item && item.overchargeprice !== item.price;

	const linha = document.createElement('div');
	linha.className = 'ns-item';
	linha.dataset.index = item.index;
	linha.setAttribute('role', 'listitem');
	if (temDesconto || temSobretaxa) {
		linha.classList.add('tem-desconto');
	}
	if (teto === 0) {
		linha.classList.add('esta-esgotado');
	}

	let precoHtml;
	if (eEscambo()) {
		precoHtml = `<div class="ns-preco-escambo">${custoDeEscambo(item)}</div>`;
	} else {
		precoHtml =
			(temDesconto || temSobretaxa ? `<span class="ns-preco-antigo">${prettyZeny(item.price)}</span>` : '') +
			`<span class="ns-preco-atual">${prettyZeny(unitario)} <span class="ns-moeda">${
				_type === NpcStore.Type.CASH_SHOP ? 'P' : 'z'
			}</span></span>`;
	}

	linha.innerHTML =
		`<span class="ns-tile ri-tile" title="Detalhes do item"><img class="ns-icone" alt="" draggable="false"></span>` +
		`<div class="ns-info">` +
		`<div class="ns-nome"></div>` +
		`<div class="ns-meta"></div>` +
		`</div>` +
		`<div class="ns-preco">${precoHtml}</div>` +
		`<div class="ns-qtd">` +
		`<button type="button" class="ns-menos" aria-label="Menos um" disabled>&minus;</button>` +
		`<input class="ns-qtd-in ri-input" type="text" inputmode="numeric" value="0" aria-label="Quantidade de ${nome.replace(/"/g, '&quot;')}">` +
		`<button type="button" class="ns-mais" aria-label="Mais um">+</button>` +
		`<button type="button" class="ns-max">Máx</button>` +
		`</div>`;

	// textContent para o nome: item de jogador (vending) e texto hostil.
	linha.querySelector('.ns-nome').textContent = nome;

	enfeitarLinha(linha, item);

	// Icone: /ragidle/item/<ITID>.png com reserva no bitmap do GRF — a mesma
	// receita da Mochila (setItemIcon de MochilaIdle.js).
	const info = DB.getItemInfo(item.ITID);
	const img = linha.querySelector('.ns-icone');
	const resName = item.IsIdentified !== false ? info.identifiedResourceName : info.unidentifiedResourceName;
	img.onerror = () => {
		img.onerror = null;
		Client.loadFile(DB.INTERFACE_PATH + 'item/' + resName + '.bmp', dataURI => {
			img.src = dataURI;
		});
	};
	img.src = `/ragidle/item/${item.ITID}.png`;

	return linha;
}

/**
 * O que depende das FICHAS PUBLICADAS (peso e raridade), separado do resto da
 * linha porque e refeito quando o arquivo chega — e porque a primeira loja da
 * sessao desenha antes dele.
 */
function enfeitarLinha(linha, item) {
	const raridade = raridadeDeItem(item.ITID);
	const peso = pesoUnitario(item);

	// A borda de raridade do ladrilho: a pele ja existia em Common.css (.ri-tile
	// .is-uncommon/.is-rare/.is-unique) e nunca tinha tido consumidor.
	const tile = linha.querySelector('.ns-tile');
	tile.className = `ns-tile ri-tile ${CLASSE_DE_RARIDADE[raridade] || ''}`.trim();

	// Meta: o que ajuda a decidir, nada alem.
	const meta = [];
	if (raridade > 0) {
		meta.push(`<span class="ns-raridade r${raridade}">${RARIDADE_LABEL[raridade]}</span>`);
	}
	if (peso !== null) {
		meta.push(`Peso ${prettyPeso(peso)}`);
	}
	if (_type === NpcStore.Type.SELL) {
		meta.push(`Você tem ${item.count}`);
	} else if (_type === NpcStore.Type.BUYING_STORE) {
		meta.push(`Você tem ${item.count} · quer ${item.maxCount}`);
	} else if (isFinite(item.count)) {
		meta.push(`Estoque ${item.count}`);
	}
	// Os pedacos sao TODOS montados aqui (rotulo de raridade e numero); nenhum
	// deles vem do servidor, entao o innerHTML nao abre porta nenhuma.
	linha.querySelector('.ns-meta').innerHTML = meta.join(' · ');
}

/** O custo de uma linha de escambo, em itens (com icone de cada moeda). */
function custoDeEscambo(item) {
	const moedas = [];
	if (_type === NpcStore.Type.BARTER_MARKET) {
		moedas.push({ ITID: item.currencyITID, amount: item.currencyamount });
	} else if (item.currencyList) {
		for (const c of item.currencyList) {
			moedas.push({ ITID: c.ITID, amount: c.amount });
		}
	}
	return moedas
		.map(m => {
			const info = DB.getItemInfo(m.ITID);
			const nomeMoeda = info ? info.identifiedDisplayName : m.ITID;
			return `<span title="${String(nomeMoeda).replace(/"/g, '&quot;')}">${m.amount}× <img src="/ragidle/item/${m.ITID}.png" alt="${String(nomeMoeda).replace(/"/g, '&quot;')}"></span>`;
		})
		.join(' + ');
}

/* ─── As abas de categoria e o seletor de ordem ──────────────────────────── */

/**
 * Reconstroi os dois controles que dependem do CONTEUDO da vitrine: as abas
 * (so as categorias presentes) e as ordens (so as que fazem diferenca aqui).
 */
function montarControles() {
	const root = NpcStore.getRoot();

	// Sem abas a barra fica VAZIA, e nao escondida: ela e o espacador que
	// mantem o "Tudo no máx" colado na direita (`flex: 1 1 auto`). Com
	// `hidden` o botao pularia para a esquerda numa vitrine de categoria unica.
	const abas = abasDaVitrine(_vitrine);
	const barra = root.querySelector('.ns-abas');
	barra.innerHTML = abas
		.map(
			aba =>
				`<button type="button" class="ns-aba ri-tab" role="tab" data-categoria="${aba.id}">` +
				`${aba.rotulo}<span class="ns-aba-conta">${aba.quantidade}</span></button>`
		)
		.join('');

	// A aba lembrada pode nao existir nesta loja (vender numa vitrine sem
	// cartas, por exemplo): cair no "Tudo" e melhor que uma lista vazia.
	if (!abas.some(aba => aba.id === _categoria)) {
		_categoria = CATEGORIA_TUDO;
	}

	const ordens = ordensDaVitrine(_vitrine, !eEscambo());
	const seletor = root.querySelector('.ns-ordem');
	seletor.innerHTML = ordens.map(o => `<option value="${o.id}">${o.rotulo}</option>`).join('');

	if (!ordens.some(o => o.id === _ordem)) {
		_ordem = ORDEM_PADRAO;
	}
	seletor.value = _ordem;
}

/**
 * Desenha a lista: filtra pela busca e pela aba, agrupa e ordena
 * (`vitrine.js`), e MOVE as linhas ja existentes para o lugar novo.
 */
function desenharVista() {
	const root = NpcStore.getRoot();
	const lista = root.querySelector('.ns-lista');
	const grupos = montarVista(_vitrine, { termo: _termo, categoria: _categoria, ordem: _ordem });
	_visiveis = indicesDaVista(grupos);

	// replaceChildren() DESLIGA as linhas sem destrui-las — quem as segura e o
	// `_nos`. Um innerHTML aqui perderia o valor digitado em cada campo de
	// quantidade a cada tecla da busca.
	lista.replaceChildren();

	// Titulo de grupo so quando ha mais de um: repetir "Cartas" em cima de uma
	// lista que so tem cartas nao informa nada.
	const comTitulo = grupos.length > 1;

	for (const grupo of grupos) {
		const secao = document.createElement('div');
		secao.className = 'ns-grupo';

		if (comTitulo) {
			const titulo = document.createElement('div');
			titulo.className = 'ns-grupo-titulo';
			titulo.textContent = grupo.rotulo;
			const conta = document.createElement('span');
			conta.className = 'ns-grupo-conta';
			conta.textContent = grupo.itens.length;
			titulo.appendChild(conta);
			secao.appendChild(titulo);
		}

		const itens = document.createElement('div');
		itens.className = 'ns-grupo-itens';
		itens.setAttribute('role', 'list');
		for (const ficha of grupo.itens) {
			const no = _nos.get(ficha.index);
			if (no) {
				itens.appendChild(no);
			}
		}
		secao.appendChild(itens);
		lista.appendChild(secao);
	}

	root.querySelector('.ns-vazio').hidden = grupos.length > 0;
	root.querySelectorAll('.ns-aba').forEach(aba => {
		aba.classList.toggle('is-active', aba.dataset.categoria === _categoria);
	});
	atualizarBotaoDeTudo();
}

/* ─── Tudo no maximo ─────────────────────────────────────────────────────── */

/** Toda linha a vista ja esta no proprio teto? */
function aVistaEstaCheia() {
	if (_visiveis.length === 0) {
		return false;
	}
	return _visiveis.every(index => {
		const item = _input[index];
		const escolhido = _output[index];
		return item && escolhido && escolhido.count === tetoDoItem(item);
	});
}

/**
 * O botao de acao em massa (D-922, pedido do dono).
 *
 * Ele e um SO, e alterna — "Tudo no máx" enche, "Limpar" esvazia — porque um
 * botao que so enche e uma armadilha: quem enchesse uma vitrine de 40 linhas
 * sem querer teria 40 cliques de volta pela frente. A regra de virar e a do
 * seletor-mestre de qualquer lista: cheio -> o clique desfaz.
 */
function atualizarBotaoDeTudo() {
	const botao = NpcStore.getRoot().querySelector('.ns-tudo');
	const cheia = aVistaEstaCheia();
	const escopo = _categoria === CATEGORIA_TUDO && !_termo ? 'a lista' : 'o que está à vista';

	botao.disabled = _visiveis.length === 0;
	botao.textContent = cheia ? 'Limpar' : 'Tudo no máx';
	botao.title = cheia
		? `Zerar a quantidade de ${escopo}`
		: `Pôr no máximo a quantidade de ${escopo} (${_visiveis.length} ${_visiveis.length === 1 ? 'item' : 'itens'})`;
}

/**
 * Enche (ou esvazia) TODA a vista de uma vez.
 *
 * O alcance e `_visiveis`, e nao `_input`: com uma aba escolhida, so os itens
 * dela — que e o que o dono pediu com todas as letras. A busca entra pelo
 * mesmo motivo.
 *
 * O resumo e refeito UMA vez no fim, e nao por linha: numa vitrine de 40
 * linhas seriam 40 recalculos de total, peso e freio para um clique so.
 */
function encherOuLimparAVista() {
	const limpar = aVistaEstaCheia();
	for (const index of _visiveis) {
		const item = _input[index];
		if (item) {
			aplicarQuantidade(index, limpar ? 0 : tetoDoItem(item));
		}
	}
	atualizarResumo();
}

/* ─── Interacao ──────────────────────────────────────────────────────────── */

function onCliqueNaLista(e) {
	const linha = e.target.closest('.ns-item');
	if (!linha) {
		return;
	}
	const index = parseInt(linha.dataset.index, 10);
	const item = _input[index];
	if (!item) {
		return;
	}

	if (e.target.closest('.ns-tile')) {
		// Mesmo alternar da V1: clicar de novo no mesmo item fecha a ficha.
		if (ItemInfo.uid === item.ITID) {
			ItemInfo.remove();
			ItemInfo.uid = null;
			return;
		}
		ItemInfo.append();
		ItemInfo.uid = item.ITID;
		ItemInfo.setItem(item);
		return;
	}

	if (e.target.closest('.ns-menos')) {
		mudarQuantidade(index, -1);
	} else if (e.target.closest('.ns-mais')) {
		mudarQuantidade(index, +1);
	} else if (e.target.closest('.ns-max')) {
		definirQuantidade(index, tetoDoItem(item));
	}
}

function onQuantidadeDigitada(e) {
	const input = e.target.closest('.ns-qtd-in');
	if (!input) {
		return;
	}
	const linha = input.closest('.ns-item');
	const index = parseInt(linha.dataset.index, 10);
	definirQuantidade(index, parseInt(input.value, 10) || 0);
}

function mudarQuantidade(index, delta) {
	definirQuantidade(index, (_output[index] ? _output[index].count : 0) + delta);
}

/**
 * Escreve a quantidade de UMA linha, sem tocar no rodape. Separada de
 * `definirQuantidade` para a acao em massa poder recalcular o resumo uma vez
 * so no fim (ver `encherOuLimparAVista`).
 */
function aplicarQuantidade(index, valor) {
	const item = _input[index];
	const escolhido = _output[index];
	if (!item || !escolhido) {
		return;
	}

	escolhido.count = Math.max(0, Math.min(tetoDoItem(item), valor | 0));

	const linha = _nos.get(index);
	if (linha) {
		linha.querySelector('.ns-qtd-in').value = String(escolhido.count);
		linha.querySelector('.ns-menos').disabled = escolhido.count === 0;
		linha.querySelector('.ns-mais').disabled = escolhido.count >= tetoDoItem(item);
		linha.classList.toggle('esta-no-carrinho', escolhido.count > 0);
	}
}

function definirQuantidade(index, valor) {
	aplicarQuantidade(index, valor);
	atualizarResumo();
}

/**
 * O rodape vivo: quantas linhas escolhidas, total, peso e os dois freios.
 */
function atualizarResumo() {
	const root = NpcStore.getRoot();
	const total = NpcStore.calculateCost();

	let linhas = 0;
	let pecas = 0;
	for (let i = 0; i < _output.length; ++i) {
		if (_output[i] && _output[i].count > 0) {
			linhas++;
			pecas += _output[i].count;
		}
	}

	const textos = TEXTOS[_type] || TEXTOS[NpcStore.Type.BUY];
	root.querySelector('.ns-itens-escolhidos').textContent = linhas
		? `${pecas} ${pecas === 1 ? 'item' : 'itens'} (${linhas} ${linhas === 1 ? 'tipo' : 'tipos'}) na ${textos.escolha}`
		: 'Nada escolhido';

	root.querySelector('.ns-total-valor').textContent = prettyZeny(total);

	// O freio: comprar alem do zeny (ou vender alem do limite do comprador)
	// trava o botao E pinta os numeros — o motivo fica visivel, nao mudo.
	let semSaldo = false;
	if (!eDeVenda() && !eEscambo() && _type !== NpcStore.Type.CASH_SHOP) {
		semSaldo = total > Session.zeny;
	} else if (_type === NpcStore.Type.BUYING_STORE && _limiteZeny >= 0) {
		semSaldo = total > _limiteZeny;
	}

	root.querySelector('.ns-total').classList.toggle('esta-insuficiente', semSaldo);
	const bolsa = root.querySelector('.ns-bolsa');
	bolsa.classList.toggle('esta-insuficiente', semSaldo && !eDeVenda());

	/*
	 * O zeny da faixa de cima era escrito SO em `setType`, e a janela nao
	 * fecha depois de comprar: o freio ja lia `Session.zeny` vivo enquanto o
	 * numero ao lado dele continuava o da abertura. Vender tres vezes seguidas
	 * mostrava a bolsa parada e o total travando "sem motivo" — a contradicao
	 * ficou obvia quando o peso entrou ao lado e se atualizava.
	 */
	if (!bolsa.hidden) {
		root.querySelector('.ns-bolsa-valor').textContent = prettyZeny(Session.zeny);
	}

	const pesado = atualizarPeso();

	const agir = root.querySelector('.ns-agir');
	agir.disabled = linhas === 0 || semSaldo || pesado;
	agir.title = semSaldo
		? 'Zeny insuficiente para esse total'
		: pesado
			? 'Peso além do que você consegue carregar'
			: '';

	// O botao de massa vira "Limpar" assim que a vista fica cheia, e volta
	// assim que uma linha sai do teto — inclusive pelo degrau da propria linha.
	atualizarBotaoDeTudo();
}

/**
 * O peso no rodape: quanto voce carrega, quanto vai carregar, e o freio.
 *
 * A trava e a MESMA conta do servidor (`servidor-mapa.ts`, o FAIL_WEIGHT da
 * compra): `peso do inventario + peso da compra > teto`. Ela vive aqui para o
 * jogador ver o numero subir ANTES de apertar o botao — o servidor continua
 * sendo a porta, esta e a placa.
 *
 * @returns {boolean} true quando a escolha estoura o teto (o botao trava)
 */
function atualizarPeso() {
	const root = NpcStore.getRoot();
	const el = root.querySelector('.ns-peso');
	const entidade = Session.Entity;
	const teto = entidade ? entidade.max_weight : 0;
	const daCompra = NpcStore.calculateWeight();

	// Sem teto (ainda nao chegou do servidor) ou com item de peso desconhecido:
	// a linha SOME. Meia informacao de peso e pior que nenhuma — ela viraria a
	// trava do botao.
	if (!teto || daCompra === null || eEscambo()) {
		el.hidden = true;
		return false;
	}

	const atual = entidade.weight || 0;
	// Vender ALIVIA a mochila: o delta e negativo, e o teto nunca esta em jogo.
	const delta = eDeVenda() ? -daCompra : daCompra;
	const depois = Math.max(0, atual + delta);
	const estoura = depois > teto;

	el.hidden = false;
	root.querySelector('.ns-peso-valor').textContent = `${prettyPeso(depois)} / ${prettyPeso(teto)}`;

	const rotuloDelta = root.querySelector('.ns-peso-delta');
	rotuloDelta.textContent = delta === 0 ? '' : ` (${delta > 0 ? '+' : '−'}${prettyPeso(Math.abs(delta))})`;

	el.classList.toggle('esta-insuficiente', estoura);
	// Aviso de 90%: e o degrau em que o rAthena ja para de regenerar HP/SP
	// (Overweight 90%, StatusInfo.js) — nao e numero desta tela.
	el.classList.toggle('esta-pesado', !estoura && depois >= teto * 0.9);

	return estoura;
}

/**
 * Create component and export it
 */
export default UIManager.addComponent(NpcStore);
