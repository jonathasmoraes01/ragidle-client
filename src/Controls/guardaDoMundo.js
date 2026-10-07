/**
 * Controls/guardaDoMundo.js
 *
 * O MUNDO SO RESPONDE AO TOQUE COM UM PERSONAGEM NELE (D-2055, achado A2 de
 * 06/10/2026 — o erro "Session.Entity null" do `/analytics`).
 *
 * `Core/Mobile.js` ligava `Mouse.intersect` em TODO toque, inclusive na selecao
 * de personagem, onde `Session.Entity` e `null`. O toque seguinte chegava ao
 * `onRequestWalk` do `MapEngine`, que le `Session.Entity.action` - TypeError -,
 * e a excecao, sem guarda no laco de eventos, matava o laco de render da
 * selecao (achado A1). E o andar que comecava no mapa e atravessava a volta a
 * selecao (o relogio `_walkTimer`) lia `Session.Entity.position` com o
 * personagem ja desfeito.
 *
 * A pergunta mora num lugar so, e os tres lugares que a faziam errado
 * (`Core/Mobile.js`, `onRequestWalk` e `walkIntervalProcess` do `MapEngine`)
 * perguntam aqui. O `MapViewer` (ferramenta de desenvolvimento) poe um
 * personagem de mentira em `Session.Entity` e continua respondendo.
 *
 * @param {{Entity?: object|null}|null|undefined} sessao - a `Session`
 * @returns {boolean}
 */
export function temPersonagemNoMundo(sessao) {
	return !!(sessao && sessao.Entity);
}
