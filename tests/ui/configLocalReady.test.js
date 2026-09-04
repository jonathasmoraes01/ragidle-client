import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');

describe('Carregamento da configuração local', () => {
	it('aguarda Config.local.js antes de iniciar o PWA', () => {
		const pwa = read('applications/pwa/index.html');

		expect(pwa).toContain('window.ROConfigLocalReady = new Promise');
		expect(pwa).toContain('script.onload = resolve');
		expect(pwa).toContain('await window.ROConfigLocalReady');
	});

	it('aguarda Config.local.js nos dois HTMLs gerados pelo builder', () => {
		const builder = read('applications/tools/builder-web.mjs');

		expect(builder.match(/window\.ROConfigLocalReady = new Promise/g)).toHaveLength(2);
		expect(builder.match(/await window\.ROConfigLocalReady/g)).toHaveLength(2);
	});
});
