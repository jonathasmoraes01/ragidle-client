/**
 * A VOLTA QUENTE (D-2576, 15/10/2026) — `Engine/voltaQuente.js` e a costura no
 * `Engine/MapEngine.js`.
 *
 * O dono: a volta do segundo plano *"sem recarregar o mapa"*. A reconexao do
 * mesmo personagem com a cena inteira na tela mantem o nome do mapa, e o
 * `setMap` do mapa da volta cai no teleporte local (sem carga). Na volta, quem
 * monta a cena e o `ZC_NPCACK_MAPMOVE` (o mapa de AGORA), e nao o aceite.
 *
 * O `MapEngine.js` nao carrega em jsdom: a decisao e a espera sao provadas com
 * comportamento aqui (puras, relogio falso); a costura, pelo fonte. O
 * comportamento do `setMap` com o nome mantido esta em
 * `tests/renderer/voltaQuenteNaCena.test.js`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	PRAZO_DO_MAPA_DA_VOLTA_MS,
	cenaServeParaAVolta,
	criarEsperaPeloMapaDaVolta
} from '../../src/Engine/voltaQuente.js';

describe('cenaServeParaAVolta', () => {
	const inteira = { volta: true, mapaNaCena: 'prt_fild08.gat', carregando: false, contextoPerdido: false };

	it('a volta com a cena inteira mantem a cena', () => {
		expect(cenaServeParaAVolta(inteira)).toBe(true);
	});

	it('CONTROLE: login, troca de personagem e troca de servidor (sem `volta`) recarregam', () => {
		expect(cenaServeParaAVolta({ ...inteira, volta: false })).toBe(false);
		expect(cenaServeParaAVolta({ ...inteira, volta: undefined })).toBe(false);
		expect(cenaServeParaAVolta({ ...inteira, volta: 'sim' })).toBe(false);
	});

	it('sem mapa desenhado (nada carregou, ou a carga falhou e zerou o nome) recarrega', () => {
		expect(cenaServeParaAVolta({ ...inteira, mapaNaCena: '' })).toBe(false);
		expect(cenaServeParaAVolta({ ...inteira, mapaNaCena: undefined })).toBe(false);
	});

	it('com um carregamento em curso recarrega (o pedido fica com o `mapaPendente`)', () => {
		expect(cenaServeParaAVolta({ ...inteira, carregando: true })).toBe(false);
	});

	it('com o contexto WebGL perdido recarrega (chao e texturas ja foram embora)', () => {
		expect(cenaServeParaAVolta({ ...inteira, contextoPerdido: true })).toBe(false);
	});

	it('sem argumento nao mantem nada', () => {
		expect(cenaServeParaAVolta(undefined)).toBe(false);
		expect(cenaServeParaAVolta(null)).toBe(false);
	});
});

describe('criarEsperaPeloMapaDaVolta', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('o MAPMOVE chega antes do prazo: o aceite nao monta nada', () => {
		const espera = criarEsperaPeloMapaDaVolta();
		const montar = vi.fn();
		espera.esperar(montar);
		expect(espera.esperando()).toBe(true);
		expect(espera.mapaChegou()).toBe(true);
		vi.advanceTimersByTime(PRAZO_DO_MAPA_DA_VOLTA_MS * 3);
		expect(montar).not.toHaveBeenCalled();
		expect(espera.esperando()).toBe(false);
	});

	it('CONTROLE: sem MAPMOVE (um servidor que nao o manda), o aceite monta no prazo, uma vez', () => {
		const espera = criarEsperaPeloMapaDaVolta();
		const montar = vi.fn();
		espera.esperar(montar);
		vi.advanceTimersByTime(PRAZO_DO_MAPA_DA_VOLTA_MS - 1);
		expect(montar).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(montar).toHaveBeenCalledOnce();
		vi.advanceTimersByTime(PRAZO_DO_MAPA_DA_VOLTA_MS * 3);
		expect(montar).toHaveBeenCalledOnce();
		expect(espera.mapaChegou(), 'o MAPMOVE depois do prazo nao tinha o que cancelar').toBe(false);
	});

	it('o prazo e curto: a entrada sem MAPMOVE nao espera mais que 1,5 s', () => {
		expect(PRAZO_DO_MAPA_DA_VOLTA_MS).toBeLessThanOrEqual(1500);
		expect(PRAZO_DO_MAPA_DA_VOLTA_MS).toBeGreaterThan(0);
	});

	it('um aceite novo substitui o anterior (so o mais novo monta)', () => {
		const espera = criarEsperaPeloMapaDaVolta();
		const velho = vi.fn();
		const novo = vi.fn();
		espera.esperar(velho);
		espera.esperar(novo);
		vi.advanceTimersByTime(PRAZO_DO_MAPA_DA_VOLTA_MS);
		expect(velho).not.toHaveBeenCalled();
		expect(novo).toHaveBeenCalledOnce();
	});

	it('`cancelar` (a sessao desmontada, o init seguinte) derruba a montagem pendente', () => {
		const espera = criarEsperaPeloMapaDaVolta();
		const montar = vi.fn();
		espera.esperar(montar);
		espera.cancelar();
		vi.advanceTimersByTime(PRAZO_DO_MAPA_DA_VOLTA_MS * 2);
		expect(montar).not.toHaveBeenCalled();
	});

	it('o MAPMOVE fora da volta (a Asa de Mosca, a viagem) nao tem nada a cancelar', () => {
		const espera = criarEsperaPeloMapaDaVolta();
		expect(espera.mapaChegou()).toBe(false);
	});

	it('o relogio e injetavel (agendar/desagendar/prazo)', () => {
		const agendados = [];
		const desagendados = [];
		const espera = criarEsperaPeloMapaDaVolta({
			agendar: (fn, ms) => {
				agendados.push(ms);
				return { fn };
			},
			desagendar: t => desagendados.push(t),
			prazoMs: 42
		});
		espera.esperar(() => {});
		espera.mapaChegou();
		expect(agendados).toEqual([42]);
		expect(desagendados).toHaveLength(1);
	});
});

describe('a costura no MapEngine (fonte)', () => {
	const fonte = readFileSync(join(process.cwd(), 'src', 'Engine', 'MapEngine.js'), 'utf8').replace(/\r\n/g, '\n');

	it('a decisao roda em try/catch e o erro devolve a carga de sempre (D-993)', () => {
		expect(fonte).toMatch(
			/let manterCena = false;\n\t+try \{\n\t+manterCena = cenaServeParaAVolta\(\{[\s\S]{0,300}?\}\);\n\t+\} catch \(erro\) \{\n[^\n]*\n\t+manterCena = false;\n\t+\}\n\t+if \(!manterCena\) \{\n\t+if \(!MapRenderer\.loading\) \{\n\t+MapRenderer\.currentMap = '';/
		);
	});

	it('a decisao le a volta, o mapa desenhado, a carga e o contexto', () => {
		const i = fonte.indexOf('manterCena = cenaServeParaAVolta({');
		const corpo = fonte.slice(i, i + 300);
		expect(corpo).toContain('volta: _voltaDaConexao');
		expect(corpo).toContain('mapaNaCena: MapRenderer.currentMap');
		expect(corpo).toContain('carregando: MapRenderer.loading');
		expect(corpo).toContain('contextoPerdido: Renderer.contextLost === true');
	});

	it('o `init` marca a volta pelo `daEntrada.volta`, e a cada chamada (a troca de servidor zera)', () => {
		expect(fonte).toContain('static init(ip, port, mapName, aoFalhar, daEntrada) {');
		expect(fonte).toMatch(/_voltaDaConexao = !!\(daEntrada && daEntrada\.volta === true\);\n\t+_esperaPeloMapaDaVolta\.cancelar\(\);/);
	});

	it('na volta o aceite so agenda; fora dela monta na hora, como sempre', () => {
		const i = fonte.indexOf('const peloAceite = {');
		const corpo = fonte.slice(i, i + 1200);
		expect(corpo).toMatch(
			/if \(_voltaDaConexao\) \{\n\t+_esperaPeloMapaDaVolta\.esperar\(\(\) => onMapChange\(peloAceite, true\)\);\n\t+return;\n\t+\}\n\t+onMapChange\(peloAceite, true\);/
		);
	});

	it('o MAPMOVE (e so ele) cancela a espera e guarda o mapa de agora', () => {
		const i = fonte.indexOf('function onMapChange(pkt, ehEntradaNoMundo) {');
		const corpo = fonte.slice(i, i + 600);
		expect(corpo).toMatch(
			/if \(ehEntradaNoMundo !== true\) \{\n(?:\t+\/\/[^\n]*\n)*\t+_esperaPeloMapaDaVolta\.mapaChegou\(\);\n\t+if \(pkt && typeof pkt\.mapName === 'string' && pkt\.mapName !== ''\) _mapName = pkt\.mapName;/
		);
	});

	it('desmontar a sessao derruba a montagem pendente', () => {
		const i = fonte.indexOf('function desmontarSessaoDeMapa() {');
		const corpo = fonte.slice(i, i + 1500);
		expect(corpo).toContain('_esperaPeloMapaDaVolta.cancelar();');
	});

	it('o MAPMOVE continua ligado ao `onMapChange` (a porta que cancela a espera)', () => {
		expect(fonte).toContain('Network.hookPacket(PACKET.ZC.NPCACK_MAPMOVE, onMapChange);');
	});
});
