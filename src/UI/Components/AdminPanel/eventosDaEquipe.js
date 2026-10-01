/**
 * UI/Components/AdminPanel/eventosDaEquipe.js
 *
 * OS EVENTOS DE DROP E RESPAWN NO PAINEL DE ADMIN (D-1880, 01/10/2026 — pedido
 * do dono: "modificar a % de drop" e "um evento de respawn X% mais rapido").
 *
 * Quem valida, grava, acende o icone de todo mundo, anuncia como EQUIPE e
 * encerra pelo relogio e o SERVIDOR (`servidor/eventos-do-admin.ts`). Esta
 * janela so mostra o retrato (`eventosDoAdmin` no JSON do painel) e manda o
 * pedido pelo MESMO 0x0ff8 do resto do painel:
 *
 *   { v: 1, eventoDoAdmin: { tipo, iniciar: { porcento, horas } } }
 *   { v: 1, eventoDoAdmin: { tipo, encerrar: true } }
 *
 * Modulo PROPRIO, e puro (sem DOM, sem rede, sem relogio): o `AdminPanel.js`
 * nao tem teste que o levante (ele puxa a sessao e o WebGL), e o que decide o
 * pedido, o fim no relogio local e o HTML da secao precisa de teste. O
 * `AdminPanel.js` so liga os botoes.
 *
 * Os SELETORES sao proprios (`data-evento-da-equipe`, `ap-equipe-*`), e nao os
 * do evento de EXP (`data-evento`, `ap-evento-iniciar`): o EXP liga os botoes
 * dele com `querySelector`, que devolve o PRIMEIRO — um botao daqui com a mesma
 * classe seria ligado ao evento de EXP quando o de EXP nao tivesse o dele.
 */

export const TIPOS_DE_EVENTO_DA_EQUIPE = ['drop', 'respawn'];

/** Os textos de cada tipo. O que fica de fora e o mesmo que o anuncio diz. */
export const TEXTOS_DO_EVENTO_DA_EQUIPE = {
	drop: {
		titulo: 'Evento de Drop',
		campo: 'Drop a mais (%)',
		dica: '+100% dobra a chance. Não vale para cartas, caixas, baús e MVPs.'
	},
	respawn: {
		titulo: 'Evento de Respawn',
		campo: 'Respawn mais rápido (%)',
		dica: '50% faz o monstro voltar na metade do tempo, nunca abaixo de 5 s. Não vale para MVPs e o Covil.'
	}
};

/** O rascunho de quem abre o painel: um evento curto e moderado de cada tipo. */
export function rascunhoInicialDaEquipe() {
	return { drop: { porcento: 50, horas: 24 }, respawn: { porcento: 30, horas: 24 } };
}

/** O pedido de iniciar (ou substituir) o evento de um tipo. */
export function pedidoDeIniciarDaEquipe(tipo, rascunho) {
	return { v: 1, eventoDoAdmin: { tipo, iniciar: { porcento: rascunho.porcento, horas: rascunho.horas } } };
}

/** O pedido de encerrar o evento de um tipo. */
export function pedidoDeEncerrarDaEquipe(tipo) {
	return { v: 1, eventoDoAdmin: { tipo, encerrar: true } };
}

/**
 * O fim do evento NO RELOGIO DESTA MAQUINA: a chegada do retrato + o que falta.
 * A mesma escolha do evento de EXP (`eventoFimLocal`): somar ao relogio local o
 * que falta tira do caminho a diferenca entre os dois relogios. 0 = sem evento.
 */
export function fimLocalDaEquipe(retratoDeUm, agoraLocal) {
	return retratoDeUm && retratoDeUm.ativo ? agoraLocal + retratoDeUm.restanteMs : 0;
}

/** "+50% de drop", "30% mais rápido" — o titulo do estado ativo. */
export function efeitoDaEquipe(tipo, porcento) {
	return tipo === 'drop' ? `+${porcento}% de drop` : `${porcento}% mais rápido`;
}

/**
 * O HTML da secao "Eventos de Drop e Respawn".
 *
 * `ajuda` traz as tres funcoes de texto do painel (`escapeHtml`,
 * `rotuloDeHoras`, `faltamPorExtenso`) e `formatarFim` — injetadas para nao
 * nascer uma segunda copia delas aqui.
 *
 * Os controles reusam as CLASSES de desenho do evento de EXP (`ap-evento`,
 * `ap-chip`, `ap-input`, `ap-evento-acoes`) — e e por isso que a regra de 44px
 * do dedo (`@media (pointer: coarse)` no CSS) ja os alcanca — e tem SELETORES
 * de comportamento proprios (ver o cabecalho).
 */
export function htmlDosEventosDaEquipe({ retrato, rascunho, fimLocal, agoraLocal, ajuda }) {
	if (!retrato) {
		// Servidor anterior a D-1880: sem retrato, sem secao.
		return '';
	}
	const { escapeHtml, rotuloDeHoras, faltamPorExtenso, formatarFim } = ajuda;
	const limites = retrato.limites || { porcento: { drop: [1, 500], respawn: [1, 90] }, horas: [1, 720] };
	const duracoes = retrato.duracoesSugeridasEmHoras || [];

	const blocos = TIPOS_DE_EVENTO_DA_EQUIPE.map(tipo => {
		const evt = retrato[tipo] || { ativo: false };
		const texto = TEXTOS_DO_EVENTO_DA_EQUIPE[tipo];
		const meu = rascunho[tipo];
		const [pMin, pMax] = limites.porcento[tipo];
		const estado = evt.ativo
			? `<div class="ap-evento-estado is-ativo">
					<div class="ap-evento-titulo">${escapeHtml(texto.titulo)} ativo · ${escapeHtml(efeitoDaEquipe(tipo, evt.porcento))}</div>
					<div>Termina ${escapeHtml(formatarFim(fimLocal[tipo]))} · faltam <span class="ap-equipe-faltam" data-faltam-do-evento="${tipo}">${escapeHtml(
						faltamPorExtenso(fimLocal[tipo] - agoraLocal)
					)}</span></div>
					<div class="ap-hint">Iniciado por ${escapeHtml(evt.porQuem)}</div>
				</div>`
			: `<div class="ap-evento-estado">Nenhum ${escapeHtml(texto.titulo)} ativo.</div>`;
		const atalhos = duracoes
			.map(
				h =>
					`<button type="button" class="ap-chip ri-btn${h === meu.horas ? ' is-sel' : ''}" data-horas-do-evento="${tipo}" data-valor="${h}">${escapeHtml(
						rotuloDeHoras(h)
					)}</button>`
			)
			.join('');
		return `
			<div class="ap-evento-da-equipe" data-tipo="${tipo}">
				<h4>${escapeHtml(texto.titulo)}</h4>
				${estado}
				<div class="ap-field-row">
					<label>${escapeHtml(texto.campo)}</label>
					<input type="number" inputmode="numeric" class="ap-input ri-input" data-evento-da-equipe="${tipo}" data-campo="porcento" min="${pMin}" max="${pMax}" value="${meu.porcento}" />
					<span class="ap-hint">${escapeHtml(texto.dica)} <span class="ap-equipe-faixa">${pMin}–${pMax}%</span>.</span>
				</div>
				<div class="ap-field-row">
					<label>Duração (horas)</label>
					<div class="ap-chips">${atalhos}</div>
					<input type="number" inputmode="numeric" class="ap-input ri-input" data-evento-da-equipe="${tipo}" data-campo="horas" min="${limites.horas[0]}" max="${limites.horas[1]}" value="${meu.horas}" />
				</div>
				<div class="ap-evento-acoes">
					${evt.ativo ? `<button type="button" class="ap-equipe-encerrar ri-btn" data-tipo="${tipo}">Encerrar</button>` : ''}
					<button type="button" class="ap-equipe-iniciar ri-btn" data-tipo="${tipo}">${evt.ativo ? 'Substituir' : 'Iniciar'}</button>
				</div>
			</div>`;
	}).join('');

	return `
		<div class="ap-section ri-card ap-evento ap-eventos-da-equipe">
			<h3>Eventos de Drop e Respawn</h3>
			<div class="ap-hint">O anúncio sai para todos como "[Equipe]", e cada evento ganha um ícone com o tempo que falta.</div>
			${blocos}
		</div>`;
}
