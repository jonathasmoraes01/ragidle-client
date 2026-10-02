import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * Auditoria pre-push B (29/09/2026): dois defeitos de tela achados pela sonda
 * do Mapa de Caca no cliente de verdade.
 */
describe('auditoria pre-push do Mapa de Caca', () => {
	it('o QuestWindow nativo (so texto) nao recebe toque', () => {
		const css = readFileSync('src/UI/Components/Quest/Quest/QuestWindow.css', 'utf-8');
		const host = css.slice(css.indexOf(':host'), css.indexOf('}', css.indexOf(':host')));
		expect(host).toContain('pointer-events: none');
	});

	it('o Mapa de Caca aberto na troca de mapa volta para a frente e pede o catalogo', () => {
		const js = readFileSync('src/UI/Components/HuntMap/HuntMap.js', 'utf-8');
		const ini = js.indexOf('HuntMap.onAppend = function onAppend()');
		const corpo = js.slice(ini, js.indexOf('\n};', ini));
		expect(corpo).toMatch(/if \(estaAberta\(\)\) \{\s*HuntMap\.focus\(\);\s*requestCatalog\(\);/);
	});
});
