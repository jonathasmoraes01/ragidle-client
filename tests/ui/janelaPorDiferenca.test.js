/**
 * A CONFIG IDLE E A JANELA DE GRUPO POR DIFERENCA (07/10/2026, D-2077).
 *
 * O modulo puro (`UI/janelaPorDiferenca.js`): o inteiro guardado sem o que e
 * do envio, o parcial que vira o MESMO corpo do inteiro, o parcial que nao cai
 * e o receptor que pede o inteiro uma vez so. E a declaracao das bases da
 * entrada (`Engine/declaracaoDasBases.js`) com as duas chaves novas.
 *
 * O servidor que monta o parcial esta no repositorio do jogo
 * (`servidor/mapa/janela-por-diferenca.ts`); o teste dele importa ESTE modulo e
 * confere as duas pontas juntas.
 */
import { describe, expect, it } from 'vitest';
import {
	CAMPOS_DO_ENVIO_DA_CONFIG,
	CAMPOS_DO_ENVIO_DO_GRUPO,
	VERSAO_DO_PARCIAL_DE_JANELA,
	criarReceptorDeJanela,
	ehParcialDeJanela,
	receberEnvioDeJanela,
	revisaoGuardada
} from 'UI/janelaPorDiferenca.js';
import { declararBaseNula, declararBasesDasJanelas } from 'Engine/declaracaoDasBases.js';

const INTEIRO = {
	v: 1,
	problemas: [],
	config: { cacaAutomatica: true, pocaoDeHp: { usarCom: 50 } },
	contexto: { mapa: 'prt_fild08', faltamMsParaDormir: 1000, lista: [1, 2, 3] },
	rev: 10
};

function parcial(de, rev, trocas, envio = { problemas: [] }) {
	return { v: VERSAO_DO_PARCIAL_DE_JANELA, parcial: true, de, rev, trocas, ...envio };
}

describe('receberEnvioDeJanela', () => {
	it('o inteiro passa como veio, e o guardado e o estado sem o envio e sem `rev`', () => {
		const r = receberEnvioDeJanela(null, INTEIRO, CAMPOS_DO_ENVIO_DA_CONFIG);
		expect(r.pedirInteiro).toBe(false);
		expect(r.dados).toBe(INTEIRO);
		expect(r.guardado.rev).toBe(10);
		expect(r.guardado.estado).toEqual({ v: 1, config: INTEIRO.config, contexto: INTEIRO.contexto });
		// Uma copia: a janela pode mexer no que recebeu sem estragar a base.
		r.dados.contexto.lista.push(4);
		expect(r.guardado.estado.contexto.lista).toEqual([1, 2, 3]);
		INTEIRO.contexto.lista.pop();
	});

	it('o inteiro do servidor antigo (sem `rev`) guarda revisao nula', () => {
		const { rev: _rev, ...semRev } = INTEIRO;
		const r = receberEnvioDeJanela(null, semRev, CAMPOS_DO_ENVIO_DA_CONFIG);
		expect(r.guardado.rev).toBe(null);
		expect(revisaoGuardada(r.guardado)).toBe(null);
		expect(revisaoGuardada({ rev: '3', estado: {} })).toBe(null);
		expect(revisaoGuardada(null)).toBe(null);
	});

	it('o parcial sobre a revisao que temos vira o corpo do inteiro, com o envio e a `rev` nova', () => {
		const g = receberEnvioDeJanela(null, INTEIRO, CAMPOS_DO_ENVIO_DA_CONFIG).guardado;
		const p = parcial(10, 11, [[['contexto', 'faltamMsParaDormir'], 900], [['config', 'pocaoDeHp', 'usarCom'], 37]], { problemas: [], aplicado: true });
		const r = receberEnvioDeJanela(g, p, CAMPOS_DO_ENVIO_DA_CONFIG);
		expect(r.pedirInteiro).toBe(false);
		expect(r.dados).toEqual({
			v: 1,
			config: { cacaAutomatica: true, pocaoDeHp: { usarCom: 37 } },
			contexto: { mapa: 'prt_fild08', faltamMsParaDormir: 900, lista: [1, 2, 3] },
			problemas: [],
			aplicado: true,
			rev: 11
		});
		expect(r.guardado.rev).toBe(11);
		expect(r.guardado.estado).not.toHaveProperty('aplicado');
		expect(r.guardado.estado).not.toHaveProperty('rev');
		// O de antes fica intacto.
		expect(g.estado.contexto.faltamMsParaDormir).toBe(1000);
	});

	it('o `aplicado` ausente no parcial fica ausente nos dados (a janela le a PRESENCA)', () => {
		const g = receberEnvioDeJanela(null, INTEIRO, CAMPOS_DO_ENVIO_DA_CONFIG).guardado;
		const r = receberEnvioDeJanela(g, parcial(10, 11, []), CAMPOS_DO_ENVIO_DA_CONFIG);
		expect(Object.prototype.hasOwnProperty.call(r.dados, 'aplicado')).toBe(false);
		expect(r.dados.problemas).toEqual([]);
	});

	it('o recado e os problemas do grupo vem do envio', () => {
		const grupo = { v: 1, grupo: { membros: [{ hp: 9 }] }, problemas: [], recado: null, rev: 5 };
		const g = receberEnvioDeJanela(null, grupo, CAMPOS_DO_ENVIO_DO_GRUPO).guardado;
		expect(g.estado).toEqual({ v: 1, grupo: { membros: [{ hp: 9 }] } });
		const r = receberEnvioDeJanela(g, parcial(5, 6, [[['grupo', 'membros', 0, 'hp'], 7]], { problemas: ['x'], recado: 'oi' }), CAMPOS_DO_ENVIO_DO_GRUPO);
		expect(r.dados).toEqual({ v: 1, grupo: { membros: [{ hp: 7 }] }, problemas: ['x'], recado: 'oi', rev: 6 });
	});

	it('o parcial que nao cai pede o inteiro e nao mexe no guardado', () => {
		const g = receberEnvioDeJanela(null, INTEIRO, CAMPOS_DO_ENVIO_DA_CONFIG).guardado;
		for (const [guardado, p] of [
			[null, parcial(10, 11, [])],
			[g, parcial(9, 11, [])],
			[{ rev: null, estado: {} }, parcial(10, 11, [])],
			[g, { ...parcial(10, 11, []), trocas: 'x' }],
			[g, { ...parcial(10, 11, []), trocas: null }],
			[{ rev: null, estado: {} }, parcial(null, 11, [])],
			[g, parcial(10, 11, [[['nada', 'aqui'], 1]])]
		]) {
			const r = receberEnvioDeJanela(guardado, p, CAMPOS_DO_ENVIO_DA_CONFIG);
			expect(r.pedirInteiro).toBe(true);
			expect(r.dados).toBe(null);
			expect(r.guardado).toBe(guardado);
		}
	});

	it('so o `v: 2` com `parcial: true` e parcial', () => {
		expect(ehParcialDeJanela(parcial(1, 2, []))).toBe(true);
		expect(ehParcialDeJanela({ ...parcial(1, 2, []), v: 1 })).toBe(false);
		expect(ehParcialDeJanela({ ...parcial(1, 2, []), parcial: 'lista' })).toBe(false);
		expect(ehParcialDeJanela(null)).toBe(false);
	});
});

describe('o receptor de uma janela', () => {
	it('pede o inteiro UMA vez, ignora os parciais ate ele chegar e declara `null` enquanto espera', () => {
		let pedidos = 0;
		const r = criarReceptorDeJanela(CAMPOS_DO_ENVIO_DA_CONFIG, () => pedidos++);
		expect(r.revisao()).toBe(null);
		expect(r.receber(INTEIRO)).toEqual({ ignorado: false, dados: INTEIRO });
		expect(r.revisao()).toBe(10);
		const bom = r.receber(parcial(10, 11, [[['contexto', 'mapa'], 'prontera']]));
		expect(bom.ignorado).toBe(false);
		expect(bom.dados.contexto.mapa).toBe('prontera');
		expect(r.revisao()).toBe(11);
		expect(r.receber(parcial(99, 100, [])).ignorado).toBe(true);
		expect(pedidos).toBe(1);
		expect(r.revisao()).toBe(null);
		expect(r.receber(parcial(100, 101, [])).ignorado).toBe(true);
		expect(pedidos).toBe(1);
		// O inteiro chega: volta a aplicar, e um proximo parcial ruim pede de novo.
		expect(r.receber({ ...INTEIRO, rev: 200 }).ignorado).toBe(false);
		expect(r.revisao()).toBe(200);
		expect(r.receber(parcial(1, 2, [])).ignorado).toBe(true);
		expect(pedidos).toBe(2);
	});

	it('esquecer volta ao zero (a troca de personagem)', () => {
		let pedidos = 0;
		const r = criarReceptorDeJanela(CAMPOS_DO_ENVIO_DO_GRUPO, () => pedidos++);
		r.receber({ v: 1, grupo: null, problemas: [], recado: null, rev: 3 });
		r.receber(parcial(77, 78, []));
		expect(pedidos).toBe(1);
		r.esquecer();
		expect(r.revisao()).toBe(null);
		r.receber(parcial(3, 4, []));
		expect(pedidos).toBe(2);
	});
});

describe('a declaracao das bases leva a config e o grupo (D-2077)', () => {
	function fio() {
		const enviados = [];
		function RAGIDLE_MISSAO_ACAO() {}
		return { enviados, Network: { sendPacket: p => enviados.push(p) }, PACKET: { CZ: { RAGIDLE_MISSAO_ACAO } } };
	}

	it('com as duas janelas, as duas chaves vao com a revisao de cada uma', () => {
		const f = fio();
		declararBasesDasJanelas({
			MissoesIdle: { revisaoDaLista: () => 1 },
			IdleSkills: { revisaoDaArvore: () => 2 },
			IdleConfig: { revisaoDaConfig: () => 3 },
			GrupoIdle: { revisaoDoPainel: () => 4 },
			Network: f.Network,
			PACKET: f.PACKET
		});
		expect(JSON.parse(f.enviados[0].json)).toEqual({ acao: 'bases', missoes: 1, skills: 2, config: 3, grupo: 4 });
	});

	it('janela sem revisao (ou sem o metodo) declara `null` - declarar e o que diz que aplica o parcial', () => {
		const f = fio();
		declararBasesDasJanelas({ MissoesIdle: {}, IdleSkills: {}, IdleConfig: { revisaoDaConfig: () => null }, GrupoIdle: {}, Network: f.Network, PACKET: f.PACKET });
		expect(JSON.parse(f.enviados[0].json)).toEqual({ acao: 'bases', missoes: null, skills: null, config: null, grupo: null });
	});

	it('revisao que nao e numero vai `null`', () => {
		const f = fio();
		declararBasesDasJanelas({ MissoesIdle: {}, IdleSkills: {}, IdleConfig: { revisaoDaConfig: () => '3' }, GrupoIdle: { revisaoDoPainel: () => 4 }, Network: f.Network, PACKET: f.PACKET });
		expect(JSON.parse(f.enviados[0].json)).toMatchObject({ config: null, grupo: 4 });
	});

	it('o pedido do inteiro declara `null` SO para a janela dele', () => {
		const f = fio();
		declararBaseNula('grupo', f);
		expect(f.enviados).toHaveLength(1);
		expect(f.enviados[0]).toBeInstanceOf(f.PACKET.CZ.RAGIDLE_MISSAO_ACAO);
		expect(JSON.parse(f.enviados[0].json)).toEqual({ acao: 'bases', grupo: null });
	});
});
