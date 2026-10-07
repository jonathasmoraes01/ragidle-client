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
 * MESMO classificador que a validacao usa (`classificarSkills`).
 *
 * | campo | contra | a poda |
 * |---|---|---|
 * | `rotacao` | `skillsAtivas` | tira a entrada |
 * | `rotacaoDeBuffs` | `skillsDeBuff` mantiveis | tira a entrada |
 * | `cura.habilidades` | `skillsDeCura` | tira a chave |
 *
 * SO TIRA O QUE O PERSONAGEM NAO TEM — e NAO reescreve escolha nenhuma (a regra
 * do servidor desde a emenda de D-2084):
 *
 * - o NIVEL escolhido acima do aprendido FICA. O servidor aceita o gravado ate
 *   `MAX_SKILL_LEVEL` e conjura no `min` (D-1905: o 7 com a skill hoje no 5 sai
 *   no 5 e volta ao 7 quando ela subir), e esta janela ja DESENHA o `min`
 *   (`nivelEfetivoDaEntrada`, `nivelDaCura`, `UI/nivelDeUso.js`). Aparar aqui
 *   faria o Aplicar apagar a escolha;
 * - o MODO fica. `apenas-skills` com a rotacao que a poda esvaziou e recusado
 *   pelo servidor com o motivo (D-407), e a saida esta na propria janela: a
 *   caixa "Nunca dar o golpe basico" continua marcada e habilitada. Trocar o
 *   modo aqui desfaria a escolha de quem marcou a caixa — no servidor, a mesma
 *   conversao fez o mago que reaprendia passar a socar.
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

/** Os `skillId` aprendidos, ou `null` quando o contexto nao manda a lista. */
function aprendidosDe(lista, filtro) {
	if (!Array.isArray(lista)) {
		return null;
	}
	const nomes = new Set();
	for (const s of lista) {
		if (s && typeof s.skillId === 'string' && (!filtro || filtro(s))) {
			nomes.add(s.skillId);
		}
	}
	return nomes;
}

/** A lista sem o que nao foi aprendido; a MESMA referencia quando nada sai. */
function listaPodada(lista, aprendidos) {
	if (!Array.isArray(lista) || aprendidos === null) {
		return lista;
	}
	// A forma errada (entrada sem `skillId` de texto) fica para a validacao responder.
	const podada = lista.filter(r => !ehObjeto(r) || typeof r.skillId !== 'string' || aprendidos.has(r.skillId));
	return podada.length === lista.length ? lista : podada;
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

	const curas = aprendidosDe(ctx.skillsDeCura);
	const habilidades = ehObjeto(cfg.cura) ? cfg.cura.habilidades : undefined;
	if (curas !== null && ehObjeto(habilidades)) {
		const ficam = Object.entries(habilidades).filter(([skillId]) => curas.has(skillId));
		if (ficam.length !== Object.keys(habilidades).length) {
			// `habilidades: {}` e nao o campo apagado: o campo presente continua presente.
			mudancas.cura = { ...cfg.cura, habilidades: Object.fromEntries(ficam) };
		}
	}

	return Object.keys(mudancas).length ? { ...cfg, ...mudancas } : null;
}
