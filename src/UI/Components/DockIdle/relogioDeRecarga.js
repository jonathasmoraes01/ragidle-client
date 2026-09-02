/**
 * UI/Components/DockIdle/relogioDeRecarga.js
 *
 * As CONTAS do relogio de recarga dos orbes (D-916, 02/09/2026) — sem DOM,
 * para terem teste de unidade como `secoesDaConfig.js` tem.
 *
 * O servidor manda `ZC_SKILL_POSTDELAY` (0x043d) com a duracao do `Cooldown`
 * quando a skill sai; o Dock guarda `{ ate, duracao }` por skill e, a cada
 * passo do relogio, pergunta aqui QUANTO falta e COMO mostrar:
 *
 *  - `fracao` e a parte que AINDA FALTA (1 no instante do disparo, 0 quando
 *    acaba). O CSS a usa num `conic-gradient`: a sombra escura cobre a fatia
 *    que falta e o icone vai sendo revelado em sentido horario a partir do
 *    topo — o "relogio" que o dono pediu.
 *  - `rotulo` e o numero no centro: decimos abaixo de 10 s ("2.4"), segundos
 *    inteiros dali para cima ("12s") — o mesmo formato de D-694, que ja
 *    cabia no orbe de 56px.
 *
 * `duracao` zero ou negativa nao divide por zero: a fracao vira 0 (nada a
 * desenhar), porque um 0x043d com delay zero nem chega a ser guardado
 * (`DockIdle.onSkillDelay` recusa `delayMs <= 0`).
 */

/**
 * @typedef {{ ate: number, duracao: number }} Recarga
 * @typedef {{ restante: number, fracao: number, rotulo: string }} EstadoDaRecarga
 */

/**
 * Quanto falta desta recarga em `agora`.
 *
 * @param {Recarga} recarga
 * @param {number} agora timestamp (ms), o mesmo relogio de `ate`
 * @returns {EstadoDaRecarga}
 */
export function estadoDaRecarga(recarga, agora) {
	const restante = Math.max(0, recarga.ate - agora);
	const fracao = recarga.duracao > 0 ? Math.min(1, restante / recarga.duracao) : 0;
	return { restante, fracao, rotulo: rotuloDeRecarga(restante) };
}

/**
 * O numero do centro do orbe.
 *
 * @param {number} restanteMs
 * @returns {string} '' quando nao ha o que mostrar
 */
export function rotuloDeRecarga(restanteMs) {
	if (!(restanteMs > 0)) {
		return '';
	}
	if (restanteMs >= 10000) {
		return Math.ceil(restanteMs / 1000) + 's';
	}
	return (restanteMs / 1000).toFixed(1);
}

/**
 * O passo do relogio, em ms. Curto o bastante para a fatia andar lisa num
 * orbe de 56px (a 80 ms uma recarga de 2 s avanca ~14 graus por passo) e
 * folgado o bastante para nao disputar o quadro com o render do mapa. O
 * relogio so existe enquanto ha recarga viva (ver `DockIdle.onSkillDelay`).
 */
export const PASSO_DO_RELOGIO_MS = 80;
