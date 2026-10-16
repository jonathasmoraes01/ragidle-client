/**
 * UI/resumoAntesDasNovidades.js
 *
 * RAGIDLE: O RESUMO DA VOLTA VEM ANTES DA "NOVIDADES" (frente I do segundo
 * plano, D-2595, 16/10/2026).
 *
 * O defeito, medido pela `prove:dormir`: quem acordava de um sono de 8 h via o
 * resumo do Dormir ("Voce dormiu 8h e ganhou...") NASCER COBERTO pela caixa de
 * boas-vindas ("Novidades", `BoasVindasIdle`) - `elementFromPoint` no centro do
 * "Continuar" respondia a arte do cartaz. Os dois abrem no mesmo instante (a
 * entrada no mapa) e o cartaz mora na camada 1.900.000, acima de toda janela.
 * O jogador tinha de fechar a propaganda para ver o que ganhou. O mesmo vale
 * para "Enquanto voce esteve fora" (`AusenciaIdle`, D-2565), que chega no
 * mesmo momento depois de o celular derrubar a conexao.
 *
 * A ORDEM ESCOLHIDA: o resumo do que o jogador GANHOU vem primeiro, e a
 * "Novidades" ESPERA ele fechar. A "Novidades" nao se perde: ela abre logo
 * depois, uma vez, como abriria na entrada. Tres casos:
 *   - a "Novidades" quer abrir com um resumo na tela: fica pendente;
 *   - um resumo abre com a "Novidades" ja na tela (o pacote do resumo chega
 *     DEPOIS do `append` do cartaz): o cartaz SAI da frente e fica pendente;
 *   - o ultimo resumo fecha com a "Novidades" pendente: ela abre agora.
 *
 * DESCARTADO:
 *   - baixar a camada do cartaz: ele fica acima de tudo por um motivo (e um
 *     modal de tela cheia, e a morte e a unica coisa acima dele); com ele
 *     abaixo de uma janela qualquer, a janela cobriria o rodape do cartaz;
 *   - registrar o cartaz na `pilhaDeJanelas` (D-932): desfiguraria a arte no
 *     celular (BoasVindasIdle.js, escolha 4), e a pilha cuida de "uma janela
 *     por vez" entre janelas, nao de quem espera quem;
 *   - um atraso fixo no cartaz: o resumo do sono pode chegar segundos depois
 *     do mapa, e um tempo chumbado ou atrasa todo mundo ou nao basta.
 *
 * Sem DOM e sem import: as tres pecas (o cartaz, a janela da ausencia e o
 * popup do sono) avisam aqui, e o cartaz se registra com as tres funcoes dele.
 * Por isso a decisao inteira cabe num teste puro, com mutacao.
 */

/**
 * A fila de uma entrada no jogo. `criarFilaDaVolta()` e a fabrica (os testes
 * fazem uma por caso); o resto do cliente usa a instancia unica, abaixo.
 */
export function criarFilaDaVolta() {
	/** Os resumos da volta abertos agora, por nome ('sono', 'ausencia'). */
	const abertos = new Set();
	/** A "Novidades" quis abrir (ou saiu da frente) e espera os resumos fecharem. */
	let novidadesPendente = false;
	/** O cartaz: `{ estaAberta(), esconder(), mostrar() }`. `null` = nao registrado. */
	let novidades = null;

	function cartazNaTela() {
		try {
			return !!(novidades && novidades.estaAberta());
		} catch {
			return false;
		}
	}

	return {
		/** O cartaz se registra uma vez (BoasVindasIdle.js). */
		registrarNovidades(pecas) {
			novidades = pecas || null;
		},

		/**
		 * A "Novidades" quer abrir. Abre agora se nenhum resumo esta na tela;
		 * senao fica pendente. Devolve `true` se abriu.
		 */
		pedirNovidades() {
			if (abertos.size > 0) {
				novidadesPendente = true;
				return false;
			}
			novidadesPendente = false;
			if (novidades) {
				novidades.mostrar();
			}
			return true;
		},

		/** Um resumo da volta abriu. Se o cartaz estava na frente, ele sai e espera. */
		resumoAbriu(nome) {
			abertos.add(String(nome));
			if (cartazNaTela()) {
				novidades.esconder();
				novidadesPendente = true;
			}
		},

		/** Um resumo fechou. Sem nenhum outro na tela, a "Novidades" pendente abre. */
		resumoFechou(nome) {
			abertos.delete(String(nome));
			if (abertos.size === 0 && novidadesPendente) {
				novidadesPendente = false;
				if (novidades) {
					novidades.mostrar();
				}
			}
		},

		/** Algum resumo da volta esta na tela? (o tutorial cede enquanto estiver) */
		haResumoAberto() {
			return abertos.size > 0;
		},

		/** A "Novidades" espera um resumo fechar? */
		novidadesEspera() {
			return novidadesPendente;
		},

		/**
		 * A troca de personagem: a fila e da ENTRADA. Esquece sem abrir nada (o
		 * cartaz do proximo personagem abre pela entrada dele).
		 */
		esquecer() {
			abertos.clear();
			novidadesPendente = false;
		}
	};
}

const filaDaVolta = criarFilaDaVolta();

export default filaDaVolta;
