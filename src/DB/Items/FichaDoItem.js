/**
 * DB/Items/FichaDoItem.js
 *
 * A FICHA DE UM ITEM QUE O CLIENTE NAO CONHECE — e por que ela nao pode ser
 * a ficha inteira.
 *
 * ## O defeito (o dono, jogando, 25/08/2026)
 *
 * "Item `undefined` dropado nos Campos de Prontera": um drop sem nome, sem
 * imagem e sem descricao. O item era o **4545 (Novice Poring Card)**, que o
 * Little Poring solta a 1% em `prt_fild08` — o unico dos 22 drops do jogo cujo
 * id esta no `ItemTable.js` e NAO esta na tabela de nomes do GRF.
 *
 * ## Por que "undefined" e nao "Unknown Item"
 *
 * `getItemInfo` fazia a queda de braco no OBJETO INTEIRO:
 *
 *     const item = ItemTable[itemid] || unknownItem;
 *
 * So que `ItemTable.js` nasce com milhares de ESTUBES — `4545: { ClassNum: 0 }`
 * — e um estube e truthy. O `||` nunca dispara, a ficha volta sem
 * `identifiedDisplayName`, e a tela imprime a string `"undefined"`. O caminho
 * do sprite vira `.../undefined.bmp` (sem icone) e a descricao some junto.
 *
 * O item que NAO esta no `ItemTable.js` de jeito nenhum cai no `unknownItem` e
 * aparece certinho como "Unknown Item" — e e por isso que so um dos 22 tinha
 * este sintoma. O estube e pior que a ausencia.
 *
 * ## O conserto: a queda de braco e POR CAMPO
 *
 * `completarFicha` devolve **a mesma ficha** quando ela esta completa (o caso
 * de 99,9% dos itens, e a razao de nao haver copia no caminho quente), e uma
 * copia remendada quando falta nome. O remendo NAO e gravado de volta no
 * `ItemTable`: as tabelas do GRF carregam DEPOIS, de forma assincrona, e
 * carimbar "Item desconhecido" no lugar deixaria o nome de verdade sem onde
 * chegar.
 *
 * O nome carrega o ID de proposito. "Unknown Item" nao permite reportar nada;
 * "Item desconhecido (4545)" diz exatamente o que procurar no item_db.
 */

import { NOMES_LOCAIS } from './nomesLocais.js';

/** A ficha de quem nao esta na tabela. `\xbb\xe7\xb0\xfa` e o sprite de sobra do cliente. */
export const unknownItem = {
	unidentifiedDisplayName: 'Unknown Item',
	unidentifiedResourceName: '\xbb\xe7\xb0\xfa',
	unidentifiedDescriptionName: ['...'],
	identifiedDisplayName: 'Unknown Item',
	identifiedResourceName: '\xbb\xe7\xb0\xfa',
	identifiedDescriptionName: ['...'],
	slotCount: 0,
	ClassNum: 0
};

/**
 * Completa os campos que faltam numa ficha de item.
 *
 * @param {number} itemid
 * @param {object} ficha - o que o ItemTable tem para este id
 * @returns {object} a mesma ficha, ou uma copia com os buracos tapados
 */
export function completarFicha(itemid, ficha) {
	if (!ficha) {
		/*
		 * Ausente da tabela inteira: se o id tem nome local (a frente dos 22,
		 * ver nomesLocais.js), a ficha de sobra sai BATIZADA — sem isso o
		 * item que nem estube tem apareceria como "Unknown Item" mesmo com o
		 * nome a um import de distancia.
		 */
		const nomeLocal = NOMES_LOCAIS[itemid];
		if (nomeLocal !== undefined) {
			return { ...unknownItem, identifiedDisplayName: nomeLocal, unidentifiedDisplayName: nomeLocal };
		}
		return unknownItem;
	}
	// O caminho quente: ficha completa volta como veio, sem copia.
	if (ficha.identifiedDisplayName !== undefined && ficha.unidentifiedDisplayName !== undefined) {
		return ficha;
	}
	/*
	 * O nome local vence o generico, e SO o generico: uma ficha que ja trouxe
	 * `identifiedDisplayName` (o GRF carregou, ou carregara) nunca chega a
	 * esta linha com o campo preenchido — o `??` abaixo preserva o que veio.
	 */
	const nome = NOMES_LOCAIS[itemid] ?? 'Item desconhecido (' + itemid + ')';
	return {
		...ficha,
		identifiedDisplayName: ficha.identifiedDisplayName ?? nome,
		unidentifiedDisplayName: ficha.unidentifiedDisplayName ?? nome,
		identifiedResourceName: ficha.identifiedResourceName ?? unknownItem.identifiedResourceName,
		unidentifiedResourceName: ficha.unidentifiedResourceName ?? unknownItem.unidentifiedResourceName,
		// String e nao array: `getItemInfo` ja passou o bloco que junta as
		// linhas quando esta funcao roda, entao devolver array aqui poria um
		// `['...']` cru na caixa de descricao.
		identifiedDescriptionName: ficha.identifiedDescriptionName ?? '...',
		unidentifiedDescriptionName: ficha.unidentifiedDescriptionName ?? '...',
		slotCount: ficha.slotCount ?? 0
	};
}
