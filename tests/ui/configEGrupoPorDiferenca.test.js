/**
 * A CONFIG IDLE E A JANELA DE GRUPO APLICAM O PARCIAL (07/10/2026, D-2077).
 *
 * A Config Idle de verdade (o harness de `botaoAutoNaoMandaRascunho.test.js`:
 * a rede mockada e o HTML real): o que sai no fio e o que a janela passa a ter
 * - o inteiro guarda a revisao, o parcial muda `serverConfig`/`contexto` como o
 *   inteiro mudaria, e o parcial que nao cai pede o inteiro (`bases` com
 *   `config: null` + o pedido fixo) uma vez so.
 *
 * A janela de Grupo nao monta em jsdom (`vidaDosAliados.test.js`): a COSTURA
 * dela e cobrada pela leitura do fonte.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	enviados: [],
	hooks: [],
	network: {
		sendPacket: p => mocks.enviados.push(p),
		hookPacket: (_pkt, cb) => mocks.hooks.push(cb)
	}
}));

vi.mock('Network/NetworkManager.js', () => ({ default: mocks.network }));
vi.mock('Renderer/Renderer.js', () => ({ default: { render: vi.fn(), vsync: [] } }));
vi.mock('UI/UIManager.js', () => ({ default: { showErrorBox: vi.fn(), addComponent: c => c } }));
vi.mock('UI/Components/ChatBox/ChatBox.js', () => ({
	default: { addText: vi.fn(), TYPE: { ERROR: 1 }, FILTER: { PUBLIC_LOG: 1 } }
}));

const { default: htmlDoComponente } = await import('UI/Components/IdleConfig/IdleConfig.html?raw');
const { default: IdleConfig } = await import('UI/Components/IdleConfig/IdleConfig.js');
const { default: PACKET } = await import('Network/PacketStructure.js');

const CONFIG = { cacaAutomatica: true, coletarItens: true, modoDeAtaque: 'skills-e-basico', rotacao: [], alvosDesabilitados: [] };
const INTEIRO = { v: 1, problemas: [], config: CONFIG, contexto: { ehCidade: false, mapa: 'prt_fild08', faltamMsParaDormir: 5000 }, rev: 700 };

function receber(corpo) {
	mocks.hooks[0]({ json: JSON.stringify(corpo) });
}

describe('a Config Idle aplica o parcial (D-2077)', () => {
	beforeEach(() => {
		mocks.enviados.length = 0;
		IdleConfig._host = document.createElement('div');
		IdleConfig._host.innerHTML = htmlDoComponente;
		IdleConfig._shadow = null;
		IdleConfig.limparEstadoDoPersonagem();
		mocks.enviados.length = 0;
	});

	it('o inteiro guarda a revisao para a declaracao da entrada', () => {
		expect(IdleConfig.revisaoDaConfig()).toBe(null);
		receber(INTEIRO);
		expect(IdleConfig.revisaoDaConfig()).toBe(700);
		expect(IdleConfig.serverConfig).toEqual(CONFIG);
	});

	it('o parcial muda o que o inteiro mudaria: a config aceita, o contexto e o rodape do Aplicar', () => {
		receber(INTEIRO);
		receber({
			v: 2,
			parcial: true,
			de: 700,
			rev: 701,
			trocas: [[['config', 'cacaAutomatica'], false], [['contexto', 'faltamMsParaDormir'], 4000]],
			problemas: [],
			aplicado: true
		});
		expect(IdleConfig.serverConfig.cacaAutomatica).toBe(false);
		expect(IdleConfig.contexto.faltamMsParaDormir).toBe(4000);
		expect(IdleConfig.contexto.mapa).toBe('prt_fild08');
		expect(IdleConfig.revisaoDaConfig()).toBe(701);
		expect(mocks.enviados).toHaveLength(0);
		// O rodape do Aplicar: a janela leu o `aplicado` do parcial.
		expect(IdleConfig._host.querySelector('.ic-status').textContent).toBe('Aplicado.');
	});

	it('o parcial que nao cai pede o inteiro UMA vez (`config: null` + o pedido fixo) e nao mexe na config', () => {
		receber(INTEIRO);
		receber({ v: 2, parcial: true, de: 123, rev: 124, trocas: [[['config', 'cacaAutomatica'], false]], problemas: [] });
		receber({ v: 2, parcial: true, de: 124, rev: 125, trocas: [], problemas: [] });
		expect(IdleConfig.serverConfig.cacaAutomatica).toBe(true);
		expect(mocks.enviados).toHaveLength(2);
		expect(mocks.enviados[0]).toBeInstanceOf(PACKET.CZ.RAGIDLE_MISSAO_ACAO);
		expect(JSON.parse(mocks.enviados[0].json)).toEqual({ acao: 'bases', config: null });
		expect(mocks.enviados[1]).toBeInstanceOf(PACKET.CZ.RAGIDLE_PEDIR_CONFIG);
		expect(IdleConfig.revisaoDaConfig()).toBe(null);
		receber({ ...INTEIRO, rev: 900 });
		expect(IdleConfig.revisaoDaConfig()).toBe(900);
	});

	it('a troca de personagem esquece a revisao', () => {
		receber(INTEIRO);
		IdleConfig.limparEstadoDoPersonagem();
		expect(IdleConfig.revisaoDaConfig()).toBe(null);
	});
});

describe('a janela de Grupo aplica o parcial (a costura, pelo fonte)', () => {
	const fonte = readFileSync(join(process.cwd(), 'src/UI/Components/GrupoIdle/GrupoIdle.js'), 'utf8').replace(/\r\n/g, '\n');

	function trecho(de, ate) {
		const i = fonte.indexOf(de);
		expect(i, `nao achei "${de}"`).toBeGreaterThan(-1);
		const j = fonte.indexOf(ate, i + de.length);
		expect(j, `nao achei "${ate}" depois de "${de}"`).toBeGreaterThan(i);
		return fonte.slice(i, j);
	}

	it('o hook passa pelo receptor ANTES de guardar o estado e avisar a HUD', () => {
		const hook = trecho('Network.hookPacket(PACKET.ZC.RAGIDLE_GRUPO, function (pkt) {', '\n});');
		const receptor = hook.indexOf('const recebido = _receptorDoPainel.receber(dados);');
		expect(receptor).toBeGreaterThan(-1);
		expect(hook.indexOf('if (recebido.ignorado) {\n\t\treturn;\n\t}')).toBeGreaterThan(receptor);
		expect(hook.indexOf('dados = recebido.dados;')).toBeGreaterThan(receptor);
		expect(hook.indexOf('GrupoIdle.estado = dados;')).toBeGreaterThan(hook.indexOf('dados = recebido.dados;'));
	});

	it('o receptor e o do GRUPO, e o inteiro e pedido com `grupo: null` + o pedido fixo', () => {
		const receptor = trecho('const _receptorDoPainel = criarReceptorDeJanela(', '\n});');
		expect(receptor).toContain('CAMPOS_DO_ENVIO_DO_GRUPO');
		expect(receptor).toContain("declararBaseNula('grupo', { Network, PACKET });");
		expect(receptor).toContain('Network.sendPacket(new PACKET.CZ.RAGIDLE_PEDIR_GRUPO());');
		expect(receptor.indexOf('declararBaseNula')).toBeLessThan(receptor.indexOf('RAGIDLE_PEDIR_GRUPO'));
	});

	it('a revisao vai a declaracao, e a troca de personagem a esquece', () => {
		expect(trecho('GrupoIdle.revisaoDoPainel = function', '};')).toContain('return _receptorDoPainel.revisao();');
		expect(trecho('GrupoIdle.limparEstadoDoPersonagem = function', '};')).toContain('_receptorDoPainel.esquecer();');
	});

	it('o MapEngine passa as duas janelas a declaracao', () => {
		const mapa = readFileSync(join(process.cwd(), 'src/Engine/MapEngine.js'), 'utf8');
		expect(mapa).toContain('declararBasesDasJanelas({ MissoesIdle, IdleSkills, IdleConfig, GrupoIdle, Network, PACKET });');
	});
});
