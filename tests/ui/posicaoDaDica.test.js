/**
 * A DICA DE HOVER DA MOCHILA (pedido do dono, 25/08/2026): passar o mouse num
 * item mostra o nome.
 *
 * O que estes casos guardam nao e "a dica aparece" — e que ela aparece ONDE DA
 * PARA LER. As tres regras da conta somem num screenshot de um item no meio da
 * grade, que e onde qualquer um testaria:
 *
 *   1. a primeira fileira nao tem espaco acima (a dica sairia por cima da
 *      janela);
 *   2. a coluna da direita fica a menos de meia dica da borda (o nome sairia
 *      pela lateral);
 *   3. e a coluna da esquerda, o mesmo pelo outro lado.
 *
 * A conta e pura de proposito: medir isto com DOM exigiria a janela inteira
 * montada, e ela depende do Renderer.
 */

import { describe, expect, it } from 'vitest';
import { DICA_FOLGA, posicaoDaDica } from 'UI/Components/MochilaIdle/posicaoDaDica.js';

/** A janela real: 578x344, largada em 100,50 na tela. */
const JANELA = { left: 100, top: 50, width: 578, height: 344 };
/** Uma dica de tamanho plausivel para "Poção Vermelha". */
const DICA = { width: 120, height: 22 };

/** Uma celula da grade, em coordenadas de tela. */
function celula(x, y) {
	return { left: JANELA.left + x, top: JANELA.top + y, width: 32, height: 32 };
}

describe('posicaoDaDica', () => {
	it('nasce ACIMA da celula e centrada nela', () => {
		const pos = posicaoDaDica(celula(300, 200), DICA, JANELA);
		expect(pos.top).toBe(200 - DICA.height - DICA_FOLGA);
		// centro da celula (300 + 16) menos meia dica (60)
		expect(pos.left).toBe(316 - 60);
	});

	it('vira para BAIXO quando nao cabe em cima', () => {
		// A primeira fileira da grade: sem isto a dica sairia pelo topo da
		// janela, que e justamente onde o titulo dela esta.
		const pos = posicaoDaDica(celula(300, 4), DICA, JANELA);
		expect(pos.top).toBe(4 + 32 + DICA_FOLGA);
	});

	it('a fronteira do "cabe em cima" e o zero, e nao o negativo', () => {
		// Exatamente colada: 22 de dica + 8 de folga = 30.
		const cabe = posicaoDaDica(celula(300, 30), DICA, JANELA);
		expect(cabe.top).toBe(0);
		// Um pixel acima disso ja nao cabe.
		const naoCabe = posicaoDaDica(celula(300, 29), DICA, JANELA);
		expect(naoCabe.top).toBe(29 + 32 + DICA_FOLGA);
	});

	it('nao vaza pela borda DIREITA', () => {
		// Ultima coluna da grade: a celula esta a 20px da borda e a dica tem
		// 120 — sem o grampo, metade do nome ficaria fora da janela.
		const pos = posicaoDaDica(celula(JANELA.width - 40, 200), DICA, JANELA);
		expect(pos.left).toBe(JANELA.width - DICA.width);
	});

	it('nao vaza pela borda ESQUERDA', () => {
		const pos = posicaoDaDica(celula(4, 200), DICA, JANELA);
		expect(pos.left).toBe(0);
	});

	it('a posicao e RELATIVA a janela, e nao a tela', () => {
		// A janela e arrastavel: uma conta em coordenadas de tela poria a dica
		// no canto oposto assim que o dono movesse a Mochila. Mesma celula, duas
		// janelas em lugares diferentes, mesma resposta.
		const aqui = posicaoDaDica(celula(300, 200), DICA, JANELA);
		const outra = { left: 700, top: 300, width: 578, height: 344 };
		const ali = posicaoDaDica(
			{ left: outra.left + 300, top: outra.top + 200, width: 32, height: 32 },
			DICA,
			outra
		);
		expect(ali).toEqual(aqui);
	});

	it('dica mais larga que a janela encosta na esquerda, e nao em coordenada negativa', () => {
		// O grampo da direita roda ANTES do da esquerda; sem o segundo, uma
		// dica larga demais sairia com `left` negativo.
		const larga = { width: JANELA.width + 40, height: 22 };
		const pos = posicaoDaDica(celula(300, 200), larga, JANELA);
		expect(pos.left).toBe(0);
	});
});
