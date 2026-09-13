import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * A LOJA DO NPC NAO FECHA DEPOIS DA COMPRA OU DA VENDA (a tarefa 25, D-1361).
 *
 * Os dois arquivos que mudaram sao o motor inteiro (`Store.js` e `MapEngine.js`
 * importam a rede e o renderizador), entao estes casos leem o FONTE. O que eles
 * nao veem e a janela na tela: a prova do celular a abre e a mede.
 */
const LOJA = readFileSync('src/Engine/MapEngine/Store.js', 'utf8');
const MOTOR = readFileSync('src/Engine/MapEngine.js', 'utf8');

/** O corpo de uma funcao de topo, ate a proxima. */
function corpoDe(texto, assinatura) {
	const i = texto.indexOf(assinatura);
	if (i < 0) return '';
	const fim = texto.indexOf('\nfunction ', i + assinatura.length);
	return texto.slice(i, fim < 0 ? undefined : fim);
}

describe('a loja do NPC nao fecha depois da compra ou da venda', () => {
	it('a lista que o servidor mandou fica guardada, para a janela se refazer', () => {
		expect(corpoDe(LOJA, 'function onBuyList(')).toContain('_listaDeCompra = pkt.itemList;');
		expect(corpoDe(LOJA, 'function onSellList(')).toContain('_listaDeVenda = pkt.itemList;');
	});

	it('a compra: com a loja do NPC na tela ela NAO fecha — e a certa refaz o carrinho', () => {
		const corpo = corpoDe(LOJA, 'function onBuyResult(');
		expect(corpo).toContain('if (lojaDoNpcAberta(NpcStore.Type.BUY)) {');
		expect(corpo).toContain('if (pkt.result === 0 && _listaDeCompra) {');
		expect(corpo).toContain('NpcStore.setList(_listaDeCompra);');
		// O `remove` continua, mas so no outro ramo — o da loja de outro jogador.
		expect(corpo.indexOf('NpcStore.remove();')).toBeGreaterThan(corpo.indexOf('} else {'));
	});

	it('a venda: com a loja do NPC na tela ela NAO fecha — a lista se refaz do inventario', () => {
		const corpo = corpoDe(LOJA, 'function onSellResult(');
		expect(corpo).toContain('if (lojaDoNpcAberta(NpcStore.Type.SELL)) {');
		expect(corpo).toContain('NpcStore.setList(_listaDeVenda);');
		expect(corpo.indexOf('NpcStore.remove();')).toBeGreaterThan(corpo.indexOf('} else {'));
	});

	it('"aberta" e o host no documento, e so a loja do NPC do tipo pedido', () => {
		const corpo = corpoDe(LOJA, 'function lojaDoNpcAberta(');
		expect(corpo).toContain('NpcStore.getCurrentType() === tipo');
		expect(corpo).toContain('host.isConnected');
	});
});

describe('a loja entra na pilha de janelas (o celular em pe)', () => {
	it('registrada como DECISAO e preparada ANTES — a marca de painel vai no host', () => {
		const i = MOTOR.indexOf("nome: 'loja',");
		expect(i, 'a loja nao esta registrada na pilha').toBeGreaterThan(-1);
		const trecho = MOTOR.slice(i, i + 300);
		expect(trecho).toContain('tipo: PilhaDeJanelas.TIPO.DECISAO,');
		expect(trecho).toContain('fechar: () => lojaDoNpc.remove(),');
		const prepara = MOTOR.indexOf('lojaDoNpc.prepare();');
		expect(prepara, 'a loja nao e preparada').toBeGreaterThan(-1);
		expect(prepara, 'a loja e preparada DEPOIS do registro').toBeLessThan(i);
	});

	it('o onAppend avisa a pilha pelo embrulho de uma vez so — a loja e a de cash', () => {
		expect(MOTOR).toContain("avisarAoAbrir(lojaDoNpc, () => PilhaDeJanelas.aoAbrir('loja'));");
		expect(MOTOR).toContain("avisarAoAbrir(CashShop, () => PilhaDeJanelas.aoAbrir('cash'));");
		// O embrulho escrito a mao, que se aninhava a cada mapa, saiu.
		expect(MOTOR).not.toContain('cashShopOnAppendOriginal');
	});
});
