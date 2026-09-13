/**
 * O minimapa escondido nao desenha, e as coordenadas so vao ao DOM quando
 * mudam (13/09/2026, auditoria do iPhone). Ver
 * `src/UI/Components/MiniMap/minimapaNoQuadro.js`.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
	MINIMAPA_ESCONDIDO_EM_PE,
	escreverSeMudou,
	minimapaVisivel
} from 'UI/Components/MiniMap/minimapaNoQuadro.js';
import { MARCA_VERTICAL } from 'UI/hudVertical.js';

afterEach(() => {
	document.documentElement.classList.remove(MARCA_VERTICAL);
});

describe('minimapaVisivel', () => {
	it('no celular em pe o MiniMapV2 esta escondido', () => {
		document.documentElement.classList.add(MARCA_VERTICAL);
		expect(minimapaVisivel(document, MINIMAPA_ESCONDIDO_EM_PE)).toBe(false);
	});

	it('fora do celular em pe ele desenha', () => {
		expect(minimapaVisivel(document, MINIMAPA_ESCONDIDO_EM_PE)).toBe(true);
	});

	it('o V1 nunca e pulado: a regra do CSS so esconde o V2', () => {
		document.documentElement.classList.add(MARCA_VERTICAL);
		expect(minimapaVisivel(document, 'MiniMap')).toBe(true);
	});

	it('o nome que a regra esconde e o id do CSS (#MiniMapV2)', () => {
		expect(MINIMAPA_ESCONDIDO_EM_PE).toBe('MiniMapV2');
	});
});

describe('escreverSeMudou', () => {
	it('grava quando o valor muda, e so entao gera mutacao', async () => {
		const el = document.createElement('span');
		el.textContent = '150';
		const mutacoes = [];
		const obs = new MutationObserver(lista => mutacoes.push(...lista));
		obs.observe(el, { childList: true, characterData: true, subtree: true });

		expect(escreverSeMudou(el, 150)).toBe(false);
		await Promise.resolve();
		expect(mutacoes.length).toBe(0);

		expect(escreverSeMudou(el, 151)).toBe(true);
		await Promise.resolve();
		expect(el.textContent).toBe('151');
		expect(mutacoes.length).toBeGreaterThan(0);
		obs.disconnect();
	});

	it('elemento ausente nao lanca', () => {
		expect(escreverSeMudou(null, 3)).toBe(false);
	});
});
