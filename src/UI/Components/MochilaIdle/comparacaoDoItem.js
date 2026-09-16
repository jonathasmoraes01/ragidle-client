/**
 * UI/Components/MochilaIdle/comparacaoDoItem.js
 *
 * O HTML DO PAINEL "SE EQUIPAR" — a montagem, separada da janela para poder
 * ser medida (o mesmo desenho de `posicaoDaDica.js` e `espacoEquipado.js`).
 *
 * Quem CALCULA é o servidor (`ZC_RAGIDLE_ITEM`): a diferença sai de
 * `derivarStats` sobre a ficha de agora e sobre a ficha hipotética com a troca
 * aplicada — arma de duas mãos, slot vazio e peça deslocada já vêm resolvidos.
 * Aqui só se DESENHA: quem é o atual (a lista `saem`), quem é o candidato (o
 * item da ficha aberta), e cada delta com sinal E cor — a cor nunca é o único
 * portador, o `+`/`-` vai em texto.
 *
 * `recusa` não-nula vira frase, e não um diff vazio: "não dá para equipar" é
 * informação; uma lista em branco seria a janela dando de ombros.
 */

/**
 * @param {object|null} dados - o JSON do ZC_RAGIDLE_ITEM ({ acao, candidato,
 *        saem, difs, avisos, recusa })
 * @param {(t: string) => string} escapeHTML - o escapador do projeto
 *        (Utils/ItemOptionsView.js); vem por parâmetro para o módulo não puxar
 *        a árvore de UI e continuar medível em Node puro
 * @returns {string|null} o HTML do painel, ou `null` quando não há o que
 *        mostrar
 */
export function htmlDaComparacao(dados, escapeHTML) {
	if (!dados || dados.acao !== 'comparar') {
		return null;
	}

	if (dados.recusa) {
		return (
			'<div class="comparacao-titulo">Se equipar:</div>' +
			`<div class="comparacao-troca">${escapeHTML(String(dados.recusa))}</div>`
		);
	}

	const saem = Array.isArray(dados.saem) ? dados.saem : [];
	// "Qual é o atual" é exigência do pedido: a arma de duas mãos lista a arma
	// E o escudo que saem; o espaço vazio diz que é vazio em vez de fingir um
	// rival.
	const troca =
		saem.length > 0
			? 'no lugar de ' + saem.map(s => escapeHTML(String(s.nome || ''))).join(' + ')
			: 'em espaço vazio';

	const difs = Array.isArray(dados.difs) ? dados.difs : [];
	const linhas = difs
		.filter(d => typeof d.delta === 'number' && isFinite(d.delta))
		.map(d => {
			const ganho = d.delta > 0;
			const sinal = ganho ? '+' : '';
			return (
				`<span class="${ganho ? 'dif-ganho' : 'dif-perda'}">` +
				`${escapeHTML(String(d.rotulo))} ${sinal}${d.delta}` +
				'</span>'
			);
		});

	const corpo = linhas.length
		? `<div class="comparacao-difs">${linhas.join(' &middot; ')}</div>`
		: '<div class="comparacao-difs">sem mudança na ficha</div>';

	const avisos = Array.isArray(dados.avisos) ? dados.avisos : [];
	const rodape = avisos.length
		? `<div class="comparacao-aviso">${avisos.map(a => escapeHTML(String(a))).join(' ')}</div>`
		: '';

	return (
		`<div class="comparacao-titulo">Se equipar <span class="comparacao-troca">(${troca})</span>:</div>` +
		corpo +
		rodape
	);
}
