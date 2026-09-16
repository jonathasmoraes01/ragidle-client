/**
 * O CIRCULO DE CONJURACAO com a area do nosso servidor (13/09/2026, relato do
 * dono: *"o circulo esta mostrando so o tamanho da skill nv1"*).
 *
 * Os casos exercitam o arquivo PUBLICADO DE VERDADE
 * (`public/ragidle/areas-de-skill.json`, gerado no repositorio do jogo por
 * `scripts/publicar-areas-de-skill.ts`) e nao um fixture, pelo motivo de
 * `fichasDeItem.test.js`: a falha provavel e a publicacao, e um fixture proprio
 * esconderia exatamente essa. As recusas do formato usam objetos montados aqui,
 * porque o arquivo bom nunca as exercita.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { absorverAreasDeSkill, diametroDoCirculo } from '../../src/DB/Skills/areasDeSkill.js';

/* `import.meta.url` aqui e uma URL http (o vitest roda sobre o vite): o caminho
   sai do cwd, que e a raiz do projeto. */
const CAMINHO = join(process.cwd(), 'public', 'ragidle', 'areas-de-skill.json');

// Os ids do fio por extenso (`skill_db.yml`).
const MG_THUNDERSTORM = 21;
const WZ_METEOR = 83;
const WZ_STORMGUST = 89;
const HT_LANDMINE = 116;

let publicado;

beforeAll(() => {
	publicado = JSON.parse(readFileSync(CAMINHO, 'utf8'));
});

describe('o arquivo publicado', () => {
	beforeAll(() => {
		absorverAreasDeSkill(publicado);
	});

	it('esta na versao que este modulo le, e nao esta vazio', () => {
		expect(publicado.v).toBe(1);
		expect(Object.keys(publicado.aneis).length).toBeGreaterThan(5);
	});

	it('a Chuva de Meteoros e 13, e nao a 7 da tabela do servidor oficial', () => {
		expect(diametroDoCirculo(WZ_METEOR, 1)).toBe(13);
		expect(diametroDoCirculo(WZ_METEOR, 10)).toBe(13);
	});

	it('o nivel escolhe a linha; sem nivel, o nivel 1; acima do publicado, o ultimo', () => {
		expect(diametroDoCirculo(WZ_STORMGUST, 10)).toBe(publicado.aneis[String(WZ_STORMGUST)][9]);
		expect(diametroDoCirculo(MG_THUNDERSTORM)).toBe(publicado.aneis[String(MG_THUNDERSTORM)][0]);
		const ultimo = publicado.aneis[String(WZ_STORMGUST)].length;
		expect(diametroDoCirculo(WZ_STORMGUST, 99)).toBe(publicado.aneis[String(WZ_STORMGUST)][ultimo - 1]);
	});

	it('armadilha e skill fora da tabela devolvem null - o MagicTarget cai na CastSize', () => {
		expect(diametroDoCirculo(HT_LANDMINE, 1)).toBeNull();
		expect(diametroDoCirculo(999999, 1)).toBeNull();
	});
});

describe('as recusas do formato', () => {
	it('versao desconhecida e recusada alto', () => {
		expect(() => absorverAreasDeSkill({ v: 2, aneis: {} })).toThrow(/versao 2/);
	});

	it('a linha com diametro par ou zero fica de fora, e as boas entram', () => {
		const entraram = absorverAreasDeSkill({ v: 1, aneis: { 1: [3, 5], 2: [4], 3: [0], 4: [] } });
		expect(entraram).toBe(1);
		expect(diametroDoCirculo(1, 2)).toBe(5);
		expect(diametroDoCirculo(2, 1)).toBeNull();
		expect(diametroDoCirculo(3, 1)).toBeNull();
	});
});
