/**
 * O api.html NAO TEM SCRIPT EMBUTIDO (28/09/2026, D-1648 do servidor).
 *
 * A CSP do jogo (`vercel.json`) esta em modo relatorio e vai passar a
 * BLOQUEAR. Com `script-src 'self'`, todo `<script>` sem `src` e barrado - e o
 * jogo abriria com tela preta. Os quatro blocos que moravam no api.html viraram
 * arquivos gerados pelo build; este portao reprova se um voltar.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const BUILDER = readFileSync('applications/tools/builder-web.mjs', 'utf8');
const API_HTML = BUILDER.slice(BUILDER.indexOf('function createApiHTML('), BUILDER.indexOf("'/api.html', apiHtml"));
const tagsDeScript = (texto) => [...texto.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]);

describe('o api.html gerado', () => {
	it('CONTROLE: o recorte achou o template e ha scripts nele', () => {
		expect(API_HTML.length).toBeGreaterThan(1000);
		expect(tagsDeScript(API_HTML).length).toBeGreaterThan(2);
	});

	it('todo <script> da pagina tem src - inclusive a guarda e o Pixel, que entram por constante', () => {
		const guarda = /const GUARDA_DA_ENTRADA = `([^`]*)`/.exec(BUILDER)?.[1] ?? '';
		const pixel = /const META_PIXEL = `([^`]*)`/.exec(BUILDER)?.[1] ?? '';
		for (const tag of [...tagsDeScript(API_HTML), ...tagsDeScript(guarda), ...tagsDeScript(pixel)]) {
			expect(tag, 'script embutido no api.html: a CSP em bloqueio o barraria').toMatch(/\bsrc=/);
		}
		expect(tagsDeScript(guarda)).toHaveLength(1);
		expect(tagsDeScript(pixel)).toHaveLength(1);
	});

	it('o build escreve os tres arquivos que a pagina carrega', () => {
		for (const arquivo of ['guarda-da-entrada.js', 'meta-pixel.js', 'carregar-jogo.js']) {
			expect(BUILDER).toContain(`'/${arquivo}'`);
		}
	});

	it('a CSP manda os relatorios para o coletor do servidor', () => {
		const vercel = readFileSync('applications/deploy/vercel.json', 'utf8');
		expect(vercel).toContain('report-uri https://api.roclassicidle.com.br/analytics/csp');
	});
});
