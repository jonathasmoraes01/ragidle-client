/**
 * O PEDIDO DE SKILL DENTRO DA JANELA DO GOLPE (C32 da auditoria de tela, 29/09/2026).
 *
 * O roBrowser recusa no cliente o pedido que chega antes de `entity.amotionTick`
 * ("Client side minimum delay") e sai com `return` mudo. O `amotionTick` e
 * armado por todo golpe e toda skill de dano do proprio personagem, inclusive
 * as que a rotacao idle dispara sozinha (Entity.js), por ~1 s. O clique do
 * jogador nessa janela sumia sem pacote e sem mensagem: foi o SM_BASH do
 * Cavaleiro na auditoria. O cliente oficial nao tem essa guarda, e o rAthena,
 * quando recusa por delay, avisa (clif.cpp:12935-12937).
 *
 * Aqui o pedido ESPERA a janela vencer e sai. Um pedido por vez: o clique novo
 * substitui o que esperava, como o clique do jogador substitui o anterior.
 */

/** Margem depois do fim da janela, em ms (um quadro). */
export const MARGEM_MS = 16;

/**
 * @param {{ agendar: (fn: () => void, ms: number) => unknown, cancelar: (id: unknown) => void }} relogio
 */
export function criarPedidoAdiado(relogio) {
	let pendente = null;
	return {
		/**
		 * Se `agora` ainda esta dentro da janela que termina em `fimDaJanela`,
		 * guarda `repetir` para rodar quando ela vencer e devolve true (o
		 * chamador para aqui). Fora da janela devolve false e nada guarda.
		 */
		adiarSeNaJanela(fimDaJanela, agora, repetir) {
			if (!(fimDaJanela > agora)) {
				return false;
			}
			if (pendente !== null) {
				relogio.cancelar(pendente);
			}
			pendente = relogio.agendar(() => {
				pendente = null;
				repetir();
			}, fimDaJanela - agora + MARGEM_MS);
			return true;
		},
		/**
		 * C47 (C-1): descarta o pedido que espera, se ha. O clique de andar, a
		 * troca de mapa e a morte chamam: o pedido velho nao pode sair depois
		 * deles (arrastava o boneco de volta, ou saia no mapa novo com o x,y do
		 * velho).
		 */
		cancelar() {
			if (pendente !== null) {
				relogio.cancelar(pendente);
				pendente = null;
			}
		},
		/** Ha pedido esperando? (para teste e diagnostico) */
		temPendente() {
			return pendente !== null;
		}
	};
}
