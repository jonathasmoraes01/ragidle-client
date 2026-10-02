/**
 * UI/Components/CartItems/transferenciaDoCarrinho.js
 *
 * AS REGRAS DE POR E TIRAR ITEM DO CARRINHO (D-1848, 30/09/2026).
 *
 * Ordem do dono: *"Verifique se e possivel adicionar itens no carrinho do
 * mercador. Se nao for possivel, implemente/corrija isso imediatamente, tanto
 * no desktop como no mobile."*
 *
 * ── O que estava quebrado (MEDIDO no jogo, com um Mercador com carrinho) ──
 *
 *   1. Nao havia PORTA na HUD para abrir o carrinho. So o atalho nativo
 *      Alt+W, que ninguem conhece e que nao existe no celular.
 *   2. O menu do item da Mochila nao tinha "Por no carrinho".
 *   3. O ARRASTO Mochila -> carrinho morria no `dragover` do carrinho, que
 *      so fazia `stopImmediatePropagation` — sem `preventDefault` o navegador
 *      nunca dispara o `drop`. O porte de jQuery para JS puro perdeu a metade
 *      do `return false` (que no jQuery e as DUAS coisas).
 *   4. Tirar do carrinho: o botao direito so abria a ficha; o duplo clique
 *      chamava `CartItems.useItem`, que NAO EXISTE (TypeError); arrastar ate a
 *      Mochila nao tinha alvo (a grade so aceitava o armazem); e o Alt+botao
 *      direito exigia a janela NATIVA de inventario visivel — a mesma pedra do
 *      armazem em D-991 (`retiradaDoArmazem.js`).
 *   5. No celular, nenhum dos caminhos existia: arrasto HTML5 nao existe no
 *      toque (D-938).
 *
 * As decisoes abaixo sao puras de proposito — dentro das janelas elas ficam
 * inalcancaveis para a prova, e foi exatamente por isso que o armazem passou
 * semanas com a retirada morta sem ninguem medir.
 *
 * A quantidade reusa as regras do armazem (`retiradaDoArmazem.js`): de 1 ate
 * a pilha, com o teto do peso livre de quem recebe, e `null` como RECUSA — o
 * servidor ignora pedido fora da pilha, e um pedido invalido saindo daqui
 * viraria de novo um clique que nao faz nada.
 */

/** A peca que sai do carrinho vai para o corpo (o padrao). */
export const PARA_O_CORPO = 'corpo';
/** ...ou para o armazem, quando e ELE que esta aberto (o Alt+botao direito do RO). */
export const PARA_O_ARMAZEM = 'armazem';

/**
 * O personagem tem carrinho? A mesma pergunta que o cliente ja faz ao abrir a
 * janela (`Session.Entity.hasCart`, ligado pelo EFST `ON_PUSH_CART`).
 *
 * @param {{hasCart?: boolean}|null|undefined} entidade
 * @returns {boolean}
 */
export function temCarrinho(entidade) {
	return !!entidade && entidade.hasCart === true;
}

/**
 * A janela do carrinho esta na tela? O host no documento e sem
 * `display:none` — o criterio que o `onShortCut` nativo ja usava para
 * alternar, e nao o `is(':visible')`, que tambem exige `offsetParent` e
 * responde falso no instante em que a janela e posta de volta.
 *
 * @param {{isConnected?: boolean, style?: {display?: string}}|null|undefined} host
 * @returns {boolean}
 */
export function carrinhoNaTela(host) {
	return !!host && host.isConnected === true && !!host.style && host.style.display !== 'none';
}

/**
 * Este arrasto veio do carrinho? O contrato e o `window._OBJ_DRAG_` que o
 * `dragstart` do carrinho escreve (`from: 'CartItems'`), e o `data` tem de
 * estar dentro — um payload sem item derrubaria o `item.index` de quem chama.
 *
 * @param {unknown} data
 * @returns {boolean}
 */
export function ehArrastoDoCarrinho(data) {
	return (
		!!data &&
		typeof data === 'object' &&
		data.type === 'item' &&
		data.from === 'CartItems' &&
		!!data.data &&
		typeof data.data === 'object'
	);
}

/**
 * Para onde vai a peca que sai do carrinho pelo atalho de transferencia
 * (Alt+botao direito, o gesto do RO original).
 *
 * O CORPO E O PADRAO, como na retirada do armazem: o teste antigo pedia a
 * janela nativa de inventario visivel, e ela nunca esta neste fork.
 *
 * @param {{armazemAberto?: boolean}} tela
 * @returns {string} PARA_O_CORPO ou PARA_O_ARMAZEM
 */
export function destinoDaSaidaDoCarrinho(tela) {
	const { armazemAberto = false } = tela || {};
	return armazemAberto ? PARA_O_ARMAZEM : PARA_O_CORPO;
}

/**
 * O peso livre do carrinho, na unidade do `ZC_NOTIFY_CARTITEM_COUNTINFO`
 * (decigramas, a mesma de `Session.Entity.weight` e de `pesoDeItem`).
 *
 * `null` quando o cliente ainda nao recebeu os contadores — e NAO equivale a
 * zero: zero recusaria tudo por um dado que simplesmente nao chegou.
 *
 * @param {{pesoAtual?: number, pesoMaximo?: number}|null|undefined} info
 * @returns {number|null}
 */
export function pesoLivreDoCarrinho(info) {
	if (!info || typeof info.pesoMaximo !== 'number' || info.pesoMaximo <= 0) {
		return null;
	}
	const atual = typeof info.pesoAtual === 'number' ? info.pesoAtual : 0;
	return Math.max(0, info.pesoMaximo - atual);
}

/**
 * O texto que o jogador LE quando o servidor recusa a guarda no carrinho
 * (`ZC_ACK_ADDITEM_TO_CART`). Os valores sao os da fonte (clif.hpp:851-852):
 * 0 e o peso E o item que nao pode ir (a fonte agrupa os dois, e o cliente
 * nao tem como separar — por isso o texto nomeia as duas causas), 1 e a
 * contagem (sem vaga, ou a pilha que passaria do teto).
 *
 * A linha do chat (msg 220/221 do cliente) continua; esta e a que aparece na
 * JANELA onde o jogador acabou de tocar — no celular o chat nasce minimizado,
 * e a linha sozinha seria uma recusa que ninguem ve.
 *
 * @param {number} resultado
 * @returns {string|null}
 */
export function textoDaGuardaRecusada(resultado) {
	if (resultado === 0) {
		return 'O carrinho recusou: peso demais, ou o item não pode ir para o carrinho.';
	}
	if (resultado === 1) {
		return 'O carrinho está cheio.';
	}
	return null;
}

/**
 * O texto da retirada recusada (o `ZC_ITEM_PICKUP_ACK` com resultado do
 * `pc_additem`, pc.hpp:113-122): 2 e o peso da mochila, 5 a pilha que passaria
 * do teto. O resto e generico, mas nunca mudo.
 *
 * @param {number} resultado
 * @returns {string}
 */
export function textoDaRetiradaRecusada(resultado) {
	if (resultado === 2) {
		return 'A mochila não aguenta esse peso.';
	}
	if (resultado === 5) {
		return 'Essa pilha não cabe na mochila.';
	}
	return 'Não foi possível tirar o item do carrinho.';
}

/**
 * O aviso de quando o jogador digita MAIS do que cabe: sem ele, o `null` da
 * quantidade vira silencio, que e a assinatura do defeito desta entrega.
 *
 * @param {number|null} teto - o maximo que cabe (ja com o peso), ou null
 * @param {string} destino - 'carrinho' ou 'mochila'
 * @returns {string}
 */
export function textoDaQuantidadeRecusada(teto, destino) {
	if (typeof teto === 'number' && teto < 1) {
		return destino === 'carrinho' ? 'Não há peso livre no carrinho.' : 'Não há peso livre na mochila.';
	}
	if (typeof teto === 'number') {
		return `Cabem no máximo ${teto} ${destino === 'carrinho' ? 'no carrinho' : 'na mochila'}.`;
	}
	return 'Quantidade inválida.';
}
