/**
 * HA ALGO PARA COLETAR? (16/09/2026, D-1525 do servidor) — pedido do dono: *"o
 * botao 'coletar todos os itens' so esteja disponivel quando realmente tiver
 * algum item para ser colhido no correio"*.
 *
 * O servidor passou a mandar o TIPO da carta na lista, como o rAthena
 * (`clif_Mail_refreshinbox`, clif.cpp:16205-16228): `MAIL_TYPE_ZENY` 0x2 e
 * `MAIL_TYPE_ITEM` 0x4 enquanto o anexo nao foi retirado. "Coletar todos" leva
 * item E zeny, entao qualquer um dos dois acende o botao.
 */

export const TIPO_ZENY = 0x2;
export const TIPO_ITEM = 0x4;

/** @param {Array<{type?: number}>} lista */
export function temAnexoParaColetar(lista) {
	return Array.isArray(lista) && lista.some(c => ((Number(c && c.type) | 0) & (TIPO_ZENY | TIPO_ITEM)) !== 0);
}

/**
 * A retirada avulsa apaga o bit na lista local — senao o botao ficaria aceso
 * ate a proxima lista chegar.
 */
export function semOBit(tipo, bit) {
	return (Number(tipo) | 0) & ~bit;
}
