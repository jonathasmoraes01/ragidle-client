/**
 * UI/Components/LFGIdle/visibilidadeDoGrupo.js
 *
 * O GRUPO NO LOCALIZADOR: público, privado ou FECHADO (J18/J9, D-2464 e D-2465,
 * 15/10/2026). Sem DOM, pela razão de `vidaDoMembro.js`: as três respostas
 * abaixo precisam de teste que rode.
 *
 * `anunciado` desce do servidor em cada grupo da lista. Para quem procura ele é
 * sempre `true` (só anúncio aparece); o `false` só existe no MEU grupo, quando
 * o líder o fechou ou o anúncio morreu (reinício, líder fora do mundo). Antes
 * dele a janela do líder dizia "Público" para um grupo que ninguém via.
 */

/** O grupo está fora do Localizador? `undefined` (servidor um deploy atrás) conta como aberto. */
export function grupoFechado(g) {
	return !!g && g.anunciado === false;
}

/** O selo do dossiê: Fechado vence, depois Privado, depois Público. */
export function seloDoGrupo(g) {
	if (grupoFechado(g)) {
		return 'Fechado';
	}
	return g && g.privado ? 'Privado' : 'Público';
}

/**
 * O botão do seletor do líder está aceso? `valor` é o `data-privado` do botão:
 * `'0'` (Público), `'1'` (Privado) ou `'fechado'`.
 */
export function botaoDeVisibilidadeAceso(valor, g) {
	if (grupoFechado(g)) {
		return valor === 'fechado';
	}
	if (valor === 'fechado') {
		return false;
	}
	return (valor === '1') === !!(g && g.privado);
}

/** Quantos grupos da lista estão ABERTOS (o meu grupo fechado não conta). */
export function gruposAbertos(grupos) {
	return (grupos || []).filter(function (g) {
		return !grupoFechado(g);
	}).length;
}

/** O "Entrar rápido" é para quem procura grupo: some para quem já tem um. */
export function entrarRapidoAparece(meu) {
	return !meu;
}
