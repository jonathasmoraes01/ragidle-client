/**
 * O MODO CLASSICO NO CLIENTE (24/09/2026, ordem do dono): a interface do idle
 * sai da tela e fica so o ataque original do roBrowser.
 *
 * O caminho do ataque original NAO foi tocado: clicar num mob manda o
 * `CZ_REQUEST_ACT` com `action = 7` (EntityControl.onFocus). O que este teste
 * cobra e a chave e os pontos onde ela corta: a chave falha para LIGADO, e cada
 * componente do idle consulta a MESMA funcao em vez de um criterio proprio.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { modoClassicoLigado } from '../../src/UI/modoClassico.js';

const raiz = join(__dirname, '..', '..');
const ler = (p) => readFileSync(join(raiz, p), 'utf8');

afterEach(() => {
	delete globalThis.window.ROConfig;
});

describe('modo classico: a chave', () => {
	it('sem ROConfig vale LIGADO (o estado de producao)', () => {
		delete globalThis.window.ROConfig;
		expect(modoClassicoLigado()).toBe(true);
	});
	it('so `modoClassico: false` desliga', () => {
		globalThis.window.ROConfig = { modoClassico: false };
		expect(modoClassicoLigado()).toBe(false);
		globalThis.window.ROConfig = { modoClassico: true };
		expect(modoClassicoLigado()).toBe(true);
		globalThis.window.ROConfig = {};
		expect(modoClassicoLigado()).toBe(true);
	});
	it('o Config.js de producao nasce com o modo classico ligado', () => {
		expect(ler('applications/pwa/Config.js')).toMatch(/\bmodoClassico:\s*true,/);
	});
});

describe('modo classico: os cortes consultam a MESMA chave', () => {
	it('o botao "Ataque auto" nao entra na tela', () => {
		expect(ler('src/Engine/MapEngine.js')).toContain('if (!modoClassicoLigado()) CombatCornerIdle.append();');
	});
	it('a aba escondida nao pede a economia de energia', () => {
		const fonte = ler('src/Engine/MapEngine.js');
		const i = fonte.indexOf('function onVisibilidadeMudouParaEconomia() {');
		expect(i).toBeGreaterThan(-1);
		expect(fonte.slice(i, i + 400)).toContain('if (modoClassicoLigado()) return;');
	});
	it('o menu esconde a configuracao idle e o Hunt Analyzer', () => {
		const fonte = ler('src/UI/Components/TopMenuIdle/TopMenuIdle.js');
		expect(fonte).toContain('.tm-item[data-action="config"]');
		expect(fonte).toContain('.tm-item[data-action="analyzer"]');
	});
	it('o Dormir, a rotacao, a opcao de economia e o tutorial consultam a chave', () => {
		expect(ler('src/UI/Components/HuntAnalyzer/HuntAnalyzer.js')).toContain("esconderNoModoClassico(root, ['.ha-dormir'");
		expect(ler('src/UI/Components/IdleSkills/IdleSkills.js')).toContain('const rotacaoHtml = modoClassicoLigado()');
		expect(ler('src/UI/Components/GraphicsOption/GraphicsOption.js')).toContain('if (modoClassicoLigado()) {');
		expect(ler('src/UI/Components/TutorialIdle/TutorialIdle.js').match(/if \(modoClassicoLigado\(\)\) return;/g)?.length).toBe(2);
	});
	it('o ataque original do roBrowser segue intacto: clique no mob manda a acao 7', () => {
		expect(ler('src/Controls/EntityControl.js')).toMatch(/pkt\.action\s*=\s*7/);
	});
});
