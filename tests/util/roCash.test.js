/**
 * `formatarRoCash` - a UNICA forma de escrever RO Cash na tela (RO Shop, HUD e
 * Temporada). Minor units inteiras, duas casas, virgula decimal, ponto de
 * milhar, nunca float (CONTRATO.md do RO Shop, secao 1).
 */
import { describe, expect, it } from 'vitest';
import { ehMinor, formatarRoCash, minorDe } from 'Utils/roCash.js';

describe('formatarRoCash', () => {
	it('os exemplos do contrato e do catalogo', () => {
		expect(formatarRoCash(862000)).toBe('8.620,00');
		expect(formatarRoCash(200)).toBe('2,00');
		expect(formatarRoCash(350)).toBe('3,50');
		expect(formatarRoCash(700)).toBe('7,00');
		expect(formatarRoCash(150)).toBe('1,50');
	});

	it('bordas: zero, centavo, milhoes e negativo', () => {
		expect(formatarRoCash(0)).toBe('0,00');
		expect(formatarRoCash(1)).toBe('0,01');
		expect(formatarRoCash(99)).toBe('0,99');
		expect(formatarRoCash(123456789)).toBe('1.234.567,89');
		expect(formatarRoCash(-4300)).toBe('-43,00');
	});

	it('entrada invalida nunca vira "NaN" na tela', () => {
		expect(formatarRoCash(undefined)).toBe('0,00');
		expect(formatarRoCash(null)).toBe('0,00');
		expect(formatarRoCash('abc')).toBe('0,00');
		expect(formatarRoCash(Infinity)).toBe('0,00');
	});

	it('nao depende de toLocaleString (o separador nao muda com o navegador)', () => {
		expect(formatarRoCash(100000000)).toBe('1.000.000,00');
	});
});

describe('minorDe: a forma nova ganha, a antiga e x100', () => {
	it('o campo ...Minor ganha sempre', () => {
		expect(minorDe({ saldoMinor: 150, saldo: 9 }, 'saldo')).toBe(150);
	});

	it('o inteiro antigo e multiplicado por 100 (a conta da migracao D-RS-02)', () => {
		expect(minorDe({ preco: 2 }, 'preco')).toBe(200);
		expect(minorDe({ cash: 100 }, 'cash')).toBe(10000);
	});

	it('nada presente, float ou string -> null (nunca um numero inventado)', () => {
		expect(minorDe({}, 'preco')).toBeNull();
		expect(minorDe({ preco: null }, 'preco')).toBeNull();
		expect(minorDe({ preco: 1.5 }, 'preco')).toBeNull();
		expect(minorDe({ precoMinor: '150' }, 'preco')).toBeNull();
		expect(minorDe(null, 'preco')).toBeNull();
	});

	it('ehMinor so aceita inteiro de verdade', () => {
		expect(ehMinor(0)).toBe(true);
		expect(ehMinor(150)).toBe(true);
		expect(ehMinor(1.5)).toBe(false);
		expect(ehMinor('150')).toBe(false);
	});
});
