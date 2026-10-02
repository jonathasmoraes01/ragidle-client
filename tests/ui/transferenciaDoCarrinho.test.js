/**
 * POR E TIRAR DO CARRINHO (D-1848, 30/09/2026 — ordem do dono: "Verifique se e
 * possivel adicionar itens no carrinho do mercador. Se nao for possivel,
 * implemente/corrija isso imediatamente, tanto no desktop como no mobile").
 *
 * Medido no jogo antes do conserto, com um Mercador com carrinho: nao havia
 * porta na HUD (so o Alt+W nativo), o menu do item da Mochila nao tinha "Por no
 * carrinho", o arrasto ate o carrinho morria no `dragover` sem
 * `preventDefault`, o duplo clique no carrinho lancava TypeError
 * (`CartItems.useItem` nao existe) e o Alt+botao direito pedia a janela nativa
 * de inventario, que neste fork nunca esta na tela.
 *
 * O que estes casos guardam: as regras puras (`transferenciaDoCarrinho.js`) e
 * as COSTURAS entre arquivos distantes, que sao strings soltas — o mesmo
 * metodo de `retiradaDoArmazem.test.js`, porque levantar as janelas de verdade
 * exige WebGL + GRF + sessao. Quem mede o jogo montado e a `prove:carrinho`.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	PARA_O_ARMAZEM,
	PARA_O_CORPO,
	carrinhoNaTela,
	destinoDaSaidaDoCarrinho,
	ehArrastoDoCarrinho,
	pesoLivreDoCarrinho,
	temCarrinho,
	textoDaGuardaRecusada,
	textoDaQuantidadeRecusada,
	textoDaRetiradaRecusada
} from 'UI/Components/CartItems/transferenciaDoCarrinho.js';

const ler = nome => readFileSync(join(process.cwd(), 'src', nome), 'utf8');

describe('temCarrinho', () => {
	it('so com hasCart === true', () => {
		expect(temCarrinho({ hasCart: true })).toBe(true);
		expect(temCarrinho({ hasCart: false })).toBe(false);
		expect(temCarrinho({})).toBe(false);
		expect(temCarrinho(null)).toBe(false);
		// O EFST pode chegar com 1 em vez de true: a pergunta e estrita de
		// proposito, como o `=== false` que a janela nativa ja usava.
		expect(temCarrinho({ hasCart: 1 })).toBe(false);
	});
});

describe('carrinhoNaTela', () => {
	it('o host no documento e sem display:none', () => {
		expect(carrinhoNaTela({ isConnected: true, style: { display: '' } })).toBe(true);
		expect(carrinhoNaTela({ isConnected: true, style: { display: 'none' } })).toBe(false);
		expect(carrinhoNaTela({ isConnected: false, style: { display: '' } })).toBe(false);
		expect(carrinhoNaTela(null)).toBe(false);
	});
});

describe('ehArrastoDoCarrinho', () => {
	const DO_CARRINHO = { type: 'item', from: 'CartItems', data: { index: 2, count: 10 } };

	it('aceita o payload que o carrinho escreve', () => {
		expect(ehArrastoDoCarrinho(DO_CARRINHO)).toBe(true);
	});

	it('recusa o arrasto do armazem e da propria mochila', () => {
		expect(ehArrastoDoCarrinho({ ...DO_CARRINHO, from: 'Storage' })).toBe(false);
		expect(ehArrastoDoCarrinho({ ...DO_CARRINHO, from: 'Inventory' })).toBe(false);
	});

	it('recusa payload sem item, nulo ou de outro tipo', () => {
		expect(ehArrastoDoCarrinho({ type: 'item', from: 'CartItems' })).toBe(false);
		expect(ehArrastoDoCarrinho({ type: 'skill', from: 'CartItems', data: {} })).toBe(false);
		expect(ehArrastoDoCarrinho(null)).toBe(false);
	});

	it('o rotulo "CartItems" e o MESMO que o dragstart do carrinho escreve', () => {
		const fonte = ler('UI/Components/CartItems/CartItems.js');
		expect(fonte).toMatch(/_OBJ_DRAG_\s*=\s*\{[^}]*from:\s*'CartItems'/);
	});
});

describe('destinoDaSaidaDoCarrinho (o Alt+botao direito)', () => {
	it('com nada aberto, o CORPO — o gesto antigo terminava sem pedir nada', () => {
		expect(destinoDaSaidaDoCarrinho({ armazemAberto: false })).toBe(PARA_O_CORPO);
		expect(destinoDaSaidaDoCarrinho()).toBe(PARA_O_CORPO);
	});

	it('com o armazem aberto, o ARMAZEM (o gesto do RO original)', () => {
		expect(destinoDaSaidaDoCarrinho({ armazemAberto: true })).toBe(PARA_O_ARMAZEM);
	});
});

describe('pesoLivreDoCarrinho', () => {
	it('maximo menos o atual, na mesma unidade', () => {
		expect(pesoLivreDoCarrinho({ pesoAtual: 100, pesoMaximo: 80000 })).toBe(79900);
	});

	it('nunca negativo', () => {
		expect(pesoLivreDoCarrinho({ pesoAtual: 90000, pesoMaximo: 80000 })).toBe(0);
	});

	it('sem os contadores e null — e NAO zero, que recusaria tudo por um dado que nao chegou', () => {
		expect(pesoLivreDoCarrinho(null)).toBeNull();
		expect(pesoLivreDoCarrinho({ pesoAtual: 0, pesoMaximo: 0 })).toBeNull();
	});
});

describe('os textos das recusas', () => {
	it('guarda: 0 e o peso e 1 e a contagem, os valores da fonte (clif.hpp:851-852)', () => {
		expect(textoDaGuardaRecusada(0)).toMatch(/peso/);
		expect(textoDaGuardaRecusada(1)).toMatch(/cheio/);
		expect(textoDaGuardaRecusada(7)).toBeNull();
	});

	it('retirada: 2 e o peso da mochila, 5 a pilha, o resto nunca mudo', () => {
		expect(textoDaRetiradaRecusada(2)).toMatch(/peso/);
		expect(textoDaRetiradaRecusada(5)).toMatch(/pilha/);
		expect(textoDaRetiradaRecusada(1)).toMatch(/Não foi possível/);
	});

	it('a quantidade acima do teto diz quantos cabem, e o teto zero diz que nao ha peso', () => {
		expect(textoDaQuantidadeRecusada(12, 'carrinho')).toBe('Cabem no máximo 12 no carrinho.');
		expect(textoDaQuantidadeRecusada(3, 'mochila')).toBe('Cabem no máximo 3 na mochila.');
		expect(textoDaQuantidadeRecusada(0, 'carrinho')).toMatch(/peso livre no carrinho/);
	});
});

describe('as costuras', () => {
	const cart = ler('UI/Components/CartItems/CartItems.js');
	const mochila = ler('UI/Components/MochilaIdle/MochilaIdle.js');
	const motor = ler('Engine/MapEngine.js');
	const item = ler('Engine/MapEngine/Item.js');

	it('o carrinho e ALVO de soltar: o dragover faz preventDefault', () => {
		const inicio = cart.indexOf("this._host.addEventListener('dragover'");
		expect(inicio).toBeGreaterThan(0);
		expect(cart.slice(inicio, inicio + 200)).toContain('e.preventDefault()');
	});

	it('o duplo clique nao chama mais o CartItems.useItem que nao existe', () => {
		expect(cart).not.toMatch(/CartItems\.useItem\(/);
	});

	it('o botao direito e o toque abrem o menu com "Pôr na mochila"', () => {
		expect(cart).toContain("ContextMenu.addElement('Pôr na mochila'");
		expect(cart).toMatch(/if \(!ehDedo\(\)\) \{\s*return;\s*\}\s*const item = e\.target\.closest\('\.item'\);/);
	});

	it('a Mochila oferece "Pôr no carrinho" a quem TEM carrinho, e pede pelo pacote do carrinho', () => {
		expect(mochila).toMatch(/if \(temCarrinho\(Session\.Entity\)\) \{\s*ContextMenu\.addElement\('Pôr no carrinho'/);
		expect(mochila).toContain('Inventory.getUI().reqMoveItemToCart(item.index, quantos)');
	});

	it('a Mochila tem a porta do carrinho e ela chama CartItems.toggle', () => {
		expect(ler('UI/Components/MochilaIdle/MochilaIdle.html')).toContain('class="mo-carrinho');
		expect(mochila).toContain('CartItems.toggle()');
	});

	it('a grade da Mochila aceita o arrasto vindo do carrinho', () => {
		expect(mochila).toContain('CartItems.pedirParaMochila(doCarrinho)');
	});

	it('o carrinho esta na pilha de janelas (ESC, voltar, tela cheia no celular)', () => {
		expect(motor).toMatch(/nome: 'carrinho',\s*componente: CartItems,\s*seletor: '#cartitems'/);
	});

	it('as recusas do servidor aparecem na janela, alem do chat', () => {
		expect(item).toContain('CartItems.avisar(textoDaRetiradaRecusada(pkt.result))');
		expect(item).toContain('CartItems.avisarNaMochila(texto)');
		expect(motor).toContain('CartItems.avisarNaMochila = texto => MochilaIdle.avisar(texto)');
	});
});
