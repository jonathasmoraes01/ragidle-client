/**
 * B3 — A CURA NA SEÇÃO "ATAQUE" (06/09/2026, reporte do playtest).
 *
 * Queixa do jogador: *"ainda tá confuso isso aqui, quando se trata de classe de
 * suporte... a skill 'curar' também consegue estar em 'ataque' (não testei pra
 * ver se funciona em grupo)"*.
 *
 * **Não é defeito de código: é o desenho, e ele estava implícito.**
 * `baldeDaHabilidade` (D-1060, servidor) manda `cura`, `curaFixa` e
 * `removerStatusDoAlvo` para a MESMA lista dos golpes — são as três que o motor
 * conjura contra o relógio da luta, e por isso disputam as mesmas três vagas. A
 * `recomporRotacaoAutomatica` chega a instalá-las PRIMEIRO (D-1132).
 *
 * O que faltava era a tela dizer isso. Este teste lê o fonte do componente
 * (mesma técnica de `hudIdleLeDaEntidade.test.js`, pelo mesmo motivo: o render
 * vive dentro de um módulo sem porta para chamada direta) e cobra que a regra
 * esteja ESCRITA na interface — não só a etiqueta por linha, que já existia e
 * não bastou.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const FONTE = readFileSync('src/UI/Components/IdleConfig/IdleConfig.js', 'utf8');

/** O trecho que desenha a seção Ataque — o recorte evita casar com o resto. */
const RENDER_ATAQUE = (() => {
	const i = FONTE.indexOf('function renderAtaque()');
	const f = FONTE.indexOf('function bindAtaqueExtra', i);
	expect(i).toBeGreaterThan(0);
	expect(f).toBeGreaterThan(i);
	return FONTE.slice(i, f);
})();

describe('B3 — a seção diz que cura e golpe dividem as vagas', () => {
	it('o cartão não se chama mais só "Ordem de golpes"', () => {
		// "Golpes" no título é o que fazia a Cura ali parecer defeito da janela.
		expect(RENDER_ATAQUE).toContain('<h3>Ordem de uso</h3>');
		expect(RENDER_ATAQUE).not.toContain('<h3>Ordem de golpes</h3>');
	});

	it('a REGRA está escrita, e não só implícita na etiqueta da linha', () => {
		expect(RENDER_ATAQUE).toContain('Cura e golpe dividem estas');
		// E ela diz as duas coisas que o jogador precisa saber: quando a cura
		// sai, e onde se ajusta o que decide isso.
		expect(RENDER_ATAQUE).toMatch(/abaixo do limiar/);
		expect(RENDER_ATAQUE).toMatch(/Suporte<\/strong>/);
	});

	it('a nota só aparece para quem TEM cura aprendida', () => {
		// Um aviso sobre cura na tela de um Espadachim é ruído, e ruído ensina
		// o jogador a não ler as notas.
		expect(RENDER_ATAQUE).toContain('const curasAprendidas = (ctx.skillsDeCura || []).length;');
		expect(RENDER_ATAQUE).toContain('const notaDeCura = curasAprendidas');
	});

	it('a nota conta quantas curas estão na ordem AGORA', () => {
		expect(RENDER_ATAQUE).toContain(
			'const curasNaOrdem = rotacao.filter(r => curas.has(r.skillId)).length;'
		);
	});

	it('o seletor não promete só golpe, e marca a cura na própria lista', () => {
		expect(RENDER_ATAQUE).toContain('+ Pôr uma habilidade na ordem');
		expect(RENDER_ATAQUE).not.toContain('+ Pôr um golpe na ordem');
		expect(RENDER_ATAQUE).toContain("curas.has(s.skillId) ? ' — cura' : ''");
	});

	it('as duas frases de vaga cheia falam de HABILIDADE, e não de golpe', () => {
		expect(RENDER_ATAQUE).toContain('Tire uma habilidade para pôr outra.');
		expect(RENDER_ATAQUE).toContain('Todas as habilidades disponíveis já estão na ordem.');
	});

	it('a etiqueta por linha continua lá — a nota SOMA, não substitui', () => {
		expect(RENDER_ATAQUE).toContain('cura · ajuste em Suporte');
	});

	it('`curas` é declarado antes de todo uso (a nota lê o mesmo conjunto)', () => {
		const decl = RENDER_ATAQUE.indexOf('const curas = new Set(');
		const usoNaNota = RENDER_ATAQUE.indexOf('curas.has(r.skillId)).length');
		expect(decl).toBeGreaterThan(0);
		expect(usoNaNota).toBeGreaterThan(decl);
	});
});
