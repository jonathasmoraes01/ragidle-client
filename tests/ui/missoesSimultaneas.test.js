/**
 * ATÉ TRÊS MISSÕES AO MESMO TEMPO (01/10/2026, pedido do dono).
 *
 * *"permitir até 3 missões ao mesmo tempo, sem entrar na 'fila'"*. O modelo que
 * o jogador vê: ele ACEITA até `execucao.maximo` missões ("Iniciar"), todas
 * andam juntas, e cada aceita tem "Finalizar" (aceso SÓ com `pronta`), "Ir
 * caçar", "Abandonar" e o "(i)". A quarta não é oferecida: no lugar do
 * "Iniciar" fica "3 de 3 em andamento", apagado.
 *
 * Três metades, cada uma medida no que o jogador vê:
 *
 *  - as REGRAS PURAS (`podeIniciarMissao.js`, `missoesAceitas.js`), executadas;
 *  - a JANELA de Missões montada com o HTML real, recebendo o pacote pelo
 *    gancho de verdade — inclusive o PARCIAL de progresso (`v: 3`);
 *  - o CARTÃO da HUD (`MissoesTrackerIdle`), com um bloco por aceita e o "(i)"
 *    como IRMÃO da linha (a linha de "Iniciar" já é um `<button>`).
 *
 * Os quatro `vi.mock` são os de `missoesConcluidasOcultas.test.js`: importar a
 * janela puxa o renderizador de sprites, e no jsdom o `getContext('2d')` é
 * `null` — o módulo explodiria antes de qualquer caso.
 */

import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('Network/NetworkManager.js', () => ({
	default: { sendPacket: vi.fn(), hookPacket: vi.fn() }
}));
vi.mock('Renderer/Renderer.js', () => ({
	default: { render: vi.fn(), stop: vi.fn(), width: 1280, height: 720 }
}));
vi.mock('UI/UIManager.js', () => ({ default: { showErrorBox: vi.fn(), addComponent: c => c } }));
vi.mock('UI/Components/ChatBox/ChatBox.js', () => ({
	default: { addText: vi.fn(), TYPE: { ERROR: 1 }, FILTER: { PUBLIC_LOG: 1 } }
}));
/* Os três vizinhos que o CARTÃO importa e este arquivo não mede: o painel de
   personagem (a âncora do `syncPosition`, que puxa o desenho de entidades e o
   canvas), o LFG (a aba "Grupo") e o Codex (a linha do rastreador). Sem eles o
   import do cartão explode no `getContext('2d')` do jsdom. */
vi.mock('UI/Components/BasicInfoIdle/BasicInfoIdle.js', () => ({ default: { _host: null } }));
vi.mock('UI/Components/LFGIdle/LFGIdle.js', () => ({ default: { toggle: vi.fn() } }));
vi.mock('UI/Components/CodexIdle/CodexIdle.js', () => ({ default: { abrirNaEntrada: vi.fn() } }));

import {
	limiteDeMissoesAtingido,
	missaoAceita,
	podeIniciarMissao,
	textoDoLimiteDeMissoes
} from '../../src/UI/Components/MissoesIdle/podeIniciarMissao.js';
import {
	acoesDaMissaoAceita,
	aplicarProgressoParcial,
	destinoDeCaca,
	ehCorpoParcialDeProgresso,
	estadoParaOJogador,
	missoesAceitasEmOrdem,
	passoDaMissaoAceita,
	progressoDaPrimeiraAceita
} from '../../src/UI/Components/MissoesIdle/missoesAceitas.js';

/* ─── Os dados, no formato do pacote novo ─────────────────────────────── */

function missao(id, extra = {}) {
	return {
		id,
		tipo: 'principal',
		titulo: `Missão ${id}`,
		descricao: `Descrição de ${id}`,
		dificuldade: 'Fácil',
		estado: 'disponivel',
		executavel: true,
		repetivel: false,
		cooldownS: 0,
		aceita: false,
		pronta: false,
		npc: 'Guarda de Prontera',
		objetivos: [{ id: 'matar-1002', descricao: 'Caçar 25 Poring', progresso: 0, alvo: 25, mapa: 'prt_fild08', mapaRotulo: 'Campos de Prontera 08' }],
		recompensas: [{ tipo: 'zeny', quantidade: 500, itemId: null, rotulo: '500 zeny' }],
		...extra
	};
}

function aceita(id, extra = {}) {
	return missao(id, { estado: 'em-andamento', aceita: true, ...extra });
}

const EXECUCAO_CHEIA = Object.freeze({ aceitas: ['a', 'b', 'c'], maximo: 3 });

/* ═══════════════════════════════════════════════════════════════════════
   1. AS REGRAS PURAS
   ═══════════════════════════════════════════════════════════════════════ */

describe('o teto de três aceitas (podeIniciarMissao)', () => {
	it('com três aceitas, a quarta NÃO é oferecida', () => {
		expect(podeIniciarMissao(missao('d'), EXECUCAO_CHEIA)).toBe(false);
	});

	it('...mas ela começaria se não fosse o teto: `ignorarLimite` responde isso', () => {
		// É assim que as telas sabem desenhar o "3 de 3" apagado em vez de nada.
		expect(podeIniciarMissao(missao('d'), EXECUCAO_CHEIA, { ignorarLimite: true })).toBe(true);
	});

	it('CONTROLE: com duas aceitas a terceira ainda é oferecida', () => {
		expect(podeIniciarMissao(missao('c'), { aceitas: ['a', 'b'], maximo: 3 })).toBe(true);
	});

	it('o personagem antigo com MAIS de três (a fila de antes) também não aceita outra', () => {
		const quatro = { aceitas: ['a', 'b', 'c', 'x'], maximo: 3 };
		expect(limiteDeMissoesAtingido(quatro)).toBe(true);
		expect(podeIniciarMissao(missao('d'), quatro)).toBe(false);
		expect(textoDoLimiteDeMissoes(quatro)).toBe('4 em andamento (máx. 3)');
	});

	it('o texto do teto é "3 de 3 em andamento"', () => {
		expect(textoDoLimiteDeMissoes(EXECUCAO_CHEIA)).toBe('3 de 3 em andamento');
	});

	it('sem `maximo` (servidor de antes do teto) a regra é a de sempre', () => {
		expect(limiteDeMissoesAtingido({ aceitas: ['a', 'b', 'c', 'x'] })).toBe(false);
		expect(podeIniciarMissao(missao('d'), { aceitas: ['a', 'b', 'c', 'x'] })).toBe(true);
		expect(podeIniciarMissao(missao('d'))).toBe(true);
	});

	it('a missão JÁ aceita não ganha "Iniciar" — nem ignorando o teto', () => {
		const m = aceita('a');
		expect(podeIniciarMissao(m, EXECUCAO_CHEIA)).toBe(false);
		expect(podeIniciarMissao(m, EXECUCAO_CHEIA, { ignorarLimite: true })).toBe(false);
		// Pela lista também, sem o campo `aceita` na missão.
		expect(podeIniciarMissao(missao('a'), { aceitas: ['a'], maximo: 3 })).toBe(false);
	});

	it('o teto não muda as outras recusas (bloqueada, recarga)', () => {
		expect(podeIniciarMissao(missao('d', { estado: 'bloqueada' }), EXECUCAO_CHEIA, { ignorarLimite: true })).toBe(false);
		expect(podeIniciarMissao(missao('d', { cooldownS: 120 }), EXECUCAO_CHEIA, { ignorarLimite: true })).toBe(false);
	});

	it('`missaoAceita` lê o campo, a lista e a forma antiga (`ativaId`)', () => {
		expect(missaoAceita(aceita('a'), null)).toBe(true);
		expect(missaoAceita(missao('a'), { aceitas: ['a'] })).toBe(true);
		expect(missaoAceita(missao('a'), { ativaId: 'a' })).toBe(true);
		expect(missaoAceita(missao('a'), { aceitas: ['b'] })).toBe(false);
	});
});

describe('as aceitas e os botões delas (missoesAceitas.js)', () => {
	it('as aceitas saem na ORDEM DE ACEITE, e a `aceita` que a lista não nomeia vem depois', () => {
		const lista = [aceita('c'), missao('x'), aceita('a'), aceita('solta')];
		const ordem = missoesAceitasEmOrdem(lista, { aceitas: ['a', 'c'], maximo: 3 }).map(m => m.id);
		expect(ordem).toEqual(['a', 'c', 'solta']);
	});

	it('"Finalizar" existe sempre na aceita, e SÓ acende com `pronta`', () => {
		const naoPronta = acoesDaMissaoAceita(aceita('a'));
		const fin = naoPronta.find(a => a.acao === 'finalizar');
		expect(fin.habilitado).toBe(false);
		expect(fin.destaque).toBe(false);

		const pronta = acoesDaMissaoAceita(aceita('a', { pronta: true, objetivos: [{ progresso: 25, alvo: 25 }] }));
		const fin2 = pronta.find(a => a.acao === 'finalizar');
		expect(fin2.habilitado).toBe(true);
		expect(fin2.destaque).toBe(true);
	});

	it('o "Finalizar" NÃO acende pela conta do cliente: objetivos no alvo sem `pronta` continuam apagados', () => {
		const m = aceita('a', { objetivos: [{ progresso: 25, alvo: 25, mapa: 'prt_fild08' }] });
		expect(acoesDaMissaoAceita(m).find(a => a.acao === 'finalizar').habilitado).toBe(false);
	});

	it('"Ir caçar" só existe com objetivo PENDENTE que tem `mapa`, e some quando pronta', () => {
		expect(acoesDaMissaoAceita(aceita('a')).map(a => a.acao)).toEqual(['finalizar', 'teleporte', 'abandonar']);
		expect(destinoDeCaca(aceita('a'))).toEqual({ mapa: 'prt_fild08', rotulo: 'Campos de Prontera 08' });

		const semMapa = aceita('a', { objetivos: [{ descricao: 'Trazer 3 Jellopy', progresso: 0, alvo: 3, itemId: 909 }] });
		expect(acoesDaMissaoAceita(semMapa).map(a => a.acao)).toEqual(['finalizar', 'abandonar']);

		const pronta = aceita('a', { pronta: true });
		expect(destinoDeCaca(pronta)).toBeNull();
		expect(acoesDaMissaoAceita(pronta).map(a => a.acao)).toEqual(['finalizar', 'abandonar']);
	});

	it('"Ir caçar" pula o objetivo já completo e leva ao mapa do que falta', () => {
		const m = aceita('a', {
			objetivos: [
				{ progresso: 5, alvo: 5, mapa: 'prt_fild01', mapaRotulo: 'Campo 01' },
				{ progresso: 1, alvo: 5, mapa: 'prt_fild02', mapaRotulo: 'Campo 02' }
			]
		});
		expect(destinoDeCaca(m).rotulo).toBe('Campo 02');
	});

	it('o passo do cartão: o objetivo que falta, ou "Pronta para finalizar!"', () => {
		expect(passoDaMissaoAceita(aceita('a', { objetivos: [{ descricao: 'Caçar 25 Poring', progresso: 12, alvo: 25 }] }))).toEqual({
			texto: 'Caçar 25 Poring',
			progresso: 12,
			alvo: 25
		});
		expect(passoDaMissaoAceita(aceita('a', { pronta: true })).texto).toBe('Pronta para finalizar!');
	});

	it('o estado do jogador: aceita = em andamento (ou pronta); a abandonada com progresso volta a disponível', () => {
		expect(estadoParaOJogador(aceita('a'), null)).toBe('em-andamento');
		expect(estadoParaOJogador(aceita('a', { pronta: true }), null)).toBe('pronta');
		expect(estadoParaOJogador(missao('a', { estado: 'em-andamento' }), null)).toBe('disponivel');
		expect(estadoParaOJogador(missao('a', { estado: 'concluida' }), null)).toBe('concluida');
	});

	it('o contador do tutorial é a soma dos objetivos da PRIMEIRA aceita', () => {
		const lista = [
			aceita('b', { objetivos: [{ progresso: 9, alvo: 10 }] }),
			aceita('a', { objetivos: [{ progresso: 5, alvo: 5 }, { progresso: 2, alvo: 10 }] })
		];
		expect(progressoDaPrimeiraAceita(lista, { aceitas: ['a', 'b'], maximo: 3 })).toBe(7);
		expect(progressoDaPrimeiraAceita(lista, { aceitas: [], maximo: 3 })).toBe(9);
		expect(progressoDaPrimeiraAceita([missao('x')], { aceitas: [], maximo: 3 })).toBe(0);
	});
});

describe('o parcial de progresso (`v: 3`)', () => {
	const LISTA = [
		aceita('a', { objetivos: [{ id: 'matar-1002', descricao: 'Caçar 25 Poring', progresso: 3, alvo: 25 }, { id: 'coletar-909', descricao: 'Jellopy', progresso: 0, alvo: 3, itemId: 909 }] }),
		aceita('b', { objetivos: [{ progresso: 1, alvo: 10 }] }),
		missao('c')
	];

	it('é reconhecido só com `v: 3` e `parcial: "progresso"`', () => {
		expect(ehCorpoParcialDeProgresso({ v: 3, parcial: 'progresso', progressos: {}, prontas: [] })).toBe(true);
		expect(ehCorpoParcialDeProgresso({ v: 2, parcial: 'codexRastreado' })).toBe(false);
		expect(ehCorpoParcialDeProgresso({ v: 1, missoes: [] })).toBe(false);
		expect(ehCorpoParcialDeProgresso(null)).toBe(false);
	});

	it('muda SÓ as missões que vieram em `progressos`, e o resto do estado fica', () => {
		const r = aplicarProgressoParcial(LISTA, { v: 3, parcial: 'progresso', progressos: { a: [7, 2] }, prontas: [] });
		expect(r.mudou).toBe(true);
		const a = r.missoes.find(m => m.id === 'a');
		expect(a.objetivos.map(o => o.progresso)).toEqual([7, 2]);
		// O resto do objetivo e da missão ficam.
		expect(a.objetivos[0].descricao).toBe('Caçar 25 Poring');
		expect(a.objetivos[1].itemId).toBe(909);
		expect(a.titulo).toBe('Missão a');
		expect(a.recompensas[0].rotulo).toBe('500 zeny');
		expect(a.aceita).toBe(true);
		// A ausente de `progressos` fica como estava — ausência não é "zerou".
		expect(r.missoes.find(m => m.id === 'b')).toBe(LISTA[1]);
		// A lista que entrou não foi mexida (quem compara por assinatura vê a nova).
		expect(LISTA[0].objetivos[0].progresso).toBe(3);
	});

	it('`pronta` é refeito para TODAS a partir de `prontas` (a lista inteira)', () => {
		const comB = aplicarProgressoParcial(LISTA, { v: 3, parcial: 'progresso', progressos: {}, prontas: ['b'] });
		expect(comB.missoes.find(m => m.id === 'b').pronta).toBe(true);
		expect(comB.missoes.find(m => m.id === 'a').pronta).toBe(false);
		// A que saiu de `prontas` deixa de estar pronta (a mochila perdeu o item).
		const semB = aplicarProgressoParcial(comB.missoes, { v: 3, parcial: 'progresso', progressos: {}, prontas: [] });
		expect(semB.missoes.find(m => m.id === 'b').pronta).toBe(false);
	});

	it('nada mudou: devolve a MESMA lista e `mudou: false`', () => {
		const r = aplicarProgressoParcial(LISTA, { v: 3, parcial: 'progresso', progressos: { b: [1] }, prontas: [] });
		expect(r.mudou).toBe(false);
		expect(r.missoes).toBe(LISTA);
	});

	it('o parcial que não casa com a lista não é aplicado, e é nomeado', () => {
		const r = aplicarProgressoParcial(LISTA, { v: 3, parcial: 'progresso', progressos: { a: [9], fantasma: [1] }, prontas: [] });
		expect(r.divergentes.sort()).toEqual(['a', 'fantasma']);
		expect(r.missoes.find(m => m.id === 'a').objetivos[0].progresso).toBe(3);
	});
});

/* ═══════════════════════════════════════════════════════════════════════
   1b. A ABA "MISSÕES GERAIS" DO CODEX (o desenho é puro: `missoesGeraisHtml`)
   ═══════════════════════════════════════════════════════════════════════ */

describe('a aba "Missões Gerais" do Codex', () => {
	async function desenharAba(contexto) {
		const { missoesGeraisHtml } = await import('../../src/UI/Components/CodexIdle/missoesGeraisHtml.js');
		const div = document.createElement('div');
		div.innerHTML = missoesGeraisHtml({ subaba: 'principais', ...contexto });
		return div;
	}

	it('a aceita tem Finalizar (apagado), Ir caçar e Abandonar, TODOS com o id — e nada de "Pausar"', async () => {
		const tela = await desenharAba({ missoes: [aceita('a')], execucao: { aceitas: ['a'], maximo: 3 }, vista: 'missao', missaoAberta: 'a' });
		const botoes = [...tela.querySelectorAll('.cx-mg-rodape [data-mg-executar]')];
		expect(botoes.map(b => b.dataset.mgExecutar)).toEqual(['finalizar', 'teleporte', 'abandonar']);
		expect(botoes.every(b => b.dataset.mgId === 'a')).toBe(true);
		expect(botoes[0].disabled).toBe(true);
		expect(tela.querySelector('[data-mg-executar="pausar"]')).toBeNull();
		expect(tela.textContent).not.toContain('Pausar');
	});

	it('pronta: o Finalizar acende', async () => {
		const tela = await desenharAba({ missoes: [aceita('a', { pronta: true })], execucao: { aceitas: ['a'], maximo: 3 }, vista: 'missao', missaoAberta: 'a' });
		const fin = tela.querySelector('[data-mg-executar="finalizar"]');
		expect(fin.disabled).toBe(false);
		expect(fin.classList.contains('ri-btn--ouro')).toBe(true);
	});

	it('com três aceitas, a disponível mostra o teto apagado no lugar do "Iniciar"', async () => {
		const tela = await desenharAba({ missoes: [missao('d')], execucao: EXECUCAO_CHEIA, vista: 'missao', missaoAberta: 'd' });
		expect(tela.querySelector('[data-mg-executar="iniciar"]')).toBeNull();
		const teto = tela.querySelector('.cx-mg-limite');
		expect(teto.disabled).toBe(true);
		expect(teto.textContent).toBe('3 de 3 em andamento');
	});

	it('CONTROLE: abaixo do teto o "Iniciar" continua no rodapé (o alvo da etapa 7 do tutorial)', async () => {
		const tela = await desenharAba({ missoes: [missao('d')], execucao: { aceitas: [], maximo: 3 }, vista: 'missao', missaoAberta: 'd' });
		expect(tela.querySelector('.cx-mg-rodape [data-mg-executar="iniciar"]').dataset.mgId).toBe('d');
	});

	it('na lista, TODA aceita ganha a fita "Em andamento" — e "Em curso" saiu', async () => {
		const tela = await desenharAba({ missoes: [aceita('a'), aceita('b'), missao('d')], execucao: { aceitas: ['a', 'b'], maximo: 3 }, vista: 'lista' });
		const fitas = [...tela.querySelectorAll('.cx-jor-fita')].map(f => f.textContent);
		expect(fitas).toEqual(['Em andamento', 'Em andamento']);
		expect(tela.textContent).not.toContain('Em curso');
		expect(tela.querySelectorAll('.cx-jor-capitulo.is-proximo')).toHaveLength(2);
	});

	it('o clique da aba manda a ação COM o id (o gancho do Codex)', () => {
		const fonte = readFileSync('src/UI/Components/CodexIdle/CodexIdle.js', 'utf8');
		const ganchos = fonte.slice(fonte.indexOf('executar(acao, id) {'), fonte.indexOf('viajar(mapa) {'));
		expect(ganchos).toContain('JSON.stringify(id ? { acao, id } : { acao })');
		expect(ganchos).not.toContain("acao === 'iniciar' ? { acao, id }");
	});
});

/* ═══════════════════════════════════════════════════════════════════════
   2. A JANELA DE MISSÕES, com o pacote pelo gancho de verdade
   ═══════════════════════════════════════════════════════════════════════ */

async function montarJanela() {
	const { default: html } = await import('UI/Components/MissoesIdle/MissoesIdle.html?raw');
	const { default: MissoesIdle } = await import('UI/Components/MissoesIdle/MissoesIdle.js');
	const { default: Network } = await import('Network/NetworkManager.js');
	const { default: PACKET } = await import('Network/PacketStructure.js');

	MissoesIdle._host = document.createElement('div');
	MissoesIdle._host.innerHTML = html;
	MissoesIdle._shadow = null;
	MissoesIdle.draggable = () => {};
	MissoesIdle.focus = () => {};
	MissoesIdle.missoes = [];
	MissoesIdle.execucao = null;
	MissoesIdle.recebeuAlgumaVez = false;
	MissoesIdle.init();
	document.body.appendChild(MissoesIdle._host);
	// O mock da rede atravessa os casos: cada um conta só o que ELE mandou.
	Network.sendPacket.mockClear();

	// O ÚLTIMO gancho registrado é o do módulo que este caso montou.
	const gancho = Network.hookPacket.mock.calls.filter(c => c[0] === PACKET.ZC.RAGIDLE_MISSOES).pop();
	const receber = corpo => gancho[1]({ json: JSON.stringify(corpo) });
	const enviados = () =>
		Network.sendPacket.mock.calls.map(c => c[0]).filter(p => typeof p.json === 'string').map(p => JSON.parse(p.json));
	const pedidosDeLista = () =>
		Network.sendPacket.mock.calls.map(c => c[0]).filter(p => p instanceof PACKET.CZ.RAGIDLE_PEDIR_MISSOES).length;
	return { MissoesIdle, receber, enviados, pedidosDeLista, Network };
}

const cartao = (ui, id) => ui._host.querySelector(`.mi-card[data-missao="${id}"]`);

describe('a janela de Missões com até três aceitas', () => {
	beforeEach(() => {
		localStorage.clear();
		vi.resetModules();
		document.body.innerHTML = '';
	});

	it('a aceita mostra "Em andamento", Finalizar APAGADO, Ir caçar, Abandonar e o "(i)"', async () => {
		const { MissoesIdle, receber } = await montarJanela();
		receber({ v: 1, missoes: [aceita('a')], execucao: { aceitas: ['a'], maximo: 3 } });
		const c = cartao(MissoesIdle, 'a');
		expect(c.querySelector('.ri-badge--ouro').textContent).toBe('Em andamento');
		const fin = c.querySelector('[data-executar="finalizar"]');
		expect(fin.disabled).toBe(true);
		expect(c.querySelector('[data-executar="teleporte"]').textContent).toBe('Ir caçar');
		expect(c.querySelector('[data-executar="abandonar"]').dataset.id).toBe('a');
		expect(c.querySelector('[data-info="a"]')).not.toBeNull();
		// A fila e o "Teleporte" da ativa saíram.
		expect(c.textContent).not.toContain('Na fila');
		expect(c.querySelector('[data-executar="iniciar"]')).toBeNull();
	});

	it('pronta: "Finalizar" ACESO e em ouro, e o clique manda `{acao: "finalizar", id}`', async () => {
		const { MissoesIdle, receber, enviados } = await montarJanela();
		receber({ v: 1, missoes: [aceita('a', { pronta: true, objetivos: [{ descricao: 'x', progresso: 25, alvo: 25 }] })], execucao: { aceitas: ['a'], maximo: 3 } });
		const fin = cartao(MissoesIdle, 'a').querySelector('[data-executar="finalizar"]');
		expect(fin.disabled).toBe(false);
		expect(fin.classList.contains('ri-btn--ouro')).toBe(true);
		fin.click();
		expect(enviados()).toContainEqual({ acao: 'finalizar', id: 'a' });
	});

	it('o "Finalizar" apagado não manda nada', async () => {
		const { MissoesIdle, receber, enviados } = await montarJanela();
		receber({ v: 1, missoes: [aceita('a')], execucao: { aceitas: ['a'], maximo: 3 } });
		cartao(MissoesIdle, 'a').querySelector('[data-executar="finalizar"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(enviados().filter(j => j.acao === 'finalizar')).toEqual([]);
	});

	it('"Ir caçar" manda o `teleporte` COM o id da missão', async () => {
		const { MissoesIdle, receber, enviados } = await montarJanela();
		receber({ v: 1, missoes: [aceita('a'), aceita('b')], execucao: { aceitas: ['a', 'b'], maximo: 3 } });
		cartao(MissoesIdle, 'b').querySelector('[data-executar="teleporte"]').click();
		expect(enviados()).toContainEqual({ acao: 'teleporte', id: 'b' });
	});

	it('com três aceitas, a disponível mostra "3 de 3 em andamento" APAGADO, e nenhum "Iniciar"', async () => {
		const { MissoesIdle, receber } = await montarJanela();
		receber({ v: 1, missoes: [aceita('a'), aceita('b'), aceita('c'), missao('d')], execucao: EXECUCAO_CHEIA });
		const d = cartao(MissoesIdle, 'd');
		expect(d.querySelector('[data-executar="iniciar"]')).toBeNull();
		const limite = d.querySelector('.mi-limite');
		expect(limite.disabled).toBe(true);
		expect(limite.textContent).toBe('3 de 3 em andamento');
	});

	it('CONTROLE: com duas aceitas, a disponível tem "Iniciar" aceso', async () => {
		const { MissoesIdle, receber } = await montarJanela();
		receber({ v: 1, missoes: [aceita('a'), aceita('b'), missao('d')], execucao: { aceitas: ['a', 'b'], maximo: 3 } });
		expect(cartao(MissoesIdle, 'd').querySelector('[data-executar="iniciar"]').disabled).toBe(false);
	});

	it('o parcial `v: 3` funde o progresso e o `pronta` SEM perder o resto, e redesenha', async () => {
		const { MissoesIdle, receber } = await montarJanela();
		MissoesIdle.toggle();
		receber({ v: 1, missoes: [aceita('a'), missao('d')], execucao: { aceitas: ['a'], maximo: 3 } });
		expect(cartao(MissoesIdle, 'a').querySelector('.mi-objetivo-conta').textContent).toBe('0/25');

		receber({ v: 3, parcial: 'progresso', progressos: { a: [25] }, prontas: ['a'] });

		const a = MissoesIdle.missoes.find(m => m.id === 'a');
		expect(a.objetivos[0].progresso).toBe(25);
		expect(a.pronta).toBe(true);
		// O resto do estado ficou: a lista, a execução, os campos da missão.
		expect(MissoesIdle.missoes.map(m => m.id)).toEqual(['a', 'd']);
		expect(MissoesIdle.execucao).toEqual({ aceitas: ['a'], maximo: 3 });
		expect(a.recompensas[0].rotulo).toBe('500 zeny');
		// E a janela aberta redesenhou: o contador andou e o Finalizar acendeu.
		const c = cartao(MissoesIdle, 'a');
		expect(c.querySelector('.mi-objetivo-conta').textContent).toBe('25/25');
		expect(c.querySelector('[data-executar="finalizar"]').disabled).toBe(false);
	});

	it('parcial antes de qualquer lista inteira é descartado (não há onde fundir)', async () => {
		const { MissoesIdle, receber, pedidosDeLista } = await montarJanela();
		receber({ v: 3, parcial: 'progresso', progressos: { a: [1] }, prontas: [] });
		expect(MissoesIdle.missoes).toEqual([]);
		expect(MissoesIdle.recebeuAlgumaVez).toBe(false);
		expect(pedidosDeLista()).toBe(0);
	});

	it('parcial que não casa pede a lista inteira UMA vez, até ela chegar', async () => {
		const { receber, pedidosDeLista } = await montarJanela();
		receber({ v: 1, missoes: [aceita('a')], execucao: { aceitas: ['a'], maximo: 3 } });
		const antes = pedidosDeLista();
		const avisar = vi.spyOn(console, 'warn').mockImplementation(() => {});
		receber({ v: 3, parcial: 'progresso', progressos: { a: [1, 2] }, prontas: [] });
		receber({ v: 3, parcial: 'progresso', progressos: { a: [1, 2] }, prontas: [] });
		expect(pedidosDeLista() - antes).toBe(1);
		// A lista inteira chegou: o próximo desencontro pode pedir de novo.
		receber({ v: 1, missoes: [aceita('a')], execucao: { aceitas: ['a'], maximo: 3 } });
		receber({ v: 3, parcial: 'progresso', progressos: { a: [1, 2] }, prontas: [] });
		expect(pedidosDeLista() - antes).toBe(2);
		avisar.mockRestore();
	});

	it('o parcial do rastreador do Codex (`v: 2`) continua sem tocar a lista', async () => {
		const { MissoesIdle, receber } = await montarJanela();
		receber({ v: 1, missoes: [aceita('a')], execucao: { aceitas: ['a'], maximo: 3 } });
		const lista = MissoesIdle.missoes;
		receber({ v: 2, parcial: 'codexRastreado', codexRastreado: [] });
		expect(MissoesIdle.missoes).toBe(lista);
	});
});

/* ═══════════════════════════════════════════════════════════════════════
   3. O CARTÃO DA HUD
   ═══════════════════════════════════════════════════════════════════════ */

async function montarCartao(missoes, execucao) {
	const { default: html } = await import('UI/Components/MissoesTrackerIdle/MissoesTrackerIdle.html?raw');
	const { default: MissoesIdle } = await import('UI/Components/MissoesIdle/MissoesIdle.js');
	const { default: Tracker } = await import('UI/Components/MissoesTrackerIdle/MissoesTrackerIdle.js');
	const { default: Network } = await import('Network/NetworkManager.js');

	MissoesIdle.missoes = missoes;
	MissoesIdle.execucao = execucao;
	/* O host SEM o id: no jogo o `#MissoesTrackerIdle` de dentro mora num Shadow
	   DOM e nao colide com o id do host; aqui (sem shadow) os dois ids iguais
	   fariam o `querySelector('#...')` do jsdom devolver o host. */
	Tracker._host = document.createElement('div');
	Tracker._host.innerHTML = html;
	Tracker._shadow = null;
	document.body.appendChild(Tracker._host);
	Tracker.limparEstadoDoPersonagem(); // a assinatura do caso anterior nao vale aqui
	Tracker.init();
	Tracker.onAppend();
	Network.sendPacket.mockClear();
	const enviados = () =>
		Network.sendPacket.mock.calls.map(c => c[0]).filter(p => typeof p.json === 'string').map(p => JSON.parse(p.json));
	return { Tracker, MissoesIdle, enviados, raiz: Tracker._host };
}

describe('o cartão da HUD com até três aceitas', () => {
	let cartaoMontado = null;

	beforeEach(() => {
		localStorage.clear();
		vi.resetModules();
		document.body.innerHTML = '';
	});

	afterEach(() => {
		if (cartaoMontado) {
			cartaoMontado.Tracker.onRemove();
			cartaoMontado = null;
		}
	});

	const TRES = [
		aceita('a', { objetivos: [{ descricao: 'Caçar 25 Poring', progresso: 12, alvo: 25, mapa: 'prt_fild08', mapaRotulo: 'Campos de Prontera 08' }] }),
		aceita('b', { pronta: true, objetivos: [{ descricao: 'Caçar 5 Lunatic', progresso: 5, alvo: 5 }] }),
		aceita('c', { objetivos: [{ descricao: 'Trazer 3 Jellopy', progresso: 1, alvo: 3, itemId: 909 }] }),
		missao('d')
	];

	it('um BLOCO por aceita, na ordem de aceite, e `.mt-ativa` só no primeiro (o alvo do tutorial)', async () => {
		cartaoMontado = await montarCartao(TRES, { aceitas: ['b', 'a', 'c'], maximo: 3 });
		const blocos = [...cartaoMontado.raiz.querySelectorAll('.mt-aceitas > li.mt-bloco')];
		expect(blocos.map(b => b.dataset.missao)).toEqual(['b', 'a', 'c']);
		expect(blocos[0].classList.contains('mt-ativa')).toBe(true);
		expect(cartaoMontado.raiz.querySelectorAll('.mt-ativa')).toHaveLength(1);
		// O seletor da etapa 10 acha o primeiro bloco.
		expect(cartaoMontado.raiz.querySelector('.mt-ativa').dataset.missao).toBe('b');
	});

	it('cada bloco tem o "(i)" — e nenhum "(i)" mora dentro de outro botão', async () => {
		cartaoMontado = await montarCartao(TRES, { aceitas: ['a', 'b', 'c'], maximo: 3 });
		const blocos = cartaoMontado.raiz.querySelectorAll('.mt-bloco');
		for (const b of blocos) {
			const i = b.querySelector('[data-info]');
			expect(i, `o bloco ${b.dataset.missao} ficou sem o (i)`).not.toBeNull();
			expect(i.getAttribute('data-info')).toBe(b.dataset.missao);
			expect(i.parentElement.closest('button')).toBeNull();
		}
	});

	it('o bloco mostra o objetivo que falta com "progresso/alvo" e a barra; a pronta diz que está pronta', async () => {
		cartaoMontado = await montarCartao(TRES, { aceitas: ['a', 'b', 'c'], maximo: 3 });
		const a = cartaoMontado.raiz.querySelector('.mt-bloco[data-missao="a"]');
		expect(a.querySelector('.mt-ativa-passo').textContent).toBe('Caçar 25 Poring — 12/25');
		expect(a.querySelector('.mt-barra-fill').style.width).toBe('48%');
		expect(a.querySelector('[data-acao="teleporte"]').textContent).toBe('Ir caçar');
		expect(a.querySelector('.mt-eta').textContent).toBe('Campos de Prontera 08');
		expect(a.querySelector('[data-acao="finalizar"]')).toBeNull();

		const b = cartaoMontado.raiz.querySelector('.mt-bloco[data-missao="b"]');
		expect(b.querySelector('.mt-ativa-passo').textContent).toBe('Pronta para finalizar!');
		expect(b.classList.contains('is-pronta')).toBe(true);
		expect(b.querySelector('[data-acao="finalizar"]')).not.toBeNull();
		expect(b.querySelector('[data-acao="teleporte"]')).toBeNull();

		// A coleta sem mapa não tem para onde "Ir caçar".
		const c = cartaoMontado.raiz.querySelector('.mt-bloco[data-missao="c"]');
		expect(c.querySelector('[data-acao]')).toBeNull();
	});

	it('Finalizar e Ir caçar mandam a ação COM o id do bloco', async () => {
		cartaoMontado = await montarCartao(TRES, { aceitas: ['a', 'b', 'c'], maximo: 3 });
		cartaoMontado.raiz.querySelector('.mt-bloco[data-missao="b"] [data-acao="finalizar"]').click();
		cartaoMontado.raiz.querySelector('.mt-bloco[data-missao="a"] [data-acao="teleporte"]').click();
		expect(cartaoMontado.enviados()).toEqual([
			{ acao: 'finalizar', id: 'b' },
			{ acao: 'teleporte', id: 'a' }
		]);
	});

	it('com três aceitas, as linhas de "Iniciar" somem; sem a fila, nada diz "na fila"', async () => {
		cartaoMontado = await montarCartao(TRES, { aceitas: ['a', 'b', 'c'], maximo: 3 });
		expect(cartaoMontado.raiz.querySelector('[data-acao="iniciar"]')).toBeNull();
		expect(cartaoMontado.raiz.textContent.toLowerCase()).not.toContain('na fila');
		expect(cartaoMontado.raiz.textContent).not.toContain('Retomar');
	});

	it('abaixo do teto, a linha de "Iniciar" e o "(i)" são IRMÃOS no `<li>`', async () => {
		cartaoMontado = await montarCartao([TRES[0], missao('d')], { aceitas: ['a'], maximo: 3 });
		const linha = cartaoMontado.raiz.querySelector('.mt-lista li.mt-linha');
		const iniciar = linha.querySelector(':scope > button.mt-item[data-acao="iniciar"]');
		const info = linha.querySelector(':scope > button[data-info="d"]');
		expect(iniciar).not.toBeNull();
		expect(info).not.toBeNull();
		expect(iniciar.contains(info)).toBe(false);
		iniciar.click();
		expect(cartaoMontado.enviados()).toContainEqual({ acao: 'iniciar', id: 'd' });
	});

	it('o "(i)" abre o painel da missão, sobe o cartão acima da moldura, e o mesmo "(i)" fecha', async () => {
		cartaoMontado = await montarCartao(TRES, { aceitas: ['a', 'b', 'c'], maximo: 3 });
		const { raiz } = cartaoMontado;
		const i = () => raiz.querySelector('.mt-bloco[data-missao="a"] [data-info="a"]');
		i().click();
		const painel = raiz.querySelector('#MissoesTrackerIdle > .im-painel');
		expect(painel.classList.contains('is-aberto')).toBe(true);
		expect(painel.textContent).toContain('Missão a');
		expect(raiz.dataset.infoDaMissao).toBe('aberta');

		i().click();
		expect(painel.classList.contains('is-aberto')).toBe(false);
		expect(raiz.dataset.infoDaMissao).toBeUndefined();
	});

	it('o "(i)" de outra missão TROCA o painel (um só por vez)', async () => {
		cartaoMontado = await montarCartao(TRES, { aceitas: ['a', 'b', 'c'], maximo: 3 });
		const { raiz } = cartaoMontado;
		raiz.querySelector('[data-info="a"]').click();
		raiz.querySelector('[data-info="c"]').click();
		const paineis = raiz.querySelectorAll('.im-painel.is-aberto');
		expect(paineis).toHaveLength(1);
		expect(paineis[0].textContent).toContain('Missão c');
	});

	it('trocar de personagem fecha o painel', async () => {
		cartaoMontado = await montarCartao(TRES, { aceitas: ['a', 'b', 'c'], maximo: 3 });
		const { raiz, Tracker } = cartaoMontado;
		raiz.querySelector('[data-info="a"]').click();
		Tracker.limparEstadoDoPersonagem();
		expect(raiz.querySelector('.im-painel.is-aberto')).toBeNull();
	});
});
