/**
 * RAGIDLE: o MEDIDOR DE PING (23/09/2026, open beta: o dono relatou "ping de
 * 250" e o jogo nao tinha como dizer quanto era).
 *
 * O roBrowser herdado calculava `SP.value = SP.pongTime - SP.pingTime` com o
 * `pongTime` zerado a mao ("TODO: check the time ?") - o numero era sempre
 * negativo e nada o mostrava. Aqui o ping e o tempo REAL de ida e volta do
 * keepalive (`CZ_REQUEST_TIME2` -> `ZC_NOTIFY_TIME`), medido no relogio da aba.
 *
 * Ele inclui a rede E o tempo que o servidor levou para responder: um tique do
 * servidor travado aparece aqui como ping alto, que e exatamente o que o
 * jogador sente.
 *
 * O numero mostrado e a MEDIANA das ultimas amostras: uma resposta atrasada
 * por um alt-tab (aba congelada) nao vira "lag" sozinha na tela.
 */

export const AMOSTRAS_DO_PING = 5;

/** A faixa de cor do indicador: bom, medio ou ruim. */
export function faixaDoPing(ms) {
	if (ms === null) return 'sem-medida';
	if (ms < 100) return 'bom';
	if (ms < 200) return 'medio';
	return 'ruim';
}

export function criarMedidorDePing(maximoDeAmostras = AMOSTRAS_DO_PING) {
	let enviadoEm = null;
	const amostras = [];

	return {
		/** O keepalive saiu agora. */
		enviou(agora) {
			enviadoEm = agora;
		},
		/** A resposta chegou agora; devolve a amostra, ou `null` sem envio pendente. */
		respondeu(agora) {
			if (enviadoEm === null) return null;
			const rtt = Math.max(0, agora - enviadoEm);
			enviadoEm = null;
			amostras.push(rtt);
			while (amostras.length > maximoDeAmostras) amostras.shift();
			return rtt;
		},
		/** A mediana das ultimas amostras, em ms inteiros; `null` sem nenhuma. */
		valor() {
			if (amostras.length === 0) return null;
			const ordenadas = [...amostras].sort((a, b) => a - b);
			return Math.round(ordenadas[Math.floor(ordenadas.length / 2)]);
		},
		/** Troca de mapa ou de personagem: recomeca do zero. */
		zerar() {
			enviadoEm = null;
			amostras.length = 0;
		}
	};
}

/** O medidor da sessao: o MapEngine escreve, a HUD le. */
export const medidorDePing = criarMedidorDePing();
