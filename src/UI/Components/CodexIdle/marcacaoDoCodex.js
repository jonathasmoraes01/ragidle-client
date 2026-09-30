/**
 * UI/Components/CodexIdle/marcacaoDoCodex.js
 *
 * A ESTRELA DE CADA ENTRADA DO CODEX (D-1839, 29/09/2026) — marcar/desmarcar
 * para acompanhar a entrada no rastreador da HUD, e a faixa que diz quantas
 * estão marcadas (e a recusa, quando houver).
 *
 * O desenho mora aqui, e não dentro de `CodexIdle.js`, para ser testável sem
 * subir a janela inteira (Shadow DOM, `Network`, `UIManager`) — a mesma razão
 * de `jornadaHtml.js`.
 *
 * O ESTADO vem do servidor: `marcadas` (as vivas), `maximoDeMarcadas` e, só na
 * resposta a uma marcação recusada, `avisoDeMarcacao`. A janela não decide se
 * pode marcar — um clique além do teto vai ao servidor e volta com o motivo,
 * que é o mesmo que o chat recebe.
 */

function escapeHtml(value) {
	return String(value == null ? '' : value).replace(/[&<>"']/g, ch => {
		switch (ch) {
			case '&':
				return '&amp;';
			case '<':
				return '&lt;';
			case '>':
				return '&gt;';
			case '"':
				return '&quot;';
			default:
				return '&#39;';
		}
	});
}

/** A lista marcada do retrato; retrato de servidor antigo = nenhuma. */
export function marcadasDoRetrato(estado) {
	return estado && Array.isArray(estado.marcadas) ? estado.marcadas : [];
}

/**
 * O botão estrela de uma entrada. `aria-pressed` diz o estado a quem lê a
 * tela; o glifo cheio/vazio diz a quem vê.
 */
export function estrelaDoCodexHtml(id, marcada) {
	const rotulo = marcada ? 'Deixar de acompanhar na tela' : 'Acompanhar na tela';
	return (
		'<button type="button" class="cx-marcar' +
		(marcada ? ' is-marcada' : '') +
		'" data-marcar="' +
		escapeHtml(id) +
		'" aria-pressed="' +
		(marcada ? 'true' : 'false') +
		'" aria-label="' +
		rotulo +
		'" title="' +
		rotulo +
		'">' +
		(marcada ? '★' : '☆') +
		'</button>'
	);
}

/**
 * A faixa acima da lista: "Acompanhando 2 de 5 na tela", e o aviso da recusa
 * quando o último retrato o trouxe (a 6ª marcação, ou uma entrada concluída).
 */
export function faixaDeMarcacaoHtml(estado) {
	const marcadas = marcadasDoRetrato(estado);
	const maximo = Number(estado && estado.maximoDeMarcadas) || 5;
	const aviso =
		estado && typeof estado.avisoDeMarcacao === 'string' && estado.avisoDeMarcacao
			? '<div class="cx-marcacao-aviso" role="alert">' + escapeHtml(estado.avisoDeMarcacao) + '</div>'
			: '';
	return (
		'<div class="cx-marcacao">' +
		'<span class="cx-marcacao-conta">☆ Acompanhando ' +
		escapeHtml(marcadas.length) +
		' de ' +
		escapeHtml(maximo) +
		' na tela</span>' +
		aviso +
		'</div>'
	);
}

/**
 * O QUE O "OCULTAR CONCLUÍDAS" ESCONDE (D-1853, 30/09/2026).
 *
 * Só a entrada ENCERRADA: cumprida e sem prêmio a resgatar. A cumprida com
 * prêmio pendente (`aResgatar`) continua na lista — é a que o jogador precisa
 * ver, e é para ela que a linha "Resgatar!" do rastreador leva; escondê-la
 * deixava o clique abrir a janela sem nada para acender. A entrada pedida pelo
 * rastreador (`pedida`) também nunca some, pelo mesmo motivo.
 */
export function entradaOcultavel(m, pedida) {
	return !!m && m.cumprida === true && m.aResgatar !== true && m.id !== pedida;
}

/** A lista que a janela desenha: com `ocultar`, sem as encerradas. */
export function entradasVisiveis(todas, ocultar, pedida) {
	const lista = Array.isArray(todas) ? todas : [];
	return ocultar ? lista.filter(m => !entradaOcultavel(m, pedida)) : lista;
}

/**
 * O PEDIDO DA ESTRELA (D-1853): leva o estado que ela vai ASSUMIR, e não um
 * "alterne". O duplo clique (ou a retransmissão) antes de o retrato voltar lê a
 * estrela ainda apagada duas vezes e manda `marcada: true` duas vezes — o
 * servidor deixa marcada, em vez de marcar e desmarcar.
 */
export function pedidoDaEstrela(id, acesa) {
	return { acao: 'marcar', id: id, marcada: !acesa };
}
