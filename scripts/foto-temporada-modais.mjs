/**
 * scripts/foto-temporada-modais.mjs - OS MODAIS DA TEMPORADA NO CELULAR
 * (RO Shop rodada 2, 22/09/2026).
 *
 *   node scripts/foto-temporada-modais.mjs
 *
 * A suspeita: as caixas dos modais da Temporada (`.te-modal-caixa`) usam
 * `.ri-window`, e abaixo de 600px a regra D-932 do Common.css poe `.ri-window`
 * em `position: static !important`. No RO Shop o mesmo arranjo pintava a caixa
 * POR BAIXO do fundo escuro absoluto, e o toque em "Confirmar compra" caia no
 * fundo (prova de tela da rodada 1). Esta prova MEDE isso na Temporada.
 *
 * Sobe um servidor estatico proprio (porta 7363, nunca as do jogo), monta a
 * janela como o `GUIComponent` monta (host -> Shadow DOM -> Common.css ->
 * TemporadaIdle.css -> `.ui-component-root` -> TemporadaIdle.html), com as
 * marcas que o jogo poe (`ri-janela` no host, `ri-janela-corpo` na
 * `.te-window`, `ri-vertical` no celular em pe), desenha a aba Caixas com a
 * metade pura de verdade (`formatoDaTemporada.js`) e abre, do mesmo jeito que
 * `TemporadaIdle.js` abre (`hidden = false` + o HTML da metade pura):
 *   - "Ver conteudo" da caixa (`.te-modal--conteudo`);
 *   - a confirmacao de compra (`.te-modal--confirmar`);
 *   - o reveal da abertura (`.te-reveal`).
 * Em cada um pergunta ao `elementFromPoint` se o centro do botao de acao
 * devolve o proprio botao.
 */

import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..');
const SAIDA = process.env.RAG_SAIDA_FOTO_TEMPORADA || join(RAIZ, 'docs', 'ro-shop', 'provas-de-tela', 'temporada');
const PORTA = Number(process.env.RAG_PORTA_FOTO_TEMPORADA || 7363);
const ROTULO = process.env.RAG_ROTULO_FOTO_TEMPORADA || '';

function acharModulos() {
	if (process.env.RAG_NODE_MODULES) {
		return process.env.RAG_NODE_MODULES;
	}
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
import {
	renderBannerDasCaixasHtml, renderCaixaHtml, renderModalConteudoHtml, renderRevealHtml
} from '/src/UI/Components/TemporadaIdle/formatoDaTemporada.js';
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
const recompensas = [
	{ itemId: 9000300, nome: 'Asas de Anjo', raridade: 'COMMON', rotuloDaRaridade: 'Comum', chance: 3250, escala: 10000, slot: 'Topo', animado: false },
	{ itemId: 9000301, nome: 'Asas de Demônio', raridade: 'RARE', rotuloDaRaridade: 'Rara', chance: 1500, escala: 10000, slot: 'Topo', animado: false },
	{ itemId: 9000305, nome: 'Máscara do Senhor das Trevas', raridade: 'LEGENDARY', rotuloDaRaridade: 'Lendária', chance: 50, escala: 10000, slot: 'Topo', animado: false }
];
const caixa = {
	pool: 'TOP', sku: 'VISUAL_TOP_BOX_S1', nome: 'Caixa Topo', slot: 'Topo', precoMinor: 200, fechadas: 2,
	compra: { pode: true, motivo: null, texto: '' },
	pity: { contador: 3, garantia: 40, faltam: 37, garantidoNaProxima: false },
	recompensas
};
shadow.querySelector('.te-carteira-valor').textContent = '8.620,00';
const corpo = shadow.querySelector('.te-body');
corpo.innerHTML = renderBannerDasCaixasHtml() + '<div class="te-caixas-grade">' + [caixa, { ...caixa, pool: 'MID', sku: 'VISUAL_MID_BOX_S1', nome: 'Caixa Meio', slot: 'Meio' }].map(renderCaixaHtml).join('') + '</div>';
window.__posicionar = () => {
	host.style.left = Math.max(0, Math.round((innerWidth - win.offsetWidth) / 2)) + 'px';
	host.style.top = Math.max(0, Math.round((innerHeight - win.offsetHeight) / 2)) + 'px';
};
/* Os tres modais, abertos como TemporadaIdle.js abre (hidden = false). */
window.__abrirConteudo = () => {
	const m = shadow.querySelector('.te-modal--conteudo');
	m.querySelector('.te-modal-corpo').innerHTML = renderModalConteudoHtml(caixa);
	m.hidden = false;
};
window.__abrirConfirmacao = () => {
	const m = shadow.querySelector('.te-modal--confirmar');
	m.querySelector('.te-confirmar-texto').textContent = 'Comprar Caixa Topo por 2,00 RO Cash?';
	m.hidden = false;
};
window.__abrirReveal = () => {
	const el = shadow.querySelector('.te-reveal');
	el.innerHTML = renderRevealHtml({ ok: true, texto: 'Asas de Anjo foi para a sua mochila.', abertura: { itemId: 9000300, nome: 'Asas de Anjo', raridade: 'RARE', rotuloDaRaridade: 'Rara' } });
	el.hidden = false;
};
window.__fecharTudo = () => {
	shadow.querySelectorAll('.te-modal').forEach(m => { m.hidden = true; });
	const r = shadow.querySelector('.te-reveal'); r.hidden = true; r.innerHTML = '';
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

/** O clique chega em cada botao de acao VISIVEL do modal aberto? */
async function medir(page, seletores) {
	return page.evaluate(seletores => {
		const sh = document.getElementById('host').shadowRoot;
		const vw = innerWidth;
		const vh = innerHeight;
		const defeitos = [];
		const detalhes = {};
		for (const sel of seletores) {
			const el = sh.querySelector(sel);
			if (!el) {
				defeitos.push(`${sel} nao existe`);
				continue;
			}
			const r = el.getBoundingClientRect();
			const cx = r.left + r.width / 2;
			const cy = r.top + r.height / 2;
			if (r.width === 0 || r.height === 0) {
				defeitos.push(`${sel} sem tamanho`);
				continue;
			}
			if (cx < 0 || cy < 0 || cx > vw || cy > vh) {
				defeitos.push(`${sel} fora da tela (centro ${Math.round(cx)},${Math.round(cy)})`);
				continue;
			}
			const alvo = sh.elementFromPoint(cx, cy);
			const chega = !!alvo && (alvo === el || el.contains(alvo));
			detalhes[sel] = chega ? 'chega' : `cai em ${alvo ? alvo.className || alvo.tagName : 'nada'}`;
			if (!chega) {
				defeitos.push(`o clique nao chega em ${sel}: ${detalhes[sel]}`);
			}
		}
		const caixa = sh.querySelector('.te-modal:not([hidden]) .te-modal-caixa');
		const posicao = caixa ? getComputedStyle(caixa).position : null;
		return { defeitos, detalhes, posicaoDaCaixa: posicao };
	}, seletores);
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
			page.on('console', m => {
				if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) {
					erros.push(`${L.w}: console: ${m.text()}`);
				}
			});
			await page.goto(`http://127.0.0.1:${PORTA}/arnes`);
			await page.waitForFunction(() => window.__pronto === true);
			if (L.dedo && L.w < 600) {
				await page.evaluate(() => window.__vertical());
			}
			await page.evaluate(() => window.__posicionar());
			await page.evaluate(() => document.fonts.ready);
			const casos = [
				{ nome: 'ver-conteudo', abrir: '__abrirConteudo', botoes: ['.te-modal--conteudo .te-modal-fechar'] },
				{
					nome: 'confirmar-compra',
					abrir: '__abrirConfirmacao',
					botoes: ['.te-modal--confirmar .te-confirmar-ok', '.te-modal--confirmar .te-confirmar-cancelar']
				},
				{ nome: 'reveal', abrir: '__abrirReveal', botoes: ['.te-reveal .te-reveal-fechar'] }
			];
			for (const caso of casos) {
				await page.evaluate(() => window.__fecharTudo());
				await page.evaluate(f => window[f](), caso.abrir);
				await page.waitForTimeout(400);
				const arquivo = `${String(L.w).padStart(4, '0')}-${caso.nome}${ROTULO ? '-' + ROTULO : ''}.png`;
				await page.screenshot({ path: join(SAIDA, arquivo) });
				const m = await medir(page, caso.botoes);
				relatorio.push({ largura: L.w, foto: arquivo, ...m });
			}
			await contexto.close();
		}
	} finally {
		await navegador.close();
		servidor.close();
	}
	writeFileSync(
		join(SAIDA, `relatorio${ROTULO ? '-' + ROTULO : ''}.json`),
		JSON.stringify({ quando: new Date().toISOString(), erros, relatorio }, null, 2)
	);
	let reprovou = erros.length > 0;
	for (const r of relatorio) {
		if (r.defeitos.length) {
			reprovou = true;
		}
		console.log(`${(r.defeitos.length ? 'DEFEITO' : 'ok').padEnd(7)} ${r.foto}  caixa: ${r.posicaoDaCaixa}`);
		r.defeitos.forEach(d => console.log(`        - ${d}`));
	}
	erros.forEach(e => console.log(`ERRO ${e}`));
	console.log(`\n${reprovou ? 'REPROVOU' : 'PASSOU'} - fotos em ${SAIDA}`);
	process.exitCode = reprovou ? 1 : 0;
}

principal().catch(err => {
	console.error(err);
	process.exitCode = 1;
});
