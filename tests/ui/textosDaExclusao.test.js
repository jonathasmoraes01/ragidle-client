import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { absorverCatalogo, desligarTraducao, traduzir } from '../../src/Core/Traducao.js';
import { TEXTOS_DA_EXCLUSAO, textoDoContador } from '../../src/UI/Components/CharSelect/textosDaExclusao.js';

/*
 * A EXCLUSAO DE PERSONAGEM (D-1945, 03/10/2026): os textos em portugues e o
 * ingles que o CATALOGO PUBLICADO da a cada um — o arquivo de verdade, e nao
 * um catalogo de teste: frase nova sem traducao ficaria em portugues na tela
 * em ingles, e e isto que pega.
 */
afterEach(() => desligarTraducao());

describe('o contador da exclusao', () => {
	it('e "Exclusão em HH:MM:SS", e o prazo vencido (negativo) mostra 00:00:00', () => {
		expect(textoDoContador(86_400 - 2)).toBe('Exclusão em 23:59:58');
		expect(textoDoContador(61)).toBe('Exclusão em 00:01:01');
		expect(textoDoContador(-5)).toBe('Exclusão em 00:00:00');
	});
});

describe('os textos da exclusao no catalogo publicado', () => {
	const catalogo = JSON.parse(readFileSync(join(process.cwd(), 'public/ragidle/i18n/en/catalogo.json'), 'utf8'));

	it('toda frase tem ingles, e o contador com numeros tambem', () => {
		absorverCatalogo(catalogo);
		for (const [chave, pt] of Object.entries(TEXTOS_DA_EXCLUSAO)) {
			if (chave === 'contador') continue;
			const en = traduzir(pt);
			expect(en, `sem ingles: ${chave}`).not.toBe(pt);
		}
		expect(traduzir(textoDoContador(86_398))).toBe('Deletion in 23:59:58');
		expect(traduzir(TEXTOS_DA_EXCLUSAO.cedo)).toBe(
			'The 24 hours have not passed yet: wait for the countdown to reach zero to confirm the deletion.'
		);
	});
});
