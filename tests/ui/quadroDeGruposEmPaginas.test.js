/**
 * O QUADRO DE GRUPOS EM PAGINAS (07/10/2026, D-2071) - a janela de verdade
 * (`LFGIdle.js`) com a rede falsa. O quadro nao tem teto de grupos e, acima
 * do teto de um pacote, o servidor o manda em paginas: a lista so troca na
 * ultima, inteira. Abaixo do teto, o corpo de sempre troca na hora.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ ganchos: new Map() }));

vi.mock('Network/NetworkManager.js', () => ({
	default: { sendPacket: vi.fn(), hookPacket: (id, fn) => mocks.ganchos.set(id, fn) }
}));
vi.mock('Renderer/Renderer.js', () => ({
	default: { render: vi.fn(), stop: vi.fn(), width: 1280, height: 720 }
}));
vi.mock('UI/UIManager.js', () => ({ default: { showErrorBox: vi.fn(), addComponent: c => c } }));
// Os icones de classe vem do GRF por um Worker que o jsdom nao tem.
vi.mock('Core/Client.js', () => ({ default: { loadFile: vi.fn() } }));
vi.mock('UI/Components/ChatBox/ChatBox.js', () => ({
	default: { addText: vi.fn(), TYPE: { ERROR: 1 }, FILTER: { PUBLIC_LOG: 1 } }
}));

let LFGIdle;
let receber;

function grupo(id) {
	return {
		grupoId: id,
		nome: 'Grupo ' + id,
		liderNome: 'Lider' + id,
		liderClasse: 'Knight',
		liderNivel: 50,
		nivelRecomendado: 50,
		faixa: { min: 40, max: 60 },
		mapa: 'prt_fild08',
		mapaRotulo: 'Campos',
		membros: [{ nome: 'Lider' + id, classe: 'Knight', nivel: 50, ehLider: true }],
		vagas: 9,
		limite: 10,
		temSenha: false,
		privado: false,
		liderOnline: true,
		podeEntrar: true,
		motivo: null,
		recusa: null
	};
}

describe('o quadro de grupos em paginas (D-2071)', () => {
	beforeEach(async () => {
		vi.resetModules();
		mocks.ganchos.clear();
		const { default: html } = await import('UI/Components/LFGIdle/LFGIdle.html?raw');
		({ default: LFGIdle } = await import('UI/Components/LFGIdle/LFGIdle.js'));
		const { default: PACKET } = await import('Network/PacketStructure.js');
		LFGIdle._host = document.createElement('div');
		LFGIdle._host.innerHTML = html;
		LFGIdle._shadow = null;
		LFGIdle.draggable = () => {};
		receber = corpo => mocks.ganchos.get(PACKET.ZC.RAGIDLE_LFG_LISTA)({ json: JSON.stringify(corpo) });
	});

	it('o corpo de sempre (sem paginas) troca a lista na hora', () => {
		receber({ v: 1, meu: null, grupos: [grupo(1), grupo(2)] });
		expect(LFGIdle.grupos.map(g => g.grupoId)).toEqual([1, 2]);
	});

	it('as paginas: nada muda ate a ultima, e entao a lista inteira, na ordem', () => {
		receber({ v: 1, meu: null, grupos: [grupo(1)] });
		receber({ v: 1, meu: { grupoId: 3, souLider: true }, grupos: [grupo(3), grupo(4)], parte: 1, partes: 2 });
		expect(LFGIdle.grupos.map(g => g.grupoId), 'a primeira pagina trocou a lista').toEqual([1]);
		receber({ v: 1, meu: { grupoId: 3, souLider: true }, grupos: [grupo(5)], parte: 2, partes: 2 });
		expect(LFGIdle.grupos.map(g => g.grupoId)).toEqual([3, 4, 5]);
		expect(LFGIdle.meu).toEqual({ grupoId: 3, souLider: true });
	});
});
