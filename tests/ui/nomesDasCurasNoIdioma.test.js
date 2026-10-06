/**
 * OS NOMES DAS CURAS NA NOTA DA ABA ATAQUE, no idioma do jogador (05/10/2026).
 * Em ingles a nota saia "Primeiros Socorros e Curar are support skills": o
 * composto nao casava no catalogo. Cada nome traduzido sozinho, a conjuncao
 * no idioma.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { nomesDasCurasNoIdioma } from 'UI/Components/IdleConfig/curaComoAtaque.js';

const CATALOGO = { 'Primeiros Socorros': 'First Aid', Curar: 'Heal' };
const traduzir = t => CATALOGO[t] ?? t;
const curas = [{ nome: 'Primeiros Socorros', skillId: 142 }, { nome: 'Curar', skillId: 28 }];

describe('os nomes das curas na nota da aba Ataque', () => {
	it('em ingles: cada nome traduzido e "and"', () => {
		expect(nomesDasCurasNoIdioma(curas, traduzir, true)).toBe('First Aid and Heal');
	});
	it('em portugues: os nomes como vieram e "e"', () => {
		expect(nomesDasCurasNoIdioma(curas, t => t, false)).toBe('Primeiros Socorros e Curar');
	});
	it('uma cura so: sem conjuncao; sem nome, o id', () => {
		expect(nomesDasCurasNoIdioma([{ nome: 'Curar' }], traduzir, true)).toBe('Heal');
		expect(nomesDasCurasNoIdioma([{ skillId: 28 }], traduzir, true)).toBe('28');
		expect(nomesDasCurasNoIdioma(null, traduzir, true)).toBe('');
	});
	it('a nota usa a funcao (e nao junta os nomes crus de novo)', () => {
		const aqui = dirname(fileURLToPath(import.meta.url));
		const fonte = readFileSync(join(aqui, '..', '..', 'src', 'UI', 'Components', 'IdleConfig', 'IdleConfig.js'), 'utf8');
		expect(fonte).toContain('nomesDasCurasNoIdioma(ctx.skillsDeCura, traduzir, traducaoLigada())');
		expect(fonte).not.toContain(".map(c => escapeHtml(c.nome || c.skillId)).join(' e ')");
	});
});
