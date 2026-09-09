/**
 * UI/Components/CorreioIdle/relatorioDoLote.js
 *
 * A FRASE do "apagar todas", sem DOM e sem rede (07/09/2026).
 *
 * Mesma razão de existir de `atlasDeCaca.js` e `vidaDoMembro.js`: importar
 * `CorreioIdle.js` num teste puxa `Renderer` e WebGL junto, e a regra que
 * importa aqui é de TEXTO.
 *
 * ── O QUE ELA CUMPRE ──────────────────────────────────────────────────────
 * Pedido do dono no alfa: *"informe claramente quando alguma mensagem não puder
 * ser apagada"*. Uma frase que só dissesse "2 apagadas" deixaria o jogador
 * achando que o botão falhou nas outras — e ele clicaria de novo, para sempre,
 * porque as que ficam nunca saem.
 *
 * ── DE ONDE VEM O MOTIVO ──────────────────────────────────────────────────
 * Do SERVIDOR. A regra de "o que segura a exclusão" mora em `apagar`
 * (`servidor/caixa.ts`), e uma segunda leitura aqui envelheceria no dia em que
 * ela mudasse. Esta função nem lê o campo `motivo` de cada carta: ela nomeia as
 * cartas e diz a razão comum, porque hoje a razão é uma só — anexo por retirar.
 * O campo viaja no pacote para o dia em que houver uma segunda.
 */

/**
 * O relatório do lote em uma frase.
 *
 * @param {{apagadas?: number, mantidas?: Array<{titulo: string}>}|null} relatorio
 * @returns {string}
 */
export function fraseDoRelatorio(relatorio) {
	const apagadas = (relatorio && relatorio.apagadas) || 0;
	const mantidas = (relatorio && relatorio.mantidas) || [];
	const saiu =
		apagadas === 0
			? 'Nenhuma mensagem apagada'
			: apagadas === 1
				? '1 mensagem apagada'
				: apagadas + ' mensagens apagadas';
	if (!mantidas.length) {
		return saiu + '.';
	}
	const quantas = mantidas.length === 1 ? '1 ficou' : mantidas.length + ' ficaram';
	return (
		saiu + '; ' + quantas + ' com anexo por retirar: ' + mantidas.map(m => m.titulo).join(', ') + '.'
	);
}
