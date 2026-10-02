/**
 * O NIVEL QUE VAI PARA A BARRA (D-1908) — sem DOM.
 *
 * Pedido do dono: *"preciso que seja possivel alterar o nivel da habilidade
 * ativa que sera usada, seja na barra (manual) ou no automatico"*. Ate aqui a
 * janela de Habilidades entregava a barra SEMPRE no aprendido
 * (`payloadDaHabilidade`): o unico seletor de nivel do cliente mora na
 * `SkillListV2` nativa, que esta desligada por decisao do dono (D-1671,
 * `nuncaAbre`) e nao volta.
 *
 * A escolha vive no detalhe da habilidade, logo acima de "Por na barra", e vale
 * para o arrasto do mouse e para o toque: os dois saem do MESMO payload. Ela
 * e um rascunho de TELA (qual nivel a proxima colocacao leva), e nao estado do
 * servidor — o servidor guarda o nivel no SLOT, como sempre (`atalhos.ts`).
 *
 * Sem escolha, o maximo — e o slot no maximo ACOMPANHA a habilidade quando ela
 * sobe (D-1907, servidor). O escolhido abaixo fica.
 */

import { htmlDoSeletorDeNivel, spDoNivel } from 'UI/nivelDeUso.js';

/**
 * O nivel com que a habilidade vai para a barra: o escolhido (preso ao
 * aprendido) ou, sem escolha, o aprendido.
 *
 * @param {Record<string, number>} escolhas  skillId -> nivel escolhido
 * @param {{skillId:string, aprendido:number}} skill
 */
export function nivelParaABarra(escolhas, skill) {
	const escolhido = escolhas ? escolhas[skill.skillId] : undefined;
	if (typeof escolhido !== 'number') {
		return skill.aprendido;
	}
	return Math.max(1, Math.min(escolhido, skill.aprendido));
}

/**
 * As escolhas depois de um "−"/"+". Chegar ao maximo APAGA a escolha (volta a
 * "maximo, acompanha"); nunca abaixo de 1. Devolve um objeto NOVO.
 */
export function escolhasComPasso(escolhas, skill, passo) {
	const nivel = Math.max(1, Math.min(nivelParaABarra(escolhas, skill) + passo, skill.aprendido));
	const novas = { ...(escolhas || {}) };
	if (nivel >= skill.aprendido) {
		delete novas[skill.skillId];
	} else {
		novas[skill.skillId] = nivel;
	}
	return novas;
}

/**
 * O SP de cada nivel a partir da `mecanica` que o servidor manda (`[0]` =
 * nivel 1). Um nivel ausente da mecanica vira buraco, e o seletor entao nao
 * mostra SP para ele — nunca um numero emprestado de outro nivel.
 */
export function spPorNivelDaMecanica(skill) {
	const custos = [];
	for (const m of (skill && skill.mecanica) || []) {
		if (m && typeof m.nivel === 'number' && typeof m.sp === 'number') {
			custos[m.nivel - 1] = m.sp;
		}
	}
	return custos;
}

/**
 * O bloco "Nivel de uso [−] Nv 7/10 · 22 SP [+]" do detalhe, ou '' quando nao
 * ha o que escolher: habilidade que nao vai para a barra, ou de um nivel so.
 *
 * @param {{skillId:string, aprendido:number, nome?:string, mecanica?:object[]}} skill
 * @param {Record<string, number>} escolhas
 * @param {boolean} serveParaABarra  a mesma condicao do botao "Por na barra"
 */
export function htmlDoNivelParaABarra(skill, escolhas, serveParaABarra) {
	if (!serveParaABarra || !(skill.aprendido > 1)) {
		return '';
	}
	const nivel = nivelParaABarra(escolhas, skill);
	return (
		'<div class="is-nivel-uso">' +
		'<span class="is-nivel-uso-rotulo" title="O nível com que a habilidade vai para a barra de atalhos">Nível de uso</span>' +
		htmlDoSeletorDeNivel({
			chave: `barra.${skill.skillId}`,
			nivel,
			aprendido: skill.aprendido,
			fixo: nivel < skill.aprendido,
			sp: spDoNivel(spPorNivelDaMecanica(skill), nivel),
			nome: skill.nome || skill.skillId
		}) +
		'</div>'
	);
}
