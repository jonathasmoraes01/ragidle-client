/**
 * TIRAR DO ARMAZEM (D-991, queixa do dono, 09/09/2026: "os players nao estao
 * conseguindo tirar os itens do Storage").
 *
 * O defeito nao era do servidor. `CZ_MOVE_ITEM_FROM_STORE_TO_BODY` chegava
 * inteiro do outro lado e o `servidor-mapa.ts` ja fazia a conta certa - o
 * pedido simplesmente NUNCA SAIA do cliente.
 *
 * Os dois unicos caminhos de retirada morriam na mesma pedra: ambos exigiam
 * a janela NATIVA de inventario visivel na tela.
 *
 *   1. arrastar do armazem ate a janela `Inventory` (o `onDrop` dela aceita
 *      `from: 'Storage'`);
 *   2. `transferItemToOtherUI`, que so pedia dentro de
 *      `if (Inventory.getUI().ui.is(':visible'))`.
 *
 * E neste fork essa janela esta escondida PARA SEMPRE: a `MochilaIdle` e a
 * janela de inventario do jogo, e ela poe `display:none` no host nativo no
 * `onAppend` e REPOE a cada 250 ms (`hideNativeHosts`). O shim de
 * `is(':visible')` (GUIComponent.js) le exatamente esse `display`, entao o
 * teste era falso sempre. Sem alvo de drop na tela e sem o `if`, o clique do
 * jogador nao virava pacote nenhum - sem erro, sem log, sem item.
 *
 * O que estes casos guardam:
 *
 * 1. **O CORPO E O PADRAO.** Com nada aberto, o destino tem de ser o corpo.
 *    Esta e a regressao literal: era aqui que a funcao antiga terminava sem
 *    pedir nada.
 * 2. **O CONTRATO DO ARRASTO.** Quem escreve `from: 'Storage'` e o
 *    `dragstart` do armazem; quem le e a grade da Mochila. Sao arquivos
 *    distantes e o acoplamento e uma string - renomear um lado so mataria a
 *    retirada em silencio de novo. Mesma tecnica de `fantasiaNaMochila.test.js`
 *    (levantar as janelas de verdade exigiria WebGL + GRF + sessao logada).
 * 3. **PEDIDO INVALIDO NAO VAI AO FIO.** O servidor ignora em silencio
 *    quantidade fora da pilha, e "ignorado em silencio" e a assinatura do
 *    defeito que esta entrega fecha.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	CARRINHO,
	CORPO,
	destinoDaRetirada,
	ehArrastoDoArmazem,
	quantidadeDaRetirada,
	quantidadePadraoDaRetirada,
	tetoPeloPeso
} from 'UI/Components/Storage/retiradaDoArmazem.js';

const ler = nome => readFileSync(join(process.cwd(), 'src', nome), 'utf8');

describe('destinoDaRetirada', () => {
	it('com NADA aberto, a peca volta para o corpo (a regressao)', () => {
		// O teste antigo (`Inventory...is(':visible')`) dava falso aqui e a
		// retirada terminava muda. Se este caso voltar a dizer CARRINHO ou
		// qualquer outra coisa, o armazem parou de devolver item de novo.
		expect(destinoDaRetirada({ carrinhoAberto: false, inventarioNativoAberto: false })).toBe(CORPO);
	});

	it('sem argumento nenhum, ainda e o corpo', () => {
		expect(destinoDaRetirada()).toBe(CORPO);
		expect(destinoDaRetirada({})).toBe(CORPO);
	});

	it('com o carrinho na tela, a peca vai para o carrinho', () => {
		expect(destinoDaRetirada({ carrinhoAberto: true, inventarioNativoAberto: false })).toBe(CARRINHO);
	});

	it('o inventario nativo aberto tem prioridade sobre o carrinho', () => {
		// A unica escolha real do teste antigo, preservada: quem abriu a
		// janela de itens quer o item nela, nao no carrinho.
		expect(destinoDaRetirada({ carrinhoAberto: true, inventarioNativoAberto: true })).toBe(CORPO);
	});
});

describe('ehArrastoDoArmazem', () => {
	const DO_ARMAZEM = { type: 'item', from: 'Storage', data: { index: 3, count: 10 } };

	it('aceita o payload que o armazem escreve', () => {
		expect(ehArrastoDoArmazem(DO_ARMAZEM)).toBe(true);
	});

	it('recusa o arrasto da propria mochila (from: Inventory)', () => {
		// A grade escreve `from: 'Inventory'` quando o gesto e equipar. Se
		// isto passasse, soltar um item na propria grade pediria retirada de
		// um indice de armazem que nao existe.
		expect(ehArrastoDoArmazem({ ...DO_ARMAZEM, from: 'Inventory' })).toBe(false);
	});

	it('recusa payload sem item, nulo ou de outro tipo', () => {
		expect(ehArrastoDoArmazem({ type: 'item', from: 'Storage' })).toBe(false);
		expect(ehArrastoDoArmazem({ type: 'skill', from: 'Storage', data: {} })).toBe(false);
		expect(ehArrastoDoArmazem(null)).toBe(false);
		expect(ehArrastoDoArmazem('Storage')).toBe(false);
	});

	it('o rotulo "Storage" e o MESMO que o dragstart do armazem escreve', () => {
		// O acoplamento entre StorageCommon.js (escreve) e MochilaIdle.js (le,
		// por esta funcao) e uma string solta. Renomear so um lado deixaria a
		// retirada por arrasto muda outra vez.
		const fonte = ler('UI/Components/Storage/StorageCommon.js');
		expect(fonte).toMatch(/_OBJ_DRAG_\s*=\s*\{[^}]*from:\s*'Storage'/);
	});

	it('a grade da Mochila leva o arrasto do armazem ate o pedido de retirada', () => {
		// Antes desta entrega o `drop` da grade so conhecia o arrasto de
		// tirar equipamento e voltava cedo para todo o resto - o armazem nao
		// tinha alvo nenhum na tela.
		const fonte = ler('UI/Components/MochilaIdle/MochilaIdle.js');
		expect(fonte).toContain('ehArrastoDoArmazem');
		expect(fonte).toMatch(/Storage\.reqRemoveItem\(/);
	});
});

describe('quantidadeDaRetirada', () => {
	it('devolve o numero pedido quando ele cabe na pilha', () => {
		expect(quantidadeDaRetirada('3', 10)).toBe(3);
		expect(quantidadeDaRetirada(10, 10)).toBe(10);
	});

	it('recusa zero, negativo, vazio e lixo', () => {
		expect(quantidadeDaRetirada('0', 10)).toBeNull();
		expect(quantidadeDaRetirada('-2', 10)).toBeNull();
		expect(quantidadeDaRetirada('', 10)).toBeNull();
		expect(quantidadeDaRetirada('abc', 10)).toBeNull();
		expect(quantidadeDaRetirada(undefined, 10)).toBeNull();
	});

	it('recusa acima da pilha em vez de encolher o pedido', () => {
		// O servidor descarta em silencio `quantidade > item.quantidade`
		// (servidor-mapa.ts). Mandar assim mesmo seria outro clique que nao
		// faz nada; e entregar 3 de um pedido de 999 seria adivinhar.
		expect(quantidadeDaRetirada('999', 3)).toBeNull();
	});

	it('pilha invalida nao produz pedido', () => {
		expect(quantidadeDaRetirada('1', 0)).toBeNull();
		expect(quantidadeDaRetirada('1', undefined)).toBeNull();
	});

	it('R17/C2-6: o teto do peso aperta mais que a pilha quando ele e o mais escasso', () => {
		// Pilha de 50, mas so' cabem 7 no peso livre.
		expect(quantidadeDaRetirada('50', 50, 7)).toBeNull();
		expect(quantidadeDaRetirada('7', 50, 7)).toBe(7);
		expect(quantidadeDaRetirada('8', 50, 7)).toBeNull();
	});

	it('R17/C2-6: `null` (peso desconhecido/zero) nao aperta nada — so' + ' a pilha manda', () => {
		expect(quantidadeDaRetirada('50', 50, null)).toBe(50);
		expect(quantidadeDaRetirada('50', 50)).toBe(50); // parametro omitido = mesmo default
	});

	it('R17/C2-6: peso livre negativo (capacidade ja estourada) recusa tudo, nunca vira negativo', () => {
		expect(quantidadeDaRetirada('1', 50, -3)).toBeNull();
	});
});

describe('tetoPeloPeso (R17/C2-6, 14/09/2026)', () => {
	it('floor((pesoLivre)/pesoUnitario), a formula exigida pelo pedido', () => {
		expect(tetoPeloPeso(1000, 100)).toBe(10);
		expect(tetoPeloPeso(999, 100)).toBe(9); // arredonda para BAIXO, nunca para cima
	});

	it('capacidade ja atingida (peso livre <= 0) trava em 0, nunca negativo', () => {
		expect(tetoPeloPeso(0, 100)).toBe(0);
		expect(tetoPeloPeso(-50, 100)).toBe(0);
	});

	it('peso unitario zero ou desconhecido (null/undefined) devolve null — sem teto pelo peso', () => {
		expect(tetoPeloPeso(1000, 0)).toBeNull();
		expect(tetoPeloPeso(1000, null)).toBeNull();
		expect(tetoPeloPeso(1000, undefined)).toBeNull();
	});
});

describe('quantidadePadraoDaRetirada (R17/C2-6, 14/09/2026 — o valor que o InputBox ja abre preenchido)', () => {
	it('sem teto pelo peso (null), o padrao e a pilha inteira — o comportamento de sempre', () => {
		expect(quantidadePadraoDaRetirada(12, null)).toBe(12);
	});

	it('com teto pelo peso mais apertado que a pilha, o padrao e o teto', () => {
		expect(quantidadePadraoDaRetirada(50, 7)).toBe(7);
	});

	it('com teto pelo peso MAIOR que a pilha (peso nao e o fator limitante), o padrao continua sendo a pilha', () => {
		expect(quantidadePadraoDaRetirada(5, 1000)).toBe(5);
	});

	it('capacidade ja atingida (teto 0) preenche 0, nao a pilha inteira', () => {
		expect(quantidadePadraoDaRetirada(50, 0)).toBe(0);
	});
});
