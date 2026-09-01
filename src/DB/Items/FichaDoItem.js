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
 *
 * ## E o ICONE, desde 31/08/2026
 *
 * A queixa do dono na Loja de Cosmeticos era a linha inteira: nome generico E
 * maca no lugar do icone. O remendo agora tapa os dois buracos, e o segundo so
 * onde ha PROVA de qual e o `.bmp` — a lista, a derivacao e as duas peneiras
 * que ela passa estao no cabecalho de `ICONES_LOCAIS` (`nomesLocais.js`).
 */

import { ICONES_LOCAIS, NOMES_LOCAIS } from './nomesLocais.js';

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
			const ficheiroDoIcone = ICONES_LOCAIS[itemid];
			return {
				...unknownItem,
				identifiedDisplayName: nomeLocal,
				unidentifiedDisplayName: nomeLocal,
				// So o lado IDENTIFICADO: ver o cabecalho de ICONES_LOCAIS —
				// o icone nao-identificado de todo cosmetico e o capuz
				// generico, e nao o do item.
				...(ficheiroDoIcone !== undefined && { identifiedResourceName: ficheiroDoIcone })
			};
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
	/*
	 * O icone local tambem so vale quando o GRF nao trouxe o dele: o `??`
	 * abaixo preserva o que veio, e o 20512 e a prova viva disso — ele TEM
	 * recurso na tabela do GRF e nao tem nome, entao chega aqui pela metade.
	 */
	const icone = ICONES_LOCAIS[itemid] ?? unknownItem.identifiedResourceName;
	return {
		...ficha,
		identifiedDisplayName: ficha.identifiedDisplayName ?? nome,
		unidentifiedDisplayName: ficha.unidentifiedDisplayName ?? nome,
		identifiedResourceName: ficha.identifiedResourceName ?? icone,
		unidentifiedResourceName: ficha.unidentifiedResourceName ?? unknownItem.unidentifiedResourceName,
		// String e nao array: `getItemInfo` ja passou o bloco que junta as
		// linhas quando esta funcao roda, entao devolver array aqui poria um
		// `['...']` cru na caixa de descricao.
		identifiedDescriptionName: ficha.identifiedDescriptionName ?? '...',
		unidentifiedDescriptionName: ficha.unidentifiedDescriptionName ?? '...',
		slotCount: ficha.slotCount ?? 0
	};
}
