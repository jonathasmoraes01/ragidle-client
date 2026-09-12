/**
 * O ITEM NA TELA — o ícone e o nome de um item pelo id, numa receita só.
 *
 * Os dois nasceram dentro do Mapa de Caça (`setItemIcon` e `nomeLocalDoItem`), e
 * a janela idle passou a precisar deles com o filtro de coleta (D-1348). Uma
 * segunda cópia seria a quarta desta receita no cliente — a Mochila e a loja de
 * NPC V2 têm as delas —, então as duas janelas importam daqui.
 */
import Client from 'Core/Client.js';
import DB from 'DB/DBManager.js';

/**
 * Ícone do item: /ragidle/item/<id>.png (a arte publicada pelo pipeline) com
 * reserva no bitmap do GRF — a mesma receita da Mochila e da loja de NPC V2.
 */
export function aplicarIconeDoItem(img, itemId) {
	const it = DB.getItemInfo(itemId);
	const resName = it && it.identifiedResourceName;
	img.onerror = () => {
		img.onerror = null;
		if (!resName) {
			img.style.display = 'none';
			return;
		}
		Client.loadFile(
			DB.INTERFACE_PATH + 'item/' + resName + '.bmp',
			dataURI => {
				img.src = dataURI;
			},
			() => {
				img.style.display = 'none';
			}
		);
	};
	img.src = `/ragidle/item/${itemId}.png`;
}

/**
 * O nome local de um item pelo id, com o do servidor de reserva: a tabela do
 * cliente devolve "Unknown Item" (ou nada) para id que o GRF não conhece, e
 * nesse caso o nome do rAthena é a única verdade disponível.
 */
export function nomeLocalDoItem(itemId, nomeDoServidor) {
	const it = DB.getItemInfo(itemId);
	const local = it && it.identifiedDisplayName;
	if (!local || /^unknown item$/i.test(String(local).trim())) {
		return nomeDoServidor;
	}
	return local;
}
