/**
 * Engine/MapEngine/letreiroFixo.js
 *
 * RAGIDLE: QUEM tem o nome desenhado sempre, sem o mouse em cima.
 *
 * - JOGADOR: desde 28/08/2026, pela opcao "nomes dos jogadores" das
 *   Configuracoes de video (`showPlayerNames`, ligada por padrao).
 * - MONSTRO: desde 24/09/2026, pedido do dono com o print na mao — os mobs
 *   mostravam so a barra de HP, e o nome aparecia so no hover. O nome desce
 *   logo abaixo da barra, na mesma geometria do jogador (`EntityDisplay`
 *   projeta do mesmo ponto que `EntityLife`, 13px abaixo).
 *
 * O MONSTRO NAO PEDE O NOME AO SERVIDOR. A razao que em 28/08 deixou o mob de
 * fora (*"120 letreiros seriam 120 pedidos"*) era o pedido, e ele so existe
 * por causa da GUILDA do jogador, que nao viaja no pacote de entidade. O nome
 * do mob viaja: `ZC_NOTIFY_STANDENTRY11`/`MOVEENTRY11` o trazem
 * (`servidor-mapa.ts`, `nome: mob.monstro.snapshot.name`) e `Entity.set()` ja
 * o desenha no canvas do letreiro. Ligar o letreiro custa so o desenho.
 *
 * Puro de proposito: o teste mede a regra sem o cliente de pe.
 *
 * @param {number} objecttype
 * @param {{TYPE_PC: number, TYPE_MOB: number}} tipos - as constantes de `Entity`
 * @param {{showPlayerNames?: boolean}} preferencias - `Preferences/Graphics`
 * @returns {boolean}
 */
export function letreiroFixo(objecttype, tipos, preferencias) {
	if (objecttype === tipos.TYPE_PC) {
		// `!== false`: preferencia gravada antes da opcao existir vale o padrao.
		return preferencias.showPlayerNames !== false;
	}
	return objecttype === tipos.TYPE_MOB;
}
