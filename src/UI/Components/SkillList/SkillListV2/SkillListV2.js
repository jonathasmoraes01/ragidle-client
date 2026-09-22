/**
 * UI/Components/SkillList/SkillListV2/SkillListV2.js
 *
 * Chararacter Skill Window (Episode 13.1 renewal redesign: tabbed list + tree
 * views with skill-point pre-distribution / apply / reset).
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import { createSkillList } from '../SkillListCommon.js';
import htmlText from './SkillListV2.html?raw';
import cssText from './SkillListV2.css?raw';

export default createSkillList({
	name: 'SkillListV2',
	htmlText: htmlText,
	cssText: cssText,
	hasTabs: true,
	needSkillListKey: '_NeedSkillList',
	showDescOnMiniHover: false,
	touchDrag: true,
	incrementalRemember: true,
	guardMissingJob: true,
	readdSkillOnUpdate: true,
	dragFrom: 'SkillList',
	// D-1671 (ordem do dono, 21/09/2026): a barra classica de skills nao abre
	// mais por caminho nenhum. A janela CONTINUA preparada e recebendo dados -
	// o ponto de skill do menu e a barra de atalhos leem dela -, ela so nao
	// aparece. A versao da preferencia sobe junto para descartar o `show: true`
	// ja gravado na maquina de quem jogou antes.
	nuncaAbre: true,
	versaoDaPreferencia: 1.1
});
