/**
 * O INTERRUPTOR DA TROCA INTELIGENTE DE FLECHA (D-1866, 30/09/2026): so VIP.
 *
 * Ordem do dono: "Trocar flecha automatico = VIP" e "coloca la no menu idle
 * tbm". O interruptor mora na aba Cacada, logo abaixo da Asa, no MESMO molde
 * dela: sem VIP aparece desabilitado com a explicacao, em vez de sumir. O
 * campo e aditivo no servidor (ausente = ligado). Le o fonte sem comentarios.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const semComentario = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const JS = semComentario(readFileSync('src/UI/Components/IdleConfig/IdleConfig.js', 'utf8'));
const corpo = (() => {
	const i = JS.indexOf('function renderFlechaQueFere()');
	return JS.slice(i, JS.indexOf('\nfunction ', i + 10));
})();

describe('o interruptor VIP da troca de flecha (D-1866)', () => {
	it('a aba Cacada o desenha logo depois da Asa', () => {
		expect(JS).toMatch(/\$\{renderAsa\(\)\}\s*\$\{renderFlechaQueFere\(\)\}/);
	});

	it('escreve no campo do servidor, nasce ligado e trava sem VIP', () => {
		expect(corpo).toContain("'trocaDeFlechaQueFere'");
		expect(corpo).toContain('const ligada = cfg.trocaDeFlechaQueFere !== false;');
		expect(corpo).toContain('const ehVip = !!(ctx && ctx.ehVip);');
		// O ultimo argumento do switchRow e o "desabilitado".
		expect(corpo).toMatch(/switchRow\([\s\S]*?!ehVip\s*\)/);
	});

	it('sem VIP a explicacao aparece, sem travessao', () => {
		expect(corpo).toContain('A troca inteligente é do passe VIP.');
		expect(/[\u2013\u2014]/.test(corpo)).toBe(false);
	});
});
