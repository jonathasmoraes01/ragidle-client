/**
 * A LINHA DO CHAT EM INGLES (D-1929): traduzida INTEIRA antes de virar
 * pedacos de DOM; sem casar inteira, o Logs `"<remetente> : <texto>"` traduz
 * cada parte por si.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { absorverCatalogo, desligarTraducao } from 'Core/Traducao.js';
import { linhaNoIdioma } from 'UI/Components/ChatBox/linhaNoIdioma.js';

afterEach(() => desligarTraducao());

const CATALOGO = {
	v: 1,
	exatos: {
		Sistema: 'System',
		'Você não pode fazer isso agora.': 'You cannot do that right now.'
	},
	modelos: [{ pt: '{0} curou você em {1}.', en: '{0} healed you for {1}.', cru: [0] }]
};

describe('linhaNoIdioma', () => {
	it('em portugues devolve a MESMA linha', () => {
		expect(linhaNoIdioma('Sistema : Você não pode fazer isso agora.')).toBe('Sistema : Você não pode fazer isso agora.');
	});

	it('a linha inteira casa um modelo (o numero nao a parte antes)', () => {
		absorverCatalogo(CATALOGO);
		expect(linhaNoIdioma('Fulano curou você em 1.250.')).toBe('Fulano healed you for 1,250.');
	});

	it('o corpo do Logs: remetente e texto traduzidos cada um por si', () => {
		absorverCatalogo(CATALOGO);
		expect(linhaNoIdioma('Sistema : Você não pode fazer isso agora.')).toBe('System : You cannot do that right now.');
	});

	it('sem traducao, a linha fica como veio', () => {
		absorverCatalogo(CATALOGO);
		expect(linhaNoIdioma('Coisa nova sem traducao')).toBe('Coisa nova sem traducao');
		expect(linhaNoIdioma('')).toBe('');
	});
});
