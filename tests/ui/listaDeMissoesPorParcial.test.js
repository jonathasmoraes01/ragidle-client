/**
 * A JANELA DE MISSOES APLICA O PARCIAL DE LISTA (07/10/2026, D-2071).
 *
 * A janela de verdade (o harness de `missoesConcluidasOcultas.test.js`), com a
 * rede falsa. O que se mede e o que sai para a rede e o que a janela guarda:
 *  - o servidor que NAO numera (sem `rev`) segue no 0x0fec, e a revisao e nula;
 *  - o que numera: abrir pede pelo 0x0feb com `{acao: 'pedir', base}`;
 *  - o parcial `v: 4` sobre a revisao certa vira a lista de agora; sobre a
 *    errada, pede a inteira UMA vez, e os parciais seguintes esperam por ela;
 *  - o parcial de progresso com `de` errado pede a inteira; sem `de` (o
 *    servidor antigo), cai como sempre;
 *  - a revisao que vai na declaracao da entrada e nula sem lista e com a
 *    inteira pedida; a troca de personagem a esquece.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ enviados: [], ganchos: new Map() }));

vi.mock('Network/NetworkManager.js', () => ({
	default: {
		sendPacket: pkt => mocks.enviados.push(pkt),
		hookPacket: (id, fn) => mocks.ganchos.set(id, fn)
	}
}));
vi.mock('Renderer/Renderer.js', () => ({
	default: { render: vi.fn(), stop: vi.fn(), width: 1280, height: 720 }
}));
vi.mock('UI/UIManager.js', () => ({ default: { showErrorBox: vi.fn(), addComponent: c => c } }));
vi.mock('UI/Components/ChatBox/ChatBox.js', () => ({
	default: { addText: vi.fn(), TYPE: { ERROR: 1 }, FILTER: { PUBLIC_LOG: 1 } }
}));

function missao(id, estado, progresso, extra = {}) {
	return {
		id,
		tipo: 'principal',
		titulo: 'Missao ' + id,
		estado,
		cooldownS: 0,
		pronta: false,
		objetivos: progresso.map((p, i) => ({ id: id + i, descricao: 'x', progresso: p, alvo: 9 })),
		...extra
	};
}

let MissoesIdle;
let PACKET;
let receber;

async function montar() {
	const { default: html } = await import('UI/Components/MissoesIdle/MissoesIdle.html?raw');
	({ default: MissoesIdle } = await import('UI/Components/MissoesIdle/MissoesIdle.js'));
	({ default: PACKET } = await import('Network/PacketStructure.js'));
	MissoesIdle._host = document.createElement('div');
	MissoesIdle._host.innerHTML = html;
	MissoesIdle._shadow = null;
	MissoesIdle.draggable = () => {};
	MissoesIdle.focus = () => {};
	MissoesIdle.init();
	receber = corpo => mocks.ganchos.get(PACKET.ZC.RAGIDLE_MISSOES)({ json: JSON.stringify(corpo) });
}

/** Os pedidos que a janela mandou, na forma `{tipo, corpo}`. */
function pedidos() {
	return mocks.enviados.map(p => ({
		tipo: p instanceof PACKET.CZ.RAGIDLE_MISSAO_ACAO ? 'acao' : p instanceof PACKET.CZ.RAGIDLE_PEDIR_MISSOES ? '0x0fec' : '?',
		corpo: p.json ? JSON.parse(p.json) : null
	}));
}

function abrir() {
	const win = MissoesIdle._host.querySelector('.mi-window');
	win.classList.remove('is-open');
	MissoesIdle.toggle();
}

const EXEC = { aceitas: [], maximo: 3 };

describe('a lista de missoes por diferenca (D-2071)', () => {
	beforeEach(async () => {
		localStorage.clear();
		vi.resetModules();
		mocks.enviados.length = 0;
		mocks.ganchos.clear();
		await montar();
	});

	it('o servidor que nao numera: a revisao e nula e abrir vai pelo 0x0fec', () => {
		receber({ v: 1, missoes: [missao('a', 'disponivel', [0])], execucao: EXEC, codexComNovidade: false });
		expect(MissoesIdle.revisaoDaLista()).toBeNull();
		abrir();
		expect(pedidos()).toEqual([{ tipo: '0x0fec', corpo: null }]);
	});

	it('o que numera: abrir pede pelo verbo com a revisao', () => {
		receber({ v: 1, missoes: [missao('a', 'disponivel', [0])], execucao: EXEC, codexComNovidade: false, rev: 70 });
		expect(MissoesIdle.revisaoDaLista()).toBe(70);
		abrir();
		expect(pedidos()).toEqual([{ tipo: 'acao', corpo: { acao: 'pedir', base: 70 } }]);
	});

	it('sem lista nenhuma, abrir vai pelo 0x0fec mesmo com servidor novo (nao ha revisao a dar)', () => {
		expect(MissoesIdle.revisaoDaLista()).toBeNull();
		abrir();
		expect(pedidos()).toEqual([{ tipo: '0x0fec', corpo: null }]);
	});

	it('o parcial de lista sobre a revisao certa vira a lista de agora, com os campos e o rastreador', () => {
		receber({ v: 1, missoes: [missao('a', 'disponivel', [0]), missao('b', 'disponivel', [2])], execucao: EXEC, codexComNovidade: false, rev: 70 });
		const aceita = missao('a', 'em-andamento', [1], { aceita: true });
		receber({
			v: 4,
			parcial: 'lista',
			missoes: [aceita],
			progressos: { b: [3] },
			prontas: [],
			campos: { execucao: { aceitas: ['a'], maximo: 3 } },
			codexRastreado: [{ id: 'z', titulo: 'Z', abates: 1, alvo: 2 }],
			de: 70,
			rev: 71
		});
		expect(MissoesIdle.missoes.map(m => [m.id, m.estado, m.objetivos[0].progresso])).toEqual([
			['a', 'em-andamento', 1],
			['b', 'disponivel', 3]
		]);
		expect(MissoesIdle.execucao).toEqual({ aceitas: ['a'], maximo: 3 });
		expect(MissoesIdle.revisaoDaLista()).toBe(71);
		expect(pedidos()).toEqual([]);
	});

	it('o parcial sobre a revisao ERRADA pede a inteira uma vez so, e os seguintes esperam por ela', () => {
		receber({ v: 1, missoes: [missao('a', 'disponivel', [0])], execucao: EXEC, codexComNovidade: false, rev: 70 });
		receber({ v: 4, parcial: 'lista', missoes: [missao('a', 'em-andamento', [0])], prontas: [], de: 69, rev: 72 });
		receber({ v: 3, parcial: 'progresso', progressos: { a: [5] }, prontas: [], de: 72, rev: 73 });
		receber({ v: 4, parcial: 'lista', prontas: [], de: 73, rev: 74 });
		// Nem o parcial que CAIRIA sobre a revisao daqui: com a inteira no ar, so ela conta.
		receber({ v: 4, parcial: 'lista', missoes: [missao('a', 'em-andamento', [9])], prontas: [], de: 70, rev: 75 });
		expect(pedidos()).toEqual([{ tipo: 'acao', corpo: { acao: 'pedir', base: null } }]);
		expect(MissoesIdle.missoes[0].estado).toBe('disponivel');
		expect(MissoesIdle.missoes[0].objetivos[0].progresso).toBe(0);
		// Com a inteira pedida, a lista daqui nao vale como base na entrada.
		expect(MissoesIdle.revisaoDaLista()).toBeNull();
		// A inteira chega: tudo volta.
		receber({ v: 1, missoes: [missao('a', 'em-andamento', [5])], execucao: EXEC, codexComNovidade: false, rev: 76 });
		expect(MissoesIdle.revisaoDaLista()).toBe(76);
		receber({ v: 3, parcial: 'progresso', progressos: { a: [6] }, prontas: [], de: 76, rev: 77 });
		expect(MissoesIdle.missoes[0].objetivos[0].progresso).toBe(6);
		expect(MissoesIdle.revisaoDaLista()).toBe(77);
	});

	it('o parcial que nao casa com a lista (missao que nao existe) pede a inteira', () => {
		receber({ v: 1, missoes: [missao('a', 'disponivel', [0])], execucao: EXEC, codexComNovidade: false, rev: 70 });
		receber({ v: 4, parcial: 'lista', missoes: [missao('x', 'disponivel', [0])], prontas: [], de: 70, rev: 71 });
		expect(pedidos()).toEqual([{ tipo: 'acao', corpo: { acao: 'pedir', base: null } }]);
		expect(MissoesIdle.missoes.map(m => m.id)).toEqual(['a']);
	});

	it('o parcial de progresso com `de` errado pede a inteira; sem `de` (o servidor antigo) cai como sempre', () => {
		receber({ v: 1, missoes: [missao('a', 'disponivel', [0])], execucao: EXEC, codexComNovidade: false });
		receber({ v: 3, parcial: 'progresso', progressos: { a: [4] }, prontas: [] });
		expect(MissoesIdle.missoes[0].objetivos[0].progresso).toBe(4);
		expect(pedidos()).toEqual([]);
		receber({ v: 1, missoes: [missao('a', 'disponivel', [0])], execucao: EXEC, codexComNovidade: false, rev: 80 });
		receber({ v: 3, parcial: 'progresso', progressos: { a: [7] }, prontas: [], de: 79, rev: 81 });
		expect(MissoesIdle.missoes[0].objetivos[0].progresso).toBe(0);
		expect(pedidos()).toEqual([{ tipo: 'acao', corpo: { acao: 'pedir', base: null } }]);
	});

	it('o parcial do rastreador com `de` certo anda a revisao; com `de` errado, pede a inteira', () => {
		receber({ v: 1, missoes: [missao('a', 'disponivel', [0])], execucao: EXEC, codexComNovidade: false, rev: 80 });
		receber({ v: 2, parcial: 'codexRastreado', codexRastreado: [], de: 80, rev: 81 });
		expect(MissoesIdle.revisaoDaLista()).toBe(81);
		receber({ v: 2, parcial: 'codexRastreado', codexRastreado: [], de: 90, rev: 91 });
		expect(pedidos()).toEqual([{ tipo: 'acao', corpo: { acao: 'pedir', base: null } }]);
	});

	it('o parcial antes de qualquer lista pede a inteira (o servidor que numera)', () => {
		receber({ v: 4, parcial: 'lista', prontas: [], de: 1, rev: 2 });
		expect(pedidos()).toEqual([{ tipo: '0x0fec', corpo: null }]);
	});

	it('a troca de personagem esquece a revisao (e que o servidor numera)', () => {
		receber({ v: 1, missoes: [missao('a', 'disponivel', [0])], execucao: EXEC, codexComNovidade: false, rev: 70 });
		MissoesIdle.limparEstadoDoPersonagem();
		expect(MissoesIdle.revisaoDaLista()).toBeNull();
		abrir();
		expect(pedidos()).toEqual([{ tipo: '0x0fec', corpo: null }]);
		// O parcial do personagem novo antes da lista dele: a inteira pelo 0x0fec.
		receber({ v: 3, parcial: 'progresso', progressos: {}, prontas: [], de: 5, rev: 6 });
		expect(pedidos()).toEqual([
			{ tipo: '0x0fec', corpo: null },
			{ tipo: '0x0fec', corpo: null }
		]);
	});

	it('o servidor antigo: o progresso que nao casa pede a inteira UMA vez so', () => {
		receber({ v: 1, missoes: [missao('a', 'disponivel', [0])], execucao: EXEC, codexComNovidade: false });
		receber({ v: 3, parcial: 'progresso', progressos: { a: [1, 2] }, prontas: [] });
		receber({ v: 3, parcial: 'progresso', progressos: { a: [1, 2] }, prontas: [] });
		expect(pedidos()).toEqual([{ tipo: '0x0fec', corpo: null }]);
	});
});
