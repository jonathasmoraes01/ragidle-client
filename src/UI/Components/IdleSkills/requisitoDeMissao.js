/**
 * UI/Components/IdleSkills/requisitoDeMissao.js
 *
 * RAGIDLE: A MISSAO APARECE NOS PRE-REQUISITOS (10/09/2026).
 *
 * Pedido do dono, com o print da Luz Divina na mao: *"Essas habilidades que
 * precisam de quest, precisa estar ali descrito no pre-requisito tambem, ok?"*
 * A janela dizia *"Sem pre-requisito — da para comecar por ela."* para uma
 * habilidade que so se aprende concluindo uma missao — a unica linha da caixa
 * afirmava o contrario do que a etiqueta "quest · Luz Sagrada" logo acima dizia.
 *
 * O dado ja atravessava o fio: `missaoQueEnsina` (`{ id, titulo, tipo }`,
 * contrato de skills v4) e `deQuest`. Faltava a linha.
 *
 * A linha e CUMPRIDA quando a habilidade ja esta aprendida: o jogo so ensina a
 * habilidade de missao pela missao (D-1189), entao ter o nivel e ter concluido.
 * O cliente nao recebe o estado da missao em si — mostrar "em andamento" daqui
 * seria adivinhar.
 */

/**
 * A linha de pre-requisito da missao, ou `null` quando a habilidade nao e de
 * missao (inclusive a de quest que o jogo da de graca, sem missao ligada).
 *
 * @param {{ deQuest?: boolean, missaoQueEnsina?: { titulo?: string } | null }} skill
 * @param {number} nivelAtual o nivel efetivo (com o rascunho da janela)
 * @returns {{ ok: boolean, texto: string } | null}
 */
export function linhaDaMissaoNoRequisito(skill, nivelAtual) {
	if (!skill || !skill.deQuest) return null;
	const missao = skill.missaoQueEnsina;
	if (!missao || typeof missao.titulo !== 'string' || missao.titulo === '') return null;
	return {
		ok: Number(nivelAtual) >= 1,
		texto: 'Concluir a missão "' + missao.titulo + '"'
	};
}
