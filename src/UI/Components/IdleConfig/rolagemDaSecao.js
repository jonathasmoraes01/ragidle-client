/**
 * A ROLAGEM DO PAINEL AO REDESENHAR (30/09/2026).
 *
 * O `renderBody` da Configuracao idle troca o HTML do painel inteiro a cada
 * mudanca: trocar de secao, marcar um chip do filtro de coleta, ligar um
 * interruptor, e a config que o servidor empurra. Ate aqui ele terminava SEMPRE
 * em `scrollTop = 0`, e no celular pequeno (360x640) cada toque num chip, que
 * mora ~290 px abaixo da dobra, devolvia o painel ao topo e o chip sumia
 * (achado da prova do celular, `prove:jogador-no-celular`).
 *
 * A regra: volta ao topo quando a SECAO muda (ou quando a janela reabre, e ai
 * nao ha secao anterior); no redesenho da MESMA secao, o lugar fica.
 *
 * @param {string|null} secaoAnterior - a secao do ultimo desenho; `null` na abertura
 * @param {string} secaoAgora - a secao que vai ser desenhada
 * @param {number} rolagemAtual - o `scrollTop` do painel antes de redesenhar
 * @returns {number} o `scrollTop` a devolver depois de redesenhar
 */
export function rolagemAoRedesenhar(secaoAnterior, secaoAgora, rolagemAtual) {
	return secaoAnterior === secaoAgora ? rolagemAtual : 0;
}
