/**
 * O RELATO DO CARREGAMENTO (D-2055): UM por carregamento, so DEPOIS do
 * estou-pronto, com as fases do worker e sem dado do jogador.
 */
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	anotarCargaRefeita,
	anotarFimNoWorker,
	anotarMontado,
	anotarTravou,
	aoEstouProntoEnviado,
	carregamentoEmCurso,
	comecarCarregamento,
	marcarEntradaAceita,
	marcarPedidoDeEntrada,
	montarRelato,
	nomeDoMapaParaRelato,
	relatarDesistencia,
	tipoDeAparelho,
	zerarParaTeste
} from 'Renderer/relatoDoCarregamento.js';
import { criarMedidaDaCarga } from 'Loaders/medidaDaCarga.js';

let fetch;
beforeEach(() => {
	zerarParaTeste();
	fetch = vi.fn(() => Promise.resolve({ ok: true }));
	vi.stubGlobal('fetch', fetch);
});
afterEach(() => {
	vi.unstubAllGlobals();
});

const corpo = i => JSON.parse(fetch.mock.calls[i][1].body);
const naHora = fn => fn();

describe('o ciclo de um carregamento', () => {
	it('a viagem: mede do comeco ao estou-pronto e manda UM relato com as fases do worker', () => {
		comecarCarregamento('glast_01.gat', 1000);
		anotarFimNoWorker(true, { arquivos: 40, arquivosDoCache: 3, faseGndMs: 2500, baseDoCache: false, tentativas: 1, silencios: 1, bytes: 9000000 }, 6000);
		anotarMontado(6400);
		expect(aoEstouProntoEnviado(6500, naHora)).toBe(true);
		expect(fetch).toHaveBeenCalledTimes(1);
		const r = corpo(0);
		expect(r).toMatchObject({
			mapa: 'glast_01',
			motivo: 'viagem',
			desfecho: 'ok',
			totalMs: 5500,
			montagemMs: 400,
			faseGndMs: 2500,
			arquivos: 40,
			arquivosDoCache: 3,
			baseDoCache: false,
			tentativas: 1,
			silencios: 1,
			bytes: 9000000,
			travou: false,
			cargasRefeitas: 0,
			falhas: 0
		});
		expect(r.esperaDoServidorMs).toBeUndefined();
		expect(fetch.mock.calls[0][0]).toBe('/analytics/carregamento');
		expect(fetch.mock.calls[0][1].keepalive).toBe(true);
		// Um so: o segundo estou-pronto (o teleporte no mesmo mapa) nao relata.
		expect(aoEstouProntoEnviado(7000, naHora)).toBe(false);
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('o relato NAO sai na mesma volta do estou-pronto (D-993): ele e agendado', () => {
		const agendar = vi.fn();
		comecarCarregamento('prontera.gat', 0);
		anotarFimNoWorker(true, {}, 10);
		aoEstouProntoEnviado(20, agendar);
		expect(fetch).not.toHaveBeenCalled();
		expect(agendar).toHaveBeenCalledWith(expect.any(Function), 0);
		agendar.mock.calls[0][0]();
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('o estou-pronto antes de o worker terminar nao relata (nao ha carregamento medido)', () => {
		comecarCarregamento('prontera.gat', 0);
		expect(aoEstouProntoEnviado(20, naHora)).toBe(false);
		expect(fetch).not.toHaveBeenCalled();
	});

	it('a entrada: a espera pelo servidor de mapa entra no relato', () => {
		marcarPedidoDeEntrada(100);
		marcarEntradaAceita(1900);
		comecarCarregamento('prontera.gat', 1950);
		anotarFimNoWorker(true, {}, 3000);
		aoEstouProntoEnviado(3100, naHora);
		expect(corpo(0)).toMatchObject({ motivo: 'entrada', esperaDoServidorMs: 1800 });
	});

	it('a resposta velha do servidor nao vira espera de uma viagem muito depois', () => {
		marcarPedidoDeEntrada(100);
		marcarEntradaAceita(1900);
		comecarCarregamento('prontera.gat', 60000);
		anotarFimNoWorker(true, {}, 61000);
		aoEstouProntoEnviado(61100, naHora);
		expect(corpo(0).motivo).toBe('viagem');
		expect(corpo(0).esperaDoServidorMs).toBeUndefined();
	});

	it('o "Tentar de novo" e o MESMO carregamento: um relato, com a contagem e o "travou"', () => {
		comecarCarregamento('glast_01.gat', 0);
		anotarTravou();
		anotarFimNoWorker(false, { faseRswMs: 5 }, 1000);
		anotarCargaRefeita();
		anotarFimNoWorker(true, { faseRswMs: 7 }, 70000);
		aoEstouProntoEnviado(70100, naHora);
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(corpo(0)).toMatchObject({ travou: true, cargasRefeitas: 1, falhas: 1, faseRswMs: 7, totalMs: 70100 });
	});

	it('quem desiste tambem conta (a aba fechada, o "Recarregar o jogo")', () => {
		comecarCarregamento('glast_01.gat', 0);
		expect(carregamentoEmCurso()).toBe(true);
		expect(relatarDesistencia('abandonou', 90000)).toBe(true);
		expect(corpo(0)).toMatchObject({ mapa: 'glast_01', desfecho: 'abandonou', totalMs: 90000 });
		expect(carregamentoEmCurso()).toBe(false);
		expect(relatarDesistencia('abandonou', 90001)).toBe(false);
	});

	it('o fetch que lanca nao vira erro', () => {
		vi.stubGlobal('fetch', () => {
			throw new Error('sem rede');
		});
		comecarCarregamento('prontera.gat', 0);
		anotarFimNoWorker(true, {}, 1);
		expect(() => aoEstouProntoEnviado(2, naHora)).not.toThrow();
	});
});

describe('sem dado pessoal', () => {
	it('o mapa sai sem extensao e so com caracteres de nome de mapa', () => {
		expect(nomeDoMapaParaRelato('GLAST_01.gat')).toBe('glast_01');
		expect(nomeDoMapaParaRelato('1@tower.rsw')).toBe('1@tower');
		expect(nomeDoMapaParaRelato('<script>')).toBe('?');
	});

	it('o relato so leva numeros e booleanos do worker, e o agente aparado', () => {
		const r = montarRelato(
			{ mapa: 'prontera', inicio: 0, motivo: 'viagem', travou: false, cargasRefeitas: 0, abaOculta: false, falhas: 0, worker: { faseGndMs: 1, nome: 'joao', obj: {} }, workerTerminouEm: 1, montadoEm: 2 },
			10,
			'ok',
			{ dedo: false, ua: 'x'.repeat(500) }
		);
		expect(r.nome).toBeUndefined();
		expect(r.obj).toBeUndefined();
		expect(r.faseGndMs).toBe(1);
		expect(r.ua).toHaveLength(200);
		expect(Object.keys(r)).not.toContain('personagem');
	});

	it('celular pelo dedo ou pelo agente, computador no resto', () => {
		expect(tipoDeAparelho(true, 'Mozilla/5.0 (Windows NT 10.0)')).toBe('celular');
		expect(tipoDeAparelho(false, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBe('celular');
		expect(tipoDeAparelho(false, 'Mozilla/5.0 (Linux; Android 14; SM-A146B) Mobile')).toBe('celular');
		expect(tipoDeAparelho(false, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('computador');
	});
});

describe('a medida do worker (Loaders/medidaDaCarga.js)', () => {
	it('fases, arquivos, cache e a pergunta "os tres arquivos-base vieram do cache?"', () => {
		let t = 0;
		const m = criarMedidaDaCarga(() => t);
		m.comecar('rsw');
		t = 100;
		m.contarArquivo({ origem: 'cache-local' }, 'rsw');
		m.terminar('rsw');
		m.comecar('gat');
		t = 150;
		m.contarArquivo({ origem: 'cache-http', bytes: 0 }, 'gat');
		m.terminar('gat');
		m.comecar('gnd');
		t = 2150;
		m.contarArquivo({ origem: 'rede', tentativas: 2, silencios: 1, bytes: 5372510 }, 'gnd');
		m.terminar('gnd');
		m.contarArquivo({ origem: 'rede', falhou: true });
		const r = m.resumo();
		expect(r).toEqual({
			arquivos: 4,
			arquivosDoCache: 2,
			tentativas: 2,
			silencios: 1,
			bytes: 5372510,
			falhas: 1,
			faseRswMs: 100,
			faseGatMs: 50,
			faseGndMs: 2000,
			baseDoCache: false
		});
	});

	it('os tres do cache: baseDoCache verdadeiro; faltando um, a pergunta fica sem resposta', () => {
		const m = criarMedidaDaCarga(() => 0);
		m.contarArquivo({ origem: 'cache-local' }, 'rsw');
		m.contarArquivo({ origem: 'cache-http' }, 'gat');
		expect(m.resumo().baseDoCache).toBeUndefined();
		m.contarArquivo({ origem: 'cache-local' }, 'gnd');
		expect(m.resumo().baseDoCache).toBe(true);
	});

	it('terminar duas vezes nao estica a fase', () => {
		let t = 0;
		const m = criarMedidaDaCarga(() => t);
		m.comecar('modelos');
		t = 10;
		m.terminar('modelos');
		t = 99;
		m.terminar('modelos');
		expect(m.resumo().faseModelosMs).toBe(10);
	});
});

describe('a costura no MapEngine (lida do fonte: o MapEngine nao carrega em jsdom)', () => {
	const fonte = readFileSync('src/Engine/MapEngine.js', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

	it('o relato fecha DEPOIS do CZ_NOTIFY_ACTORINIT, dentro de try (D-993)', () => {
		const inicio = fonte.indexOf('const estouPronto = () => {');
		const corpo = fonte.slice(inicio, inicio + 500);
		const pacote = corpo.indexOf('Network.sendPacket(new PACKET.CZ.NOTIFY_ACTORINIT());');
		const relato = corpo.indexOf('aoEstouProntoEnviado();');
		expect(pacote).toBeGreaterThan(-1);
		expect(relato).toBeGreaterThan(pacote);
		expect(corpo.slice(pacote, relato)).toMatch(/try \{\s*$/);
	});

	it('as marcas da entrada ficam dentro de try', () => {
		expect(fonte).toMatch(/try \{\s*marcarPedidoDeEntrada\(\);\s*\} catch/);
		expect(fonte).toMatch(/try \{\s*marcarEntradaAceita\(\);\s*\} catch/);
	});
});
