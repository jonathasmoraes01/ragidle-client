/**
 * O RO SHOP (22/09/2026) - a janela inteira rodando no jsdom, sem motor.
 *
 * `controladorDoRoShop.js` nao importa Network nem Renderer: o teste monta o
 * HTML de verdade (`RoShop.html`), liga o controlador com um `enviar` falso e
 * um relogio manual, e alimenta o estado de exemplo fiel ao contrato v1
 * (`tests/fixtures/roShopEstado.js`). O que se prova aqui e o que o contrato
 * cobra do cliente: preco sempre do servidor, carrinho so com sku+quantidade,
 * chave UMA vez por checkout e reusada em reenvio, trava contra clique duplo,
 * `texto` do servidor na recusa, e Temporada nunca duplicada.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { criarControlador, TIMEOUT_MS } from 'UI/Components/RoShop/controladorDoRoShop.js';
import {
	adicionarAoCarrinho,
	buscarProdutos,
	categoriasDoEstado,
	gerarChaveDeCheckout,
	iconeDaCategoria,
	idsDoIcone,
	pedidoDeCheckout,
	produtoPorSku,
	produtosDaCategoria,
	reconciliarCarrinho,
	resumoDoCarrinho,
	tetoDoProduto,
	travaDoProduto
} from 'UI/Components/RoShop/formatoDoRoShop.js';
import { estadoDeExemplo } from '../fixtures/roShopEstado.js';

const BASE = join(process.cwd(), 'src', 'UI', 'Components', 'RoShop');
const HTML = readFileSync(join(BASE, 'RoShop.html'), 'utf8');
const CSS = readFileSync(join(BASE, 'RoShop.css'), 'utf8');

/** Um relogio manual: nada dispara sozinho, o teste avanca. */
function relogio() {
	let id = 0;
	const fila = new Map();
	return {
		agendar: (fn, ms) => {
			id += 1;
			fila.set(id, { fn, ms });
			return id;
		},
		cancelar: i => fila.delete(i),
		disparar: minimo => {
			[...fila.entries()].forEach(([i, t]) => {
				if (t.ms >= minimo) {
					fila.delete(i);
					t.fn();
				}
			});
		}
	};
}

function montar(opcoes = {}) {
	const raiz = document.createElement('div');
	raiz.innerHTML = HTML;
	document.body.appendChild(raiz);
	const enviados = [];
	const r = relogio();
	let n = 0;
	const temporada = [];
	const c = criarControlador({
		raiz,
		enviar: corpo => enviados.push(JSON.parse(JSON.stringify(corpo))),
		gerarChave: () => `chave-${++n}`,
		abrirTemporada: () => temporada.push(1),
		resolverIcone: (_id, _ok, falha) => falha(),
		agendar: r.agendar,
		cancelar: r.cancelar,
		...opcoes
	});
	const clicar = seletor => {
		const el = typeof seletor === 'string' ? raiz.querySelector(seletor) : seletor;
		expect(el, `nao achei ${seletor}`).not.toBeNull();
		return c.onClick({ target: el });
	};
	return { raiz, c, enviados, relogio: r, clicar, temporada };
}

let t;
beforeEach(() => {
	document.body.innerHTML = '';
	t = montar();
	t.c.abrir();
});

describe('abrir e carregar', () => {
	it('ao abrir pede o estado, e so isso', () => {
		expect(t.enviados).toEqual([{ acao: 'estado' }]);
		expect(t.raiz.querySelector('.rs-grade').dataset.estado).toBe('carregando');
	});

	it('sem resposta em 10 s mostra o erro com "Tentar de novo", que pede de novo', () => {
		t.relogio.disparar(TIMEOUT_MS);
		expect(t.raiz.querySelector('.rs-grade').dataset.estado).toBe('erro');
		t.clicar('[data-rs="tentar-de-novo"]');
		expect(t.enviados).toEqual([{ acao: 'estado' }, { acao: 'estado' }]);
	});

	it('o estado desenha o saldo REAL formatado e os Destaques na ordem do servidor', () => {
		t.c.receber(estadoDeExemplo());
		expect(t.raiz.querySelector('.rs-carteira-valor strong').textContent).toBe('8.620,00');
		const skus = [...t.raiz.querySelectorAll('.rs-grade .rs-card')].map(el => el.dataset.sku);
		expect(skus).toEqual([
			'POTION_SURVIVAL_PACK',
			'COMPLETE_FARM_PACK',
			'POTION_BLUE_1000',
			'POTION_WHITE_500',
			'LEVELING_PACK',
			'TRAVEL_PACK'
		]);
		expect(t.raiz.querySelector('.rs-card .rs-preco-valor').textContent).toBe('3,50');
	});

	it('versao desconhecida e lixo sao ignorados sem excecao', () => {
		expect(() => t.c.receber({ versao: 2, tipo: 'estado', produtos: [] })).not.toThrow();
		expect(() => t.c.receber(null)).not.toThrow();
		expect(() => t.c.receber('x')).not.toThrow();
		expect(t.raiz.querySelector('.rs-grade').dataset.estado).toBe('carregando');
	});
});

describe('categorias, busca e paginacao', () => {
	beforeEach(() => t.c.receber(estadoDeExemplo()));

	it('as seis categorias, nenhuma de Caixas/Passe/VIP', () => {
		const nomes = [...t.raiz.querySelectorAll('.rs-categoria')].map(b => b.textContent.trim());
		expect(nomes).toEqual(['Destaques', 'Farm & Up', 'Poções', 'Boosts', 'Utilidades', 'Conta']);
		const tudo = t.raiz.innerHTML.toLowerCase();
		expect(tudo).not.toContain('pity');
		expect(tudo).not.toContain('odds');
	});

	it('trocar de categoria filtra pelo campo do servidor', () => {
		t.clicar('[data-categoria="boosts"]');
		const skus = [...t.raiz.querySelectorAll('.rs-card')].map(el => el.dataset.sku);
		expect(skus.sort()).toEqual(['BOOST_DROP_1H', 'BOOST_EXP_1H', 'BOOST_JOB_1H', 'BOOST_TRAINING_PACK']);
		expect(t.raiz.querySelector('.rs-categoria.is-ativa').dataset.categoria).toBe('boosts');
	});

	it('a busca ignora acento e acha pelo conteudo do pack', () => {
		const campo = t.raiz.querySelector('.rs-busca-campo');
		campo.value = 'asa de mosca';
		t.c.onInput({ target: campo });
		expect([...t.raiz.querySelectorAll('.rs-card')].map(el => el.dataset.sku)).toEqual(['TRAVEL_PACK']);
		expect(t.raiz.querySelector('.rs-categoria.is-ativa')).toBeNull();
		campo.value = 'pocao azul';
		t.c.onInput({ target: campo });
		expect(t.raiz.querySelectorAll('.rs-card').length).toBeGreaterThan(3);
		campo.value = 'zzz';
		t.c.onInput({ target: campo });
		expect(t.raiz.querySelector('.rs-grade-vazia').textContent).toContain('Nenhum produto encontrado');
	});

	it('paginacao: 18 produtos numa busca ampla viram 3 paginas de 8', () => {
		const estado = estadoDeExemplo();
		expect(buscarProdutos(estado, 'a').length).toBeGreaterThan(8);
		const campo = t.raiz.querySelector('.rs-busca-campo');
		campo.value = 'a';
		t.c.onInput({ target: campo });
		expect(t.raiz.querySelector('.rs-pagina-atual').textContent).toMatch(/Página 1 de \d/);
		expect(t.raiz.querySelector('[data-pagina="1"][aria-label="Primeira página"]').disabled).toBe(true);
		t.clicar('[aria-label="Última página"]');
		expect(t.raiz.querySelector('[aria-label="Próxima página"]').disabled).toBe(true);
	});
});

describe('card: travado, selo e retrato', () => {
	beforeEach(() => {
		t.c.receber(estadoDeExemplo());
		t.clicar('[data-categoria="conta"]');
	});

	it('produto inativo e esgotado aparecem TRAVADOS com o texto do servidor, sem Adicionar', () => {
		/* Os motivos sao os da secao 4 do contrato: `teto-atingido` e o
		   esgotado; `aguarda-decisao`/`aguarda-cliente`/`sem-efeito` sao o
		   indisponivel. */
		const esgotado = t.raiz.querySelector('.rs-card[data-sku="ACCOUNT_STORAGE_100"]');
		expect(esgotado.classList.contains('is-esgotado')).toBe(true);
		expect(esgotado.textContent).toContain('Seu armazém já está no tamanho máximo.');
		expect(esgotado.querySelector('[data-rs="adicionar"]')).toBeNull();
		expect(esgotado.querySelector('.rs-cadeado svg')).not.toBeNull();
		/* Desde a rodada 2 os quatro estao A VENDA; o estado abaixo os desliga
		   como o servidor faria (`ativo: false` + `indisponivel`). */
		const desligar = ['SERVICE_RENAME', 'SERVICE_APPEARANCE_CHANGE', 'ACCOUNT_CHARACTER_SLOT', 'ACCOUNT_INVENTORY_10'];
		const estado = estadoDeExemplo();
		estado.produtos = estado.produtos.map(p =>
			desligar.indexOf(p.sku) === -1
				? p
				: { ...p, ativo: false, indisponivel: { motivo: 'aguarda-decisao', texto: 'Em breve.' } }
		);
		t.c.receber(estado);
		desligar.forEach(sku => {
			const inativo = t.raiz.querySelector(`.rs-card[data-sku="${sku}"]`);
			expect(inativo.classList.contains('is-indisponivel'), sku).toBe(true);
			expect(inativo.querySelector('[data-rs="adicionar"]'), sku).toBeNull();
		});
	});

	it('o selo so aparece quando o servidor manda, e token desconhecido nao vira selo', () => {
		t.clicar('[data-categoria="destaques"]');
		expect(t.raiz.querySelector('.rs-card[data-sku="POTION_SURVIVAL_PACK"] .rs-selo').textContent).toBe('Popular');
		expect(t.raiz.querySelector('.rs-card[data-sku="POTION_BLUE_1000"] .rs-selo')).toBeNull();
		const estado = estadoDeExemplo();
		estado.produtos[0].selo = 'cassino';
		t.c.receber(estado);
		expect(t.raiz.querySelector('.rs-card[data-sku="POTION_BLUE_1000"] .rs-selo')).toBeNull();
	});

	it('o retrato tenta o pack e depois o conteudo; servico sem item mostra a categoria', () => {
		const estado = estadoDeExemplo();
		expect(idsDoIcone(produtoPorSku(estado, 'TRAVEL_PACK'))).toEqual([9000106, 601, 602]);
		const reset = t.raiz.querySelector('.rs-card[data-sku="ACCOUNT_INVENTORY_10"] .rs-retrato');
		expect(reset.classList.contains('is-servico')).toBe(true);
		expect(reset.querySelector('img').getAttribute('src')).toBe(iconeDaCategoria({ id: 'conta' }));
	});

	it('a arte real, quando carrega, entra PIXELADA no lugar da reserva', () => {
		document.body.innerHTML = '';
		const m = montar({ resolverIcone: (id, ok, falha) => (id === 505 ? ok('/ragidle/item/505.png') : falha()) });
		m.c.abrir();
		m.c.receber(estadoDeExemplo());
		const img = m.raiz.querySelector('.rs-card[data-sku="POTION_BLUE_1000"] .rs-retrato img');
		expect(img.getAttribute('src')).toBe('/ragidle/item/505.png');
		expect(img.className).toBe('rs-retrato-arte');
		expect(CSS).toMatch(/\.rs-retrato-arte \{[^}]*image-rendering: pixelated/);
	});
});

describe('carrinho', () => {
	beforeEach(() => t.c.receber(estadoDeExemplo()));

	it('vazio mostra o Poring do estado vazio e o Comprar nao existe', () => {
		expect(t.raiz.querySelector('.rs-carrinho-vazio img').getAttribute('src')).toContain('shop-empty-cart.png');
		expect(t.raiz.querySelector('[data-rs="comprar"]')).toBeNull();
	});

	it('adicionar, somar, respeitar o teto e remover', () => {
		t.clicar('[data-rs="adicionar"][data-sku="POTION_SURVIVAL_PACK"]');
		t.clicar('[data-rs="adicionar"][data-sku="POTION_SURVIVAL_PACK"]');
		expect(t.c.espiar().carrinho).toEqual([{ sku: 'POTION_SURVIVAL_PACK', quantidade: 2 }]);
		expect(t.raiz.querySelector('.rs-linha .rs-qtd-valor').textContent).toBe('2');
		expect(t.raiz.querySelector('.rs-total-linha--total .rs-preco-valor').textContent).toBe('7,00');
		expect(t.raiz.querySelector('.rs-total-linha--apos').textContent).toContain('8.613,00');
		t.clicar('[data-rs="menos"]');
		expect(t.c.espiar().carrinho[0].quantidade).toBe(1);
		t.clicar('[data-rs="remover"]');
		expect(t.c.espiar().carrinho).toEqual([]);
	});

	it('servico com quantidadeMaxima 1: o "+" nasce desligado e a segunda adicao e recusada', () => {
		const estado = estadoDeExemplo();
		produtoPorSku(estado, 'SERVICE_SKILL_RESET').quantidadeMaxima = 1;
		t.c.receber(estado);
		t.clicar('[data-categoria="utilidades"]');
		t.clicar('[data-rs="adicionar"][data-sku="SERVICE_SKILL_RESET"]');
		expect(t.raiz.querySelector('.rs-linha [data-rs="mais"]').disabled).toBe(true);
		const botao = t.raiz.querySelector('.rs-card[data-sku="SERVICE_SKILL_RESET"] [data-rs="adicionar"]');
		expect(botao.disabled).toBe(true);
		const r = adicionarAoCarrinho(t.c.espiar().carrinho, produtoPorSku(estado, 'SERVICE_SKILL_RESET'));
		expect(r.recusa).toBe('teto');
	});

	it('o carrinho NUNCA guarda preco: o total segue o preco do estado novo', () => {
		t.clicar('[data-rs="adicionar"][data-sku="POTION_BLUE_1000"]');
		const estado = estadoDeExemplo();
		produtoPorSku(estado, 'POTION_BLUE_1000').precoMinor = 250;
		t.c.receber(estado);
		expect(Object.keys(t.c.espiar().carrinho[0])).toEqual(['sku', 'quantidade']);
		expect(t.raiz.querySelector('.rs-total-linha--total .rs-preco-valor').textContent).toBe('2,50');
	});

	it('produto que o servidor desativou SAI do carrinho, com o texto do servidor', () => {
		t.clicar('[data-rs="adicionar"][data-sku="POTION_BLUE_1000"]');
		const estado = estadoDeExemplo();
		produtoPorSku(estado, 'POTION_BLUE_1000').indisponivel = { motivo: 'x', texto: 'Fora de estoque hoje.' };
		t.c.receber(estado);
		expect(t.c.espiar().carrinho).toEqual([]);
		expect(t.raiz.querySelector('.rs-aviso').textContent).toContain('Fora de estoque hoje.');
	});

	it('saldo insuficiente avisa e desliga o Comprar (quem recusa de verdade e o servidor)', () => {
		t.c.receber(estadoDeExemplo({ moeda: { nome: 'RO Cash', saldoMinor: 100 } }));
		t.clicar('[data-rs="adicionar"][data-sku="COMPLETE_FARM_PACK"]');
		expect(t.raiz.querySelector('.rs-aviso-saldo')).not.toBeNull();
		expect(t.raiz.querySelector('[data-rs="comprar"]').disabled).toBe(true);
		expect(t.raiz.querySelector('.rs-total-linha--apos').classList.contains('is-negativo')).toBe(true);
	});
});

describe('checkout', () => {
	beforeEach(() => {
		t.c.receber(estadoDeExemplo());
		t.clicar('[data-rs="adicionar"][data-sku="POTION_SURVIVAL_PACK"]');
		t.clicar('[data-rs="adicionar"][data-sku="COMPLETE_FARM_PACK"]');
		t.enviados.length = 0;
	});

	it('a confirmacao mostra Saldo atual / Total da compra / Saldo apos', () => {
		t.clicar('[data-rs="comprar"]');
		const modal = t.raiz.querySelector('.rs-modal--checkout');
		expect(modal.hidden).toBe(false);
		expect(modal.textContent).toContain('Saldo atual');
		expect(modal.textContent).toContain('8.620,00');
		expect(modal.textContent).toContain('Total da compra');
		expect(modal.textContent).toContain('10,50');
		expect(modal.textContent).toContain('8.609,50');
		expect(t.enviados).toEqual([]);
	});

	it('o pedido leva SO chave, itens (sku+quantidade) e totalEsperadoMinor', () => {
		t.clicar('[data-rs="comprar"]');
		t.clicar('[data-rs="confirmar"]');
		expect(t.enviados).toEqual([
			{
				acao: 'checkout',
				chave: 'chave-1',
				itens: [
					{ sku: 'POTION_SURVIVAL_PACK', quantidade: 1 },
					{ sku: 'COMPLETE_FARM_PACK', quantidade: 1 }
				],
				totalEsperadoMinor: 1050
			}
		]);
		const texto = JSON.stringify(t.enviados[0]);
		['preco', 'desconto', 'saldo', 'itemId', 'entrega'].forEach(campo => {
			expect(texto.includes(`"${campo}`), campo).toBe(false);
		});
	});

	it('clique duplo nao gera dois pedidos (trava ate a resposta)', () => {
		t.clicar('[data-rs="comprar"]');
		const confirmar = t.raiz.querySelector('[data-rs="confirmar"]');
		t.c.onClick({ target: confirmar });
		t.c.onClick({ target: confirmar });
		t.c.onClick({ target: t.raiz.querySelector('[data-rs="confirmar"]') });
		expect(t.enviados.length).toBe(1);
		expect(t.raiz.querySelector('[data-rs="confirmar"]').disabled).toBe(true);
		t.clicar('[data-rs="remover"]');
		expect(t.c.espiar().carrinho.length).toBe(2);
	});

	it('sem resposta em 10 s: destrava, e o reenvio usa a MESMA chave', () => {
		t.clicar('[data-rs="comprar"]');
		t.clicar('[data-rs="confirmar"]');
		t.relogio.disparar(TIMEOUT_MS);
		expect(t.raiz.querySelector('[data-rs="confirmar"]').disabled).toBe(false);
		t.clicar('[data-rs="confirmar"]');
		expect(t.enviados.map(e => e.chave)).toEqual(['chave-1', 'chave-1']);
	});

	it('carrinho mudou depois do timeout: o proximo pedido e OUTRO (chave nova)', () => {
		t.clicar('[data-rs="comprar"]');
		t.clicar('[data-rs="confirmar"]');
		t.relogio.disparar(TIMEOUT_MS);
		t.clicar('[data-rs="fechar-checkout"]');
		t.clicar('[data-rs="mais"]');
		t.clicar('[data-rs="comprar"]');
		t.clicar('[data-rs="confirmar"]');
		expect(t.enviados.map(e => e.chave)).toEqual(['chave-1', 'chave-2']);
	});

	it('ok: limpa o carrinho e mostra o texto do servidor e o saldo novo', () => {
		t.clicar('[data-rs="comprar"]');
		t.clicar('[data-rs="confirmar"]');
		t.c.receber({
			versao: 1,
			tipo: 'resultado',
			acao: 'checkout',
			ok: true,
			chave: 'chave-1',
			texto: 'Compra concluída. Os packs estão na sua mochila.',
			pedido: { id: 'p1', totalMinor: 1050, saldoAntesMinor: 862000, saldoDepoisMinor: 860950, itens: [] }
		});
		expect(t.c.espiar().carrinho).toEqual([]);
		const modal = t.raiz.querySelector('.rs-modal--checkout');
		expect(modal.textContent).toContain('Os packs estão na sua mochila.');
		expect(modal.textContent).toContain('8.609,50');
		t.clicar('[data-rs="fechar-checkout"]');
		expect(modal.hidden).toBe(true);
	});

	it('ok:false: mostra o `texto` do servidor, mantem o carrinho, e o proximo pedido tem chave nova', () => {
		t.clicar('[data-rs="comprar"]');
		t.clicar('[data-rs="confirmar"]');
		t.c.receber({
			versao: 1,
			tipo: 'resultado',
			acao: 'checkout',
			ok: false,
			chave: 'chave-1',
			motivo: 'preco-mudou',
			texto: 'O preço mudou. Confira o carrinho e tente de novo.'
		});
		expect(t.raiz.querySelector('.rs-modal--checkout').textContent).toContain('O preço mudou.');
		expect(t.c.espiar().carrinho.length).toBe(2);
		t.clicar('[data-rs="fechar-checkout"]');
		t.clicar('[data-rs="comprar"]');
		t.clicar('[data-rs="confirmar"]');
		expect(t.enviados.map(e => e.chave)).toEqual(['chave-1', 'chave-2']);
	});

	it('resultado de uma chave que nao e a pendente nao mexe no carrinho', () => {
		t.clicar('[data-rs="comprar"]');
		t.clicar('[data-rs="confirmar"]');
		t.c.receber({ versao: 1, tipo: 'resultado', acao: 'checkout', ok: true, chave: 'outra', texto: 'x' });
		expect(t.c.espiar().carrinho.length).toBe(2);
		expect(t.c.espiar().checkout.fase).toBe('enviando');
	});
});

describe('recarga e Temporada', () => {
	beforeEach(() => t.c.receber(estadoDeExemplo()));

	it('Recarregar MOSTRA o texto do servidor (contrato secao 6), fica clicavel e nunca manda pacote', () => {
		const botao = t.raiz.querySelector('[data-rs="recarregar"]');
		expect(botao.disabled).toBe(false);
		expect(botao.classList.contains('is-indisponivel')).toBe(true);
		t.enviados.length = 0;
		t.clicar('[data-rs="recarregar"]');
		expect(t.enviados).toEqual([]);
		expect(t.raiz.querySelector('.rs-aviso').textContent).toContain('ainda não está disponível');
		t.c.receber(estadoDeExemplo({ recarga: { disponivel: true, texto: 'Fale com a equipe no Discord.' } }));
		expect(t.raiz.querySelector('[data-rs="recarregar"]').classList.contains('is-indisponivel')).toBe(false);
		t.clicar('[data-rs="recarregar"]');
		expect(t.enviados).toEqual([]);
		expect(t.raiz.querySelector('.rs-aviso').textContent).toBe('Fale com a equipe no Discord.');
	});

	it('"Ir para Temporada" so navega: chama a ponte e nao manda nada', () => {
		t.enviados.length = 0;
		expect(t.raiz.querySelector('.rs-temporada-nome').textContent).toBe('Season 1 - Luz & Trevas');
		t.clicar('[data-rs="ir-temporada"]');
		expect(t.temporada).toEqual([1]);
		expect(t.enviados).toEqual([]);
	});

	it('com `temporada: null` o banner da Temporada SOME (nunca um nome inventado)', () => {
		t.c.receber(estadoDeExemplo({ temporada: null }));
		expect(t.raiz.querySelector('.rs-temporada')).toBeNull();
		expect(t.raiz.querySelector('[data-rs="ir-temporada"]')).toBeNull();
	});

	it('Destaques segue `ordemNoDestaque`, e nao a `ordem` da categoria-casa', () => {
		const estado = estadoDeExemplo();
		produtoPorSku(estado, 'TRAVEL_PACK').ordemNoDestaque = 0;
		t.c.receber(estado);
		const primeiro = t.raiz.querySelector('.rs-grade .rs-card');
		expect(primeiro.dataset.sku).toBe('TRAVEL_PACK');
	});
});

describe('servicos por credito (usar-servico)', () => {
	beforeEach(() => {
		t.c.receber(estadoDeExemplo());
		t.enviados.length = 0;
	});

	it('Utilidades mostra "Seus servicos" so com credito; Destaques nao', () => {
		expect(t.raiz.querySelector('.rs-servicos')).toBeNull();
		t.clicar('[data-categoria="utilidades"]');
		const linhas = [...t.raiz.querySelectorAll('.rs-servico')];
		expect(linhas.length).toBe(1);
		expect(linhas[0].textContent).toContain('Reset de Skills');
		expect(linhas[0].textContent).toContain('1 crédito');
	});

	it('Usar -> confirmar manda SO acao, chave e servico, uma vez so (clique duplo)', () => {
		t.clicar('[data-categoria="utilidades"]');
		t.clicar('[data-rs="usar-servico"][data-servico="reset-de-skills"]');
		expect(t.raiz.querySelector('.rs-modal--servico').hidden).toBe(false);
		expect(t.enviados).toEqual([]);
		const usar = t.raiz.querySelector('[data-rs="confirmar-servico"]');
		t.c.onClick({ target: usar });
		t.c.onClick({ target: usar });
		expect(t.enviados).toEqual([{ acao: 'usar-servico', chave: 'chave-1', servico: 'reset-de-skills' }]);
	});

	it('sem resposta em 10 s: o reenvio usa a MESMA chave', () => {
		t.clicar('[data-categoria="utilidades"]');
		t.clicar('[data-rs="usar-servico"]');
		t.clicar('[data-rs="confirmar-servico"]');
		t.relogio.disparar(TIMEOUT_MS);
		t.clicar('[data-rs="confirmar-servico"]');
		expect(t.enviados.map(e => e.chave)).toEqual(['chave-1', 'chave-1']);
	});

	it('resultado ok mostra o texto do servidor e os creditos restantes; outra chave e ignorada', () => {
		t.clicar('[data-categoria="utilidades"]');
		t.clicar('[data-rs="usar-servico"]');
		t.clicar('[data-rs="confirmar-servico"]');
		t.c.receber({ versao: 1, tipo: 'resultado', acao: 'usar-servico', ok: true, chave: 'outra', texto: 'x' });
		expect(t.raiz.querySelector('[data-rs="confirmar-servico"]').disabled).toBe(true);
		t.c.receber({
			versao: 1,
			tipo: 'resultado',
			acao: 'usar-servico',
			ok: true,
			chave: 'chave-1',
			servico: 'reset-de-skills',
			repetido: false,
			texto: 'Seus pontos de habilidade voltaram.',
			creditosRestantes: 0
		});
		const modal = t.raiz.querySelector('.rs-modal--servico');
		expect(modal.textContent).toContain('Seus pontos de habilidade voltaram.');
		expect(modal.textContent).toContain('0 créditos restantes');
		t.clicar('[data-rs="fechar-servico"]');
		expect(modal.hidden).toBe(true);
	});

	it('servico com `usavel: false` nasce com o Usar desligado', () => {
		const estado = estadoDeExemplo();
		estado.servicos[0].usavel = false;
		t.c.receber(estado);
		t.clicar('[data-categoria="utilidades"]');
		expect(t.raiz.querySelector('[data-rs="usar-servico"]').disabled).toBe(true);
	});
});

describe('regras de texto e de camada', () => {
	it('nenhum texto que vira tela traz travessao', () => {
		t.c.receber(estadoDeExemplo());
		t.clicar('[data-rs="adicionar"][data-sku="POTION_SURVIVAL_PACK"]');
		t.clicar('[data-rs="detalhes"][data-sku="COMPLETE_FARM_PACK"]');
		const html = t.raiz.innerHTML + HTML;
		expect(html).not.toMatch(/[\u2013\u2014]/);
		const fontes = ['formatoDoRoShop.js', 'controladorDoRoShop.js', 'RoShop.js', 'RoShop.html'];
		fontes.forEach(f => expect(readFileSync(join(BASE, f), 'utf8'), f).not.toMatch(/[\u2013\u2014]/));
	});

	it('o :host apaga o ponteiro e TODA camada mora dentro da janela (que reacende)', () => {
		const raiz = document.createElement('div');
		raiz.innerHTML = HTML;
		const filhos = [...raiz.querySelector('#RoShop').children].map(el => el.classList[0]);
		expect(filhos).toEqual(['rs-window']);
		const host = CSS.slice(CSS.indexOf(':host {'), CSS.indexOf('}', CSS.indexOf(':host {')));
		expect(host).toContain('pointer-events: none');
		const janela = CSS.slice(CSS.indexOf('#RoShop .rs-window {'), CSS.indexOf('}', CSS.indexOf('#RoShop .rs-window {')));
		expect(janela).toContain('pointer-events: auto');
		['rs-modal--detalhes', 'rs-modal--checkout', 'rs-lateral', 'rs-aviso'].forEach(classe => {
			expect(raiz.querySelector(`.rs-window .${classe}`), classe).not.toBeNull();
		});
		const aviso = CSS.slice(CSS.indexOf('#RoShop .rs-aviso {'), CSS.indexOf('}', CSS.indexOf('#RoShop .rs-aviso {')));
		expect(aviso).toContain('pointer-events: none');
	});

	it('a caixa do modal NAO e `.ri-window` (a regra D-932 a poria estatica, por baixo do fundo)', () => {
		/* A prova de tela de 22/09 pegou: abaixo de 600px o Common.css poe
		   `.ri-window` em `position: static !important`, e o toque em
		   "Confirmar compra" caia no fundo escuro - que FECHA o modal. */
		const raiz = document.createElement('div');
		raiz.innerHTML = HTML;
		expect(raiz.querySelectorAll('.rs-modal-caixa').length).toBe(3);
		expect(raiz.querySelector('.rs-modal-caixa.ri-window')).toBeNull();
		const caixa = CSS.slice(CSS.indexOf('#RoShop .rs-modal-caixa {'), CSS.indexOf('}', CSS.indexOf('#RoShop .rs-modal-caixa {')));
		expect(caixa).toContain('z-index: 1');
	});
});

describe('metade pura', () => {
	const estado = estadoDeExemplo();

	it('reserva de categorias quando o estado nao manda, e Destaques junta os `destaque: true`', () => {
		expect(categoriasDoEstado({}).map(c => c.nome)).toEqual([
			'Destaques',
			'Farm & Up',
			'Poções',
			'Boosts',
			'Utilidades',
			'Conta'
		]);
		expect(produtosDaCategoria(estado, { id: 'destaques' }).length).toBe(6);
	});

	it('sem `quantidadeMaxima` o teto e 1 (a reserva segura)', () => {
		expect(tetoDoProduto({ sku: 'X', precoMinor: 1 })).toBe(1);
		expect(tetoDoProduto({ quantidadeMaxima: 10 })).toBe(10);
		expect(tetoDoProduto({ quantidadeMaxima: 2.5 })).toBe(1);
	});

	it('preco que nao e inteiro trava o produto (nunca float)', () => {
		expect(travaDoProduto({ sku: 'X', precoMinor: 1.5 })).toEqual({ tipo: 'indisponivel', texto: 'Preço indisponível' });
	});

	it('pedidoDeCheckout ignora linha de sku que sumiu e soma so o que existe', () => {
		const p = pedidoDeCheckout(
			[
				{ sku: 'POTION_BLUE_1000', quantidade: 3 },
				{ sku: 'NAO_EXISTE', quantidade: 1 }
			],
			estado,
			'k'
		);
		expect(p).toEqual({ acao: 'checkout', chave: 'k', itens: [{ sku: 'POTION_BLUE_1000', quantidade: 3 }], totalEsperadoMinor: 600 });
	});

	it('reconciliar apara a quantidade acima do teto novo', () => {
		const e = estadoDeExemplo();
		produtoPorSku(e, 'POTION_BLUE_1000').quantidadeMaxima = 2;
		const r = reconciliarCarrinho([{ sku: 'POTION_BLUE_1000', quantidade: 5 }], e);
		expect(r.carrinho).toEqual([{ sku: 'POTION_BLUE_1000', quantidade: 2 }]);
		expect(r.ajustados.length).toBe(1);
	});

	it('resumo sem saldo no estado nao inventa saldo', () => {
		const r = resumoDoCarrinho([{ sku: 'POTION_BLUE_1000', quantidade: 1 }], { produtos: estado.produtos });
		expect(r.saldoMinor).toBeNull();
		expect(r.saldoAposMinor).toBeNull();
		expect(r.saldoInsuficiente).toBe(false);
	});

	it('a chave do checkout e um UUID v4 dentro do alfabeto [A-Za-z0-9_-]', () => {
		const a = gerarChaveDeCheckout();
		expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
		expect(gerarChaveDeCheckout()).not.toBe(a);
	});
});

describe('o canal (pacotes) e o dono unico', () => {
	const src = join(process.cwd(), 'src');
	const ler = rel => readFileSync(join(src, rel), 'utf8');

	it('0x0fb8 e o ZC do RO Shop, 0x0fb9 o CZ, os dois de tamanho variavel', () => {
		expect(ler('Network/PacketRegister.js')).toMatch(/0x0fb8:\s*PACKET\.ZC\.RAGIDLE_ROSHOP/);
		const len = ler('Network/Packets/packets2021_len_main.js');
		expect(len).toContain('length_list[0x0fb8] = -1;');
		expect(len).toContain('length_list[0x0fb9] = -1;');
		const estrutura = ler('Network/PacketStructure.js');
		const cz = estrutura.slice(estrutura.indexOf('PACKET.CZ.RAGIDLE_ROSHOP.prototype.build'));
		expect(cz.slice(0, 400)).toContain('writeShort(0x0fb9)');
	});

	it('so o RoShop engancha o ZC_RAGIDLE_ROSHOP (hookPacket substitui)', () => {
		const donos = [];
		const varrer = dir => {
			readdirSync(dir).forEach(nome => {
				const p = join(dir, nome);
				if (statSync(p).isDirectory()) {
					if (nome !== 'Vendors') {
						varrer(p);
					}
				} else if (nome.endsWith('.js') && readFileSync(p, 'utf8').includes('hookPacket(PACKET.ZC.RAGIDLE_ROSHOP')) {
					donos.push(nome);
				}
			});
		};
		varrer(src);
		expect(donos).toEqual(['RoShop.js']);
	});
});
