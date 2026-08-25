/**
 * BUSCA JANELADA FALHOU ≠ PERSONAGEM CONGELADO (D-607).
 *
 * O `PathFinding.search` herda do rAthena uma janela hash de 1024 posições
 * (`src/Utils/PathFinding.js:44`); colisão vira erro (`:168`) e um erro
 * aborta a busca inteira (`:400`). Quando isso acontecia dentro do `walkTo`
 * (`src/Renderer/Entity/EntityWalk.js`), o método saía calado com
 * `walk.total === 0` — o personagem ficava CONGELADO na tela enquanto o
 * servidor seguia caçando. Medido nos .gat reais: perna de 32 passos falhava
 * em 34%–54% das vezes.
 *
 * Este teste prende a rede de segurança: dado um `search` que devolve 0, o
 * `walkTo` NÃO pode terminar com `walk.total === 0` e a entidade parada — ele
 * cai para a linha reta (`searchLongIgnoreCellType`, PathFinding.js:450, o
 * mesmo mecanismo do falcão/wug) e ANDA, avisando no console.
 *
 * Para forçar o 0 sem mexer no módulo, o teste usa o outro caminho que também
 * devolve 0: um grid com uma coluna inteira bloqueada (mesma armação do caso
 * "returns 0 when path is blocked" em `tests/util/PathFinding.test.js`). O
 * ramo exercitado é o MESMO — `walkTo` não distingue por que o `search`
 * devolveu 0, e é exatamente essa indistinção que o fallback cobre.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// O walkTo nunca toca Altitude (só o walkProcess toca); o mock evita arrastar
// Mouse + shaders WebGL para dentro de um teste que não desenha nada.
vi.mock('Renderer/Map/Altitude.js', () => ({
	default: { getCellHeight: () => 0 }
}));

import PathFinding from 'Utils/PathFinding.js';
import EntityWalkInit from 'Renderer/Entity/EntityWalk.js';

const TYPE = {
	NONE: 1 << 0,
	WALKABLE: 1 << 1,
	SNIPABLE: 1 << 3
};

function criarGrid(width, height, fillType) {
	const cells = new Uint8Array(width * height);
	cells.fill(fillType);
	return { width, height, cells, types: TYPE };
}

/**
 * Entidade mínima com o que o walkTo lê: posição, ação, tipo e o quarteto de
 * métodos que o Init pendura. Construtor de verdade porque o walkTo consulta
 * `this.constructor.TYPE_PC` (EntityWalk.js) para decidir o fast-forward.
 */
function criarEntidade() {
	function EntidadeFake() {}
	EntidadeFake.TYPE_PC = 0;
	EntidadeFake.TYPE_DISGUISED = 1;
	EntidadeFake.TYPE_PET = 3;
	EntidadeFake.TYPE_HOM = 4;
	EntidadeFake.TYPE_MERC = 5;
	EntidadeFake.TYPE_FALCON = 6;
	EntidadeFake.TYPE_WUG = 7;

	const entidade = new EntidadeFake();
	entidade.ACTION = { IDLE: 0, WALK: 1, ATTACK: 2 };
	entidade.action = entidade.ACTION.IDLE;
	entidade.objecttype = EntidadeFake.TYPE_PC;
	entidade.position = new Float32Array([0, 2, 0]);
	entidade.direction = 0;
	entidade.headDir = 0;
	entidade.acoesPedidas = [];
	entidade.setAction = function (opt) {
		this.acoesPedidas.push(opt.action);
		this.action = opt.action;
	};

	EntityWalkInit.call(entidade);
	return entidade;
}

describe('walkTo quando PathFinding.search devolve 0 (D-607)', () => {
	let avisos;

	beforeEach(() => {
		avisos = vi.spyOn(console, 'warn').mockImplementation(() => {});
	});

	afterEach(() => {
		avisos.mockRestore();
	});

	it('cai para a linha reta e ANDA em vez de congelar', () => {
		const gat = criarGrid(5, 5, TYPE.WALKABLE | TYPE.SNIPABLE);
		// Coluna x=2 inteira bloqueada: o A* não tem rota, search devolve 0.
		for (let y = 0; y < 5; y++) {
			gat.cells[2 + y * 5] = TYPE.NONE;
		}
		PathFinding.setGat(gat);

		// Sanidade da armação: sem ela o teste passaria pelo caminho normal e
		// não provaria nada sobre o fallback (a lição da regra 6 do contrato).
		const fora = new Int16Array(PathFinding.MAX_WALKPATH * 2);
		expect(PathFinding.search(0, 2, 4, 2, 0, fora)).toBe(0);

		const entidade = criarEntidade();
		entidade.walkTo(0, 2, 4, 2, 0);

		// O comportamento antigo era walk.total === 0 e a entidade parada.
		expect(entidade.walk.total).toBeGreaterThan(0);
		expect(entidade.action).toBe(entidade.ACTION.WALK);

		// O caminho reto termina NO destino do pacote — origem e destino são
		// exatos, só o miolo é aproximado.
		expect(entidade.walk.path[entidade.walk.total - 2]).toBe(4);
		expect(entidade.walk.path[entidade.walk.total - 1]).toBe(2);

		// O ramo precisa continuar observável: se o teto de 10 passos do
		// servidor (D-607) for violado, é este aviso que conta a história.
		expect(avisos).toHaveBeenCalledTimes(1);
		expect(avisos.mock.calls[0][0]).toContain('linha reta');
	});

	it('não avisa nem muda nada quando a busca normal encontra caminho', () => {
		PathFinding.setGat(criarGrid(5, 5, TYPE.WALKABLE | TYPE.SNIPABLE));

		const entidade = criarEntidade();
		entidade.walkTo(0, 2, 4, 2, 0);

		expect(entidade.walk.total).toBeGreaterThan(0);
		expect(entidade.action).toBe(entidade.ACTION.WALK);
		expect(avisos).not.toHaveBeenCalled();
	});
});
