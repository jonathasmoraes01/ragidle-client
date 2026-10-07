/**
 * NO CELULAR, 60 QUADROS POR SEGUNDO (06/10/2026, decisao do dono). O desktop
 * fica nos 120 do padrao, e a escolha explicita do jogador vence nos dois.
 * Antes, o `Renderer` aplicava o `fpslimit` (120) em qualquer aparelho.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TETO_DE_QUADROS_NO_CELULAR, limiteDeQuadrosDoAparelho } from 'Renderer/tetoDeQuadrosNoCelular.js';

const semComentario = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

describe('o limite de quadros por aparelho', () => {
	it('celular sem escolha do jogador: 60', () => {
		expect(TETO_DE_QUADROS_NO_CELULAR).toBe(60);
		expect(limiteDeQuadrosDoAparelho({ fpslimit: 120 }, true)).toBe(60);
	});

	it('desktop: o fpslimit de sempre', () => {
		expect(limiteDeQuadrosDoAparelho({ fpslimit: 120 }, false)).toBe(120);
		expect(limiteDeQuadrosDoAparelho({ fpslimit: 30, fpslimitEscolhido: true }, false)).toBe(30);
	});

	it('a escolha do jogador vence o teto do celular, para cima e para baixo', () => {
		expect(limiteDeQuadrosDoAparelho({ fpslimit: 120, fpslimitEscolhido: true }, true)).toBe(120);
		expect(limiteDeQuadrosDoAparelho({ fpslimit: 30, fpslimitEscolhido: true }, true)).toBe(30);
	});
});

describe('as costuras (lidas do fonte: o Renderer e a janela nao carregam em jsdom)', () => {
	it('o Renderer aplica o limite do aparelho em jogo, e nao o fpslimit cru', () => {
		const r = semComentario(readFileSync('src/Renderer/Renderer.js', 'utf8'));
		expect(r).toContain('const limite = limiteDeQuadrosDoAparelho(GraphicsSettings, this._dedo);');
		expect(r).not.toContain('this.frameLimit = GraphicsSettings.fpslimit;');
	});

	it('mexer no limite na janela de opcoes marca a escolha do jogador', () => {
		const g = semComentario(readFileSync('src/UI/Components/GraphicsOption/GraphicsOption.js', 'utf8'));
		const corpo = g.slice(g.indexOf('function onUpdateFPSLimit() {'));
		expect(corpo.indexOf('GraphicsSettings.fpslimitEscolhido = true;')).toBeGreaterThan(-1);
		expect(corpo.indexOf('GraphicsSettings.fpslimitEscolhido = true;')).toBeLessThan(corpo.indexOf('GraphicsSettings.save();'));
	});
});
