import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { falaDeGm } from '../../src/Engine/MapEngine/falaDeGm.js';

/*
 * A TAG [GM] DE QUEM FALA DE OUTRO MAPA (24/09/2026, relato do dono: o Urso,
 * administrador, saia "[Global] Urso"; o dono saia "[GM] Guizao").
 *
 * O servidor ja mandava o Urso na lista (`ZC_RAGIDLE_ADMINS`, pela mesma regra
 * de `ehAdministrador`). O chat e que so perguntava pela ENTIDADE na tela, e o
 * chat e global: quem fala de outro mapa nao tem entidade aqui.
 */
const URSO = 2000123;
const COMUM = 2000456;
const LISTA = [2000000, URSO];

describe('falaDeGm', () => {
	it('o administrador de OUTRO mapa (sem entidade na tela) leva a tag pela lista', () => {
		expect(falaDeGm(URSO, null, LISTA)).toBe(true);
		expect(falaDeGm(URSO, undefined, LISTA)).toBe(true);
	});

	it('jogador comum de outro mapa NAO leva a tag', () => {
		expect(falaDeGm(COMUM, null, LISTA)).toBe(false);
	});

	it('com a entidade na tela, o isAdmin dela responde (e ele sai da mesma lista)', () => {
		expect(falaDeGm(URSO, { isAdmin: true }, LISTA)).toBe(true);
		expect(falaDeGm(COMUM, { isAdmin: false }, LISTA)).toBe(false);
	});

	it('um mob ou NPC na tela cujo GID coincide com uma conta da lista NAO vira GM', () => {
		expect(falaDeGm(URSO, { isAdmin: false }, LISTA)).toBe(false);
	});

	it('lista ausente ou vazia nao marca ninguem (o cliente antes do primeiro 0x0fd0)', () => {
		expect(falaDeGm(URSO, null, undefined)).toBe(false);
		expect(falaDeGm(URSO, null, [])).toBe(false);
	});
});

describe('onEntityTalk pergunta por falaDeGm, e nao so pela entidade', () => {
	const fonte = readFileSync(resolve(import.meta.dirname, '../../src/Engine/MapEngine/Entity.js'), 'utf8');
	const inicio = fonte.indexOf('function onEntityTalk(');
	const fim = fonte.indexOf('ChatBox.addText(pkt.msg, type', inicio);
	const trecho = fonte.slice(inicio, fim);

	it('a decisao da tag sai de falaDeGm com o GID da fala e a lista da sessao, ANTES do addText', () => {
		expect(inicio).toBeGreaterThan(-1);
		expect(fim).toBeGreaterThan(inicio);
		expect(trecho).toContain('falaDeGm(pkt.GID, entity, Session.AdminList)');
		expect(trecho).toContain('type |= ChatBox.TYPE.ADMIN');
	});

	it('a tag nao esta mais presa ao ramo "if (entity)" (o defeito do Urso)', () => {
		expect(trecho).not.toMatch(/if \(entity\.isAdmin\)/);
	});
});
