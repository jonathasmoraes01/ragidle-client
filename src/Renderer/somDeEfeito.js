/**
 * O SOM DE EFEITO NAO NASCE NEM TOCA FORA DE HORA (F47, auditoria de 22/09/2026).
 *
 * Cada efeito de habilidade agenda o proprio som pela fila do `Core/Events`
 * (`EffectManager.js`). Com a aba oculta o navegador para o
 * `requestAnimationFrame`, a fila deixa de andar, e o WebSocket continua
 * criando efeitos: minutos de caca enfileiram centenas de sons, cada um
 * inserido por varredura linear da lista ordenada. Na volta, o tick salta
 * para o tempo real, a fila inteira vence junto e toca sons de golpes que
 * aconteceram minutos antes.
 *
 * As duas pontas, como a limpeza do dano (`MapRenderer.vigiarVisibilidade`):
 * o som NAO NASCE com a aba oculta, e o que ja estava na fila e VENCEU e
 * descartado ao executar.
 */

/**
 * Quanto atraso um som tolera antes de ser descartado.
 *
 * Numero nosso, e nao do cliente oficial. A fila tem orcamento de 8 ms por
 * quadro (`Events.process`, D-1481), entao uma rajada legitima de sons se
 * espalha por alguns quadros — no pior quadro medido no iPhone, 214 ms de
 * eventos viraram ~27 quadros, cerca de meio segundo. Um segundo deixa a
 * rajada legitima tocar inteira e corta o que sobrou de uma aba oculta, que
 * atrasa em minutos.
 */
export const SOM_VENCIDO_MS = 1000;

/**
 * Agendar o som deste efeito? Nao com a aba oculta: a fila nao anda, e ele
 * so tocaria na volta, fora de hora.
 *
 * @param {{hidden?: boolean}|undefined} doc
 * @return {boolean}
 */
export function deveAgendarSom(doc) {
	return !(doc && doc.hidden);
}

/**
 * O som que devia tocar em `quando` ainda vale em `agora`?
 *
 * @param {number} agora - o tick do quadro (`Renderer.tick`)
 * @param {number} quando - o tick para o qual o som foi agendado
 * @return {boolean}
 */
export function somAindaVale(agora, quando) {
	return agora - quando <= SOM_VENCIDO_MS;
}
