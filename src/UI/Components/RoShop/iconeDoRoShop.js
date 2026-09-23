/**
 * UI/Components/RoShop/iconeDoRoShop.js
 *
 * O ICONE REAL de um item no RO Shop, e a guarda que nao deixa a MACA entrar.
 *
 * A ordem: a arte PUBLICADA primeiro (`/ragidle/item/<id>.png`, que conhece os
 * custom), o `.bmp` do GRF depois - o mesmo caminho da Temporada. Arte errada
 * e pior que a reserva do card: a maca de `unknownItem` NUNCA e aceita.
 *
 * A GUARDA E POR CAMPO (rodada 3, 22/09/2026). A primeira versao perguntava
 * `info === unknownItem`, mas `completarFicha` devolve uma COPIA batizada de
 * `unknownItem` para os ids de `NOMES_LOCAIS` - com o recurso da maca. A
 * identidade nunca batia e os 11 SKUs de item mostravam a maca no card, nos
 * detalhes e no carrinho do cliente real (QA independente, achado A-01). A
 * pergunta agora e `temIconeProprio(ficha)` (`DB/Items/FichaDoItem.js`).
 *
 * Arquivo proprio, com as dependencias INJETADAS, para o teste poder montar a
 * receita com a ficha de verdade e sem o motor do jogo (Renderer, rede, GRF).
 */

import { temIconeProprio } from 'DB/Items/FichaDoItem.js';

/**
 * @param {object} d
 * @param {function(string, function(string):void, function():void):void} d.preferirArtePublicada
 * @param {function(number):string} d.urlPublicada - a URL do PNG publicado do item
 * @param {function(number):object} d.fichaDoItem - `DB.getItemInfo`
 * @param {function(string, function(string):void, function():void):void} d.carregarDoGrf - recurso -> dataURI
 * @returns {function(number, function(string):void, function():void):void}
 */
export function criarResolverDeIcone(d) {
	return function resolverIcone(itemId, aoCarregar, aoFalhar) {
		d.preferirArtePublicada(d.urlPublicada(itemId), aoCarregar, () => {
			let ficha;
			try {
				ficha = d.fichaDoItem(itemId);
			} catch (_err) {
				aoFalhar();
				return;
			}
			if (!temIconeProprio(ficha)) {
				aoFalhar();
				return;
			}
			try {
				d.carregarDoGrf(ficha.identifiedResourceName, aoCarregar, aoFalhar);
			} catch (_err) {
				aoFalhar();
			}
		});
	};
}
