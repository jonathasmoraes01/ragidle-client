/**
 * O VIP E AS FLECHAS INFINITAS NA BARRA DE STATUS (28/09/2026): as entradas
 * dos icones 1902 e 1903 existem, com relogio, e a arte e carregada por URL.
 * Os numeros sao os do servidor (`servidor/mapa/icone-dos-passes.ts`).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import StatusInfo, { EFST_DAS_FLECHAS_INFINITAS, EFST_DO_VIP } from 'DB/Status/StatusInfo.js';

describe('os icones dos passes da conta', () => {
	it('o VIP e o 1902, com relogio, titulo e arte publicada pelo jogo', () => {
		expect(EFST_DO_VIP).toBe(1902);
		const e = StatusInfo[EFST_DO_VIP];
		expect(e.haveTimeLimit).toBe(1);
		expect(e.descript[0][0]).toBe('VIP');
		expect(() => readFileSync(`public${e.icon}`)).not.toThrow();
	});

	it('as Flechas Infinitas sao o 1903, com relogio, titulo e arte publicada pelo jogo', () => {
		expect(EFST_DAS_FLECHAS_INFINITAS).toBe(1903);
		const e = StatusInfo[EFST_DAS_FLECHAS_INFINITAS];
		expect(e.haveTimeLimit).toBe(1);
		expect(e.descript[0][0]).toBe('Flechas Infinitas');
		expect(() => readFileSync(`public${e.icon}`)).not.toThrow();
	});
});
