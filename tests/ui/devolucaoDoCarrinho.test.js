/**
 * DEVOLVER O CARRINHO (R110, D-2044, 06/10/2026 — ordem do dono: "quero que
 * seja possivel 'desalugar/devolver' o carrinho do mercador para a Kafra ou na
 * propria janela do mercador, com confirmacao mediante ao clique no botao de
 * 'sim, quero devolver'").
 *
 * A metade do cliente: o botao "Devolver" do carrinho (que so PEDE), a janela
 * de confirmacao do servidor com os rotulos do dono, e o `ZC_CARTOFF` que
 * fecha e esvazia a janela. A tranca e do servidor (ele nao devolve sem o
 * "sim"); quem mede o jogo montado e a sonda `diag-devolver-carrinho-na-tela`.
 *
 * As regras puras (`rotulosDaConfirmacao.js`) e as COSTURAS entre arquivos,
 * lidas no fonte — o metodo de `transferenciaDoCarrinho.test.js`.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	ALTURA_MINIMA_DA_PERGUNTA,
	ROTULO_NAO_PADRAO,
	ROTULO_SIM_PADRAO,
	alturaDaPergunta,
	rotulosDaPergunta
} from 'Engine/MapEngine/rotulosDaConfirmacao.js';

const ler = nome => readFileSync(join(process.cwd(), 'src', nome), 'utf8').replaceAll('\r\n', '\n');

describe('os rotulos da janela de confirmacao', () => {
	it('a pergunta da devolucao traz os rotulos do dono', () => {
		expect(rotulosDaPergunta({ sim: 'Sim, quero devolver', nao: 'Cancelar' })).toEqual({
			sim: 'Sim, quero devolver',
			nao: 'Cancelar'
		});
	});

	it('quem nao manda rotulo (os comandos, o pet) segue com OK / Cancelar', () => {
		expect(rotulosDaPergunta({ v: 1, id: 3, texto: 'x' })).toEqual({ sim: 'OK', nao: 'Cancelar' });
		expect(rotulosDaPergunta(null)).toEqual({ sim: ROTULO_SIM_PADRAO, nao: ROTULO_NAO_PADRAO });
		expect(ROTULO_SIM_PADRAO).toBe('OK');
		expect(ROTULO_NAO_PADRAO).toBe('Cancelar');
	});

	it('rotulo invalido cai no padrao, um lado de cada vez', () => {
		expect(rotulosDaPergunta({ sim: '', nao: 'Nao' })).toEqual({ sim: 'OK', nao: 'Nao' });
		expect(rotulosDaPergunta({ sim: '   ', nao: 7 })).toEqual({ sim: 'OK', nao: 'Cancelar' });
		expect(rotulosDaPergunta({ sim: 'x'.repeat(41) }).sim).toBe('OK');
		expect(rotulosDaPergunta({ sim: 'x'.repeat(40) }).sim).toBe('x'.repeat(40));
		expect(rotulosDaPergunta({ sim: '  Sim  ' }).sim).toBe('Sim');
	});
});

describe('a altura da caixa', () => {
	it('o texto curto fica nos 120px de sempre', () => {
		expect(alturaDaPergunta(20, 40, 900)).toBe(ALTURA_MINIMA_DA_PERGUNTA);
		expect(ALTURA_MINIMA_DA_PERGUNTA).toBe(120);
	});

	it('o texto longo cresce: texto + rodape + 8', () => {
		expect(alturaDaPergunta(150, 40, 900)).toBe(198);
		expect(alturaDaPergunta(150.2, 60, 900)).toBe(219);
	});

	it('nunca passa de 80% da tela (o resto rola por dentro)', () => {
		expect(alturaDaPergunta(2000, 40, 852)).toBe(681);
		// e o piso vence o teto numa tela minuscula
		expect(alturaDaPergunta(2000, 40, 100)).toBe(120);
	});

	it('medida invalida nao quebra a caixa', () => {
		expect(alturaDaPergunta(NaN, 40, 900)).toBe(120);
		expect(alturaDaPergunta(-5, 40, 900)).toBe(120);
		expect(alturaDaPergunta(150, 40, 0)).toBe(198);
	});
});

describe('as costuras', () => {
	it('a janela de confirmacao usa os rotulos e cresce com o texto', () => {
		const fonte = ler('Engine/MapEngine/RagidleConfirmar.js');
		expect(fonte).toContain('const rotulos = rotulosDaPergunta(dados);');
		expect(fonte).toContain("btn.textContent = nome === 'ok' ? rotulos.sim : rotulos.nao;");
		expect(fonte).toContain('alturaDaPergunta(textoEl.scrollHeight, alturaDoRodape');
		// no dedo, os 44px da regra do dono
		expect(fonte).toContain("b.style.minHeight = '44px';");
	});

	it('o carrinho tem o botao "Devolver", e o clique so PEDE', () => {
		const html = ler('UI/Components/CartItems/CartItems.html');
		expect(html).toMatch(/<button type="button" class="devolver[^"]*"[^>]*>Devolver<\/button>/);
		const js = ler('UI/Components/CartItems/CartItems.js');
		expect(js).toContain("root.querySelector('.footer .devolver')");
		expect(js).toContain('CartItems.pedirDevolucao();');
	});

	it('o pedido e o CZ_REQ_CARTOFF, e o ZC_CARTOFF fecha e esvazia a janela', () => {
		const item = ler('Engine/MapEngine/Item.js');
		expect(item).toContain('Network.sendPacket(new PACKET.CZ.REQ_CARTOFF());');
		expect(item).toContain('Network.hookPacket(PACKET.ZC.CARTOFF, onCartOff);');
		expect(item).toMatch(/function onCartOff\(\) \{\n\tCartItems\.aoPerderCarrinho\(\);/);
		const js = ler('UI/Components/CartItems/CartItems.js');
		const corpo = js.slice(js.indexOf('CartItems.aoPerderCarrinho = function'));
		expect(corpo).toContain("content.innerHTML = '';");
		expect(corpo).toContain('this.list.length = 0;');
		expect(corpo).toContain('this.fechar();');
	});

	it('a recusa USESKILL_FAIL_CART (57) chega ao chat com a mensagem da fonte (MSI 1519)', () => {
		const skill = ler('Engine/MapEngine/Skill.js');
		expect(skill).toMatch(/case 57:\n\t+error = 1519;/);
	});

	it('no celular o "Devolver" e alvo de dedo (44px), e o rodape quebra em duas linhas', () => {
		const css = ler('UI/Components/CartItems/CartItems.css');
		const movel = css.slice(css.indexOf('@media (max-width: 599px)'));
		const regra = movel.slice(movel.indexOf('#cartitems .footer .devolver {'));
		expect(regra.slice(0, regra.indexOf('}'))).toContain('min-height: 44px;');
		expect(movel).toContain('flex-wrap: wrap;');
	});
});
