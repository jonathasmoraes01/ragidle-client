/**
 * UI/Components/CodexIdle/atributosEmAlteracao.js
 *
 * OS ATRIBUTOS DO CODEX EM ALTERACAO (23/09/2026 — ordem do dono: desabilitar
 * os "+" dos atributos e avisar que o sistema chega nos proximos dias).
 *
 * Puro de proposito, para ser testado de verdade sem subir a janela. O
 * VEREDITO continua do servidor: ele manda `atributosLigados` e, por eixo,
 * `recusaPorEixo[eixo] === 'atributos-em-alteracao'` — e e o `recusa !== null`
 * de `eixosHtml` que apaga o botao. Daqui sai so o texto do aviso e a pergunta
 * "esta linha esta em alteracao?", para a janela desenhar a faixa e a classe.
 */

/** O codigo que o servidor manda em `recusaPorEixo` (`RecusaDeGasto`). */
export const RECUSA_EM_ALTERACAO = 'atributos-em-alteracao';

/** O texto de reserva — o servidor manda o dele em `avisoDosAtributos`. */
export const AVISO_PADRAO_DOS_ATRIBUTOS =
	'O sistema de atributos está passando por alterações e chega nos próximos dias.';

/**
 * O aviso a mostrar na area dos atributos, ou `null`.
 *
 * So quando o SERVIDOR diz `atributosLigados: false`. Um servidor antigo, sem o
 * campo, nao ganha aviso: la o gasto funciona.
 */
export function avisoDosAtributos(estado) {
	if (!estado || estado.atributosLigados !== false) {
		return null;
	}
	const texto = typeof estado.avisoDosAtributos === 'string' ? estado.avisoDosAtributos.trim() : '';
	return texto || AVISO_PADRAO_DOS_ATRIBUTOS;
}

/** Esta linha de eixo esta apagada pelo interruptor dos atributos? */
export function eixoEmAlteracao(estado, eixo) {
	const recusas = (estado && estado.recusaPorEixo) || {};
	return recusas[eixo] === RECUSA_EM_ALTERACAO;
}
