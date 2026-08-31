/**
 * O DROP DO MAPA INTEIRO (pedido do dono, 31/08/2026 — I6).
 *
 * Palavras dele: *"no menu de teleporte dos mapas de caca mostrar todo o drop do
 * mapa, em vez de separado por mobs (ter as 2 opcoes)"*.
 *
 * O "ter as 2 opcoes" e explicito: a visao por monstro CONTINUA, e esta entra ao
 * lado. Nao e substituicao.
 *
 * ===========================================================================
 * POR QUE ISTO E UM MODULO PROPRIO, E NAO UMA FUNCAO DENTRO DO HuntMap.js
 * ===========================================================================
 * Para poder ser EXECUTADO por um teste. Os portoes que o repositorio do
 * servidor tem sobre este fork leem o FONTE — e um teste que le fonte nao mede
 * aritmetica. A regra aqui tem deduplicacao e escolha de maior valor, e uma
 * regra com conta precisa de teste que rode.
 *
 * Este arquivo nao importa nada: sem DOM, sem rede, sem estado. Ele recebe o
 * mapa do catalogo e devolve uma lista.
 *
 * ===========================================================================
 * A CHANCE MOSTRADA E A MAIOR, E NUNCA A SOMA
 * ===========================================================================
 * Medido no catalogo de hoje: **25 dos 33 mapas** tem pelo menos um item que
 * cai de mais de um monstro (o `gef_dun02` tem 44 itens distintos em 3 mobs).
 * Entao a pergunta "qual a chance deste item NO MAPA?" aparece o tempo todo, e
 * ela **nao tem resposta no rAthena**: a chance e por monstro, e a do mapa
 * dependeria de qual bicho o jogador mata e de como o spawn se distribui.
 *
 * Somar as chances daria um numero inventado — e a regra 1 do projeto proibe
 * numero que nao saia da fonte. Entao a lista mostra:
 *
 *   - `melhorChance`: a MAIOR entre os monstros que dropam o item. Ela existe
 *     de verdade (e a chance daquele monstro), e responde "o melhor caso";
 *   - `deQuantosMobs`: de quantos monstros aquele item cai, para a tela poder
 *     dizer que ha mais de uma origem em vez de esconder o fato;
 *   - `monstros`: quais sao, para o jogador saber o que cacar.
 *
 * Um dia alguem vai querer somar. Este comentario existe para essa pessoa.
 */

/**
 * Todo o drop de um mapa, um item por linha.
 *
 * @param {{monstros?: Array<object>, mvp?: object|null}} mapa - um `MapaDoCatalogo`.
 * @returns {Array<{itemId: number, nome: string, melhorChance: number,
 *                  deQuantosMobs: number, monstros: Array<{mobId: number, nome: string, chance: number}>}>}
 *   Ordenado da maior chance para a menor; empate desempata pelo NOME, para a
 *   lista nao dancar entre duas aberturas da mesma janela.
 */
export function dropsDoMapa(mapa) {
	if (!mapa) return [];

	// O MVP entra: ele dropa, e o jogador que abre esta lista quer saber. E a
	// mesma juncao que o `allMonstersOf` do HuntMap faz para os chips.
	const monstros = (mapa.monstros || []).concat(mapa.mvp ? [mapa.mvp] : []);

	/** @type {Map<number, {itemId: number, nome: string, melhorChance: number, deQuantosMobs: number, monstros: Array<object>}>} */
	const porItem = new Map();

	for (const mob of monstros) {
		for (const d of mob.drops || []) {
			/*
			 * A CHAVE E O `itemId`, e nao o nome. Dois itens podem compartilhar
			 * nome de exibicao, e o catalogo ja traz o id — agrupar por nome
			 * fundiria itens diferentes numa linha so, e o jogador clicaria
			 * atras de um item que nao esta la.
			 */
			const jaVisto = porItem.get(d.itemId);
			const origem = { mobId: mob.mobId, nome: mob.nome, chance: d.chance };
			if (jaVisto) {
				jaVisto.deQuantosMobs++;
				jaVisto.monstros.push(origem);
				if (d.chance > jaVisto.melhorChance) jaVisto.melhorChance = d.chance;
				continue;
			}
			porItem.set(d.itemId, {
				itemId: d.itemId,
				nome: d.nome,
				melhorChance: d.chance,
				deQuantosMobs: 1,
				monstros: [origem],
			});
		}
	}

	const lista = [...porItem.values()];
	for (const linha of lista) {
		// Dentro da linha, a origem mais generosa primeiro — e o mob que o
		// jogador deve cacar se quiser aquele item.
		linha.monstros.sort((a, b) => b.chance - a.chance || a.nome.localeCompare(b.nome));
	}
	/*
	 * ORDEM ESTAVEL. Sem o desempate por nome, dois itens de mesma chance
	 * trocariam de lugar conforme a ordem em que os mobs chegaram — e a lista
	 * dancaria entre duas aberturas da mesma janela, sem nada ter mudado.
	 */
	lista.sort((a, b) => b.melhorChance - a.melhorChance || a.nome.localeCompare(b.nome));
	return lista;
}
