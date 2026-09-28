/**
 * O TEXTO DA JANELA INDIQUE & GANHE (28/09/2026, ordem do dono: "a comissao e
 * em cima das doacoes, somente").
 *
 * Desde D-1593 (servidor, 23/09/2026) a comissao de 10% sai das DOACOES do
 * indicado, e nao do que ele gasta: com o Cash vendido, pagar sobre o gasto
 * pagaria duas vezes o mesmo real. A janela continuou prometendo "10% de tudo
 * que eles gastarem" por cinco dias. Este teste prende o texto nas duas frases
 * que o jogador le.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const HTML = readFileSync('src/UI/Components/IndicacaoIdle/IndicacaoIdle.html', 'utf8');
const JS = readFileSync('src/UI/Components/IndicacaoIdle/IndicacaoIdle.js', 'utf8');

describe('a janela Indique & Ganhe fala em DOACOES, e nao em gasto', () => {
	it('a chamada do topo promete 10% das doacoes', () => {
		expect(HTML).toContain('todas as doações que eles fizerem');
		expect(HTML).not.toMatch(/gastarem/);
	});

	it('o aviso do codigo diz a mesma regra a quem foi indicado', () => {
		expect(JS).toContain('Quem te indicou passa a ganhar 10% das suas doações.');
		expect(JS).not.toContain('10% do que você gastar');
	});
});
