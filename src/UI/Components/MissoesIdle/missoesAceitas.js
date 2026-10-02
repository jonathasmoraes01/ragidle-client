/**
 * UI/Components/MissoesIdle/missoesAceitas.js
 *
 * AS MISSOES ACEITAS, LIDAS DO PACOTE (01/10/2026, pedido do dono).
 *
 * *"permitir até 3 missões ao mesmo tempo, sem entrar na 'fila'"*. O jogador
 * aceita ate `execucao.maximo` missoes; todas andam juntas (o abate conta para
 * todas, a coleta conta o que esta na mochila), e a missao nunca move o
 * personagem sozinha. Cada aceita tem "Ir caçar", "Abandonar", o "(i)" e o
 * "Finalizar" — aceso SO quando o servidor diz `pronta: true`.
 *
 * Este modulo e PURO (sem DOM, sem rede, sem estado), pelo mesmo motivo de
 * `podeIniciarMissao.js`: tres telas leem estas respostas (a janela de
 * Missoes, o cartao da HUD e a aba "Missões Gerais" do Codex), e o painel "(i)"
 * e a quarta. Cada uma desenha do seu jeito; o que aparece e decidido AQUI, uma
 * vez, com teste que executa (`tests/ui/missoesSimultaneas.test.js`).
 *
 * ── QUEM DECIDE E O SERVIDOR ─────────────────────────────────────────────
 * `aceita` e `pronta` chegam prontos. Esta tela NAO recalcula "pronta" a partir
 * dos objetivos: um objetivo de coleta conta o que esta na mochila AGORA, e so
 * o servidor sabe o que ele aceita na entrega. Um "Finalizar" aceso pela conta
 * do cliente e recusado pelo servidor seria o pior dos dois mundos.
 */

import { missaoAceita } from './podeIniciarMissao.js';

/**
 * As aceitas, na ORDEM DE ACEITE (`execucao.aceitas`), e depois qualquer
 * `aceita: true` que a lista nao tenha nomeado (pacote incoerente: mostra em
 * vez de esconder). O personagem antigo com mais de tres, herdadas da fila de
 * antes, ve TODAS — o teto so impede aceitar outra.
 *
 * @param {Array<object>} missoes
 * @param {{aceitas?: string[]}|null} execucao
 * @returns {Array<object>}
 */
export function missoesAceitasEmOrdem(missoes, execucao) {
	const lista = Array.isArray(missoes) ? missoes.filter(m => m && typeof m.id === 'string') : [];
	const porId = new Map(lista.map(m => [m.id, m]));
	const ordem = execucao && Array.isArray(execucao.aceitas) ? execucao.aceitas : [];
	const saida = [];
	const vistos = new Set();
	for (const id of ordem) {
		const m = porId.get(id);
		if (m && !vistos.has(id)) {
			saida.push(m);
			vistos.add(id);
		}
	}
	for (const m of lista) {
		if (!vistos.has(m.id) && missaoAceita(m, execucao)) {
			saida.push(m);
			vistos.add(m.id);
		}
	}
	return saida;
}

/** O objetivo chegou ao alvo? Sem numero, conta como NAO completo. */
export function objetivoCompleto(o) {
	const p = Number(o && o.progresso);
	const a = Number(o && o.alvo);
	return Number.isFinite(p) && Number.isFinite(a) && a > 0 && p >= a;
}

/** O primeiro objetivo que ainda falta, ou `null`. */
export function objetivoPendente(missao) {
	const objetivos = missao && Array.isArray(missao.objetivos) ? missao.objetivos : [];
	return objetivos.find(o => o && !objetivoCompleto(o)) || null;
}

/**
 * Para onde o "Ir caçar" leva: o primeiro objetivo PENDENTE que traz `mapa`.
 * `null` esconde o botao — missao pronta (nao ha o que cacar) ou nenhum
 * objetivo pendente com mapa (o servidor nao teria para onde mandar).
 *
 * @returns {{mapa: string, rotulo: string}|null}
 */
export function destinoDeCaca(missao) {
	if (!missao || missao.pronta === true) {
		return null;
	}
	const objetivos = Array.isArray(missao.objetivos) ? missao.objetivos : [];
	const alvo = objetivos.find(o => o && !objetivoCompleto(o) && typeof o.mapa === 'string' && o.mapa !== '');
	if (!alvo) {
		return null;
	}
	return { mapa: alvo.mapa, rotulo: typeof alvo.mapaRotulo === 'string' && alvo.mapaRotulo ? alvo.mapaRotulo : alvo.mapa };
}

/**
 * Os botoes de uma missao ACEITA, na ordem em que aparecem. Cada tela poe o
 * atributo dela (`data-executar`, `data-acao`, `data-mg-executar`, ...); o
 * QUE aparece e quando acende sai daqui.
 *
 * - "Finalizar" existe sempre, e so ACENDE com `pronta` (pedido do dono:
 *   *"ENABLED ONLY when all objectives are complete"*). Apagado ele ensina que
 *   o botao existe e o que falta para usa-lo.
 * - "Ir caçar" so existe com destino (ver `destinoDeCaca`).
 * - "Abandonar" existe sempre: o progresso fica guardado no servidor.
 *
 * @returns {Array<{acao: string, rotulo: string, habilitado: boolean, destaque: boolean, titulo: string}>}
 */
export function acoesDaMissaoAceita(missao) {
	const pronta = !!(missao && missao.pronta === true);
	const acoes = [
		{
			acao: 'finalizar',
			rotulo: 'Finalizar',
			habilitado: pronta,
			destaque: pronta,
			titulo: pronta ? 'Entrega a missão e recebe a recompensa' : 'Complete todos os objetivos para finalizar'
		}
	];
	const destino = destinoDeCaca(missao);
	if (destino) {
		acoes.push({
			acao: 'teleporte',
			rotulo: 'Ir caçar',
			habilitado: true,
			destaque: false,
			titulo: `Leva você a ${destino.rotulo}`
		});
	}
	acoes.push({
		acao: 'abandonar',
		rotulo: 'Abandonar',
		habilitado: true,
		destaque: false,
		titulo: 'O progresso fica guardado'
	});
	return acoes;
}

/**
 * O estado como o JOGADOR o le — o vocabulario de 01/10/2026:
 *
 * - `pronta`: aceita e o servidor disse que da para finalizar;
 * - `em-andamento`: aceita (todas as aceitas estao em andamento juntas);
 * - `disponivel`: nao aceita e pode comecar. Inclui o `em-andamento` do
 *   servidor SEM aceite (abandonada com o progresso guardado): para quem joga
 *   ela nao esta "em andamento" — nada anda nela ate ele aceitar de novo;
 * - `bloqueada` / `concluida`: como o servidor manda.
 *
 * @returns {'pronta'|'em-andamento'|'disponivel'|'bloqueada'|'concluida'}
 */
export function estadoParaOJogador(missao, execucao) {
	if (!missao) {
		return 'bloqueada';
	}
	if (missaoAceita(missao, execucao)) {
		return missao.pronta === true ? 'pronta' : 'em-andamento';
	}
	if (missao.estado === 'em-andamento') {
		return 'disponivel';
	}
	if (missao.estado === 'disponivel' || missao.estado === 'concluida' || missao.estado === 'bloqueada') {
		return missao.estado;
	}
	return 'bloqueada';
}

/**
 * O passo de uma aceita, para o cartao da HUD: o texto do primeiro objetivo
 * que falta ("Caçar 25 Poring") com o progresso dele, ou "Pronta para
 * finalizar!" quando o servidor diz que esta.
 *
 * @returns {{texto: string, progresso: number|null, alvo: number|null}}
 */
export function passoDaMissaoAceita(missao) {
	if (missao && missao.pronta === true) {
		return { texto: 'Pronta para finalizar!', progresso: null, alvo: null };
	}
	const o = objetivoPendente(missao);
	if (!o) {
		// Tudo no alvo, mas o servidor ainda nao a disse pronta (o retrato pode
		// estar uma fatia atras): nada de "Finalizar" aceso pela conta daqui.
		const objetivos = missao && Array.isArray(missao.objetivos) ? missao.objetivos : [];
		return { texto: objetivos.length ? 'Objetivos completos' : '', progresso: null, alvo: null };
	}
	const progresso = Number(o.progresso);
	const alvo = Number(o.alvo);
	return {
		texto: String(o.descricao == null ? '' : o.descricao),
		progresso: Number.isFinite(progresso) ? progresso : null,
		alvo: Number.isFinite(alvo) && alvo > 0 ? alvo : null
	};
}

/** Progresso 0..100 de `feitos/meta`, com teto (a barra nunca passa da moldura). */
export function porcentagemDoObjetivo(feitos, meta) {
	const b = Number(meta) || 0;
	if (b <= 0) {
		return 0;
	}
	return Math.min(100, Math.round((Math.max(0, Number(feitos) || 0) / b) * 100));
}

/**
 * O CONTADOR DO TUTORIAL (etapa 10, "o objetivo anda a cada monstro").
 *
 * Antes era `execucao.passo.progresso`, o passo da UNICA ativa. Sem ativa, a
 * pergunta passa a ser feita a PRIMEIRA aceita (`execucao.aceitas[0]`, a que o
 * cartao da HUD desenha com `.mt-ativa`, que e onde a etapa aponta). A SOMA dos
 * objetivos dela, e nao so o primeiro: se o primeiro ja estiver completo (uma
 * coleta que a mochila ja cobre), so a soma anda quando o monstro morre.
 *
 * @returns {number}
 */
export function progressoDaPrimeiraAceita(missoes, execucao) {
	const primeira = missoesAceitasEmOrdem(missoes, execucao)[0];
	if (!primeira || !Array.isArray(primeira.objetivos)) {
		return 0;
	}
	return primeira.objetivos.reduce((soma, o) => soma + (Number(o && o.progresso) || 0), 0);
}

/* ═══════════════════════════════════════════════════════════════════════
   O CORPO PARCIAL DE PROGRESSO (`v: 3`)
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * `{v: 3, parcial: 'progresso', progressos: {[id]: number[]}, prontas: string[]}`
 * — o que o servidor manda na maioria dos abates e mudancas de mochila, no
 * lugar da lista inteira (~17 KB). `v: 3` pelo mesmo motivo do parcial do
 * rastreador (`v: 2`, D-1853): o cliente de antes so le `v === 1` e IGNORA o
 * parcial, em vez de trocar a lista por uma vazia.
 */
export function ehCorpoParcialDeProgresso(dados) {
	return !!dados && dados.v === 3 && dados.parcial === 'progresso';
}

/**
 * Funde o parcial na lista que a ultima lista inteira trouxe, SEM jogar fora o
 * resto do estado: so `objetivos[j].progresso` e `pronta` mudam.
 *
 * AS DUAS METADES TEM ALCANCES DIFERENTES, e isso e do contrato: `progressos`
 * traz SO as missoes cujo progresso mudou desde o ultimo corpo (as outras ficam
 * como estao — ausencia ali nao e "zerou"); `prontas` e a lista INTEIRA das
 * aceitas prontas para finalizar, entao o `pronta` de TODA missao e refeito por
 * ela (quem saiu da lista deixou de estar pronta — a mochila perdeu o item).
 *
 * Devolve uma lista NOVA (e objetos novos so para as missoes que mudaram), para
 * quem compara por assinatura ver a mudanca, e `mudou: false` com a MESMA lista
 * quando nada mudou — o abate que nao toca missao nenhuma nao redesenha nada.
 *
 * `divergentes` nomeia as missoes cujo parcial nao casa com a lista (numero de
 * objetivos diferente, ou id que a lista nao tem): o indice `j` so vale contra
 * a MESMA lista que o servidor tem, e aplicar por cima de uma lista de outra
 * forma poria o progresso no objetivo errado. Essas ficam como estavam, e quem
 * chama pede a lista inteira de novo.
 *
 * @param {Array<object>} missoes
 * @param {{progressos?: Object<string, number[]>, prontas?: string[]}} dados
 * @returns {{missoes: Array<object>, mudou: boolean, divergentes: string[]}}
 */
export function aplicarProgressoParcial(missoes, dados) {
	const lista = Array.isArray(missoes) ? missoes : [];
	const progressos = dados && dados.progressos && typeof dados.progressos === 'object' ? dados.progressos : {};
	const prontas = dados && Array.isArray(dados.prontas) ? new Set(dados.prontas) : null;
	const divergentes = [];
	const conhecidas = new Set();
	let mudou = false;

	const saida = lista.map(m => {
		if (!m || typeof m.id !== 'string') {
			return m;
		}
		conhecidas.add(m.id);
		const objetivos = Array.isArray(m.objetivos) ? m.objetivos : [];
		let novosObjetivos = objetivos;
		const novos = Object.prototype.hasOwnProperty.call(progressos, m.id) ? progressos[m.id] : undefined;
		if (novos !== undefined) {
			if (!Array.isArray(novos) || novos.length !== objetivos.length) {
				divergentes.push(m.id);
			} else if (novos.some((p, j) => typeof p === 'number' && objetivos[j] && objetivos[j].progresso !== p)) {
				novosObjetivos = objetivos.map((o, j) => (typeof novos[j] === 'number' && o ? { ...o, progresso: novos[j] } : o));
			}
		}
		const pronta = prontas ? prontas.has(m.id) : m.pronta === true;
		if (novosObjetivos === objetivos && pronta === (m.pronta === true)) {
			return m;
		}
		mudou = true;
		return { ...m, objetivos: novosObjetivos, pronta };
	});

	for (const id of Object.keys(progressos)) {
		if (!conhecidas.has(id)) {
			divergentes.push(id);
		}
	}

	return { missoes: mudou ? saida : lista, mudou, divergentes };
}
