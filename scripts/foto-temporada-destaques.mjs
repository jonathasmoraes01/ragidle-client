/**
 * scripts/foto-temporada-destaques.mjs - OS DESTAQUES DA TEMPORADA NO CELULAR
 * (RO Shop rodada 3, 22/09/2026, achado A-03 da QA independente).
 *
 *   node scripts/foto-temporada-destaques.mjs
 *   RAG_RAIZ=<outro checkout> RAG_ROTULO_FOTO_TEMPORADA=master node scripts/foto-temporada-destaques.mjs
 *
 * O relato: em 390, o card "Passe de Batalha" (`.te-chamada-passe`) tinha 44px
 * de altura e os filhos dele iam ~138px alem, por cima de Caixa Topo e Caixa
 * Meio. Esta prova monta a aba Destaques com a metade pura de verdade
 * (`formatoDaTemporada.js#renderDestaquesHtml`), do jeito que o
 * `GUIComponent` monta (host -> Shadow DOM -> Common.css -> TemporadaIdle.css
 * -> `.ui-component-root` -> TemporadaIdle.html, com `ri-janela`,
 * `ri-janela-corpo` e `ri-vertical` no celular em pe), e MEDE em cada filho
 * direto do corpo:
 *   - filho que desenha ALEM da propria caixa (o card mais baixo que o que ele
 *     contem);
 *   - irmao que invade o seguinte (sobreposicao vertical).
 *
 * `RAG_RAIZ` troca a arvore lida (para medir o master sem tocar nele: so leitura
 * de arquivo). Servidor estatico proprio (porta 7364, nunca as do jogo).
 */

import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const ESTA_ARVORE = resolve(AQUI, '..');
const RAIZ = process.env.RAG_RAIZ ? resolve(process.env.RAG_RAIZ) : ESTA_ARVORE;
const SAIDA =
	process.env.RAG_SAIDA_FOTO_TEMPORADA || join(ESTA_ARVORE, 'docs', 'ro-shop', 'provas-de-tela', 'temporada');
const PORTA = Number(process.env.RAG_PORTA_FOTO_TEMPORADA || 7364);
const ROTULO = process.env.RAG_ROTULO_FOTO_TEMPORADA || '';

function acharModulos() {
	if (process.env.RAG_NODE_MODULES) {
		return process.env.RAG_NODE_MODULES;
	}
	const candidatos = [
		resolve(ESTA_ARVORE, '..', 'rag-idle-master', 'node_modules'),
		resolve(ESTA_ARVORE, '..', '..', '..', '..', 'rag-idle-master', 'node_modules')
	];
	return candidatos.find(c => existsSync(join(c, 'playwright'))) || candidatos[0];
}
const { chromium } = createRequire(join(acharModulos(), 'x.js'))('playwright');

const LARGURAS = [
	{ w: 360, h: 740, dedo: true },
	{ w: 390, h: 844, dedo: true },
	{ w: 430, h: 932, dedo: true },
	{ w: 1440, h: 900, dedo: false }
];

const TIPOS = {
	'.js': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.html': 'text/html; charset=utf-8',
	'.png': 'image/png',
	'.webp': 'image/webp',
	'.json': 'application/json'
};

function paginaDoArnes() {
	const ler = p => readFileSync(join(RAIZ, 'src', 'UI', ...p.split('/')), 'utf8');
	const commonCss = ler('Common.css');
	const css = ler('Components/TemporadaIdle/TemporadaIdle.css');
	const html = ler('Components/TemporadaIdle/TemporadaIdle.html');
	return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Marcellus&family=Figtree:wght@400;500;600;700;800&display=swap">
<script type="importmap">{ "imports": { "UI/": "/src/UI/", "Utils/": "/src/Utils/" } }</script>
<style>${commonCss}</style>
<style>
html, body { margin: 0; height: 100%; overflow: hidden; }
body { background: #1d2a3a url('/ragidle/mapa-de-midgard.webp') center / cover no-repeat; }
#host { position: absolute; left: 0; top: 0; }
</style></head>
<body><div id="host"></div>
<script type="module">
import { renderDestaquesHtml } from '/src/UI/Components/TemporadaIdle/formatoDaTemporada.js';
const host = document.getElementById('host');
const shadow = host.attachShadow({ mode: 'open' });
for (const t of [${JSON.stringify(commonCss)}, ${JSON.stringify(css)}]) {
	const s = document.createElement('style'); s.textContent = t; shadow.appendChild(s);
}
const root = document.createElement('div');
root.className = 'ui-component-root';
root.innerHTML = ${JSON.stringify(html)};
shadow.appendChild(root);
host.classList.add('ri-janela');
const win = shadow.querySelector('.te-window');
win.classList.add('ri-janela-corpo', 'is-open');
window.__vertical = () => {
	document.documentElement.classList.add('ri-vertical');
	root.classList.add('ri-vertical');
};
const caixa = (pool, nome, slot, fechadas, lendaria) => ({
	pool, sku: 'VISUAL_' + pool + '_BOX_S1', nome, slot, precoMinor: 200, fechadas,
	compra: { pode: true, motivo: null, texto: '' },
	pity: { contador: 0, garantia: 40, faltam: 40, garantidoNaProxima: false },
	recompensas: [{ itemId: 9000300, nome: lendaria, raridade: 'LEGENDARY', rotuloDaRaridade: 'Lendária', chance: 50, escala: 10000, slot, animado: false }]
});
const estado = {
	temporada: { id: 'S1', nome: 'Luz & Trevas', subtitulo: 'Herdeiros de Midgard', fase: 'aberta', aberta: true, fimMs: Date.UTC(2026, 9, 22) },
	passe: { niveis: 30, nivel: 0, xpPorNivel: 1000, xpNoNivel: 0, tetoDiarioDeCaca: 400, xpDeCacaHoje: 0, diarias: { tetoDeXp: 600, xpHoje: 0 }, diasRestantes: 30 },
	caixas: [
		caixa('TOP', 'Caixa Topo', 'Topo', 1, 'Máscara do Senhor das Trevas'),
		caixa('MID', 'Caixa Meio', 'Meio', 1, 'Diadema do Grifo'),
		caixa('LOW', 'Caixa Baixo', 'Baixo', 0, 'Light and Dark Master'),
		caixa('GARMENT', 'Caixa Manto', 'Manto', 0, "Lucifer's Wings")
	],
	vip: { ativo: false }
};
shadow.querySelector('.te-carteira-valor').textContent = '8,50';
shadow.querySelector('.te-body').innerHTML = renderDestaquesHtml(estado);
window.__posicionar = () => {
	host.style.left = Math.max(0, Math.round((innerWidth - win.offsetWidth) / 2)) + 'px';
	host.style.top = Math.max(0, Math.round((innerHeight - win.offsetHeight) / 2)) + 'px';
};
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
		if (url.startsWith('/ragidle/')) {
			base = join(RAIZ, 'public');
		} else if (url.startsWith('/src/')) {
			base = RAIZ;
		} else {
			res.writeHead(404);
			res.end();
			return;
		}
		const alvo = normalize(join(base, url));
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

async function medir(page) {
	return page.evaluate(() => {
		const sh = document.getElementById('host').shadowRoot;
		const corpo = sh.querySelector('.te-body');
		const filhos = [...corpo.children];
		const defeitos = [];
		const caixas = filhos.map(el => {
			const r = el.getBoundingClientRect();
			let fundo = r.bottom;
			el.querySelectorAll('*').forEach(d => {
				const x = d.getBoundingClientRect();
				if (x.width > 0 && x.height > 0) {
					fundo = Math.max(fundo, x.bottom);
				}
			});
			return { cls: el.className, top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), fundoDoConteudo: Math.round(fundo) };
		});
		caixas.forEach((c, i) => {
			if (c.fundoDoConteudo > c.bottom + 1) {
				defeitos.push(`${c.cls}: ${c.h}px de altura, o conteudo desce ${c.fundoDoConteudo - c.bottom}px alem`);
			}
			const prox = caixas[i + 1];
			if (prox && c.fundoDoConteudo > prox.top + 1) {
				defeitos.push(`${c.cls} invade ${prox.cls} em ${c.fundoDoConteudo - prox.top}px`);
			}
		});
		const chamada = sh.querySelector('.te-chamada-passe');
		const rc = chamada ? chamada.getBoundingClientRect() : null;
		return {
			chamada: rc ? { h: Math.round(rc.height), w: Math.round(rc.width) } : null,
			caixas,
			defeitos
		};
	});
}

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
			page.on('pageerror', e => erros.push(`${L.w}: pageerror: ${e.message}`));
			await page.goto(`http://127.0.0.1:${PORTA}/arnes`);
			await page.waitForFunction(() => window.__pronto === true);
			if (L.dedo && L.w < 600) {
				await page.evaluate(() => window.__vertical());
			}
			await page.evaluate(() => window.__posicionar());
			await page.evaluate(() => document.fonts.ready);
			await page.waitForTimeout(400);
			/* A chamada do Passe e o que vem logo abaixo, na altura da tela. */
			await page.evaluate(() => {
				const sh = document.getElementById('host').shadowRoot;
				const corpo = sh.querySelector('.te-body');
				const c = sh.querySelector('.te-chamada-passe');
				corpo.scrollTop = Math.max(0, c.offsetTop - 120);
			});
			await page.waitForTimeout(150);
			const arquivo = `${String(L.w).padStart(4, '0')}-destaques${ROTULO ? '-' + ROTULO : ''}.png`;
			await page.screenshot({ path: join(SAIDA, arquivo) });
			relatorio.push({ largura: L.w, foto: arquivo, ...(await medir(page)) });
			await contexto.close();
		}
	} finally {
		await navegador.close();
		servidor.close();
	}
	writeFileSync(
		join(SAIDA, `relatorio-destaques${ROTULO ? '-' + ROTULO : ''}.json`),
		JSON.stringify({ quando: new Date().toISOString(), raiz: RAIZ, erros, relatorio }, null, 2)
	);
	let reprovou = erros.length > 0;
	for (const r of relatorio) {
		if (r.defeitos.length) {
			reprovou = true;
		}
		console.log(
			`${(r.defeitos.length ? 'DEFEITO' : 'ok').padEnd(7)} ${r.foto}  chamada do Passe ${r.chamada ? `${r.chamada.w}x${r.chamada.h}` : '-'}`
		);
		r.defeitos.forEach(d => console.log(`        - ${d}`));
	}
	erros.forEach(e => console.log(`ERRO ${e}`));
	console.log(`\n${reprovou ? 'REPROVOU' : 'PASSOU'} - arvore ${RAIZ} - fotos em ${SAIDA}`);
	process.exitCode = reprovou ? 1 : 0;
}

principal().catch(err => {
	console.error(err);
	process.exitCode = 1;
});
