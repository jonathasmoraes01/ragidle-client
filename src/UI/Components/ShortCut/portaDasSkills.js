/**
 * UI/Components/ShortCut/portaDasSkills.js
 *
 * A PORTA DAS SKILLS DA BARRA para quem mostra skill FORA dela (15/10/2026, o arco de skills em volta do
 * botao Auto da HUD mobile premium, `CombatCornerIdle`).
 *
 * Quem USA uma skill e quem recebe a RECARGA dela (o 0x043d, `Skill.js:onSetSkillDelay`) continua sendo a
 * barra de atalhos (`ShortCut.js`): o arco nao abre um segundo caminho de uso nem um segundo gancho no pacote.
 * Esta porta existe porque importar o `ShortCut.js` arrasta o grafo inteiro dele (a janela de skills, a de
 * guilda, a do homunculo, as entidades com canvas) para dentro de quem so quer pedir "use a skill 46" e
 * ouvir "a 46 entrou em recarga". A barra abastece a porta no carregamento dela; o arco so importa a porta.
 *
 * Sem dependencia nenhuma, para o teste alcancar em jsdom.
 *
 * This file is part of the ragidle fork of ROBrowser.
 */

/** Quem usa a skill de verdade: `ShortCut.useSkill`, registrado pela barra. */
let _usar = null;

/** Quem desenha relogio de recarga fora da barra. */
const _ouvintesDaRecarga = new Set();

/** A barra registra o caminho de uso dela (uma vez, no carregamento). */
export function registrarUsoDeSkill(fn) {
	_usar = typeof fn === 'function' ? fn : null;
}

/**
 * Usa a skill pelo caminho da barra. `nivel` undefined = o nivel escolhido na janela de skills.
 *
 * @returns {boolean} false se a barra ainda nao registrou o caminho (nada foi pedido)
 */
export function usarSkill(skillId, nivel) {
	if (!_usar) {
		return false;
	}
	_usar(skillId, nivel);
	return true;
}

/**
 * Ouve as recargas que a barra recebe. `skillId` null = o atraso de TODAS (o POSTDELAY global).
 *
 * @returns {Function} solta o ouvinte
 */
export function aoRecarga(fn) {
	_ouvintesDaRecarga.add(fn);
	return () => _ouvintesDaRecarga.delete(fn);
}

/** A barra avisa cada recarga que recebe. Um ouvinte que falha nao derruba os outros nem a barra. */
export function avisarRecarga(skillId, delay) {
	for (const fn of _ouvintesDaRecarga) {
		try {
			fn(skillId, delay);
		} catch (err) {
			console.error('[ShortCut] ouvinte da recarga falhou', err);
		}
	}
}

/** So para testes: volta a porta ao estado de fabrica. */
export function esquecerPortaParaTeste() {
	_usar = null;
	_ouvintesDaRecarga.clear();
}
