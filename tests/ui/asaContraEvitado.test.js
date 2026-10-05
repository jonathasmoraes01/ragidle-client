/**
 * A ASA CONTRA O MONSTRO EVITADO (D-1983, R103, 05/10/2026): o interruptor da
 * aba Cacada, so VIP.
 *
 * Sugestao de jogador que o dono mandou fazer: *"seja possivel passar reto e/ou
 * programar uma asa de mosca"* contra o agressivo que ele desmarcou em Presas.
 * O interruptor mora logo depois da troca de flecha, no MESMO molde da Asa: sem
 * VIP aparece desabilitado com a explicacao, em vez de sumir. O campo e aditivo
 * no servidor (ausente = desligado). Le o fonte sem comentarios.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const semComentario = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const JS = semComentario(readFileSync('src/UI/Components/IdleConfig/IdleConfig.js', 'utf8'));
const corpo = (() => {
	const i = JS.indexOf('function renderAsaContraEvitado()');
	return JS.slice(i, JS.indexOf('\nfunction ', i + 10));
})();

describe('o interruptor VIP da Asa contra o monstro evitado (D-1983)', () => {
	it('a aba Cacada o desenha logo depois da troca de flecha', () => {
		expect(JS).toMatch(/\$\{renderFlechaQueFere\(\)\}\s*\$\{renderAsaContraEvitado\(\)\}/);
	});

	it('escreve no campo do servidor, nasce DESLIGADO e trava sem VIP', () => {
		expect(corpo).toContain("'asaAoSerAtacadoPorEvitado'");
		expect(corpo).toContain('const ligada = cfg.asaAoSerAtacadoPorEvitado === true;');
		expect(corpo).toContain('const ehVip = !!(ctx && ctx.ehVip);');
		expect(corpo).toMatch(/switchRow\([\s\S]*?ehVip && ligada,[\s\S]*?!ehVip\s*\)/);
	});

	it('sem VIP a explicacao aparece, sem travessao', () => {
		expect(corpo).toContain('O uso automático da Asa é do passe VIP.');
		expect(/[–—]/.test(corpo)).toBe(false);
	});

	it('a nota das Presas diz que a desmarcada e evitada (e nao mais "se defende dela")', () => {
		expect(JS).toContain('A desmarcada é evitada: se ela atacar, o personagem não revida');
		expect(JS).not.toContain('o personagem se defende dela');
	});
});
