/**
 * A NOVA TENTATIVA DE UM ARQUIVO DO SERVIDOR DE ASSETS (23/09/2026, relato do
 * open beta: *"Can't find file prt_fild07.rsw"*).
 *
 * O arquivo EXISTE - produção o servia com 200 na mesma noite. O que falhava
 * era UMA tentativa: `FileManager.getHTTP` pedia uma vez só, e qualquer
 * soluço (a rede do celular, o servidor de assets reiniciando no deploy e
 * relendo o GRF, um 429 do freio) virava "arquivo não existe" e o mapa não
 * carregava.
 *
 * Tenta de novo o que é PASSAGEIRO e nunca o que é definitivo: 404 é o
 * servidor dizendo que o arquivo não existe (a maioria dos sprites
 * ausentes), e repetir um 404 só multiplicaria pedido sem mudar a resposta.
 */

/** Quantas novas tentativas, além da primeira. */
export const NOVAS_TENTATIVAS_DE_ARQUIVO = 3;

/** A espera antes de cada nova tentativa, em ms (1 s, 2 s, 4 s). */
export const ESPERAS_DE_ARQUIVO_MS = [1000, 2000, 4000];

/**
 * A falha pede outra tentativa?
 *
 * @param {number|null} status - o status HTTP, ou `null` quando a rede falhou
 *   (nenhuma resposta chegou)
 * @param {number} feitas - quantas novas tentativas já foram feitas (0 na primeira falha)
 * @returns {boolean}
 */
export function devoTentarDeNovo(status, feitas) {
	if (feitas >= NOVAS_TENTATIVAS_DE_ARQUIVO) {
		return false;
	}
	if (status === null) {
		return true;
	}
	return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

/**
 * Quanto esperar antes da nova tentativa número `feitas` (0 = a primeira nova).
 *
 * @param {number} feitas
 * @returns {number}
 */
export function esperaAntesDaTentativa(feitas) {
	return ESPERAS_DE_ARQUIVO_MS[Math.min(feitas, ESPERAS_DE_ARQUIVO_MS.length - 1)];
}
