/**
 * RO SHOP, RODADA 3 (22/09/2026) - os achados da QA independente do cliente.
 *
 * Mesmo aparelho de `roShop.test.js` (HTML de verdade, controlador de verdade,
 * `enviar` falso, relogio manual), mais a ficha de item DE VERDADE
 * (`completarFicha`) onde o defeito morava:
 *
 *  - A-01: a MACA nos 11 SKUs de item. A guarda do RO Shop perguntava
 *    `info === unknownItem`, e `completarFicha` devolve uma COPIA batizada;
 *    agora a pergunta e pelo campo (`temIconeProprio`), e os 11 ids tem
 *    reserva declarada no GRF (o icone do conteudo);
 *  - A-04: "Season 1 - Luz & Trevas" montado do `temporada.id`, nunca cravado;
 *  - A-06: a chip ativa da fita de categorias volta para a vista;
 *  - A-07: gaveta aberta esconde a barra do carrinho e sobe o aviso;
 *  - A-08: carregando e erro sem paginacao;
 *  - A-09: um icone por servico/conta;
 *  - A-05: a janela cresce so em tela grande, sem `zoom`.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { criarControlador, TIMEOUT_MS } from 'UI/Components/RoShop/controladorDoRoShop.js';
import { criarResolverDeIcone } from 'UI/Components/RoShop/iconeDoRoShop.js';
import {
	atalhoTemporadaHtml,
	deslocamentoParaMostrar,
	ICONE_DO_SERVICO,
	rotuloDaTemporada
} from 'UI/Components/RoShop/formatoDoRoShop.js';
import { completarFicha, temIconeProprio, unknownItem } from 'DB/Items/FichaDoItem.js';
import { ICONES_LOCAIS, NOMES_LOCAIS } from 'DB/Items/nomesLocais.js';
import { estadoDeExemplo } from '../fixtures/roShopEstado.js';

const RAIZ = process.cwd();
const BASE = join(RAIZ, 'src', 'UI', 'Components', 'RoShop');
const HTML = readFileSync(join(BASE, 'RoShop.html'), 'utf8');
const CSS = readFileSync(join(BASE, 'RoShop.css'), 'utf8').replace(/\r\n/g, '\n');
const ler = rel => readFileSync(join(RAIZ, 'src', ...rel.split('/')), 'utf8');

const MACA = unknownItem.identifiedResourceName;
/** Os `.bmp` de reserva, lidos do `data.grf` (ver o cabecalho da Rodada 9b). */
const POCAO_AZUL = '\xc6\xc4\xb6\xf5\xc6\xf7\xbc\xc7';
const POCAO_BRANCA = '\xc7\xcf\xbe\xe1\xc6\xf7\xbc\xc7';
const ASA_DE_MOSCA = '\xc6\xc4\xb8\xae\xc0\xc7\xb3\xaf\xb0\xb3';
const MANUAL_DE_COMBATE = '\xc0\xfc\xc5\xf5\xb1\xb3\xb9\xfc';
const GOMA_DE_MASCAR = '\xc7\xb3\xbc\xb1\xb2\xad';

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
	const c = criarControlador({
		raiz,
		enviar: corpo => enviados.push(JSON.parse(JSON.stringify(corpo))),
		gerarChave: () => `chave-${++n}`,
		abrirTemporada: () => {},
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
	return { raiz, c, enviados, relogio: r, clicar };
}

/** O corpo de uma regra `seletor { ... }` dentro de `texto` (a primeira). */
function corpoDaRegra(texto, seletor) {
	const i = texto.indexOf(`${seletor} {`);
	if (i < 0) {
		return null;
	}
	return texto.slice(i, texto.indexOf('}', i));
}

/** O bloco inteiro de um `@media (...)` (chaves balanceadas). */
function blocoDaMedia(consulta) {
	const i = CSS.indexOf(`@media ${consulta} {`);
	if (i < 0) {
		return null;
	}
	let nivel = 0;
	for (let j = CSS.indexOf('{', i); j < CSS.length; j++) {
		if (CSS[j] === '{') {
			nivel++;
		} else if (CSS[j] === '}') {
			nivel--;
			if (nivel === 0) {
				return CSS.slice(i, j + 1);
			}
		}
	}
	return null;
}

let t;
beforeEach(() => {
	document.body.innerHTML = '';
	t = montar();
	t.c.abrir();
});

describe('A-01: a maca nunca e o icone de um item do RO Shop', () => {
	it('a guarda e por CAMPO: a copia batizada de unknownItem NAO tem icone proprio', () => {
		/* 9.000.300 (visual da Season 1) tem nome local e nenhum icone local:
		   `completarFicha` devolve uma COPIA de `unknownItem` com o nome dele e
		   o recurso da maca. A guarda velha (`!== unknownItem`) a aceitava. */
		const copia = completarFicha(9000300, null);
		expect(copia).not.toBe(unknownItem);
		expect(copia.identifiedResourceName).toBe(MACA);
		expect(temIconeProprio(copia)).toBe(false);
		expect(temIconeProprio(unknownItem)).toBe(false);
		expect(temIconeProprio(null)).toBe(false);
		expect(temIconeProprio({ identifiedResourceName: '' })).toBe(false);
		expect(temIconeProprio({ identifiedResourceName: POCAO_AZUL })).toBe(true);
	});

	it('os 11 consumiveis tem reserva declarada no GRF, e nenhum e a maca', () => {
		const esperado = {
			9000100: MANUAL_DE_COMBATE,
			9000101: MANUAL_DE_COMBATE,
			9000102: GOMA_DE_MASCAR,
			9000103: POCAO_AZUL,
			9000104: POCAO_BRANCA,
			9000105: POCAO_AZUL,
			9000106: ASA_DE_MOSCA,
			9000107: POCAO_BRANCA,
			9000108: POCAO_BRANCA,
			9000109: POCAO_BRANCA,
			9000110: MANUAL_DE_COMBATE
		};
		for (let id = 9000100; id <= 9000110; id++) {
			expect(ICONES_LOCAIS[id], String(id)).toBe(esperado[id]);
			expect(NOMES_LOCAIS[id], String(id)).toBeTruthy();
			/* Ausente da tabela (o id e nosso) e com estube: os dois caminhos. */
			for (const ficha of [null, { ClassNum: 0 }]) {
				const f = completarFicha(id, ficha);
				expect(f.identifiedResourceName, String(id)).toBe(esperado[id]);
				expect(temIconeProprio(f), String(id)).toBe(true);
			}
		}
	});

	it('o resolvedor do RO Shop recusa a copia com a maca e nunca pede o .bmp dela', () => {
		const pedidosAoGrf = [];
		const resolver = criarResolverDeIcone({
			preferirArtePublicada: (_url, _ok, falha) => falha(),
			urlPublicada: id => `/ragidle/item/${id}.png`,
			fichaDoItem: id => completarFicha(id, null),
			carregarDoGrf: (recurso, ok) => {
				pedidosAoGrf.push(recurso);
				ok(`grf:${recurso}`);
			}
		});
		const resultado = [];
		resolver(
			9000300,
			url => resultado.push(['ok', url]),
			() => resultado.push(['falhou'])
		);
		expect(resultado).toEqual([['falhou']]);
		expect(pedidosAoGrf).toEqual([]);
		resolver(
			9000103,
			url => resultado.push(['ok', url]),
			() => resultado.push(['falhou'])
		);
		expect(resultado[1]).toEqual(['ok', `grf:${POCAO_AZUL}`]);
		expect(pedidosAoGrf).toEqual([POCAO_AZUL]);
	});

	it('o PNG publicado VENCE: com ele, a ficha nem e consultada', () => {
		let consultas = 0;
		const resolver = criarResolverDeIcone({
			preferirArtePublicada: (url, ok) => ok(url),
			urlPublicada: id => `/ragidle/item/${id}.png`,
			fichaDoItem: id => {
				consultas++;
				return completarFicha(id, null);
			},
			carregarDoGrf: () => {
				throw new Error('nao devia chegar ao GRF');
			}
		});
		const urls = [];
		resolver(9000107, u => urls.push(u), () => urls.push('falhou'));
		expect(urls).toEqual(['/ragidle/item/9000107.png']);
		expect(consultas).toBe(0);
	});

	it('na janela inteira: nenhum retrato de item recebe o .bmp da maca', () => {
		document.body.innerHTML = '';
		const grf = [];
		const m = montar({
			resolverIcone: criarResolverDeIcone({
				preferirArtePublicada: (_url, _ok, falha) => falha(),
				urlPublicada: id => `/ragidle/item/${id}.png`,
				fichaDoItem: id => completarFicha(id, null),
				carregarDoGrf: (recurso, ok) => {
					grf.push(recurso);
					ok(`data:grf,${encodeURIComponent(recurso)}`);
				}
			})
		});
		m.c.abrir();
		m.c.receber(estadoDeExemplo());
		for (const cat of ['destaques', 'farm-up', 'pocoes', 'boosts']) {
			m.clicar(`[data-categoria="${cat}"]`);
		}
		expect(grf.length).toBeGreaterThan(0);
		expect(grf).not.toContain(MACA);
		m.clicar('[data-categoria="pocoes"]');
		const img = m.raiz.querySelector('.rs-card[data-sku="POTION_BLUE_1000"] .rs-retrato img');
		expect(img.getAttribute('src')).toBe(`data:grf,${encodeURIComponent(POCAO_AZUL)}`);
	});

	it('a costura: RoShop.js usa o resolvedor novo, e o aviso de obtido pede o PNG publicado primeiro', () => {
		const loja = ler('UI/Components/RoShop/RoShop.js');
		expect(loja).not.toMatch(/===\s*unknownItem/);
		expect(loja).toMatch(/criarResolverDeIcone\(\{/);
		const obtido = ler('UI/Components/ItemObtain/ItemObtain.js');
		expect(obtido).toMatch(/preferirArtePublicada\(itemIconUrl\(item\.ITID\), aplicarIcone, \(\) => \{/);
	});
});

describe('A-04: o banner da Temporada monta "Season N" do id do servidor', () => {
	it('"S1" vira "Season 1"; id fora do formato nao vira nada', () => {
		expect(rotuloDaTemporada({ id: 'S1', nome: 'Luz & Trevas' })).toBe('Season 1');
		expect(rotuloDaTemporada({ id: 's12' })).toBe('Season 12');
		expect(rotuloDaTemporada({ id: 'VERAO', nome: 'x' })).toBe('');
		expect(rotuloDaTemporada({ nome: 'Luz & Trevas' })).toBe('');
		expect(rotuloDaTemporada(null)).toBe('');
	});

	it('com o payload do contrato o banner diz "Season 1 - Luz & Trevas"; sem id, so o nome', () => {
		t.c.receber(estadoDeExemplo());
		expect(t.raiz.querySelector('.rs-temporada-nome').textContent).toBe('Season 1 - Luz & Trevas');
		t.c.receber(estadoDeExemplo({ temporada: { nome: 'Luz & Trevas', fase: 'aberta' } }));
		expect(t.raiz.querySelector('.rs-temporada-nome').textContent).toBe('Luz & Trevas');
		const jaTem = atalhoTemporadaHtml({ id: 'S1', nome: 'Season 1 - Luz & Trevas' });
		expect(jaTem).toContain('>Season 1 - Luz &amp; Trevas<');
		expect(jaTem).not.toMatch(/Season 1 - Season/);
	});

	it('a caixa alta e do CSS (o texto continua o do servidor)', () => {
		expect(corpoDaRegra(CSS, '#RoShop .rs-temporada-nome')).toContain('text-transform: uppercase');
	});
});

describe('A-06: a chip ativa volta para a vista na fita do celular', () => {
	it('a conta do deslocamento: fora pela direita, pela esquerda, e ja dentro', () => {
		const fita = { left: 0, right: 360 };
		expect(deslocamentoParaMostrar(fita, { left: 400, right: 500 })).toBe(152);
		expect(deslocamentoParaMostrar(fita, { left: 300, right: 420 })).toBe(72);
		expect(deslocamentoParaMostrar(fita, { left: -80, right: 20 })).toBe(-92);
		expect(deslocamentoParaMostrar(fita, { left: 20, right: 200 })).toBe(0);
		/* chip mais larga que a fita: alinha o COMECO do nome */
		expect(deslocamentoParaMostrar(fita, { left: 100, right: 600 })).toBe(88);
		expect(deslocamentoParaMostrar(null, null)).toBe(0);
	});

	it('trocar de categoria rola a fita (so na horizontal), e um redesenho qualquer nao', () => {
		t.c.receber(estadoDeExemplo());
		const fita = t.raiz.querySelector('.rs-categorias');
		let scrollLeft = 0;
		Object.defineProperty(fita, 'scrollWidth', { configurable: true, get: () => 700 });
		Object.defineProperty(fita, 'clientWidth', { configurable: true, get: () => 360 });
		Object.defineProperty(fita, 'scrollLeft', {
			configurable: true,
			get: () => scrollLeft,
			set: v => {
				scrollLeft = v;
			}
		});
		fita.getBoundingClientRect = () => ({ left: 0, right: 360 });
		const posicao = { destaques: 0, 'farm-up': 120, pocoes: 240, boosts: 360, utilidades: 480, conta: 600 };
		const original = window.HTMLElement.prototype.getBoundingClientRect;
		window.HTMLElement.prototype.getBoundingClientRect = function () {
			const cat = this.dataset && this.dataset.categoria;
			if (cat in posicao) {
				const left = posicao[cat] - scrollLeft;
				return { left, right: left + 100 };
			}
			return original.call(this);
		};
		try {
			t.clicar('[data-categoria="conta"]');
			expect(scrollLeft).toBe(352);
			/* O jogador rola a fita de volta com o dedo; um estado novo chega. */
			scrollLeft = 0;
			t.c.receber(estadoDeExemplo());
			t.clicar('[data-rs="adicionar"][data-sku="ACCOUNT_CHARACTER_SLOT"]');
			expect(scrollLeft).toBe(0);
			/* Reabrir a janela traz a chip ativa de volta. */
			t.c.fechar();
			t.c.abrir();
			expect(scrollLeft).toBe(352);
		} finally {
			window.HTMLElement.prototype.getBoundingClientRect = original;
		}
	});
});

describe('A-07: a gaveta aberta e a tela inteira, e o aviso nao cobre o Comprar', () => {
	const celular = () => blocoDaMedia('(max-width: 759px)');

	it('no celular a barra do carrinho SAI com a gaveta aberta', () => {
		const regra = corpoDaRegra(celular(), '#RoShop .rs-window.is-gaveta-aberta .rs-barra-carrinho');
		expect(regra).toContain('display: none');
		t.c.receber(estadoDeExemplo());
		t.clicar('[data-rs="abrir-gaveta"]');
		expect(t.raiz.querySelector('.rs-window').classList.contains('is-gaveta-aberta')).toBe(true);
	});

	it('com a gaveta aberta o aviso sobe para o alto; no desktop ele se centra na area principal', () => {
		const regra = corpoDaRegra(celular(), '#RoShop .rs-window.is-gaveta-aberta .rs-aviso');
		expect(regra).toMatch(/top: 56px/);
		expect(regra).toMatch(/bottom: auto/);
		const base = corpoDaRegra(CSS, '#RoShop .rs-aviso');
		expect(base).toContain('left: calc((100% - var(--rs-lateral)) / 2)');
		expect(corpoDaRegra(CSS, '#RoShop .rs-corpo')).toContain('var(--rs-lateral)');
	});
});

describe('A-08: carregando e erro sem paginacao', () => {
	it('carregando: nada de "Pagina 1 de 1"', () => {
		expect(t.raiz.querySelector('.rs-grade').dataset.estado).toBe('carregando');
		expect(t.raiz.querySelector('.rs-paginacao').innerHTML).toBe('');
	});

	it('erro de carga: a grade diz o erro e a paginacao some; o estado depois a traz de volta', () => {
		t.relogio.disparar(TIMEOUT_MS);
		expect(t.raiz.querySelector('.rs-grade').dataset.estado).toBe('erro');
		expect(t.raiz.querySelector('.rs-paginacao').innerHTML).toBe('');
		expect(t.raiz.querySelector('.rs-paginacao').textContent).not.toMatch(/Página/);
		t.c.receber(estadoDeExemplo());
		expect(t.raiz.querySelector('.rs-paginacao').textContent).toMatch(/Página 1 de/);
	});
});

describe('A-09: cada servico/conta com o seu icone', () => {
	const SERVICOS = [
		'SERVICE_SKILL_RESET',
		'SERVICE_STAT_RESET',
		'SERVICE_RENAME',
		'SERVICE_APPEARANCE_CHANGE',
		'ACCOUNT_CHARACTER_SLOT',
		'ACCOUNT_INVENTORY_10',
		'ACCOUNT_STORAGE_100'
	];

	it('os 7 tem icone, todos DIFERENTES, e o PNG publicado existe', () => {
		const ids = SERVICOS.map(sku => ICONE_DO_SERVICO[sku]);
		ids.forEach((id, i) => expect(Number.isInteger(id), SERVICOS[i]).toBe(true));
		expect(new Set(ids).size).toBe(7);
		ids.forEach(id =>
			expect(existsSync(join(RAIZ, 'public', 'ragidle', 'item', `${id}.png`)), `${id}.png`).toBe(true)
		);
	});

	it('o card pede o icone do servico, e a reserva continua a da categoria', () => {
		t.c.receber(estadoDeExemplo());
		const vistos = new Set();
		for (const cat of ['utilidades', 'conta']) {
			t.clicar(`[data-categoria="${cat}"]`);
			t.raiz.querySelectorAll('.rs-grade .rs-card').forEach(card => {
				const retrato = card.querySelector('.rs-retrato');
				expect(retrato.classList.contains('is-servico'), card.dataset.sku).toBe(true);
				expect(retrato.dataset.itemIds, card.dataset.sku).toBe(String(ICONE_DO_SERVICO[card.dataset.sku]));
				expect(retrato.querySelector('img').getAttribute('src')).toContain(`shop-icon-${cat === 'conta' ? 'account' : 'utilities'}.png`);
				vistos.add(card.dataset.sku);
			});
		}
		expect([...vistos].sort()).toEqual([...SERVICOS].sort());
	});

	it('o id do icone e so ARTE: nunca vai ao servidor no checkout', () => {
		t.c.receber(estadoDeExemplo());
		t.clicar('[data-categoria="conta"]');
		t.clicar('[data-rs="adicionar"][data-sku="ACCOUNT_CHARACTER_SLOT"]');
		t.clicar('[data-rs="comprar"]');
		t.clicar('[data-rs="confirmar"]');
		const pedido = t.enviados[t.enviados.length - 1];
		expect(JSON.stringify(pedido)).not.toContain(String(ICONE_DO_SERVICO.ACCOUNT_CHARACTER_SLOT));
	});
});

describe('A-03: a chamada do Passe nos Destaques da Temporada nao encolhe', () => {
	it('filho da coluna flex com piso de 44px precisa de flex-shrink: 0', () => {
		const css = ler('UI/Components/TemporadaIdle/TemporadaIdle.css').replace(/\r\n/g, '\n');
		expect(corpoDaRegra(css, '#TemporadaIdle .te-chamada-passe')).toMatch(/flex-shrink: 0;/);
		/* A causa continua la (o piso tatil de 44px) - e por isso o conserto e
		   no card, e nao no piso. */
		expect(css).toMatch(/#TemporadaIdle \.te-chamada-passe,[\s\S]*?min-height: var\(--hit-touch\)/);
		expect(corpoDaRegra(css, '#TemporadaIdle .te-body')).toMatch(/flex-direction: column/);
	});
});

describe('A-05: tela grande ganha janela e letra maiores; o resto nao muda', () => {
	const grande = () => blocoDaMedia('(min-width: 1360px) and (min-height: 860px)');

	it('so acima de 1360 x 860: janela 1200 x 800 e piso de 11px, sem zoom', () => {
		const bloco = grande();
		expect(bloco).not.toBeNull();
		expect(bloco).toMatch(/width: min\(1200px, 100vw - 16px\)/);
		expect(bloco).toMatch(/height: min\(800px, 100vh - 32px\)/);
		expect(bloco).toMatch(/--type-badge: var\(--fw-bold\) 11px/);
		expect(CSS).not.toMatch(/\bzoom\s*:/);
		/* A janela de base continua a de sempre (1024 e 768 nao mudam). */
		expect(corpoDaRegra(CSS, '#RoShop .rs-window')).toMatch(/width: min\(1040px, 100vw - 16px\)/);
	});

	it('o piso de base sobe: selo 10px e nenhum 9px na janela', () => {
		expect(corpoDaRegra(CSS, '#RoShop')).toMatch(/--type-badge: var\(--fw-bold\) 10px/);
		const semComentarios = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
		expect(semComentarios).not.toMatch(/\b9px\b/);
	});
});
