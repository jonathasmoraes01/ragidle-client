import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const mapEngine = fs.readFileSync('src/Engine/MapEngine.js', 'utf8');
const skillEngine = fs.readFileSync('src/Engine/MapEngine/Skill.js', 'utf8');

describe('barra de atalhos nativa como unica hotbar', () => {
	it('continua preparando e anexando a ShortCut original', () => {
		expect(mapEngine).toContain('ShortCut.prepare();');
		expect(mapEngine).toContain('ShortCut.append();');
	});

	it('nao registra nem alimenta a antiga DockIdle', () => {
		expect(mapEngine).not.toMatch(/import DockIdle|DockIdle\.(prepare|append)\(\)/);
		expect(skillEngine).not.toMatch(/import DockIdle|DockIdle\.onSkillDelay/);
	});
});
