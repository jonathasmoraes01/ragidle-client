/**
 * UI/Components/IdleConfig/rascunhoContraOContexto.js
 *
 * RAGIDLE: O RASCUNHO NAO GUARDA O QUE O PERSONAGEM NAO TEM MAIS (07/10/2026,
 * D-2085 — o resto do relato do Templario de D-2084).
 *
 * O rascunho da janela (`IdleConfig.editConfig`) sobrevive a recusa, ao fechar
 * e ao empurrao do servidor (com alteracao pendente, o empurrao so anda a
 * BASE). Depois de um reset de habilidades, ele continuava com a Curar e os
 * golpes que o reset levou — e o servidor recusa a config INTEIRA por uma
 * habilidade nao aprendida na rotacao (contrato, `prove:config-idle`). Pior: com
 * o reset TOTAL, `renderAtaque` nem desenha a lista de golpes (nao ha golpe
 * aprendido), entao a entrada podre ficava INVISIVEL, sem o botao de tirar, e o
 * jogador so saia dali recarregando a pagina.
 *
 * O conserto e a MESMA purga do servidor (`servidor/idle/purga-da-config.ts`,
 * `purgarConfigGravada`), feita no rascunho a cada contexto que chega: o
 * contexto e o retrato do que o personagem tem HOJE, e as listas dele saem do
 * MESMO classificador que a validacao usa (`classificarSkills`). Sai so o que
 * o personagem nao tem mais — nenhuma alteracao legitima depende de uma
 * habilidade que ele nao tem, entao nada que o jogador esta fazendo se perde:
 *
 * | campo | contra | a poda |
 * |---|---|---|
 * | `rotacao` | `skillsAtivas` | tira a entrada; apara o nivel acima do aprendido |
 * | `rotacaoDeBuffs` | `skillsDeBuff` mantiveis | idem |
 * | `cura.habilidades` | `skillsDeCura` | tira a chave; apara o nivel |
 * | `modoDeAtaque: apenas-skills` | a rotacao podada vazia | volta a `skills-e-basico` |
 *
 * LISTA AUSENTE NO CONTEXTO = NAO PODA. Um servidor mais velho (ou um teste com
 * contexto magro) que nao manda a lista nao pode fazer o rascunho perder tudo:
 * sem a lista, nao ha o que comparar. Os `alvosDesabilitados` ficam de fora: o
 * universo deles e o elenco do jogo, que o contexto nao traz (e nao muda com o
 * personagem).
 *
 * Pura e sem mutacao: devolve a config nova, ou `null` quando nada precisou
 * sair (o chamador fica com a MESMA referencia, como na purga do servidor).
 *
 * This file is part of the ragidle fork of ROBrowser.
 */

function ehObjeto(v) {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** `skillId` -> nivel aprendido, ou `null` quando o contexto nao manda a lista. */
function aprendidosDe(lista, filtro) {
	if (!Array.isArray(lista)) {
		return null;
	}
	const mapa = new Map();
	for (const s of lista) {
		if (s && typeof s.skillId === 'string' && (!filtro || filtro(s))) {
			mapa.set(s.skillId, s.aprendido);
		}
	}
	return mapa;
}

/** A entrada com o nivel acima do aprendido aparado; a MESMA referencia quando nao passa. */
function comNivelAparado(entrada, aprendido) {
	const nivel = entrada && entrada.nivelDeUso;
	if (typeof aprendido !== 'number' || typeof nivel !== 'number' || nivel <= aprendido) {
		return entrada;
	}
	return { ...entrada, nivelDeUso: aprendido };
}

/** A lista sem o que nao foi aprendido e com o nivel aparado; a MESMA referencia quando nada muda. */
function listaPodada(lista, aprendidos) {
	if (!Array.isArray(lista) || aprendidos === null) {
		return lista;
	}
	const podada = lista
		// A forma errada (entrada sem `skillId` de texto) fica para a validacao responder.
		.filter(r => !ehObjeto(r) || typeof r.skillId !== 'string' || aprendidos.has(r.skillId))
		.map(r => (ehObjeto(r) && typeof r.skillId === 'string' ? comNivelAparado(r, aprendidos.get(r.skillId)) : r));
	return podada.length === lista.length && podada.every((r, i) => r === lista[i]) ? lista : podada;
}

/**
 * @param {object} cfg o rascunho
 * @param {object} ctx o contexto que acabou de chegar do servidor
 * @returns {object|null} o rascunho podado, ou `null` quando nada mudou
 */
export function podarRascunhoPeloContexto(cfg, ctx) {
	if (!ehObjeto(cfg) || !ehObjeto(ctx)) {
		return null;
	}
	const mudancas = {};

	const rotacao = listaPodada(cfg.rotacao, aprendidosDe(ctx.skillsAtivas));
	if (rotacao !== cfg.rotacao) {
		mudancas.rotacao = rotacao;
	}
	// So o MANTIVEL entra na rotacao de buffs (D-375, `contextoDeValidacaoIdle`).
	// Campo ausente conta como mantivel: o servidor velho nao o mandava.
	const buffs = listaPodada(cfg.rotacaoDeBuffs, aprendidosDe(ctx.skillsDeBuff, b => b.mantivel !== false));
	if (buffs !== cfg.rotacaoDeBuffs) {
		mudancas.rotacaoDeBuffs = buffs;
	}

	// O modo que a rotacao podada vazia deixaria sem ataque nenhum (D-407): so
	// quando foi a PODA que esvaziou — a rotacao que o jogador esvaziou a mao
	// continua com o aviso da janela e a recusa do servidor.
	if (mudancas.rotacao && mudancas.rotacao.length === 0 && cfg.modoDeAtaque === 'apenas-skills') {
		mudancas.modoDeAtaque = 'skills-e-basico';
	}

	const curas = aprendidosDe(ctx.skillsDeCura);
	const habilidades = ehObjeto(cfg.cura) ? cfg.cura.habilidades : undefined;
	if (curas !== null && ehObjeto(habilidades)) {
		const novas = {};
		let mudou = false;
		for (const [skillId, ajuste] of Object.entries(habilidades)) {
			if (!curas.has(skillId)) {
				mudou = true;
				continue;
			}
			const aparado = ehObjeto(ajuste) ? comNivelAparado(ajuste, curas.get(skillId)) : ajuste;
			if (aparado !== ajuste) {
				mudou = true;
			}
			novas[skillId] = aparado;
		}
		if (mudou) {
			mudancas.cura = { ...cfg.cura, habilidades: novas };
		}
	}

	return Object.keys(mudancas).length ? { ...cfg, ...mudancas } : null;
}
