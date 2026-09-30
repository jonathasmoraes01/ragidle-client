/**
 * AS PRESAS LEGIVEIS NO CELULAR, E O NOME LONGO INTEIRO (30/09/2026).
 *
 * Medido pela sonda de tela em Arredores de Geffen (celular 393x852): a grade
 * de MONSTROS em duas colunas deixava 18 px ao nome ("G...", "G...", "R..."),
 * e os cinco Goblin ficavam iguais justo depois de ganharem o nome distinto
 * (D-1870). A D-1348 ja tinha dado uma coluna a grade de ITENS pelo mesmo
 * motivo, e deixara a de monstros de fora. Com uma coluna o nome tem 117 px, e
 * o rotulo mais longo ("Incarnation of Morocc (Fantasma 3)") quebra em duas
 * linhas inteiras, em vez de perder o que o distingue.
 *
 * Le o CSS sem comentarios: o que vale e a regra, e nao a prosa.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const CSS = readFileSync('src/UI/Components/IdleConfig/IdleConfig.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** O corpo de uma regra (`seletor { ... }`), dentro ou fora de um bloco @media. */
function regra(texto, seletor) {
	const i = texto.indexOf(`${seletor} {`);
	if (i < 0) return null;
	return texto.slice(i, texto.indexOf('}', i));
}

const celular = (() => {
	const i = CSS.indexOf('@media (max-width: 599px)');
	// O bloco termina no primeiro "}" sozinho numa linha depois do inicio.
	const fim = CSS.slice(i).search(/\n\}\s*\n/);
	return CSS.slice(i, i + fim);
})();

describe('a grade de presas no celular', () => {
	it('a de MONSTROS tem uma coluna so, como a de itens (D-1348)', () => {
		expect(regra(celular, '#IdleConfig .ic-presas')).toContain('grid-template-columns: minmax(0, 1fr);');
		expect(regra(celular, '#IdleConfig .ic-presas.ic-presas--itens')).toContain('grid-template-columns: minmax(0, 1fr);');
	});

	it('CONTROLE: fora do celular a grade continua em duas colunas', () => {
		const fora = CSS.slice(0, CSS.indexOf('@media (max-width: 599px)'));
		expect(regra(fora, '#IdleConfig .ic-presas')).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));');
	});
});

describe('o nome da presa', () => {
	const nome = regra(CSS, '#IdleConfig .ic-presa-nome');
	it('quebra em ate duas linhas antes das reticencias', () => {
		expect(nome).toContain('white-space: normal;');
		expect(nome).toContain('-webkit-line-clamp: 2;');
		expect(nome).toContain('-webkit-box-orient: vertical;');
		expect(nome).toContain('display: -webkit-box;');
		expect(nome).not.toContain('white-space: nowrap;');
	});
});
