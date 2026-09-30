/**
 * UI/Components/rastreadorDoCodex.js
 *
 * O RASTREADOR DO CODEX (D-1839, 29/09/2026) — as entradas que o jogador
 * MARCOU na janela do Codex, com o contador `abates/alvo`, para acompanhar na
 * tela sem abrir a janela.
 *
 * Pedido do dono, trazido de um jogador: *"Colocar pra poder marcar o codex e
 * aparecer um contador na tela, ao invés de ter que ficar abrindo o codex pra
 * ver a quantidade que matou"*.
 *
 * ## De onde vem o dado
 *
 * O servidor manda a lista pronta (`codexRastreado`) de carona no
 * `ZC_RAGIDLE_MISSOES`, o mesmo carona da bolinha do Codex (`avisoDoCodex.js`,
 * D-1232): é o pacote empurrado a cada abate que conta e forçado na entrada.
 * `MissoesIdle` RECEBE e anota aqui; `MissoesTrackerIdle` só LÊ. Um módulo de
 * um fato só pelo mesmo motivo do aviso: nenhuma das duas janelas é dona.
 *
 * ## Ele não decide nada
 *
 * Quem decide o que está marcado, o teto de 5, o que é "concluída" e quando a
 * entrada sai do rastreador é o servidor (`servidor/codex-marcadas.ts`). O
 * número mostrado é o da janela do Codex (a soma por espécie, cada uma limitada
 * ao alvo dela) — calcular aqui seria a segunda rota escrita à mão.
 */

let lista = [];

/** O servidor mandou a lista (ou nada: pacote de servidor antigo = vazia). */
export function anotarRastreadorDoCodex(valor) {
	lista = Array.isArray(valor) ? valor.filter(l => l && typeof l.id === 'string') : [];
}

/** As entradas acompanhadas agora, na ordem em que foram marcadas. */
export function rastreadorDoCodexAtual() {
	return lista;
}

/** Trocar de personagem esquece: o Codex é DO PERSONAGEM. */
export function limparRastreadorDoCodex() {
	lista = [];
}

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

/** `1500` vira `1.500` — o mesmo ponto de milhar da linha do Logs. */
export function numeroDoRastreador(n) {
	const inteiro = String(Math.trunc(Number(n) || 0));
	return inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * As linhas do rastreador (`<li>`), prontas para o `innerHTML` da lista.
 *
 * Cada linha é um BOTÃO (abre o Codex naquela entrada). A entrada cumprida com
 * prêmio pendente diz "Resgatar" no lugar do número — é o lembrete que falta;
 * resgatada, o servidor a tira da lista sozinho.
 *
 * Lista vazia devolve a dica de como marcar: quem abre a aba "Codex" do cartão
 * no celular sem nada marcado precisa saber de onde as linhas vêm.
 */
export function rastreadorDoCodexHtml(linhas) {
	if (!Array.isArray(linhas) || linhas.length === 0) {
		return '<li class="mt-vazio mt-cx-vazio">Marque até 5 entradas no Codex (☆) para acompanhar aqui.</li>';
	}
	return linhas
		.map(l => {
			const abates = Number(l.abates) || 0;
			const alvo = Number(l.alvo) || 0;
			const pct = alvo > 0 ? Math.min(100, Math.round((abates / alvo) * 100)) : 0;
			const especies = Array.isArray(l.especies) ? l.especies : [];
			// O detalhe por espécie vai no `title`: uma entrada pode pedir três,
			// e a linha da HUD não tem espaço para três contadores.
			const detalhe = especies
				.map(e => `${e.monstro} ${numeroDoRastreador(e.abates)}/${numeroDoRastreador(e.alvo)}`)
				.join(' · ');
			const conta = l.aResgatar
				? '<span class="mt-cx-conta is-resgatar">Resgatar!</span>'
				: `<span class="mt-cx-conta">${numeroDoRastreador(abates)}/${numeroDoRastreador(alvo)}</span>`;
			return `
			<li>
				<button type="button" class="mt-cx-item${l.aResgatar ? ' is-resgatar' : ''}" data-acao="codex-abrir" data-entrada="${escapeHtml(l.id)}" title="${escapeHtml(detalhe || l.titulo)}">
					<span class="mt-cx-nome">${escapeHtml(l.titulo)}</span>
					${conta}
					<span class="mt-cx-barra" aria-hidden="true"><span class="mt-cx-fill" style="width:${pct}%"></span></span>
				</button>
			</li>`;
		})
		.join('');
}
