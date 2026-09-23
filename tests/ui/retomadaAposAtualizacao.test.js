/**
 * A retomada depois da atualizacao (D-997): a pagina recarregada volta ao
 * mesmo personagem sem pedir senha. O passe e credencial, entao a retomada
 * vive o minimo: gravada na hora da recarga, apagada na primeira leitura,
 * recusada se velha. Ver o cabecalho de `Engine/retomadaAposAtualizacao.js`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
	CHAVE_DA_RETOMADA,
	PRAZO_DA_RETOMADA_MS,
	armarSelecao,
	consumirRetomada,
	guardarRetomada,
	personagemParaSelecionar
} from 'Engine/retomadaAposAtualizacao.js';

function armazenamentoFalso() {
	const mapa = new Map();
	return {
		getItem: k => (mapa.has(k) ? mapa.get(k) : null),
		setItem: (k, v) => mapa.set(k, String(v)),
		removeItem: k => mapa.delete(k),
		mapa
	};
}

const SESSAO = { AID: 2000123, AuthCode: 987654, UserLevel: 0, Sex: 1, WebToken: 'abc', ServerName: 'Ragnarok' };
const SERVIDOR = { ip: 16777343, port: 6121, name: 'Ragnarok' };

describe('guardar e consumir', () => {
	it('a retomada volta inteira na pagina seguinte', () => {
		const a = armazenamentoFalso();
		expect(guardarRetomada(SESSAO, SERVIDOR, 150001, 1000, a)).toBe(true);
		const r = consumirRetomada(2000, a);
		expect(r).toMatchObject({ AID: 2000123, AuthCode: 987654, Sex: 1, gid: 150001, servidorDeChar: SERVIDOR });
	});

	it('e APAGADA na primeira leitura — a segunda nao acha nada', () => {
		const a = armazenamentoFalso();
		guardarRetomada(SESSAO, SERVIDOR, 150001, 1000, a);
		consumirRetomada(2000, a);
		expect(a.mapa.has(CHAVE_DA_RETOMADA)).toBe(false);
		expect(consumirRetomada(2001, a)).toBeNull();
	});

	it('velha demais: recusada, e apagada igual', () => {
		const a = armazenamentoFalso();
		guardarRetomada(SESSAO, SERVIDOR, 150001, 1000, a);
		expect(consumirRetomada(1000 + PRAZO_DA_RETOMADA_MS + 1, a)).toBeNull();
		expect(a.mapa.has(CHAVE_DA_RETOMADA)).toBe(false);
	});

	it('dentro do prazo, no limite: vale (CONTROLE do caso acima)', () => {
		const a = armazenamentoFalso();
		guardarRetomada(SESSAO, SERVIDOR, 150001, 1000, a);
		expect(consumirRetomada(1000 + PRAZO_DA_RETOMADA_MS, a)).not.toBeNull();
	});

	it('sem conta, sem passe ou sem char-server nao ha o que guardar', () => {
		const a = armazenamentoFalso();
		expect(guardarRetomada({ ...SESSAO, AID: 0 }, SERVIDOR, 1, 1000, a)).toBe(false);
		expect(guardarRetomada({ ...SESSAO, AuthCode: 0 }, SERVIDOR, 1, 1000, a)).toBe(false);
		expect(guardarRetomada(SESSAO, null, 1, 1000, a)).toBe(false);
		expect(a.mapa.size).toBe(0);
	});

	it('texto torto ou sem os campos vira null, e nao tentativa de entrar com lixo', () => {
		const a = armazenamentoFalso();
		a.setItem(CHAVE_DA_RETOMADA, '{nao e json');
		expect(consumirRetomada(1, a)).toBeNull();
		a.setItem(CHAVE_DA_RETOMADA, JSON.stringify({ AID: 1, AuthCode: 2, guardadaEm: 1 }));
		expect(consumirRetomada(1, a)).toBeNull();
	});

	it('fora do jogo (na selecao) o personagem fica null', () => {
		const a = armazenamentoFalso();
		guardarRetomada(SESSAO, SERVIDOR, null, 1000, a);
		expect(consumirRetomada(1000, a).gid).toBeNull();
	});
});

describe('a selecao automatica', () => {
	beforeEach(() => armarSelecao(null));

	it('escolhe o personagem da retomada UMA vez — a lista chega mais de uma vez', () => {
		const lista = [{ GID: 1 }, { GID: 150001, CharNum: 2 }];
		armarSelecao(150001);
		expect(personagemParaSelecionar(lista)).toEqual({ GID: 150001, CharNum: 2 });
		expect(personagemParaSelecionar(lista)).toBeNull();
	});

	it('o cabecalho sem lista nao desarma (ele chega antes da lista)', () => {
		armarSelecao(150001);
		expect(personagemParaSelecionar(undefined)).toBeNull();
		expect(personagemParaSelecionar([{ GID: 150001 }])).toEqual({ GID: 150001 });
	});

	it('personagem que sumiu da lista: desarma e o jogador fica na selecao', () => {
		armarSelecao(150001);
		expect(personagemParaSelecionar([{ GID: 7 }])).toBeNull();
		expect(personagemParaSelecionar([{ GID: 150001 }])).toBeNull();
	});

	it('sem retomada, nada e escolhido (CONTROLE)', () => {
		expect(personagemParaSelecionar([{ GID: 150001 }])).toBeNull();
	});
});

describe('as costuras nos motores', () => {
	const LOGIN = readFileSync(resolve(__dirname, '../../src/Engine/LoginEngine.js'), 'utf8');
	const CHAR = readFileSync(resolve(__dirname, '../../src/Engine/CharEngine.js'), 'utf8');

	it('o LoginEngine consome a retomada ANTES da entrada pos-cadastro e do login', () => {
		const retomada = LOGIN.indexOf('const retomada = consumirRetomada(Date.now());');
		expect(retomada).toBeGreaterThan(-1);
		expect(LOGIN.indexOf('capturarEntrada();', retomada)).toBeGreaterThan(retomada);
		expect(LOGIN).toMatch(/function retomarSessao\(retomada\)[\s\S]{0,900}CharEngine\.init\(retomada\.servidorDeChar\)/);
	});

	it('lista atrasada DEPOIS da escolha nao apaga o jogador (a tela preta que a prova pegou)', () => {
		/* A lista chega mais de uma vez e zera `Session.Entity`. A retomada
		   escolhe na primeira; sem a trava, a segunda apagava o jogador a
		   caminho do mapa e a camera travava. `prove:atualizacao-sem-deslogar`
		   reprovou exatamente assim. */
		const inicio = CHAR.indexOf('function onConnectionAccepted(pkt) {');
		const trava = CHAR.indexOf('if (_escolhido) {', inicio);
		const zera = CHAR.indexOf('Session.Entity = null;', inicio);
		expect(inicio).toBeGreaterThan(-1);
		expect(trava).toBeGreaterThan(inicio);
		expect(trava).toBeLessThan(zera);
		expect(CHAR).toMatch(/Session\.Entity = new Player\(entity\);\r?\n\t_escolhido = true;/);
		expect(CHAR).toMatch(/_server = server;\r?\n\t\t_escolhido = false;/);
	});

	it('a retomada marca a entrada, e o login DIGITADO a esquece (a janela de boas-vindas)', () => {
		expect(LOGIN).toMatch(/function retomarSessao\(retomada\)[\s\S]{0,1200}marcarEntradaPorAtualizacao\(\);/);
		expect(LOGIN).toMatch(/function onConnectionRequest\(username, password\) \{[\s\S]{0,400}esquecerEntradaPorAtualizacao\(\);/);
	});

	it('o CharEngine seleciona pelo MESMO onConnectRequest do clique', () => {
		expect(CHAR).toMatch(/personagemParaSelecionar\(pkt\.charInfo\)[\s\S]{0,120}onConnectRequest\(retomado\)/);
	});
});
