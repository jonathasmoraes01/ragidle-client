/**
 * A CONFIGURACAO IDLE SEM TRAVESSAO (30/09/2026).
 *
 * Regra do dono (08/09/2026): nenhum texto que o jogador le leva travessao
 * (U+2014) nem meia-risca (U+2013). A janela tinha 20 textos antigos com eles;
 * este portao cobre a pasta inteira, para o 21o nao voltar calado. Mede o
 * FONTE sem os comentarios: o comentario de codigo pode te-los, o texto nao.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const PASTA = 'src/UI/Components/IdleConfig/';
const semComentarioJs = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const semComentarioHtml = t => t.replace(/<!--[\s\S]*?-->/g, '');
const TRAVESSAO = /[–—]/;

/** As linhas do fonte (sem comentario) que ainda levam travessao. */
function linhasComTravessao(arquivo) {
	const bruto = readFileSync(PASTA + arquivo, 'utf8');
	const limpo = arquivo.endsWith('.html') ? semComentarioHtml(bruto) : semComentarioJs(bruto);
	return limpo
		.split('\n')
		.filter(l => TRAVESSAO.test(l))
		.map(l => `${arquivo}: ${l.trim().slice(0, 120)}`);
}

describe('a Configuracao idle nao mostra travessao ao jogador', () => {
	for (const arquivo of ['IdleConfig.js', 'IdleConfig.html', 'secoesDaConfig.js', 'escolhaDePocao.js']) {
		it(`${arquivo}: nenhum texto com U+2013 ou U+2014`, () => {
			expect(linhasComTravessao(arquivo)).toEqual([]);
		});
	}

	it('CONTROLE: o filtro enxerga um travessao fora de comentario, e ignora o de dentro', () => {
		const js = "/* um — no bloco */\n// outro — na linha\nconst t = 'Parada — ali';";
		const linhas = semComentarioJs(js).split('\n').filter(l => TRAVESSAO.test(l));
		expect(linhas).toEqual(["const t = 'Parada — ali';"]);
		expect(semComentarioHtml('<!-- a — b --><p>c</p>')).toBe('<p>c</p>');
	});
});
