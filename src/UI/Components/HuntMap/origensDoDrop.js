/**
 * DE QUAIS MONSTROS AQUELE ITEM CAI (D-1675, 21/09/2026 — ordem do dono).
 *
 * Palavras dele: *"a primeira [visao] deve apresentar todos os drops possiveis
 * do mapa, reunindo itens repetidos e PRESERVANDO A IDENTIFICACAO DOS
 * MONSTROS que os fornecem (...) nao invente drops nem some probabilidades de
 * monstros diferentes como se fossem uma taxa unica"*.
 *
 * ---------------------------------------------------------------------------
 * O QUE FALTAVA, E NAO ERA O DADO
 * ---------------------------------------------------------------------------
 * `dropsDoMapa.js` ja juntava o item repetido por `itemId` e ja guardava
 * `monstros[]` com a chance e a raridade de CADA um. O dado estava certo e
 * continua o mesmo — este modulo nao recalcula nada.
 *
 * O que faltava era o monstro APARECER. Ele vivia em dois lugares que o
 * jogador de celular nunca alcanca: o `title` do ladrilho (nao ha hover no
 * dedo) e um chip "N mobs", que diz QUANTOS e esconde QUAIS. A identificacao
 * que o dono pediu e o NOME, na tela.
 *
 * ---------------------------------------------------------------------------
 * A REGRA QUE ESTE MODULO NAO PODE QUEBRAR
 * ---------------------------------------------------------------------------
 * **Uma linha por monstro, com a raridade DAQUELE monstro.** Nada de media,
 * nada de soma: a chance de um item "no mapa" nao existe no rAthena — ela e
 * por monstro. Juntar duas chances daria um numero que nao sai de fonte
 * nenhuma, e a regra 1 do projeto proibe numero inventado.
 */
import { classeDeRaridade, raridadeDoDrop, rotuloDeRaridade } from './atlasDeCaca.js';

/**
 * Os rotulos das duas visoes, como o dono os escreveu.
 *
 * Eram "Do monstro" e "Do mapa". O pedido nomeia "Por monstro" e "Drops do
 * mapa", e a diferenca nao e cosmetica: "Do mapa" le como um filtro, e
 * "Drops do mapa" diz o que a aba entrega.
 */
export const ROTULO_DA_VISAO = {
	mob: 'Por monstro',
	mapa: 'Drops do mapa',
};

/**
 * Escapa o que vem do servidor. O nome do monstro e texto do catalogo, e
 * catalogo e dado — nunca HTML.
 */
function escapar(texto) {
	return String(texto ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/**
 * O HTML das origens de UM item: uma linha por monstro, cada uma com o nome e
 * a raridade daquele monstro.
 *
 * @param {Array<{mobId: number, nome: string, chance: number, raridade?: number, raro?: boolean}>} monstros
 * @returns {string}
 */
export function htmlDasOrigens(monstros) {
	const lista = Array.isArray(monstros) ? monstros : [];
	return lista
		.map((m) => {
			const r = raridadeDoDrop(m);
			return (
				'<span class="hm-drop-origem">' +
				`<span class="hm-drop-origem-nome">${escapar(m.nome)}</span>` +
				`<span class="hm-drop-rarity ${classeDeRaridade(r)}">${escapar(rotuloDeRaridade(r))}</span>` +
				'</span>'
			);
		})
		.join('');
}
