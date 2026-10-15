/**
 * O VIP NO RO SHOP (D-2460 no servidor, 16/10/2026, pedido do dono): tres SKUs
 * na aba Conta (`tipoDeEntrega: "vip"`), um VIP por compra, o VIP da conta na
 * carta, e o banner da Temporada sem prometer o VIP so la.
 *
 * Mesmo aparelho de `roShop.test.js`: HTML de verdade, controlador de verdade,
 * `enviar` falso e relogio manual. O estado e o de exemplo, com os tres VIPs
 * como o servidor os manda (`servidor/ro-shop/loja-do-ro-shop.ts`).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { criarControlador } from 'UI/Components/RoShop/controladorDoRoShop.js';
import {
	adicionarAoCarrinho,
	atalhoTemporadaHtml,
	contadorDaConta,
	ehVip,
	retratoHtml,
	textoDaRecusa
} from 'UI/Components/RoShop/formatoDoRoShop.js';
import { estadoDeExemplo } from '../fixtures/roShopEstado.js';

const HTML = readFileSync(join(process.cwd(), 'src', 'UI', 'Components', 'RoShop', 'RoShop.html'), 'utf8');

const VIP = (sku, dias, precoMinor, ordem) => ({
	sku,
	nome: `VIP ${dias} dias`,
	descricao: `${dias} dias de VIP para a conta inteira, ativados na hora da compra.`,
	categoria: 'conta',
	destaque: false,
	ordemNoDestaque: null,
	ordem,
	precoMinor,
	ativo: true,
	imagem: null,
	tipoDeEntrega: 'vip',
	conteudo: [],
	resumo: `${dias} dias de VIP na conta`,
	selo: null,
	quantidadeMaxima: 1,
	indisponivel: null
});

function estadoComVip(vipDaConta = { ativo: false, diasRestantes: 0, expiraEm: null }) {
	const e = estadoDeExemplo();
	/* A fixture ja traz os tres (fiel ao servidor); aqui eles sao refeitos com o texto curto do teste. */
	e.produtos = [...e.produtos.filter(p => !ehVip(p)), VIP('VIP_30D', 30, 900, -2), VIP('VIP_60D', 60, 1600, -1), VIP('VIP_90D', 90, 2500, 0)];
	e.conta = { ...e.conta, vip: vipDaConta };
	return e;
}

function montar() {
	const raiz = document.createElement('div');
	raiz.innerHTML = HTML;
	document.body.appendChild(raiz);
	const enviados = [];
	let n = 0;
	const c = criarControlador({
		raiz,
		enviar: corpo => enviados.push(JSON.parse(JSON.stringify(corpo))),
		gerarChave: () => `chave-${++n}`,
		abrirTemporada: () => undefined,
		resolverIcone: (_id, _ok, falha) => falha(),
		agendar: () => 0,
		cancelar: () => undefined
	});
	const clicar = seletor => {
		const el = typeof seletor === 'string' ? raiz.querySelector(seletor) : seletor;
		expect(el, `nao achei ${seletor}`).not.toBeNull();
		return c.onClick({ target: el });
	};
	return { raiz, c, enviados, clicar };
}

let t;
beforeEach(() => {
	document.body.innerHTML = '';
	t = montar();
	t.c.abrir();
});

describe('o VIP na aba Conta', () => {
	it('os tres aparecem PRIMEIRO na aba Conta, com nome, preco e a arte do VIP (sem imagem quebrada)', () => {
		t.c.receber(estadoComVip());
		t.clicar('[data-categoria="conta"]');
		const skus = [...t.raiz.querySelectorAll('.rs-card')].map(c => c.dataset.sku);
		expect(skus.slice(0, 3)).toEqual(['VIP_30D', 'VIP_60D', 'VIP_90D']);
		const card = t.raiz.querySelector('.rs-card[data-sku="VIP_60D"]');
		expect(card.textContent).toContain('VIP 60 dias');
		expect(card.textContent).toContain('16,00');
		expect(card.querySelector('[data-rs="adicionar"]')).not.toBeNull();
		// A mesma arte do VIP na barra de status e no chat; nenhum id de item a resolver.
		expect(card.querySelector('.rs-retrato-reserva').getAttribute('src')).toBe('/ragidle/shop/icons/shop-icon-ro-cash.png');
		expect(card.querySelector('[data-item-ids]')).toBeNull();
	});

	it('a carta diz o VIP da conta: sem VIP, ou quantos dias faltam (a compra SOMA a eles)', () => {
		t.c.receber(estadoComVip());
		t.clicar('[data-categoria="conta"]');
		expect(t.raiz.querySelector('.rs-card[data-sku="VIP_30D"] .rs-contador').textContent).toBe('Sem VIP ativo');
		t.c.receber(estadoComVip({ ativo: true, diasRestantes: 12, expiraEm: 20261027 }));
		const contador = t.raiz.querySelector('.rs-card[data-sku="VIP_90D"] .rs-contador');
		expect(contador.textContent).toBe('VIP ativo: 12 dias');
		// VIP nao tem teto de conta: a carta nunca fica "no teto".
		expect(contador.classList.contains('is-no-teto')).toBe(false);
	});

	it('um VIP por compra: o segundo VIP (outro SKU) e recusado no carrinho, com o recado do servidor', () => {
		t.c.receber(estadoComVip());
		t.clicar('[data-categoria="conta"]');
		t.clicar('.rs-card[data-sku="VIP_30D"] [data-rs="adicionar"]');
		t.clicar('.rs-card[data-sku="VIP_90D"] [data-rs="adicionar"]');
		expect(t.raiz.querySelector('.rs-aviso').textContent).toContain('Leve um VIP por compra');
		// O teto de 1 do proprio SKU segue valendo: o card ja diz "No limite".
		expect(t.raiz.querySelector('.rs-card[data-sku="VIP_30D"] [data-rs="adicionar"]').disabled).toBe(true);
		// Um item comum junto com o VIP entra normalmente, e o carrinho tem SO um VIP.
		t.clicar('.rs-card[data-sku="ACCOUNT_CHARACTER_SLOT"] [data-rs="adicionar"]');
		expect(t.c.espiar().carrinho).toEqual([
			{ sku: 'VIP_30D', quantidade: 1 },
			{ sku: 'ACCOUNT_CHARACTER_SLOT', quantidade: 1 }
		]);
	});

	it('o checkout de um VIP manda SO sku e quantidade, e o total da tela (o servidor recalcula)', () => {
		t.c.receber(estadoComVip());
		t.clicar('[data-categoria="conta"]');
		t.clicar('.rs-card[data-sku="VIP_90D"] [data-rs="adicionar"]');
		t.clicar('[data-rs="comprar"]');
		t.clicar('[data-rs="confirmar"]');
		const checkout = t.enviados.find(e => e.acao === 'checkout');
		expect(checkout).toEqual({ acao: 'checkout', chave: 'chave-1', itens: [{ sku: 'VIP_90D', quantidade: 1 }], totalEsperadoMinor: 2500 });
	});

	it('o texto do servidor da compra de VIP aparece no fim do checkout', () => {
		t.c.receber(estadoComVip());
		t.clicar('[data-categoria="conta"]');
		t.clicar('.rs-card[data-sku="VIP_30D"] [data-rs="adicionar"]');
		t.clicar('[data-rs="comprar"]');
		t.clicar('[data-rs="confirmar"]');
		t.c.receber({
			versao: 1,
			tipo: 'resultado',
			acao: 'checkout',
			ok: true,
			chave: 'chave-1',
			texto: 'VIP ativado: +30 dias. Seu VIP vale até 14/11/2026.',
			pedido: { id: 'RS-1-chave-1', repetido: false, totalMinor: 900, saldoAntesMinor: 862000, saldoDepoisMinor: 861100, itens: [] }
		});
		expect(t.raiz.querySelector('.rs-checkout-texto').textContent).toBe('VIP ativado: +30 dias. Seu VIP vale até 14/11/2026.');
	});
});

describe('as pecas puras do VIP', () => {
	it('ehVip so pelo tipoDeEntrega do servidor', () => {
		expect(ehVip({ tipoDeEntrega: 'vip' })).toBe(true);
		expect(ehVip({ tipoDeEntrega: 'item', sku: 'VIP_30D' })).toBe(false);
		expect(ehVip(null)).toBe(false);
	});

	it('adicionarAoCarrinho recusa o segundo VIP com o estado; sem estado, quem recusa e o servidor', () => {
		const estado = estadoComVip();
		const v30 = estado.produtos.find(p => p.sku === 'VIP_30D');
		const v60 = estado.produtos.find(p => p.sku === 'VIP_60D');
		const um = adicionarAoCarrinho([], v30, 1, estado);
		expect(um.recusa).toBeNull();
		expect(adicionarAoCarrinho(um.carrinho, v60, 1, estado)).toEqual({ carrinho: um.carrinho, recusa: 'vip' });
		expect(adicionarAoCarrinho(um.carrinho, v30, 1, estado).recusa).toBe('teto');
		expect(adicionarAoCarrinho(um.carrinho, v60, 1).recusa).toBeNull();
		expect(textoDaRecusa('vip')).toMatch(/um VIP por compra/);
	});

	it('o contador do VIP: 1 dia no singular, e sem o bloco do servidor nao inventa nada', () => {
		const v30 = estadoComVip().produtos.find(p => p.sku === 'VIP_30D');
		expect(contadorDaConta(v30, estadoComVip({ ativo: true, diasRestantes: 1, expiraEm: 20261016 })).texto).toBe('VIP ativo: 1 dia');
		const semBloco = estadoDeExemplo();
		delete semBloco.conta.vip;
		expect(contadorDaConta(v30, semBloco)).toBeNull();
	});

	it('o retrato do VIP e a arte do VIP mesmo sem categoria', () => {
		expect(retratoHtml({ sku: 'VIP_30D', tipoDeEntrega: 'vip', conteudo: [], imagem: null }, null)).toContain('shop-icon-ro-cash.png');
	});

	it('o banner da Temporada nao manda mais procurar o VIP la', () => {
		const html = atalhoTemporadaHtml({ id: 'S1', nome: 'Luz & Trevas', fase: 'aberta' });
		expect(html).toContain('Caixas e Battle Pass estão no menu Temporada.');
		expect(html).not.toMatch(/VIP/);
	});
});
