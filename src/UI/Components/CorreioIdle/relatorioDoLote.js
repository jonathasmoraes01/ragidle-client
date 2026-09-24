/**
 * UI/Components/CorreioIdle/relatorioDoLote.js
 *
 * As FRASES dos dois lotes do correio, sem DOM e sem rede — "apagar todas"
 * (07/09/2026) e "coletar todos os anexos" (15/09/2026, D-1494).
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

/**
 * O relatório do "Coletar todos os anexos" em uma frase (D-1494, 15/09/2026).
 *
 * ── POR QUE ELA É IRMÃ, E NÃO UM PARÂMETRO DE `fraseDoRelatorio` ───────────
 * Os dois relatórios trazem `mantidas` com a mesma forma, e a tentação é
 * reusar. Mas o MOTIVO de ficar é diferente e **os conjuntos são disjuntos de
 * propósito** (o contrato está escrito em `servidor/protocolo/pacotes-mapa.ts`:
 * `'zeny'|'itens'|'ambos'` no apagar, `'peso'` no coletar). A irmã de cima
 * cravou "anexo por retirar" no texto; cravar aqui "não coube no peso" é a
 * mesma escolha, e um `if` sobre o motivo dentro de uma função só seria a
 * segunda leitura da regra do servidor que as duas existem para evitar.
 *
 * ── O QUE ELA CUMPRE ──────────────────────────────────────────────────────
 * O pedido do dono foi o botão; a frase é o que impede o botão de MENTIR. A
 * coleta é a única ação do correio que pode fazer MENOS do que o nome diz sem
 * que nada apareça na tela: quando o peso não cabe, o servidor coleta o que dá
 * e para, e sem frase o jogador vê algumas cartas continuarem com anexo e
 * conclui que o botão falhou — e clica de novo, para sempre.
 *
 * O ZENY entra na frase porque o botão não o nomeia. O rótulo é "Coletar todos
 * os itens" (as palavras do dono) e a ação leva zeny junto; dizer o total é o
 * que separa "surpresa boa" de "não sei o que esse botão fez".
 *
 * @param {{coletadas?: number, zenyTotal?: number, mantidas?: Array<{titulo: string}>}|null} relatorio
 * @returns {string}
 */
export function fraseDaColeta(relatorio) {
	const coletadas = (relatorio && relatorio.coletadas) || 0;
	const zeny = (relatorio && relatorio.zenyTotal) || 0;
	const mantidas = (relatorio && relatorio.mantidas) || [];

	const veio =
		coletadas === 0
			? 'Nenhum anexo coletado'
			: coletadas === 1
				? 'Anexo de 1 mensagem coletado'
				: 'Anexos de ' + coletadas + ' mensagens coletados';
	// O zeny só aparece quando existe: "(0 zeny)" é ruído em toda coleta que
	// não tinha dinheiro nenhum, que é a maioria delas.
	const comZeny = zeny > 0 ? veio + ' (' + zeny.toLocaleString('pt-BR') + ' zeny)' : veio;

	if (!mantidas.length) {
		return comZeny + '.';
	}
	/*
	 * O MOTIVO DE CADA CARTA vem do servidor (24/09/2026). Até esta data a
	 * frase cravava "no peso" para toda carta mantida, e o dono leu "2 não
	 * couberam no peso" com a mochila leve. Um grupo por motivo, na ordem em
	 * que aparece; motivo que esta janela não conhece é nomeado sem razão
	 * inventada ("ficou no correio"), em vez de virar "peso" de novo.
	 */
	const grupos = [];
	for (const m of mantidas) {
		const motivo = Object.prototype.hasOwnProperty.call(MOTIVO_DA_COLETA, m.motivo) ? m.motivo : '';
		let grupo = grupos.find(g => g.motivo === motivo);
		if (!grupo) {
			grupo = { motivo: motivo, titulos: [] };
			grupos.push(grupo);
		}
		grupo.titulos.push(m.titulo);
	}
	return (
		comZeny +
		'; ' +
		grupos
			.map(g => {
				const um = g.titulos.length === 1;
				const verbo = g.motivo
					? (um ? '1 não coube ' : g.titulos.length + ' não couberam ') + MOTIVO_DA_COLETA[g.motivo]
					: um ? '1 ficou no correio' : g.titulos.length + ' ficaram no correio';
				return verbo + ': ' + g.titulos.join(', ');
			})
			.join('; ') +
		'.'
	);
}

/** Os motivos que o servidor manda no "coletar todos" (`MotivoDeNaoColetar`). */
const MOTIVO_DA_COLETA = {
	peso: 'no peso',
	zeny: 'no limite de zeny'
};
