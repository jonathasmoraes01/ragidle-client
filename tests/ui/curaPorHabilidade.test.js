/**
 * A janela de configuracao idle tem UM interruptor e UM alvo POR habilidade de
 * cura (08/09/2026 — ordem do dono: "nao quero mais utilizar a skill primeiros
 * socorros, mas quero que a skill de curar funcione perfeitamente"). O seletor
 * unico da manha (`cura.skillId`) saiu. Le o fonte, como os vizinhos desta
 * pasta: o componente depende do DOM do roBrowser e nao importa em Node.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const AQUI = dirname(fileURLToPath(import.meta.url));
const JS = readFileSync(join(AQUI, '..', '..', 'src', 'UI', 'Components', 'IdleConfig', 'IdleConfig.js'), 'utf8');
const RENDER = JS.slice(JS.indexOf('function renderCura()'), JS.indexOf('function bindSuporteExtra('));

describe('a cura e configurada por habilidade', () => {
	it('cada cura aprendida tem o proprio interruptor, marcado com a habilidade', () => {
		expect(RENDER).toContain('data-action="cura-toggle" data-skill="${escapeHtml(c.skillId)}"');
		expect(RENDER).toContain('curaLigadaPara(cura, c.skillId)');
	});

	it('o alvo ("Quem curar") e por habilidade, no caminho que o setter generico grava', () => {
		expect(RENDER).toContain('segmentadoDeAlvo(`cura.habilidades.${c.skillId}.alvo`');
	});

	it('o limiar e UM so, porque o motor tem um portao de HP unico', () => {
		expect(RENDER.match(/data-range=\"cura\.curarAbaixoDe\"/g)).toHaveLength(1);
	});

	it('o seletor unico da manha saiu', () => {
		expect(RENDER).not.toContain('cura.skillId');
		expect(JS).not.toContain('seletorDeCura');
	});

	it('garantirCura cria a entrada de cada cura (setPath nao cria objeto no caminho) e apaga o skillId antigo', () => {
		const g = JS.slice(JS.indexOf('function garantirCura(cfg, ctx)'), JS.indexOf('IdleConfig.init = function init()'));
		expect(g).toContain('cfg.cura.habilidades[c.skillId] = { ligada: cfg.cura.ligada !== false, alvo: cfg.cura.alvo || ');
		expect(g).toContain('delete cfg.cura.skillId');
	});

	it('o handler e por interruptor (querySelectorAll) e mantem o geral coerente com as individuais', () => {
		expect(JS).toContain("pane.querySelectorAll('[data-action=" + '"cura-toggle"' + "]').forEach(curaToggle =>");
		expect(JS).toContain('ligada: Object.values(habilidades).some(h => h.ligada !== false)');
	});
});
