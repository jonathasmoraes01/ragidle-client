/**
 * DB/Items/exclusivosDeVip.js
 *
 * O QUE O PASSE VIP MUDA NUM ITEM — e a legenda que a tela mostra.
 *
 * ## Por que ela mora no CLIENTE, por ID
 *
 * A regra e do servidor: ele e quem aplica a espera menor (`recargaDoItem`,
 * `game/asa-de-mosca-do-dono.ts`) e quem libera o gatilho automatico
 * (`servidor/idle/teleporte.ts`). O cliente so precisa DIZER, antes de o
 * jogador tentar — e para isso ele precisa reconhecer o item.
 *
 * A legenda diz O QUE O PASSE MUDA, e nao "isto e de VIP": o item e de todos.
 * A primeira versao dizia "Exclusivo para VIPs" e virou mentira quando a ordem
 * do dono mudou, alguns minutos depois — uma legenda que descreve o beneficio
 * sobrevive melhor que uma que descreve uma tranca.
 *
 * O cliente nao conhece `aegisName`: a mochila, a dica e a janela de detalhes
 * falam em `ITID`, o id numerico. Entao a lista aqui e por id, do mesmo jeito
 * que `NOMES_LOCAIS` e `ICONES_LOCAIS` ja sao neste diretorio.
 *
 * ## O id nao esta inventado, e ha portao
 *
 * `601` e o `Wing_Of_Fly` do `item_db` do rAthena — a fonte, e nao um chute. E
 * como um numero repetido nas duas pontas apodrece calado, ha um teste do lado
 * do servidor que LE este arquivo e confere o id contra o `item_db`:
 * `servidor/mapa/asa-de-mosca-no-fio.test.ts`. Se o id mudar de um lado, ele
 * reprova nomeando o outro.
 *
 * ## Por que a legenda nao vem na descricao
 *
 * Ela viria — o servidor sabe monta-la (`descricaoComLegenda`). Duas coisas
 * impedem, e as duas sao do fork:
 *
 *  1. a descricao do item vem do GRF, no cliente, e nao passa pelo servidor;
 *  2. a dica da mochila DESCARTA as marcas de cor `^RRGGBB` de proposito (elas
 *     nao significam nada fora do cliente nativo) e so mostra linhas no formato
 *     "Rotulo: valor" — uma frase solta seria filtrada fora.
 *
 * Entao o destaque e um SELO com CSS proprio, que e o que "em destaque"
 * significa nesta interface.
 */

/** Por `ITID`: a legenda que o item mostra em destaque. */
export const EXCLUSIVOS_DE_VIP = {
	// Wing_Of_Fly (item_db do rAthena). Ordem do dono, 09/09/2026: todos usam,
	// o VIP nao espera os 4 s e ganha o gatilho automatico, e so o NPC vende.
	601: 'VIP: sem espera e uso automático'
};

/** A legenda deste item, ou `null` quando ele nao e exclusivo. */
export function legendaDeVip(itemId) {
	const id = typeof itemId === 'string' ? parseInt(itemId, 10) : itemId;
	if (!Number.isFinite(id)) {
		return null;
	}
	return Object.prototype.hasOwnProperty.call(EXCLUSIVOS_DE_VIP, id)
		? EXCLUSIVOS_DE_VIP[id]
		: null;
}
