/**
 * scripts/foto-ro-shop.mjs - A PROVA DE TELA DO RO SHOP (22/09/2026).
 *
 *   node scripts/foto-ro-shop.mjs
 *
 * Regra do projeto: contar elemento nao prova que da para ver. Esta prova sobe
 * um servidor estatico PROPRIO (porta 7361, nunca as do jogo), monta a janela
 * do jeito que o `GUIComponent` monta (host -> Shadow DOM -> Common.css ->
 * RoShop.css -> `.ui-component-root` -> RoShop.html), liga o CONTROLADOR DE
 * VERDADE (`controladorDoRoShop.js`) com o estado de exemplo fiel ao contrato
 * v1 (`tests/fixtures/roShopEstado.js`) e fotografa as SETE larguras do
 * pedido (360, 390, 430, 768, 1024, 1440, 1920), mais os estados.
 *
 * Em cada foto ela MEDE: transbordo da pagina e da janela, elemento com texto
 * cortado, janela/modal/botao fora da tela, imagem quebrada ou esticada, erro
 * no console e pedido de rede que falhou. E alguem precisa OLHAR os PNG.
 *
 * O QUE ELA NAO PROVA: o fio. Nada aqui fala com o servidor - o `enviar` e
 * falso, e o `resultado` do checkout e injetado. A integracao ponta a ponta
 * (0x0fb8/0x0fb9 contra a branch feat/ro-shop do servidor) e prova de pilha.
 *
 * O `playwright` vive no repositorio do SERVIDOR (rag-idle-master/node_modules),
 * como na prova do tutorial; `RAG_NODE_MODULES` troca o caminho.
 */

import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..');
const SAIDA = process.env.RAG_SAIDA_FOTO_RO_SHOP || join(RAIZ, 'docs', 'ro-shop', 'provas-de-tela');
const PORTA = Number(process.env.RAG_PORTA_FOTO_RO_SHOP || 7361);

function acharModulos() {
	if (process.env.RAG_NODE_MODULES) {
		return process.env.RAG_NODE_MODULES;
	}
	/* De uma worktree (`.claude/worktrees/<nome>`) o servidor fica mais acima. */
	const candidatos = [
		resolve(RAIZ, '..', 'rag-idle-master', 'node_modules'),
		resolve(RAIZ, '..', '..', '..', '..', 'rag-idle-master', 'node_modules')
	];
	return candidatos.find(c => existsSync(join(c, 'playwright'))) || candidatos[0];
}
const { chromium } = createRequire(join(acharModulos(), 'x.js'))('playwright');

const LARGURAS = [
	{ w: 360, h: 740, dedo: true },
	{ w: 390, h: 844, dedo: true },
	{ w: 430, h: 932, dedo: true },
	{ w: 768, h: 1024, dedo: true },
	{ w: 1024, h: 768, dedo: false },
	{ w: 1440, h: 900, dedo: false },
	{ w: 1920, h: 1080, dedo: false }
];

/* ------------------------------------------------------------------ */
/* Servidor estatico                                                   */
/* ------------------------------------------------------------------ */

const TIPOS = {
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.html': 'text/html; charset=utf-8',
	'.png': 'image/png',
	'.webp': 'image/webp',
	'.json': 'application/json'
};

function paginaDoArnes() {
	const commonCss = readFileSync(join(RAIZ, 'src', 'UI', 'Common.css'), 'utf8');
	const css = readFileSync(join(RAIZ, 'src', 'UI', 'Components', 'RoShop', 'RoShop.css'), 'utf8');
	const html = readFileSync(join(RAIZ, 'src', 'UI', 'Components', 'RoShop', 'RoShop.html'), 'utf8');
	return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Marcellus&family=Figtree:wght@400;500;600;700;800&display=swap">
<script type="importmap">{ "imports": { "UI/": "/src/UI/", "Utils/": "/src/Utils/", "DB/": "/src/DB/" } }</script>
<style>${commonCss}</style>
<style>
html, body { margin: 0; height: 100%; overflow: hidden; }
body { background: #1d2a3a url('/ragidle/mapa-de-midgard.webp') center / cover no-repeat; }
#host { position: absolute; left: 0; top: 0; }
</style></head>
<body><div id="host"></div>
<script type="module">
import RiIcones from 'UI/ri-icones.js';
import { criarControlador } from '/src/UI/Components/RoShop/controladorDoRoShop.js';
import { estadoDeExemplo } from '/tests/fixtures/roShopEstado.js';
import { criarResolverDeIcone } from '/src/UI/Components/RoShop/iconeDoRoShop.js';
import { completarFicha, unknownItem } from 'DB/Items/FichaDoItem.js';
/*
 * O ICONE COMO NO JOGO (rodada 3, achado A-01): o resolvedor DE VERDADE
 * (iconeDoRoShop.js), com a ficha DE VERDADE (completarFicha + a tabela de
 * nomes/icones locais). O arnes nao tem GRF: o "GRF" daqui devolve o PNG
 * publicado do item que e dono do recurso (Pocao Azul/Branca, Asa de Mosca)
 * e, para o recurso da MACA, o PNG da Maca (512) - se a guarda deixar passar,
 * a foto MOSTRA a maca. Cada recurso pedido fica em window.__grf, e a medida
 * reprova se a maca for pedida.
 */
const GRF_FALSO = {
	'\\xc6\\xc4\\xb6\\xf5\\xc6\\xf7\\xbc\\xc7': 505,
	'\\xc7\\xcf\\xbe\\xe1\\xc6\\xf7\\xbc\\xc7': 504,
	'\\xc6\\xc4\\xb8\\xae\\xc0\\xc7\\xb3\\xaf\\xb0\\xb3': 601,
	[unknownItem.identifiedResourceName]: 512
};
window.__grf = [];
const resolverIcone = criarResolverDeIcone({
	preferirArtePublicada: (url, ok, falha) => { const i = new Image(); i.onload = () => ok(url); i.onerror = () => falha(); i.src = url; },
	urlPublicada: id => '/ragidle/item/' + id + '.png',
	fichaDoItem: id => completarFicha(id, null),
	carregarDoGrf: (recurso, ok, falha) => {
		window.__grf.push(recurso === unknownItem.identifiedResourceName ? 'MACA' : recurso);
		const dono = GRF_FALSO[recurso];
		if (!dono) { falha(); return; }
		const i = new Image(); i.onload = () => ok(i.src); i.onerror = () => falha(); i.src = '/ragidle/item/' + dono + '.png';
	}
});
const host = document.getElementById('host');
const shadow = host.attachShadow({ mode: 'open' });
const s1 = document.createElement('style'); s1.textContent = ${JSON.stringify(commonCss)}; shadow.appendChild(s1);
const s2 = document.createElement('style'); s2.textContent = ${JSON.stringify(css)}; shadow.appendChild(s2);
const root = document.createElement('div'); root.className = 'ui-component-root';
root.innerHTML = ${JSON.stringify(html)}.replace(/<!--RI_ICONE:([a-zA-Z0-9]+)-->/g, (_, k) => RiIcones[k] || '');
shadow.appendChild(root);
window.__enviados = [];
window.__timers = [];
let n = 0;
const c = criarControlador({
	raiz: shadow,
	enviar: corpo => window.__enviados.push(corpo),
	gerarChave: () => 'chave-foto-' + (++n),
	resolverIcone,
	abrirTemporada: () => window.__enviados.push({ navegou: 'temporada' }),
	agendar: (fn, ms) => { window.__timers.push({ fn, ms }); return window.__timers.length; },
	cancelar: () => {}
});
shadow.addEventListener('click', e => c.onClick(e));
shadow.addEventListener('input', e => c.onInput(e));
window.__c = c;
window.__estado = estadoDeExemplo;
/*
 * O QUE O JOGO FAZ COM A JANELA, reproduzido: o registro da pilha marca o
 * host com 'ri-janela' (D-932) e o corpo com 'ri-janela-corpo' (D-941); a
 * HUD vertical carimba 'ri-vertical' no <html> e no root interno do shadow
 * quando o aparelho e dedo + em pe + estreito. O Common.css do documento
 * (UIManager) le as duas marcas.
 */
host.classList.add('ri-janela');
shadow.querySelector('.rs-window').classList.add('ri-janela-corpo');
window.__vertical = () => {
	document.documentElement.classList.add('ri-vertical');
	root.classList.add('ri-vertical');
};
window.__abrir = () => {
	const win = shadow.querySelector('.rs-window');
	win.classList.add('is-open');
	c.abrir();
	/* offsetWidth, e nao getBoundingClientRect: a animacao de abrir escala a
	   janela em 0,98 no primeiro quadro, e a caixa medida sairia menor. */
	host.style.left = Math.max(0, Math.round((innerWidth - win.offsetWidth) / 2)) + 'px';
	host.style.top = Math.max(0, Math.round((innerHeight - win.offsetHeight) / 2)) + 'px';
};
window.__disparar = ms => { const t = window.__timers.filter(x => x.ms >= ms); window.__timers = []; t.forEach(x => x.fn()); };
window.__pronto = true;
</script></body></html>`;
}

function servir() {
	const servidor = createServer((req, res) => {
		const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
		if (url === '/' || url === '/arnes') {
			res.writeHead(200, { 'content-type': TIPOS['.html'] });
			res.end(paginaDoArnes());
			return;
		}
		let base;
		let rel;
		if (url.startsWith('/ragidle/')) {
			base = join(RAIZ, 'public');
			rel = url;
		} else if (url.startsWith('/src/') || url.startsWith('/tests/fixtures/')) {
			base = RAIZ;
			rel = url;
		} else {
			res.writeHead(404);
			res.end();
			return;
		}
		const alvo = normalize(join(base, rel));
		if (!alvo.startsWith(base + sep) || !existsSync(alvo)) {
			res.writeHead(404);
			res.end();
			return;
		}
		res.writeHead(200, { 'content-type': TIPOS[extname(alvo)] || 'application/octet-stream' });
		res.end(readFileSync(alvo));
	});
	return new Promise(ok => servidor.listen(PORTA, '127.0.0.1', () => ok(servidor)));
}

/* ------------------------------------------------------------------ */
/* Medida                                                              */
/* ------------------------------------------------------------------ */

async function medir(page) {
	return page.evaluate(() => {
		const sh = document.getElementById('host').shadowRoot;
		const vw = innerWidth;
		const vh = innerHeight;
		const defeitos = [];
		const visivel = el => {
			const r = el.getBoundingClientRect();
			const st = getComputedStyle(el);
			return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
		};
		const dentro = (r, c, folga = 1) =>
			r.left >= c.left - folga &&
			r.right <= c.right + folga &&
			r.top >= c.top - folga &&
			r.bottom <= c.bottom + folga;
		const tela = { left: 0, top: 0, right: vw, bottom: vh };
		if ((window.__grf || []).includes('MACA')) {
			defeitos.push('a MACA foi pedida ao GRF (guarda do icone furada, achado A-01)');
		}
		/* Carregando e erro nao tem paginacao (A-08). */
		const estadoDaGrade = sh.querySelector('.rs-grade').dataset.estado;
		if (estadoDaGrade !== 'pronto' && sh.querySelector('.rs-paginacao').textContent.trim()) {
			defeitos.push(`paginacao no estado "${estadoDaGrade}"`);
		}
		/* Com a gaveta aberta no celular a barra do carrinho sai (A-07). */
		const winAberta = sh.querySelector('.rs-window');
		const barra = sh.querySelector('.rs-barra-carrinho');
		if (winAberta.classList.contains('is-gaveta-aberta') && barra && visivel(barra)) {
			defeitos.push('barra do carrinho visivel com a gaveta aberta');
		}
		/* O aviso visivel nao cobre botao de acao (A-07). */
		const aviso = sh.querySelector('.rs-aviso.is-visivel');
		if (aviso) {
			const ra = aviso.getBoundingClientRect();
			sh.querySelectorAll('[data-rs="comprar"], [data-rs="confirmar"], .rs-barra-carrinho').forEach(b => {
				if (!visivel(b)) {
					return;
				}
				const rb = b.getBoundingClientRect();
				if (ra.left < rb.right && ra.right > rb.left && ra.top < rb.bottom && ra.bottom > rb.top) {
					defeitos.push(`o aviso cobre ${b.dataset.rs || b.className}`);
				}
			});
		}
		/* A chip ativa inteira dentro da fita (A-06). */
		const fita = sh.querySelector('.rs-categorias');
		const ativa = fita && fita.querySelector('.rs-categoria.is-ativa');
		if (ativa && visivel(fita)) {
			const rf = fita.getBoundingClientRect();
			const rc = ativa.getBoundingClientRect();
			if (rc.left < rf.left - 1 || rc.right > rf.right + 1) {
				defeitos.push('a categoria ativa esta fora da vista na fita');
			}
		}
		if (document.documentElement.scrollWidth > vw + 1) {
			defeitos.push(`pagina transborda na horizontal (${document.documentElement.scrollWidth} > ${vw})`);
		}
		const win = sh.querySelector('.rs-window');
		const rw = win.getBoundingClientRect();
		if (!dentro(rw, tela)) {
			defeitos.push(
				`janela fora da tela: ${Math.round(rw.left)},${Math.round(rw.top)} ${Math.round(rw.width)}x${Math.round(rw.height)}`
			);
		}
		const principal = sh.querySelector('.rs-principal');
		if (principal.scrollWidth > principal.clientWidth + 1) {
			defeitos.push(
				`area principal transborda na horizontal (${principal.scrollWidth} > ${principal.clientWidth})`
			);
		}
		const cortaveis =
			'.rs-card, .rs-linha, .rs-carteira, .rs-btn, .rs-categoria, .rs-temporada, .rs-modal-corpo, .rs-totais, .rs-barra-carrinho, .rs-checkout, .rs-total-linha, .rs-paginacao, .rs-ferramentas, .rs-recarregar, .rs-carteira-texto, .rs-carteira-valor, .rs-linha-info, .rs-card-nome, .rs-card-resumo, .rs-grade-titulo, .rs-form, .rs-campo, .rs-opcao, .rs-contador, .rs-relog, .rs-desequipados, .rs-servico';
		sh.querySelectorAll(cortaveis).forEach(el => {
			if (!visivel(el)) {
				return;
			}
			if (el.scrollWidth > el.clientWidth + 1) {
				defeitos.push(
					`transborda: .${el.className.split(' ').join('.')} (${el.scrollWidth} > ${el.clientWidth})`
				);
			}
			const r = el.getBoundingClientRect();
			if (el.closest('.rs-lateral') && !el.closest('.rs-carrinho-corpo') && !dentro(r, rw)) {
				defeitos.push(`fora da janela: .${el.className.split(' ')[0]}`);
			}
		});
		sh.querySelectorAll('.rs-modal:not([hidden]) .rs-modal-caixa').forEach(caixa => {
			if (!dentro(caixa.getBoundingClientRect(), rw)) {
				defeitos.push('modal cortado pela janela');
			}
		});
		['[data-rs="comprar"]', '.rs-barra-carrinho', '[data-rs="confirmar"]', '.rs-close'].forEach(sel => {
			const el = sh.querySelector(sel);
			if (
				el &&
				visivel(el) &&
				!(el.closest('.rs-lateral') && getComputedStyle(el.closest('.rs-lateral')).visibility === 'hidden')
			) {
				const r = el.getBoundingClientRect();
				if (!dentro(r, tela) || !dentro(r, rw)) {
					defeitos.push(`botao escondido/cortado: ${sel}`);
				}
			}
		});
		/* O CLIQUE CHEGA? O centro de cada botao de acao visivel precisa devolver
		   o proprio botao no elementFromPoint - um modal pintado por baixo do
		   fundo escuro passava em todas as medidas acima e nao recebia toque. */
		const acoes =
			'[data-rs="confirmar"], [data-rs="comprar"], [data-rs="fechar-detalhes"], [data-rs="fechar-checkout"], .rs-barra-carrinho, .rs-close, .rs-lateral-fechar, [data-rs="adicionar"][data-fecha], [data-rs="confirmar-servico"], [data-rs="fechar-servico"], [data-rs="voltar-servico"], [data-rs="aparencia-sexo"], [data-rs-campo]';
		sh.querySelectorAll(acoes).forEach(el => {
			if (!visivel(el)) {
				return;
			}
			const lateral = el.closest('.rs-lateral');
			if (lateral && getComputedStyle(lateral).visibility === 'hidden') {
				return;
			}
			const modalAberto = sh.querySelector('.rs-modal:not([hidden])');
			if (modalAberto && !modalAberto.contains(el)) {
				return;
			}
			const r = el.getBoundingClientRect();
			const cx = r.left + r.width / 2;
			const cy = r.top + r.height / 2;
			if (cx < 0 || cy < 0 || cx > vw || cy > vh) {
				return;
			}
			const alvo = sh.elementFromPoint(cx, cy);
			if (!alvo || !(alvo === el || el.contains(alvo))) {
				defeitos.push(
					`o clique nao chega em ${el.className || el.dataset.rs}: cai em ${alvo ? alvo.className || alvo.tagName : 'nada'}`
				);
			}
		});
		const imagens = [...sh.querySelectorAll('img')].filter(visivel);
		imagens.forEach(img => {
			if (!img.complete || img.naturalWidth === 0) {
				defeitos.push(`imagem quebrada: ${img.getAttribute('src')}`);
				return;
			}
			const fit = getComputedStyle(img).objectFit;
			if (fit === 'cover' || fit === 'contain') {
				return;
			}
			const r = img.getBoundingClientRect();
			const razaoTela = r.width / r.height;
			const razaoArte = img.naturalWidth / img.naturalHeight;
			if (Math.abs(razaoTela - razaoArte) / razaoArte > 0.04) {
				defeitos.push(
					`imagem esticada: ${img.getAttribute('src')} (${razaoTela.toFixed(2)} vs ${razaoArte.toFixed(2)})`
				);
			}
		});
		const menorFonte = [...sh.querySelectorAll('.rs-window *')]
			.filter(el => visivel(el) && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()))
			.reduce((m, el) => Math.min(m, parseFloat(getComputedStyle(el).fontSize)), 99);
		return {
			janela: {
				x: Math.round(rw.left),
				y: Math.round(rw.top),
				w: Math.round(rw.width),
				h: Math.round(rw.height)
			},
			menorFonte,
			imagens: imagens.length,
			defeitos: [...new Set(defeitos)]
		};
	});
}

/* ------------------------------------------------------------------ */
/* Roteiro                                                             */
/* ------------------------------------------------------------------ */

const CLIQUE = sel => `document.getElementById('host').shadowRoot.querySelector(${JSON.stringify(sel)}).click()`;

/* Digitar como o navegador: muda o value e dispara o `input` (que o arnes,
   como o RoShop.js, repassa ao controlador). */
const DIGITAR = (sel, valor) =>
	`(() => { const el = document.getElementById('host').shadowRoot.querySelector(${JSON.stringify(sel)}); el.focus(); el.value = ${JSON.stringify(valor)}; el.dispatchEvent(new Event('input', { bubbles: true, composed: true })); })()`;

let vertical = false;

async function preparar(page, { carrinho = true, estado = null } = {}) {
	await page.goto(`http://127.0.0.1:${PORTA}/arnes`);
	await page.waitForFunction(() => window.__pronto === true);
	if (vertical) {
		await page.evaluate(() => window.__vertical());
	}
	await page.evaluate(() => window.__abrir());
	await page.evaluate(e => window.__c.receber(e || window.__estado()), estado);
	if (carrinho) {
		await page.evaluate(CLIQUE('[data-rs="adicionar"][data-sku="POTION_SURVIVAL_PACK"]'));
		await page.evaluate(CLIQUE('[data-rs="adicionar"][data-sku="POTION_SURVIVAL_PACK"]'));
		await page.evaluate(CLIQUE('[data-rs="adicionar"][data-sku="COMPLETE_FARM_PACK"]'));
		await page.evaluate(CLIQUE('[data-rs="adicionar"][data-sku="TRAVEL_PACK"]'));
	}
	await esperarImagens(page);
}

async function esperarImagens(page) {
	await page.evaluate(async () => {
		await document.fonts.ready;
		const sh = document.getElementById('host').shadowRoot;
		await Promise.all(
			[...sh.querySelectorAll('img')].map(img =>
				img.complete
					? null
					: new Promise(ok => {
							img.onload = ok;
							img.onerror = ok;
						})
			)
		);
	});
	/* o aviso do rodape some sozinho em 4,2 s no jogo; na foto ele sai ja
	   (menos nas fotos que existem PARA mostrar o aviso) */
	if (!manterAviso) {
		await page.evaluate(() => {
			const a = document.getElementById('host').shadowRoot.querySelector('.rs-aviso');
			a.classList.remove('is-visivel');
		});
	}
	await page.waitForTimeout(350);
}

let manterAviso = false;

async function principal() {
	mkdirSync(SAIDA, { recursive: true });
	const servidor = await servir();
	const navegador = await chromium.launch();
	const relatorio = [];
	const erros = [];
	try {
		for (const L of LARGURAS) {
			const contexto = await navegador.newContext({
				viewport: { width: L.w, height: L.h },
				deviceScaleFactor: L.w <= 430 ? 2 : 1,
				hasTouch: L.dedo,
				isMobile: L.w <= 430
			});
			const page = await contexto.newPage();
			/* dedo + em pe + estreito: a HUD vertical do jogo (HudVertical.js). */
			vertical = L.dedo && L.w < 600;
			page.on('console', m => {
				/* 404 de sonda de arte e medido pela rede, logo abaixo, com o caminho. */
				if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) {
					erros.push(`${L.w}: console: ${m.text()}`);
				}
			});
			page.on('pageerror', e => erros.push(`${L.w}: pageerror: ${e.message}`));
			const falhas = new Set();
			page.on('requestfailed', r => falhas.add(r.url()));
			page.on('response', r => {
				if (r.status() >= 400) {
					falhas.add(`${r.status()} ${new URL(r.url()).pathname}`);
				}
			});

			const foto = async (nome, extra = {}) => {
				const arquivo = `${String(L.w).padStart(4, '0')}-${nome}.png`;
				await esperarImagens(page);
				await page.screenshot({ path: join(SAIDA, arquivo) });
				const m = await medir(page);
				relatorio.push({ largura: L.w, altura: L.h, foto: arquivo, ...m, ...extra });
			};

			await preparar(page);
			await foto('01-destaques-com-carrinho');

			/* O FIM DA ROLAGEM: paginacao e o atalho da Temporada moram embaixo
			   da grade, e nenhuma foto de topo os mostra. */
			await page.evaluate(() => {
				const p = document.getElementById('host').shadowRoot.querySelector('.rs-principal');
				p.scrollTop = p.scrollHeight;
			});
			await foto('01b-rodape-paginacao-e-temporada');
			await page.evaluate(() => {
				document.getElementById('host').shadowRoot.querySelector('.rs-principal').scrollTop = 0;
			});

			if (L.w < 760) {
				await page.evaluate(CLIQUE('[data-rs="abrir-gaveta"]'));
				await page.waitForTimeout(300);
				await foto('02-gaveta-do-carrinho');
				await page.evaluate(CLIQUE('.rs-lateral-fechar'));
			}

			await page.evaluate(CLIQUE('[data-rs="detalhes"][data-sku="COMPLETE_FARM_PACK"]'));
			await foto('03-detalhes');
			await page.evaluate(CLIQUE('[data-rs="fechar-detalhes"]'));

			if (L.w < 760) {
				await page.evaluate(CLIQUE('[data-rs="abrir-gaveta"]'));
			}
			await page.evaluate(CLIQUE('[data-rs="comprar"]'));
			await foto('04-confirmar-compra');

			/* Os estados, em duas larguras (celular e computador). */
			if (L.w === 390 || L.w === 1440) {
				await page.evaluate(CLIQUE('[data-rs="confirmar"]'));
				await foto('05-processando');
				await page.evaluate(() =>
					window.__c.receber({
						versao: 1,
						tipo: 'resultado',
						acao: 'checkout',
						ok: true,
						chave: 'chave-foto-1',
						texto: 'Compra concluída. Os itens estão na sua mochila.',
						pedido: {
							id: 'p1',
							totalMinor: 1600,
							saldoAntesMinor: 862000,
							saldoDepoisMinor: 860400,
							itens: []
						}
					})
				);
				await foto('06-sucesso');

				await preparar(page, { carrinho: false });
				await page.evaluate(CLIQUE('[data-categoria="conta"]'));
				await foto('07-conta-travados-e-carrinho-vazio');
				if (L.w < 760) {
					await page.evaluate(CLIQUE('[data-rs="abrir-gaveta"]'));
					await page.waitForTimeout(300);
					await foto('08-gaveta-vazia');
					await page.evaluate(CLIQUE('.rs-lateral-fechar'));
				}

				await page.evaluate(() => {
					const sh = document.getElementById('host').shadowRoot;
					const campo = sh.querySelector('.rs-busca-campo');
					campo.value = 'dragao';
					campo.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
				});
				await foto('09-busca-sem-resultado');

				await page.evaluate(() => {
					const sh = document.getElementById('host').shadowRoot;
					const campo = sh.querySelector('.rs-busca-campo');
					campo.value = 'a';
					campo.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
				});
				await foto('10-busca-com-paginacao');

				await preparar(page, { carrinho: false, estado: null });
				await page.evaluate(() =>
					window.__c.receber(window.__estado({ moeda: { nome: 'RO Cash', saldoMinor: 300 } }))
				);
				await page.evaluate(CLIQUE('[data-rs="adicionar"][data-sku="COMPLETE_FARM_PACK"]'));
				if (L.w < 760) {
					await page.evaluate(CLIQUE('[data-rs="abrir-gaveta"]'));
					await page.waitForTimeout(300);
				}
				await foto('11-saldo-insuficiente');

				await preparar(page);
				if (L.w < 760) {
					await page.evaluate(CLIQUE('[data-rs="abrir-gaveta"]'));
				}
				await page.evaluate(CLIQUE('[data-rs="comprar"]'));
				await page.evaluate(CLIQUE('[data-rs="confirmar"]'));
				await page.evaluate(() =>
					window.__c.receber({
						versao: 1,
						tipo: 'resultado',
						acao: 'checkout',
						ok: false,
						chave: 'chave-foto-1',
						motivo: 'preco-mudou',
						texto: 'O preço de um item mudou. Confira o carrinho e tente de novo.'
					})
				);
				await foto('12-recusa-do-servidor');

				await page.goto(`http://127.0.0.1:${PORTA}/arnes`);
				await page.waitForFunction(() => window.__pronto === true);
				if (vertical) {
					await page.evaluate(() => window.__vertical());
				}
				await page.evaluate(() => window.__abrir());
				await foto('13-carregando');
				await page.evaluate(() => window.__disparar(10000));
				await foto('14-erro-de-carga');

				await preparar(page, { carrinho: false });
				await page.evaluate(CLIQUE('[data-categoria="utilidades"]'));
				await foto('16-utilidades-seus-servicos');
				await page.evaluate(CLIQUE('[data-rs="usar-servico"]'));
				await foto('17-usar-servico');

				/* ---- Rodada 2: os estados novos ---- */
				await preparar(page, { carrinho: false });
				await page.evaluate(CLIQUE('[data-categoria="conta"]'));
				await foto('18-conta-contadores-e-seus-servicos');
				await page.evaluate(() => {
					const p = document.getElementById('host').shadowRoot.querySelector('.rs-principal');
					p.scrollTop = p.scrollHeight;
				});
				await foto('18b-conta-fim-da-grade');

				await page.evaluate(CLIQUE('[data-rs="usar-servico"][data-servico="troca-de-nome"]'));
				await foto('19-troca-de-nome-vazio');
				await page.evaluate(DIGITAR('[data-rs-campo="novoNome"]', 'Aurora'));
				await foto('19b-troca-de-nome-preenchido');
				await page.evaluate(CLIQUE('[data-rs="confirmar-servico"]'));
				await foto('20-troca-de-nome-processando');
				await page.evaluate(() =>
					window.__c.receber({
						versao: 1,
						tipo: 'resultado',
						acao: 'usar-servico',
						ok: false,
						chave: 'chave-foto-1',
						motivo: 'parametros-invalidos',
						texto: 'Este nome já está em uso. Escolha outro.',
						parametrosRecusados: { novoNome: 'em-uso' }
					})
				);
				await foto('21-troca-de-nome-recusa');
				await page.evaluate(CLIQUE('[data-rs="voltar-servico"]'));
				await foto('21b-troca-de-nome-corrigir');
				await page.evaluate(DIGITAR('[data-rs-campo="novoNome"]', 'Aurora Boreal'));
				await page.evaluate(CLIQUE('[data-rs="confirmar-servico"]'));
				await page.evaluate(() =>
					window.__c.receber({
						versao: 1,
						tipo: 'resultado',
						acao: 'usar-servico',
						ok: true,
						chave: 'chave-foto-2',
						servico: 'troca-de-nome',
						repetido: false,
						texto: 'Seu personagem agora se chama Aurora Boreal.',
						creditosRestantes: 0,
						requerRelog: true,
						desequipados: []
					})
				);
				await foto('22-troca-de-nome-sucesso-relog');

				await preparar(page, { carrinho: false });
				await page.evaluate(CLIQUE('[data-categoria="conta"]'));
				await page.evaluate(CLIQUE('[data-rs="usar-servico"][data-servico="troca-de-aparencia"]'));
				await foto('23-aparencia-vazio');
				await page.evaluate(CLIQUE('[data-rs="aparencia-sexo"][data-valor="0"]'));
				await page.evaluate(DIGITAR('[data-rs-campo="cabelo"]', '12'));
				await page.evaluate(DIGITAR('[data-rs-campo="corDoCabelo"]', '3'));
				await foto('23b-aparencia-preenchido');
				await page.evaluate(CLIQUE('[data-rs="confirmar-servico"]'));
				await page.evaluate(() =>
					window.__c.receber({
						versao: 1,
						tipo: 'resultado',
						acao: 'usar-servico',
						ok: true,
						chave: 'chave-foto-1',
						servico: 'troca-de-aparencia',
						repetido: false,
						texto: 'Aparência trocada: agora feminino, cabelo 12, cor 3.',
						creditosRestantes: 0,
						requerRelog: true,
						desequipados: [
							{ itemId: 1950, nome: 'Chicote' },
							{ itemId: 2330, nome: 'Vestido de Seda' }
						]
					})
				);
				await foto('24-aparencia-sucesso-desequipados');

				const sexoFixo = await page.evaluate(() => {
					const e = window.__estado();
					e.servicos[3].limites.sexo.fixo = true;
					e.personagem = { ...e.personagem, classe: 19 };
					return e;
				});
				await preparar(page, { carrinho: false, estado: sexoFixo });
				await page.evaluate(CLIQUE('[data-categoria="conta"]'));
				await page.evaluate(CLIQUE('[data-rs="usar-servico"][data-servico="troca-de-aparencia"]'));
				await foto('25-aparencia-classe-de-sexo-fixo');

				if (!L.dedo) {
					await preparar(page);
					const card = await page.evaluateHandle(() =>
						document
							.getElementById('host')
							.shadowRoot.querySelector('.rs-card[data-sku="POTION_BLUE_1000"] [data-rs="adicionar"]')
					);
					await card.asElement().hover();
					await foto('15-hover-no-adicionar');
				}

				/* ---- Rodada 3: os estados que a QA pediu ---- */

				/* No limite: o carrinho ja tem o teto do SKU (`quantidadeMaxima`). */
				const noLimite = await page.evaluate(() => {
					const e = window.__estado();
					e.produtos.find(p => p.sku === 'POTION_BLUE_1000').quantidadeMaxima = 1;
					return e;
				});
				await preparar(page, { carrinho: false, estado: noLimite });
				await page.evaluate(CLIQUE('[data-rs="adicionar"][data-sku="POTION_BLUE_1000"]'));
				await foto('26-no-limite');

				/* Pressionado: o dedo/mouse EM CIMA do Adicionar, antes de soltar. */
				await preparar(page, { carrinho: false });
				const alvo = await page.evaluate(() => {
					const b = document
						.getElementById('host')
						.shadowRoot.querySelector('.rs-card[data-sku="POTION_WHITE_500"] [data-rs="adicionar"]');
					/* No celular o card mora abaixo da dobra: traz para a vista. */
					b.scrollIntoView({ block: 'center' });
					const r = b.getBoundingClientRect();
					return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
				});
				await page.mouse.move(alvo.x, alvo.y);
				await page.mouse.down();
				await foto('27-pressionado');
				await page.mouse.up();
			}

			/* O aviso "X no carrinho." logo depois de adicionar - e, no celular,
			   com a gaveta aberta em seguida (A-07: ele cobria o Comprar). */
			await preparar(page, { carrinho: false });
			await page.evaluate(CLIQUE('[data-rs="adicionar"][data-sku="POTION_WHITE_500"]'));
			if (L.w < 760) {
				await page.evaluate(CLIQUE('[data-rs="abrir-gaveta"]'));
				await page.waitForTimeout(300);
			}
			manterAviso = true;
			await foto('02b-aviso-depois-de-adicionar');
			manterAviso = false;

			relatorio.push({ largura: L.w, falhasDeRede: [...falhas] });
			await contexto.close();
		}
	} finally {
		await navegador.close();
		servidor.close();
	}

	writeFileSync(
		join(SAIDA, 'relatorio.json'),
		JSON.stringify({ quando: new Date().toISOString(), erros, relatorio }, null, 2)
	);
	let reprovou = erros.length > 0;
	for (const r of relatorio) {
		if (r.foto) {
			const tag = r.defeitos.length ? 'DEFEITO' : 'ok';
			if (r.defeitos.length) {
				reprovou = true;
			}
			console.log(
				`${tag.padEnd(7)} ${r.foto}  janela ${r.janela.w}x${r.janela.h}@${r.janela.x},${r.janela.y}  menor fonte ${r.menorFonte}px`
			);
			r.defeitos.forEach(d => console.log(`        - ${d}`));
		} else if (r.falhasDeRede.length) {
			/* A UNICA falha esperada: a sonda da arte publicada de um item custom
			   que ainda nao tem PNG (/ragidle/item/9000xxx.png). A janela cai na
			   reserva, que e o comportamento certo. Qualquer outra reprova. */
			const esperadas = r.falhasDeRede.filter(u => /^404 \/ragidle\/item\/9\d{6}\.png$/.test(u));
			const outras = r.falhasDeRede.filter(u => esperadas.indexOf(u) === -1);
			console.log(`rede ${r.largura}: ${esperadas.length} sondas de arte custom sem PNG (esperado)`);
			if (outras.length) {
				reprovou = true;
				console.log(`DEFEITO rede ${r.largura}: ${outras.join(', ')}`);
			}
		}
	}
	erros.forEach(e => console.log(`ERRO ${e}`));
	console.log(`\n${reprovou ? 'REPROVOU' : 'PASSOU'} - fotos em ${SAIDA}`);
	process.exitCode = reprovou ? 1 : 0;
}

principal().catch(err => {
	console.error(err);
	process.exitCode = 1;
});
