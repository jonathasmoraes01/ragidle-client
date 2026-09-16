/**
 * A contagem da volta sozinha na janela de morte (D-1343, a D-1165 item 5).
 *
 * O numero e escrito por extenso (15000): um teste em termos da constante
 * passaria com qualquer valor dela. Que ele e o MESMO do servidor, quem garante e
 * `servidor/mapa/volta-apos-morte-no-cliente.test.ts`, do lado de la.
 */
import { describe, expect, it } from 'vitest';
import { MS_ATE_VOLTAR_SOZINHO, textoDaContagem } from '../../src/UI/Components/DeathWindow/contagemDaVolta.js';

describe('textoDaContagem', () => {
	it('o numero e o da D-1165: 15 segundos', () => {
		expect(MS_ATE_VOLTAR_SOZINHO).toBe(15000);
	});

	it('na hora da morte, e ate o primeiro segundo passar, diz 15 s', () => {
		expect(textoDaContagem(0)).toBe('Voltando à cidade em 15 s');
		expect(textoDaContagem(999)).toBe('Voltando à cidade em 15 s');
		expect(textoDaContagem(1000)).toBe('Voltando à cidade em 14 s');
	});

	it('arredonda para cima: no ultimo segundo diz 1 s, e nunca 0 s', () => {
		expect(textoDaContagem(14001)).toBe('Voltando à cidade em 1 s');
		expect(textoDaContagem(14999)).toBe('Voltando à cidade em 1 s');
	});

	it('vencido o prazo, diz que esta voltando — e continua dizendo ate a viagem chegar', () => {
		expect(textoDaContagem(15000)).toBe('Voltando à cidade…');
		expect(textoDaContagem(60000)).toBe('Voltando à cidade…');
	});

	it('um relogio que andou para tras nao passa de 15 s', () => {
		expect(textoDaContagem(-500)).toBe('Voltando à cidade em 15 s');
	});
});
