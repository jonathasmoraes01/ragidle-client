/**
 * A HABILIDADE NO IDIOMA (D-1929): a caixa de descricao chega como lista de
 * linhas e e traduzida INTEIRA (o catalogo tem a caixa juntada por `\n`),
 * antes de a janela parti-la; a leitura entende os rotulos ingleses.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { absorverCatalogo, desligarTraducao } from 'Core/Traducao.js';
import { habilidadesNoIdioma } from 'UI/Components/IdleSkills/habilidadesNoIdioma.js';
import buildResumo from 'UI/Components/IdleSkills/resumoDaDescricao.js';

const CAIXA_PT = ['Golpe Fulminante', 'Nível máximo: 10', 'Descrição:', 'Golpeia o alvo com força.', '[Nv 1]: Dano 130%', '[Nv 2]: Dano 160%'];
const CAIXA_EN = ['Bash', 'Max. Lv: 10', 'Description:', 'Strikes the target with force.', '[Lv 1]: 130% damage', '[Lv 2]: 160% damage'];

afterEach(() => desligarTraducao());

describe('habilidadesNoIdioma', () => {
	it('em portugues (sem catalogo) nada muda', () => {
		const skills = [{ nome: 'Golpe Fulminante', descricao: [...CAIXA_PT] }];
		habilidadesNoIdioma(skills);
		expect(skills[0]).toEqual({ nome: 'Golpe Fulminante', descricao: CAIXA_PT });
	});

	it('em ingles, a caixa inteira e trocada e volta a ser lista; o nome tambem', () => {
		absorverCatalogo({
			v: 1,
			exatos: { 'Golpe Fulminante': 'Bash', [CAIXA_PT.join(' ')]: CAIXA_EN.join('\n') },
			modelos: []
		});
		const skills = [{ nome: 'Golpe Fulminante', descricao: [...CAIXA_PT] }];
		habilidadesNoIdioma(skills);
		expect(skills[0].nome).toBe('Bash');
		expect(skills[0].descricao).toEqual(CAIXA_EN);
	});

	it('caixa sem traducao fica como veio (nada de meia caixa)', () => {
		absorverCatalogo({ v: 1, exatos: {}, modelos: [] });
		const skills = [{ nome: 'X', descricao: [...CAIXA_PT] }];
		habilidadesNoIdioma(skills);
		expect(skills[0].descricao).toEqual(CAIXA_PT);
	});
});

describe('a leitura da caixa inglesa', () => {
	it('o resumo acha o "Description:" e para no "[Lv N]"', () => {
		expect(buildResumo({ descricao: CAIXA_EN })).toBe('Strikes the target with force.');
		expect(buildResumo({ descricao: CAIXA_PT })).toBe('Golpeia o alvo com força.');
	});
});
