/**
 * A VERSAO PUBLICADA SEM SERVICE WORKER (28/09/2026, D-1646 do servidor).
 *
 * O navegador sem service worker nunca recebia o aviso de versao nova da
 * casca, e ficava na versao velha ate alguem recarregar. O build passa a
 * publicar `versao-do-cliente.json`, e o jogo compara o carimbo com o dele.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const { versaoPublicadaMaisNova, ARQUIVO_DA_VERSAO_PUBLICADA } = await import('UI/atualizacaoAutomatica.js');

const MINHA = '2.0.0-20260928150000';

describe('a comparacao, pura', () => {
	it('a publicada mais nova volta, para entrar na contagem', () => {
		expect(versaoPublicadaMaisNova({ versao: '2.0.0-20260928160000', login: 2609281600 }, MINHA)).toBe('2.0.0-20260928160000');
	});

	it('a mesma versao, ou uma mais velha (o rollback), nao recarrega', () => {
		expect(versaoPublicadaMaisNova({ versao: MINHA }, MINHA)).toBeNull();
		expect(versaoPublicadaMaisNova({ versao: '2.0.0-20260927100000' }, MINHA)).toBeNull();
	});

	it('sem build (o dev) ou com arquivo torto, nada', () => {
		expect(versaoPublicadaMaisNova({ versao: '2.0.0-20260928160000' }, '')).toBeNull();
		expect(versaoPublicadaMaisNova(null, MINHA)).toBeNull();
		expect(versaoPublicadaMaisNova({ login: 2609281600 }, MINHA)).toBeNull();
	});
});

describe('o que o build publica e onde o jogo le', () => {
	const BUILDER = readFileSync('applications/tools/builder-web.mjs', 'utf8');
	const VERCEL = JSON.parse(readFileSync('applications/deploy/vercel.json', 'utf8'));

	it('o build escreve o arquivo com a versao e o numero do login', () => {
		// Desde 29/09/2026 (D-1822 do servidor) quem escreve e `versaoPublicada.mjs`,
		// chamado no passo que compila o Online.js - ver versaoPublicadaSoComOJogo.test.js.
		const PUBLICADOR = readFileSync('applications/tools/versaoPublicada.mjs', 'utf8');
		expect(PUBLICADOR).toContain("export const ARQUIVO_DA_VERSAO = 'versao-do-cliente.json';");
		expect(PUBLICADOR).toMatch(/const conteudo = \{ versao: versaoDoBuild, login \};/);
		expect(BUILDER).toContain('escreverVersaoPublicada(outDir, versaoDoBuild);');
		expect(ARQUIVO_DA_VERSAO_PUBLICADA).toBe('/versao-do-cliente.json');
	});

	it('a Vercel o serve sem cache - senao o servidor e o jogo leriam a versao velha', () => {
		const semCache = VERCEL.routes.find(r => r.headers && r.headers['Cache-Control'] === 'no-cache' && r.src.includes('versao-do-cliente'));
		expect(semCache).toBeDefined();
		expect(new RegExp(semCache.src).test('/versao-do-cliente.json')).toBe(true);
	});
});
