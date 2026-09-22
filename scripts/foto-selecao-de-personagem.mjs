/**
 * scripts/foto-selecao-de-personagem.mjs - A PROVA DE TELA DAS VAGAS DA CONTA
 * na selecao de personagem (RO Shop rodada 2, 22/09/2026).
 *
 *   node scripts/foto-selecao-de-personagem.mjs
 *
 * O dono decidiu 9 vagas gratis + ate 6 compradas (teto 15). Esta prova sobe um
 * servidor estatico PROPRIO (porta 7362, nunca as do jogo), monta a selecao V4
 * como o `GUIComponent` monta (host absoluto -> Shadow DOM -> Common.css ->
 * PreGamePremium.css + CharSelectV4.css -> `.ui-component-root` ->
 * CharSelectV4.html), pinta cada vaga com as MESMAS classes que
 * `CharSelectCommon.updateCharSlot` poe (is-filled/is-empty/is-selected, nome,
 * ficha) e aplica o total da conta com a funcao DE VERDADE
 * (`vagasDaSelecao.js`: `vagasDaConta` + `aplicarVagas`), a partir de uma lista
 * falsa FIEL ao pacote decodificado (`HC_ACCEPT_ENTER_NEO_UNION`:
 * `TotalSlotNum`, `PremiumStartSlot`, `charInfo[].CharNum`...).
 *
 * Fotografa 9, 12 e 15 vagas; 15 nas sete larguras (360, 390, 430, 768, 1024,
 * 1440, 1920) e 9/12 em 390 e 1440. Em cada foto MEDE: quantas vagas estao na
 * tela (tem de ser o total da conta), transbordo horizontal, o contador "X de
 * Y", se o botao de acao recebe o clique (elementFromPoint) e se alguma vaga
 * alem do total e alcancavel.
 *
 * O QUE ELA NAO PROVA: o sprite do personagem (o canvas fica vazio - sem GRF
 * nem Renderer) e o fio com o char-server. O total chega do pacote falso.
 *
 * O `playwright` vive no repositorio do SERVIDOR (rag-idle-master/node_modules).
 */

import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..');
const SAIDA = process.env.RAG_SAIDA_FOTO_SELECAO || join(RAIZ, 'docs', 'ro-shop', 'provas-de-tela', 'selecao');
const PORTA = Number(process.env.RAG_PORTA_FOTO_SELECAO || 7362);

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
	{ w: 1024, h: 768, dedo: false },
	{ w: 1440, h: 900, dedo: false },
	{ w: 1920, h: 1080, dedo: false }
];

/* A conta de exemplo: tres personagens nas vagas gratis e um na vaga 10 (uma
   vaga COMPRADA) - quando a conta tem 12 ou 15, ele aparece; com 9, a vaga 10
   so existe se tiver personagem (nunca some um personagem da tela). */
const PERSONAGENS = [
	{
		CharNum: 0,
		name: 'Aurora',
		job: 4,
		level: 72,
		exp: 1204,
		hp: 3120,
		sp: 410,
		lastMap: 'prontera.gat',
		Str: 60,
		Agi: 40,
		Vit: 30,
		Int: 10,
		Dex: 50,
		Luk: 5
	},
	{
		CharNum: 1,
		name: 'Bardolino',
		job: 19,
		level: 55,
		exp: 820,
		hp: 2100,
		sp: 300,
		lastMap: 'payon.gat',
		Str: 20,
		Agi: 60,
		Vit: 20,
		Int: 20,
		Dex: 70,
		Luk: 10
	},
	{
		CharNum: 2,
		name: 'Cassiopeia',
		job: 2,
		level: 40,
		exp: 300,
		hp: 1200,
		sp: 600,
		lastMap: 'geffen.gat',
		Str: 5,
		Agi: 30,
		Vit: 20,
		Int: 80,
		Dex: 50,
		Luk: 5
	}
];
const NA_VAGA_COMPRADA = {
	CharNum: 10,
	name: 'Dionisio',
	job: 5,
	level: 30,
	exp: 90,
	hp: 900,
	sp: 120,
	lastMap: 'alberta.gat',
	Str: 30,
	Agi: 30,
	Vit: 30,
	Int: 10,
	Dex: 30,
	Luk: 30
};

const TIPOS = {
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.html': 'text/html; charset=utf-8',
	'.png': 'image/png',
	'.webp': 'image/webp',
	'.jpeg': 'image/jpeg',
	'.jpg': 'image/jpeg',
	'.json': 'application/json'
};

function paginaDoArnes() {
	const ler = p => readFileSync(join(RAIZ, 'src', 'UI', ...p.split('/')), 'utf8');
	const commonCss = ler('Common.css');
	const premiumCss = ler('Components/PreGamePremium.css');
	const css = ler('Components/CharSelect/CharSelectV4/CharSelectV4.css');
	const html = ler('Components/CharSelect/CharSelectV4/CharSelectV4.html');
	return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Marcellus&family=Figtree:wght@400;500;600;700;800&display=swap">
<style>${commonCss}</style>
<style>html, body { margin: 0; height: 100%; overflow: hidden; background: #000; }</style>
</head>
<body>
<script type="module">
import { aplicarVagas, vagasDaConta } from '/src/UI/Components/CharSelect/vagasDaSelecao.js';
/* O host como o GUIComponent cria (absoluto, z 50, id = nome). */
const host = document.createElement('div');
host.id = 'CharSelectV4';
host.style.position = 'absolute';
host.style.zIndex = '50';
document.body.appendChild(host);
const shadow = host.attachShadow({ mode: 'open' });
for (const t of [${JSON.stringify(commonCss)}, ${JSON.stringify(premiumCss + css)}]) {
	const s = document.createElement('style'); s.textContent = t; shadow.appendChild(s);
}
const root = document.createElement('div');
root.className = 'ui-component-root';
root.innerHTML = ${JSON.stringify(html)};
shadow.appendChild(root);

/* O que CharSelectCommon faz na grade, com a lista do pacote. */
window.__montar = (pkt, selecionada) => {
	const slots = [];
	(pkt.charInfo || []).forEach(c => { slots[c.CharNum] = c; });
	const vagas = vagasDaConta(pkt, 15);
	shadow.querySelectorAll('.char_canvas').forEach((el, i) => {
		const c = slots[i];
		el.querySelector('.name').textContent = c ? c.name : '';
		el.classList.toggle('is-filled', !!c);
		el.classList.toggle('is-empty', !c);
		el.classList.toggle('is-selected', i === selecionada && !!c);
	});
	aplicarVagas(shadow, vagas, i => !!slots[i]);
	const info = shadow.querySelector('.charinfo');
	const c = slots[selecionada];
	info.classList.toggle('vaga-vazia', !c);
	const campos = { map: c ? c.lastMap.replace('.gat', '') : '', job: c ? 'Classe ' + c.job : '', lvl: c ? c.level : '', exp: c ? c.exp : '', hp: c ? c.hp : '', sp: c ? c.sp : '', str: c ? c.Str : '', agi: c ? c.Agi : '', vit: c ? c.Vit : '', int: c ? c.Int : '', dex: c ? c.Dex : '', luk: c ? c.Luk : '' };
	for (const [k, v] of Object.entries(campos)) { info.querySelector('.' + k).textContent = String(v); }
	for (const sel of ['.delete', '.ok']) { shadow.querySelector(sel).style.display = c ? 'block' : 'none'; }
	for (const sel of ['.canceldelete', '.finaldelete']) { shadow.querySelector(sel).style.display = 'none'; }
	return vagas;
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

async function medir(page, esperadas) {
	return page.evaluate(esperadas => {
		const sh = document.getElementById('CharSelectV4').shadowRoot;
		const vw = innerWidth;
		const vh = innerHeight;
		const defeitos = [];
		const visivel = el => {
			const st = getComputedStyle(el);
			const r = el.getBoundingClientRect();
			return st.display !== 'none' && st.visibility !== 'hidden' && r.width > 0 && r.height > 0;
		};
		const vagas = [...sh.querySelectorAll('.char_canvas')];
		const naTela = vagas.filter(visivel);
		if (naTela.length !== esperadas) {
			defeitos.push(`vagas na grade: ${naTela.length}, esperado ${esperadas}`);
		}
		if (document.documentElement.scrollWidth > vw + 1) {
			defeitos.push(`pagina transborda na horizontal (${document.documentElement.scrollWidth} > ${vw})`);
		}
		const painel = sh.querySelector('.char_select_container');
		const rp = painel.getBoundingClientRect();
		if (rp.left < -1 || rp.right > vw + 1) {
			defeitos.push(`painel fora da tela: ${Math.round(rp.left)}..${Math.round(rp.right)} de ${vw}`);
		}
		const lista = sh.querySelector('.char_list');
		if (lista.scrollWidth > lista.clientWidth + 1) {
			defeitos.push(`a grade transborda na horizontal (${lista.scrollWidth} > ${lista.clientWidth})`);
		}
		/* A acao principal (Jogar / Criar personagem) recebe o clique? */
		for (const sel of ['.ok', '.criar-vaga']) {
			const el = sh.querySelector(sel);
			if (!el || !visivel(el)) {
				continue;
			}
			const r = el.getBoundingClientRect();
			const cx = r.left + r.width / 2;
			const cy = r.top + r.height / 2;
			if (cx < 0 || cy < 0 || cx > vw || cy > vh) {
				defeitos.push(`${sel} fora da tela (centro em ${Math.round(cx)},${Math.round(cy)})`);
				continue;
			}
			const alvo = sh.elementFromPoint(cx, cy);
			if (!alvo || !(alvo === el || el.contains(alvo))) {
				defeitos.push(`o clique nao chega em ${sel}: cai em ${alvo ? alvo.className || alvo.tagName : 'nada'}`);
			}
		}
		/* Nenhuma vaga escondida e alcancavel por foco. */
		vagas.forEach((v, i) => {
			if (!visivel(v) && !v.hidden) {
				defeitos.push(`vaga ${i} invisivel mas sem hidden`);
			}
		});
		return {
			vagasNaTela: naTela.length,
			contador: (sh.querySelector('.cs-vagas') || {}).textContent || '',
			painel: {
				x: Math.round(rp.left),
				y: Math.round(rp.top),
				w: Math.round(rp.width),
				h: Math.round(rp.height)
			},
			defeitos
		};
	}, esperadas);
}

function pacote(total, comVagaComprada) {
	/* A forma DECODIFICADA do 0x6b/0x82d (PacketStructure.js): o total no
	   `TotalSlotNum`, o premium em 0 (como o nosso char-server manda hoje). */
	return {
		TotalSlotNum: total,
		PremiumStartSlot: 0,
		PremiumEndSlot: 0,
		charInfo: comVagaComprada ? [...PERSONAGENS, NA_VAGA_COMPRADA] : [...PERSONAGENS]
	};
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
			page.on('console', m => {
				if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) {
					erros.push(`${L.w}: console: ${m.text()}`);
				}
			});
			page.on('pageerror', e => erros.push(`${L.w}: pageerror: ${e.message}`));

			const casos = [{ total: 15, comprada: true, sel: 0 }];
			if (L.w === 390 || L.w === 1440) {
				casos.push({ total: 12, comprada: true, sel: 0 });
				casos.push({ total: 9, comprada: false, sel: 0 });
				casos.push({ total: 12, comprada: true, sel: 11, nome: 'vaga-livre-comprada' });
			}
			for (const caso of casos) {
				await page.goto(`http://127.0.0.1:${PORTA}/arnes`);
				await page.waitForFunction(() => window.__pronto === true);
				const vagas = await page.evaluate(({ pkt, sel }) => window.__montar(pkt, sel), {
					pkt: pacote(caso.total, caso.comprada),
					sel: caso.sel
				});
				await page.evaluate(() => document.fonts.ready);
				await page.waitForTimeout(250);
				const nome = `${String(L.w).padStart(4, '0')}-${String(caso.total).padStart(2, '0')}-vagas${caso.nome ? '-' + caso.nome : ''}`;
				await page.screenshot({ path: join(SAIDA, `${nome}.png`) });
				const m = await medir(page, vagas);
				relatorio.push({ largura: L.w, altura: L.h, foto: `${nome}.png`, vagas, ...m });
				/* O fim da grade: as ultimas vagas moram embaixo da rolagem. */
				if (caso.total === 15 && !caso.nome) {
					await page.evaluate(() => {
						const l = document.getElementById('CharSelectV4').shadowRoot.querySelector('.char_list');
						l.scrollTop = l.scrollHeight;
					});
					await page.waitForTimeout(150);
					await page.screenshot({ path: join(SAIDA, `${nome}-fim-da-grade.png`) });
					relatorio.push({
						largura: L.w,
						altura: L.h,
						foto: `${nome}-fim-da-grade.png`,
						vagas,
						...(await medir(page, vagas))
					});
				}
			}
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
		const tag = r.defeitos.length ? 'DEFEITO' : 'ok';
		if (r.defeitos.length) {
			reprovou = true;
		}
		console.log(
			`${tag.padEnd(7)} ${r.foto}  vagas ${r.vagasNaTela}/${r.vagas}  "${r.contador}"  painel ${r.painel.w}x${r.painel.h}`
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
