/**
 * scripts/foto-doacao.mjs - A PROVA DE TELA DA JANELA "DOACAO VIA PIX"
 * (23/09/2026).
 *
 *   RAG_NODE_MODULES=<servidor>/node_modules node scripts/foto-doacao.mjs
 *
 * No molde de `foto-ro-shop.mjs`: um servidor estatico PROPRIO (porta 7362,
 * nunca as do jogo), a janela montada como o `GUIComponent` monta (host ->
 * Shadow DOM -> Common.css -> DoacaoIdle.css -> `.ui-component-root` ->
 * DoacaoIdle.html), o CONTROLADOR DE VERDADE (`controladorDaDoacao.js`) e o
 * estado de exemplo fiel ao protocolo (`tests/fixtures/doacaoEstado.js`).
 *
 * Telas fotografadas: escolha com 100; com 99 (a dica "leve 100"); preenchida
 * e rolada ate o botao; com divida e codigo aberto; pagamento com QR; sucesso;
 * expirado. Em cada foto ela MEDE: transbordo horizontal (pagina, janela e
 * corpo), janela fora da tela, texto cortado, imagem quebrada, e - para cada
 * controle visivel - se o toque no CENTRO dele chega nele (elementFromPoint,
 * com o controle trazido para a vista) e, no dedo, se ele tem 44px.
 *
 * O QUE ELA NAO PROVA: o fio. O `enviar` e falso e as respostas sao injetadas.
 * E alguem precisa OLHAR os PNG (regra 5 do projeto).
 */

import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..');
const SAIDA = process.env.RAG_SAIDA_FOTO_DOACAO || join(RAIZ, 'docs', 'doacao', 'provas-de-tela');
const PORTA = Number(process.env.RAG_PORTA_FOTO_DOACAO || 7362);

function acharModulos() {
	if (process.env.RAG_NODE_MODULES) {
		return process.env.RAG_NODE_MODULES;
	}
	const candidatos = [
		resolve(RAIZ, '..', 'rag-idle-master', 'node_modules'),
		resolve(RAIZ, '..', 'Rag Idle 2.0', 'node_modules')
	];
	return candidatos.find(c => existsSync(join(c, 'playwright'))) || candidatos[0];
}
const { chromium } = createRequire(join(acharModulos(), 'x.js'))('playwright');

const TELAS = [
	{ w: 390, h: 844, dedo: true },
	{ w: 360, h: 740, dedo: true },
	{ w: 1440, h: 900, dedo: false }
];

const TIPOS = {
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.html': 'text/html; charset=utf-8',
	'.png': 'image/png',
	'.webp': 'image/webp'
};

function paginaDoArnes() {
	const commonCss = readFileSync(join(RAIZ, 'src', 'UI', 'Common.css'), 'utf8');
	const css = readFileSync(join(RAIZ, 'src', 'UI', 'Components', 'DoacaoIdle', 'DoacaoIdle.css'), 'utf8');
	const html = readFileSync(join(RAIZ, 'src', 'UI', 'Components', 'DoacaoIdle', 'DoacaoIdle.html'), 'utf8');
	return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Marcellus&family=Figtree:wght@400;500;600;700;800&display=swap">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&display=swap">
<script type="importmap">{ "imports": { "UI/": "/src/UI/", "Utils/": "/src/Utils/" } }</script>
<style>${commonCss}</style>
<style>
html, body { margin: 0; height: 100%; overflow: hidden; }
body { background: #1d2a3a url('/ragidle/mapa-de-midgard.webp') center / cover no-repeat; }
#host { position: absolute; left: 0; top: 0; }
</style></head>
<body><div id="host"></div>
<script type="module">
import { criarControladorDaDoacao } from '/src/UI/Components/DoacaoIdle/controladorDaDoacao.js';
import { confirmarCopia } from '/src/UI/Components/IndicacaoIdle/confirmarCopia.js';
import { estadoDaDoacao, geradaDeExemplo } from '/tests/fixtures/doacaoEstado.js';
const host = document.getElementById('host');
const shadow = host.attachShadow({ mode: 'open' });
const s1 = document.createElement('style'); s1.textContent = ${JSON.stringify(commonCss)}; shadow.appendChild(s1);
const s2 = document.createElement('style'); s2.textContent = ${JSON.stringify(css)}; shadow.appendChild(s2);
const root = document.createElement('div'); root.className = 'ui-component-root';
root.innerHTML = ${JSON.stringify(html)};
shadow.appendChild(root);
window.__enviados = [];
window.__agora = Date.now();
const c = criarControladorDaDoacao({
	raiz: shadow,
	enviar: corpo => window.__enviados.push(corpo),
	agora: () => window.__agora,
	/* O relogio da foto nao anda sozinho: cada foto e um instante. */
	agendar: () => 0,
	cancelar: () => {},
	copiar: () => Promise.resolve(),
	aoCopiar: confirmarCopia
});
shadow.addEventListener('click', e => { const r = c.onClick(e); if (r === 'fechar') window.__fechou = true; });
shadow.addEventListener('input', e => c.onInput(e));
shadow.addEventListener('change', e => c.onInput(e));
window.__c = c;
window.__estado = estadoDaDoacao;
window.__gerada = geradaDeExemplo;
/* O que o jogo faz: o registro da pilha marca o host e o corpo (D-932/D-941);
   a HUD vertical carimba 'ri-vertical' quando e dedo + em pe + estreito. */
host.classList.add('ri-janela');
shadow.querySelector('.dc-window').classList.add('ri-janela-corpo');
window.__vertical = () => {
	document.documentElement.classList.add('ri-vertical');
	root.classList.add('ri-vertical');
};
window.__abrir = () => {
	const win = shadow.querySelector('.dc-window');
	win.classList.add('is-open');
	c.abrir();
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
		} else if (url.startsWith('/src/') || url.startsWith('/tests/fixtures/')) {
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

/* ------------------------------------------------------------------ */
/* Medida                                                              */
/* ------------------------------------------------------------------ */

async function medir(page, dedo) {
	return page.evaluate(async dedo => {
		const sh = document.getElementById('host').shadowRoot;
		const vw = innerWidth;
		const vh = innerHeight;
		const defeitos = [];
		const visivel = el => {
			const r = el.getBoundingClientRect();
			const st = getComputedStyle(el);
			return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
		};
		const win = sh.querySelector('.dc-window');
		const rw = win.getBoundingClientRect();
		if (document.documentElement.scrollWidth > vw + 1) {
			defeitos.push(`pagina transborda na horizontal (${document.documentElement.scrollWidth} > ${vw})`);
		}
		if (rw.left < -1 || rw.top < -1 || rw.right > vw + 1 || rw.bottom > vh + 1) {
			defeitos.push(`janela fora da tela: ${Math.round(rw.left)},${Math.round(rw.top)} ${Math.round(rw.width)}x${Math.round(rw.height)}`);
		}
		[win, sh.querySelector('.dc-body')].forEach(el => {
			if (el.scrollWidth > el.clientWidth + 1) {
				defeitos.push(`rolagem horizontal em .${el.className.split(' ')[0]} (${el.scrollWidth} > ${el.clientWidth})`);
			}
		});
		sh.querySelectorAll(
			'.dc-title, .dc-faixa, .dc-faixa-rotulo, .dc-faixa-preco, .dc-resumo-linha, .dc-total, .dc-leve, .dc-btn, .dc-atalho, .dc-aberto, .dc-pag-info > div, .dc-copia-linha, .dc-aceite'
		).forEach(el => {
			if (visivel(el) && el.scrollWidth > el.clientWidth + 1) {
				defeitos.push(`texto cortado: .${el.className.split(' ').join('.')} (${el.scrollWidth} > ${el.clientWidth})`);
			}
		});
		sh.querySelectorAll('img').forEach(img => {
			if (visivel(img) && (!img.complete || img.naturalWidth === 0)) {
				defeitos.push('imagem quebrada: ' + (img.getAttribute('src') || '').slice(0, 40));
			}
		});
		/* O TOQUE CHEGA? Cada controle visivel vem para a vista e o centro dele
		   tem de devolver ele mesmo. Depois a rolagem volta ao ponto da foto. */
		const rolaveis = [win, sh.querySelector('.dc-body')];
		const antes = rolaveis.map(el => el.scrollTop);
		const controles = [...sh.querySelectorAll('button, input:not([type="checkbox"]), .dc-aceite')].filter(visivel);
		const alvos = [];
		for (const el of controles) {
			el.scrollIntoView({ block: 'center', inline: 'nearest' });
			await new Promise(r => requestAnimationFrame(r));
			const r = el.getBoundingClientRect();
			const nome = el.dataset.dc || el.dataset.dcCampo || el.className.split(' ')[0];
			if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) {
				defeitos.push(`controle inalcancavel (fora da tela mesmo rolando): ${nome}`);
				continue;
			}
			const cx = r.left + r.width / 2;
			const cy = r.top + r.height / 2;
			const quem = sh.elementFromPoint(cx, cy);
			if (!quem || !(quem === el || el.contains(quem))) {
				defeitos.push(`o toque nao chega em ${nome}: cai em ${quem ? quem.className || quem.tagName : 'nada'}`);
			}
			if (dedo && (r.height < 43.5 || r.width < 43.5)) {
				defeitos.push(`alvo pequeno para o dedo: ${nome} ${Math.round(r.width)}x${Math.round(r.height)}`);
			}
			alvos.push(nome);
		}
		rolaveis.forEach((el, i) => (el.scrollTop = antes[i]));
		const menorFonte = [...sh.querySelectorAll('.dc-window *')]
			.filter(el => visivel(el) && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()))
			.reduce((m, el) => Math.min(m, parseFloat(getComputedStyle(el).fontSize)), 99);
		const gerar = sh.querySelector('[data-dc="gerar"]');
		return {
			janela: { x: Math.round(rw.left), y: Math.round(rw.top), w: Math.round(rw.width), h: Math.round(rw.height) },
			menorFonte,
			controles: alvos.length,
			gerarHabilitado: gerar ? !gerar.disabled : null,
			defeitos: [...new Set(defeitos)]
		};
	}, dedo);
}

/* ------------------------------------------------------------------ */
/* Roteiro                                                             */
/* ------------------------------------------------------------------ */

const SH = `document.getElementById('host').shadowRoot`;
const CLIQUE = sel => `${SH}.querySelector(${JSON.stringify(sel)}).click()`;
const DIGITAR = (campo, valor) =>
	`(() => { const el = ${SH}.querySelector('[data-dc-campo="${campo}"]'); ` +
	`if (el.type === 'checkbox') { el.checked = ${JSON.stringify(valor)}; } else { el.value = ${JSON.stringify(valor)}; } ` +
	`el.dispatchEvent(new Event('input', { bubbles: true, composed: true })); })()`;

async function preparar(page, vertical, estado = {}) {
	await page.goto(`http://127.0.0.1:${PORTA}/arnes`);
	await page.waitForFunction(() => window.__pronto === true);
	if (vertical) {
		await page.evaluate(() => window.__vertical());
	}
	await page.evaluate(() => window.__abrir());
	await page.evaluate(e => window.__c.receber(window.__estado(e)), estado);
	await page.evaluate(() => document.fonts.ready);
	await page.waitForTimeout(300);
}

async function rolarAte(page, sel) {
	await page.evaluate(s => {
		const el = document.getElementById('host').shadowRoot.querySelector(s);
		el.scrollIntoView({ block: 'end' });
	}, sel);
	await page.waitForTimeout(150);
}

async function principal() {
	mkdirSync(SAIDA, { recursive: true });
	const servidor = await servir();
	const navegador = await chromium.launch();
	const relatorio = [];
	const erros = [];
	try {
		for (const T of TELAS) {
			const contexto = await navegador.newContext({
				viewport: { width: T.w, height: T.h },
				deviceScaleFactor: T.dedo ? 2 : 1,
				hasTouch: T.dedo,
				isMobile: T.dedo
			});
			const page = await contexto.newPage();
			const vertical = T.dedo && T.w < 600;
			page.on('console', m => {
				if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) {
					erros.push(`${T.w}: console: ${m.text()}`);
				}
			});
			page.on('pageerror', e => erros.push(`${T.w}: pageerror: ${e.message}`));

			const foto = async nome => {
				const arquivo = `${String(T.w).padStart(4, '0')}-${nome}.png`;
				await page.screenshot({ path: join(SAIDA, arquivo) });
				const m = await medir(page, T.dedo);
				relatorio.push({ largura: T.w, altura: T.h, foto: arquivo, ...m });
				return m;
			};

			await preparar(page, vertical);
			await foto('01-escolha-100');

			await page.evaluate(DIGITAR('quantidade', '99'));
			await rolarAte(page, '.dc-dica');
			await foto('02-escolha-99-com-dica');

			await page.evaluate(CLIQUE('[data-dc="levar"]'));
			await page.evaluate(DIGITAR('nome', 'Guilherme Andrade'));
			await page.evaluate(DIGITAR('cpf', '52998224725'));
			await page.evaluate(DIGITAR('aceite', true));
			await rolarAte(page, '[data-dc="gerar"]');
			const preenchida = await foto('03-preenchida-botao-habilitado');
			if (preenchida.gerarHabilitado !== true) {
				relatorio.at(-1).defeitos.push('o botao "Gerar codigo PIX" nao acendeu com tudo preenchido');
			}

			await preparar(page, vertical, {
				dividaMinor: 1250,
				bonusPercent: 10,
				abertos: [{ txid: 'TX-ABERTO-1', quantidade: 250, totalCentavos: 20750, expiraEmMs: Date.now() + 18 * 60000 }]
			});
			await page.evaluate(() => (window.__agora = Date.now()));
			await page.evaluate(() => window.__c.receber(window.__estado({
				dividaMinor: 1250,
				bonusPercent: 10,
				abertos: [{ txid: 'TX-ABERTO-1', quantidade: 250, totalCentavos: 20750, expiraEmMs: window.__agora + 18 * 60000 }]
			})));
			await foto('04-divida-bonus-e-codigo-aberto');

			await preparar(page, vertical);
			await page.evaluate(() => window.__c.receber(window.__gerada(window.__agora)));
			await foto('05-pagamento-com-qr');
			await rolarAte(page, '[data-dc="voltar"]');
			await foto('05b-pagamento-rolado-ate-voltar');

			await page.evaluate(CLIQUE('[data-dc="ja-paguei"]'));
			await page.evaluate(() =>
				window.__c.receber({ tipo: 'doacao', acao: 'doacao-status', txid: window.__enviados.at(-1).txid, estado: 'pendente' })
			);
			await foto('06-ja-paguei-pendente');

			await page.evaluate(() =>
				window.__c.receber({ tipo: 'doacao', acao: 'doacao-confirmada', txid: 'x', quantidade: 100, creditoMinor: 10000 })
			);
			await foto('07-sucesso');

			await preparar(page, vertical);
			await page.evaluate(() => window.__c.receber(window.__gerada(window.__agora)));
			await page.evaluate(() => {
				window.__agora += 31 * 60000;
				window.__c.render();
			});
			await foto('08-expirado');

			await contexto.close();
		}
	} finally {
		await navegador.close();
		servidor.close();
	}

	writeFileSync(join(SAIDA, 'relatorio.json'), JSON.stringify({ quando: new Date().toISOString(), erros, relatorio }, null, 2));
	let reprovou = erros.length > 0;
	for (const r of relatorio) {
		const tag = r.defeitos.length ? 'DEFEITO' : 'ok';
		if (r.defeitos.length) {
			reprovou = true;
		}
		console.log(
			`${tag.padEnd(7)} ${r.foto}  janela ${r.janela.w}x${r.janela.h}@${r.janela.x},${r.janela.y}  controles ${r.controles}  menor fonte ${r.menorFonte}px`
		);
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
