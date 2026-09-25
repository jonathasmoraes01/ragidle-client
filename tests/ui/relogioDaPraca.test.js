/**
 * O CRONOMETRO DA PRACA DE ZENY (25/09/2026): a entrada do icone de estado
 * 1900 existe, com relogio, e a arte e carregada por URL (e nao do GRF).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import StatusInfo, { EFST_DO_RELOGIO_DA_PRACA } from 'DB/Status/StatusInfo.js';

const ICONES = readFileSync('src/UI/Components/StatusIcons/StatusIcons.js', 'utf8');

describe('o cronometro da Praca de Zeny', () => {
	it('o icone 1900 tem relogio, titulo e arte publicada pelo jogo', () => {
		expect(EFST_DO_RELOGIO_DA_PRACA).toBe(1900);
		const e = StatusInfo[EFST_DO_RELOGIO_DA_PRACA];
		expect(e.haveTimeLimit).toBe(1);
		expect(e.descript[0][0]).toBe('Praça de Zeny');
		expect(e.icon.startsWith('/')).toBe(true);
		// A arte existe no que o jogo publica.
		expect(() => readFileSync(`public${e.icon}`)).not.toThrow();
	});

	it('a arte com "/" vem por URL, e a do GRF continua pelo GRF', () => {
		expect(ICONES).toContain('if (iconeDePublicacao(iconName)) {');
		expect(ICONES).toContain("return typeof nome === 'string' && nome.startsWith('/');");
		expect(ICONES).toContain('`data/texture/effect/${iconName}`');
	});
});
