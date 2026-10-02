/**
 * O RELATO DE ERRO LEVA A VERSAO DO BUILD (28/09/2026).
 *
 * `versaoDoBuild()` lia uma `<meta name="ragidle-versao">` que nenhum build
 * gera, e todo relato chegava sem versao. Desde e1f6f983 ela devolve a
 * `VERSAO_DO_BUILD` de D-1635 (`Core/versaoDoCliente.js`) — a mesma do login e
 * do `versao-do-cliente.json`. Este teste mede o COMPORTAMENTO: com a versao do
 * build mockada, o relato devolve exatamente ela; sem build, `undefined`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
	vi.resetModules();
	vi.doUnmock('Core/versaoDoCliente.js');
});

describe('versaoDoBuild do relato de erro', () => {
	it('devolve a VERSAO_DO_BUILD do build', async () => {
		vi.doMock('Core/versaoDoCliente.js', () => ({ VERSAO_DO_BUILD: '1.2.3-20260928153000' }));
		const { versaoDoBuild } = await import('UI/relatoDeErro.js');
		expect(versaoDoBuild()).toBe('1.2.3-20260928153000');
	});

	it('sem build (o dev e o vitest), `undefined`, e nao uma string vazia', async () => {
		vi.doMock('Core/versaoDoCliente.js', () => ({ VERSAO_DO_BUILD: '' }));
		const { versaoDoBuild } = await import('UI/relatoDeErro.js');
		expect(versaoDoBuild()).toBeUndefined();
	});

	it('nao le mais a <meta> que nenhum build gera', async () => {
		const { readFileSync } = await import('node:fs');
		const { join } = await import('node:path');
		const js = readFileSync(join(process.cwd(), 'src', 'UI', 'relatoDeErro.js'), 'utf8');
		expect(js).not.toMatch(/querySelector\([^)]*ragidle-versao/);
		expect(js).toContain("import { VERSAO_DO_BUILD } from 'Core/versaoDoCliente.js';");
	});
});
