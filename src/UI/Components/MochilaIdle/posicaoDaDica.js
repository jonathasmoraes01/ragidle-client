/**
 * UI/Components/MochilaIdle/posicaoDaDica.js
 *
 * ONDE A DICA DE HOVER APARECE — a conta, separada da janela para poder ser
 * medida.
 *
 * A dica nasce ACIMA da celula e centrada nela; quando nao cabe em cima (a
 * primeira fileira da grade, e todo slot da coluna de equipamento que esteja
 * colado no topo), ela vira para BAIXO em vez de sair da janela. E o eixo
 * horizontal e grampeado nas bordas: a coluna mais a direita da grade fica a
 * menos de meia dica da borda, e sem o grampo o nome sairia pela lateral.
 *
 * As tres regras parecem obvias e nenhuma delas se ve num screenshot de um
 * item so no meio da grade — que e onde todo mundo testa.
 */

/** Distancia entre a celula e a dica, em pixels. */
export const DICA_FOLGA = 8;

/**
 * @param {{left:number, top:number, width:number, height:number}} alvo - a celula, em coordenadas de tela
 * @param {{width:number, height:number}} dica - o tamanho ja medido da dica
 * @param {{left:number, top:number, width:number, height:number}} janela - a janela, em coordenadas de tela
 * @returns {{left:number, top:number}} posicao RELATIVA a janela
 */
export function posicaoDaDica(alvo, dica, janela) {
	const alvoX = alvo.left - janela.left;
	const alvoY = alvo.top - janela.top;

	let top = alvoY - dica.height - DICA_FOLGA;
	if (top < 0) {
		// Nao cabe em cima: vira para baixo da celula.
		top = alvoY + alvo.height + DICA_FOLGA;
	}

	let left = alvoX + alvo.width / 2 - dica.width / 2;
	const maximo = janela.width - dica.width;
	if (left > maximo) {
		left = maximo;
	}
	if (left < 0) {
		left = 0;
	}

	return { left, top };
}
