/**
 * O FILTRO POR CLASSE DO MAPA DE CACA (J7, 15/10/2026, D-2470).
 *
 * "Escolho a classe e vejo os mapas cujos drops tem equipamento que ela usa,
 * com a lista desses itens." Este modulo e a REGRA, e nao importa nada: sem DOM,
 * sem rede, sem estado. Quem diz se uma classe usa um item e o arquivo
 * `classes-dos-itens.json` (`DB/Items/classesDosItens.js`), que chega aqui como
 * a funcao `usa(itemId)` - assim o teste executa a regra com uma tabela de
 * mentira e a tela liga a de verdade.
 *
 * Os drops de um monstro chegam de DUAS formas, e as duas valem:
 *  - o INDICE do catalogo: `drops` sao nomes (o cliente resolve o id para nome
 *    na chegada, D-1133) e `dropIds` guarda os ids no mesmo indice;
 *  - a FICHA do mapa: `drops` sao objetos `{ itemId, nome, nomeLocal? }`.
 * O item sem id conhecido nao conta - adivinhar pelo nome seria o defeito de
 * `dropsDoMapa.js` (dois itens com o mesmo nome de exibicao).
 */

/**
 * Os drops de um monstro como `{ itemId, nome }`, venham do indice ou da ficha.
 *
 * @param {{drops?: Array<string|object>, dropIds?: number[]}} monstro
 * @returns {Array<{itemId: number, nome: string}>}
 */
export function dropsComId(monstro) {
	const lista = (monstro && monstro.drops) || [];
	const saida = [];
	lista.forEach((d, i) => {
		if (d && typeof d === 'object') {
			if (typeof d.itemId === 'number') {
				saida.push({ itemId: d.itemId, nome: d.nomeLocal || d.nome });
			}
			return;
		}
		const id = Array.isArray(monstro.dropIds) ? monstro.dropIds[i] : undefined;
		if (typeof id === 'number') {
			saida.push({ itemId: id, nome: String(d) });
		}
	});
	return saida;
}

/**
 * Os equipamentos que a classe usa entre os drops de uma lista de monstros: um
 * item por linha (sem repetir o que cai de mais de um monstro), na ordem em que
 * aparecem, com os monstros de onde cai.
 *
 * @param {Array<object>} monstros - `allMonstersOf(mapa)` do HuntMap
 * @param {function(number): boolean|null} usa - a classe escolhida usa este item?
 * @returns {Array<{itemId: number, nome: string, monstros: string[]}>}
 */
export function equipamentosDaClasse(monstros, usa) {
	const porItem = new Map();
	for (const monstro of monstros || []) {
		for (const d of dropsComId(monstro)) {
			if (usa(d.itemId) !== true) {
				continue;
			}
			let linha = porItem.get(d.itemId);
			if (!linha) {
				linha = { itemId: d.itemId, nome: d.nome, monstros: [] };
				porItem.set(d.itemId, linha);
			}
			if (!linha.monstros.includes(monstro.nome)) {
				linha.monstros.push(monstro.nome);
			}
		}
	}
	return Array.from(porItem.values());
}

/**
 * O "motivo" que o cartao do mapa mostra (a mesma forma de
 * `atlasDeCaca.motivoDaBusca`, para `resumoDoMotivo` desenhar a linha
 * "Espada (Poring) · ... +N" sem codigo novo).
 *
 * @param {Array<{itemId: number, nome: string, monstros: string[]}>} equipamentos
 * @returns {{peloNome: boolean, monstros: string[], drops: Array<{item: string, monstro: string}>}}
 */
export function motivoDaClasse(equipamentos) {
	return {
		peloNome: false,
		monstros: [],
		drops: equipamentos.map(e => ({ item: e.nome, monstro: e.monstros[0] || '' }))
	};
}

/**
 * A pergunta do filtro: o mapa tem equipamento para a classe? Devolve os
 * equipamentos (a lista nao vazia diz "sim"), ou `null` sem classe escolhida.
 *
 * @param {Array<object>} monstros
 * @param {number} indiceDaClasse - -1 = sem filtro
 * @param {function(number, number): boolean|null} classeUsaItem
 * @returns {Array<{itemId: number, nome: string, monstros: string[]}>|null}
 */
export function equipamentosDoMapaParaAClasse(monstros, indiceDaClasse, classeUsaItem) {
	if (!Number.isInteger(indiceDaClasse) || indiceDaClasse < 0) {
		return null;
	}
	return equipamentosDaClasse(monstros, itemId => classeUsaItem(indiceDaClasse, itemId));
}
