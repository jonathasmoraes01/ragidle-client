/**
 * O ESTOU-PRONTO SAI MESMO QUE A MONTAGEM LANCE (F28, auditoria de 22/09/2026).
 *
 * O `CZ_NOTIFY_ACTORINIT` completa a entrada no mapa e saia no fim do
 * `onLoad`, depois de dezenas de chamadas RAGIDLE sem guarda. Uma excecao ali e
 * o pacote nunca saia: o servidor ficava com `carregandoMapa` e o tique parava
 * de dirigir o jogador. A familia do aviso D-993.
 *
 * Le o fonte sem comentarios: `MapEngine.js` nao carrega em jsdom (ver
 * `dormirEmTelaPreta.test.js`).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const semComentario = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const MOTOR = semComentario(readFileSync('src/Engine/MapEngine.js', 'utf8'));
const RENDER = semComentario(readFileSync('src/Renderer/MapRenderer.js', 'utf8'));

describe('o estou-pronto sempre sai (F28)', () => {
	it('a rede de seguranca e agendada no TOPO do onLoad, antes de qualquer montagem', () => {
		const inicio = MOTOR.indexOf('MapRenderer.onLoad = () => {');
		expect(inicio).toBeGreaterThan(-1);
		const corpo = MOTOR.slice(inicio, inicio + 600);
		expect(corpo).toContain('setTimeout(estouPronto, 0);');
		expect(corpo).toContain('if (estouProntoSaiu) return;');
	});

	it('o envio normal passa pela mesma funcao — e o pacote nao e enviado cru em outro lugar', () => {
		expect(MOTOR).toContain('estouPronto();');
		const crus = MOTOR.match(/Network\.sendPacket\(new PACKET\.CZ\.NOTIFY_ACTORINIT\(\)\)/g) ?? [];
		expect(crus, 'o ACTORINIT voltou a ser enviado fora da funcao guardada').toHaveLength(1);
	});

	it('o teleporte no mesmo mapa tambem guarda o onLoad', () => {
		expect(RENDER).toMatch(/Background\.remove\(\(\) => \{\s*try \{\s*MapRenderer\.onLoad\(\);/);
	});
});
