/**
 * O PEDIDO DE SKILL GUARDADO (C47 / C-1, auditoria de tela, 30/09/2026).
 *
 * O jogador pede uma skill e ela fica guardada em dois lugares ate sair: o
 * `_pedidoNoGolpe` (a janela do golpe, C32: um `setTimeout`) e o
 * `Session.moveAction` (a caminhada ate o alcance, C19/C23). Nada os soltava
 * quando o jogador desistia: o clique no chao zerava so o `moveAction`, e a
 * troca de mapa e a morte nenhum dos dois. A skill velha saia depois, com o
 * x,y do mapa de antes ou arrastando o boneco de volta de onde ele fugiu.
 *
 * O cliente oficial nao guarda pedido nenhum (anda e usa pelo que o servidor
 * mandou), entao descartar ao desistir e a forma fiel.
 */
import { criarPedidoAdiado } from './pedidoAdiadoPeloGolpe.js';

/** C32 (29/09/2026): o pedido dentro da janela do golpe espera, em vez de sumir. */
export const pedidoNoGolpe = criarPedidoAdiado({
	agendar: (fn, ms) => setTimeout(fn, ms),
	cancelar: id => clearTimeout(id)
});

/**
 * Descarta tudo o que esta guardado para soltar uma skill depois.
 *
 * @param {{ moveAction: object|null, moveActionAlcance: object|null, moveActionEspera: object|null }} sessao
 * @param {{ cancelar: () => void }} [adiado] - o pedido da janela do golpe (teste injeta)
 */
export function descartarPedidoGuardado(sessao, adiado = pedidoNoGolpe) {
	adiado.cancelar();
	sessao.moveAction = null;
	sessao.moveActionAlcance = null;
	sessao.moveActionEspera = null;
}
