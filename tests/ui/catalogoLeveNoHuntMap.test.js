/**
 * O CATALOGO LEVE NA JANELA DO MAPA DE CACA (D-1850, 30/09/2026): o caminho
 * inteiro do `HuntMap.js` com o fio falso - a primeira abertura pede o cheio e
 * guarda os mapas com a impressao, a reabertura pede so o cabecalho pelo canal
 * de acoes, a troca de personagem NAO esquece os mapas (eles sao do servidor,
 * nao do personagem), uma sessao NOVA ja abre leve pelo armazenamento, e um
 * servidor que nao conhece o verbo cai no pedido cheio depois do prazo.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ hooks: [], enviados: [] }));

vi.mock('Network/NetworkManager.js', () => ({
	default: {
		sendPacket: p => mocks.enviados.push(p),
		hookPacket: (pkt, cb) => mocks.hooks.push({ pkt, cb })
	}
}));
vi.mock('Renderer/Renderer.js', () => ({ default: { render: vi.fn(), stop: vi.fn(), vsync: [], width: 1280, height: 800 } }));
vi.mock('UI/UIManager.js', () => ({ default: { showErrorBox: vi.fn(), addComponent: c => c } }));
vi.mock('UI/Components/ChatBox/ChatBox.js', () => ({
	default: { addText: () => {}, TYPE: { ERROR: 1, INFO: 2 }, FILTER: { PUBLIC_LOG: 1 } }
}));
vi.mock('UI/Components/ItemInfo/ItemInfo.js', () => ({ default: { append: () => {}, remove: () => {}, uid: 0 } }));
vi.mock('UI/itemNaTela.js', () => ({
	aplicarIconeDoItem: () => {},
	nomeLocalDoItem: (id, fallback) => `Item ${id}`
}));

const FIXO = 'abcdef012345';
const CHAVE = 'RagIdle.HuntMap.catalogoFixo.v1';

function mapa(nome, nivel) {
	return {
		mapa: nome,
		rotulo: `Rotulo ${nome}`,
		regiao: 'Prontera',
		nivelMinimo: nivel,
		nivelMedio: nivel + 1,
		nivelMaximo: nivel + 2,
		nivelQueAbre: 1,
		monstros: [{ mobId: 1002, nome: 'Poring', drops: [909, 501] }],
		mvp: null
	};
}

const MAPAS = [mapa('prt_fild08', 1), mapa('prt_fild05', 10), mapa('pay_fild01', 20), mapa('moc_fild12', 30)];
const CABECALHO = { v: 3, cidade: { mapa: 'prontera', rotulo: 'Prontera' }, regioes: ['Prontera'], taxaDeExpPorDiferenca: {} };

function paginasCheias(doJogador, fixo = FIXO) {
	const base = Object.assign({}, CABECALHO, doJogador, fixo ? { fixo } : {});
	return [
		JSON.stringify(Object.assign({}, base, { parte: 1, partes: 2, mapas: MAPAS.slice(0, 2) })),
		JSON.stringify(Object.assign({}, base, { parte: 2, partes: 2, mapas: MAPAS.slice(2) }))
	];
}

function paginaLeve(doJogador, fixo = FIXO) {
	return JSON.stringify(Object.assign({}, CABECALHO, doJogador, { fixo, parte: 1, partes: 1 }));
}

const JOGADOR = { mapaAtual: 'prontera', nivel: 15, favoritos: [], voltarPara: null };

async function carregar() {
	vi.resetModules();
	mocks.hooks.length = 0;
	mocks.enviados.length = 0;
	const { default: PACKET } = await import('Network/PacketStructure.js');
	const { default: HuntMap } = await import('UI/Components/HuntMap/HuntMap.js');
	const { default: htmlDoMapa } = await import('UI/Components/HuntMap/HuntMap.html?raw');
	HuntMap._host = document.createElement('div');
	HuntMap._host.innerHTML = htmlDoMapa;
	HuntMap._shadow = null;
	HuntMap.focus = () => {};
	HuntMap.draggable = () => {};
	HuntMap.init();
	const catalogo = mocks.hooks.find(h => h.pkt === PACKET.ZC.RAGIDLE_CATALOGO).cb;
	const receber = pags => pags.forEach(json => catalogo({ json }));
	/** Os pedidos de catalogo enviados desde `desde`, no formato do fio. */
	const pedidos = (desde = 0) =>
		mocks.enviados.slice(desde).flatMap(p => {
			if (p instanceof PACKET.CZ.RAGIDLE_PEDIR_CATALOGO) {
				return ['cheio'];
			}
			if (p instanceof PACKET.CZ.RAGIDLE_CACA_ACAO) {
				const corpo = JSON.parse(p.json);
				return corpo.acao === 'catalogo' ? [`leve:${corpo.fixo}`] : [];
			}
			return [];
		});
	const abrir = () => {
		const antes = mocks.enviados.length;
		const win = HuntMap._host.querySelector('.hm-window');
		if (win.classList.contains('is-open')) {
			HuntMap.toggle();
		}
		HuntMap.toggle();
		return antes;
	};
	const cartoes = () => {
		if (typeof HuntMap._terminarLista === 'function') {
			HuntMap._terminarLista();
		}
		return HuntMap._host.querySelectorAll('.hm-card').length;
	};
	return { HuntMap, receber, pedidos, abrir, cartoes };
}

beforeEach(() => {
	localStorage.clear();
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
	localStorage.clear();
});

describe('o catalogo leve no HuntMap (D-1850)', () => {
	it('abre cheio, guarda, e a reabertura pede SO o cabecalho e desenha os mesmos mapas', async () => {
		const j = await carregar();
		const a1 = j.abrir();
		expect(j.pedidos(a1)).toEqual(['cheio']);
		j.receber(paginasCheias(JOGADOR));
		expect(j.cartoes()).toBe(4);
		vi.runOnlyPendingTimers(); // a gravacao no armazenamento sai fora do desenho
		expect(localStorage.getItem(CHAVE).split('\n')[0]).toBe(FIXO);

		const a2 = j.abrir();
		expect(j.pedidos(a2)).toEqual([`leve:${FIXO}`]);
		// O cabecalho novo (nivel 40) chega sem os mapas: eles saem do cache.
		j.receber([paginaLeve(Object.assign({}, JOGADOR, { nivel: 40 }))]);
		expect(j.HuntMap.catalog.nivel).toBe(40);
		expect(j.HuntMap.catalog.mapas.map(m => m.mapa)).toEqual(MAPAS.map(m => m.mapa));
		// Os drops continuam resolvidos (nome), e nao voltam a itemId.
		expect(j.HuntMap.catalog.mapas[0].monstros[0].drops).toEqual(['Item 909', 'Item 501']);
		expect(j.cartoes()).toBe(4);
		// CONTROLE: o prazo do pedido leve foi desarmado pela resposta - nada de cheio depois.
		vi.advanceTimersByTime(10_000);
		expect(j.pedidos(a2)).toEqual([`leve:${FIXO}`]);
	});

	it('a primeira reabertura LEVE com o mesmo cabecalho nao redesenha a lista (regra 2 pela identidade)', async () => {
		const j = await carregar();
		j.abrir();
		j.receber(paginasCheias(JOGADOR));
		expect(j.cartoes()).toBe(4);
		const primeiroCartao = j.HuntMap._host.querySelector('.hm-card');
		j.abrir();
		j.receber([paginaLeve(JOGADOR)]);
		// O MESMO no do DOM: a lista nao foi remontada.
		expect(j.HuntMap._host.querySelector('.hm-card')).toBe(primeiroCartao);
		// CONTROLE: com o nivel mudado a lista e remontada.
		j.abrir();
		j.receber([paginaLeve(Object.assign({}, JOGADOR, { nivel: 16 }))]);
		expect(j.cartoes()).toBe(4);
		expect(j.HuntMap._host.querySelector('.hm-card')).not.toBe(primeiroCartao);
	});

	it('a troca de personagem NAO esquece os mapas (eles sao do servidor)', async () => {
		const j = await carregar();
		j.abrir();
		j.receber(paginasCheias(JOGADOR));
		j.HuntMap.limparEstadoDoPersonagem();
		const a = j.abrir();
		expect(j.pedidos(a)).toEqual([`leve:${FIXO}`]);
		j.receber([paginaLeve({ mapaAtual: 'prontera', nivel: 3, favoritos: [], voltarPara: null })]);
		expect(j.HuntMap.catalog.mapas).toHaveLength(4);
		expect(j.HuntMap.catalog.nivel).toBe(3);
		expect(j.cartoes()).toBe(4);
	});

	it('uma sessao NOVA ja abre leve pelo armazenamento, com os drops resolvidos de novo', async () => {
		const primeira = await carregar();
		primeira.abrir();
		primeira.receber(paginasCheias(JOGADOR));
		vi.runOnlyPendingTimers();

		const nova = await carregar(); // o modulo recarregado: memoria vazia, armazenamento cheio
		const a = nova.abrir();
		expect(nova.pedidos(a)).toEqual([`leve:${FIXO}`]);
		nova.receber([paginaLeve(JOGADOR)]);
		expect(nova.HuntMap.catalog.mapas.map(m => m.mapa)).toEqual(MAPAS.map(m => m.mapa));
		expect(nova.HuntMap.catalog.mapas[2].monstros[0].drops).toEqual(['Item 909', 'Item 501']);
		expect(nova.cartoes()).toBe(4);
	});

	it('servidor que nao conhece o verbo: o prazo vence, o cheio sai, e a pagina so volta ao leve com impressao nova', async () => {
		localStorage.setItem(CHAVE, `${FIXO}\n${paginasCheias(JOGADOR).join('\n')}`);
		const j = await carregar();
		const a1 = j.abrir();
		expect(j.pedidos(a1)).toEqual([`leve:${FIXO}`]);
		vi.advanceTimersByTime(2_999);
		expect(j.pedidos(a1)).toEqual([`leve:${FIXO}`]);
		vi.advanceTimersByTime(1);
		expect(j.pedidos(a1)).toEqual([`leve:${FIXO}`, 'cheio']);
		// O servidor antigo responde o cheio SEM impressao.
		j.receber(paginasCheias(JOGADOR, null));
		expect(j.cartoes()).toBe(4);
		const a2 = j.abrir();
		expect(j.pedidos(a2)).toEqual(['cheio']);
		// O servidor novo (depois do deploy) responde com a impressao: o leve volta.
		j.receber(paginasCheias(JOGADOR));
		const a3 = j.abrir();
		expect(j.pedidos(a3)).toEqual([`leve:${FIXO}`]);
	});

	it('resposta leve de OUTRA impressao (o cliente perdeu os mapas): pede o cheio e nao desenha lista vazia', async () => {
		const j = await carregar();
		j.abrir();
		j.receber(paginasCheias(JOGADOR));
		const a = j.abrir();
		const antes = j.HuntMap.catalog;
		j.receber([paginaLeve(JOGADOR, '999999999999')]);
		expect(j.pedidos(a)).toEqual([`leve:${FIXO}`, 'cheio']);
		expect(j.HuntMap.catalog).toBe(antes);
		expect(localStorage.getItem(CHAVE)).toBeNull();
	});

	it('armazenamento que lanca nao quebra a janela: fica o pedido cheio de sempre', async () => {
		const original = Storage.prototype.getItem;
		// So a CHAVE do catalogo lanca: as preferencias de outras janelas nao sao deste teste.
		Storage.prototype.getItem = function (chave) {
			if (chave === CHAVE) {
				throw new Error('bloqueado');
			}
			return original.call(this, chave);
		};
		try {
			const j = await carregar();
			const a = j.abrir();
			expect(j.pedidos(a)).toEqual(['cheio']);
			j.receber(paginasCheias(JOGADOR));
			expect(j.cartoes()).toBe(4);
		} finally {
			Storage.prototype.getItem = original;
		}
	});
});
