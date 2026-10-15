/**
 * O REENVIO INTEIRO DA MOCHILA E A VERDADE (16/10/2026, relato de producao:
 * "quando ta upando o item pra +1 +2 etc... esta duplicando o item").
 *
 * O servidor manda a mochila INTEIRA entre `ZC_INVENTORY_START` (0x0b08) e
 * `ZC_INVENTORY_END` (0x0b0b), com as listas normal e de equipamento no meio
 * (`enviarInventario`, servidor-mapa.ts) — depois do refino, da troca, da
 * viagem e de dezenas de outros gestos. O cliente tratava cada lista como um
 * acrescimo: `setItems` so troca o que tem o MESMO indice, e nunca tira o que
 * a lista nova deixou de trazer. Todo indice que o servidor parou de usar
 * ficava na mochila como fantasma, e a cada refino a grade ganhava mais um.
 *
 * Este modulo so JUNTA as listas de um reenvio; quem substitui a mochila e
 * `substituirItens` (InventoryCommon.js), chamado UMA vez no END — trocar no
 * meio apagaria os equipamentos que ainda nao chegaram e piscaria a grade.
 *
 * So a mochila (invType 0) passa por aqui. Carrinho e armazem usam os mesmos
 * pacotes com outro invType e seguem pelo caminho de sempre.
 */

export function criarReenvioDoInventario() {
	/** @type {object[]|null} null = nenhum reenvio aberto */
	let aberto = null;

	return {
		/** `ZC_INVENTORY_START` da mochila: um reenvio novo comeca do zero. */
		comecar() {
			aberto = [];
		},

		/** Ha um reenvio aberto esperando o END? */
		estaAberto() {
			return aberto !== null;
		},

		/**
		 * Guarda uma lista (normal ou equip) do reenvio aberto. Devolve false
		 * quando NAO ha reenvio aberto: o chamador aplica a lista na hora, como
		 * antes (servidor que mande lista sem o START/END continua funcionando).
		 */
		receber(itens) {
			if (aberto === null) {
				return false;
			}
			for (let i = 0; i < itens.length; ++i) {
				aberto.push(itens[i]);
			}
			return true;
		},

		/** `ZC_INVENTORY_END`: devolve a mochila inteira, ou null sem START. */
		terminar() {
			const itens = aberto;
			aberto = null;
			return itens;
		}
	};
}

/** A instancia unica do cliente (Item.js junta, Storage.js abre e fecha). */
export const reenvioDoInventario = criarReenvioDoInventario();
