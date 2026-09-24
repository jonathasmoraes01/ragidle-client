/**
 * O GOLPE DO MONSTRO NAO CORTA O GOLPE DO JOGADOR (RAGIDLE, 24/09/2026).
 *
 * Relato de jogador: "a animacao de atk nao esta funcionando as vezes, so sobe
 * o dano". A causa: `onEntityWillBeHitSub` (`Entity.js`) agenda o HURT (o
 * "encolher" de quem apanha) para `attackMT` depois do golpe do agressor — o
 * Poring bate com 288 ms. O jogador golpeia a cada ~690 ms, entao o golpe do
 * monstro cai NO MEIO do balanco do jogador, o `setAction(HURT)` troca a
 * animacao de ataque pela de dor, e o numero de dano do jogador sobe sozinho,
 * sem braco nenhum desenhado.
 *
 * Decisao do dono (24/09/2026): o golpe (flinch) do monstro NAO pode cortar o
 * golpe do proprio jogador. No cliente oficial o dano interrompe o movimento de
 * ataque tambem — isto e divergencia DECLARADA, pedida por ele, e e por isso
 * que ela e estreita:
 * - so o JOGADOR LOCAL (`Session.Entity`) e poupado. Monstro, outro jogador,
 *   homunculo etc. continuam encolhendo como sempre — e o que da o retorno
 *   visual do golpe do proprio jogador no monstro;
 * - so enquanto a animacao de ATAQUE ainda esta TOCANDO. Parado, andando,
 *   sentado, conjurando, ou com o ataque ja no ultimo quadro (esperando o
 *   READYFIGHT), ele encolhe normalmente;
 * - o numero de dano e o resto (som, barra de vida, retomar a caminhada) nao
 *   passam por aqui e continuam iguais: so o HURT e pulado.
 *
 * "Acabou" e o `animation.play === false`: e o que `EntityRender.js` escreve
 * quando uma animacao sem repeticao chega ao ultimo quadro (antes de aplicar o
 * `next`). Enquanto o ataque toca, `play` fica `true`.
 */

/**
 * @param {object} p
 * @param {boolean} p.ehOJogadorLocal - a entidade que apanha e `Session.Entity`?
 * @param {number} p.acaoAtual - `entity.action` no instante do impacto
 * @param {boolean} p.animacaoAcabou - a animacao atual ja chegou ao fim?
 * @param {number[]} p.acoesDeAtaque - os ids de ATAQUE desta entidade
 *   (ATTACK/ATTACK1/ATTACK2/ATTACK3); os que valem -1/-2 (nao mapeados) sao
 *   ignorados, porque -1 e tambem o HURT/IDLE "nao definido" de alguns tipos
 * @returns {boolean} true = aplicar o HURT como sempre; false = pular
 */
export function deveEncolherAoApanhar({ ehOJogadorLocal, acaoAtual, animacaoAcabou, acoesDeAtaque }) {
	if (!ehOJogadorLocal) return true;
	if (animacaoAcabou) return true;
	const ataques = (acoesDeAtaque || []).filter(a => typeof a === 'number' && a >= 0);
	return !ataques.includes(acaoAtual);
}

/**
 * Os ids de ataque de uma entidade, lidos do mapa `ACTION` dela.
 * @param {object} ACTION
 * @returns {number[]}
 */
export function acoesDeAtaqueDa(ACTION) {
	return [ACTION.ATTACK, ACTION.ATTACK1, ACTION.ATTACK2, ACTION.ATTACK3];
}
