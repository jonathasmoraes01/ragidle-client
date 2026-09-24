/**
 * QUEM APANHA ANDANDO NAO PERDE A ROTA NA TELA (RAGIDLE, 24/09/2026 - passo 13
 * da auditoria do cerco, achado J6). A base e o `apanharInterrompeACaminhada`
 * do Jhow (branch `feat/modo-classico`, commit 10a96802), sem o interruptor de
 * modo: aqui ele vale sempre.
 *
 * O DEFEITO: a animacao de dano (HURT) e um `setAction` que sai de WALK, e
 * sair de WALK apaga a rota (`EntityAction.js` -> `resetRoute`, o conserto
 * upstream #607: `walk.index = 0; walk.total = 0`). O `resumeWalk` que
 * deveria retomar a caminhada (`Entity.js`) exige `walk.index < walk.total` -
 * os dois ja zerados - e ainda um `getFocusEntity()`. Entao a entidade que
 * apanhava no meio da caminhada PARAVA na tela enquanto o servidor seguia
 * andando com ela, e saltava quando o pacote de posicao seguinte chegava.
 *
 * O servidor reenvia o movimento durante 1 s depois do dano (o
 * `MOVE_REFRESH_TIME` da fonte, `unit.cpp:240-244`), para o jogador desde
 * 15/09 e para o MOB desde este passo; isto e a outra metade: o golpe nao
 * apaga a rota que ainda esta viva. O numero de dano continua aparecendo;
 * so o encolher de quem esta andando e pulado.
 */

/**
 * O golpe recebido toca o HURT? `false` so para quem esta ANDANDO com rota
 * viva (`walk.index < walk.total`); parado, no fim da rota, ou com resto de
 * rota na memoria mas fora de WALK, encolhe como sempre.
 *
 * @param {object} entidade
 * @returns {boolean} true = tocar o HURT como sempre; false = pular
 */
export function apanharInterrompeACaminhada(entidade) {
	if (!entidade || !entidade.ACTION || entidade.action !== entidade.ACTION.WALK) return true;
	const walk = entidade.walk;
	return !(walk && walk.index < walk.total);
}
