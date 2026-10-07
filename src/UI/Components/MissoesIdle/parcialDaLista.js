/**
 * UI/Components/MissoesIdle/parcialDaLista.js
 *
 * A LISTA DE MISSOES POR DIFERENCA (07/10/2026, D-2071) - a metade do cliente,
 * pura.
 *
 * O `ZC_RAGIDLE_MISSOES` (0x0fed) descia a lista INTEIRA (17 KB num
 * personagem novo, 40 KB com tudo concluido) a cada mudanca de estrutura
 * (aceitar, abandonar, finalizar, subir de nivel), a cada abertura da janela e
 * na entrada de toda conexao nova. O servidor (`servidor/mapa/parcial-das-
 * missoes.ts`, no repositorio do jogo) agora numera todo corpo (`rev`, e o
 * parcial leva `de`) e, para quem DECLARA que aplica, manda o parcial `v: 4`:
 * as missoes que mudaram inteiras, a ordem quando ela muda, o progresso das
 * outras (o formato do `v: 3`), as prontas, os campos de cima que mudaram e o
 * rastreador do Codex.
 *
 * A DECLARACAO e a revisao que a lista tem na mao, em dois lugares:
 *  - no pedido da janela (`{acao: 'pedir', base}` no 0x0feb), no lugar do
 *    0x0fec, que e fixo e nao leva nada - so com servidor que numera;
 *  - na entrada no mapa (`{acao: 'bases', missoes, skills}`, ver
 *    `Engine/declaracaoDasBases.js`), para o lote de entrada descer so o que
 *    mudou desde a conexao anterior (a volta da aba, a reconexao).
 *
 * A janela continua sem calcular nada: cada missao do parcial chega pronta,
 * no MESMO formato da lista inteira, e so troca de lugar.
 */

import { aplicarProgressoParcial } from './missoesAceitas.js';

/** A versao do parcial de LISTA no fio (a lista inteira e `v: 1`). */
export const VERSAO_DO_PARCIAL_DA_LISTA = 4;

/** O corpo e o parcial de lista? */
export function ehParcialDaLista(dados) {
	return !!dados && dados.v === VERSAO_DO_PARCIAL_DA_LISTA && dados.parcial === 'lista';
}

/** A revisao que um corpo deixa na mao: a dele, ou `null` (servidor que nao numera). */
export function revisaoDoCorpo(dados) {
	return dados && typeof dados.rev === 'number' ? dados.rev : null;
}

/**
 * O parcial (de progresso, do rastreador ou de lista) cai sobre a lista que
 * temos? Sem `de` (servidor que nao numera) ele cai sempre - e o contrato de
 * antes. Com `de`, so sobre a MESMA revisao.
 */
export function caiSobreARevisao(revDaLista, dados) {
	if (!dados || typeof dados.de !== 'number') {
		return true;
	}
	return revDaLista === dados.de;
}

/**
 * O pedido da janela. Com revisao na mao vai pelo verbo `pedir` (o servidor
 * responde so o que mudou); `base: null` pede a lista inteira. Quem chama
 * decide se o servidor numera (`revDaLista !== null`) - com servidor que nao
 * numera, o pedido e o 0x0fec de sempre.
 */
export function pedidoDaLista(revDaLista) {
	return { acao: 'pedir', base: typeof revDaLista === 'number' ? revDaLista : null };
}

/**
 * A declaracao da entrada no mapa: a revisao da lista e a da arvore de
 * habilidades (`null` quando nao ha). As duas chaves vao SEMPRE - e a
 * presenca delas que diz ao servidor que este cliente aplica os parciais.
 */
export function declaracaoDasBases(revDaLista, revDaArvore) {
	return {
		acao: 'bases',
		missoes: typeof revDaLista === 'number' ? revDaLista : null,
		skills: typeof revDaArvore === 'number' ? revDaArvore : null
	};
}

/**
 * Aplica o parcial de lista sobre as missoes que temos.
 *
 * Devolve `{missoes, campos, temRastreador, codexRastreado}` (a lista NOVA; a
 * de antes fica intacta), ou `null` quando ele nao cai sobre ela: uma missao
 * da ordem que nem veio nem esta na lista, uma missao nova sem ordem, ou um
 * progresso que nao casa com os objetivos. Quem chama pede a lista inteira.
 */
export function aplicarParcialDaLista(missoes, parcial) {
	if (!ehParcialDaLista(parcial) || !Array.isArray(missoes)) {
		return null;
	}
	const atuais = new Map();
	for (const m of missoes) {
		if (m && typeof m.id === 'string') {
			atuais.set(m.id, m);
		}
	}
	const novas = new Map();
	for (const m of Array.isArray(parcial.missoes) ? parcial.missoes : []) {
		if (!m || typeof m.id !== 'string') {
			return null;
		}
		novas.set(m.id, m);
	}
	let lista;
	if (Array.isArray(parcial.ordem)) {
		lista = [];
		for (const id of parcial.ordem) {
			const m = novas.has(id) ? novas.get(id) : atuais.get(id);
			if (!m) {
				return null;
			}
			lista.push(m);
		}
	} else {
		for (const id of novas.keys()) {
			if (!atuais.has(id)) {
				return null;
			}
		}
		lista = missoes.map(m => (m && novas.has(m.id) ? novas.get(m.id) : m));
	}
	const r = aplicarProgressoParcial(lista, {
		progressos: parcial.progressos && typeof parcial.progressos === 'object' ? parcial.progressos : {},
		prontas: Array.isArray(parcial.prontas) ? parcial.prontas : undefined
	});
	if (r.divergentes.length > 0) {
		return null;
	}
	const temRastreador = Object.prototype.hasOwnProperty.call(parcial, 'codexRastreado');
	return {
		missoes: r.missoes,
		campos: parcial.campos && typeof parcial.campos === 'object' ? parcial.campos : {},
		temRastreador,
		codexRastreado: temRastreador ? parcial.codexRastreado : undefined
	};
}
