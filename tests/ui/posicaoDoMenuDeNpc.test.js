/**
 * O MENU DE NPC CRESCE ATE SETE LINHAS (D-2047, 06/10/2026).
 *
 * Ordem do dono: *"aumenta para crescer a janela ate mostrar todas as opcoes
 * sem rolar (ate ~7 linhas)"*. A caixa fixa de 150px mostrava ~4 linhas: a
 * Kafra com 6 opcoes escondia "Curar" e "Devolver carrinho" atras da rolagem.
 *
 * Duas metades: a REGRA pura (`posicaoDoMenu`, quantas linhas e onde) e a
 * COSTURA no fonte (o `setMenu` mede e aplica; a caixa deixou de ter altura
 * fixa; o dedo ganhou 44px nas linhas e nos botoes). A costura e portao de
 * FONTE, lido sem comentarios para nao passar pela propria prosa; quem prova
 * que o desenho bate e a sonda `scripts/diag-menu-de-npc-na-tela.ts` do
 * servidor, com os PNGs.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
	FOLGA_DA_FALA,
	LINHAS_MINIMAS,
	LINHAS_SEM_ROLAR,
	MARGEM,
	posicaoDoMenu
} from '../../src/UI/Components/NpcMenu/posicaoDoMenu.js';

/** A janela de desktop medida: 66px de moldura, titulo e rodape, 22px por linha. */
const FIXA = 66;
const PASSO = 22;
const alturas = n => Array.from({ length: Math.min(n, LINHAS_SEM_ROLAR) }, (_, i) => FIXA + (i + 1) * PASSO);

const DESKTOP = { largura: 1600, altura: 900 };
/** A NpcBox de 200px no desktop 1600x900: top max(100, 900/2 - 200) = 250. */
const FALA_DESKTOP = { top: 250, bottom: 450 };
const PREF_DESKTOP = { top: 526, left: 533 };

describe('posicaoDoMenu: quantas linhas (D-2047)', () => {
	it('as constantes sao as da ordem: ate 7 linhas, minimo 3', () => {
		expect(LINHAS_SEM_ROLAR).toBe(7);
		expect(LINHAS_MINIMAS).toBe(3);
		expect(MARGEM).toBe(8);
		expect(FOLGA_DA_FALA).toBe(8);
	});

	it('com espaco, mostra TODAS as opcoes ate 7 (a Kafra de 6 inteira)', () => {
		for (const n of [1, 2, 3, 4, 5, 6, 7]) {
			const p = posicaoDoMenu({ tela: DESKTOP, fala: FALA_DESKTOP, largura: 276, alturas: alturas(n), preferida: PREF_DESKTOP, centralizar: false });
			expect(p.linhas, `${n} opcoes`).toBe(n);
		}
	});

	it('com mais de 7, mostra 7 e a lista rola por dentro', () => {
		const p = posicaoDoMenu({ tela: DESKTOP, fala: FALA_DESKTOP, largura: 276, alturas: alturas(12), preferida: PREF_DESKTOP, centralizar: false });
		expect(p.linhas).toBe(7);
	});

	it('um vetor de alturas mais longo que 7 nao passa de 7', () => {
		const longas = Array.from({ length: 12 }, (_, i) => FIXA + (i + 1) * PASSO);
		const p = posicaoDoMenu({ tela: DESKTOP, fala: null, largura: 276, alturas: longas, preferida: PREF_DESKTOP, centralizar: false });
		expect(p.linhas).toBe(7);
	});

	it('sem espaco abaixo da fala, encolhe a lista em vez de cobrir a fala', () => {
		// Tela de 600: a fala acaba em 300; abaixo dela sobram 600-8-308 = 284px,
		// e linhas de 40px com 100px de moldura so cabem 4.
		const altas = Array.from({ length: 7 }, (_, i) => 100 + (i + 1) * 40);
		const p = posicaoDoMenu({ tela: { largura: 800, altura: 600 }, fala: { top: 100, bottom: 300 }, largura: 276, alturas: altas, preferida: { top: 376, left: 266 }, centralizar: false });
		// 308 + 100 + 4*40 = 568 <= 592; com 5 linhas, 608 > 592.
		expect(p.linhas).toBe(4);
		// A preferida (376) estoura o chao com 260px: sobe ate 592-260 = 332,
		// ainda abaixo da fala (308).
		expect(p.top).toBe(332);
	});

	it('nao encolhe abaixo de 3: a janela sobe por cima da fala, mas fica na tela', () => {
		const altas = Array.from({ length: 7 }, (_, i) => 100 + (i + 1) * 60);
		const p = posicaoDoMenu({ tela: { largura: 800, altura: 500 }, fala: { top: 100, bottom: 300 }, largura: 276, alturas: altas, preferida: { top: 376, left: 266 }, centralizar: false });
		expect(p.linhas).toBe(3);
		// 3 linhas = 280px; o chao e 492; o topo vai a 212, por cima da fala.
		expect(p.top).toBe(212);
	});

	it('com 2 opcoes e pouco espaco, o piso e 2 (nao inventa linha)', () => {
		const altas = [100 + 60, 100 + 120];
		const p = posicaoDoMenu({ tela: { largura: 800, altura: 300 }, fala: { top: 50, bottom: 250 }, largura: 276, alturas: altas, preferida: { top: 376, left: 266 }, centralizar: false });
		expect(p.linhas).toBe(2);
		expect(p.top).toBe(72);
	});
});

describe('posicaoDoMenu: onde (D-2047)', () => {
	it('no desktop folgado, fica no lugar de sempre', () => {
		const p = posicaoDoMenu({ tela: DESKTOP, fala: FALA_DESKTOP, largura: 276, alturas: alturas(6), preferida: PREF_DESKTOP, centralizar: false });
		expect(p).toEqual({ top: 526, left: 533, linhas: 6 });
	});

	it('nunca nasce em cima da fala: o topo fica abaixo dela com a folga', () => {
		const p = posicaoDoMenu({ tela: DESKTOP, fala: { top: 300, bottom: 560 }, largura: 276, alturas: alturas(3), preferida: PREF_DESKTOP, centralizar: false });
		expect(p.top).toBe(560 + FOLGA_DA_FALA);
	});

	it('se o fundo passa da tela, sobe ate caber, sem invadir a fala', () => {
		// Tela 768: preferida 460; 7 linhas = 220 -> fundo 680 cabe. Com fala ate 520:
		// topo minimo 528, 528+220 = 748 <= 760: fica em 528.
		const p = posicaoDoMenu({ tela: { largura: 1024, altura: 768 }, fala: { top: 320, bottom: 520 }, largura: 276, alturas: alturas(7), preferida: { top: 460, left: 341 }, centralizar: false });
		expect(p.top).toBe(528);
		// Sem fala, a preferida 700 estoura (700+220 > 760) e o menu sobe a 540.
		const q = posicaoDoMenu({ tela: { largura: 1024, altura: 768 }, fala: null, largura: 276, alturas: alturas(7), preferida: { top: 700, left: 341 }, centralizar: false });
		expect(q.top).toBe(760 - 220);
	});

	it('sem fala, o topo minimo e a margem', () => {
		const p = posicaoDoMenu({ tela: { largura: 400, altura: 300 }, fala: null, largura: 276, alturas: [400], preferida: { top: 100, left: 50 }, centralizar: false });
		expect(p.top).toBe(MARGEM);
	});

	it('no dedo, centraliza na horizontal', () => {
		const p = posicaoDoMenu({ tela: { largura: 393, altura: 852 }, fala: { top: 226, bottom: 426 }, largura: 320, alturas: alturas(6), preferida: { top: 502, left: 131 }, centralizar: true });
		expect(p.left).toBe(Math.round((393 - 320) / 2));
	});

	it('na horizontal fica inteira na tela, com margem', () => {
		const dir = posicaoDoMenu({ tela: { largura: 800, altura: 900 }, fala: null, largura: 276, alturas: alturas(2), preferida: { top: 400, left: 700 }, centralizar: false });
		expect(dir.left).toBe(800 - MARGEM - 276);
		const esq = posicaoDoMenu({ tela: { largura: 800, altura: 900 }, fala: null, largura: 276, alturas: alturas(2), preferida: { top: 400, left: -50 }, centralizar: false });
		expect(esq.left).toBe(MARGEM);
	});

	it('mais larga que a tela: centralizada, nunca com a borda esquerda fora', () => {
		const p = posicaoDoMenu({ tela: { largura: 280, altura: 900 }, fala: null, largura: 276, alturas: alturas(2), preferida: { top: 400, left: 100 }, centralizar: false });
		expect(p.left).toBe(2);
		const q = posicaoDoMenu({ tela: { largura: 200, altura: 900 }, fala: null, largura: 276, alturas: alturas(2), preferida: { top: 400, left: 100 }, centralizar: false });
		expect(q.left).toBe(0);
	});
});

const semComentario = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const CSS = semComentario(readFileSync('src/UI/Components/NpcMenu/NpcMenu.css', 'utf8'));
const JS = semComentario(readFileSync('src/UI/Components/NpcMenu/NpcMenu.js', 'utf8'));

describe('a costura do menu que cresce (D-2047)', () => {
	it('o setMenu mede e aplica a posicao depois de montar as opcoes', () => {
		const corpo = JS.slice(JS.indexOf('NpcMenu.setMenu = function'), JS.indexOf('function validate()'));
		expect(corpo).toContain('content.appendChild(div);');
		expect(corpo.indexOf('ajustarAoConteudo(')).toBeGreaterThan(corpo.indexOf('content.appendChild(div);'));
		expect(JS).toContain('posicaoDoMenu(');
	});

	it('a caixa deixou de ter altura fixa: a lista dita a altura', () => {
		const host = CSS.match(/:host\s*\{([^}]*)\}/);
		expect(host[1]).toMatch(/height:\s*auto/);
		const janela = CSS.match(/#NpcMenu\s*\{([^}]*)\}/);
		expect(janela[1]).toMatch(/height:\s*auto/);
		expect(janela[1]).toMatch(/position:\s*relative/);
		const caixa = CSS.match(/#NpcMenu \.container\s*\{([^}]*)\}/);
		expect(caixa[1]).not.toMatch(/(^|[^-])height:\s*\d/);
	});

	it('no dedo, linhas e botoes tem 44px de alvo', () => {
		const dedo = CSS.slice(CSS.indexOf('@media (pointer: coarse)'));
		expect(dedo).toMatch(/#NpcMenu \.content div\s*\{[^}]*min-height:\s*var\(--hit-touch, 44px\)/);
		expect(dedo).toMatch(/#NpcMenu \.btn\s*\{[^}]*min-height:\s*var\(--hit-touch, 44px\)/);
	});

	it('o criterio de dedo e o da casa (ehDedo), sem matchMedia novo', () => {
		expect(JS).toContain("import { ehDedo } from 'UI/escalaDaHud.js';");
		expect(JS).not.toContain('matchMedia');
	});
});
