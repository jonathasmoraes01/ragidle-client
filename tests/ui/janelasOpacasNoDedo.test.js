/**
 * TODA JANELA OPACA NO DEDO (28/09/2026, ordem do dono: "sim, faça isso, pode
 * estender o fundo opaco a todas").
 *
 * O Codex virou opaco no celular em pe em D-1640. A causa era de TODA janela:
 * `.ri-window` pinta `--window-fill`, que e o vidro `--surface-window` (94-96%),
 * e no dedo o desfoque sai (`--blur-glass: none`). Sem ele, o mundo aparece
 * atras do texto. A troca mora no bloco `pointer: coarse` do Common.css — o
 * mesmo criterio de `ehDedo()` —, e o desktop fica com o vidro.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const COMUM = readFileSync(join(process.cwd(), 'src', 'UI', 'Common.css'), 'utf8');

/** Os blocos `@media (pointer: coarse) { ... }` do Common.css, na ordem. */
function blocosDoDedo() {
	const blocos = [];
	let i = COMUM.indexOf('@media (pointer: coarse) {');
	while (i >= 0) {
		let profundidade = 0;
		let fim = i;
		for (let j = COMUM.indexOf('{', i); j < COMUM.length; j++) {
			if (COMUM[j] === '{') profundidade++;
			if (COMUM[j] === '}') profundidade--;
			if (profundidade === 0) {
				fim = j;
				break;
			}
		}
		blocos.push(COMUM.slice(i, fim + 1));
		i = COMUM.indexOf('@media (pointer: coarse) {', fim);
	}
	return blocos;
}

describe('toda janela opaca no dedo', () => {
	it('o bloco do dedo que tira o desfoque troca o vidro da janela pelo token opaco', () => {
		const doDesfoque = blocosDoDedo().filter((b) => b.includes('--blur-glass: none;'));
		// Controle: sem o bloco do desfoque, o caso abaixo passaria de graca.
		expect(doDesfoque).toHaveLength(1);
		expect(doDesfoque[0]).toMatch(/:host\s*\{[^}]*--surface-window:\s*var\(--surface-window-opaca\);/);
	});

	it('fora do dedo a janela continua vidro: a primeira declaracao do token tem alfa', () => {
		const primeira = COMUM.match(/^\s*--surface-window:\s*([^;]+);/m);
		expect(primeira).not.toBeNull();
		expect(primeira[1]).toMatch(/rgba\(/);
	});

	it('a moldura da janela le o token pelo --window-fill, que a troca alcanca', () => {
		expect(COMUM).toMatch(/--window-fill:\s*var\(--surface-window\);/);
		expect(COMUM).toMatch(/--ri-janela-bg:\s*var\(--surface-window\);/);
	});
});
