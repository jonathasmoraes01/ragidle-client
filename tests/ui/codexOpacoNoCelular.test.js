/**
 * NO CELULAR EM PE, A JANELA DO CODEX E OPACA (28/09/2026, D-1640 — item 27).
 *
 * O relato do dono: a janela do Codex translucida no celular, com o jogo
 * aparecendo por tras e atrapalhando a leitura. A causa e o vidro da janela
 * (`--surface-window`, 94-96%) somado a saida do desfoque no dedo
 * (`--blur-glass: none` no bloco `pointer: coarse` do Common.css): sem o
 * desfoque, os 4-6% que passam desenham o chao e a HUD atras do texto.
 *
 * O conserto e uma regra e um token, e os dois somem calados numa
 * "simplificacao" — a janela continua abrindo, so que translucida de novo, e
 * nada acusa. Este portao cobra as tres coisas que o conserto precisa:
 *   1. o token opaco existe e NAO tem alfa;
 *   2. ele e a MESMA janela (as duas cores de `--surface-window`), e nao uma
 *      cor nova inventada;
 *   3. so a HUD vertical o usa no Codex — o desktop continua com o vidro.
 *
 * O que ele NAO prova: que a tela mostra a janela opaca. Isso e da sonda
 * `scripts/diag-mobile-portrait.ts` do servidor, com alguem OLHANDO a foto.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const COMUM = readFileSync(join(process.cwd(), 'src', 'UI', 'Common.css'), 'utf8');
const CODEX = readFileSync(join(process.cwd(), 'src', 'UI', 'Components', 'CodexIdle', 'CodexIdle.css'), 'utf8');

/** O valor de um token `--nome: valor;` do Common.css. */
function token(nome) {
	const m = COMUM.match(new RegExp('^\\s*' + nome + ':\\s*([^;]+);', 'm'));
	expect(m, `o token ${nome} sumiu do Common.css`).not.toBeNull();
	return m[1];
}

/** As cores de um gradiente, como [r, g, b, a]. */
function cores(valor) {
	const lista = [];
	for (const m of valor.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/g)) {
		lista.push([Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])]);
	}
	return lista;
}

/** O corpo de uma regra pelo seletor exato, no COMECO da linha (senao
 * `#CodexIdle .cx-window` casaria dentro de `.ri-vertical #CodexIdle ...`). */
function corpoDaRegra(css, seletor) {
	const achado = css.match(new RegExp('^' + seletor.replace(/[.#]/g, '\\$&') + ' \\{', 'm'));
	if (achado === null) return null;
	const inicio = achado.index;
	const abre = css.indexOf('{', inicio);
	return css.slice(abre + 1, css.indexOf('}', abre));
}

describe('a janela do Codex no celular em pe', () => {
	it('o token opaco existe e nenhuma cor dele tem alfa', () => {
		const opaca = cores(token('--surface-window-opaca'));
		// Controle: um gradiente sem cor nenhuma passaria o "nenhum alfa" de graca.
		expect(opaca.length).toBe(2);
		for (const [, , , a] of opaca) expect(a).toBe(1);
	});

	it('e a MESMA janela: as duas cores de --surface-window, so sem o vidro', () => {
		const vidro = cores(token('--surface-window'));
		const opaca = cores(token('--surface-window-opaca'));
		expect(vidro.length).toBe(2);
		// O vidro continua vidro: se ele virasse opaco, o desktop mudaria junto.
		expect(vidro.some(([, , , a]) => a < 1)).toBe(true);
		expect(opaca.map(([r, g, b]) => [r, g, b])).toEqual(vidro.map(([r, g, b]) => [r, g, b]));
	});

	it('so a HUD vertical pinta o Codex com o token opaco', () => {
		const vertical = corpoDaRegra(CODEX, '.ri-vertical #CodexIdle .cx-window');
		expect(vertical, 'a regra do Codex na HUD vertical sumiu').not.toBeNull();
		expect(vertical).toMatch(/background:\s*var\(--surface-window-opaca\)/);

		// O desktop nao muda: a regra sem a marca nao escreve fundo nenhum.
		const desktop = corpoDaRegra(CODEX, '#CodexIdle .cx-window');
		expect(desktop, 'a regra base da janela do Codex sumiu').not.toBeNull();
		expect(desktop).not.toMatch(/background/);
	});
});
