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
import JobId from 'DB/Jobs/JobConst.js';
import { ehDaLinhaDoArqueiro } from '../../src/UI/Components/IdleConfig/linhaDoArqueiro.js';

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

describe('a Asa segue o mesmo criterio, e os textos da cidade seguem a regra (30/09/2026)', () => {
	it('a Asa travada sem VIP aparece desligada, como a troca de flecha', () => {
		const i = JS.indexOf('function renderAsa()');
		const asa = JS.slice(i, JS.indexOf('\nfunction ', i + 10));
		expect(asa).toMatch(/switchRow\(\s*'asa\.ligada',\s*ehVip && ligada,/);
	});

	it('os avisos da cidade tem acento e nao tem travessao', () => {
		const fonte = readFileSync('src/UI/Components/IdleConfig/IdleConfig.js', 'utf8');
		expect(fonte).toContain("'Você está na cidade. A caça começa quando você viajar.'");
		expect(fonte).not.toContain('Voce esta na cidade');
		for (const linha of fonte.split('\n').filter(l => l.includes('Você está na cidade'))) {
			expect(/[\u2013\u2014]/.test(linha)).toBe(false);
		}
	});
});

describe('so a linha do Arqueiro e a do Arruaceiro veem o interruptor (30/09/2026, ordem do dono)', () => {
	it('a guarda e a PRIMEIRA coisa do render: fora da linha, nada (nem o divisor)', () => {
		const inicio = corpo.slice(corpo.indexOf('{') + 1).trimStart();
		expect(inicio.startsWith("if (!ehDaLinhaDoArqueiro(Session.Entity && Session.Entity._job)) return '';")).toBe(true);
	});

	it('Arqueiro, Cacador, Bardo, Odalisca, Arruaceiro e Desordeiro entram; Gatuno, Mercenario, Aprendiz e Sumo Sacerdote nao', () => {
		for (const job of [
			JobId.ARCHER, JobId.HUNTER, JobId.BARD, JobId.DANCER, JobId.HUNTER_H, JobId.RANGER, JobId.OSTRICH_ARCHER,
			JobId.ROGUE, JobId.ROGUE_H, JobId.SHADOW_CHASER, JobId.DOG_ROGUE,
		]) {
			expect(ehDaLinhaDoArqueiro(job), `job ${job}`).toBe(true);
		}
		for (const job of [JobId.NOVICE, JobId.THIEF, JobId.ASSASSIN, JobId.ASSASSIN_H, JobId.SWORDMAN, JobId.ARCHBISHOP, JobId.ARCH_MAGE, undefined, null]) {
			expect(ehDaLinhaDoArqueiro(job), `job ${job}`).toBe(false);
		}
		// O id chega do fio como numero; texto numerico tambem vale.
		expect(ehDaLinhaDoArqueiro('11')).toBe(true);
	});

	it('os 20 ids do jogo: so os cinco que usam arco (Arqueiro 3, Cacador 11, Arruaceiro 17, Bardo 19, Odalisca 20)', () => {
		const doJogo = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20];
		expect(doJogo.filter(ehDaLinhaDoArqueiro)).toEqual([3, 11, 17, 19, 20]);
	});
});
