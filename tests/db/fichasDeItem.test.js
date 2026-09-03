/**
 * O PESO E A RARIDADE que o cliente nao tinha (D-919, 02/09/2026).
 *
 * O cliente nunca soube quanto pesa um item: `ItemTable.js` nasce das tabelas
 * do GRF e nelas nao ha campo de peso. A loja moderna ja lia `info.weight`
 * mesmo assim — a linha do item montava `Peso ${info.weight / 10}` e
 * `calculateWeight()` somava aquele campo — e recebia `undefined` desde o
 * primeiro dia: a meta nunca imprimiu peso e a soma **sempre devolveu zero**,
 * sem erro nenhum. Codigo morto que parecia vivo.
 *
 * Estes casos exercitam o arquivo PUBLICADO DE VERDADE
 * (`public/ragidle/fichas-de-item.json`, gerado no repositorio do jogo por
 * `scripts/publicar-fichas-de-item.ts`) e nao um fixture: a falha provavel
 * aqui e a publicacao — o arquivo sair vazio, sair na versao errada ou nao
 * sair — e um fixture proprio esconderia exatamente essa.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
	CLASSE_DE_RARIDADE,
	absorverFichasDeItem,
	chanceDeDropDeItem,
	fichaDeItem,
	pesoDeItem,
	raridadeDeItem,
	tipoDeItem
} from '../../src/DB/Items/fichasDeItem.js';
import ItemType from '../../src/DB/Items/ItemType.js';

/* `import.meta.url` aqui e uma URL http (o vitest roda sobre o vite), e nao
   file: — por isso o caminho sai do cwd, que e a raiz do projeto. */
const CAMINHO = join(process.cwd(), 'public', 'ragidle', 'fichas-de-item.json');

let publicado;

beforeAll(() => {
	publicado = JSON.parse(readFileSync(CAMINHO, 'utf8'));
	absorverFichasDeItem(publicado);
});

describe('o arquivo publicado', () => {
	it('esta na versao que este modulo le, e nao esta vazio', () => {
		expect(publicado.v).toBe(1);
		expect(Object.keys(publicado.itens).length).toBeGreaterThan(500);
	});

	it('o degrau de cima e o limiar de anuncio de drop raro do JOGO (D-631)', () => {
		// 10 decimos de milesimo = 0,1%. E o unico degrau que nao e
		// apresentacao: o servidor para o chat para anunciar um drop assim.
		expect(publicado.degraus[0]).toBe(10);
		expect(publicado.degraus).toEqual([10, 100, 1000]);
	});

	it('toda linha tem os quatro campos, e a raridade cabe na escada', () => {
		const quebradas = [];
		for (const [id, linha] of Object.entries(publicado.itens)) {
			const ok =
				Array.isArray(linha) &&
				linha.length === 4 &&
				linha.every(n => typeof n === 'number') &&
				linha[0] >= 0 && // peso
				linha[1] >= 0 &&
				linha[1] <= 3; // raridade
			if (!ok) {
				quebradas.push(id);
			}
		}
		expect(quebradas).toEqual([]);
	});
});

describe('o peso', () => {
	it('a Poção Vermelha pesa 70 decigramas — o `Weight` do item_db', () => {
		// 70 e o numero do rAthena (item_db, Red_Potion). A tela divide por 10
		// e mostra 7, como BasicInfoIdle e MochilaIdle ja faziam com o peso
		// carregado.
		expect(pesoDeItem(501)).toBe(70);
	});

	it('item fora da tabela devolve null, e NAO zero', () => {
		// Zero seria um peso plausivel e mentiroso — e a trava de peso da loja
		// decide em cima deste numero. `null` faz a janela esconder a linha.
		expect(pesoDeItem(999123)).toBe(null);
		expect(fichaDeItem(999123)).toBe(null);
	});
});

describe('a raridade', () => {
	it('a Carta do Poring e mais rara que a Poção Vermelha', () => {
		// A carta cai a 1% de um monstro; a poção nao cai de ninguem (so loja).
		expect(raridadeDeItem(4001)).toBeGreaterThan(raridadeDeItem(501));
	});

	it('o que ninguem solta e Comum, com chance -1 (e nao 0%)', () => {
		// A ausencia fica DISTINGUIVEL de "cai pouquissimo": a tela precisa
		// poder dizer "so na loja" em vez de uma porcentagem que nao existe.
		expect(chanceDeDropDeItem(501)).toBe(-1);
		expect(raridadeDeItem(501)).toBe(0);
	});

	it('id desconhecido nao vira raro por acidente', () => {
		expect(raridadeDeItem(999123)).toBe(0);
		expect(chanceDeDropDeItem(999123)).toBe(-1);
	});

	it('Comum NAO tem classe de ladrilho — o normal nao leva borda', () => {
		expect(CLASSE_DE_RARIDADE[0]).toBe('');
		expect(CLASSE_DE_RARIDADE.slice(1)).toEqual(['is-uncommon', 'is-rare', 'is-unique']);
	});
});

describe('o tipo', () => {
	it('vem no `enum item_types` que a loja usa para agrupar', () => {
		expect(tipoDeItem(501)).toBe(ItemType.HEALING);
		expect(tipoDeItem(4001)).toBe(ItemType.CARD);
		expect(tipoDeItem(1750)).toBe(ItemType.AMMO);
	});
});

describe('a recusa', () => {
	it('versao desconhecida e ERRO, e nao uma tabela meio carregada', () => {
		expect(() => absorverFichasDeItem({ v: 99, itens: {} })).toThrow(/versao 99/);
		expect(() => absorverFichasDeItem(null)).toThrow();

		// E a recusa deixa a tabela VAZIA, e nao com as fichas velhas: a loja
		// prefere abrir sem peso a abrir com o peso do build anterior.
		expect(pesoDeItem(501)).toBe(null);
		absorverFichasDeItem(publicado);
		expect(pesoDeItem(501)).toBe(70);
	});
});
