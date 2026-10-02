/**
 * A JANELA "TRADE" (02/10/2026, pedido do dono).
 *
 * Tres partes:
 *  1. o CONTROLADOR no jsdom, com o HTML de verdade e um relogio manual: o
 *     campo unico, o "Confirmar", a trava, a frase do servidor (ok e recusa),
 *     o tempo-limite e a resposta NATIVA (a troca abriu -> a janela sai; o
 *     outro recusou -> o motivo fica);
 *  2. o PACOTE: o `build()` do 0x0fb2 com nome acentuado sai com o
 *     comprimento dos bytes UTF-8 e sem zero no fim (o defeito do PIX);
 *  3. a COSTURA, lendo o fonte (o MapEngine nao carrega no jsdom): o botao
 *     "Troca" do menu deixou de ser "em breve" e abre a janela nos DOIS
 *     switches, a janela entra na pilha (ESC, celular) e na limpeza da troca
 *     de personagem, e o 0x0fb3 e o 0x01f5 continuam com UM dono cada.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import PACKET from 'Network/PacketStructure.js';
import {
	criarControladorDaTroca,
	nomeParaEnvio,
	RESPOSTA_ACEITOU,
	RESPOSTA_CANCELOU,
	TIMEOUT_DO_PEDIDO_MS
} from 'UI/Components/TrocaIdle/controladorDaTroca.js';

const ler = rel => readFileSync(join(process.cwd(), rel), 'utf8');
const HTML = ler('src/UI/Components/TrocaIdle/TrocaIdle.html');

function relogio() {
	let agora = 0;
	const fila = [];
	return {
		agendar: (fn, ms) => {
			const item = { fn, quando: agora + ms, vivo: true };
			fila.push(item);
			return item;
		},
		cancelar: item => {
			if (item) {
				item.vivo = false;
			}
		},
		/** Avanca o relogio e dispara o que venceu, em ordem. */
		avancar(ms) {
			agora += ms;
			for (const item of fila.filter(i => i.vivo && i.quando <= agora).sort((a, b) => a.quando - b.quando)) {
				item.vivo = false;
				item.fn();
			}
		}
	};
}

function montar() {
	const raiz = document.createElement('div');
	raiz.innerHTML = HTML;
	document.body.appendChild(raiz);
	const enviados = [];
	const r = relogio();
	let fechou = 0;
	const c = criarControladorDaTroca({
		raiz,
		enviar: corpo => enviados.push(JSON.parse(JSON.stringify(corpo))),
		fechar: () => {
			fechou += 1;
		},
		agendar: r.agendar,
		cancelar: r.cancelar
	});
	const $ = sel => raiz.querySelector(sel);
	const digitar = valor => {
		$('.tr-nome').value = valor;
	};
	const recado = () => $('.tr-recado').textContent;
	const tom = () => $('.tr-recado').className;
	const botaoTravado = () => $('.tr-confirmar').disabled;
	return { c, enviados, r, $, digitar, recado, tom, botaoTravado, fechou: () => fechou };
}

const resposta = (sobre = {}) => ({
	v: 1,
	acao: 'pedir',
	ok: true,
	motivo: null,
	texto: 'Pedido de troca enviado a Ana. Aguarde a resposta.',
	nome: 'Ana',
	...sobre
});

/* ================================================================== */
/* 1. O controlador                                                    */
/* ================================================================== */

describe('a janela "Trade": o HTML', () => {
	it('tem o titulo "Trade", UM campo (o nome) e o botao "Confirmar"', () => {
		const t = montar();
		expect(t.$('.tr-title').textContent.trim()).toBe('Trade');
		expect(t.$('.tr-body').querySelectorAll('input, select, textarea')).toHaveLength(1);
		expect(t.$('.tr-nome').getAttribute('maxlength')).toBe('23');
		expect(t.$('.tr-confirmar').textContent.trim()).toBe('Confirmar');
		expect(t.$('.tr-confirmar').getAttribute('type')).toBe('submit');
	});

	it('o teclado do celular nao "corrige" o nome: sem autocorrecao e sem maiuscula automatica', () => {
		const t = montar();
		expect(t.$('.tr-nome').getAttribute('autocorrect')).toBe('off');
		expect(t.$('.tr-nome').getAttribute('autocapitalize')).toBe('off');
		expect(t.$('.tr-nome').getAttribute('spellcheck')).toBe('false');
	});
});

describe('a janela "Trade": o controlador', () => {
	it('nome vazio: avisa na tela e NAO manda nada', () => {
		const t = montar();
		t.digitar('   ');
		expect(t.c.confirmar()).toBe(false);
		expect(t.enviados).toEqual([]);
		expect(t.recado()).toBe('Digite o nome do personagem.');
		expect(t.tom()).toContain('is-erro');
	});

	it('Confirmar manda o pedido com o nome aparado e trava o botao ate a resposta', () => {
		const t = montar();
		t.digitar('  Ana  ');
		expect(t.c.confirmar()).toBe(true);
		expect(t.enviados).toEqual([{ acao: 'pedir', nome: 'Ana' }]);
		expect(t.botaoTravado()).toBe(true);
		// o segundo toque com o pedido no ar nao sai
		expect(t.c.confirmar()).toBe(false);
		expect(t.enviados).toHaveLength(1);
	});

	it('a resposta ok: a frase do servidor em verde, e o botao destrava', () => {
		const t = montar();
		t.digitar('Ana');
		t.c.confirmar();
		expect(t.c.receber(resposta())).toBe(true);
		expect(t.recado()).toBe('Pedido de troca enviado a Ana. Aguarde a resposta.');
		expect(t.tom()).toContain('is-ok');
		expect(t.botaoTravado()).toBe(false);
	});

	it('a recusa: a frase do MOTIVO em vermelho (longe, sem VIP...)', () => {
		const t = montar();
		t.digitar('Ana');
		t.c.confirmar();
		t.c.receber(
			resposta({ ok: false, motivo: 'longe', texto: 'Ana está a 14 células de você. Chegue a até 2 células para trocar.' })
		);
		expect(t.recado()).toBe('Ana está a 14 células de você. Chegue a até 2 células para trocar.');
		expect(t.tom()).toContain('is-erro');
		expect(t.botaoTravado()).toBe(false);
	});

	it('sem resposta em 10 s: "o servidor nao respondeu", e da para tentar de novo', () => {
		const t = montar();
		t.digitar('Ana');
		t.c.confirmar();
		t.r.avancar(TIMEOUT_DO_PEDIDO_MS - 1);
		expect(t.botaoTravado()).toBe(true);
		t.r.avancar(1);
		expect(t.recado()).toBe('O servidor não respondeu. Tente de novo.');
		expect(t.botaoTravado()).toBe(false);
		expect(t.c.confirmar()).toBe(true);
	});

	it('a resposta que chega cancela o tempo-limite', () => {
		const t = montar();
		t.digitar('Ana');
		t.c.confirmar();
		t.c.receber(resposta());
		t.r.avancar(TIMEOUT_DO_PEDIDO_MS * 2);
		expect(t.recado()).toBe('Pedido de troca enviado a Ana. Aguarde a resposta.');
	});

	it('o outro ACEITOU (resposta nativa 3): a janela de troca abriu e esta sai da frente', () => {
		const t = montar();
		t.digitar('Ana');
		t.c.confirmar();
		t.c.receber(resposta());
		expect(t.c.receberRespostaNativa(RESPOSTA_ACEITOU)).toBe(true);
		expect(t.fechou()).toBe(1);
		expect(t.recado()).toBe('');
	});

	it('o outro RECUSOU (resposta nativa 4): o motivo fica na janela', () => {
		const t = montar();
		t.digitar('Ana');
		t.c.confirmar();
		t.c.receber(resposta());
		expect(t.c.receberRespostaNativa(RESPOSTA_CANCELOU)).toBe(true);
		expect(t.recado()).toBe('Ana recusou o pedido de troca.');
		expect(t.tom()).toContain('is-erro');
		expect(t.fechou()).toBe(0);
	});

	it('a resposta nativa SEM pedido desta janela no ar e de outra troca: nao mexe em nada', () => {
		const t = montar();
		expect(t.c.receberRespostaNativa(RESPOSTA_ACEITOU)).toBe(false);
		t.digitar('Ana');
		t.c.confirmar();
		t.c.receber(resposta({ ok: false, motivo: 'outro-sem-vip', texto: 'sem VIP' }));
		expect(t.c.receberRespostaNativa(RESPOSTA_ACEITOU)).toBe(false);
		expect(t.fechou()).toBe(0);
	});

	it('so le o que e dela: outra acao ou corpo torto e ignorado', () => {
		const t = montar();
		expect(t.c.receber(null)).toBe(false);
		expect(t.c.receber({ acao: 'outra' })).toBe(false);
		expect(t.recado()).toBe('');
	});

	it('abrir de novo comeca limpo', () => {
		const t = montar();
		t.digitar('');
		t.c.confirmar();
		expect(t.recado()).not.toBe('');
		t.c.aoAbrir();
		expect(t.recado()).toBe('');
		expect(t.tom()).toBe('tr-recado');
	});

	it('nomeParaEnvio apara e nao mexe na caixa', () => {
		expect(nomeParaEnvio('  Anã Conceição ')).toBe('Anã Conceição');
		expect(nomeParaEnvio(null)).toBe('');
	});
});

/* ================================================================== */
/* 2. O pacote                                                         */
/* ================================================================== */

describe('o 0x0fb2 (CZ_RAGIDLE_TROCA_ACAO)', () => {
	it('nome com acento: comprimento = bytes UTF-8, sem zero no fim, JSON intacto', () => {
		const corpo = { acao: 'pedir', nome: 'Anã Conceição' };
		const json = JSON.stringify(corpo);
		const pkt = new PACKET.CZ.RAGIDLE_TROCA_ACAO();
		pkt.json = json;
		const bytes = new Uint8Array(pkt.build().buffer);
		expect(bytes[0] | (bytes[1] << 8)).toBe(0x0fb2);
		const comprimento = bytes[2] | (bytes[3] << 8);
		expect(comprimento).toBe(4 + new TextEncoder().encode(json).length);
		expect(bytes.length).toBe(comprimento);
		const texto = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(4));
		expect(JSON.parse(texto)).toEqual(corpo);
	});

	it('o 0x0fb3 e lido como JSON pelo parser registrado', () => {
		expect(PACKET.ZC.RAGIDLE_TROCA.size).toBe(-1);
	});
});

/* ================================================================== */
/* 3. A costura                                                        */
/* ================================================================== */

describe('a costura da janela "Trade"', () => {
	const MENU_HTML = ler('src/UI/Components/TopMenuIdle/TopMenuIdle.html');
	const MENU_JS = ler('src/UI/Components/TopMenuIdle/TopMenuIdle.js');
	const MAP_ENGINE = ler('src/Engine/MapEngine.js');
	const REGISTRO = ler('src/Network/PacketRegister.js');
	const TAMANHOS = ler('src/Network/Packets/packets2021_len_main.js');

	it('o botao "Troca" do menu deixou de ser "em breve"', () => {
		const botao = MENU_HTML.match(/<button[^>]*data-action="troca"[^>]*>/);
		expect(botao, 'o botao da Troca sumiu do menu').not.toBeNull();
		expect(botao[0]).not.toContain('data-em-breve');
		expect(botao[0]).not.toContain('aria-disabled');
	});

	it('o clique abre a janela, e o aro acende com ela aberta (os DOIS switches)', () => {
		expect(MENU_JS).toMatch(/case 'troca':\s*\/\*[^*]*\*\/\s*TrocaIdle\.toggle\(\);/);
		expect(MENU_JS).toContain("case 'troca':\n\t\t\treturn isRagIdleWindowOpen(TrocaIdle, '.tr-window');".replace(/\n/g, MENU_JS.includes('\r\n') ? '\r\n' : '\n'));
	});

	it('a janela entra na pilha (ESC, voltar do Android, painel do celular) e na limpeza da troca de personagem', () => {
		expect(MAP_ENGINE).toContain("['troca', TrocaIdle, '.tr-window']");
		expect(MAP_ENGINE).toContain('TrocaIdle.prepare();');
		expect(MAP_ENGINE).toContain('TrocaIdle.append();');
		expect(MAP_ENGINE).toMatch(/IndicacaoIdle,\s*TrocaIdle,\s*RankingIdle,/);
	});

	it('o 0x0fb3 tem dono e tamanho; o 0x0fb2 tem tamanho', () => {
		expect(REGISTRO).toContain('0x0fb3: PACKET.ZC.RAGIDLE_TROCA,');
		expect(TAMANHOS).toContain('length_list[0x0fb2] = -1;');
		expect(TAMANHOS).toContain('length_list[0x0fb3] = -1;');
	});

	it('um dono por pacote: a janela fisga SO o 0x0fb3, e ouve o 0x01f5 pela assinatura do Trade.js', () => {
		const janela = ler('src/UI/Components/TrocaIdle/TrocaIdle.js');
		const ganchos = [...janela.matchAll(/Network\.hookPacket\(PACKET\.ZC\.([A-Z0-9_]+)/g)].map(m => m[1]);
		expect(ganchos).toEqual(['RAGIDLE_TROCA']);
		expect(janela).toContain('aoResponderPedidoDeTroca(');
		const engine = ler('src/Engine/MapEngine/Trade.js');
		expect(engine).toContain('avisarOuvintesDaResposta(pkt.result);');
	});
});
