/**
 * A VERSAO DO CLIENTE NO LOGIN E A RECUSA POR VERSAO (28/09/2026, D-1635 do
 * servidor - item 25).
 *
 *  1. `Core/versaoDoCliente.js`: o numero do login sai do carimbo do BUILD, e
 *     sem build (dev, teste) o login manda o `version` da configuracao;
 *  2. `Engine/clienteDesatualizado.js`: a recusa com o motivo 5 atualiza a
 *     pagina UMA vez e depois orienta - nunca laco;
 *  3. a COSTURA, lendo o fonte: o builder injeta a versao, o LoginEngine a
 *     manda nos dois pacotes de login e trata o motivo 5 antes de tudo.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { VERSAO_DO_BUILD, VERSAO_DO_CLIENTE, versaoDoCarimbo, versaoParaOLogin } from 'Core/versaoDoCliente.js';
import {
	CHAVE_DA_RECARGA_POR_VERSAO,
	MOTIVO_DE_CLIENTE_DESATUALIZADO,
	TEXTO_DE_ORIENTAR,
	TEXTO_DE_RECARREGAR,
	acaoDoClienteDesatualizado,
	decidirERecarregar,
	lerUltimaRecarga,
	textoDoClienteDesatualizado
} from 'Engine/clienteDesatualizado.js';
import { MS_SEM_REPETIR_A_MESMA_VERSAO } from 'UI/atualizacaoAutomatica.js';

const ler = rel => readFileSync(join(process.cwd(), rel), 'utf8');

/** Um armazenamento de aba de mentira (o `sessionStorage`). */
function armazenamento(inicial = {}) {
	const dados = { ...inicial };
	return {
		dados,
		getItem: k => (k in dados ? dados[k] : null),
		setItem: (k, v) => {
			dados[k] = String(v);
		}
	};
}

function janelaFalsa() {
	const reload = vi.fn();
	return { reload, janela: { top: { location: { reload } }, location: { reload: vi.fn() } } };
}

describe('versaoDoCarimbo: o numero do login sai do carimbo do build', () => {
	it('AAAAMMDDHHMMSS vira AAMMDDHHMM (o build de 28/09/2026 15:30:12 UTC e 2609281530)', () => {
		expect(versaoDoCarimbo('2.0.0-20260928153012')).toBe(2_609_281_530);
		expect(versaoDoCarimbo('9.9.9-20260101000059')).toBe(2_601_010_000);
	});

	it('cabe no u32 do CA_LOGIN ate 2042', () => {
		expect(versaoDoCarimbo('2.0.0-20421231235959')).toBeLessThanOrEqual(0xffff_ffff);
	});

	it('sem carimbo (o dev, com o literal do registrador, ou nada) e zero', () => {
		expect(versaoDoCarimbo('__VERSAO_DO_BUILD__')).toBe(0);
		expect(versaoDoCarimbo('')).toBe(0);
		expect(versaoDoCarimbo(undefined)).toBe(0);
		expect(versaoDoCarimbo(20260928153012)).toBe(0);
		expect(versaoDoCarimbo('2.0.0-2026092815301')).toBe(0);
	});

	it('no teste (sem o define do build) a versao do cliente e zero, e o login manda a da configuracao', () => {
		expect(VERSAO_DO_BUILD).toBe('');
		expect(VERSAO_DO_CLIENTE).toBe(0);
		expect(versaoParaOLogin('55')).toBe(55);
		expect(versaoParaOLogin(25)).toBe(25);
	});

	it('com build, o login manda a versao do build e ignora a da configuracao', () => {
		expect(versaoParaOLogin('55', 2_609_281_530)).toBe(2_609_281_530);
	});

	it('o carimbo e o MESMO que o registrador da casca compara (D-997): 14 digitos no fim', () => {
		const registrador = ler('applications/pwa/registrar-sw.js');
		expect(registrador).toContain("/(\\d{14})$/.exec(versaoDoWorker || '')");
		expect(ler('src/Core/versaoDoCliente.js')).toContain('/(\\d{14})$/.exec(');
	});
});

describe('clienteDesatualizado: a recusa com o motivo 5 nao e um beco', () => {
	it('o motivo e o 5 do protocolo', () => {
		expect(MOTIVO_DE_CLIENTE_DESATUALIZADO).toBe(5);
	});

	it('a primeira recusa recarrega; outra dentro do prazo de D-997 orienta; depois do prazo recarrega de novo', () => {
		const agora = 1_000_000_000;
		expect(acaoDoClienteDesatualizado(null, agora)).toBe('recarregar');
		expect(acaoDoClienteDesatualizado(agora - 1000, agora)).toBe('orientar');
		expect(acaoDoClienteDesatualizado(agora - MS_SEM_REPETIR_A_MESMA_VERSAO + 1, agora)).toBe('orientar');
		expect(acaoDoClienteDesatualizado(agora - MS_SEM_REPETIR_A_MESMA_VERSAO, agora)).toBe('recarregar');
	});

	it('os textos dizem o que acontece e o que fazer, sem "EXE"', () => {
		expect(textoDoClienteDesatualizado('recarregar')).toBe(TEXTO_DE_RECARREGAR);
		expect(textoDoClienteDesatualizado('orientar')).toBe(TEXTO_DE_ORIENTAR);
		expect(TEXTO_DE_RECARREGAR).toContain('versão nova');
		expect(TEXTO_DE_ORIENTAR).toContain('Ctrl+F5');
		expect(TEXTO_DE_ORIENTAR).toContain('Discord');
		for (const t of [TEXTO_DE_RECARREGAR, TEXTO_DE_ORIENTAR]) expect(t).not.toMatch(/EXE/i);
	});

	it('o "Ok": recarrega a pagina DE CIMA e anota; a segunda recusa na mesma aba nao recarrega', () => {
		const aba = armazenamento();
		const { reload, janela } = janelaFalsa();
		expect(decidirERecarregar(5_000, aba, janela)).toBe('recarregar');
		expect(reload).toHaveBeenCalledTimes(1);
		expect(janela.location.reload).not.toHaveBeenCalled();
		expect(aba.dados[CHAVE_DA_RECARGA_POR_VERSAO]).toBe('5000');
		expect(lerUltimaRecarga(aba)).toBe(5000);
		expect(decidirERecarregar(6_000, aba, janela)).toBe('orientar');
		expect(reload).toHaveBeenCalledTimes(1);
	});

	it('sem armazenamento (aba privada, bloqueado) NAO recarrega: sem como lembrar, seria laco', () => {
		const quebrado = {
			getItem: () => {
				throw new Error('bloqueado');
			},
			setItem: () => {
				throw new Error('bloqueado');
			}
		};
		const { reload, janela } = janelaFalsa();
		expect(lerUltimaRecarga(quebrado)).toBeNull();
		expect(decidirERecarregar(5_000, quebrado, janela)).toBe('orientar');
		expect(reload).not.toHaveBeenCalled();
	});

	it('sem acesso a janela de cima, recarrega a propria', () => {
		const propria = vi.fn();
		const janela = {
			get top() {
				throw new Error('cross-origin');
			},
			location: { reload: propria }
		};
		expect(decidirERecarregar(5_000, armazenamento(), janela)).toBe('recarregar');
		expect(propria).toHaveBeenCalledTimes(1);
	});
});

describe('a costura (lendo o fonte)', () => {
	const login = ler('src/Engine/LoginEngine.js');
	const builder = ler('applications/tools/builder-web.mjs');

	it('o LoginEngine manda a versao do build nos DOIS pacotes de login', () => {
		expect(login.match(/pkt\.Version = versaoParaOLogin\(_server\.version\);/g)).toHaveLength(2);
		expect(login).not.toContain('pkt.Version = parseInt(_server.version, 10);');
	});

	it('o motivo 5 e tratado ANTES da mensagem padrao e da entrada pos-cadastro', () => {
		const inicio = login.indexOf('function onConnectionRefused(pkt) {');
		const corpo = login.slice(inicio);
		const cinco = corpo.indexOf('if (pkt.ErrorCode === MOTIVO_DE_CLIENTE_DESATUALIZADO) {');
		expect(cinco).toBeGreaterThan(0);
		expect(cinco).toBeLessThan(corpo.indexOf('const usuarioDaEntrada = loginRecusado();'));
		expect(corpo.slice(cinco, cinco + 200)).toContain('tratarClienteDesatualizado();');
	});

	it('o "Ok" so recarrega pela decisao que anota (nunca location.reload direto no LoginEngine)', () => {
		const inicio = login.indexOf('function tratarClienteDesatualizado() {');
		const fim = login.indexOf('/** O que o jogador le quando o login e recusado pela MANUTENCAO');
		const corpo = login.slice(inicio, fim);
		expect(corpo).toContain('decidirERecarregar(Date.now())');
		expect(corpo).toContain('UIManager.showMessageBox(TEXTO_DE_ORIENTAR');
		expect(corpo).not.toMatch(/location\.reload/);
	});

	it('o builder injeta a MESMA versao do worker no jogo', () => {
		expect(builder).toContain("const versaoDoBuild = pkg.version + '-' + buildDate.replace(/[^0-9]/g, '');");
		expect(builder).toContain('__RAGIDLE_VERSAO_DO_BUILD__: JSON.stringify(versaoDoBuild)');
		// Uma definicao so: a do topo.
		expect(builder.match(/const versaoDoBuild =/g)).toHaveLength(1);
	});
});
