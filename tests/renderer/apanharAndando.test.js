/**
 * QUEM APANHA ANDANDO NAO PERDE A ROTA NA TELA (24/09/2026, passo 13 da
 * auditoria do cerco - achado J6 do Jhow, sem o interruptor do modo classico).
 *
 * O golpe recebido (HURT) saia de WALK e apagava a rota; o `resumeWalk` exige
 * `walk.index < walk.total` (os dois ja zerados) e a entidade parava na tela
 * enquanto o servidor seguia andando.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { apanharInterrompeACaminhada } from '../../src/Engine/MapEngine/apanharAndando.js';

const raiz = join(__dirname, '..', '..');
const ler = (p) => readFileSync(join(raiz, p), 'utf8');

describe('J6: apanhar andando nao apaga a rota', () => {
	const ACTION = { WALK: 1, IDLE: 0 };
	it('andando com rota viva, o golpe NAO toca o HURT', () => {
		expect(apanharInterrompeACaminhada({ ACTION, action: ACTION.WALK, walk: { index: 2, total: 8 } })).toBe(false);
	});
	it('CONTROLE: parado, no fim da rota, ou fora de WALK com resto de rota, encolhe como sempre', () => {
		expect(apanharInterrompeACaminhada({ ACTION, action: ACTION.IDLE, walk: { index: 0, total: 0 } })).toBe(true);
		expect(apanharInterrompeACaminhada({ ACTION, action: ACTION.WALK, walk: { index: 8, total: 8 } })).toBe(true);
		expect(apanharInterrompeACaminhada({ ACTION, action: ACTION.IDLE, walk: { index: 2, total: 8 } })).toBe(true);
		expect(apanharInterrompeACaminhada({ ACTION, action: ACTION.WALK })).toBe(true);
		expect(apanharInterrompeACaminhada(null)).toBe(true);
	});
	it('o golpe recebido consulta a decisao antes do HURT', () => {
		const fonte = ler('src/Engine/MapEngine/Entity.js');
		expect(fonte).toMatch(
			/dstEntity\.action !== dstEntity\.ACTION\.DIE && apanharInterrompeACaminhada\(dstEntity\)\) \{\s*dstEntity\.setAction\(\{\s*action: dstEntity\.ACTION\.HURT/
		);
	});
});
