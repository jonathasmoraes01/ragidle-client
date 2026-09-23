/**
 * O "Criar conta" do login leva ao site com o cadastro aberto (23/09/2026).
 * Ver `src/UI/enderecoDoCadastro.js`.
 */
import { describe, expect, it } from 'vitest';

import { enderecoDoCadastro } from 'UI/enderecoDoCadastro.js';

const PLAY = { protocol: 'https:', hostname: 'play.roclassicidle.com.br' };
const LOCAL = { protocol: 'http:', hostname: 'localhost' };

describe('enderecoDoCadastro', () => {
	it('sem registrationweb, o jogo em play. vai a home com #cadastro', () => {
		expect(enderecoDoCadastro('', '', PLAY)).toBe('https://roclassicidle.com.br/#cadastro');
	});

	it('o codigo de indicacao segue antes do #cadastro', () => {
		expect(enderecoDoCadastro('', 'ab12cd', PLAY)).toBe('https://roclassicidle.com.br/?ref=AB12CD#cadastro');
	});

	it('codigo torto nao entra na URL', () => {
		expect(enderecoDoCadastro('', 'x&y=1', PLAY)).toBe('https://roclassicidle.com.br/#cadastro');
	});

	it('registrationweb explicito vence o dominio', () => {
		expect(enderecoDoCadastro('https://outro.site/cad?a=1', 'AB12CD', PLAY)).toBe(
			'https://outro.site/cad?a=1&ref=AB12CD#cadastro'
		);
	});

	it('registrationweb com # proprio guarda o dele e o ref vai antes', () => {
		expect(enderecoDoCadastro('https://outro.site/#criar', 'AB12CD', PLAY)).toBe(
			'https://outro.site/?ref=AB12CD#criar'
		);
	});

	it('em localhost sem registrationweb nao ha para onde ir', () => {
		expect(enderecoDoCadastro('', 'AB12CD', LOCAL)).toBe('');
	});
});
