import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ALFA_DO_PROPRIO_ENCOBERTO, corDoEncoberto } from 'Renderer/Entity/corDoEncoberto.js';

describe('a cor de quem esta encoberto (D-1354)', () => {
	it('os OUTROS encobertos somem — alfa 0, como a fonte pede', () => {
		expect(corDoEncoberto({ ehOProprio: false, intravisao: false })).toEqual({ r: 1, g: 1, b: 1, a: 0 });
	});

	it('o PROPRIO personagem fica meio transparente, e nao some da propria tela', () => {
		const cor = corDoEncoberto({ ehOProprio: true, intravisao: false });
		expect(cor.a).toBe(ALFA_DO_PROPRIO_ENCOBERTO);
		// CONTROLE: visivel de verdade, e ainda assim diferente de nao-encoberto.
		expect(cor.a).toBeGreaterThan(0);
		expect(cor.a).toBeLessThan(1);
	});

	it('com a INTRAVISAO, a silhueta preta e opaca — para o proprio e para os outros', () => {
		const preta = { r: 0, g: 0, b: 0, a: 1 };
		expect(corDoEncoberto({ ehOProprio: false, intravisao: true })).toEqual(preta);
		expect(corDoEncoberto({ ehOProprio: true, intravisao: true })).toEqual(preta);
	});
});

describe('a costura com o setter do effectState', () => {
	it('o ramo de Hide/Cloak/Chasewalk usa a regra, sabe quem e o proprio e pinta os quatro canais', () => {
		/*
		 * A regra pura passar nao prova que o jogo a usa: o setter podia continuar
		 * apagando todo mundo. Este caso le o fonte do setter e cobra a chamada,
		 * com o "proprio" decidido do jeito que o fork ja decide
		 * (`entity === Session.Entity`, EntityManager.js).
		 *
		 * O recorte vai do bit do Cloak ate o `else if` seguinte — e nao por uma
		 * janela fixa: o ramo vizinho (Camuflagem) tambem le a intravisao, e uma
		 * janela larga o bastante para pegar este ramo inteiro pegaria o dele junto.
		 */
		const fonte = readFileSync('src/Renderer/Entity/EntityState.js', 'utf8');
		const inicio = fonte.indexOf('StatusConst.EffectState.CLOAK');
		expect(inicio, 'o ramo do Cloak sumiu do setter').toBeGreaterThan(-1);
		const fim = fonte.indexOf('else if', inicio);
		expect(fim, 'o ramo seguinte ao do Cloak sumiu — o recorte nao tem fim').toBeGreaterThan(inicio);
		const ramo = fonte.slice(inicio, fim);
		expect(ramo, 'o ramo do Cloak nao usa a regra da cor').toContain('corDoEncoberto(');
		expect(ramo, 'o ramo nao sabe quem e o proprio personagem').toContain('ehOProprio: this === Session.Entity');
		expect(ramo, 'o ramo perdeu a intravisao').toContain('intravisao: Boolean(Session.Entity?.intravision)');
		['r', 'g', 'b', 'a'].forEach((canal, i) => {
			expect(ramo, `o canal ${canal} nao sai da regra`).toContain(`this._effectStateColor[${i}] = cor.${canal};`);
		});
	});
});
