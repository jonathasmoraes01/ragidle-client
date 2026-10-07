/**
 * O MAPLOADER MEDE AS FASES E PODE SER CANCELADO (D-2055).
 *
 * A barra "parada em 2%" e o `.gnd` pendente: o `.rsw` (1%) e o `.gat` (2%)
 * chegaram e o terceiro arquivo-base nao. Estes casos prendem: (1) a sequencia
 * de progresso que o jogador ve enquanto o `.gnd` nao chega; (2) a medida por
 * fase que viaja com o fim da carga; (3) a carga cancelada (o "Tentar de
 * novo") nao fala mais nada e aborta os pedidos dela.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ pedidos: [] }));

vi.mock('Core/FileManager.js', () => ({
	default: {
		filesAlias: {},
		load: vi.fn((nome, pronto, _args, opcoes) => {
			mocks.pedidos.push({ nome, pronto, opcoes });
		})
	}
}));

const { default: MapLoader } = await import('Loaders/MapLoader.js');

function mundo() {
	return {
		files: { gat: 'teste.gat', gnd: 'teste.gnd' },
		models: [],
		water: { level: 0, waveHeight: 0, type: 0 },
		compile: () => ({ mundo: true })
	};
}
function chao() {
	return {
		version: 1.7,
		textures: [],
		compile: () => ({ waterVertCount: 0, textures: [], chao: true })
	};
}
const altitude = { compile: () => ({ altitude: true }) };

/** Responde o pedido pendente de `nome` com `resultado` e `info`. */
function responder(trecho, resultado, info) {
	const i = mocks.pedidos.findIndex(p => p.nome.includes(trecho));
	expect(i, 'pedido de ' + trecho).toBeGreaterThan(-1);
	const [pedido] = mocks.pedidos.splice(i, 1);
	pedido.pronto(resultado, null, info);
	return pedido;
}

function novaCarga() {
	const map = new MapLoader();
	const eventos = { progresso: [], dados: [], fim: null, atividade: [] };
	map.onprogress = p => eventos.progresso.push(p);
	map.ondata = (tipo, dado) => eventos.dados.push(tipo);
	map.onload = (sucesso, erro, medida) => {
		eventos.fim = { sucesso, erro, medida };
	};
	map.onatividade = a => eventos.atividade.push(a);
	return { map, eventos };
}

beforeEach(() => {
	mocks.pedidos.length = 0;
});

describe('a carga do mapa no worker', () => {
	it('com o .gnd pendente a barra para em 2% (o relato de producao)', () => {
		const { map, eventos } = novaCarga();
		map.load('teste.rsw');
		responder('teste.rsw', mundo(), { origem: 'rede' });
		responder('teste.gat', altitude, { origem: 'rede' });
		expect(eventos.progresso).toEqual([1, 2]);
		expect(mocks.pedidos.map(p => p.nome)).toEqual(['data\\teste.gnd']);
		expect(eventos.dados).toEqual(['MAP_ALTITUDE']);
	});

	it('a carga inteira termina com a medida por fase e de onde cada arquivo veio', () => {
		const { map, eventos } = novaCarga();
		map.load('teste.rsw');
		responder('teste.rsw', mundo(), { origem: 'cache-http' });
		responder('teste.gat', altitude, { origem: 'cache-http' });
		responder('teste.gnd', chao(), { origem: 'rede', tentativas: 1, silencios: 1, bytes: 5372510 });
		expect(eventos.fim.sucesso).toBe(true);
		const m = eventos.fim.medida;
		expect(m).toMatchObject({ arquivos: 3, arquivosDoCache: 2, tentativas: 1, silencios: 1, bytes: 5372510, baseDoCache: false });
		for (const fase of ['faseRswMs', 'faseGatMs', 'faseGndMs', 'faseTexturasDoChaoMs', 'faseModelosMs', 'faseTexturasDosModelosMs']) {
			expect(typeof m[fase], fase).toBe('number');
		}
		expect(eventos.dados).toEqual(['MAP_ALTITUDE', 'MAP_WORLD', 'MAP_GROUND', 'MAP_MODELS']);
	});

	it('a falha de um arquivo-base termina a carga com a medida junto', () => {
		const { map, eventos } = novaCarga();
		map.load('teste.rsw');
		responder('teste.rsw', mundo(), { origem: 'rede' });
		responder('teste.gat', altitude, { origem: 'rede' });
		responder('teste.gnd', null, { origem: 'rede', falhou: true, tentativas: 3, silencios: 4 });
		expect(eventos.fim.sucesso).toBe(false);
		expect(eventos.fim.erro).toContain('teste.gnd');
		expect(eventos.fim.medida).toMatchObject({ falhas: 1, silencios: 4, tentativas: 3 });
	});

	it('os pedidos levam o sinal de cancelamento e repassam a atividade da rede', () => {
		const { map, eventos } = novaCarga();
		map.load('teste.rsw');
		const pedido = mocks.pedidos[0];
		expect(pedido.opcoes.sinal).toBeDefined();
		pedido.opcoes.aoReceber(1000, 4000);
		pedido.opcoes.aoTentarDeNovo(1);
		expect(eventos.atividade).toEqual([
			{ arquivo: 'data\\teste.rsw', recebidos: 1000, total: 4000 },
			{ arquivo: 'data\\teste.rsw', tentativa: 1 }
		]);
	});

	it('a carga CANCELADA aborta os pedidos e nao fala mais nada', () => {
		const { map, eventos } = novaCarga();
		map.load('teste.rsw');
		responder('teste.rsw', mundo(), { origem: 'rede' });
		responder('teste.gat', altitude, { origem: 'rede' });
		const pendente = mocks.pedidos[0];
		map.cancelar();
		expect(pendente.opcoes.sinal.aborted).toBe(true);
		const antes = { progresso: eventos.progresso.length, dados: eventos.dados.length };
		pendente.opcoes.aoReceber(10, 20);
		// Um chao com textura: a carga viva pediria a textura em seguida.
		const comTextura = chao();
		comTextura.compile = () => ({ waterVertCount: 0, textures: ['a.bmp'], chao: true });
		pendente.pronto(comTextura, null, { origem: 'rede' });
		expect(mocks.pedidos, 'a carga cancelada continuou baixando').toHaveLength(1);
		expect(eventos.progresso).toHaveLength(antes.progresso);
		expect(eventos.dados).toHaveLength(antes.dados);
		expect(eventos.atividade).toEqual([]);
		expect(eventos.fim).toBeNull();
	});

	it('a montagem que LANCA no worker termina a carga como falha, com o motivo, e aborta o resto (A3)', () => {
		const { map, eventos } = novaCarga();
		map.load('teste.rsw');
		responder('teste.rsw', mundo(), { origem: 'rede' });
		const quebrado = {
			compile: () => {
				throw new RangeError('Array buffer allocation failed');
			}
		};
		expect(() => responder('teste.gat', quebrado, { origem: 'rede' })).not.toThrow();
		expect(eventos.fim.sucesso).toBe(false);
		expect(eventos.fim.erro).toContain('teste.gat');
		expect(eventos.fim.erro).toContain('RangeError');
		expect(map.cancelada).toBe(true);
	});

	it('o postMessage que nao clona (o ondata lancando) tambem termina a carga (A3)', () => {
		const { map, eventos } = novaCarga();
		map.ondata = () => {
			throw Object.assign(new Error('could not be cloned'), { name: 'DataCloneError' });
		};
		map.load('teste.rsw');
		responder('teste.rsw', mundo(), { origem: 'rede' });
		responder('teste.gat', altitude, { origem: 'rede' });
		expect(eventos.fim).toMatchObject({ sucesso: false });
		expect(eventos.fim.erro).toContain('DataCloneError');
	});
});
