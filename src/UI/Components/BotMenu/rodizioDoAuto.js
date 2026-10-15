/**
 * UI/Components/BotMenu/rodizioDoAuto.js
 *
 * AS SKILLS EM VOLTA DO BOTAO AUTO (pedido do dono, 15/10/2026, na HUD mobile premium): *"o botao ali
 * vermelho seria para ativar e desativar o auto combate e as skills em volta dele seriam as 3 selecionadas
 * no automatico"*.
 *
 * Quem sao "as 3 selecionadas no automatico": o RODIZIO da secao Ataque do Bot (`editorDoRodizio.js`) - a
 * lista `skills.geral` da config que o SERVIDOR confirmou (`serverConfig`, e nao o rascunho da janela: o
 * arco mostra o que o Bot esta usando de fato), na ordem dela, ate tres. O teto e o do proprio rodizio.
 *
 * Puro (sem DOM, sem rede), para o teste alcancar: recebe o estado do Bot e devolve o que o arco desenha.
 *
 * This file is part of the ragidle fork of ROBrowser.
 */

/** Quantas skills cabem no arco: o teto do rodizio do Bot. */
export const TETO_DO_ARCO = 3;

/**
 * @typedef {object} SkillDoArco
 * @property {number} skillId
 * @property {string} nome
 * @property {string|null} chave o AegisName, que da o icone publicado (`/ragidle/skills/<chave>.png`)
 * @property {number|null} nivel o nivel que o Bot usa; null = o aprendido ainda nao chegou (quem usa a skill
 *   cai no nivel escolhido da janela de skills)
 * @property {boolean} ativa false = o jogador a desligou no rodizio (o Bot a pula)
 */

/**
 * @param {object|null} estado o `estado()` do Bot (`estadoDoBot.js`)
 * @returns {SkillDoArco[]}
 */
export function rodizioDoAuto(estado) {
	const config = estado && estado.serverConfig;
	const geral = config && config.skills && Array.isArray(config.skills.geral) ? config.skills.geral : [];
	if (!geral.length) {
		return [];
	}
	const conhecidas = estado && Array.isArray(estado.skills) ? estado.skills : [];
	const porId = new Map(conhecidas.map(s => [s.skillId, s]));
	const porSkill = config.skills.porSkill || {};
	return geral.slice(0, TETO_DO_ARCO).map(e => {
		const s = porId.get(e.skillId) || null;
		const aprendido = s && Number.isInteger(s.aprendido) && s.aprendido > 0 ? s.aprendido : null;
		const nivel =
			e.nivel === 'aprendido' ? aprendido : Number.isInteger(e.nivel) && e.nivel > 0 ? e.nivel : aprendido;
		const regra = porSkill[String(e.skillId)];
		return {
			skillId: e.skillId,
			nome: s && s.nome ? s.nome : '#' + e.skillId,
			chave: s && s.chave ? s.chave : null,
			nivel,
			ativa: !regra || regra.ativa !== false
		};
	});
}

/** Uma assinatura do que o arco desenha: quem ouve so e avisado quando ela muda. */
export function assinaturaDoRodizio(itens) {
	return itens
		.map(i => `${i.skillId}:${i.nivel === null ? '-' : i.nivel}:${i.ativa ? 1 : 0}:${i.chave || ''}`)
		.join('|');
}
