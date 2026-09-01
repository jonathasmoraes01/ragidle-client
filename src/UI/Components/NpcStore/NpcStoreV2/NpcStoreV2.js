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

let _type;
let _closePacketSent = false;

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

function precoUnitario(item) {
	return item.discountprice ?? item.overchargeprice ?? item.price ?? 0;
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
	root.querySelector('.ns-busca .ri-input').addEventListener('input', filtrar);

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
	_limiteZeny = -1;

	const root = NpcStore.getRoot();
	root.querySelector('.ns-lista').innerHTML = '';
	root.querySelector('.ns-busca .ri-input').value = '';

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
	const lista = root.querySelector('.ns-lista');
	lista.innerHTML = '';
	_input.length = 0;
	_output.length = 0;

	const registrar = item => {
		const escolhido = Object.assign({}, item);
		escolhido.count = 0;
		_input[item.index] = item;
		_output[item.index] = escolhido;
		lista.appendChild(montarLinha(item));
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

	root.querySelector('.ns-vazio').hidden = lista.children.length > 0;
	atualizarResumo();
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

NpcStore.calculateWeight = function calculateWeight() {
	let peso = 0;
	for (let i = 0; i < _output.length; ++i) {
		const o = _output[i];
		if (o && o.count > 0) {
			const info = DB.getItemInfo(o.ITID);
			peso += (info && info.weight ? info.weight : 0) * o.count;
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

function montarLinha(item) {
	const info = DB.getItemInfo(item.ITID);
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

	// Meta: o que ajuda a decidir, nada alem. Peso so quando o DB o conhece.
	const meta = [];
	if (info && info.weight) {
		meta.push(`Peso ${info.weight / 10}`);
	}
	if (_type === NpcStore.Type.SELL) {
		meta.push(`Você tem ${item.count}`);
	} else if (_type === NpcStore.Type.BUYING_STORE) {
		meta.push(`Você tem ${item.count} · quer ${item.maxCount}`);
	} else if (isFinite(item.count)) {
		meta.push(`Estoque ${item.count}`);
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
		`<div class="ns-meta">${meta.join(' · ')}</div>` +
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

	// Icone: /ragidle/item/<ITID>.png com reserva no bitmap do GRF — a mesma
	// receita da Mochila (setItemIcon de MochilaIdle.js).
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

function definirQuantidade(index, valor) {
	const item = _input[index];
	const escolhido = _output[index];
	if (!item || !escolhido) {
		return;
	}

	escolhido.count = Math.max(0, Math.min(tetoDoItem(item), valor | 0));

	const root = NpcStore.getRoot();
	const linha = root.querySelector(`.ns-item[data-index="${index}"]`);
	if (linha) {
		linha.querySelector('.ns-qtd-in').value = String(escolhido.count);
		linha.querySelector('.ns-menos').disabled = escolhido.count === 0;
		linha.querySelector('.ns-mais').disabled = escolhido.count >= tetoDoItem(item);
		linha.classList.toggle('esta-no-carrinho', escolhido.count > 0);
	}
	atualizarResumo();
}

/**
 * O rodape vivo: quantas linhas escolhidas, total, e o freio de zeny.
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

	const agir = root.querySelector('.ns-agir');
	agir.disabled = linhas === 0 || semSaldo;
	agir.title = semSaldo ? 'Zeny insuficiente para esse total' : '';
}

/**
 * Busca por nome — só esconde/mostra linhas, o estado das quantidades fica.
 */
function filtrar(e) {
	const termo = e.target.value.trim().toLocaleLowerCase('pt-BR');
	const root = NpcStore.getRoot();
	let visiveis = 0;
	root.querySelectorAll('.ns-item').forEach(linha => {
		const bate = !termo || linha.querySelector('.ns-nome').textContent.toLocaleLowerCase('pt-BR').includes(termo);
		linha.hidden = !bate;
		if (bate) {
			visiveis++;
		}
	});
	root.querySelector('.ns-vazio').hidden = visiveis > 0;
}

/**
 * Create component and export it
 */
export default UIManager.addComponent(NpcStore);
