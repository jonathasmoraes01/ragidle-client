/**
 * A FORJA POR CLIQUE E TOQUE (lote 5 da comunidade, 14/10/2026).
 *
 * Ate aqui a pedra e a Estrelinha so entravam na janela de forja por ARRASTO
 * (HTML5 drag-and-drop), que nao existe no toque: no celular a forja elemental
 * era inalcancavel. E a tela dos opcionais aparecia tambem para o Ferro (que
 * nao os aceita), com tres slots vazios.
 *
 * O caso monta a janela de verdade (o componente, o DOM dele) com a mochila
 * falsa e mede: o Ferro sai direto; a Espada vai para os opcionais; o botao
 * de cada material poe no slot; o slot cheio devolve; a segunda pedra nao
 * cabe; o quarto material nao cabe; o pacote leva os tres ids.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mochila = vi.hoisted(() => ({ itens: [] }));

vi.mock('UI/Components/Inventory/Inventory.js', () => ({
	default: {
		getUI: () => ({
			getItemById: id => mochila.itens.find(i => i.ITID === id) ?? null,
			removeItem: (index, n) => {
				const it = mochila.itens.find(i => i.index === index);
				if (it) it.count -= n;
			},
			addItem: item => {
				const it = mochila.itens.find(i => i.index === item.index);
				if (it) it.count += item.count;
			}
		})
	}
}));

vi.mock('Core/Client.js', () => ({ default: { loadFile: () => undefined } }));
/* O CursorManager puxa Preferences/Graphics.js por import dinamico, que chega
   depois do fim do ambiente; ele nao e o que este arquivo mede (a mesma nota
   de filtroDoArmazemAbre.test.js). */
vi.mock('Renderer/Renderer.js', () => ({ default: { width: 1280, height: 720 } }));
vi.mock('Controls/MouseEventHandler.js', () => ({ default: { screen: { x: 0, y: 0 } } }));
vi.mock('Renderer/EntityManager.js', () => ({ default: { setOverEntity: vi.fn() } }));
vi.mock('UI/Scrollbar.js', () => ({ default: { applyDOMScrollbar: vi.fn() } }));
vi.mock('UI/CursorManager.js', () => ({ default: { ACTION: { DEFAULT: 0, CLICK: 1 }, setType: vi.fn(), getActualType: vi.fn(() => 0) } }));

vi.mock('DB/DBManager.js', () => ({
	default: {
		INTERFACE_PATH: '',
		getMessage: id => `msg${id}`,
		getItemInfo: id => ({
			identifiedResourceName: String(id),
			unidentifiedResourceName: String(id),
			identifiedDisplayName: `Item ${id}`,
			// O metalprocessitemlist do cliente oficial tem material para o FERRO e
			// para a ESPADA: e por isso que ele nao separa as duas receitas.
			processitemlist: id === 501 ? '' : '2 Iron'
		})
	}
}));

const { default: MakeItemSelection, aceitaMaterialOpcional } = await import(
	'UI/Components/MakeItemSelection/MakeItemSelection.js'
);

const ESTRELINHA = 1000;
const CORACAO_FLAMEJANTE = 994;
const GELO_MISTICO = 995;
const ESPADA = 1101;
const FERRO = 998;

let enviados;

function abrir(lista) {
	enviados = [];
	MakeItemSelection.append();
	MakeItemSelection.setList(lista.map(ITID => ({ ITID })));
	MakeItemSelection.onIndexSelected = (index, material) => {
		enviados.push({ index, material: material.map(m => m.ITID) });
	};
	return MakeItemSelection.getRoot();
}

const clicar = el => el.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

beforeEach(() => {
	mochila.itens = [
		{ index: 10, ITID: ESTRELINHA, count: 3, IsIdentified: 1 },
		{ index: 11, ITID: CORACAO_FLAMEJANTE, count: 1, IsIdentified: 1 },
		{ index: 12, ITID: GELO_MISTICO, count: 2, IsIdentified: 1 }
	];
});

afterEach(() => {
	MakeItemSelection.remove();
});

describe('quem tem a tela dos opcionais', () => {
	it('a arma sim; o minerio e a pocao nao', () => {
		expect(aceitaMaterialOpcional(ESPADA)).toBe(true);
		for (const id of [998, 999, 1000, 994, 995, 996, 997]) {
			expect(aceitaMaterialOpcional(id), `produto ${id}`).toBe(false);
		}
		expect(aceitaMaterialOpcional(501)).toBe(false);
	});

	it('o Ferro SAI DIRETO no Confirmar, sem a tela de slots vazios', () => {
		const root = abrir([FERRO]);
		clicar(root.querySelector('ui-button.ok'));
		expect(enviados).toEqual([{ index: FERRO, material: [] }]);
	});

	it('a Espada vai para os opcionais, e o bloco so aparece ai', () => {
		const root = abrir([ESPADA]);
		expect(root.querySelector('.opcionais').classList.contains('aberto')).toBe(false);
		clicar(root.querySelector('ui-button.ok'));
		expect(enviados).toEqual([]);
		expect(root.querySelector('.opcionais').classList.contains('aberto')).toBe(true);
		expect(root.querySelectorAll('.materials .vazio')).toHaveLength(3);
		// Um botao por material que a mochila tem: Estrelinha, Coracao e Gelo.
		const ids = [...root.querySelectorAll('.disponiveis .mat')].map(b => Number(b.getAttribute('data-itid')));
		expect(ids.sort()).toEqual([CORACAO_FLAMEJANTE, GELO_MISTICO, ESTRELINHA].sort());
	});
});

describe('clique (e toque, que dispara o mesmo click)', () => {
	it('o botao do material poe no slot, e o Confirmar manda os ids', () => {
		const root = abrir([ESPADA]);
		clicar(root.querySelector('ui-button.ok'));
		const botao = id => root.querySelector(`.disponiveis .mat[data-itid="${id}"]`);
		clicar(botao(CORACAO_FLAMEJANTE));
		clicar(botao(ESTRELINHA));
		clicar(botao(ESTRELINHA));
		expect(root.querySelectorAll('.materials .item')).toHaveLength(3);
		// A mochila desenhada perdeu o que foi para os slots.
		expect(mochila.itens.find(i => i.ITID === ESTRELINHA).count).toBe(1);
		expect(mochila.itens.find(i => i.ITID === CORACAO_FLAMEJANTE).count).toBe(0);
		clicar(root.querySelector('ui-button.ok'));
		expect(enviados).toEqual([{ index: ESPADA, material: [CORACAO_FLAMEJANTE, ESTRELINHA, ESTRELINHA] }]);
	});

	it('a SEGUNDA pedra nao cabe (a forja so le a primeira), e o botao dela apaga', () => {
		const root = abrir([ESPADA]);
		clicar(root.querySelector('ui-button.ok'));
		clicar(root.querySelector(`.disponiveis .mat[data-itid="${CORACAO_FLAMEJANTE}"]`));
		const gelo = root.querySelector(`.disponiveis .mat[data-itid="${GELO_MISTICO}"]`);
		expect(gelo.classList.contains('desligado')).toBe(true);
		clicar(gelo);
		expect(root.querySelectorAll('.materials .item')).toHaveLength(1);
		expect(mochila.itens.find(i => i.ITID === GELO_MISTICO).count).toBe(2);
	});

	it('o quarto material nao cabe: sao tres slots', () => {
		mochila.itens[0].count = 9;
		const root = abrir([ESPADA]);
		clicar(root.querySelector('ui-button.ok'));
		for (let i = 0; i < 4; i++) clicar(root.querySelector(`.disponiveis .mat[data-itid="${ESTRELINHA}"]`));
		expect(root.querySelectorAll('.materials .item')).toHaveLength(3);
		expect(mochila.itens[0].count).toBe(6);
	});

	it('o slot cheio devolve o material a mochila no clique', () => {
		const root = abrir([ESPADA]);
		clicar(root.querySelector('ui-button.ok'));
		clicar(root.querySelector(`.disponiveis .mat[data-itid="${ESTRELINHA}"]`));
		expect(mochila.itens[0].count).toBe(2);
		clicar(root.querySelector('.materials .item'));
		expect(root.querySelectorAll('.materials .item')).toHaveLength(0);
		expect(mochila.itens[0].count).toBe(3);
	});

	it('o Cancelar (e o ESC) devolve o que estava nos slots e avisa o servidor', () => {
		const root = abrir([ESPADA]);
		clicar(root.querySelector('ui-button.ok'));
		clicar(root.querySelector(`.disponiveis .mat[data-itid="${ESTRELINHA}"]`));
		MakeItemSelection.onKeyDown({ which: 27, key: 'Escape' });
		expect(mochila.itens[0].count).toBe(3);
		expect(enviados).toEqual([{ index: -1, material: [ESTRELINHA] }]);
	});

	it('sem nenhum material na mochila, a dica diz isso (e nao sobra caixa vazia sem explicacao)', () => {
		mochila.itens = [];
		const root = abrir([ESPADA]);
		clicar(root.querySelector('ui-button.ok'));
		expect(root.querySelectorAll('.disponiveis .mat')).toHaveLength(0);
		expect(root.querySelector('.dica').textContent).toContain('Sem Estrelinha');
	});
});
