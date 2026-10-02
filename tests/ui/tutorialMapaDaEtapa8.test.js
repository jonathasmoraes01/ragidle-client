/**
 * A ETAPA 8 DO TUTORIAL depois do aceite que ja viaja (01/10/2026, D-1925).
 *
 * Desde D-1925 o aceite da missao (etapa 7) leva o personagem ao mapa da caca
 * na hora. A etapa 8 ("Escolha um mapa e viaje") cumpre quando o mapa muda; se
 * a referencia dela for o mapa de QUANDO ELA COMECA, ela pede uma segunda
 * viagem a quem ja chegou - e quem escolhe o mesmo campo e recusado pelo
 * servidor, travando o tutorial (medido na tela pelo servidor,
 * `scripts/diag-tutorial-da-missao-na-tela.ts`).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mapaDeReferenciaDaEtapa } from '../../src/UI/Components/TutorialIdle/etapasDoTutorial.js';

describe('o mapa de referencia da etapa que comeca', () => {
	it('a 8 logo depois da 7 herda o mapa de quando a 7 comecou', () => {
		expect(mapaDeReferenciaDaEtapa(8, { numero: 7, mapa: 'prontera' }, 'prt_fild08')).toBe('prontera');
	});

	it('a 8 sem a 7 antes (relogou no meio) usa o mapa de agora', () => {
		expect(mapaDeReferenciaDaEtapa(8, null, 'prt_fild08')).toBe('prt_fild08');
		expect(mapaDeReferenciaDaEtapa(8, { numero: 6, mapa: 'prontera' }, 'prt_fild08')).toBe('prt_fild08');
	});

	it('as outras etapas usam sempre o mapa de agora', () => {
		expect(mapaDeReferenciaDaEtapa(9, { numero: 8, mapa: 'prontera' }, 'prt_fild08')).toBe('prt_fild08');
		expect(mapaDeReferenciaDaEtapa(7, { numero: 6, mapa: 'izlude' }, 'prontera')).toBe('prontera');
	});

	it('o componente usa a regra, e guarda o marco que sai por uma volta', () => {
		const fonte = readFileSync(resolve('src/UI/Components/TutorialIdle/TutorialIdle.js'), 'utf8');
		expect(fonte).toContain('_marco.mapa = mapaDeReferenciaDaEtapa(numero, anterior, _marco.mapa);');
		expect(fonte).toContain('const anterior = _marco || _marcoAnterior;');
		expect(fonte).toContain('_marcoAnterior = _marco;');
	});
});
