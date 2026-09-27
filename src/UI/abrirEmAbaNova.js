/**
 * ABRE UM LINK NUMA ABA SEPARADA DO JOGO - e diz se conseguiu (27/09/2026).
 *
 * Saiu de `BoasVindasIdle.js`, onde nasceu depois de o dono medir o convite do
 * Discord abrindo "na mesma aba (saindo do jogo)" com um `<a target="_blank">`
 * puro. A janela de voto passou a precisar da mesma coisa: o link de voto abria
 * com `window.open(url, '_blank', 'noopener')`, que devolve `null` SEMPRE, entao
 * o jogo nao sabia se o navegador tinha barrado a janela.
 *
 * Devolve `false` quando as duas janelas (a casca e o quadro) recusaram: quem
 * chama deixa o `<a>` seguir, ou mostra um link para o toque do jogador.
 */

/**
 * Abre `url` numa aba/janela separada. Devolve se conseguiu.
 *
 * Duas escolhas que parecem detalhe e não são:
 *
 * 1. **`window.top` primeiro.** O componente roda dentro do `<iframe>` do
 *    cliente; abrir a partir da CASCA é o que dá uma aba irmã da do jogo em vez
 *    de algo pendurado no quadro de dentro. O `try` cobre o dia em que a casca
 *    for de outra origem — hoje ela não é (mesmo host do `vite`).
 *
 * 2. **Sem `noopener` na string de opções, e `opener = null` depois.** Por
 *    especificação, `window.open(..., 'noopener')` devolve `null` SEMPRE — e aí
 *    não há como distinguir "abriu" de "o navegador barrou", que é justamente o
 *    que decide se o `<a>` deve ou não continuar. Cortar o `opener` logo em
 *    seguida dá a mesma proteção (a página aberta não navega a aba do jogo) e
 *    mantém a resposta.
 */
export function abrirEmAbaNova(url) {
	for (const dona of [janelaDaCasca(), window]) {
		if (!dona) {
			continue;
		}
		try {
			const nova = dona.open(url, '_blank');
			if (nova) {
				try {
					nova.opener = null;
				} catch {
					/* já é de outra origem — o navegador cortou por nós. */
				}
				return true;
			}
		} catch {
			/* janela inacessível: tenta a próxima da lista. */
		}
	}
	return false;
}

/** A janela da casca, quando o jogo está num iframe de mesma origem. */
function janelaDaCasca() {
	try {
		return window.top && window.top !== window ? window.top : null;
	} catch {
		return null;
	}
}
