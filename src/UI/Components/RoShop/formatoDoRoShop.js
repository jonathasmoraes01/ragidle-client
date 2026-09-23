/**
 * UI/Components/RoShop/formatoDoRoShop.js
 *
 * A METADE PURA do RO Shop (22/09/2026). Tudo aqui e funcao de entrada ->
 * string/objeto, sem DOM, sem Network, sem GUIComponent - o mesmo corte de
 * `TemporadaIdle/formatoDaTemporada.js`: a metade que decide roda de verdade
 * em teste; a metade que monta a janela e o `controladorDoRoShop.js`.
 *
 * ## A regra que este modulo nunca quebra
 *
 * O servidor e a autoridade de SALDO, PRECO, DISPONIBILIDADE e ENTREGA
 * (`docs/ro-shop/CONTRATO.md` no servidor, secoes 3 e 4). O carrinho guarda SO
 * `{ sku, quantidade }`: o preco de cada linha e lido do ULTIMO estado que o
 * servidor mandou, toda vez que a tela e desenhada. Nenhuma funcao aqui
 * escreve preco, desconto, saldo ou item id num pedido - o checkout leva
 * `chave`, `itens` e `totalEsperadoMinor`, e este ultimo so serve para o
 * servidor RECUSAR quando o preco mudou entre a tela e o clique.
 *
 * ## O que NAO mora aqui (decisao do dono, D-RS-04)
 *
 * Caixas, pity, odds, abertura, Passe de Batalha e VIP sao da janela
 * Temporada. O RO Shop tem no maximo o atalho `renderAtalhoTemporadaHtml`, que
 * so NAVEGA.
 *
 * ## Travessao e proibido
 *
 * Todo texto daqui usa hifen. O nome do atalho e "Season 1 - Luz & Trevas".
 */

import RiIcones from 'UI/ri-icones.js';
import { formatarRoCash, ehMinor } from 'Utils/roCash.js';

/** O cadeado do design system (glifo Lucide de UI/ri-icones.js), ou vazio. */
function cadeado() {
	return `<span class="rs-cadeado" aria-hidden="true">${(RiIcones && RiIcones.cadeado) || ''}</span>`;
}

/** Onde moram os assets do RO Shop (public/ragidle/shop, ver o MAPA-DOS-ASSETS.md de la). */
export const ASSETS = '/ragidle/shop';

export const ASSET = {
	banner: `${ASSETS}/banner/shop-banner-hero.png`,
	roCash: `${ASSETS}/icons/shop-icon-ro-cash.png`,
	recarregar: `${ASSETS}/icons/shop-icon-recharge.png`,
	carrinho: `${ASSETS}/icons/shop-icon-cart.png`,
	fechar: `${ASSETS}/buttons/shop-btn-close.png`,
	carrinhoVazio: `${ASSETS}/states/shop-empty-cart.png`,
	placeholder: `${ASSETS}/states/shop-item-placeholder.png`,
	divisor: `${ASSETS}/ornaments/shop-divider-horizontal.png`,
	placaDoTitulo: `${ASSETS}/ornaments/shop-header-ornament.png`
};

/** O icone de cada categoria, pela chave NORMALIZADA (id ou nome). */
const ICONE_DA_CATEGORIA = {
	destaques: `${ASSETS}/icons/shop-icon-featured.png`,
	farmup: `${ASSETS}/icons/shop-icon-farm-up.png`,
	pocoes: `${ASSETS}/icons/shop-icon-potions.png`,
	boosts: `${ASSETS}/icons/shop-icon-boosts.png`,
	utilidades: `${ASSETS}/icons/shop-icon-utilities.png`,
	conta: `${ASSETS}/icons/shop-icon-account.png`
};

/**
 * As seis categorias do RO Shop (MASTER_PROMPT secao 6), usadas SO quando o
 * estado chega sem `categorias` - a janela nunca fica sem navegacao. O
 * contrato manda as seis, fixas; quem manda nelas e o servidor.
 */
const CATEGORIAS_DE_RESERVA = [
	{ id: 'destaques', nome: 'Destaques', ordem: 0 },
	{ id: 'farm-up', nome: 'Farm & Up', ordem: 1 },
	{ id: 'pocoes', nome: 'Poções', ordem: 2 },
	{ id: 'boosts', nome: 'Boosts', ordem: 3 },
	{ id: 'utilidades', nome: 'Utilidades', ordem: 4 },
	{ id: 'conta', nome: 'Conta', ordem: 5 }
];

/**
 * O SELO so aparece quando o servidor manda (`produto.selo`). O token e
 * contrato (`novo`/`oferta`/`popular`); a palavra e a arte sao daqui. Token
 * desconhecido NAO vira selo - nunca um selo inventado.
 */
const SELOS = {
	novo: { texto: 'Novidade', arte: `${ASSETS}/badges/shop-badge-new.png` },
	oferta: { texto: 'Oferta', arte: `${ASSETS}/badges/shop-badge-sale.png` },
	popular: { texto: 'Popular', arte: `${ASSETS}/badges/shop-badge-popular.png` }
};

/** O teto de linhas diferentes no carrinho (o servidor recusa o que passar). */
export const MAX_LINHAS_NO_CARRINHO = 18;

/** Produtos por pagina na grade. */
export const POR_PAGINA = 8;

/** Mesmo escape de formatoDaTemporada.js - sem depender de DOM. */
export function escapeHtml(value) {
	return String(value == null ? '' : value).replace(/[&<>"']/g, ch => {
		switch (ch) {
			case '&':
				return '&amp;';
			case '<':
				return '&lt;';
			case '>':
				return '&gt;';
			case '"':
				return '&quot;';
			default:
				return '&#39;';
		}
	});
}

/** "Poções" -> "pocoes", "Farm & Up" -> "farmup", "farm-up" -> "farmup". */
export function normalizar(texto) {
	return String(texto == null ? '' : texto)
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]/g, '');
}

/* ------------------------------------------------------------------ */
/* Estado: categorias e produtos                                        */
/* ------------------------------------------------------------------ */

/** As categorias do estado, na `ordem` do servidor (ou as seis de reserva). */
export function categoriasDoEstado(estado) {
	const lista = estado && Array.isArray(estado.categorias) && estado.categorias.length ? estado.categorias : null;
	const base = (lista || CATEGORIAS_DE_RESERVA).filter(c => c && c.id != null);
	return [...base].sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0));
}

/** A categoria de Destaques e a que mostra `destaque: true` de TODAS as outras. */
export function ehDestaques(categoria) {
	const chave = normalizar(categoria && categoria.id) || normalizar(categoria && categoria.nome);
	return chave === 'destaques';
}

/** O icone da categoria (asset do RO Shop), ou o de Destaques como reserva. */
export function iconeDaCategoria(categoria) {
	const porId = ICONE_DA_CATEGORIA[normalizar(categoria && categoria.id)];
	const porNome = ICONE_DA_CATEGORIA[normalizar(categoria && categoria.nome)];
	return porId || porNome || ICONE_DA_CATEGORIA.destaques;
}

function categoriaDoProdutoCasa(produto, categoria) {
	const alvo = normalizar(produto && produto.categoria);
	if (!alvo) {
		return false;
	}
	return alvo === normalizar(categoria.id) || alvo === normalizar(categoria.nome);
}

/**
 * Ordena pela ordem do SERVIDOR. `campo` e `ordem` (dentro da categoria-casa)
 * ou `ordemNoDestaque` (a vitrine Destaques - CONTRATO.md secao 4: "filtre
 * destaque e ordene por ordemNoDestaque"); sem o campo, o produto vai para o
 * fim, por nome.
 */
function ordenar(lista, campo = 'ordem') {
	return [...lista].sort((a, b) => {
		const oa = Number(a[campo] ?? a.ordem);
		const ob = Number(b[campo] ?? b.ordem);
		const da = Number.isFinite(oa) ? oa : 9999;
		const db = Number.isFinite(ob) ? ob : 9999;
		if (da !== db) {
			return da - db;
		}
		return String(a.nome || '').localeCompare(String(b.nome || ''));
	});
}

/** Os produtos validos do estado (tem `sku`). */
export function produtosDoEstado(estado) {
	return ((estado && estado.produtos) || []).filter(p => p && typeof p.sku === 'string' && p.sku);
}

/** Um produto pelo `sku`, ou null. */
export function produtoPorSku(estado, sku) {
	return produtosDoEstado(estado).find(p => p.sku === sku) || null;
}

/** Os produtos de uma categoria (Destaques = os `destaque: true`). */
export function produtosDaCategoria(estado, categoria) {
	if (!categoria) {
		return [];
	}
	const todos = produtosDoEstado(estado);
	if (ehDestaques(categoria)) {
		return ordenar(
			todos.filter(p => p.destaque === true || categoriaDoProdutoCasa(p, categoria)),
			'ordemNoDestaque'
		);
	}
	return ordenar(todos.filter(p => categoriaDoProdutoCasa(p, categoria)));
}

/** A busca: nome, resumo, descricao e o nome de cada item do conteudo. Sem acento. */
export function buscarProdutos(estado, termo) {
	const alvo = normalizar(termo);
	if (!alvo) {
		return [];
	}
	return ordenar(
		produtosDoEstado(estado).filter(p => {
			const partes = [p.nome, p.resumo, p.descricao, ...(p.conteudo || []).map(c => c && c.nome)];
			return partes.some(t => normalizar(t).includes(alvo));
		})
	);
}

/** A pagina `pagina` (1..N) de uma lista. A pagina pedida e presa no intervalo. */
export function paginar(lista, pagina, porPagina = POR_PAGINA) {
	const total = Math.max(1, Math.ceil((lista || []).length / porPagina));
	const atual = Math.min(total, Math.max(1, Math.trunc(Number(pagina)) || 1));
	const inicio = (atual - 1) * porPagina;
	return { itens: (lista || []).slice(inicio, inicio + porPagina), pagina: atual, totalPaginas: total };
}

/* ------------------------------------------------------------------ */
/* Disponibilidade                                                      */
/* ------------------------------------------------------------------ */

/**
 * O produto pode entrar no carrinho? So quando o SERVIDOR diz que sim:
 * `ativo !== false`, `indisponivel` nulo e um `precoMinor` inteiro.
 */
export function produtoCompravel(produto) {
	return !!(produto && produto.ativo !== false && !produto.indisponivel && ehMinor(produto.precoMinor));
}

/**
 * O TRAVAMENTO de um produto para a tela: null quando esta a venda; senao
 * `{ tipo, texto }`. O texto e SEMPRE o do servidor quando ele manda um; a
 * reserva so entra quando o campo veio vazio.
 *
 * `tipo` decide a PELE: 'esgotado' (teto atingido - o jogador ja levou o
 * limite) ou 'indisponivel' (desativado, ou qualquer outro motivo).
 */
export function travaDoProduto(produto) {
	if (!produto) {
		return { tipo: 'indisponivel', texto: 'Indisponível' };
	}
	const ind = produto.indisponivel;
	if (ind) {
		const motivo = String(ind.motivo || '');
		return {
			tipo: motivo === 'teto-atingido' || motivo === 'esgotado' ? 'esgotado' : 'indisponivel',
			texto: String(ind.texto || '').trim() || 'Indisponível no momento'
		};
	}
	if (produto.ativo === false) {
		return { tipo: 'indisponivel', texto: 'Indisponível no momento' };
	}
	if (!ehMinor(produto.precoMinor)) {
		return { tipo: 'indisponivel', texto: 'Preço indisponível' };
	}
	return null;
}

/**
 * Quantas unidades deste produto um checkout aceita (`quantidadeMaxima` do
 * servidor). Sem o campo, UMA: a reserva segura e a que nunca deixa o
 * carrinho prometer o que o servidor pode recusar.
 */
export function tetoDoProduto(produto) {
	const n = produto && produto.quantidadeMaxima;
	return Number.isInteger(n) && n > 0 ? n : 1;
}

/* ------------------------------------------------------------------ */
/* Carrinho (so sku + quantidade)                                       */
/* ------------------------------------------------------------------ */

/** A quantidade de um sku no carrinho (0 se nao esta). */
export function quantidadeNoCarrinho(carrinho, sku) {
	const linha = (carrinho || []).find(l => l.sku === sku);
	return linha ? linha.quantidade : 0;
}

/**
 * Soma `quantidade` de um produto ao carrinho. Devolve um carrinho NOVO e a
 * recusa (`null` quando entrou): 'indisponivel', 'teto' (ja esta no maximo)
 * ou 'cheio' (linhas demais).
 */
export function adicionarAoCarrinho(carrinho, produto, quantidade = 1) {
	const atual = carrinho || [];
	if (!produtoCompravel(produto)) {
		return { carrinho: atual, recusa: 'indisponivel' };
	}
	const teto = tetoDoProduto(produto);
	const ja = quantidadeNoCarrinho(atual, produto.sku);
	if (ja >= teto) {
		return { carrinho: atual, recusa: 'teto' };
	}
	if (!ja && atual.length >= MAX_LINHAS_NO_CARRINHO) {
		return { carrinho: atual, recusa: 'cheio' };
	}
	const soma = Math.min(teto, ja + Math.max(1, Math.trunc(Number(quantidade)) || 1));
	if (ja) {
		return {
			carrinho: atual.map(l => (l.sku === produto.sku ? { sku: l.sku, quantidade: soma } : l)),
			recusa: null
		};
	}
	return { carrinho: [...atual, { sku: produto.sku, quantidade: soma }], recusa: null };
}

/** Troca a quantidade de uma linha, presa entre 1 e o teto do produto. */
export function definirQuantidade(carrinho, produto, quantidade) {
	const atual = carrinho || [];
	if (!produto) {
		return atual;
	}
	const teto = tetoDoProduto(produto);
	const q = Math.min(teto, Math.max(1, Math.trunc(Number(quantidade)) || 1));
	return atual.map(l => (l.sku === produto.sku ? { sku: l.sku, quantidade: q } : l));
}

/** Tira uma linha do carrinho. */
export function removerDoCarrinho(carrinho, sku) {
	return (carrinho || []).filter(l => l.sku !== sku);
}

/**
 * RECONCILIA o carrinho com um estado NOVO do servidor: sai a linha cujo
 * produto sumiu, desativou ou ficou indisponivel (com o texto do servidor),
 * e a quantidade acima do teto novo e aparada. E isto que faz o carrinho
 * nunca mostrar um preco velho: ele nao guarda preco nenhum.
 */
export function reconciliarCarrinho(carrinho, estado) {
	const removidos = [];
	const ajustados = [];
	const novo = [];
	(carrinho || []).forEach(linha => {
		const produto = produtoPorSku(estado, linha.sku);
		if (!produtoCompravel(produto)) {
			const trava = travaDoProduto(produto);
			removidos.push({ sku: linha.sku, nome: (produto && produto.nome) || linha.sku, texto: trava.texto });
			return;
		}
		const teto = tetoDoProduto(produto);
		if (linha.quantidade > teto) {
			ajustados.push({ sku: linha.sku, nome: produto.nome, quantidade: teto });
			novo.push({ sku: linha.sku, quantidade: teto });
			return;
		}
		novo.push({ sku: linha.sku, quantidade: linha.quantidade });
	});
	return { carrinho: novo, removidos, ajustados };
}

/** O saldo da carteira em minor, ou null quando o estado nao trouxe. */
export function saldoDoEstado(estado) {
	const moeda = estado && estado.moeda;
	return moeda && ehMinor(moeda.saldoMinor) ? moeda.saldoMinor : null;
}

/**
 * O RESUMO do carrinho contra o ULTIMO estado: linhas com o preco do
 * servidor, total, saldo e saldo apos. `saldoInsuficiente` e so para a tela
 * avisar ANTES do clique - quem recusa de verdade e o servidor.
 */
export function resumoDoCarrinho(carrinho, estado) {
	const linhas = [];
	let totalMinor = 0;
	let quantidadeTotal = 0;
	(carrinho || []).forEach(linha => {
		const produto = produtoPorSku(estado, linha.sku);
		if (!produto || !ehMinor(produto.precoMinor)) {
			return;
		}
		const subtotal = produto.precoMinor * linha.quantidade;
		totalMinor += subtotal;
		quantidadeTotal += linha.quantidade;
		linhas.push({
			sku: linha.sku,
			produto,
			quantidade: linha.quantidade,
			teto: tetoDoProduto(produto),
			unitarioMinor: produto.precoMinor,
			totalMinor: subtotal
		});
	});
	const saldoMinor = saldoDoEstado(estado);
	const saldoAposMinor = saldoMinor === null ? null : saldoMinor - totalMinor;
	return {
		linhas,
		totalMinor,
		quantidadeTotal,
		saldoMinor,
		saldoAposMinor,
		saldoInsuficiente: saldoAposMinor !== null && saldoAposMinor < 0
	};
}

/**
 * O CORPO do checkout (CONTRATO.md secao 3). So `sku` e `quantidade` por
 * linha - nunca preco, desconto, saldo ou item id. A `chave` e de quem chama:
 * gerada UMA vez por checkout e reusada em reenvio.
 */
export function pedidoDeCheckout(carrinho, estado, chave) {
	const resumo = resumoDoCarrinho(carrinho, estado);
	return {
		acao: 'checkout',
		chave: String(chave || ''),
		itens: resumo.linhas.map(l => ({ sku: l.sku, quantidade: l.quantidade })),
		totalEsperadoMinor: resumo.totalMinor
	};
}

/**
 * A CHAVE do checkout: um UUID v4 (o contrato diz "uuid do clique"), que
 * tambem cabe no alfabeto `[A-Za-z0-9_-]` que as outras chaves do jogo usam.
 * Fonte criptografica (`crypto`) sempre que existir - nunca `Math.random` no
 * caminho normal, que nao serve para dedupe de compra.
 */
export function gerarChaveDeCheckout() {
	const c = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
	if (c && typeof c.randomUUID === 'function') {
		return c.randomUUID();
	}
	const b = new Uint8Array(16);
	if (c && typeof c.getRandomValues === 'function') {
		c.getRandomValues(b);
	} else {
		for (let i = 0; i < 16; i++) {
			b[i] = Math.floor(Math.random() * 256);
		}
	}
	b[6] = (b[6] & 0x0f) | 0x40;
	b[8] = (b[8] & 0x3f) | 0x80;
	const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
	return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** A assinatura de um carrinho: muda quando qualquer sku/quantidade muda. */
export function assinaturaDoCarrinho(carrinho) {
	return (carrinho || []).map(l => `${l.sku}x${l.quantidade}`).join('|');
}

/* ------------------------------------------------------------------ */
/* Icones                                                              */
/* ------------------------------------------------------------------ */

/**
 * OS ITEM IDS que podem dar o icone real de um produto, na ordem de
 * preferencia: `imagem.itemId` (o pack) e depois cada item do conteudo. A
 * arte do pack custom pode nao estar publicada ainda; o conteudo (Pocao Azul,
 * Asa de Mosca) quase sempre esta.
 */
export function idsDoIcone(produto) {
	const ids = [];
	const empurrar = v => {
		const n = Number(v);
		if (Number.isInteger(n) && n > 0 && ids.indexOf(n) === -1) {
			ids.push(n);
		}
	};
	empurrar(produto && produto.imagem && produto.imagem.itemId);
	((produto && produto.conteudo) || []).forEach(c => empurrar(c && c.itemId));
	return ids;
}

/**
 * O ICONE DE CADA SERVICO/CONTA (rodada 3, 22/09/2026). O servidor manda
 * `imagem: null` e `conteudo: []` para os 7 (CONTRATO.md secao 4), e a reserva
 * era o icone da CATEGORIA: os 5 de Conta saiam todos com o mesmo escudo e
 * espada, e os 2 de Utilidades com o mesmo pergaminho (QA independente,
 * achado A-09). O pacote do dono nao tem mais icone de servico (ver o
 * MAPA-DOS-ASSETS.md), entao cada um usa um icone de item do `data.grf` JA
 * PUBLICADO em `public/ragidle/item/<id>.png`, escolhido olhando a arte (folha
 * de contato da rodada 3). E so ARTE, nunca dado: o id nao vai ao servidor, e
 * o que o jogador recebe continua sendo o nome e o resumo do produto. A tabela
 * com o motivo de cada um esta no `RO_SHOP_REQUIRED_ASSETS.md`, secao 2. Se o
 * PNG nao carregar, fica a reserva de sempre (o icone da categoria).
 */
export const ICONE_DO_SERVICO = {
	SERVICE_SKILL_RESET: 1550, // Livro
	SERVICE_STAT_RESET: 12040, // Pedra do Sabio
	SERVICE_RENAME: 7015, // Marca-Pagina (a pena de escrever)
	SERVICE_APPEARANCE_CHANGE: 12368, // Espelho de Mao
	ACCOUNT_CHARACTER_SLOT: 5141, // Boneca de Marionete (mais um personagem)
	ACCOUNT_INVENTORY_10: 12130, // Sacola de Biscoitos (a sacola de carga)
	ACCOUNT_STORAGE_100: 603 // Velha Caixa Azul (o bau do armazem)
};

/**
 * O RETRATO de um produto. Arte que INFORMA e o PNG do item do cliente
 * (`/ragidle/item/<id>.png`, 24x24) ampliado INTEIRO com
 * `image-rendering: pixelated` - quem troca a reserva pela arte e o
 * controlador, tentando os ids na ordem.
 *
 * A reserva enquanto nao carrega (e para sempre, se nada carregar): servico
 * sem item (Reset, Troca de Nome, Slot) mostra o icone da CATEGORIA, que diz
 * o que ele e; o resto mostra o `shop-item-placeholder`, que so diz "ha um
 * item aqui". Nunca uma imagem quebrada.
 */
export function retratoHtml(produto, categoria, classe = 'rs-retrato') {
	let ids = idsDoIcone(produto);
	const servico = !ids.length && produto && produto.tipoDeEntrega && produto.tipoDeEntrega !== 'item';
	if (servico && ICONE_DO_SERVICO[produto.sku]) {
		ids = [ICONE_DO_SERVICO[produto.sku]];
	}
	const reserva = servico && categoria ? iconeDaCategoria(categoria) : ASSET.placeholder;
	const attr = ids.length ? ` data-item-ids="${ids.join(',')}"` : '';
	return (
		`<span class="${classe}${servico ? ' is-servico' : ''}"${attr}>` +
		`<img class="rs-retrato-reserva" src="${reserva}" alt="" draggable="false">` +
		'</span>'
	);
}

/** A categoria (objeto) de um produto, pela chave normalizada. */
export function categoriaDoProduto(estado, produto) {
	return categoriasDoEstado(estado).find(c => !ehDestaques(c) && categoriaDoProdutoCasa(produto, c)) || null;
}

/* ------------------------------------------------------------------ */
/* HTML                                                                */
/* ------------------------------------------------------------------ */

/** "2,00 RO Cash" com a moeda - o preco de um card, de uma linha, de um total. */
export function precoHtml(minor, classe = 'rs-preco') {
	return (
		`<span class="${classe}">` +
		`<img class="rs-moeda" src="${ASSET.roCash}" alt="" draggable="false">` +
		`<strong class="rs-preco-valor">${escapeHtml(formatarRoCash(minor))}</strong>` +
		'<span class="rs-preco-unidade">RO Cash</span>' +
		'</span>'
	);
}

/** O selo (Novidade/Oferta/Popular) - so quando o servidor manda um token conhecido. */
export function seloHtml(selo) {
	const s = SELOS[String(selo || '')];
	if (!s) {
		return '';
	}
	return (
		`<span class="rs-selo rs-selo--${escapeHtml(selo)}">` +
		`<img class="rs-selo-arte" src="${s.arte}" alt="" draggable="false">` +
		`<span>${escapeHtml(s.texto)}</span>` +
		'</span>'
	);
}

/**
 * A CARTEIRA: o saldo REAL (`moeda.saldoMinor`) e o botao Recarregar.
 *
 * Recarregar segue `recarga` do servidor e nunca credita nada (CONTRATO.md
 * secao 6: "o botao Recarregar mostra `estado.recarga.texto`"). O botao fica
 * CLICAVEL mesmo sem gateway (`disponivel: false`), so com a pele apagada: um
 * botao desabilitado nao explica nada no celular, onde nao ha dica de mouse.
 * Sem gateway o clique mostra o `texto` do servidor e nao manda pacote; com
 * `disponivel: true` (a doacao via PIX, 23/09/2026) ele abre a janela
 * DoacaoIdle - quem decide isso e o controlador, nao este HTML.
 */
export function carteiraHtml(estado, classeExtra = '') {
	const saldo = saldoDoEstado(estado);
	const recarga = (estado && estado.recarga) || {};
	const disponivel = recarga.disponivel === true;
	const dica = textoDaRecarga(estado);
	return (
		`<div class="rs-carteira${classeExtra ? ` ${classeExtra}` : ''}">` +
		`<img class="rs-carteira-moeda" src="${ASSET.roCash}" alt="" draggable="false">` +
		'<span class="rs-carteira-texto">' +
		'<span class="rs-carteira-rotulo">Seu saldo</span>' +
		`<span class="rs-carteira-valor"><strong>${saldo === null ? '...' : escapeHtml(formatarRoCash(saldo))}</strong> <span>RO Cash</span></span>` +
		'</span>' +
		`<button type="button" class="rs-recarregar${disponivel ? '' : ' is-indisponivel'}" data-rs="recarregar" title="${escapeHtml(dica)}">` +
		`<img src="${ASSET.recarregar}" alt="" draggable="false">` +
		'<span>Recarregar</span>' +
		'</button>' +
		'</div>'
	);
}

/**
 * Quanto a fita de categorias precisa rolar (em px, na horizontal) para a chip
 * `chip` caber inteira dentro de `fita`, com `folga` de respiro na borda; 0
 * quando ela ja cabe. As duas caixas sao `getBoundingClientRect()`. Chip mais
 * larga que a fita alinha pela esquerda (o comeco do nome e o que se le).
 */
export function deslocamentoParaMostrar(fita, chip, folga = 12) {
	if (!fita || !chip) {
		return 0;
	}
	if (chip.left < fita.left) {
		return Math.round(chip.left - fita.left - folga);
	}
	if (chip.right > fita.right) {
		const paraADireita = chip.right - fita.right + folga;
		const ateOComeco = chip.left - fita.left - folga;
		return Math.round(Math.min(paraADireita, Math.max(0, ateOComeco)));
	}
	return 0;
}

/** As categorias (chips com icone). Busca ativa = nenhuma chip ativa. */
export function categoriasHtml(categorias, ativaId, buscando) {
	return categorias
		.map(c => {
			const ativa = !buscando && String(c.id) === String(ativaId);
			return (
				`<button type="button" class="rs-categoria${ativa ? ' is-ativa' : ''}" data-rs="categoria" data-categoria="${escapeHtml(c.id)}" aria-pressed="${ativa ? 'true' : 'false'}">` +
				`<img class="rs-categoria-icone" src="${iconeDaCategoria(c)}" alt="" draggable="false">` +
				`<span>${escapeHtml(c.nome || c.id)}</span>` +
				'</button>'
			);
		})
		.join('');
}

/**
 * UM CARD de produto: retrato, nome, resumo, preco, selo (so do servidor),
 * botao Adicionar e o gatilho de detalhes. Travado (desativado, indisponivel,
 * teto atingido) ele continua na vitrine - com o cadeado e o texto do
 * servidor no lugar do botao.
 */
export function cardHtml(produto, estado, noCarrinho) {
	const trava = travaDoProduto(produto);
	const teto = tetoDoProduto(produto);
	const cheio = !trava && noCarrinho >= teto;
	const classes = ['rs-card'];
	if (produto.destaque) {
		classes.push('is-destaque');
	}
	if (trava) {
		classes.push(`is-${trava.tipo}`);
	}
	const sku = escapeHtml(produto.sku);
	const acao = trava
		? `<span class="rs-card-trava" title="${escapeHtml(trava.texto)}">${cadeado()}<span>${escapeHtml(trava.texto)}</span></span>`
		: `<button type="button" class="rs-btn rs-btn--adicionar" data-rs="adicionar" data-sku="${sku}"${cheio ? ' disabled title="Limite deste item no carrinho"' : ''}>` +
			`<img class="rs-btn-icone" src="${ASSET.carrinho}" alt="" draggable="false">` +
			`<span>${cheio ? 'No limite' : 'Adicionar'}</span>` +
			'</button>';
	return (
		`<article class="${classes.join(' ')}" data-sku="${sku}">` +
		seloHtml(produto.selo) +
		(noCarrinho > 0
			? `<span class="rs-card-no-carrinho" title="No carrinho">${escapeHtml(noCarrinho)}</span>`
			: '') +
		`<button type="button" class="rs-card-detalhes" data-rs="detalhes" data-sku="${sku}" aria-label="Detalhes de ${escapeHtml(produto.nome)}">` +
		retratoHtml(produto, categoriaDoProduto(estado, produto)) +
		`<span class="rs-card-nome">${escapeHtml(produto.nome)}</span>` +
		`<span class="rs-card-resumo">${escapeHtml(produto.resumo || '')}</span>` +
		contadorDaContaHtml(produto, estado) +
		'</button>' +
		`<div class="rs-card-rodape">${precoHtml(produto.precoMinor)}${acao}</div>` +
		'</article>'
	);
}

/** A grade inteira, ou o estado vazio (categoria sem produto / busca sem resultado). */
export function gradeHtml(itens, estado, carrinho, vazioTexto) {
	if (!itens.length) {
		return (
			'<div class="rs-grade-vazia">' +
			`<img src="${ASSET.placeholder}" alt="" draggable="false">` +
			`<p>${escapeHtml(vazioTexto || 'Nenhum produto por aqui.')}</p>` +
			'</div>'
		);
	}
	return itens.map(p => cardHtml(p, estado, quantidadeNoCarrinho(carrinho, p.sku))).join('');
}

/** Primeira / anterior / "N de M" / proxima / ultima. */
export function paginacaoHtml(pagina, totalPaginas) {
	const noInicio = pagina <= 1;
	const noFim = pagina >= totalPaginas;
	const botao = (alvo, rotulo, texto, desligado) =>
		`<button type="button" class="rs-pagina-btn" data-rs="pagina" data-pagina="${alvo}" aria-label="${rotulo}" title="${rotulo}"${desligado ? ' disabled' : ''}>${texto}</button>`;
	return (
		botao(1, 'Primeira página', '&laquo;', noInicio) +
		botao(pagina - 1, 'Página anterior', '&lsaquo;', noInicio) +
		`<span class="rs-pagina-atual">Página <strong>${pagina}</strong> de ${totalPaginas}</span>` +
		botao(pagina + 1, 'Próxima página', '&rsaquo;', noFim) +
		botao(totalPaginas, 'Última página', '&raquo;', noFim)
	);
}

/** O controle de quantidade de uma linha do carrinho. */
function quantidadeHtml(linha) {
	const sku = escapeHtml(linha.sku);
	return (
		'<span class="rs-qtd">' +
		`<button type="button" class="rs-qtd-btn" data-rs="menos" data-sku="${sku}" aria-label="Menos um"${linha.quantidade <= 1 ? ' disabled' : ''}>-</button>` +
		`<span class="rs-qtd-valor">${linha.quantidade}</span>` +
		`<button type="button" class="rs-qtd-btn" data-rs="mais" data-sku="${sku}" aria-label="Mais um"${linha.quantidade >= linha.teto ? ' disabled' : ''}>+</button>` +
		'</span>'
	);
}

/**
 * O CORPO do carrinho: as linhas (ou o estado vazio com o Poring) e o fecho
 * com Subtotal / Total / Saldo atual / Saldo apos e o botao Comprar.
 */
export function carrinhoHtml(resumo, estado, travado) {
	if (!resumo.linhas.length) {
		return (
			'<div class="rs-carrinho-vazio">' +
			`<img src="${ASSET.carrinhoVazio}" alt="" draggable="false">` +
			'<p class="rs-carrinho-vazio-titulo">Seu carrinho está vazio.</p>' +
			'<p class="rs-carrinho-vazio-sub">Adicione itens para continuar.</p>' +
			'</div>'
		);
	}
	const linhas = resumo.linhas
		.map(
			l =>
				`<li class="rs-linha" data-sku="${escapeHtml(l.sku)}">` +
				retratoHtml(l.produto, categoriaDoProduto(estado, l.produto), 'rs-retrato rs-retrato--mini') +
				'<span class="rs-linha-info">' +
				`<span class="rs-linha-nome">${escapeHtml(l.produto.nome)}</span>` +
				`<span class="rs-linha-preco">${escapeHtml(formatarRoCash(l.unitarioMinor))} cada</span>` +
				'</span>' +
				quantidadeHtml(l) +
				`<span class="rs-linha-total">${escapeHtml(formatarRoCash(l.totalMinor))}</span>` +
				`<button type="button" class="rs-linha-remover" data-rs="remover" data-sku="${escapeHtml(l.sku)}" aria-label="Remover ${escapeHtml(l.produto.nome)}" title="Remover">&times;</button>` +
				'</li>'
		)
		.join('');
	return `<ul class="rs-linhas">${linhas}</ul>${totaisHtml(resumo, travado)}`;
}

/** O fecho do carrinho (compartilhado pelo painel e pela gaveta do celular). */
export function totaisHtml(resumo, travado) {
	const apos = resumo.saldoAposMinor;
	const podeComprar = resumo.linhas.length > 0 && !resumo.saldoInsuficiente && !travado && resumo.saldoMinor !== null;
	return (
		'<div class="rs-totais">' +
		`<img class="rs-totais-divisor" src="${ASSET.divisor}" alt="" draggable="false">` +
		`<div class="rs-total-linha"><span>Subtotal</span><span>${escapeHtml(formatarRoCash(resumo.totalMinor))}</span></div>` +
		`<div class="rs-total-linha rs-total-linha--total"><span>Total</span>${precoHtml(resumo.totalMinor, 'rs-preco rs-preco--total')}</div>` +
		`<div class="rs-total-linha rs-total-linha--saldo"><span>Saldo atual</span><span>${resumo.saldoMinor === null ? '...' : escapeHtml(formatarRoCash(resumo.saldoMinor))}</span></div>` +
		`<div class="rs-total-linha rs-total-linha--apos${resumo.saldoInsuficiente ? ' is-negativo' : ''}"><span>Saldo após</span><span>${apos === null ? '...' : escapeHtml(formatarRoCash(apos))}</span></div>` +
		(resumo.saldoInsuficiente ? '<p class="rs-aviso-saldo">Saldo insuficiente para esta compra.</p>' : '') +
		`<button type="button" class="rs-btn rs-btn--comprar" data-rs="comprar"${podeComprar ? '' : ' disabled'}>` +
		`<img class="rs-btn-icone" src="${ASSET.carrinho}" alt="" draggable="false">` +
		`<span>${travado ? 'Processando...' : 'Comprar'}</span>` +
		'</button>' +
		'</div>'
	);
}

/** O modal de DETALHES de um produto: descricao, conteudo, preco e o botao. */
export function detalhesHtml(produto, estado, noCarrinho) {
	const trava = travaDoProduto(produto);
	const teto = tetoDoProduto(produto);
	const conteudo = (produto.conteudo || [])
		.filter(c => c && c.nome)
		.map(
			c =>
				'<li class="rs-conteudo-item">' +
				retratoHtml(
					{ imagem: { itemId: c.itemId }, tipoDeEntrega: 'item' },
					null,
					'rs-retrato rs-retrato--mini'
				) +
				`<span class="rs-conteudo-qtd">${escapeHtml(c.quantidade)}x</span>` +
				`<span class="rs-conteudo-nome">${escapeHtml(c.nome)}</span>` +
				'</li>'
		)
		.join('');
	const cheio = !trava && noCarrinho >= teto;
	const acao = trava
		? `<p class="rs-detalhes-trava">${cadeado()}${escapeHtml(trava.texto)}</p>`
		: `<button type="button" class="rs-btn rs-btn--adicionar rs-btn--largo" data-rs="adicionar" data-sku="${escapeHtml(produto.sku)}" data-fecha="1"${cheio ? ' disabled' : ''}>` +
			`<img class="rs-btn-icone" src="${ASSET.carrinho}" alt="" draggable="false">` +
			`<span>${cheio ? 'Limite deste item no carrinho' : 'Adicionar ao carrinho'}</span>` +
			'</button>';
	return (
		'<div class="rs-detalhes">' +
		'<div class="rs-detalhes-topo">' +
		retratoHtml(produto, categoriaDoProduto(estado, produto), 'rs-retrato rs-retrato--grande') +
		'<div class="rs-detalhes-cab">' +
		seloHtml(produto.selo) +
		`<h3 class="rs-detalhes-nome">${escapeHtml(produto.nome)}</h3>` +
		(produto.resumo ? `<p class="rs-detalhes-resumo">${escapeHtml(produto.resumo)}</p>` : '') +
		contadorDaContaHtml(produto, estado) +
		'</div>' +
		'</div>' +
		(produto.descricao ? `<p class="rs-detalhes-descricao">${escapeHtml(produto.descricao)}</p>` : '') +
		(conteudo ? `<h4 class="rs-detalhes-sub">Conteúdo</h4><ul class="rs-conteudo">${conteudo}</ul>` : '') +
		'<div class="rs-detalhes-rodape">' +
		`<div class="rs-detalhes-preco"><span>Preço</span>${precoHtml(produto.precoMinor, 'rs-preco rs-preco--total')}</div>` +
		(trava ? '' : `<p class="rs-detalhes-limite">Até ${teto} por compra</p>`) +
		acao +
		'</div>' +
		'</div>'
	);
}

/**
 * O MODAL DE CHECKOUT em quatro fases:
 * - 'confirmar': Saldo atual / Total da compra / Saldo apos + Confirmar;
 * - 'enviando': o mesmo quadro, botoes travados;
 * - 'sucesso' e 'erro': o `texto` do SERVIDOR, nunca reescrito aqui.
 */
export function checkoutHtml(fase, resumo, resultado) {
	if (fase === 'sucesso' || fase === 'erro') {
		const ok = fase === 'sucesso';
		const pedido = (resultado && resultado.pedido) || null;
		const saldoDepois = pedido && ehMinor(pedido.saldoDepoisMinor) ? pedido.saldoDepoisMinor : null;
		const texto =
			String((resultado && resultado.texto) || '').trim() ||
			(ok ? 'Compra concluída.' : 'Não foi possível concluir a compra.');
		return (
			`<div class="rs-checkout rs-checkout--${ok ? 'sucesso' : 'erro'}">` +
			`<span class="rs-checkout-marca" aria-hidden="true">${ok ? '&#10003;' : '!'}</span>` +
			`<p class="rs-checkout-texto">${escapeHtml(texto)}</p>` +
			(ok && saldoDepois !== null
				? `<div class="rs-total-linha rs-total-linha--saldo"><span>Saldo agora</span>${precoHtml(saldoDepois, 'rs-preco rs-preco--total')}</div>`
				: '') +
			'<div class="rs-checkout-acoes">' +
			`<button type="button" class="rs-btn${ok ? '' : ' rs-btn--sec'}" data-rs="fechar-checkout">${ok ? 'Continuar comprando' : 'Voltar ao carrinho'}</button>` +
			'</div>' +
			'</div>'
		);
	}
	const enviando = fase === 'enviando';
	const linhas = resumo.linhas
		.map(
			l =>
				'<li class="rs-checkout-linha">' +
				`<span>${escapeHtml(l.quantidade)}x ${escapeHtml(l.produto.nome)}</span>` +
				`<span>${escapeHtml(formatarRoCash(l.totalMinor))}</span>` +
				'</li>'
		)
		.join('');
	return (
		'<div class="rs-checkout">' +
		`<ul class="rs-checkout-linhas">${linhas}</ul>` +
		'<div class="rs-checkout-conta">' +
		`<div class="rs-total-linha rs-total-linha--saldo"><span>Saldo atual</span><span>${escapeHtml(formatarRoCash(resumo.saldoMinor))}</span></div>` +
		`<div class="rs-total-linha rs-total-linha--compra"><span>Total da compra</span><span>- ${escapeHtml(formatarRoCash(resumo.totalMinor))}</span></div>` +
		`<div class="rs-total-linha rs-total-linha--apos${resumo.saldoInsuficiente ? ' is-negativo' : ''}"><span>Saldo após</span>${precoHtml(resumo.saldoAposMinor, 'rs-preco rs-preco--total')}</div>` +
		'</div>' +
		'<p class="rs-checkout-nota">O servidor confere preço e saldo de novo na hora da compra.</p>' +
		'<div class="rs-checkout-acoes">' +
		`<button type="button" class="rs-btn rs-btn--sec" data-rs="fechar-checkout"${enviando ? ' disabled' : ''}>Cancelar</button>` +
		`<button type="button" class="rs-btn rs-btn--ouro" data-rs="confirmar"${enviando ? ' disabled' : ''}>${enviando ? 'Processando...' : 'Confirmar compra'}</button>` +
		'</div>' +
		'</div>'
	);
}

/** O texto da recarga: o do servidor, ou a reserva quando ele veio vazio. */
export function textoDaRecarga(estado) {
	const recarga = (estado && estado.recarga) || {};
	return String(recarga.texto || '').trim() || 'A recarga de RO Cash ainda não está disponível.';
}

/**
 * "Season 1" a partir do `temporada.id` do servidor ("S1", CONTRATO.md secao 4:
 * `{ id: "S1", nome: "Luz & Trevas", fase }`, com a nota "o banner 'Season 1 -
 * Luz & Trevas' monta daqui"). O NUMERO vem do id - a mesma leitura do banner
 * da janela da Temporada (`formatoDaTemporada.js#renderBannerHtml`) -, e um id
 * fora do formato `S<n>` devolve vazio: o banner fica so com o nome, e nunca
 * com um "Season 1" cravado (rodada 3, achado A-04 da QA).
 */
export function rotuloDaTemporada(temporada) {
	const id = String((temporada && temporada.id) || '').trim();
	const m = id.match(/^S(\d{1,3})$/i);
	return m ? `Season ${Number(m[1])}` : '';
}

/**
 * O ATALHO para a Temporada (D-RS-04): um banner discreto que SO navega. O
 * nome vem do servidor (`temporada.nome`); com `temporada: null` o banner
 * SOME (CONTRATO.md secao 6: "esconda quando null") - nunca um nome inventado.
 */
export function atalhoTemporadaHtml(temporada) {
	const nome = String((temporada && temporada.nome) || '').trim();
	if (!nome) {
		return '';
	}
	const rotulo = rotuloDaTemporada(temporada);
	/* Um servidor que ja mande "Season 1 - ..." no nome nao ganha dois. */
	const titulo = rotulo && !/^season\b/i.test(nome) ? `${rotulo} - ${nome}` : nome;
	return (
		'<div class="rs-temporada">' +
		'<span class="rs-temporada-texto">' +
		`<strong class="rs-temporada-nome">${escapeHtml(titulo)}</strong>` +
		'<span class="rs-temporada-sub">Caixas, Battle Pass e VIP estão no menu Temporada.</span>' +
		'</span>' +
		'<button type="button" class="rs-btn rs-btn--sec rs-btn--pequeno" data-rs="ir-temporada">Ir para Temporada</button>' +
		'</div>'
	);
}

/* ------------------------------------------------------------------ */
/* Servicos por credito (CONTRATO.md secoes 3 e 4: `servicos[]` e a     */
/* acao `usar-servico`)                                                */
/* ------------------------------------------------------------------ */

/**
 * Os servicos da conta que TEM credito para usar. Comprar "Reset de Skills"
 * entrega um CREDITO (`entrega: "credito"`), nao o reset: sem esta lista o
 * jogador pagaria e nao teria onde usar. A linha so existe com `creditos > 0`;
 * `usavel` e o veredito do servidor (hoje so os dois resets tem efeito).
 */
export function servicosComCredito(estado) {
	return ((estado && estado.servicos) || []).filter(
		s => s && typeof s.servico === 'string' && Number.isInteger(s.creditos) && s.creditos > 0
	);
}

/** Um servico da lista pelo id (`reset-de-skills`), ou null. */
export function servicoPorId(estado, id) {
	return ((estado && estado.servicos) || []).find(s => s && s.servico === id) || null;
}

/**
 * A categoria-CASA de um servico: a do produto do SKU dele (os resets moram em
 * Utilidades, as trocas em Conta - secao 7 do contrato). Sem o produto no
 * estado, Utilidades.
 */
export function categoriaDoServico(estado, servico) {
	const produto = servico && servico.sku ? produtoPorSku(estado, servico.sku) : null;
	return normalizar((produto && produto.categoria) || 'utilidades');
}

/**
 * "Seus servicos": uma linha por credito, com o botao Usar (desligado quando
 * `usavel: false`). Com `categoria`, so os servicos que moram nela - o credito
 * aparece onde o jogador o comprou.
 */
export function servicosHtml(estado, categoria = null) {
	const alvo = categoria ? normalizar(categoria) : null;
	const lista = servicosComCredito(estado).filter(s => !alvo || categoriaDoServico(estado, s) === alvo);
	if (!lista.length) {
		return '';
	}
	const linhas = lista
		.map(
			s =>
				'<li class="rs-servico">' +
				'<span class="rs-servico-texto">' +
				`<span class="rs-servico-nome">${escapeHtml(s.nome || s.servico)}</span>` +
				`<span class="rs-servico-creditos">${escapeHtml(s.creditos)} ${s.creditos === 1 ? 'crédito' : 'créditos'}</span>` +
				'</span>' +
				`<button type="button" class="rs-btn rs-btn--pequeno" data-rs="usar-servico" data-servico="${escapeHtml(s.servico)}"${s.usavel === true ? '' : ' disabled title="Ainda não pode ser usado"'}>Usar</button>` +
				'</li>'
		)
		.join('');
	return (
		'<section class="rs-servicos">' +
		'<h4 class="rs-servicos-titulo">Seus serviços</h4>' +
		`<ul class="rs-servicos-lista">${linhas}</ul>` +
		'</section>'
	);
}

/* ------------------------------------------------------------------ */
/* Servicos que pedem dados (rodada 2, decisoes do dono de 22/09/2026)  */
/* ------------------------------------------------------------------ */

export const SERVICO_TROCA_DE_NOME = 'troca-de-nome';
export const SERVICO_TROCA_DE_APARENCIA = 'troca-de-aparencia';

/**
 * O SEXO no fio (CONTRATO.md secao 3): 0 feminino, 1 masculino - o mesmo numero
 * do char-server (`sexo` do CH_MAKE_CHAR3, `Session.Sex`).
 */
export const SEXOS = [
	{ valor: 1, rotulo: 'Masculino' },
	{ valor: 0, rotulo: 'Feminino' }
];

/** O aviso fixo da troca de aparencia (as regras da secao 3 do contrato). */
export const AVISO_DA_APARENCIA =
	'Bardo, Odalisca, Menestrel e Cigana não trocam de sexo. A peça vestida que o novo sexo não usa é desequipada e fica na mochila.';

/**
 * As FAIXAS de um servico: as do servidor (`servicos[].limites`, CONTRATO.md
 * secao 4) e, na falta delas, as que o mesmo contrato documenta (nome 4 a 23,
 * cabelo 0 a 27, cor 0 a 8, sexo 0/1). Nenhuma faixa daqui e inventada: sao as
 * duas fontes do contrato, e quem decide de verdade e o servidor.
 */
export function limitesDoServico(servico) {
	const l = (servico && servico.limites) || {};
	const faixa = (f, min, max) =>
		f && Number.isInteger(f.min) && Number.isInteger(f.max) && f.min <= f.max
			? { min: f.min, max: f.max }
			: { min, max };
	const sexo = l.sexo && typeof l.sexo === 'object' ? l.sexo : null;
	const valores = sexo && Array.isArray(sexo.valores) ? sexo.valores : null;
	return {
		novoNome: faixa(l.novoNome, 4, 23),
		cabelo: faixa(l.cabelo, 0, 27),
		corDoCabelo: faixa(l.corDoCabelo, 0, 8),
		sexos: valores ? SEXOS.filter(s => valores.indexOf(s.valor) !== -1) : SEXOS,
		/* A classe do personagem LOGADO nao troca de sexo (Bardo, Odalisca...). */
		sexoFixo: !!(sexo && sexo.fixo === true)
	};
}

/** Os campos de um formulario de servico, vazios (nada escolhido). */
export function camposIniciaisDoServico(id) {
	if (id === SERVICO_TROCA_DE_NOME) {
		return { novoNome: '' };
	}
	if (id === SERVICO_TROCA_DE_APARENCIA) {
		return { sexo: null, cabelo: '', corDoCabelo: '' };
	}
	return {};
}

/**
 * O nome como o servidor o ve (CONTRATO.md secao 3: "pontas aparadas, espacos
 * repetidos viram um"). O cliente manda ja normalizado, e conta o tamanho
 * sobre o mesmo texto que o servidor vai contar.
 */
export function normalizarNome(texto) {
	return String(texto == null ? '' : texto)
		.trim()
		.replace(/ {2,}/g, ' ');
}

/** Quantos CARACTERES (e nao unidades UTF-16) tem um texto. */
function tamanhoDoTexto(texto) {
	return [...String(texto)].length;
}

/** Um campo numerico opcional: '' = manter; senao inteiro >= 0. */
function lerNumeroOpcional(valor) {
	const t = String(valor == null ? '' : valor).trim();
	if (!t) {
		return { vazio: true };
	}
	if (!/^\d+$/.test(t)) {
		return { invalido: true };
	}
	return { numero: Number(t) };
}

/**
 * Os `parametros` do pedido `usar-servico`, a partir do que o jogador
 * preencheu. Devolve `{ ok: true, parametros }` (null para servico sem dados)
 * ou `{ ok: false, erro }` com a frase para a tela.
 *
 * So o BASICO e conferido aqui (tarefa do dono: "valide so o basico no
 * cliente, o servidor decide"): tamanho do nome e as faixas que o servidor
 * mandou. Nome em uso, caractere recusado e classe de sexo fixo sao veredito
 * do servidor, que volta no `texto` e em `parametrosRecusados`.
 *
 * O pedido so leva o que o jogador ESCOLHEU: na aparencia, campo vazio e
 * "manter" e nao entra - o servidor nunca recebe um valor que ninguem pediu.
 */
export function parametrosDoServico(id, campos, servico = null) {
	const c = campos || {};
	const lim = limitesDoServico(servico);
	if (id === SERVICO_TROCA_DE_NOME) {
		const nome = normalizarNome(c.novoNome);
		const n = tamanhoDoTexto(nome);
		if (n < lim.novoNome.min || n > lim.novoNome.max) {
			return {
				ok: false,
				erro: `O nome precisa ter de ${lim.novoNome.min} a ${lim.novoNome.max} caracteres.`
			};
		}
		return { ok: true, parametros: { novoNome: nome } };
	}
	if (id === SERVICO_TROCA_DE_APARENCIA) {
		const parametros = {};
		if (c.sexo !== null && c.sexo !== undefined && c.sexo !== '') {
			const sexo = Number(c.sexo);
			if (lim.sexoFixo || !lim.sexos.some(s => s.valor === sexo)) {
				return { ok: false, erro: 'Este personagem não pode trocar de sexo.' };
			}
			parametros.sexo = sexo;
		}
		for (const [campo, rotulo] of [
			['cabelo', 'O estilo de cabelo'],
			['corDoCabelo', 'A cor do cabelo']
		]) {
			const lido = lerNumeroOpcional(c[campo]);
			const f = lim[campo];
			if (lido.invalido || (!lido.vazio && (lido.numero < f.min || lido.numero > f.max))) {
				return { ok: false, erro: `${rotulo} vai de ${f.min} a ${f.max}.` };
			}
			if (!lido.vazio) {
				parametros[campo] = lido.numero;
			}
		}
		if (!Object.keys(parametros).length) {
			return { ok: false, erro: 'Escolha pelo menos uma mudança.' };
		}
		return { ok: true, parametros };
	}
	return { ok: true, parametros: null };
}

/**
 * A frase de cada motivo de `parametrosRecusados` (CONTRATO.md secao 4), para
 * mostrar EMBAIXO do campo quando o jogador volta para corrigir. O `texto` do
 * servidor continua sendo a frase principal da recusa; isto so diz QUAL campo.
 */
const FRASE_DO_CAMPO_RECUSADO = {
	novoNome: {
		ausente: 'Digite um nome.',
		vazio: 'Digite um nome.',
		curto: 'Nome curto demais.',
		longo: 'Nome longo demais.',
		'caractere-invalido': 'O nome tem um caractere que não pode ser usado.',
		'em-uso': 'Este nome já está em uso.',
		'igual-ao-atual': 'Este já é o nome do personagem.'
	},
	sexo: {
		invalido: 'Escolha Masculino ou Feminino.',
		'classe-de-sexo-fixo': 'A classe deste personagem não troca de sexo.'
	},
	cabelo: { 'fora-da-faixa': 'Fora da faixa permitida.' },
	corDoCabelo: { 'fora-da-faixa': 'Fora da faixa permitida.' },
	parametros: { ausente: 'Escolha pelo menos uma mudança.' }
};

/** A frase do motivo recusado de um campo, ou '' (motivo desconhecido = sem frase inventada). */
export function fraseDoCampoRecusado(campo, motivo) {
	const tabela = FRASE_DO_CAMPO_RECUSADO[campo];
	return (tabela && tabela[String(motivo || '')]) || '';
}

function erroDoCampoHtml(recusados, campo) {
	const frase = recusados ? fraseDoCampoRecusado(campo, recusados[campo]) : '';
	return frase ? `<p class="rs-campo-erro" data-rs-erro="${campo}">${escapeHtml(frase)}</p>` : '';
}

/**
 * O formulario do servico (so os que pedem dados; os resets nao tem). O
 * personagem LOGADO (`estado.personagem`) aparece como referencia: o nome
 * atual, o sexo marcado "(atual)" e os numeros de cabelo e cor no lugar do
 * "Manter".
 */
function formularioDoServicoHtml(id, extra, enviando) {
	const c = (extra && extra.campos) || {};
	const servico = (extra && extra.servico) || null;
	const personagem = (extra && extra.personagem) || null;
	const recusados = (extra && extra.recusados) || null;
	const lim = limitesDoServico(servico);
	const desliga = enviando ? ' disabled' : '';
	if (id === SERVICO_TROCA_DE_NOME) {
		const atual = personagem && typeof personagem.nome === 'string' ? personagem.nome : '';
		const invalido = recusados && recusados.novoNome ? ' is-invalido' : '';
		return (
			'<div class="rs-form">' +
			(atual ? `<p class="rs-campo-atual">Nome atual: <strong>${escapeHtml(atual)}</strong></p>` : '') +
			'<label class="rs-campo">' +
			'<span class="rs-campo-rotulo">Novo nome</span>' +
			`<input type="text" class="rs-campo-texto ri-input${invalido}" data-rs-campo="novoNome" maxlength="${lim.novoNome.max}" autocomplete="off" autocapitalize="off" spellcheck="false" value="${escapeHtml(c.novoNome || '')}"${desliga}>` +
			'</label>' +
			erroDoCampoHtml(recusados, 'novoNome') +
			`<p class="rs-campo-dica">De ${lim.novoNome.min} a ${lim.novoNome.max} caracteres. O servidor confere se o nome está livre, e um nome recusado não gasta o crédito.</p>` +
			'</div>'
		);
	}
	if (id === SERVICO_TROCA_DE_APARENCIA) {
		const sexoAtual = personagem && Number.isInteger(personagem.sexo) ? personagem.sexo : null;
		/* "Manter" = nada escolhido. Cuidado: `Number(null)` e 0, o FEMININO - a
		   prova de tela pegou as duas opcoes marcadas juntas. */
		const semSexo = c.sexo === null || c.sexo === undefined || c.sexo === '';
		const opcaoDeSexo = (valor, rotulo) => {
			const ativo = valor === null ? semSexo : !semSexo && Number(c.sexo) === valor;
			const travada = valor !== null && lim.sexoFixo;
			/* "atual" numa segunda linha: "Masculino (atual)" nao cabia na
			   coluna de 1/3 (prova de tela, 390 e 1440 - texto cortado). */
			const atual = valor !== null && valor === sexoAtual ? '<span class="rs-opcao-atual">atual</span>' : '';
			return `<button type="button" class="rs-opcao${ativo ? ' is-ativa' : ''}" data-rs="aparencia-sexo" data-valor="${valor === null ? '' : valor}" aria-pressed="${ativo ? 'true' : 'false'}"${enviando || travada ? ' disabled' : ''}><span class="rs-opcao-rotulo">${escapeHtml(rotulo)}</span>${atual}</button>`;
		};
		const numero = (campo, rotulo) => {
			const f = lim[campo];
			const atual = personagem && Number.isInteger(personagem[campo]) ? personagem[campo] : null;
			const invalido = recusados && recusados[campo] ? ' is-invalido' : '';
			return (
				'<label class="rs-campo rs-campo--numero">' +
				`<span class="rs-campo-rotulo">${escapeHtml(rotulo)} <span class="rs-campo-faixa">${f.min} a ${f.max}</span></span>` +
				`<input type="text" inputmode="numeric" pattern="[0-9]*" class="rs-campo-texto ri-input${invalido}" data-rs-campo="${campo}" maxlength="${String(f.max).length}" placeholder="${atual === null ? 'Manter' : `Atual: ${atual}`}" autocomplete="off" value="${escapeHtml(c[campo] == null ? '' : c[campo])}"${desliga}>` +
				'</label>'
			);
		};
		return (
			'<div class="rs-form">' +
			'<div class="rs-campo-grupo" role="group" aria-label="Sexo">' +
			'<span class="rs-campo-rotulo">Sexo</span>' +
			'<div class="rs-opcoes">' +
			opcaoDeSexo(null, 'Manter') +
			lim.sexos.map(s => opcaoDeSexo(s.valor, s.rotulo)).join('') +
			'</div>' +
			(lim.sexoFixo ? '<p class="rs-campo-dica">A classe deste personagem não troca de sexo.</p>' : '') +
			erroDoCampoHtml(recusados, 'sexo') +
			'</div>' +
			'<div class="rs-campos-lado">' +
			numero('cabelo', 'Estilo de cabelo') +
			numero('corDoCabelo', 'Cor do cabelo') +
			'</div>' +
			erroDoCampoHtml(recusados, 'cabelo') +
			erroDoCampoHtml(recusados, 'corDoCabelo') +
			erroDoCampoHtml(recusados, 'parametros') +
			'<p class="rs-campo-dica">Deixe em branco o que não quiser mudar.</p>' +
			`<p class="rs-campo-aviso">${escapeHtml(AVISO_DA_APARENCIA)}</p>` +
			'</div>'
		);
	}
	return '';
}

/**
 * O modal de USO de um servico: confirmar (o credito vai para o PERSONAGEM
 * LOGADO - o contrato manda assim), enviando, e o `texto` do servidor no fim.
 *
 * Troca de Nome e Troca de Aparencia pedem dados antes: o formulario mora
 * aqui, e o "Usar agora" so acende quando `parametrosDoServico` aceita. No
 * fim:
 *  - `requerRelog: true` vira o aviso de que a mudanca aparece ao entrar de
 *    novo (o nome e o visual sao lidos na entrada do personagem);
 *  - `desequipados` (a troca de sexo) lista o que saiu do corpo e ficou na
 *    mochila;
 *  - uma recusa com formulario oferece "Corrigir e tentar de novo", e o campo
 *    recusado (`parametrosRecusados`) ganha a frase dele.
 *
 * @param {object} [extra] - `{ campos, personagem, recusados }`
 */
export function usoDeServicoHtml(fase, servico, resultado, extra = null) {
	const nome = (servico && (servico.nome || servico.servico)) || 'serviço';
	const id = servico && servico.servico;
	const temFormulario = id === SERVICO_TROCA_DE_NOME || id === SERVICO_TROCA_DE_APARENCIA;
	if (fase === 'sucesso' || fase === 'erro') {
		const ok = fase === 'sucesso';
		const texto =
			String((resultado && resultado.texto) || '').trim() ||
			(ok ? `${nome} aplicado.` : 'Não foi possível usar o serviço.');
		const restantes =
			resultado && Number.isInteger(resultado.creditosRestantes) ? resultado.creditosRestantes : null;
		const relog = ok && resultado && resultado.requerRelog === true;
		const desequipados =
			ok && resultado && Array.isArray(resultado.desequipados)
				? resultado.desequipados.filter(d => d && typeof d.nome === 'string' && d.nome)
				: [];
		return (
			`<div class="rs-checkout rs-checkout--${ok ? 'sucesso' : 'erro'}">` +
			`<span class="rs-checkout-marca" aria-hidden="true">${ok ? '&#10003;' : '!'}</span>` +
			`<p class="rs-checkout-texto">${escapeHtml(texto)}</p>` +
			(desequipados.length
				? '<div class="rs-desequipados"><p class="rs-desequipados-titulo">Guardado na mochila:</p><ul>' +
					desequipados.map(d => `<li>${escapeHtml(d.nome)}</li>`).join('') +
					'</ul></div>'
				: '') +
			(relog
				? '<p class="rs-relog" role="status"><strong>A mudança aparece quando você entrar de novo.</strong> Volte à seleção de personagem e entre outra vez com ele.</p>'
				: '') +
			(ok && restantes !== null
				? `<p class="rs-checkout-nota">${escapeHtml(restantes)} ${restantes === 1 ? 'crédito restante' : 'créditos restantes'}</p>`
				: '') +
			'<div class="rs-checkout-acoes">' +
			`<button type="button" class="rs-btn${ok ? '' : ' rs-btn--sec'}" data-rs="fechar-servico">Fechar</button>` +
			(!ok && temFormulario
				? '<button type="button" class="rs-btn rs-btn--ouro" data-rs="voltar-servico">Corrigir e tentar de novo</button>'
				: '') +
			'</div>' +
			'</div>'
		);
	}
	const enviando = fase === 'enviando';
	const campos = extra && extra.campos;
	const form = formularioDoServicoHtml(id, { ...(extra || {}), servico }, enviando);
	const valido = parametrosDoServico(id, campos, servico).ok;
	return (
		`<div class="rs-checkout${form ? ' rs-checkout--form' : ''}">` +
		`<p class="rs-checkout-texto">Usar 1 crédito de <strong>${escapeHtml(nome)}</strong> no personagem conectado agora?</p>` +
		form +
		'<p class="rs-checkout-nota">O serviço vale para o personagem conectado.</p>' +
		'<div class="rs-checkout-acoes">' +
		`<button type="button" class="rs-btn rs-btn--sec" data-rs="fechar-servico"${enviando ? ' disabled' : ''}>Cancelar</button>` +
		`<button type="button" class="rs-btn rs-btn--ouro" data-rs="confirmar-servico"${enviando || !valido ? ' disabled' : ''}>${enviando ? 'Processando...' : 'Usar agora'}</button>` +
		'</div>' +
		'</div>'
	);
}

/* ------------------------------------------------------------------ */
/* Contadores da conta ("X de Y")                                       */
/* ------------------------------------------------------------------ */

/** Inteiro >= 0 do servidor, ou null (nunca um numero adivinhado). */
function inteiroDoServidor(v) {
	return Number.isInteger(v) && v >= 0 ? v : null;
}

/**
 * O "X de Y" de uma carta de conta, lido de `estado.conta` (o bloco aditivo
 * da rodada 2: `armazem`, `slots`, `carga`). SO exibicao: nada aqui e
 * calculado alem de juntar os dois numeros que o servidor mandou, e sem os
 * dois a carta fica sem contador.
 *
 * O vinculo SKU -> bloco e o da tabela da secao 7 do contrato.
 */
export function contadorDaConta(produto, estado) {
	const conta = (estado && estado.conta) || {};
	const sku = produto && produto.sku;
	const par = (bloco, campoX, campoY) => {
		if (!bloco || typeof bloco !== 'object') {
			return null;
		}
		const x = inteiroDoServidor(bloco[campoX]);
		const y = inteiroDoServidor(bloco[campoY]);
		return x === null || y === null || y === 0 ? null : { x, y };
	};
	if (sku === 'ACCOUNT_STORAGE_100') {
		const p = par(conta.armazem, 'expansoes', 'teto');
		return p ? { ...p, texto: `${p.x} de ${p.y} expansões` } : null;
	}
	if (sku === 'ACCOUNT_INVENTORY_10') {
		const p = par(conta.carga, 'expansoes', 'teto');
		return p ? { ...p, texto: `${p.x} de ${p.y} expansões` } : null;
	}
	if (sku === 'ACCOUNT_CHARACTER_SLOT') {
		const p = par(conta.slots, 'total', 'teto');
		return p ? { ...p, texto: `${p.x} de ${p.y} vagas` } : null;
	}
	return null;
}

/** O contador como etiqueta de carta (vazio quando nao ha). */
export function contadorDaContaHtml(produto, estado, classe = 'rs-contador') {
	const c = contadorDaConta(produto, estado);
	if (!c) {
		return '';
	}
	return `<span class="${classe}${c.x >= c.y ? ' is-no-teto' : ''}">${escapeHtml(c.texto)}</span>`;
}

/** O texto de uma recusa do carrinho (local, antes de falar com o servidor). */
export function textoDaRecusa(recusa, produto) {
	if (recusa === 'teto') {
		return `Limite de ${tetoDoProduto(produto)} por compra para ${produto ? produto.nome : 'este item'}.`;
	}
	if (recusa === 'cheio') {
		return 'O carrinho está cheio. Conclua ou remova um item.';
	}
	if (recusa === 'indisponivel') {
		const trava = travaDoProduto(produto);
		return trava ? trava.texto : 'Indisponível no momento';
	}
	return '';
}
