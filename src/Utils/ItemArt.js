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
