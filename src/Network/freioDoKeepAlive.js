/**
 * Network/freioDoKeepAlive.js
 *
 * O KEEPALIVE EM DOBRO (auditoria de desempenho de 15/10/2026).
 *
 * O MapEngine liga o MESMO `sendKeepAlive` em DUAS fontes de tique: o
 * `setInterval` de `Network.setPing` (10 s) e o Worker do `BackgroundTicker`
 * (10 s, o que sobrevive a aba escondida). Com a aba visivel as duas disparam,
 * e saiam DOIS `CZ_REQUEST_TIME2` a cada 10 s. O comentario antigo dizia que o
 * duplicado era inofensivo porque "o servidor so le o carimbo" — mas o
 * MEDIDOR DE PING (`medidorDePing.js`) guarda UM carimbo de envio: o segundo
 * envio sobrescreve o primeiro, e a resposta do primeiro passa a ser medida
 * contra o carimbo do segundo. O ping na tela saia MENOR que o real (ou zero),
 * e o servidor recebia o dobro de pacotes de relogio.
 *
 * O freio: o tique periodico so envia se o ultimo envio foi ha pelo menos
 * `INTERVALO_MINIMO_DO_KEEPALIVE_MS`. Por que 8 s: abaixo dos 10 s das duas
 * fontes (o tique de uma delas sempre passa, com folga para o atraso do
 * timer), e muito abaixo dos 15 s em que o servidor ressincroniza a visao
 * (lacuna > 15 s entre keepalives). Entao o intervalo entre dois envios fica
 * em ~10 s como antes, so que com UM pacote por vez.
 *
 * O envio FORCADO (a volta da aba, `visibilitychange` -> 'visible') NUNCA e
 * freado: e ele que faz o servidor ressincronizar no instante da volta.
 */

export const INTERVALO_MINIMO_DO_KEEPALIVE_MS = 8000;

/**
 * @param {number} intervaloMinimoMs
 * @return {{ deveEnviar: function(number, boolean): boolean }}
 */
export function criarFreioDoKeepAlive(intervaloMinimoMs = INTERVALO_MINIMO_DO_KEEPALIVE_MS) {
	let ultimoEnvioEm = null;

	return {
		/**
		 * Decide e, se for enviar, carimba. Relogio que volta para tras (ajuste
		 * do sistema) nunca prende o keepalive: diferenca negativa conta como
		 * "passou tempo bastante".
		 */
		deveEnviar(agora, forcado) {
			if (forcado !== true && ultimoEnvioEm !== null) {
				const passou = agora - ultimoEnvioEm;
				if (passou >= 0 && passou < intervaloMinimoMs) {
					return false;
				}
			}
			ultimoEnvioEm = agora;
			return true;
		}
	};
}

/**
 * O tique veio de um gesto que exige envio na hora (a volta da aba)? O
 * `setInterval` chama sem argumento; o Worker tambem. So o `BackgroundTicker`,
 * na volta da aba, passa `{ forcado: true }`.
 */
export function tiqueForcado(opcoes) {
	return opcoes !== null && typeof opcoes === 'object' && opcoes.forcado === true;
}
