/**
 * Utils/ItemArt.js
 *
 * Arte de item publicada pelo pipeline do jogo (rag-idle-master/scripts/
 * publicar-icones-de-item.ts, que reusa tools/item-icon): PNG ja convertido
 * (magenta -> alfa), servido pelo vite em vez de vir do GRF a cada load.
 *
 * ragidle-client/public/ragidle/item/<id>.png       -- 24x24, a celula da lista
 * ragidle-client/public/ragidle/collection/<id>.png -- ~75x100, a ilustracao
 *
 * Nem todo item foi convertido ainda (hoje: 582 ids, ver
 * assets-build/ui/icones-de-item.json) -- por isso quem usa isto tenta a
 * arte publicada primeiro e cai no caminho antigo (Client.loadFile direto no
 * GRF) quando o PNG publicado nao existe.
 */

import DB from 'DB/DBManager.js';
import Client from 'Core/Client.js';

/** URL do icone pequeno (24x24) publicado para o item. */
export function itemIconUrl(itemId) {
	return `/ragidle/item/${itemId}.png`;
}

/** URL da ilustracao (~75x100) publicada para o item. */
export function itemCollectionUrl(itemId) {
	return `/ragidle/collection/${itemId}.png`;
}

/**
 * Tenta carregar `url` (a arte publicada); se falhar -- item ainda nao
 * convertido, 404 -- chama `aoFalhar()` para o chamador repetir o caminho
 * antigo (Client.loadFile no GRF). Usa Image() porque o unico objetivo e
 * saber se o navegador consegue exibir a URL como background-image; nao
 * precisamos do blob que Client.loadFile devolve.
 *
 * @param {string} url
 * @param {function(string):void} aoCarregar
 * @param {function():void} aoFalhar
 */
export function preferirArtePublicada(url, aoCarregar, aoFalhar) {
	const img = new Image();
	img.onload = () => aoCarregar(url);
	img.onerror = () => aoFalhar();
	img.src = url;
}

/**
 * Carrega a ILUSTRACAO de colecao (~75x100) de um item, com o MESMO fallback
 * que `preferirArtePublicada` documenta: PNG publicado primeiro, bitmap do
 * GRF (`collection/<resname>.bmp`) se ele ainda nao existir. Extraido de
 * `ItemInfo.js#setItem` (31/08/2026, sistema de Runas) para nao duplicar a
 * mesma receita na dica de hover da Mochila (MochilaIdle.js) -- os dois
 * consumidores so diferem no que fazem com a URL/dataURI resolvida.
 *
 * `aoFalhar` e OPCIONAL: quando o proprio GRF nao tem o bitmap,
 * `Client.loadFile` chama esse callback (se dado) em vez de `aoCarregar` --
 * ItemInfo nao passava nada aqui (o fundo so fica sem imagem, comportamento
 * inalterado), a Mochila passa um fallback pro icone pequeno do item.
 *
 * @param {object} item - objeto do inventario/equipamento ({ITID, IsIdentified, ...})
 * @param {object} it - ficha do item (DB.getItemInfo(item.ITID))
 * @param {function(string):void} aoCarregar - chamado com a URL/dataURI (background-image ou <img src>)
 * @param {function():void} [aoFalhar] - chamado se nem o bitmap do GRF existir
 */
export function carregarArteDeColecao(item, it, aoCarregar, aoFalhar) {
	preferirArtePublicada(itemCollectionUrl(item.ITID), aoCarregar, () => {
		Client.loadFile(
			DB.INTERFACE_PATH +
				'collection/' +
				(item.IsIdentified ? it.identifiedResourceName : it.unidentifiedResourceName) +
				'.bmp',
			aoCarregar,
			aoFalhar
		);
	});
}
