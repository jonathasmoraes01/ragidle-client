import { describe, expect, it } from 'vitest';
import { decidir } from 'Core/idiomaDaConta.js';

describe('o idioma da conta decide (D-1929)', () => {
	it('a conta manda quando difere do aparelho', () => {
		expect(decidir('en', 'pt-BR', true)).toBe('aplicar');
		expect(decidir('pt-BR', 'en', false)).toBe('aplicar');
	});
	it('nao faz nada quando concordam (sem laco de recarga)', () => {
		expect(decidir('en', 'en', true)).toBe('nada');
	});
	it('conta sem idioma recebe o do aparelho se ele ja escolheu', () => {
		expect(decidir(undefined, 'en', true)).toBe('subir');
	});
	it('ninguem escolheu: o passo zero pergunta', () => {
		expect(decidir(undefined, 'pt-BR', false)).toBe('nada');
	});
	it('valor desconhecido da conta e ignorado', () => {
		expect(decidir('es', 'pt-BR', false)).toBe('nada');
		expect(decidir(5, 'en', true)).toBe('subir');
	});
});
