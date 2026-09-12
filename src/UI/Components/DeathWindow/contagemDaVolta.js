/**
 * A CONTAGEM DA VOLTA SOZINHA (D-1343 — a D-1165, item 5: "Morreu: ou clica e
 * volta a Prontera imediatamente, ou espera 15 segundos e volta a Prontera
 * sozinho").
 *
 * Quem devolve o morto e o SERVIDOR (`servidor/mapa/volta-apos-morte.ts`, que
 * chama a mesma rotina do botao "Voltar para a cidade"). Esta contagem so MOSTRA
 * a espera: o cliente nao decide nada, e se o relogio dele e o do servidor
 * divergirem por meio segundo, quem manda e o servidor.
 *
 * O numero mora aqui E la, porque o cliente nao importa o servidor. Um teste do
 * servidor (`servidor/mapa/volta-apos-morte-no-cliente.test.ts`) le este arquivo e
 * reprova se os dois divergirem.
 */

/** Os 15 s da D-1165 — o mesmo `MS_ATE_VOLTAR_SOZINHO` do servidor. */
export const MS_ATE_VOLTAR_SOZINHO = 15_000;

/**
 * O texto da contagem, dado ha quanto tempo a janela de morte abriu.
 *
 * Arredonda para CIMA: com 14,2 s restantes a janela diz "15 s", e o "0 s" nunca
 * aparece — no ultimo segundo ela ja diz que esta voltando.
 *
 * @param {number} msDesdeAMorte
 * @returns {string}
 */
export function textoDaContagem(msDesdeAMorte) {
	const restante = Math.max(0, MS_ATE_VOLTAR_SOZINHO - Math.max(0, msDesdeAMorte));
	if (restante === 0) {
		return 'Voltando à cidade…';
	}
	return `Voltando à cidade em ${Math.ceil(restante / 1000)} s`;
}
