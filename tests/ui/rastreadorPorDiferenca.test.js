/**
 * A DIFERENÇA DO RASTREADOR DO CODEX (`v: 5`, D-2543, 15/10/2026).
 *
 * O servidor manda só as TROCAS do contador (`{v: 5, parcial:
 * 'codexRastreadoDif', de, rev, trocas}`) para o cliente que DECLAROU que sabe
 * aplicar; o cliente que não declara segue com o `v: 2` inteiro. Três metades:
 *
 *  1. o módulo PURO (`rastreadorDoCodex.js`): anotar com a revisão, aplicar a
 *     diferença só sobre `de`, recusar o que não cai, declarar na primeira vez
 *     e na conexão nova;
 *  2. a COSTURA em `MissoesIdle.js`, pelo gancho de verdade: o inteiro declara,
 *     a diferença aplica sem tocar a lista de missões, a que não cai pede a
 *     lista inteira UMA vez;
 *  3. o ORÁCULO do DOM: uma sequência sorteada passada como diferenças e a
 *     MESMA sequência passada como inteiros desenham o cartão da HUD igual,
 *     passo a passo (`.mt-codex-lista` e o número da aba "Codex").
 *
 * O par do lado do servidor (a diferença que ele gera, aplicada por ESTE
 * módulo) é `servidor/mapa/rastreador-por-diferenca.test.ts`.
 *
 * @vitest-environment jsdom
 */
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
/* Os vizinhos que o CARTÃO importa e este arquivo não mede (o molde de
   `missoesSimultaneas.test.js`). */
vi.mock('UI/Components/BasicInfoIdle/BasicInfoIdle.js', () => ({ default: { _host: null } }));
vi.mock('UI/Components/LFGIdle/LFGIdle.js', () => ({ default: { toggle: vi.fn() } }));
vi.mock('UI/Components/CodexIdle/CodexIdle.js', () => ({ default: { abrirNaEntrada: vi.fn() } }));

const linha = (id, abates, alvo = 100, extra = {}) => ({
	id,
	titulo: `Entrada ${id}`,
	abates,
	alvo,
	cumprida: abates >= alvo,
	aResgatar: abates >= alvo,
	especies: [{ mobId: 1000 + id.length, monstro: `Bicho ${id}`, abates, alvo }],
	...extra
});

/* ═══════════════════════════════════════════════════════════════════════
   1. O MÓDULO PURO
   ═══════════════════════════════════════════════════════════════════════ */

describe('o módulo puro da diferença', () => {
	let m;
	beforeEach(async () => {
		vi.resetModules();
		m = await import('../../src/UI/Components/rastreadorDoCodex.js');
	});

	it('reconhece só `{v: 5, parcial: "codexRastreadoDif"}`', () => {
		expect(m.ehCorpoDiferencaDoRastreador({ v: 5, parcial: 'codexRastreadoDif', de: 1, rev: 2, trocas: [] })).toBe(true);
		expect(m.ehCorpoDiferencaDoRastreador({ v: 2, parcial: 'codexRastreado' })).toBe(false);
		expect(m.ehCorpoDiferencaDoRastreador({ v: 5, parcial: 'progresso' })).toBe(false);
		expect(m.ehCorpoDiferencaDoRastreador({ v: 4, parcial: 'codexRastreadoDif' })).toBe(false);
		expect(m.ehCorpoDiferencaDoRastreador(null)).toBe(false);
	});

	it('anota a revisão junto com a lista; sem número, nenhuma', () => {
		m.anotarRastreadorDoCodex([linha('a', 1)], 3);
		expect(m.revisaoDoRastreador()).toBe(3);
		m.anotarRastreadorDoCodex([linha('a', 1)]);
		expect(m.revisaoDoRastreador()).toBeNull();
		m.anotarRastreadorDoCodex([linha('a', 1)], '3');
		expect(m.revisaoDoRastreador()).toBeNull();
	});

	it('aplica as trocas sobre `de` e chega à MESMA lista que o inteiro traria', () => {
		m.anotarRastreadorDoCodex([linha('a', 57), linha('b', 3)], 1);
		const ok = m.aplicarDiferencaDoRastreador({
			v: 5,
			parcial: 'codexRastreadoDif',
			de: 1,
			rev: 2,
			trocas: [
				[[0, 'abates'], 58],
				[[0, 'especies', 0, 'abates'], 58]
			]
		});
		expect(ok).toBe(true);
		expect(m.revisaoDoRastreador()).toBe(2);
		expect(JSON.stringify(m.rastreadorDoCodexAtual())).toBe(JSON.stringify([linha('a', 58), linha('b', 3)]));
	});

	it('a troca da RAIZ (entrada que entra ou sai) troca a lista inteira', () => {
		m.anotarRastreadorDoCodex([linha('a', 1), linha('b', 2)], 4);
		expect(m.aplicarDiferencaDoRastreador({ v: 5, parcial: 'codexRastreadoDif', de: 4, rev: 5, trocas: [[[], [linha('b', 2)]]] })).toBe(true);
		expect(m.rastreadorDoCodexAtual()).toEqual([linha('b', 2)]);
	});

	it('não aplica sobre a lista que não é a do servidor; nada muda, e as seguintes também não caem até o inteiro', () => {
		m.anotarRastreadorDoCodex([linha('a', 10)], 7);
		const antes = m.rastreadorDoCodexAtual();
		expect(m.aplicarDiferencaDoRastreador({ v: 5, parcial: 'codexRastreadoDif', de: 6, rev: 7, trocas: [[[0, 'abates'], 99]] })).toBe(false);
		expect(m.rastreadorDoCodexAtual()).toBe(antes);
		expect(m.revisaoDoRastreador()).toBeNull();
		// A que viria a seguir (sobre a 7) também não cai: a revisão foi embora.
		expect(m.aplicarDiferencaDoRastreador({ v: 5, parcial: 'codexRastreadoDif', de: 7, rev: 8, trocas: [[[0, 'abates'], 11]] })).toBe(false);
		// O inteiro devolve a revisão, e a próxima cai.
		m.anotarRastreadorDoCodex([linha('a', 11)], 9);
		expect(m.aplicarDiferencaDoRastreador({ v: 5, parcial: 'codexRastreadoDif', de: 9, rev: 10, trocas: [[[0, 'abates'], 12]] })).toBe(true);
		expect(m.rastreadorDoCodexAtual()[0].abates).toBe(12);
	});

	it('sem revisão na mão (servidor antigo, ou ainda nada) a diferença não cai', () => {
		m.anotarRastreadorDoCodex([linha('a', 10)]);
		expect(m.aplicarDiferencaDoRastreador({ v: 5, parcial: 'codexRastreadoDif', de: 1, rev: 2, trocas: [] })).toBe(false);
	});

	it('trocas podres (caminho que atravessa folha, sem lista) não caem', () => {
		m.anotarRastreadorDoCodex([linha('a', 10)], 1);
		expect(m.aplicarDiferencaDoRastreador({ v: 5, parcial: 'codexRastreadoDif', de: 1, rev: 2, trocas: [[[0, 'abates', 'x'], 1]] })).toBe(false);
		m.anotarRastreadorDoCodex([linha('a', 10)], 1);
		expect(m.aplicarDiferencaDoRastreador({ v: 5, parcial: 'codexRastreadoDif', de: 1, rev: 2 })).toBe(false);
		m.anotarRastreadorDoCodex([linha('a', 10)], 1);
		expect(m.aplicarDiferencaDoRastreador({ v: 5, parcial: 'codexRastreadoDif', de: 1, rev: 2, trocas: [[[], { nao: 'lista' }]] })).toBe(false);
		expect(m.rastreadorDoCodexAtual()).toEqual([linha('a', 10)]);
	});

	it('declara no primeiro inteiro numerado, não nos seguintes, e de novo na conexão nova', () => {
		expect(m.declaracaoDoRastreador()).toBeNull(); // nada na mão
		m.anotarRastreadorDoCodex([], 1);
		expect(m.declaracaoDoRastreador()).toEqual({ acao: 'declarar-rastreador', base: 1 });
		m.anotarRastreadorDoCodex([], 5);
		expect(m.declaracaoDoRastreador()).toBeNull();
		// A conexão nova recomeça do 1: a revisão não passa da declarada.
		m.anotarRastreadorDoCodex([], 1);
		expect(m.declaracaoDoRastreador()).toEqual({ acao: 'declarar-rastreador', base: 1 });
		expect(m.ACAO_QUE_DECLARA_O_RASTREADOR).toBe('declarar-rastreador');
	});

	it('servidor antigo (inteiro sem revisão) não recebe declaração', () => {
		m.anotarRastreadorDoCodex([linha('a', 1)]);
		expect(m.declaracaoDoRastreador()).toBeNull();
	});

	it('trocar de personagem esquece a revisão e a declaração', () => {
		m.anotarRastreadorDoCodex([linha('a', 1)], 8);
		expect(m.declaracaoDoRastreador()).not.toBeNull();
		m.limparRastreadorDoCodex();
		expect(m.revisaoDoRastreador()).toBeNull();
		expect(m.rastreadorDoCodexAtual()).toEqual([]);
		m.anotarRastreadorDoCodex([], 9);
		expect(m.declaracaoDoRastreador()).toEqual({ acao: 'declarar-rastreador', base: 9 });
	});
});

/* ═══════════════════════════════════════════════════════════════════════
   2. A COSTURA NA JANELA DE MISSÕES, pelo gancho de verdade
   ═══════════════════════════════════════════════════════════════════════ */

async function montarJanela() {
	const { default: html } = await import('UI/Components/MissoesIdle/MissoesIdle.html?raw');
	const { default: MissoesIdle } = await import('UI/Components/MissoesIdle/MissoesIdle.js');
	const { default: Network } = await import('Network/NetworkManager.js');
	const { default: PACKET } = await import('Network/PacketStructure.js');
	const rastreador = await import('UI/Components/rastreadorDoCodex.js');

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
	Network.sendPacket.mockClear();

	const gancho = Network.hookPacket.mock.calls.filter(c => c[0] === PACKET.ZC.RAGIDLE_MISSOES).pop();
	const receber = corpo => gancho[1]({ json: JSON.stringify(corpo) });
	const declaracoes = () =>
		Network.sendPacket.mock.calls
			.map(c => c[0])
			.filter(p => p instanceof PACKET.CZ.RAGIDLE_MISSAO_ACAO)
			.map(p => JSON.parse(p.json))
			.filter(j => j.acao === 'declarar-rastreador');
	const pedidosDeLista = () =>
		Network.sendPacket.mock.calls.map(c => c[0]).filter(p => p instanceof PACKET.CZ.RAGIDLE_PEDIR_MISSOES).length;
	return { MissoesIdle, receber, declaracoes, pedidosDeLista, rastreador };
}

const inteiro = (codexRastreado, rev) => ({
	v: 1,
	missoes: [{ id: 'm', tipo: 'principal', titulo: 'M', estado: 'disponivel', objetivos: [], recompensas: [] }],
	execucao: { aceitas: [], maximo: 3 },
	codexComNovidade: false,
	codexRastreado,
	...(rev === undefined ? {} : { codexRastreadoRev: rev })
});

describe('a costura em MissoesIdle (D-2543)', () => {
	beforeEach(() => {
		localStorage.clear();
		vi.resetModules();
		document.body.innerHTML = '';
	});

	it('o inteiro numerado DECLARA com a revisão na mão; o seguinte, não', async () => {
		const { receber, declaracoes } = await montarJanela();
		receber(inteiro([linha('a', 1)], 1));
		expect(declaracoes()).toEqual([{ acao: 'declarar-rastreador', base: 1 }]);
		receber(inteiro([linha('a', 2)], 2));
		expect(declaracoes()).toHaveLength(1);
	});

	it('CONTROLE: o inteiro do servidor antigo (sem revisão) não declara', async () => {
		const { receber, declaracoes } = await montarJanela();
		receber(inteiro([linha('a', 1)]));
		expect(declaracoes()).toEqual([]);
	});

	it('o `v: 2` atualiza a revisão sem declarar', async () => {
		const { receber, declaracoes, rastreador } = await montarJanela();
		receber(inteiro([linha('a', 1)], 1));
		receber({ v: 2, parcial: 'codexRastreado', codexRastreado: [linha('a', 5)], codexRastreadoRev: 2 });
		expect(rastreador.revisaoDoRastreador()).toBe(2);
		expect(rastreador.rastreadorDoCodexAtual()[0].abates).toBe(5);
		expect(declaracoes()).toHaveLength(1);
	});

	it('a diferença anda o contador SEM tocar a lista de missões e sem pedir nada', async () => {
		const { MissoesIdle, receber, pedidosDeLista, rastreador } = await montarJanela();
		receber(inteiro([linha('a', 57)], 1));
		const lista = MissoesIdle.missoes;
		const pedidos = pedidosDeLista();
		receber({ v: 5, parcial: 'codexRastreadoDif', de: 1, rev: 2, trocas: [[[0, 'abates'], 58], [[0, 'especies', 0, 'abates'], 58]] });
		expect(JSON.stringify(rastreador.rastreadorDoCodexAtual())).toBe(JSON.stringify([linha('a', 58)]));
		expect(MissoesIdle.missoes).toBe(lista);
		expect(pedidosDeLista()).toBe(pedidos);
	});

	it('a diferença que não cai pede a lista inteira UMA vez, até ela chegar', async () => {
		const { receber, pedidosDeLista, rastreador } = await montarJanela();
		receber(inteiro([linha('a', 1)], 3));
		const antes = pedidosDeLista();
		const avisar = vi.spyOn(console, 'warn').mockImplementation(() => {});
		receber({ v: 5, parcial: 'codexRastreadoDif', de: 2, rev: 3, trocas: [] });
		receber({ v: 5, parcial: 'codexRastreadoDif', de: 3, rev: 4, trocas: [] });
		expect(pedidosDeLista() - antes).toBe(1);
		// O rastreador da tela é o de antes, nada aplicado por cima.
		expect(rastreador.rastreadorDoCodexAtual()).toEqual([linha('a', 1)]);
		// O inteiro chegou: o próximo desencontro pode pedir de novo.
		receber(inteiro([linha('a', 9)], 9));
		receber({ v: 5, parcial: 'codexRastreadoDif', de: 8, rev: 9, trocas: [] });
		expect(pedidosDeLista() - antes).toBe(2);
		avisar.mockRestore();
	});

	it('um erro na declaração não derruba o recebimento da lista', async () => {
		const { MissoesIdle, receber } = await montarJanela();
		const { default: Network } = await import('Network/NetworkManager.js');
		const errar = vi.spyOn(console, 'error').mockImplementation(() => {});
		Network.sendPacket.mockImplementationOnce(() => {
			throw new Error('rede caiu');
		});
		receber(inteiro([linha('a', 1)], 1));
		expect(MissoesIdle.recebeuAlgumaVez).toBe(true);
		expect(MissoesIdle.missoes.map(m => m.id)).toEqual(['m']);
		errar.mockRestore();
	});
});

/* ═══════════════════════════════════════════════════════════════════════
   3. O ORÁCULO DO DOM: diferenças e inteiros desenham o mesmo cartão
   ═══════════════════════════════════════════════════════════════════════ */

/** O gerador do teste (xorshift): a mesma semente, a mesma sequência. */
function sorteador(semente) {
	let x = semente >>> 0 || 1;
	return n => {
		x ^= x << 13;
		x ^= x >>> 17;
		x ^= x << 5;
		return (x >>> 0) % n;
	};
}

/**
 * As trocas que levam `antes` a `depois` — a mesma regra estrutural de
 * `trocasEntre` do servidor (`servidor/temporada/parcial-da-temporada.ts`):
 * desce em objeto com as mesmas chaves e em lista do mesmo tamanho, troca
 * inteiro o primeiro nó que não bate. Só aqui no teste, para fabricar o fio;
 * quem confere o gerador DE VERDADE contra este módulo é o teste do servidor.
 */
function trocasEntre(antes, depois, caminho = []) {
	if (antes === depois) return [];
	if (Array.isArray(antes) && Array.isArray(depois) && antes.length === depois.length) {
		return depois.flatMap((d, i) => trocasEntre(antes[i], d, [...caminho, i]));
	}
	const objeto = v => typeof v === 'object' && v !== null && !Array.isArray(v);
	if (objeto(antes) && objeto(depois)) {
		const ka = Object.keys(antes);
		const kd = Object.keys(depois);
		if (ka.length === kd.length && kd.every(k => Object.prototype.hasOwnProperty.call(antes, k))) {
			return kd.flatMap(k => trocasEntre(antes[k], depois[k], [...caminho, k]));
		}
	}
	if (JSON.stringify(antes) === JSON.stringify(depois)) return [];
	return [[caminho, depois]];
}

/** Uma sequência de rastreadores do servidor: abates, entradas que entram e saem, o prêmio. */
function sequencia(semente, passos) {
	const n = sorteador(semente);
	let atual = [linha('a', 0, 50), linha('bb', 10, 200)];
	const estados = [atual];
	let proximoId = 0;
	for (let i = 0; i < passos; i++) {
		const s = n(100);
		const copia = JSON.parse(JSON.stringify(atual));
		if (s < 70 && copia.length > 0) {
			const l = copia[n(copia.length)];
			const e = l.especies[0];
			e.abates = Math.min(e.alvo, e.abates + 1 + n(30));
			l.abates = e.abates;
			l.cumprida = l.abates >= l.alvo;
			l.aResgatar = l.cumprida;
		} else if (s < 82 && copia.length < 5) {
			proximoId++;
			copia.push(linha(`n${proximoId}`, n(40), 40 + n(500)));
		} else if (s < 92 && copia.length > 0) {
			copia.splice(n(copia.length), 1);
		}
		atual = copia;
		estados.push(atual);
	}
	return estados;
}

async function montarCartao() {
	const { default: html } = await import('UI/Components/MissoesTrackerIdle/MissoesTrackerIdle.html?raw');
	const { default: Tracker } = await import('UI/Components/MissoesTrackerIdle/MissoesTrackerIdle.js');
	Tracker._host = document.createElement('div');
	Tracker._host.innerHTML = html;
	Tracker._shadow = null;
	document.body.appendChild(Tracker._host);
	Tracker.limparEstadoDoPersonagem();
	Tracker.init();
	return Tracker;
}

/** O que o jogador vê do rastreador no cartão, depois de um redesenho. */
function fotografia(Tracker) {
	Tracker.onAppend(); // o redesenho do polling, agora
	const raiz = Tracker._host;
	return [
		raiz.querySelector('.mt-codex-lista').innerHTML,
		raiz.querySelector('.mt-codex').dataset.vazia,
		raiz.querySelector('.mt-aba[data-aba="codex"] .mt-aba-n').textContent
	].join('\n§\n');
}

/** Passa a sequência pelo gancho de verdade: `porDiferenca` manda `v: 5` quando cabe. */
async function desenharSequencia(estados, porDiferenca) {
	vi.resetModules();
	document.body.innerHTML = '';
	const janela = await montarJanela();
	const Tracker = await montarCartao();
	const fotos = [];
	let rev = 1;
	janela.receber(inteiro(estados[0], rev));
	fotos.push(fotografia(Tracker));
	let diferencas = 0;
	for (let i = 1; i < estados.length; i++) {
		const de = rev;
		rev++;
		const trocas = trocasEntre(estados[i - 1], estados[i]);
		if (porDiferenca && trocas.length > 0 && trocas.every(t => t[0].length > 0)) {
			janela.receber({ v: 5, parcial: 'codexRastreadoDif', de, rev, trocas });
			diferencas++;
		} else if (i % 25 === 0) {
			// De vez em quando a lista inteira (abrir a janela, marcar): os dois lados.
			janela.receber(inteiro(estados[i], rev));
		} else {
			janela.receber({ v: 2, parcial: 'codexRastreado', codexRastreado: estados[i], codexRastreadoRev: rev });
		}
		fotos.push(fotografia(Tracker));
	}
	Tracker.onRemove();
	return { fotos, diferencas, pedidos: janela.pedidosDeLista() };
}

describe('o oráculo do DOM: diferenças e inteiros desenham o mesmo cartão (D-2543)', () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	it('6 sementes x 150 passos: cada fotografia do cartão é igual nos dois caminhos', async () => {
		let diferencas = 0;
		for (let semente = 1; semente <= 6; semente++) {
			const estados = sequencia(semente * 7919, 150);
			const comDiferenca = await desenharSequencia(estados, true);
			const comInteiros = await desenharSequencia(estados, false);
			expect(comDiferenca.fotos).toHaveLength(estados.length);
			for (let i = 0; i < estados.length; i++) {
				expect(comDiferenca.fotos[i], `semente ${semente}, passo ${i}`).toBe(comInteiros.fotos[i]);
			}
			// Nenhuma diferença deixou de cair (nenhum pedido da lista).
			expect(comDiferenca.pedidos).toBe(0);
			diferencas += comDiferenca.diferencas;
		}
		// O critério não pode passar com zero: houve diferença de verdade.
		expect(diferencas).toBeGreaterThan(400);
	});

	it('CONTROLE: o cartão mostra o contador que a diferença trouxe (a fotografia mede alguma coisa)', async () => {
		const estados = [[linha('a', 1, 50)], [linha('a', 2, 50)]];
		const { fotos } = await desenharSequencia(estados, true);
		expect(fotos[0]).toContain('1/50');
		expect(fotos[1]).toContain('2/50');
		expect(fotos[1]).not.toBe(fotos[0]);
	});
});
