import { describe, expect, it } from 'vitest';
import { linhaDaMissaoNoRequisito } from '../../src/UI/Components/IdleSkills/requisitoDeMissao.js';

/*
 * A missao aparece nos pre-requisitos (10/09/2026) — pedido do dono com o print
 * da Luz Divina, que dizia "Sem pre-requisito" sendo habilidade de missao.
 */
describe('a missao que ensina a habilidade nos pre-requisitos', () => {
	const LUZ = { deQuest: true, missaoQueEnsina: { id: 'habilidade-luz-sagrada', titulo: 'Luz Sagrada', tipo: 'skill' } };

	it('a habilidade de missao ainda nao aprendida mostra a missao, PENDENTE', () => {
		expect(linhaDaMissaoNoRequisito(LUZ, 0)).toEqual({ ok: false, texto: 'Concluir a missão "Luz Sagrada"' });
	});

	it('aprendida, a linha fica CUMPRIDA — o jogo so ensina pela missao', () => {
		expect(linhaDaMissaoNoRequisito(LUZ, 1)).toEqual({ ok: true, texto: 'Concluir a missão "Luz Sagrada"' });
	});

	it('habilidade comum nao ganha linha de missao', () => {
		expect(linhaDaMissaoNoRequisito({ deQuest: false, missaoQueEnsina: null }, 0)).toBeNull();
	});

	it('a de quest dada de graca, sem missao ligada (Primeiros Socorros), tambem nao', () => {
		expect(linhaDaMissaoNoRequisito({ deQuest: true, missaoQueEnsina: null }, 1)).toBeNull();
		expect(linhaDaMissaoNoRequisito({ deQuest: true }, 0)).toBeNull();
	});
});
