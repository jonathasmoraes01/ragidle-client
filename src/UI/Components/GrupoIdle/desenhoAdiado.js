/**
 * UI/Components/GrupoIdle/desenhoAdiado.js
 *
 * A JANELA DE GRUPO FECHADA NAO DESENHA (auditoria de desempenho de
 * 15/10/2026, no molde do BotMenu, D-2385).
 *
 * Todo `ZC_RAGIDLE_GRUPO` (o servidor empurra a cada mudanca do grupo: vida,
 * mapa, posto, rateio...) passava por `desenharTudo()`, que refaz a janela
 * INTEIRA (estandarte, faixa, membros, postos, rateio, ajustes e duas leituras
 * de layout da rolagem) - mesmo com a janela FECHADA, onde ninguem ve.
 *
 * Fechada: o estado fica guardado (`GrupoIdle.estado` ja o guarda) e a janela
 * fica SUJA, sem tocar no DOM. Ao abrir, ela desenha o ULTIMO estado uma vez.
 * O que vive fora da janela (a HUD de party, pelo `GrupoIdle.aoAtualizar`, e o
 * recado) segue como antes. `desenharTudo` e uma funcao do estado: desenhar o
 * ultimo ao abrir deixa o DOM igual ao que os desenhos intermediarios
 * deixariam.
 *
 * @param {object} o
 * @param {function(): boolean} o.aberta
 * @param {function(): void} o.desenhar
 */
export function criarDesenhoAdiado({ aberta, desenhar }) {
	let suja = false;

	function agora() {
		suja = false;
		desenhar();
	}

	return {
		/** O estado mudou: desenha se aberta; senao, so suja. */
		mudou() {
			if (aberta()) {
				agora();
			} else {
				suja = true;
			}
		},
		/** A janela acabou de abrir: desenha o ultimo estado, se ficou suja. */
		abriu() {
			if (suja) {
				agora();
			}
		},
		/** Desenha ja (a montagem, a troca de personagem). */
		agora,
		/** Para o teste. */
		estaSuja: () => suja
	};
}
