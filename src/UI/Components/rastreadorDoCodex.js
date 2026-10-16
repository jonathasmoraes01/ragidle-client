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
 *
 * ## A diferença (`v: 5`, D-2543, 15/10/2026)
 *
 * O parcial `v: 2` ainda trazia o rastreador INTEIRO a cada abate, e o que
 * muda é o contador de uma ou duas entradas. O servidor agora numera tudo que
 * traz o rastreador inteiro (`codexRastreadoRev`, por conexão) e, para quem
 * DECLAROU que aplica, manda só as TROCAS (`[caminho, valor]`) sobre a revisão
 * `de`: `{v: 5, parcial: 'codexRastreadoDif', de, rev, trocas}`. A aplicação é
 * a mesma da Temporada e da janela de habilidades (`aplicarTrocas`), e o que
 * sai daqui é a MESMA lista que o inteiro traria — o desenho não muda.
 *
 * A declaração é a da janela de habilidades (`precisaDeclarar`): ao receber um
 * inteiro numerado cuja revisão não passa da última declarada (a primeira vez,
 * e a conexão nova, que recomeça do 1), o cliente manda
 * `{acao: 'declarar-rastreador', base}` no `CZ_RAGIDLE_MISSAO_ACAO`.
 */

import { aplicarTrocas } from './TemporadaIdle/parcialDaTemporada.js';

let lista = [];

/** A revisão do rastreador que está na mão (`null`: nenhuma, ou servidor antigo). */
let rev = null;

/** A última revisão mandada na declaração (`null`: ainda não declarou). */
let revDeclarada = null;

/** O verbo do `CZ_RAGIDLE_MISSAO_ACAO` que declara a diferença (D-2543). */
export const ACAO_QUE_DECLARA_O_RASTREADOR = 'declarar-rastreador';

/** As linhas válidas de uma lista do servidor (lixo vira vazia). */
function linhasValidas(valor) {
	return Array.isArray(valor) ? valor.filter(l => l && typeof l.id === 'string') : [];
}

/**
 * O servidor mandou a lista inteira (ou nada: pacote de servidor antigo =
 * vazia), com a revisão dela quando o servidor numera (D-2543).
 */
export function anotarRastreadorDoCodex(valor, revisao) {
	lista = linhasValidas(valor);
	rev = typeof revisao === 'number' ? revisao : null;
}

/**
 * O CORPO PARCIAL do `ZC_RAGIDLE_MISSOES` (D-1853, 30/09/2026): só o
 * rastreador, sem a lista de missões.
 *
 * O contador anda a cada abate, e antes a lista inteira (~17 KB) descia junto,
 * com um `render()` da janela de missões por abate. Agora o servidor manda
 * `{v: 2, parcial: 'codexRastreado', codexRastreado}` quando SÓ o rastreador
 * mudou. `v: 2` de propósito: o cliente de antes lia `v !== 1` e ignora o
 * parcial, em vez de trocar a lista por uma vazia.
 */
export function ehCorpoParcialDoRastreador(dados) {
	return !!dados && dados.v === 2 && dados.parcial === 'codexRastreado';
}

/** A DIFERENÇA do rastreador (`v: 5`, D-2543): só as trocas, sobre a revisão `de`. */
export function ehCorpoDiferencaDoRastreador(dados) {
	return !!dados && dados.v === 5 && dados.parcial === 'codexRastreadoDif';
}

/**
 * Aplica a diferença sobre a lista que está na mão. Devolve `false` quando ela
 * não cai (sem revisão, `de` não é a que está aqui, trocas podres): a revisão
 * some, as diferenças seguintes também não caem, e quem chama pede a lista
 * inteira. A lista da tela fica a de antes até o inteiro chegar.
 */
export function aplicarDiferencaDoRastreador(dados) {
	if (!ehCorpoDiferencaDoRastreador(dados) || rev === null || dados.de !== rev || !Array.isArray(dados.trocas)) {
		rev = null;
		return false;
	}
	const montada = aplicarTrocas(lista, dados.trocas);
	if (!Array.isArray(montada)) {
		rev = null;
		return false;
	}
	lista = linhasValidas(montada);
	rev = typeof dados.rev === 'number' ? dados.rev : null;
	return true;
}

/** A revisão que está na mão. */
export function revisaoDoRastreador() {
	return rev;
}

/**
 * O inteiro que acabou de chegar pede uma DECLARAÇÃO? Devolve o corpo do
 * `CZ_RAGIDLE_MISSAO_ACAO` (e lembra a revisão declarada) ou `null`. Sim quando
 * o servidor numera e esta revisão não passa da última declarada: a primeira
 * vez, e a conexão nova (a revisão recomeça do 1) — a regra de
 * `precisaDeclarar` da janela de habilidades.
 */
export function declaracaoDoRastreador() {
	if (rev === null || (revDeclarada !== null && rev > revDeclarada)) {
		return null;
	}
	revDeclarada = rev;
	return { acao: ACAO_QUE_DECLARA_O_RASTREADOR, base: rev };
}

/** As entradas acompanhadas agora, na ordem em que foram marcadas. */
export function rastreadorDoCodexAtual() {
	return lista;
}

/** Trocar de personagem esquece: o Codex é DO PERSONAGEM (a revisão e a declaração também). */
export function limparRastreadorDoCodex() {
	lista = [];
	rev = null;
	revDeclarada = null;
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
