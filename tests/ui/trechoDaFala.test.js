/**
 * A FALA DO NPC EM INGLES (D-1929): o trecho que termina na linha nova e
 * tentado do mais longo ao mais curto. O titulo traduzido sozinho nao impede
 * a fala que vem depois de casar. (O titulo do fixture tem acento de
 * proposito: "[Guardia]" em ASCII passaria por nome proprio nos segmentos e a
 * pagina inteira casaria — o que tambem e uma traducao certa.)
 */

import { afterEach, describe, expect, it } from 'vitest';
import { absorverCatalogo, desligarTraducao } from 'Core/Traducao.js';
import { trechoTraduzido } from 'UI/Components/NpcBox/trechoDaFala.js';

afterEach(() => desligarTraducao());

const CATALOGO = {
	v: 1,
	exatos: {
		'[Guardiã da Praça]': '[Plaza Guardian]',
		'Bem-vindo a praca. Escolha uma das salas abaixo para comecar.': 'Welcome to the plaza. Pick a room below to start.'
	},
	modelos: []
};

describe('trechoTraduzido', () => {
	it('em portugues nada casa', () => {
		expect(trechoTraduzido(['[Guardiã da Praça]'])).toBeNull();
	});

	it('a pagina inteira, quando ela casa', () => {
		absorverCatalogo(CATALOGO);
		expect(trechoTraduzido(['Bem-vindo a praca. Escolha uma das salas', 'abaixo para comecar.'])).toEqual({
			inicio: 0,
			texto: 'Bem-vindo a praca. Escolha uma das salas abaixo para comecar.',
			traducao: 'Welcome to the plaza. Pick a room below to start.'
		});
	});

	it('o titulo ja traduzido nao segura a fala: casa o trecho que comeca depois dele', () => {
		absorverCatalogo(CATALOGO);
		const achado = trechoTraduzido(['[Guardiã da Praça]', 'Bem-vindo a praca. Escolha uma das salas', 'abaixo para comecar.']);
		expect(achado && achado.inicio).toBe(1);
		expect(achado && achado.traducao).toBe('Welcome to the plaza. Pick a room below to start.');
	});

	it('a fala ainda incompleta nao casa (espera a proxima linha)', () => {
		absorverCatalogo(CATALOGO);
		expect(trechoTraduzido(['[Guardiã da Praça]', 'Bem-vindo a praca. Escolha uma das salas'])).toBeNull();
	});
});
