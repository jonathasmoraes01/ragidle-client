/**
 * "DROPS DO MAPA" E "POR MONSTRO", COM O MONSTRO NA CARA (F1/T4, 21/09/2026 -
 * D-1675/D-1676).
 *
 * Pedido do dono: *"No menu de teleporte dos mapas de caca, ofereca duas
 * visualizacoes: 'Drops do mapa' e 'Por monstro'. A primeira deve apresentar
 * TODOS os drops possiveis do mapa, reunindo itens repetidos e PRESERVANDO A
 * IDENTIFICACAO DOS MONSTROS que os fornecem. (...) nao invente drops nem
 * some probabilidades de monstros diferentes como se fossem uma taxa unica."*
 *
 * As duas visoes ja existiam (`dropsDoMapa.js` deduplica por `itemId` e
 * guarda `monstros[]` com a chance e a raridade de CADA um). O que faltava:
 * os rotulos pedidos e, principalmente, o monstro APARECER - ele so vivia no
 * `title` (hover) e num chip "N mobs", invisiveis no celular.
 *
 * `origensDoDrop.js` e o modulo puro que desenha a origem de um item; aqui
 * ele e executado e o HTML e lido de volta pelo DOM do jsdom: o nome de cada
 * monstro tem de ser TEXTO, cada um com a PROPRIA raridade (nunca uma media
 * ou soma), e o chip "N mobs" nao existe mais.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { htmlDasOrigens, ROTULO_DA_VISAO } from 'UI/Components/HuntMap/origensDoDrop.js';
import { dropsDoMapa } from 'UI/Components/HuntMap/dropsDoMapa.js';

const ler = (rel) => readFileSync(join(process.cwd(), 'src', rel), 'utf8');

function desenhar(html) {
	const div = document.createElement('div');
	div.innerHTML = html;
	return div;
}

describe('os rotulos das duas visoes sao os que o dono pediu', () => {
	it('"Por monstro" e "Drops do mapa"', () => {
		expect(ROTULO_DA_VISAO.mob).toBe('Por monstro');
		expect(ROTULO_DA_VISAO.mapa).toBe('Drops do mapa');
	});

	it('o alternador do HuntMap usa esses rotulos (e nao os antigos "Do monstro"/"Do mapa")', () => {
		const js = ler('UI/Components/HuntMap/HuntMap.js');
		expect(js).toContain('ROTULO_DA_VISAO.mob');
		expect(js).toContain('ROTULO_DA_VISAO.mapa');
		expect(js).not.toContain('>Do monstro<');
		expect(js).not.toContain('>Do mapa<');
	});
});

describe('a origem de cada item da visao "Drops do mapa" nomeia os monstros como TEXTO', () => {
	const ficha = {
		monstros: [
			{ mobId: 1002, nome: 'Poring', drops: [{ itemId: 909, nome: 'Jellopy', chance: 7000, raridade: 0 }] },
			{ mobId: 1063, nome: 'Lunatic', drops: [{ itemId: 909, nome: 'Jellopy', chance: 10, raridade: 2 }] },
			{ mobId: 1007, nome: 'Fabre', drops: [{ itemId: 914, nome: 'Fluff', chance: 9000, raridade: 0 }] }
		]
	};

	it('um item que cai de dois monstros mostra os DOIS nomes, cada um com a PROPRIA raridade', () => {
		const [jellopy] = dropsDoMapa(ficha).filter((l) => l.itemId === 909);
		const dom = desenhar(htmlDasOrigens(jellopy.monstros));
		const origens = [...dom.querySelectorAll('.hm-drop-origem')];
		expect(origens).toHaveLength(2);
		expect(origens.map((o) => o.querySelector('.hm-drop-origem-nome').textContent.trim())).toEqual(['Poring', 'Lunatic']);
		// A raridade e a de CADA ocorrencia - a do Poring (7000 = Comum) e a do
		// Lunatic (10 = Raro). Somar ou tirar media daria um numero que nao
		// existe no rAthena.
		expect(origens.map((o) => o.querySelector('.hm-drop-rarity').textContent.trim())).toEqual(['Comum', 'Raro']);
		expect(dom.textContent).not.toMatch(/\d+\s*mobs/);
	});

	it('um item de uma origem so mostra aquele monstro', () => {
		const [fluff] = dropsDoMapa(ficha).filter((l) => l.itemId === 914);
		const dom = desenhar(htmlDasOrigens(fluff.monstros));
		expect([...dom.querySelectorAll('.hm-drop-origem-nome')].map((n) => n.textContent.trim())).toEqual(['Fabre']);
	});

	it('a carta de chefe (raro, sem chance) nomeia o chefe com o selo Lendário', () => {
		const dom = desenhar(htmlDasOrigens([{ mobId: 1115, nome: 'Eddga', chance: 0, raro: true, raridade: 3 }]));
		expect(dom.querySelector('.hm-drop-origem-nome').textContent.trim()).toBe('Eddga');
		expect(dom.querySelector('.hm-drop-rarity').textContent.trim()).toBe('Lendário');
		expect(dom.querySelector('.hm-drop-rarity').classList.contains('r3')).toBe(true);
	});

	it('o nome do monstro e escapado (e HTML injetado, vindo do servidor)', () => {
		const dom = desenhar(htmlDasOrigens([{ mobId: 1, nome: '<b>x</b>', chance: 100, raridade: 1 }]));
		expect(dom.querySelector('b')).toBeNull();
		expect(dom.querySelector('.hm-drop-origem-nome').textContent).toBe('<b>x</b>');
	});

	it('o HuntMap desenha a visao do mapa com este modulo, e nao mais com o chip "N mobs" + title', () => {
		const js = ler('UI/Components/HuntMap/HuntMap.js');
		const inicio = js.indexOf('function renderDropsDoMapa');
		const corpo = js.slice(inicio, js.indexOf('\n}\n', inicio));
		expect(corpo).toContain('htmlDasOrigens(');
		expect(corpo).not.toContain('mobs</span>');
	});
});
