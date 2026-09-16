/**
 * O ID DO ITEM SO PARA O ADMINISTRADOR (D-1331, 11/09/2026).
 *
 * Ver `src/DB/Items/idParaAdmin.js` para o que ele e e por que e um modulo em
 * vez de duas linhas nas duas telas.
 *
 * O que estes casos guardam sao as tres formas de a regra apodrecer:
 *
 *  1. a linha aparecer para quem NAO e administrador (o defeito que importa);
 *  2. a linha sumir para quem E (o pedido do dono deixando de ser atendido);
 *  3. o texto sair "ID: NaN" — pior que nao aparecer, porque o administrador
 *     confia nele ao abrir um chamado.
 */

import { afterEach, describe, expect, it } from 'vitest';
import Session from 'Engine/SessionStorage.js';
import { linhaDeIdParaAdmin, souAdmin, textoDoIdDeItem } from 'DB/Items/idParaAdmin.js';

const entidadeOriginal = Session.Entity;

afterEach(() => {
	Session.Entity = entidadeOriginal;
});

describe('textoDoIdDeItem — a parte pura, sem Session e sem DOM', () => {
	it('o id vira a linha que o administrador le', () => {
		expect(textoDoIdDeItem(18145)).toBe('ID: 18145');
		expect(textoDoIdDeItem(501)).toBe('ID: 501');
	});

	it('id em texto tambem resolve — a mochila e a ficha nem sempre concordam no tipo', () => {
		expect(textoDoIdDeItem('12290')).toBe('ID: 12290');
	});

	it('O CASO 3: nada de "ID: NaN" — sem id, sem linha', () => {
		expect(textoDoIdDeItem(undefined)).toBeNull();
		expect(textoDoIdDeItem(null)).toBeNull();
		expect(textoDoIdDeItem(Number.NaN)).toBeNull();
		expect(textoDoIdDeItem('nao e um id')).toBeNull();
		expect(textoDoIdDeItem(Number.POSITIVE_INFINITY)).toBeNull();
	});
});

describe('souAdmin — a unica pergunta pela Session', () => {
	it('sem entidade (login, char select, visualizadores) nao derruba a tela', () => {
		Session.Entity = undefined;
		expect(souAdmin()).toBe(false);
	});

	it('entidade sem a marca e jogador comum', () => {
		Session.Entity = {};
		expect(souAdmin()).toBe(false);
	});

	it('a marca que o servidor manda liga a resposta', () => {
		Session.Entity = { isAdmin: true };
		expect(souAdmin()).toBe(true);
	});
});

describe('linhaDeIdParaAdmin — o que as DUAS telas renderizam', () => {
	it('O CASO 1: jogador comum nao ve o id', () => {
		Session.Entity = { isAdmin: false };
		expect(linhaDeIdParaAdmin(18145)).toBeNull();
	});

	it('O CASO 2: o administrador ve', () => {
		Session.Entity = { isAdmin: true };
		expect(linhaDeIdParaAdmin(18145)).toBe('ID: 18145');
	});

	it('administrador com item sem id continua sem linha — a guarda pura nao e pulada', () => {
		/*
		 * O par que fecha o caso: se `linhaDeIdParaAdmin` montasse o texto por
		 * conta propria em vez de chamar `textoDoIdDeItem`, este caso passaria a
		 * imprimir "ID: NaN" so para o administrador — que e quem menos deveria
		 * receber lixo na tela.
		 */
		Session.Entity = { isAdmin: true };
		expect(linhaDeIdParaAdmin(Number.NaN)).toBeNull();
		expect(linhaDeIdParaAdmin(undefined)).toBeNull();
	});
});
