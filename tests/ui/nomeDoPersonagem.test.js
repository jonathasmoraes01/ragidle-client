import { describe, expect, it } from 'vitest';
import {
	CARACTERES_APARADOS,
	NOME_MAXIMO,
	NOME_MINIMO,
	normalizarNomeDoPersonagem,
	recusaDoNomeNoCliente
} from '../../src/UI/Components/CharCreate/nomeDoPersonagem.js';

/*
 * O nome do personagem e aparado como a fonte apara (`normalize_name`,
 * `strlib.cpp:59-93`) e conferido como o cliente oficial confere
 * (`char.cpp:1341`) - o relato do dono foi "no celular nao da para criar
 * personagem", e o teclado do celular deixa espaco no fim do nome.
 *
 * Os caracteres invisiveis vao por ESCAPE neste arquivo, e nunca literais: a
 * primeira versao deste teste levou um hifen suave literal que nao chegou ao
 * disco, e o caso passou a medir outra coisa sem ninguem ver.
 */
describe('o nome do personagem antes de ir ao servidor', () => {
	it('a lista de aparados e a TRIM_CHARS da fonte, com o \\255 octal lido como 0xAD', () => {
		expect(CARACTERES_APARADOS).toBe('\u00ad\u00a0\u001a\t\n\r ');
		expect(CARACTERES_APARADOS.length).toBe(7);
	});

	it('o espaco que a sugestao do teclado deixa no fim SAI', () => {
		expect(normalizarNomeDoPersonagem('Fulano ')).toBe('Fulano');
		expect(normalizarNomeDoPersonagem('  Fulano')).toBe('Fulano');
	});

	it('uma sequencia de aparados no MEIO vira um espaco so', () => {
		expect(normalizarNomeDoPersonagem('Ana   Bob')).toBe('Ana Bob');
		expect(normalizarNomeDoPersonagem('Ana\t\nBob')).toBe('Ana Bob');
		expect(normalizarNomeDoPersonagem('Ana Bob')).toBe('Ana Bob');
	});

	it('o hifen suave, o espaco duro e o SUB tambem sao aparados', () => {
		expect(normalizarNomeDoPersonagem('\u00adFulano\u001a')).toBe('Fulano');
		expect(normalizarNomeDoPersonagem('Fulano\u00a0')).toBe('Fulano');
	});

	it('nome sem aparado nenhum passa intacto, e so aparados vira vazio', () => {
		expect(normalizarNomeDoPersonagem('Cobaia')).toBe('Cobaia');
		expect(normalizarNomeDoPersonagem('   ')).toBe('');
		expect(normalizarNomeDoPersonagem(undefined)).toBe('');
	});

	it('curto e longo sao recusados AQUI, com a razao certa - e as pontas exatas passam', () => {
		expect(recusaDoNomeNoCliente('Ana')).toMatch(/de 4 a 23/);
		expect(recusaDoNomeNoCliente('')).toMatch(/de 4 a 23/);
		expect(recusaDoNomeNoCliente('a'.repeat(NOME_MAXIMO + 1))).toMatch(/de 4 a 23/);
		expect(recusaDoNomeNoCliente('a'.repeat(NOME_MINIMO))).toBeNull();
		expect(recusaDoNomeNoCliente('a'.repeat(NOME_MAXIMO))).toBeNull();
	});

	it('"Joe " com o espaco da sugestao era 4 caracteres e passava - aparado, ele e curto', () => {
		expect(recusaDoNomeNoCliente('Joe ')).toBeNull();
		expect(recusaDoNomeNoCliente(normalizarNomeDoPersonagem('Joe '))).toMatch(/de 4 a 23/);
	});
});
