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
import {
	missaoAceita,
	podeIniciarMissao,
	textoDoLimiteDeMissoes
} from 'UI/Components/MissoesIdle/podeIniciarMissao.js'; // RAGIDLE: I16
// ATE TRES MISSOES AO MESMO TEMPO (01/10/2026): os botoes da aceita e o estado
// como o jogador o le saem das MESMAS regras puras da janela e do cartao.
import { acoesDaMissaoAceita, estadoParaOJogador } from 'UI/Components/MissoesIdle/missoesAceitas.js';
// A linha "Cai de" do objetivo de coleta (26/09/2026): a MESMA da janela de
// Missoes — esta aba e a porta do menu, e sem ela o botao so existia na
// janela que o jogador abre pelo rastreador.
import { linhaDoCaiDe } from 'UI/Components/MissoesIdle/ondeCaiHtml.js';

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
	// 01/10/2026: aceita e com tudo cumprido — falta so o "Finalizar". O glifo
	// e o da andamento (ela ainda nao foi entregue).
	pronta: { rotulo: 'Pronta para finalizar', glifo: 'espadas', classe: 'is-andamento' },
	disponivel: { rotulo: 'Disponível', glifo: 'alvo', classe: 'is-disponivel' },
	bloqueada: { rotulo: 'Bloqueada', glifo: 'cadeado', classe: 'is-bloqueado' }
};

/**
 * O estado de uma linha, como o JOGADOR o le (`estadoParaOJogador`, 01/10/2026):
 * a aceita esta "Em andamento" (ou "Pronta"), e a abandonada com o progresso
 * guardado volta a "Disponível" — nada anda nela ate ele aceitar de novo.
 */
function estadoDaMissao(m, execucao) {
	return ESTADO_DA_MISSAO[estadoParaOJogador(m, execucao)] || ESTADO_DA_MISSAO.bloqueada;
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
 * A ordem e a de `podeIniciarMissao`: a recarga diz PORQUE o jogador nao pode
 * agir agora, e isso e mais util do que um progresso que nao vai mudar
 * sozinho. So quando ela nao trava e que o progresso do (unico) objetivo
 * aparece.
 *
 * 01/10/2026: a FILA saiu ("Na fila" nao existe mais — ate tres missoes andam
 * juntas), e a missao PRONTA para finalizar diz "Pronta" antes de tudo: e a
 * acao que o jogador tem a fazer, e o "8 de 8" nao a nomeia.
 *
 * @param {{pronta?: boolean, cooldownS?: number, objetivos?: Array}} missao
 * @returns {{texto: string} | null}
 */
export function contadorDaLinha(missao) {
	if (missao.pronta === true) {
		return { texto: 'Pronta' };
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
				const s = estadoDaMissao(m, execucao);
				// ACEITA, e nao "a ativa" (01/10/2026): ate tres andam juntas, e
				// todas ganham o destaque e a fita.
				const aceita = missaoAceita(m, execucao);
				const objetivoUnico = Array.isArray(m.objetivos) && m.objetivos.length === 1 ? m.objetivos[0] : null;
				const contador = contadorDaLinha(m);
				// O FIO so mede o objetivo quando ele e quem manda no contador — em
				// recarga a barra nao avanca sozinha, e desenha-la mesmo assim
				// prometeria um progresso que nao esta rolando.
				const pct =
					objetivoUnico && !(m.cooldownS > 0) ? porcentagem(objetivoUnico.progresso, objetivoUnico.alvo) : 0;
				return (
					'<button type="button" class="cx-jor-capitulo ' +
					escapeHtml(s.classe) +
					(aceita ? ' is-proximo' : '') +
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
					(aceita ? '<span class="cx-jor-fita">Em andamento</span>' : '') +
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
	const s = estadoDaMissao(m, execucao);

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
				'</div>' +
				linhaDoCaiDe(o, m)
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
	// como as mesmas funcoes puras (`podeIniciarMissao`, `acoesDaMissaoAceita`)
	// em vez de reescritas.
	//
	// 01/10/2026: o "Pausar" que morava aqui estava MORTO desde que o servidor
	// tirou o verbo `pausar` (ele virou o `teleporte`, D-1642) — o botao existia
	// e nao fazia nada. Com ate tres aceitas, cada uma tem Finalizar (aceso so
	// quando `pronta`), Ir caçar e Abandonar, todos com o id da missao; a fila
	// ("Na fila…") deixou de existir.
	let acao = '';
	if (m.executavel) {
		if (missaoAceita(m, execucao)) {
			acao = acoesDaMissaoAceita(m)
				.map(
					a =>
						'<button type="button" class="ri-btn ' +
						(a.destaque ? 'ri-btn--ouro' : 'ri-btn--sec') +
						'" data-mg-executar="' +
						a.acao +
						'" data-mg-id="' +
						escapeHtml(m.id) +
						'"' +
						(a.habilitado ? '' : ' disabled') +
						' title="' +
						escapeHtml(a.titulo) +
						'">' +
						escapeHtml(a.rotulo) +
						'</button>'
				)
				.join('');
		} else if (podeIniciarMissao(m, execucao)) {
			acao =
				'<button type="button" class="ri-btn ri-btn--ouro" data-mg-executar="iniciar" data-mg-id="' +
				escapeHtml(m.id) +
				'">Iniciar</button>';
		} else if (podeIniciarMissao(m, execucao, { ignorarLimite: true })) {
			// O TETO: comecaria, se nao fossem as tres aceitas. O botao fica,
			// apagado, dizendo por que (a mesma escolha da janela de Missoes).
			acao =
				'<button type="button" class="ri-btn ri-btn--sec cx-mg-limite" disabled title="Finalize ou abandone uma missão para aceitar outra">' +
				escapeHtml(textoDoLimiteDeMissoes(execucao)) +
				'</button>';
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
		// O "Finalizar" apagado e o "3 de 3" nao mandam nada (o navegador ja nao
		// dispara clique em botao desabilitado; esta guarda cobre quem o dispare
		// por fora). O clique continua TRATADO: nao vaza para a linha de baixo.
		if (executar.disabled) {
			return true;
		}
		ganchos.executar(executar.dataset.mgExecutar, executar.dataset.mgId || null);
		return true;
	}

	const viajar = alvo.closest('[data-mg-viajar]');
	if (viajar) {
		e.stopImmediatePropagation();
		ganchos.viajar(viajar.dataset.mgViajar);
		return true;
	}

	// O "Ir ao mapa" da linha "Cai de" (26/09/2026).
	const ondeCai = alvo.closest('[data-onde-cai]');
	if (ondeCai) {
		e.stopImmediatePropagation();
		ganchos.ondeCai(ondeCai.dataset.ondeCai, ondeCai.dataset.missaoId || null);
		return true;
	}

	return false;
}

export { SUBABAS, SUBABA_PADRAO };
