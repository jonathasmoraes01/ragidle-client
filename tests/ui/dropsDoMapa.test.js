/**
 * `dropsDoMapa.js` sem DOM (RAGIDLE, I6 — 31/08/2026): deduplicação por
 * `itemId`, escolha da MAIOR chance, ordem estável. A suíte de conta cheia
 * mora no repositório do servidor (`servidor/mapa/drops-do-mapa.test.ts`,
 * 11 casos, porque é o dono daquele fonte); esta cobre só o que o CLIENTE
 * acrescentou em 08/09/2026 — o passthrough de `raridade` que o selo do
 * Atlas passou a precisar (troca de % por raridade, ver `HuntMap.js` e
 * `atlasDeCaca.js`).
 */
import { describe, expect, it } from 'vitest';
import { dropsDoMapa } from '../../src/UI/Components/HuntMap/dropsDoMapa.js';

describe('dropsDoMapa — raridade', () => {
	it('repassa a `raridade` de cada ocorrência (monstros[].raridade) sem recalcular nada', () => {
		const mapa = {
			monstros: [
				{ mobId: 1, nome: 'Poring', drops: [{ itemId: 909, nome: 'Jellopy', chance: 7500, raridade: 0 }] }
			]
		};
		const [linha] = dropsDoMapa(mapa);
		// `raro: false` entrou no merge de 09/09 (a carta de MVP/mini-chefe vem
		// SEM chance e marcada `raro`, ordem do dono de 08/09). Um drop comum
		// carrega o `false` explícito — o objeto é fixado inteiro de propósito,
		// para campo novo aparecer aqui em vez de passar despercebido.
		expect(linha.monstros[0]).toEqual({
			mobId: 1,
			nome: 'Poring',
			chance: 7500,
			raro: false,
			raridade: 0
		});
	});

	it('a carta de chefe vem SEM chance e marcada `raro` — e a raridade viaja mesmo assim', () => {
		// A união das duas frentes: o número não viaja (ordem do dono, para a
		// taxa poder mudar sem os jogadores saberem) e a categoria viaja (é ela
		// que o selo desenha). Sem este caso, um merge futuro poderia devolver a
		// chance ao ramo `raro` e nada acusaria.
		const mapa = {
			monstros: [
				{ mobId: 3, nome: 'Poring Lendário', drops: [{ itemId: 4001, nome: 'Poring Card', raro: true, raridade: 3 }] }
			]
		};
		const [linha] = dropsDoMapa(mapa);
		expect(linha.raro).toBe(true);
		expect(linha.melhorChance).toBe(0);
		expect(linha.melhorChanceRaridade).toBe(3);
		expect(linha.monstros[0].chance).toBe(0);
	});

	it('`melhorChanceRaridade` anda junto de `melhorChance`: é a raridade da MESMA ocorrência vencedora, não um recalculo', () => {
		const mapa = {
			monstros: [
				// Drop mais raro (chance menor) chega PRIMEIRO — se o código
				// recalculasse por cima do agregado em vez de acompanhar a
				// troca de `melhorChance`, este teste pegaria a raridade errada.
				{ mobId: 1, nome: 'Poring', drops: [{ itemId: 909, nome: 'Jellopy', chance: 10, raridade: 2 }] },
				{ mobId: 2, nome: 'Lunatic', drops: [{ itemId: 909, nome: 'Jellopy', chance: 7500, raridade: 0 }] }
			]
		};
		const [linha] = dropsDoMapa(mapa);
		expect(linha.melhorChance).toBe(7500);
		expect(linha.melhorChanceRaridade).toBe(0);
	});

	it('sem `raridade` no drop (servidor velho), o campo some como `undefined` — não quebra, não inventa número', () => {
		const mapa = {
			monstros: [{ mobId: 1, nome: 'Poring', drops: [{ itemId: 909, nome: 'Jellopy', chance: 7500 }] }]
		};
		const [linha] = dropsDoMapa(mapa);
		expect(linha.melhorChanceRaridade).toBeUndefined();
		expect(linha.monstros[0].raridade).toBeUndefined();
	});
});
