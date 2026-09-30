/**
 * O RETRATO DE CLASSE DE QUEM ESTA MONTADO (29/09/2026).
 *
 * Montado no Peco, o Cavaleiro vira o job 13 e o cliente oficial nao tem
 * retrato para ele: a HUD pedia `/ragidle/classes/13.png` e levava 404. Estes
 * casos cobram que o montado cai no retrato da classe base, que a classe
 * desmontada nao muda, e (o controle) que TODO retrato que o caminho pede para
 * uma classe jogavel existe em `public/`.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import JobId from '../../src/DB/Jobs/JobConst.js';
import { caminhoDoRetrato, jobDoRetrato } from '../../src/UI/retratoDeClasse.js';

describe('retrato de classe de quem esta montado', () => {
	it('o Cavaleiro e o Templario montados usam o retrato da classe base', () => {
		expect(jobDoRetrato(JobId.KNIGHT2)).toBe(JobId.KNIGHT);
		expect(jobDoRetrato(JobId.CRUSADER2)).toBe(JobId.CRUSADER);
		expect(jobDoRetrato(JobId.KNIGHT2_H)).toBe(JobId.KNIGHT_H);
		expect(jobDoRetrato(JobId.CRUSADER2_B)).toBe(JobId.CRUSADER_B);
		expect(caminhoDoRetrato(13)).toBe('/ragidle/classes/7.png');
	});

	it('classe desmontada nao muda, e id desconhecido passa como veio', () => {
		expect(jobDoRetrato(JobId.KNIGHT)).toBe(JobId.KNIGHT);
		expect(jobDoRetrato(JobId.NOVICE)).toBe(JobId.NOVICE);
		expect(jobDoRetrato(99999)).toBe(99999);
		expect(caminhoDoRetrato(4008)).toBe('/ragidle/classes/4008.png');
	});

	it('todo retrato pedido para o 1o e 2o grau, montado ou nao, existe em public/', () => {
		const ids = [
			JobId.NOVICE,
			JobId.SWORDMAN, JobId.MAGICIAN, JobId.ARCHER, JobId.ACOLYTE, JobId.MERCHANT, JobId.THIEF,
			JobId.KNIGHT, JobId.PRIEST, JobId.WIZARD, JobId.BLACKSMITH, JobId.HUNTER, JobId.ASSASSIN,
			JobId.CRUSADER, JobId.MONK, JobId.SAGE, JobId.ROGUE, JobId.ALCHEMIST, JobId.BARD, JobId.DANCER,
			JobId.KNIGHT2, JobId.CRUSADER2,
		];
		const faltando = ids.filter(
			(id) => !existsSync(resolve(__dirname, '../../public', '.' + caminhoDoRetrato(id))),
		);
		expect(faltando).toEqual([]);
	});
});
