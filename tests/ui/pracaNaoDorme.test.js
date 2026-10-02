/**
 * PRACA NUNCA DORME (30/09/2026, ordem do dono): o servidor recusa o "Dormir"
 * dentro de qualquer praca com o codigo `praca`, e o cliente tem o texto dele
 * (sem ele cairia no generico "Nao foi possivel iniciar o sono agora").
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const JS = readFileSync('src/Engine/MapEngine.js', 'utf8');
const bloco = JS.slice(JS.indexOf('const TEXTO_DA_RECUSA_DE_SONO = {'), JS.indexOf('};', JS.indexOf('const TEXTO_DA_RECUSA_DE_SONO = {')));

describe('a recusa "praca" do Dormir', () => {
	it('tem texto proprio, que diz por que e para onde ir', () => {
		const linha = bloco.split('\n').find(l => /^\s*praca:/.test(l)) ?? '';
		expect(linha).toContain('Nas Praças não dá para dormir');
		expect(linha).toContain('Durma num mapa de caça');
		expect(/[–—]/.test(linha)).toBe(false);
	});
});
