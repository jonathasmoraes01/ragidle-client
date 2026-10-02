/**
 * UI/Components/IdleSkills/habilidadesNoIdioma.js
 *
 * A HABILIDADE NO IDIOMA DO JOGADOR (D-1929, o jogo em ingles).
 *
 * O servidor manda o nome e a caixa de descricao de cada habilidade em
 * portugues (`ZC_RAGIDLE_SKILLS`, 0x0ffa), a caixa como LISTA de linhas. A
 * janela parte essa lista em resumo e tabela por nivel antes de desenhar, e
 * o tradutor das janelas so ve os pedacos — que o catalogo nao conhece: o
 * catalogo (`i18n/en/dados-habilidades.json` no repositorio do jogo) tem a
 * caixa INTEIRA, as linhas juntadas por `\n`. Entao a caixa e traduzida na
 * CHEGADA, inteira, e volta a ser lista; a leitura (`resumoDaDescricao.js`,
 * `buildMecanicaRows`) entende os rotulos ingleses (`Description:`,
 * `[Lv N]:`).
 *
 * Em portugues (o padrao) o tradutor esta desligado e nada muda.
 *
 * @author RagIdle
 */

import { traducaoDe, traduzir } from 'Core/Traducao.js';

/**
 * Traduz, NO LUGAR, o nome e a caixa de descricao de cada habilidade.
 *
 * @param {Array<{nome?: string, descricao?: string[]}>} skills
 * @returns {Array} a mesma lista
 */
export function habilidadesNoIdioma(skills) {
	if (!Array.isArray(skills)) {
		return skills;
	}
	for (const skill of skills) {
		if (!skill) {
			continue;
		}
		if (typeof skill.nome === 'string') {
			skill.nome = traduzir(skill.nome);
		}
		if (Array.isArray(skill.descricao) && skill.descricao.length > 0) {
			const emIngles = traducaoDe(skill.descricao.join('\n'));
			if (emIngles !== null) {
				skill.descricao = emIngles.split('\n');
			}
		}
	}
	return skills;
}
