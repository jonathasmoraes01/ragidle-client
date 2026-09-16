/**
 * O CAMPO DO SABIO NAO TRAVA A BARRA DE ATALHOS (10/09/2026).
 *
 * O `Entity.js` do upstream tratava o `GROUNDMAGIC` (EFST 112) como atraso de
 * conjuracao, no mesmo ramo do `POSTDELAY`, e chamava
 * `ShortCut.setGlobalSkillDelay(RemainMS)`. So que o 112 e o icone dos TRES
 * campos do Sabio — Volcano, Deluge e Violent Gale (`Icon: EFST_GROUNDMAGIC`
 * no status.yml do rAthena) —, e o RemainMS dele e a duracao do campo, de 60 a
 * 300 s: a barra de atalhos inteira ficava acinzentada esse tempo todo.
 *
 * Com o servidor passando a mandar o icone do Volcano e do Deluge (antes so o
 * do Violent Gale ia), o defeito ficaria tres vezes mais frequente. O caso le
 * o fonte porque `Entity.js` arrasta a cadeia de render inteira, que nao sobe
 * no jsdom (a mesma razao de `acessorioDaHudNaoDerruba.test.js`).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FONTE = readFileSync(join(process.cwd(), 'src/Engine/MapEngine/Entity.js'), 'utf8').replace(/\r\n/g, '\n');

describe('o icone do campo do Sabio nao e um atraso de conjuracao', () => {
	it('o ramo do post-delay atende o POSTDELAY, e so ele', () => {
		const chamada = FONTE.indexOf('ShortCut.setGlobalSkillDelay(pkt.RemainMS);');
		expect(chamada, 'o post-delay sumiu do Entity.js').toBeGreaterThan(-1);
		// O ramo e o que vem depois do `break;` anterior ate a chamada. Sem
		// comentario: o comentario do conserto cita o GROUNDMAGIC pelo nome.
		const ramo = FONTE.slice(FONTE.lastIndexOf('break;', chamada), chamada).replace(/\/\/[^\n]*/g, '');
		expect(ramo).toContain('case StatusConst.POSTDELAY:');
		expect(
			ramo,
			'o GROUNDMAGIC voltou ao post-delay: Volcano, Deluge e Violent Gale acinzentam a barra inteira'
		).not.toContain('GROUNDMAGIC');
	});
});
