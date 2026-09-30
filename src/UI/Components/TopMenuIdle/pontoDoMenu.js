/**
 * O PONTO DO BOTAO "MENU" (29/09/2026, pedido do dono): acende quando algum
 * ponto JA CALCULADO esta aceso num item que o jogador NAO esta vendo.
 *
 *  - qualquer item do leque (`.tm-fan`), aberto ou nao — o Codex mora la;
 *  - item do cluster de cima (`.tm-top`) que o LAYOUT escondeu (`display:
 *    none` computado) — no celular em pe o Correio, o Votar e a Temporada
 *    saem do trilho. Com o cluster recolhido pela alca quem avisa e a alca
 *    (`syncToggleDot`), e o cluster fica de fora para os dois nao repetirem.
 */
export function pontoDoMenuAceso(root, clusterRecolhido) {
	const aceso = p => !!p && p.style.display !== 'none';
	if ([...root.querySelectorAll('.tm-fan .tm-item .ri-dot')].some(aceso)) {
		return true;
	}
	if (clusterRecolhido) {
		return false;
	}
	return [...root.querySelectorAll('.tm-top .tm-item')].some(
		item => aceso(item.querySelector('.ri-dot')) && getComputedStyle(item).display === 'none'
	);
}
