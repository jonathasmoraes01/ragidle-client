/**
 * UI/Components/Storage/retiradaDoArmazem.js
 *
 * AS TRES REGRAS DE TIRAR UMA PECA DO ARMAZEM (D-991, 09/09/2026).
 *
 * ── O defeito que este arquivo existe para nao voltar ────────────────────
 * O armazem tinha DOIS caminhos de retirada, e os dois morreram na mesma
 * pedra: ambos exigiam que a janela NATIVA de inventario estivesse visivel.
 *
 *   1. arrastar do armazem ate a janela `Inventory` (o `onDrop` dela,
 *      InventoryCommon.js, aceita `from: 'Storage'`);
 *   2. `transferItemToOtherUI`, que so pedia a retirada dentro de
 *      `if (Inventory.getUI().ui.is(':visible'))`.
 *
 * So que neste fork a janela de inventario do jogo e a `MochilaIdle`, e ela
 * mantem o host nativo em `display:none` PERMANENTE: esconde no `onAppend` e
 * REPOE o `display:none` a cada 250 ms no proprio polling
 * (`hideNativeHosts`). O shim de `is(':visible')` responde
 * `host.style.display !== 'none' && host.offsetParent !== null`
 * (GUIComponent.js), entao aquele teste era FALSO SEMPRE.
 *
 * Resultado medido: caminho 1 sem alvo na tela (a `MochilaIdle` so aceitava
 * no `drop` da grade o arrasto de tirar equipamento) e caminho 2 caindo no
 * `else if` do carrinho - que tambem estava fechado - e saindo sem pedir
 * nada. Nenhum erro, nenhum log: o jogador clicava e o armazem nao devolvia.
 *
 * ── Por que as regras moram AQUI, e nao dentro das janelas ───────────────
 * As tres decisoes abaixo sao as unicas coisas que o defeito errou, e as
 * tres sao puras. Dentro do closure de `createStorage` elas ficariam
 * inalcancaveis para a prova - foi exatamente por ficarem inalcancaveis que
 * a condicao morta atravessou tanto tempo sem ninguem medir.
 *
 * Os DOIS lados chamam este modulo: `StorageCommon.js` (menu do item e
 * `transferItemToOtherUI`) e `MochilaIdle.js` (o drop na grade).
 */

/** A peca volta para o corpo do personagem (o padrao). */
export const CORPO = 'corpo';

/** A peca vai para o carrinho, quando e ELE que esta na tela. */
export const CARRINHO = 'carrinho';

/**
 * Para onde vai a peca que sai do armazem.
 *
 * O CORPO E O PADRAO, e nao um fallback: o servidor aceita
 * `CZ_MOVE_ITEM_FROM_STORE_TO_BODY` com o armazem aberto olhando peso e
 * posicao (`servidor-mapa.ts`), nunca que janela o cliente pintou. A
 * visibilidade so decide UMA coisa de verdade - se o jogador esta com o
 * carrinho aberto, e portanto se e para la que ele quer mandar.
 *
 * @param {{carrinhoAberto?: boolean, inventarioNativoAberto?: boolean}} tela
 * @returns {string} CORPO ou CARRINHO
 */
export function destinoDaRetirada(tela) {
	const { carrinhoAberto = false, inventarioNativoAberto = false } = tela || {};
	return carrinhoAberto && !inventarioNativoAberto ? CARRINHO : CORPO;
}

/**
 * Este arrasto veio do armazem?
 *
 * O contrato e o global `window._OBJ_DRAG_` que `StorageCommon.onItemDragStart`
 * escreve (o MESMO objeto que vai em `dataTransfer` como texto). A checagem
 * exige o `data` dentro: um payload sem item derrubaria o `item.index` do
 * chamador, e ele chega de fora (outra janela pode escrever no global).
 *
 * @param {unknown} data - o `_OBJ_DRAG_` ou o JSON do `dataTransfer`
 */
export function ehArrastoDoArmazem(data) {
	return (
		!!data &&
		typeof data === 'object' &&
		data.type === 'item' &&
		data.from === 'Storage' &&
		!!data.data &&
		typeof data.data === 'object'
	);
}

/**
 * Quantas unidades a retirada pede, a partir do que o jogador digitou.
 *
 * Devolve `null` quando nao ha nada a pedir - e `null` e uma RECUSA, nao um
 * zero: o servidor ignora em silencio `quantidade < 1` e `quantidade` acima
 * da pilha (`CZ_MOVE_ITEM_FROM_STORE_TO_BODY`, `servidor-mapa.ts`), entao um
 * pedido invalido saindo daqui viraria de novo um clique que nao faz nada -
 * a assinatura exata do defeito que este arquivo fecha. Melhor nao mandar.
 *
 * O teto e a propria pilha porque o cliente ja sabe o tamanho dela (veio no
 * `ZC_ADD_ITEM_TO_STORE`/lista do armazem): pedir 999 de uma pilha de 3 nao
 * e um pedido de 3, e um engano.
 *
 * @param {unknown} entrada - o texto do InputBox (ou um numero)
 * @param {number} total - o tamanho da pilha no armazem
 * @returns {number|null}
 */
export function quantidadeDaRetirada(entrada, total) {
	const teto = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
	if (teto < 1) {
		return null;
	}
	const pedido = parseInt(entrada, 10);
	if (!Number.isFinite(pedido) || pedido < 1 || pedido > teto) {
		return null;
	}
	return pedido;
}
