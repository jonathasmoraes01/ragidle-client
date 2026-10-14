/**
 * O PAPEL NA JANELA DE TROCA (14/10/2026, R127, D-2476; decisao 6 do dono:
 * o VIP da, o FREE so recebe).
 *
 * Tres partes:
 *  1. a REGRA do cliente (`papelDaTroca.js`): o pacote lido, e a conta de
 *     barrar a oferta, igual a do servidor (`ofertaBarradaPorVip`): item
 *     sempre, zeny so acima de zero;
 *  2. a JANELA no jsdom, com o `Trade.html` de verdade: o lado FREE ve a
 *     faixa, a coluna da oferta marcada e o zeny travado em 0; o lado VIP ve
 *     a faixa e o zeny livre; sem papel, a janela de sempre; a recusa pisca;
 *  3. a COSTURA, lendo o fonte (o `Trade.js` puxa o motor inteiro e nao
 *     carrega no jsdom): o arrasto, o pedido de oferta e o "Confirmar"
 *     perguntam o papel; a abertura comeca sem papel; o 0x0fb3 continua com
 *     UM dono (a TrocaIdle) e passa o papel ao motor da troca antes de olhar
 *     o proprio controlador; a janela cabe no celular em pe.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	aplicarPapel,
	ofertaBarradaPeloPapel,
	papelDoPacote,
	piscarRecusa
} from 'UI/Components/Trade/papelDaTroca.js';

const ler = rel => readFileSync(join(process.cwd(), rel), 'utf8').replace(/\r\n/g, '\n');
const HTML = ler('src/UI/Components/Trade/Trade.html');

const FRASE_DO_FREE = 'Na troca, a conta FREE só recebe: só quem tem VIP oferece itens e zeny.';
const FRASE_DO_VIP = 'Este jogador não tem VIP: nesta troca só você oferece itens e zeny.';
const FREE = { podeOferecer: false, texto: FRASE_DO_FREE };
const VIP = { podeOferecer: true, texto: FRASE_DO_VIP };

function montar() {
	// Uma janela por vez no documento: com duas, o `#Trade` da raiz seguinte
	// resolve pelo id do documento (o primeiro) e volta nulo.
	document.body.innerHTML = '';
	const raiz = document.createElement('div');
	raiz.innerHTML = HTML;
	document.body.appendChild(raiz);
	const $ = sel => raiz.querySelector(sel);
	return { raiz, $ };
}

describe('o papel: a regra do cliente', () => {
	it('le so o corpo de papel bem formado', () => {
		expect(papelDoPacote({ v: 1, acao: 'papel', podeOferecer: false, texto: FRASE_DO_FREE })).toEqual(FREE);
		expect(papelDoPacote({ v: 1, acao: 'papel', podeOferecer: true, texto: FRASE_DO_VIP })).toEqual(VIP);
		expect(papelDoPacote({ v: 1, acao: 'papel', podeOferecer: false })).toEqual({ podeOferecer: false, texto: '' });
		expect(papelDoPacote(null)).toBeNull();
		expect(papelDoPacote({ v: 1, acao: 'pedir', ok: true })).toBeNull();
		expect(papelDoPacote({ v: 1, acao: 'papel', podeOferecer: 'nao' })).toBeNull();
	});

	it('o lado FREE nao poe item nem zeny; o zeny 0 do "Confirmar" passa', () => {
		expect(ofertaBarradaPeloPapel(FREE, false, 1)).toBe(true);
		expect(ofertaBarradaPeloPapel(FREE, false, 0)).toBe(true);
		expect(ofertaBarradaPeloPapel(FREE, true, 500)).toBe(true);
		expect(ofertaBarradaPeloPapel(FREE, true, 0)).toBe(false);
	});

	it('o lado VIP, e a troca sem papel (VIP com VIP), poem tudo', () => {
		expect(ofertaBarradaPeloPapel(VIP, false, 1)).toBe(false);
		expect(ofertaBarradaPeloPapel(VIP, true, 500)).toBe(false);
		expect(ofertaBarradaPeloPapel(null, false, 1)).toBe(false);
		expect(ofertaBarradaPeloPapel(null, true, 500)).toBe(false);
	});
});

describe('o papel: a janela de troca', () => {
	it('o HTML tem a faixa do papel (escondida) e a coluna da oferta marcada', () => {
		const t = montar();
		const faixa = t.$('.trade-papel');
		expect(faixa).not.toBeNull();
		expect(faixa.hidden).toBe(true);
		expect(faixa.getAttribute('role')).toBe('status');
		expect(t.$('.trade-col--oferta .box.send')).not.toBeNull();
		expect(t.$('.trade-col--oferta .zeny.send')).not.toBeNull();
	});

	it('o lado FREE: a faixa diz que so recebe, a oferta apaga e o zeny trava em 0', () => {
		const t = montar();
		t.$('.zeny.send').value = '1234';
		aplicarPapel(t.raiz, FREE);
		expect(t.$('.trade-papel').hidden).toBe(false);
		expect(t.$('.trade-papel').textContent).toBe(FRASE_DO_FREE);
		expect(t.$('#Trade').classList.contains('so-recebe')).toBe(true);
		expect(t.$('#Trade').classList.contains('so-voce-oferece')).toBe(false);
		expect(t.$('.zeny.send').value).toBe('0');
		expect(t.$('.zeny.send').disabled).toBe(true);
		expect(t.$('.zeny.send').classList.contains('disabled')).toBe(true);
	});

	it('o lado VIP: a faixa diz que so ele oferece, e o zeny segue livre', () => {
		const t = montar();
		t.$('.zeny.send').value = '300';
		aplicarPapel(t.raiz, VIP);
		expect(t.$('.trade-papel').hidden).toBe(false);
		expect(t.$('.trade-papel').textContent).toBe(FRASE_DO_VIP);
		expect(t.$('#Trade').classList.contains('so-recebe')).toBe(false);
		expect(t.$('#Trade').classList.contains('so-voce-oferece')).toBe(true);
		expect(t.$('.zeny.send').value).toBe('300');
		expect(t.$('.zeny.send').disabled).toBe(false);
	});

	it('sem papel (VIP com VIP, ou a troca seguinte): a janela de sempre', () => {
		const t = montar();
		aplicarPapel(t.raiz, FREE);
		aplicarPapel(t.raiz, null);
		expect(t.$('.trade-papel').hidden).toBe(true);
		expect(t.$('.trade-papel').textContent).toBe('');
		expect(t.$('#Trade').classList.contains('so-recebe')).toBe(false);
		expect(t.$('#Trade').classList.contains('so-voce-oferece')).toBe(false);
	});

	it('a recusa pisca a faixa, e cada recusa recomeca', () => {
		const t = montar();
		aplicarPapel(t.raiz, FREE);
		piscarRecusa(t.raiz);
		expect(t.$('.trade-papel').classList.contains('is-recusa')).toBe(true);
		piscarRecusa(t.raiz);
		expect(t.$('.trade-papel').classList.contains('is-recusa')).toBe(true);
		// O papel de novo (a troca seguinte) apaga o vermelho.
		aplicarPapel(t.raiz, FREE);
		expect(t.$('.trade-papel').classList.contains('is-recusa')).toBe(false);
	});

	it('raiz ausente (janela ainda nao preparada) nao quebra', () => {
		expect(() => aplicarPapel(undefined, FREE)).not.toThrow();
		expect(() => piscarRecusa(null)).not.toThrow();
	});
});

describe('o papel: a costura', () => {
	const JANELA = ler('src/UI/Components/Trade/Trade.js');
	const MOTOR = ler('src/Engine/MapEngine/Trade.js');
	const TROCA_IDLE = ler('src/UI/Components/TrocaIdle/TrocaIdle.js');
	const CSS = ler('src/UI/Components/Trade/Trade.css');

	/** O corpo de uma funcao `function nome(` ate a primeira `}` na coluna 0. */
	const corpo = (fonte, cabeca) => {
		const inicio = fonte.indexOf(cabeca);
		expect(inicio, cabeca).toBeGreaterThanOrEqual(0);
		return fonte.slice(inicio, fonte.indexOf('\n}', inicio));
	};

	it('o pedido de oferta pergunta o papel ANTES de mandar qualquer coisa', () => {
		const f = corpo(JANELA, 'function onRequestAddItem(');
		const pergunta = f.indexOf('ofertaBarradaPeloPapel(_papel, index === 0, count)');
		expect(pergunta).toBeGreaterThan(0);
		expect(pergunta).toBeLessThan(f.indexOf('Trade.reqAddItem('));
		expect(f).toContain('recusarOferta();');
	});

	it('o arrasto recusa ANTES de pedir a quantidade', () => {
		const f = corpo(JANELA, 'function onDrop(');
		const pergunta = f.indexOf('ofertaBarradaPeloPapel(_papel, false, 1)');
		expect(pergunta).toBeGreaterThan(0);
		expect(pergunta).toBeLessThan(f.indexOf('InputBox.append()'));
	});

	it('o "Confirmar" do lado FREE manda zeny 0', () => {
		const f = corpo(JANELA, 'function onConclude(');
		expect(f).toContain('if (ofertaBarradaPeloPapel(_papel, true, zeny)) {\n\t\tzeny = 0;');
		expect(f.indexOf('zeny = 0;')).toBeLessThan(f.indexOf('onRequestAddItem(0, zeny)'));
	});

	it('o toque na coluna da oferta do lado FREE e recusado na tela', () => {
		expect(JANELA).toContain("root.querySelector('.trade-col--oferta')");
		expect(JANELA).toContain(
			"colunaDaOferta.addEventListener('click', () => {\n\t\t\tif (ofertaBarradaPeloPapel(_papel, false, 1)) {\n\t\t\t\trecusarOferta();"
		);
	});

	it('a recusa diz a frase do servidor no chat e pisca a faixa', () => {
		const f = corpo(JANELA, 'function recusarOferta(');
		expect(f).toContain('ChatBox.addText(_papel.texto, ChatBox.TYPE.ERROR');
		expect(f).toContain('piscarRecusa(Trade.getRoot())');
	});

	it('a janela aplica o papel ao abrir e o esquece ao fechar', () => {
		const abrir = corpo(JANELA, 'Trade.onAppend = function onAppend(');
		expect(abrir.indexOf('aplicarPapel(root, _papel)')).toBeGreaterThan(abrir.indexOf('resetUI.call(this)'));
		expect(corpo(JANELA, 'Trade.onRemove = function onRemove(')).toContain('_papel = null;');
		expect(corpo(JANELA, 'Trade.definirPapel = function definirPapel(')).toContain('_papel = papelDoPacote(dados);');
	});

	it('a troca nova comeca sem papel: o motor zera ANTES de abrir a janela', () => {
		const f = corpo(MOTOR, 'function onTradeRequestAnswer(');
		const zera = f.indexOf('Trade.definirPapel(null);');
		expect(zera).toBeGreaterThan(0);
		expect(zera).toBeLessThan(f.indexOf('Trade.append();'));
		expect(MOTOR).toContain('export function receberPapelDaTroca(dados) {\n\tTrade.definirPapel(dados);');
	});

	it('o 0x0fb3 segue com UM dono, e o papel passa ao motor antes do controlador da janela "Trade"', () => {
		expect(TROCA_IDLE.match(/Network\.hookPacket\(/g)).toHaveLength(1);
		expect(MOTOR).not.toContain('PACKET.ZC.RAGIDLE_TROCA');
		const f = corpo(TROCA_IDLE, 'function onTrocaRecebida(');
		// A primeira guarda nao olha o controlador: o papel chega mesmo com a
		// janela "Trade" do menu nunca preparada.
		expect(f).toContain('if (!dados || dados.v !== 1) {\n\t\treturn;\n\t}');
		const papel = f.indexOf("if (dados.acao === 'papel') {\n\t\treceberPapelDaTroca(dados);");
		expect(papel).toBeGreaterThan(0);
		expect(papel).toBeLessThan(f.indexOf('if (!_controlador)'));
	});

	it('a janela cabe no celular em pe (min() no host, botoes dividindo a largura)', () => {
		expect(CSS).toContain('width: min(560px, calc(100vw - 16px));');
		expect(CSS).toContain('height: min(380px, calc(100vh - 132px));');
		expect(CSS).toMatch(/\.ri-vertical #Trade \.btn \{\n\tmin-width: 0;/);
		expect(CSS).toMatch(/#Trade\.so-recebe \.zeny\.send \{\n\tpointer-events: none;/);
	});
});
