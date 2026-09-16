/**
 * UI/Components/CodexIdle/missoesGeraisHtml.js
 *
 * A ABA "MISSÕES GERAIS" (16/09/2026, pedido do dono): a janela de Missões
 * (`MissoesIdle`) INTEGRADA nesta mesma janela do Códex, com o visual da
 * lista "A jornada inteira" — linha inteira clicável, glifo de estado em vez
 * de selo escrito, fio de progresso, sem cartão.
 *
 * ---------------------------------------------------------------------------
 * POR QUE UM ARQUIVO SEPARADO, IGUAL A `jornadaHtml.js`
 * ---------------------------------------------------------------------------
 * Pelo MESMO motivo de lá: fotografável sem o cliente inteiro de pé. Ele
 * depende de três coisas e nada mais — `ri-icones.js`, `podeIniciarMissao.js`
 * (a regra pura, já testada em `pode-iniciar-missao.test.ts`) e o CONTEXTO que
 * chega pronto (as missões e a execução, no mesmo formato de
 * `MissoesIdle.missoes`/`.execucao`).
 *
 * ---------------------------------------------------------------------------
 * A JANELA `MissoesIdle` CONTINUA EXISTINDO, DE PROPÓSITO
 * ---------------------------------------------------------------------------
 * "Integrar" aqui significa SOMAR uma porta, não fechar a outra. `MissoesIdle`
 * é lida por `MapEngine`, `TopMenuIdle`, `MissoesTrackerIdle`, `LFGIdle`,
 * `PasseIdle`, `TutorialIdle` (o tutorial guiado tem etapa apontando para o
 * botão dela) e `ChatBox` (o cálculo de degraus de altura). Aposentar a janela
 * nesta rodada arriscaria seis sistemas que não foram tocados aqui. A aba nova
 * é um SEGUNDO caminho até o mesmo dado — o servidor já é a fonte única
 * (`ZC_RAGIDLE_MISSOES`), e as duas telas o leem sem discordar.
 *
 * ---------------------------------------------------------------------------
 * COMO OS DOIS LEEM O MESMO PACOTE SEM BRIGAR
 * ---------------------------------------------------------------------------
 * `Network.hookPacket` SOBRESCREVE o handler do pacote — um segundo hook aqui
 * roubaria `MissoesIdle`. Esta aba não fisga `ZC_RAGIDLE_MISSOES`: ela lê
 * `MissoesIdle.missoes`/`.execucao` por POLLING de 250ms, o mesmo idioma que
 * `MissoesTrackerIdle.js` já usa pelo mesmo motivo (comentário no cabeçalho de
 * lá). O fiar (`CZ_RAGIDLE_PEDIR_MISSOES`) sai desta aba ao ser aberta —
 * `CodexIdle.js` manda, igual `MissoesIdle.toggle()` já mandava.
 *
 * ---------------------------------------------------------------------------
 * O ESTADO É O MESMO VOCABULÁRIO DA JORNADA, SÓ QUE FEMININO
 * ---------------------------------------------------------------------------
 * O servidor manda os MESMOS quatro estados (`bloqueada`, `disponível`,
 * `em-andamento`, `concluída`) — só o gênero muda ("missão" é feminino,
 * "capítulo" é masculino). As CLASSES CSS reaproveitam as de
 * `.cx-jor-capitulo` (`is-concluido`/`is-andamento`/`is-disponivel`/
 * `is-bloqueado` são só tokens, gênero não entra no seletor); só o RÓTULO
 * visível muda.
 *
 * @author RagIdle
 */

import RiIcones from 'UI/ri-icones.js';
import { podeIniciarMissao } from 'UI/Components/MissoesIdle/podeIniciarMissao.js'; // RAGIDLE: I16

/** O contexto da renderização em curso — mesmo idioma de `jornadaHtml.js`. */
let _ctx = {};

/** Mesmo helper privado de `jornadaHtml.js` / `MissoesIdle.js` / etc. */
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

function glifo(chave) {
	return RiIcones[chave] || '';
}

/**
 * O estado de uma MISSÃO (gênero feminino) — mesmas classes/glifos de
 * `ESTADOS_DA_JORNADA` (`jornadaDeMidgard.js`), rótulo em português correto.
 * Ver o cabeçalho: a classe CSS é token, não concorda em gênero; o texto sim.
 */
const ESTADO_DA_MISSAO = {
	concluida: { rotulo: 'Concluída', glifo: 'confere', classe: 'is-concluido' },
	'em-andamento': { rotulo: 'Em andamento', glifo: 'espadas', classe: 'is-andamento' },
	disponivel: { rotulo: 'Disponível', glifo: 'alvo', classe: 'is-disponivel' },
	bloqueada: { rotulo: 'Bloqueada', glifo: 'cadeado', classe: 'is-bloqueado' }
};

function estadoDaMissao(estado) {
	return ESTADO_DA_MISSAO[estado] || ESTADO_DA_MISSAO.bloqueada;
}

/** Progresso 0..100, sem nunca passar de 100 (a mesma guarda de `porcentagem`
 * em `jornadaDeMidgard.js` — uma barra maior que a moldura é defeito visual
 * de um retrato legítimo, não motivo para desenhar torto). */
function porcentagem(feitos, meta) {
	const b = Number(meta) || 0;
	if (b <= 0) return 0;
	return Math.min(100, Math.round((Math.max(0, Number(feitos) || 0) / b) * 100));
}

/**
 * O TEXTO DO CONTADOR NA LINHA DA LISTA — pura, e exportada para o teste
 * travar a ordem (achado ao fotografar, 16/09/2026: "Recarga de Poções" em
 * recarga mostrava "0 de 10" em vez de "5 min", porque o progresso do
 * objetivo era olhado ANTES da recarga).
 *
 * A ordem e a MESMA de `podeIniciarMissao`: fila e recarga dizem PORQUE o
 * jogador nao pode agir agora, e isso e mais util do que um progresso que
 * nao vai mudar sozinho. So quando nenhum dos dois trava e que o progresso
 * do (unico) objetivo aparece.
 *
 * @param {{naFila?: boolean, cooldownS?: number, objetivos?: Array}} missao
 * @returns {{texto: string} | null}
 */
export function contadorDaLinha(missao) {
	if (missao.naFila) {
		return { texto: 'Na fila' };
	}
	if (missao.cooldownS > 0) {
		return { texto: Math.ceil(missao.cooldownS / 60) + ' min' };
	}
	const objetivos = Array.isArray(missao.objetivos) ? missao.objetivos : [];
	if (objetivos.length === 1) {
		const o = objetivos[0];
		return { texto: o.progresso + ' de ' + o.alvo };
	}
	return null;
}

/** As duas abas de sempre — MESMO par que `MissoesIdle.html` já tinha. */
const SUBABAS = ['principais', 'opcionais'];
const SUBABA_PADRAO = 'principais';

/**
 * O corpo da aba "Missões Gerais".
 *
 * @param {{missoes: object[], execucao: object|null, vista: 'lista'|'missao',
 *   subaba: 'principais'|'opcionais', missaoAberta: string|null}} contexto
 */
export function missoesGeraisHtml(contexto) {
	_ctx = contexto || {};
	const missoes = Array.isArray(_ctx.missoes) ? _ctx.missoes : null;

	if (missoes === null) {
		return '<div class="cx-carregando">Carregando…</div>';
	}

	if (_ctx.vista === 'missao' && _ctx.missaoAberta) {
		return telaDaMissaoHtml(_ctx.missaoAberta);
	}

	return telaDaListaHtml(missoes);
}

/** O trilho Principais/Opcionais — MESMO desenho do trilho Mapa/Jornada. */
function subtrilhoHtml() {
	const atual = _ctx.subaba === 'opcionais' ? 'opcionais' : 'principais';
	return (
		'<div class="cx-jor-trilho">' +
		'<button type="button" class="cx-jor-trilho-item ri-tab' +
		(atual === 'principais' ? ' is-active' : '') +
		'" data-mg-subaba="principais">Principais</button>' +
		'<button type="button" class="cx-jor-trilho-item ri-tab' +
		(atual === 'opcionais' ? ' is-active' : '') +
		'" data-mg-subaba="opcionais">Opcionais</button>' +
		'</div>'
	);
}

/** TELA A — a lista, no MESMO desenho de linha de `.cx-jor-capitulo`. */
function telaDaListaHtml(missoes) {
	const tipoDaAba = _ctx.subaba === 'opcionais' ? 'opcional' : 'principal';
	const daAba = missoes.filter(m => m && m.tipo === tipoDaAba);
	const execucao = _ctx.execucao || {};

	if (daAba.length === 0) {
		return (
			subtrilhoHtml() +
			'<div class="cx-vazio">' +
			(tipoDaAba === 'opcional'
				? 'Nenhuma missão opcional por enquanto — em breve.'
				: 'Nenhuma missão principal disponível.') +
			'</div>'
		);
	}

	return (
		subtrilhoHtml() +
		'<div class="cx-jor-capitulos">' +
		daAba
			.map((m, i) => {
				const s = estadoDaMissao(m.estado);
				const ativa = execucao.ativaId === m.id;
				const objetivoUnico = Array.isArray(m.objetivos) && m.objetivos.length === 1 ? m.objetivos[0] : null;
				const contador = contadorDaLinha(m);
				// O FIO so mede o objetivo quando ele e quem manda no contador — em
				// fila ou recarga a barra nao avanca sozinha, e desenha-la mesmo
				// assim prometeria um progresso que nao esta rolando.
				const pct =
					objetivoUnico && !m.naFila && !(m.cooldownS > 0)
						? porcentagem(objetivoUnico.progresso, objetivoUnico.alvo)
						: 0;
				return (
					'<button type="button" class="cx-jor-capitulo ' +
					escapeHtml(s.classe) +
					(ativa ? ' is-proximo' : '') +
					'" data-mg-missao="' +
					escapeHtml(m.id || '') +
					'" title="' +
					escapeHtml(m.titulo + ' — ' + s.rotulo) +
					'">' +
					'<span class="cx-jor-capitulo-ordem">' +
					String(i + 1) +
					'</span>' +
					'<span class="cx-jor-capitulo-texto">' +
					'<span class="cx-jor-capitulo-nome">' +
					(ativa ? '<span class="cx-jor-fita">Em curso</span>' : '') +
					escapeHtml(m.titulo || m.id) +
					'</span>' +
					(m.descricao ? '<span class="cx-jor-capitulo-abertura">' + escapeHtml(m.descricao) + '</span>' : '') +
					'</span>' +
					'<span class="cx-jor-capitulo-lado">' +
					'<span class="cx-jor-capitulo-estado" aria-hidden="true">' +
					glifo(s.glifo) +
					'</span>' +
					// A prioridade (recarga/fila antes do objetivo) mora em
					// `contadorDaLinha`, pura e testada — ver o comentario dela.
					(contador ? '<span class="cx-jor-contador">' + escapeHtml(contador.texto) + '</span>' : '') +
					'</span>' +
					'<span class="cx-jor-capitulo-seta" aria-hidden="true">&rsaquo;</span>' +
					(pct > 0 && pct < 100
						? '<span class="cx-jor-fio" aria-hidden="true"><i style="width:' + pct + '%"></i></span>'
						: '') +
					'</button>'
				);
			})
			.join('') +
		'</div>'
	);
}

/** O botão de VOLTAR para a lista — par do `voltarHtml` de `jornadaHtml.js`. */
function voltarHtml() {
	return (
		'<button type="button" class="cx-jor-voltar" data-mg-voltar="1">' +
		glifo('desfazer') +
		'<span>Todas as missões</span></button>'
	);
}

/** TELA B — uma missão inteira: descrição, objetivos, recompensas, classes
 * (na Troca de Classe) e o botão do executor. */
function telaDaMissaoHtml(id) {
	const missoes = Array.isArray(_ctx.missoes) ? _ctx.missoes : [];
	const m = missoes.find(x => x && x.id === id);
	if (!m) {
		return voltarHtml() + '<div class="cx-vazio">Esta missão não está no retrato do servidor.</div>';
	}
	const execucao = _ctx.execucao || {};
	const s = estadoDaMissao(m.estado);

	const objetivos = (m.objetivos || [])
		.map(
			o =>
				'<div class="cx-jor-objetivo">' +
				'<span>' +
				escapeHtml(o.descricao) +
				'</span>' +
				'<span class="cx-jor-contador">' +
				escapeHtml(o.progresso) +
				' de ' +
				escapeHtml(o.alvo) +
				'</span>' +
				'</div>'
		)
		.join('');

	const recompensas =
		m.recompensas && m.recompensas.length
			? '<p class="cx-jor-missao-premio">Recompensas: ' +
				escapeHtml(m.recompensas.map(r => r.rotulo).join(', ')) +
				'</p>'
			: '';

	// A grade de classes (Troca de Classe): informa sempre que a missão está
	// viva, o botão de viajar só quando o SERVIDOR disse "disponível" — mesma
	// regra que `MissoesIdle.js:cardDeMissao` já seguia.
	const classes =
		m.classes && m.classes.length && m.estado !== 'concluida'
			? '<div class="cx-mg-classes">' +
				m.classes
					.map(
						c =>
							'<div class="cx-mg-classe">' +
							'<span class="cx-mg-classe-nome">' +
							escapeHtml(c.nomePt) +
							'</span>' +
							'<span class="cx-mg-classe-onde">' +
							escapeHtml(c.mestre) +
							' · ' +
							escapeHtml(c.cidade) +
							'</span>' +
							'<span class="cx-mg-classe-resumo">' +
							escapeHtml(c.resumo) +
							'</span>' +
							(c.bloqueadaPor
								? '<span class="cx-mg-classe-bloqueio">Conclua antes a ' + escapeHtml(c.bloqueadaPor) + '</span>'
								: m.estado === 'disponivel'
									? '<button type="button" class="cx-jor-ir ri-btn" data-mg-viajar="' +
										escapeHtml(c.mapa) +
										'">Ir até o NPC</button>'
									: '') +
							'</div>'
					)
					.join('') +
				'</div>'
			: '';

	// O botão do executor: MESMA regra de `MissoesIdle.js:cardDeMissao`, aqui
	// como uma unica funcao pura (`podeIniciarMissao`) em vez de reescrita.
	let acao = '';
	if (m.executavel) {
		if (execucao.ativaId === m.id) {
			acao = '<button type="button" class="ri-btn ri-btn--sec" data-mg-executar="pausar">Pausar</button>';
		} else if (m.naFila) {
			acao = '<span class="cx-jor-contador">Na fila…</span>';
		} else if (podeIniciarMissao(m, execucao)) {
			acao =
				'<button type="button" class="ri-btn ri-btn--ouro" data-mg-executar="iniciar" data-mg-id="' +
				escapeHtml(m.id) +
				'">Iniciar</button>';
		} else if (m.cooldownS > 0) {
			acao = '<span class="cx-jor-contador">Recarrega em ' + Math.ceil(m.cooldownS / 60) + ' min</span>';
		}
	}

	return (
		voltarHtml() +
		'<div class="cx-jor-cabeca">' +
		'<span class="cx-jor-capitulo-estado cx-mg-cabeca-glifo ' +
		escapeHtml(s.classe) +
		'" aria-hidden="true">' +
		glifo(s.glifo) +
		'</span>' +
		'<div>' +
		'<div class="cx-jor-cabeca-titulo">' +
		escapeHtml(m.titulo || m.id) +
		'</div>' +
		(m.descricao ? '<div class="cx-jor-cabeca-abertura">' + escapeHtml(m.descricao) + '</div>' : '') +
		'</div>' +
		'</div>' +
		(m.estado === 'bloqueada' && m.requisito
			? '<p class="cx-jor-missao-premio">' + escapeHtml(m.requisito) + '</p>'
			: '') +
		objetivos +
		recompensas +
		classes +
		(acao ? '<div class="cx-mg-rodape">' + acao + '</div>' : '')
	);
}

/**
 * Delegação no corpo — mesmo idioma de `cliqueDaJornada` em `CodexIdle.js`.
 *
 * @returns {boolean} true quando o clique era desta aba e já foi tratado.
 */
export function cliqueDeMissoesGerais(e, alvo, ganchos) {
	const linha = alvo.closest('[data-mg-missao]');
	if (linha) {
		e.stopImmediatePropagation();
		ganchos.abrirMissao(linha.dataset.mgMissao);
		return true;
	}

	const voltar = alvo.closest('[data-mg-voltar]');
	if (voltar) {
		e.stopImmediatePropagation();
		ganchos.voltarParaLista();
		return true;
	}

	const subaba = alvo.closest('[data-mg-subaba]');
	if (subaba) {
		e.stopImmediatePropagation();
		ganchos.trocarSubaba(subaba.dataset.mgSubaba);
		return true;
	}

	const executar = alvo.closest('[data-mg-executar]');
	if (executar) {
		e.stopImmediatePropagation();
		ganchos.executar(executar.dataset.mgExecutar, executar.dataset.mgId || null);
		return true;
	}

	const viajar = alvo.closest('[data-mg-viajar]');
	if (viajar) {
		e.stopImmediatePropagation();
		ganchos.viajar(viajar.dataset.mgViajar);
		return true;
	}

	return false;
}

export { SUBABAS, SUBABA_PADRAO };
