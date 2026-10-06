/**
 * UI/Components/NpcMenu/posicaoDoMenu.js
 *
 * ONDE O MENU DE NPC FICA, E QUANTAS LINHAS ELE MOSTRA (D-2047, 06/10/2026).
 *
 * Ordem do dono: *"aumenta para crescer a janela ate mostrar todas as opcoes
 * sem rolar (ate ~7 linhas)"*. O achado veio da devolucao do carrinho (D-2044):
 * o menu nativo de NPC (`ZC_MENU_LIST`) era uma caixa FIXA de 150px que
 * mostrava ~4 linhas. A 5a opcao da Kafra ("Curar", R48) ja saia cortada e a
 * 6a ("Devolver carrinho") so aparecia rolando — e quem nao rola nao sabe que
 * ela existe.
 *
 * A regra, nesta ordem:
 *   1. A janela mostra `min(opcoes, 7)` linhas, sem rolar. Com mais de 7, a
 *      lista rola POR DENTRO; a janela nao cresce alem de 7.
 *   2. Ela nasce no lugar de sempre (`preferida`), mas NUNCA em cima da caixa
 *      de fala do NPC: o topo fica abaixo dela (`FOLGA_DA_FALA`), porque o
 *      texto da fala e o que explica as opcoes.
 *   3. Se o que sobra abaixo da fala nao comporta as linhas (celular baixo,
 *      janela de navegador espremida), a lista mostra MENOS linhas e rola —
 *      ate `LINHAS_MINIMAS`. Rolar e o mal menor: a alternativa era cobrir a
 *      fala ou sair da tela.
 *   4. Se nem as linhas minimas cabem abaixo da fala, a janela sobe ate caber
 *      na tela, e cobre a fala. Sair da tela e pior: o OK some.
 *   5. Na horizontal, a janela fica inteira na tela, com `MARGEM` das bordas;
 *      no dedo ela e CENTRALIZADA (a caixa de fala e outras janelas tambem
 *      nao cabem lado a lado num celular em pe).
 *
 * PURA de proposito: recebe a geometria ja medida (em pixels da TELA, os de
 * `getBoundingClientRect`) e devolve numeros. Quem mede e aplica e o
 * `NpcMenu.js`. Assim a regra tem teste e mutante sem navegador.
 */

/** Ate quantas linhas o menu mostra sem rolar (a ordem do dono: "ate ~7"). */
export const LINHAS_SEM_ROLAR = 7;

/** Menos que isto a lista nao encolhe para fugir da fala: a janela sobe. */
export const LINHAS_MINIMAS = 3;

/** Distancia minima das bordas da tela. */
export const MARGEM = 8;

/** Distancia entre a caixa de fala do NPC e o menu. */
export const FOLGA_DA_FALA = 8;

/**
 * @param {object} p
 * @param {{largura: number, altura: number}} p.tela
 * @param {{top: number, bottom: number}|null} p.fala  a caixa de fala do NPC, ou null
 * @param {number} p.largura  a largura da janela do menu
 * @param {number[]} p.alturas  `alturas[l - 1]` = altura da janela mostrando `l`
 *   linhas; o tamanho do vetor e quantas linhas ela PODE mostrar (`min(opcoes, 7)`)
 * @param {{top: number, left: number}} p.preferida  onde o menu nasce
 * @param {boolean} p.centralizar  no dedo: centraliza na horizontal
 * @returns {{top: number, left: number, linhas: number}}
 */
export function posicaoDoMenu({ tela, fala, largura, alturas, preferida, centralizar }) {
	const maximo = Math.max(1, Math.min(alturas.length, LINHAS_SEM_ROLAR));
	const altura = l => alturas[l - 1];
	const chao = tela.altura - MARGEM;
	const topoMinimo = fala ? fala.bottom + FOLGA_DA_FALA : MARGEM;

	// 3. Encolhe a lista ate caber abaixo da fala, sem passar do minimo.
	const piso = Math.min(maximo, LINHAS_MINIMAS);
	let linhas = maximo;
	while (linhas > piso && topoMinimo + altura(linhas) > chao) {
		linhas--;
	}

	// 2. O lugar de sempre, abaixo da fala. Se o fundo passa da tela, sobe ate
	// caber. As linhas ja foram escolhidas para caber abaixo da fala, entao
	// subir so invade a fala no caso 4 (nem o minimo cabia); e mesmo ai a
	// janela fica na tela.
	let top = Math.max(preferida.top, topoMinimo);
	if (top + altura(linhas) > chao) {
		top = Math.max(MARGEM, chao - altura(linhas));
	}

	// 5. Horizontal.
	const left = posicaoHorizontal({ telaLargura: tela.largura, largura, preferida: preferida.left, centralizar });

	return { top: Math.round(top), left: Math.round(left), linhas };
}

/**
 * A REGRA HORIZONTAL, sozinha (D-2049, 06/10/2026): inteira na tela, com
 * `MARGEM` das bordas; no dedo, centralizada. E a regra 5 do menu, e a caixa
 * de fala do NPC (`NpcBox.js`) usa ESTA, para o menu e a fala ficarem na mesma
 * coluna do celular — antes a fala nascia em `max(W/3, 20)` e o encaixe na
 * tela a empurrava contra a borda direita (de 73 a 393 numa tela de 393).
 *
 * @param {object} p
 * @param {number} p.telaLargura
 * @param {number} p.largura  a largura da janela
 * @param {number} p.preferida  o `left` de quando nao se centraliza
 * @param {boolean} p.centralizar  no dedo
 * @returns {number} o `left`, em pixels da tela (sem arredondar)
 */
export function posicaoHorizontal({ telaLargura, largura, preferida, centralizar }) {
	const left = centralizar ? (telaLargura - largura) / 2 : preferida;
	if (largura + 2 * MARGEM > telaLargura) {
		return Math.max(0, (telaLargura - largura) / 2);
	}
	return Math.min(Math.max(left, MARGEM), telaLargura - MARGEM - largura);
}
