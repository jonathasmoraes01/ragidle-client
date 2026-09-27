/**
 * O FLUXO DO "IR AO MAPA" (26/09/2026, pedido do dono).
 *
 * As DECISOES (ir direto ou perguntar, o que o cartao promete) sao puras e
 * medidas com mutacao do lado do servidor (`servidor/mapa/onde-cai-na-janela.
 * test.ts`, bateria `onde-cai-na-janela`). Este arquivo mede a COSTURA que
 * aquele nao alcanca: o pedido que sai, a resposta que so vale para o clique
 * certo, o modal que nasce DENTRO da janela que pediu, e os tres botoes dele
 * fazendo o que dizem — executados em jsdom, com clique de verdade.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('Network/NetworkManager.js', () => ({
	default: { sendPacket: vi.fn(), hookPacket: vi.fn() }
}));
vi.mock('Network/PacketStructure.js', () => ({
	default: {
		CZ: {
			RAGIDLE_MISSAO_ACAO: class {
				constructor() {
					this.json = '';
				}
			}
		}
	}
}));
const abrirComBusca = vi.fn();
vi.mock('UI/UIManager.js', () => ({
	default: { getComponent: nome => (nome === 'HuntMap' ? { abrirComBusca } : null) }
}));

let fluxo;
let Network;

beforeEach(async () => {
	vi.resetModules();
	abrirComBusca.mockClear();
	fluxo = await import('UI/Components/MissoesIdle/escolhaDeMapa.js');
	Network = (await import('Network/NetworkManager.js')).default;
	Network.sendPacket.mockClear();
});

/** Uma janela de mentira: um container com `position: relative` e um contador de fechamentos. */
function janela() {
	const container = document.createElement('div');
	container.id = 'Janela';
	document.body.appendChild(container);
	const j = { fechou: 0, container: () => container, fecharJanela: () => (j.fechou += 1) };
	return j;
}

function mapa(nome, extra = {}) {
	return {
		mapa: nome,
		rotulo: nome.toUpperCase(),
		nivelQueAbre: 1,
		monstros: [{ nome: 'Poring', chanceEmPorcento: 70 }],
		abatesPorUnidade: 2,
		...extra
	};
}

function lista(mapas, extra = {}) {
	return { itemId: 909, nomeDoItem: 'Jellopy', missaoId: 'geleia', mapaAtual: 'prontera', nivel: 20, total: mapas.length, mapas, ...extra };
}

/** O JSON de cada pacote enviado, na ordem. */
function enviados() {
	return Network.sendPacket.mock.calls.map(([pkt]) => JSON.parse(pkt.json));
}

function clicar(el) {
	el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('o pedido e a resposta', () => {
	it('o clique pede ao servidor os mapas do item, com a missao junto', () => {
		fluxo.pedirOndeCai('909', 'geleia', janela());
		expect(enviados()).toEqual([{ acao: 'onde-cai', id: 'geleia', itemId: 909 }]);
	});

	it('id de item que nao e numero nao vira pedido', () => {
		fluxo.pedirOndeCai('abc', 'geleia', janela());
		expect(enviados()).toEqual([]);
	});

	it('uma lista de OUTRO item nao abre nada — o pacote e empurrado a toda hora', () => {
		const j = janela();
		fluxo.pedirOndeCai(909, 'geleia', j);
		expect(fluxo.receberOndeCai(lista([mapa('a'), mapa('b')], { itemId: 7 }))).toBe(false);
		expect(j.container().querySelector('.oc-modal')).toBeNull();
	});

	it('sem pedido em voo, a lista nao reabre a escolha sozinha', () => {
		expect(fluxo.receberOndeCai(lista([mapa('a'), mapa('b')]))).toBe(false);
	});

	it('a resposta so vale uma vez: a segunda chegada do mesmo item e ignorada', () => {
		const j = janela();
		fluxo.pedirOndeCai(909, 'geleia', j);
		expect(fluxo.receberOndeCai(lista([mapa('a'), mapa('b')]))).toBe(true);
		expect(fluxo.receberOndeCai(lista([mapa('a'), mapa('b')]))).toBe(false);
	});
});

describe('um mapa so: vai direto', () => {
	it('manda a viagem, fecha a janela e nao abre escolha nenhuma', () => {
		const j = janela();
		fluxo.pedirOndeCai(909, 'geleia', j);
		fluxo.receberOndeCai(lista([mapa('prt_fild08')]));
		expect(enviados()[1]).toEqual({ acao: 'ir-para-mapa', id: 'geleia', mapa: 'prt_fild08' });
		expect(j.fechou).toBe(1);
		expect(j.container().querySelector('.oc-modal:not([hidden])')).toBeNull();
	});
});

describe('mais de um mapa: a escolha', () => {
	function abrir(j = janela(), mapas = [mapa('prt_fild08'), mapa('pay_fild01'), mapa('gl_church', { nivelQueAbre: 60 })]) {
		fluxo.pedirOndeCai(909, 'geleia', j);
		fluxo.receberOndeCai(lista(mapas));
		return j;
	}

	it('o modal nasce DENTRO da janela que pediu, visivel, com o nome do item no titulo', () => {
		const j = abrir();
		const modal = j.container().querySelector('.oc-modal');
		expect(modal).not.toBeNull();
		expect(modal.hidden).toBe(false);
		expect(modal.querySelector('.oc-modal-titulo').textContent).toBe('Onde farmar: Jellopy');
		expect(modal.querySelectorAll('.oc-escolha-mapa')).toHaveLength(3);
		expect(fluxo.escolhaAberta(j)).toBe(true);
	});

	it('o "Ir" de um cartao viaja para AQUELE mapa, com a missao, e fecha tudo', () => {
		const j = abrir();
		const ir = j.container().querySelector('[data-ir-mapa="pay_fild01"]');
		clicar(ir);
		expect(enviados().at(-1)).toEqual({ acao: 'ir-para-mapa', id: 'geleia', mapa: 'pay_fild01' });
		expect(j.container().querySelector('.oc-modal').hidden).toBe(true);
		expect(j.fechou).toBe(1);
	});

	it('o mapa trancado nao tem "Ir" — o cartao diz por que', () => {
		const j = abrir();
		expect(j.container().querySelector('[data-ir-mapa="gl_church"]')).toBeNull();
		expect(j.container().textContent).toContain('Abre no Nv. 60');
	});

	it('o fundo e o "X" fecham so a escolha, sem viajar e sem fechar a janela', () => {
		const j = abrir();
		clicar(j.container().querySelector('.oc-modal-fundo'));
		expect(j.container().querySelector('.oc-modal').hidden).toBe(true);
		expect(j.fechou).toBe(0);
		expect(enviados()).toHaveLength(1);

		abrir(j);
		clicar(j.container().querySelector('.oc-modal-fechar'));
		expect(j.container().querySelector('.oc-modal').hidden).toBe(true);
		expect(j.fechou).toBe(0);
	});

	it('"Ver todos no Mapa de Caca" abre o Mapa de Caca buscando o NOME do item', () => {
		const j = abrir();
		clicar(j.container().querySelector('[data-ver-no-mapa-de-caca]'));
		expect(abrirComBusca).toHaveBeenCalledWith('Jellopy');
		expect(j.fechou).toBe(1);
		expect(j.container().querySelector('.oc-modal').hidden).toBe(true);
	});

	it('reabrir reusa o MESMO modal — nao empilha um por pedido', () => {
		const j = abrir();
		clicar(j.container().querySelector('.oc-modal-fechar'));
		abrir(j);
		expect(j.container().querySelectorAll('.oc-modal')).toHaveLength(1);
	});

	it('fechar OUTRA janela nao fecha a escolha desta', () => {
		const j = abrir();
		fluxo.fecharEscolha(janela());
		expect(j.container().querySelector('.oc-modal').hidden).toBe(false);
		fluxo.fecharEscolha(j);
		expect(j.container().querySelector('.oc-modal').hidden).toBe(true);
	});
});
