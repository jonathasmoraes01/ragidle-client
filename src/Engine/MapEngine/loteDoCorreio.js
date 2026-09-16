/**
 * O LOTE DO CORREIO EM VOO (16/09/2026) — pedido do dono: *"fui apagar 7
 * e-mails, recebi 7 mensagens no chat. Fui coletar 7 itens de uma vez so,
 * recebi mensagem 7 vezes"*.
 *
 * O servidor manda uma confirmacao POR CARTA dentro do lote, e ela nao e
 * redundante: e o que tira a linha da lista nativa (`Rodex.list`). O que e
 * redundante e a LINHA DE CHAT de cada uma. Enquanto um lote esta em voo, os
 * tratadores do Rodex atualizam o estado e ficam calados; o resumo sai uma vez,
 * quando o relatorio do lote chega (`CorreioIdle`).
 *
 * O prazo e a rede: se o relatorio se perder, o silencio acaba sozinho e a
 * proxima acao avulsa volta a falar.
 */

const PRAZO_DO_LOTE_MS = 10000;
let _ate = 0;

export function abrirLoteDoCorreio(agora = Date.now(), prazoMs = PRAZO_DO_LOTE_MS) {
	_ate = agora + prazoMs;
}

export function fecharLoteDoCorreio() {
	_ate = 0;
}

export function loteDoCorreioEmVoo(agora = Date.now()) {
	return agora < _ate;
}
