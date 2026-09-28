/**
 * A AID POTION NA JANELA DA CONFIG IDLE (28/09/2026, D-1641 — item 8 do dono:
 * "no clique funciona sempre, na automacao vem desligada").
 *
 * O servidor manda a Aid Potion na lista `skillsDeCura` do contexto, com
 * `gastaPocao: true`. A janela a desenha como as outras curas (interruptor e
 * "Quem curar" proprios, o limiar e o da cura), e o que muda e:
 *   1. ela nasce DESLIGADA — o espelho de `CURAS_DESLIGADAS_DE_FABRICA` do
 *      servidor; sem isso o primeiro "Aplicar" materializaria a entrada ligada
 *      e o jogador perderia pocoes sem ter escolhido;
 *   2. a linha diz o custo (a pocao) e o que ela faz sozinha.
 *
 * Le o fonte para a parte do componente, como os vizinhos desta pasta (o
 * componente depende do DOM do roBrowser e nao importa em Node).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	CURAS_DESLIGADAS_DE_FABRICA,
	curaLigadaPara,
	curaLigada
} from '../../src/UI/Components/IdleConfig/secoesDaConfig.js';

const AQUI = dirname(fileURLToPath(import.meta.url));
const JS = readFileSync(join(AQUI, '..', '..', 'src', 'UI', 'Components', 'IdleConfig', 'IdleConfig.js'), 'utf8');
const RENDER = JS.slice(JS.indexOf('function renderCura()'), JS.indexOf('function bindSuporteExtra('));

const AID = 'AM_POTIONPITCHER';

describe('a Aid Potion na config idle', () => {
	it('nasce DESLIGADA, mesmo com a cura geral ligada (espelho do servidor)', () => {
		expect(CURAS_DESLIGADAS_DE_FABRICA).toContain(AID);
		expect(curaLigadaPara(undefined, AID)).toBe(false);
		expect(curaLigadaPara({ alvo: 'grupo', curarAbaixoDe: 50, ligada: true }, AID)).toBe(false);
		// A Cura continua seguindo o interruptor geral: o controle.
		expect(curaLigadaPara({ alvo: 'grupo', curarAbaixoDe: 50, ligada: true }, 'AL_HEAL')).toBe(true);
	});

	it('quem a liga, a tem; e so ela aprendida desligada nao conta como "cura ligada"', () => {
		expect(curaLigadaPara({ habilidades: { [AID]: { ligada: true, alvo: 'eu' } } }, AID)).toBe(true);
		const ctx = { skillsDeCura: [{ skillId: AID, aprendido: 5, custoSp: 1, alcancaGrupo: true, gastaPocao: true }] };
		expect(curaLigada({ cura: { alvo: 'grupo', curarAbaixoDe: 50 } }, ctx)).toBe(false);
		expect(curaLigada({ cura: { alvo: 'grupo', curarAbaixoDe: 50, habilidades: { [AID]: { ligada: true } } } }, ctx)).toBe(true);
	});

	it('a linha diz o custo em pocao e o que ela faz sozinha, e so para quem gasta pocao', () => {
		expect(RENDER).toContain('const custo = c.gastaPocao ?');
		expect(RENDER).toContain('SP + 1 poção');
		expect(RENDER).toContain('No clique ela funciona sempre.');
		expect(RENDER).toContain('<span class="ic-card-meta">Nv ${c.aprendido} · ${custo}</span>');
		expect(RENDER).toContain('<span class="ic-switch-sub">${explicacao}</span>');
		// As outras curas continuam com o texto de sempre.
		expect(RENDER).toContain('Usada sozinha quando a barra cair abaixo do limite');
	});
});
