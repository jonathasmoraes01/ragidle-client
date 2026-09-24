/**
 * O ATRASO ANTES DE ENTRAR NA ECONOMIA DE ENERGIA (23/09/2026, ordem do dono:
 * "Aumente esse tempo para 14 segundos"; era 3 s desde D-1394).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('o atraso da economia de energia', () => {
	it('a aba escondida espera 14 s antes de pedir a economia', () => {
		const js = readFileSync(join(__dirname, '..', '..', 'src', 'Engine', 'MapEngine.js'), 'utf8');
		expect(js).toMatch(/const MS_DE_ATRASO_ANTES_DE_ENTRAR_NA_ECONOMIA = 14000;/);
		expect(js).toMatch(/setTimeout\([\s\S]{0,900}\}, MS_DE_ATRASO_ANTES_DE_ENTRAR_NA_ECONOMIA\)/);
	});
});
