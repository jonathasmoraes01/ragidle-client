/**
 * O AVISO DO MENU DO BOT ABERTO/FECHADO (D-2416, 15/10/2026, a leva de desempenho de rede).
 *
 * Com o aviso, o servidor so manda o status do Bot com a janela FECHADA quando o que fica de fora dela muda (o
 * ON/OFF, o contexto do mapa); ao abrir, o aviso e o `pedir` de sempre trazem o resto
 * (`servidor/bot/status-por-menu.ts` no rag-idle-master; o oraculo da partida inteira, servidor e este estado, mora
 * em `servidor/mapa/bot-status-por-menu-no-fio.test.ts` de la).
 *
 *  1. O estado: o aviso nao entra nos pedidos em voo (nao tem resposta) e o status sem `mapa` guarda o de antes.
 *  2. A costura do BotMenu: so avisa depois do estou-pronto E com o servidor DESTA conexao anunciando o aviso; abrir
 *     avisa ANTES do `pedir`; fechar (o X, o toggle, a troca de personagem) avisa; o mesmo estado nao avisa de novo;
 *     a conexao nova zera tudo (as capacidades da conexao anterior nao valem).
 *  3. D-993: o aviso sai no MapEngine DEPOIS do `CZ_NOTIFY_ACTORINIT`, dentro de try.
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { criarEstadoDoBot } from 'UI/Components/BotMenu/estadoDoBot.js';

vi.mock('Network/NetworkManager.js', () => ({
	default: { sendPacket: vi.fn(), hookPacket: vi.fn() }
}));
vi.mock('Renderer/Renderer.js', () => ({ default: { render: vi.fn(), stop: vi.fn(), width: 1280, height: 720 } }));
vi.mock('UI/UIManager.js', () => ({ default: { showErrorBox: vi.fn(), addComponent: c => c } }));
vi.mock('DB/DBManager.js', () => ({ default: { getItemInfo: () => ({ identifiedDisplayName: 'Item' }) } }));

const html = readFileSync(join(__dirname, '..', '..', 'src', 'UI', 'Components', 'BotMenu', 'BotMenu.html'), 'utf8');

const CAPACIDADES = { contrato: 1, versaoDaConfig: 1, limites: {}, secoes: ['cacada', 'ataque'], avisoDoMenu: true };

function pacote(extra = {}) {
	return {
		v: 1,
		tipo: 'status',
		requestId: null,
		personagemId: 7,
		mapa: 'prt_fild08',
		contexto: { mapa: 'prt_fild08', rotuloDoMapa: 'Campos de Prontera', ehCidade: false },
		ok: true,
		erro: null,
		problemas: [],
		revisao: 1,
		ligado: true,
		situacao: 'ativo',
		status: { codigo: 'procurando-alvo', alvo: null },
		statusRevision: 1,
		agora: 0,
		capacidades: CAPACIDADES,
		diagnostico: null,
		...extra
	};
}

describe('o estado do Bot e o aviso', () => {
	it('o aviso vai como verbo `menu`, sem entrar nos pedidos em voo (nao tem resposta)', () => {
		const enviados = [];
		const e = criarEstadoDoBot({ enviar: c => enviados.push(c) });
		e.avisarMenu(false);
		e.avisarMenu(true);
		expect(enviados.map(c => [c.v, c.verbo, c.aberto])).toEqual([
			[1, 'menu', false],
			[1, 'menu', true]
		]);
		expect(enviados.every(c => Number.isInteger(c.requestId) && c.requestId >= 0)).toBe(true);
		expect(new Set(enviados.map(c => c.requestId)).size).toBe(2);
		expect(e.pedidosEmVoo()).toBe(0);
		// E o pedido seguinte nao reusa o numero do aviso.
		const id = e.pedirEstado();
		expect(enviados.slice(0, 2).map(c => c.requestId)).not.toContain(id);
	});

	it('o status sem `mapa` guarda o mapa de antes; com ele (inclusive nulo), troca', () => {
		const e = criarEstadoDoBot({ enviar: () => {} });
		e.receber(pacote(), 7);
		expect(e.estado().mapa).toBe('prt_fild08');
		const semMapa = pacote({ statusRevision: 2 });
		delete semMapa.mapa;
		e.receber(semMapa, 7);
		expect(e.estado().mapa).toBe('prt_fild08');
		e.receber(pacote({ statusRevision: 3, mapa: null }), 7);
		expect(e.estado().mapa).toBeNull();
	});
});

async function montar({ capacidades = CAPACIDADES } = {}) {
	vi.resetModules();
	localStorage.clear();
	const { default: Network } = await import('Network/NetworkManager.js');
	Network.sendPacket.mockClear();
	const { default: BotMenu } = await import('UI/Components/BotMenu/BotMenu.js');
	BotMenu._host = document.createElement('div');
	BotMenu._host.innerHTML = html;
	BotMenu._shadow = null;
	BotMenu.draggable = () => {};
	BotMenu.focus = () => {};
	BotMenu.init();
	const chamada = Network.hookPacket.mock.calls.at(-1);
	const receber = d => chamada[1]({ json: JSON.stringify(d) });
	const enviados = () => Network.sendPacket.mock.calls.map(c => JSON.parse(c[0].json));
	const avisos = () => enviados().filter(p => p.verbo === 'menu').map(p => p.aberto);
	const aberta = () => BotMenu._host.querySelector('.bm-window').classList.contains('is-open');
	return { BotMenu, receber, enviados, avisos, aberta, pacote: extra => pacote({ capacidades, ...extra }) };
}

describe('a costura do aviso no BotMenu', () => {
	it('so avisa depois do estou-pronto E das capacidades desta conexao, e so quando o estado da janela muda', async () => {
		const m = await montar();
		m.BotMenu.novaConexaoDoServidor();
		m.receber(m.pacote());
		expect(m.avisos(), 'sem o estou-pronto, nada (D-993)').toEqual([]);
		m.BotMenu.aposEstouPronto();
		expect(m.avisos(), 'a janela fechada').toEqual([false]);
		m.receber(m.pacote({ statusRevision: 2 }));
		m.BotMenu.aposEstouPronto();
		expect(m.avisos(), 'o mesmo estado nao avisa de novo').toEqual([false]);
	});

	it('na ordem inversa (o estou-pronto antes das capacidades), avisa quando elas chegam', async () => {
		const m = await montar();
		m.BotMenu.novaConexaoDoServidor();
		m.BotMenu.aposEstouPronto();
		expect(m.avisos()).toEqual([]);
		m.receber(m.pacote());
		expect(m.avisos()).toEqual([false]);
	});

	it('abrir avisa ANTES do pedir; fechar pelo toggle e pelo X avisa', async () => {
		const m = await montar();
		m.BotMenu.novaConexaoDoServidor();
		m.receber(m.pacote());
		m.BotMenu.aposEstouPronto();
		const antes = m.enviados().length;
		m.BotMenu.toggle();
		expect(m.aberta()).toBe(true);
		const depois = m.enviados().slice(antes).map(p => p.verbo);
		expect(depois.slice(0, 2), 'o aviso de aberta e depois o pedir').toEqual(['menu', 'pedir']);
		expect(m.avisos()).toEqual([false, true]);
		m.BotMenu.toggle();
		expect(m.aberta()).toBe(false);
		expect(m.avisos()).toEqual([false, true, false]);
		m.BotMenu.toggle();
		m.BotMenu._host.querySelector('.bm-close').click();
		expect(m.aberta()).toBe(false);
		expect(m.avisos()).toEqual([false, true, false, true, false]);
	});

	it('a troca de personagem fecha a janela e avisa', async () => {
		const m = await montar();
		m.BotMenu.novaConexaoDoServidor();
		m.receber(m.pacote());
		m.BotMenu.aposEstouPronto();
		m.BotMenu.toggle();
		m.BotMenu.limparEstadoDoPersonagem();
		expect(m.aberta()).toBe(false);
		expect(m.avisos()).toEqual([false, true, false]);
	});

	it('a conexao nova zera: as capacidades e o estou-pronto da anterior nao valem, e o aviso sai de novo', async () => {
		const m = await montar();
		m.BotMenu.novaConexaoDoServidor();
		m.receber(m.pacote());
		m.BotMenu.aposEstouPronto();
		expect(m.avisos()).toEqual([false]);
		m.BotMenu.novaConexaoDoServidor();
		m.receber(m.pacote({ statusRevision: 1 }));
		expect(m.avisos(), 'o estou-pronto da conexao anterior nao vale (D-993)').toEqual([false]);
		m.BotMenu.novaConexaoDoServidor();
		m.BotMenu.aposEstouPronto();
		expect(m.avisos(), 'o servidor da conexao nova ainda nao disse que aceita').toEqual([false]);
		// Um pacote SEM capacidades (o status de quem ja as mandou) nao confirma nada.
		const semCapacidades = m.pacote({ statusRevision: 1 });
		delete semCapacidades.capacidades;
		m.receber(semCapacidades);
		expect(m.avisos()).toEqual([false]);
		m.receber(m.pacote({ statusRevision: 2 }));
		expect(m.avisos(), 'o mesmo estado, mas a conexao e outra: avisa de novo').toEqual([false, false]);
	});

	it('o servidor que nao anuncia o aviso nunca recebe o verbo (ele o responderia com erro)', async () => {
		const m = await montar({ capacidades: { ...CAPACIDADES, avisoDoMenu: undefined } });
		m.BotMenu.novaConexaoDoServidor();
		m.receber(m.pacote());
		m.BotMenu.aposEstouPronto();
		m.BotMenu.toggle();
		m.BotMenu.toggle();
		expect(m.avisos()).toEqual([]);
		expect(m.enviados().some(p => p.verbo === 'pedir'), 'controle: o pedir de sempre saiu').toBe(true);
	});

	it('e o servidor que deixa de anunciar (rollback) para de receber, na mesma conexao', async () => {
		const m = await montar();
		m.BotMenu.novaConexaoDoServidor();
		m.receber(m.pacote());
		m.BotMenu.aposEstouPronto();
		m.receber(m.pacote({ statusRevision: 2, capacidades: { ...CAPACIDADES, avisoDoMenu: false } }));
		m.BotMenu.toggle();
		expect(m.avisos()).toEqual([false]);
	});
});

describe('D-993: o aviso sai depois do estou-pronto (lido do fonte: o MapEngine nao carrega em jsdom)', () => {
	const fonte = readFileSync('src/Engine/MapEngine.js', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
	it('dentro do estouPronto, depois do CZ_NOTIFY_ACTORINIT, em try', () => {
		const inicio = fonte.indexOf('const estouPronto = () => {');
		const fim = fonte.indexOf('setTimeout(estouPronto, 0);', inicio);
		const corpo = fonte.slice(inicio, fim);
		const pacote = corpo.indexOf('Network.sendPacket(new PACKET.CZ.NOTIFY_ACTORINIT());');
		const aviso = corpo.indexOf('BotMenu.aposEstouPronto();');
		expect(pacote).toBeGreaterThan(-1);
		expect(aviso).toBeGreaterThan(pacote);
		expect(corpo.slice(0, aviso)).toMatch(/try \{\s*$/);
		expect(fonte.split('BotMenu.aposEstouPronto()').length - 1, 'uma chamada so').toBe(1);
	});
});
