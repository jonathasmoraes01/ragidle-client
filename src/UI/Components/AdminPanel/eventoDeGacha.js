/**
 * UI/Components/AdminPanel/eventoDeGacha.js
 *
 * O EVENTO DE GACHA NO PAINEL DE ADMIN (D-1900, 01/10/2026 — pedido do dono:
 * "modificar temporariamente a porcentagem de algum gacha especifico" e "que
 * seja modificavel dentro do painel admin (dentro do game)").
 *
 * Quem valida (a caixa, o multiplicador que cabe no pool), grava, acende o
 * icone de todo mundo, anuncia como EQUIPE com o multiplicador, poe o selo na
 * caixa da loja e encerra pelo relogio e o SERVIDOR
 * (`servidor/temporada/evento-de-gacha.ts`). Esta janela so mostra o retrato
 * (`eventosDoAdmin.gacha` no JSON do painel) e manda o pedido pelo MESMO 0x0ff8
 * do resto do painel:
 *
 *   { v: 1, eventoDoAdmin: { tipo: 'gacha', iniciar: { pool, lendario, raro, horas } } }
 *   { v: 1, eventoDoAdmin: { tipo: 'gacha', encerrar: true } }
 *
 * Modulo PROPRIO e puro (sem DOM, sem rede, sem relogio), pela razao de
 * `eventosDaEquipe.js`: o `AdminPanel.js` nao tem teste que o levante (ele puxa
 * a sessao e o WebGL), e o que decide o pedido, o rascunho e o HTML precisa de
 * teste. O `AdminPanel.js` so liga os botoes.
 *
 * Os SELETORES sao proprios (`data-gacha-*`, `ap-gacha-*`): o evento de EXP liga
 * os botoes dele com `querySelector`, que devolve o PRIMEIRO, e o drop/respawn
 * usam `data-evento-da-equipe` / `data-horas-do-evento`. Os controles reusam as
 * CLASSES de desenho (`ap-evento`, `ap-chip`, `ap-input`, `ap-evento-acoes`) — e
 * e por isso que a regra de 44px do dedo (`@media (pointer: coarse)`) ja os
 * alcanca.
 */

/**
 * O rascunho da secao: o que o administrador esta montando, ate apertar
 * Iniciar. O de antes fica se a caixa dele ainda e uma das que o servidor
 * oferece; senao, um Lendario 2x de 24 h na PRIMEIRA caixa do catalogo. Sem
 * caixa nenhuma, `pool` vazio — e o servidor recusa dizendo quais existem.
 */
export function rascunhoDoGacha(atual, retrato) {
	const caixas = (retrato && retrato.caixas) || [];
	if (atual && caixas.some(c => c.pool === atual.pool)) {
		return atual;
	}
	return { pool: caixas.length > 0 ? caixas[0].pool : '', lendario: 2, raro: 1, horas: 24 };
}

/** O pedido de iniciar (ou substituir) o evento de gacha. */
export function pedidoDeIniciarDoGacha(rascunho) {
	return {
		v: 1,
		eventoDoAdmin: {
			tipo: 'gacha',
			iniciar: { pool: rascunho.pool, lendario: rascunho.lendario, raro: rascunho.raro, horas: rascunho.horas }
		}
	};
}

/** O pedido de encerrar o evento de gacha. */
export function pedidoDeEncerrarDoGacha() {
	return { v: 1, eventoDoAdmin: { tipo: 'gacha', encerrar: true } };
}

/**
 * O HTML da secao "Evento de Gacha".
 *
 * `ajuda` traz as funcoes de texto do painel (`escapeHtml`, `rotuloDeHoras`,
 * `faltamPorExtenso`, `formatarFim`) — injetadas para nao nascer uma segunda
 * copia delas aqui. O rotulo do multiplicador ("Lendário 2x") vem PRONTO do
 * servidor (`retrato.rotulo`): a mesma frase do anuncio, e nunca uma segunda
 * conta na janela.
 */
export function htmlDoEventoDeGacha({ retrato, rascunho, fimLocal, agoraLocal, ajuda }) {
	if (!retrato) {
		// Servidor anterior a D-1900: sem retrato, sem secao.
		return '';
	}
	const { escapeHtml, rotuloDeHoras, faltamPorExtenso, formatarFim } = ajuda;
	const limites = retrato.limites || { multiplicador: [1, 10], horas: [1, 720] };
	const [mMin, mMax] = limites.multiplicador;
	const duracoes = retrato.duracoesSugeridasEmHoras || [];
	const caixas = retrato.caixas || [];

	const estado = retrato.ativo
		? `<div class="ap-evento-estado is-ativo">
				<div class="ap-evento-titulo">Evento de Gacha ativo · ${escapeHtml(retrato.caixa)}: ${escapeHtml(retrato.rotulo)}</div>
				<div>Termina ${escapeHtml(formatarFim(fimLocal))} · faltam <span class="ap-equipe-faltam" data-faltam-do-gacha="1">${escapeHtml(
					faltamPorExtenso(fimLocal - agoraLocal)
				)}</span></div>
				<div class="ap-hint">Iniciado por ${escapeHtml(retrato.porQuem)}</div>
			</div>`
		: '<div class="ap-evento-estado">Nenhum Evento de Gacha ativo.</div>';

	const escolhas = caixas
		.map(
			c =>
				`<button type="button" class="ap-chip ri-btn${c.pool === rascunho.pool ? ' is-sel' : ''}" data-gacha-caixa="${escapeHtml(c.pool)}">${escapeHtml(
					c.nome
				)}</button>`
		)
		.join('');
	const atalhos = duracoes
		.map(
			h =>
				`<button type="button" class="ap-chip ri-btn${h === rascunho.horas ? ' is-sel' : ''}" data-gacha-horas="${h}">${escapeHtml(
					rotuloDeHoras(h)
				)}</button>`
		)
		.join('');
	const campoDeMultiplicador = (campo, rotulo) =>
		`<div class="ap-field-row">
				<label>${rotulo}</label>
				<input type="number" inputmode="decimal" step="0.1" class="ap-input ri-input" data-gacha-campo="${campo}" min="${mMin}" max="${mMax}" value="${rascunho[campo]}" />
			</div>`;

	return `
		<div class="ap-section ri-card ap-evento ap-evento-de-gacha">
			<h3>Evento de Gacha</h3>
			<div class="ap-hint">Multiplica a chance do lendário (e, se quiser, do raro) de UMA caixa da temporada; o que sobe sai dos comuns. Vale na hora de ABRIR, inclusive para a caixa comprada antes. O anúncio sai para todos como "[Equipe]" com o multiplicador, e a loja mostra um selo na caixa.</div>
			${estado}
			<div class="ap-field-row">
				<label>Caixa</label>
				<div class="ap-chips">${escolhas}</div>
			</div>
			<div class="ap-evento-bonus">
				${campoDeMultiplicador('lendario', 'Lendário (x)')}
				${campoDeMultiplicador('raro', 'Raro (x)')}
			</div>
			<div class="ap-hint ap-gacha-dica">1 = como no catálogo; até <span class="ap-equipe-faixa">${mMax}x</span>, com uma casa decimal. Pelo menos um acima de 1.</div>
			<div class="ap-field-row">
				<label>Duração (horas)</label>
				<div class="ap-chips">${atalhos}</div>
				<input type="number" inputmode="numeric" class="ap-input ri-input" data-gacha-campo="horas" min="${limites.horas[0]}" max="${limites.horas[1]}" value="${rascunho.horas}" />
			</div>
			<div class="ap-evento-acoes">
				${retrato.ativo ? '<button type="button" class="ap-gacha-encerrar ri-btn">Encerrar</button>' : ''}
				<button type="button" class="ap-gacha-iniciar ri-btn">${retrato.ativo ? 'Substituir' : 'Iniciar'}</button>
			</div>
		</div>`;
}
