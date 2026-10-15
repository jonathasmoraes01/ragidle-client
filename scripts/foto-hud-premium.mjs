/**
 * scripts/foto-hud-premium.mjs - A PROVA DE TELA DA HUD MOBILE PREMIUM (15/10/2026).
 *
 *   node scripts/foto-hud-premium.mjs            # antes (D-939) e depois (premium)
 *   node scripts/foto-hud-premium.mjs --so=premium
 *
 * Sobe o vite deste repositorio numa porta PROPRIA (7363, nunca as do jogo),
 * abre `scripts/arnes-hud-premium.html` em cada tela do celular em pe com
 * DEDO (`hasTouch`, que e o que faz `(pointer: coarse)` casar e a marca
 * `ri-vertical` existir), e fotografa com a bandeira desligada e ligada.
 *
 * Em cada foto ela MEDE, e reprova (saida 1) se:
 *   - a marca nao bate com a bandeira (premium sem `ri-premium`, ou o
 *     contrario) - a camada que nao liga, ou liga sozinha;
 *   - duas pecas da HUD se cruzam (status x menu x minimapa x missoes x
 *     trilho x caca x chat x atalhos), com a lista de pares PERMITIDOS
 *     escrita abaixo, cada um com motivo;
 *   - um alvo de toque da camada premium fica abaixo de 44 CSS px;
 *   - alguma peca sai da tela.
 *
 * E alguem precisa OLHAR os PNG (regra 5 do contrato).
 *
 * O QUE ELA NAO PROVA: o mapa WebGL, o minimapa vivo, o estado do servidor e
 * os cliques. Isso e prova de pilha, no rag-idle.
 *
 * O `playwright` nao e dependencia deste repositorio (como nas outras provas
 * de tela daqui): `RAG_NODE_MODULES` aponta para um node_modules que o tenha,
 * e `RAG_CHROMIUM` para o executavel, se o do playwright nao estiver instalado.
 */

import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..');
const SAIDA = process.env.RAG_SAIDA_FOTO_HUD_PREMIUM || join(RAIZ, 'docs', 'ui', 'hud-premium', 'provas-de-tela');
const PORTA = Number(process.env.RAG_PORTA_FOTO_HUD_PREMIUM || 7363);
const URL_BASE = `http://127.0.0.1:${PORTA}`;

function acharModulos() {
	if (process.env.RAG_NODE_MODULES) return process.env.RAG_NODE_MODULES;
	for (const candidato of [join(RAIZ, 'node_modules'), resolve(RAIZ, '..', 'rag-idle', 'node_modules')]) {
		if (existsSync(join(candidato, 'playwright'))) return candidato;
	}
	throw new Error('playwright nao encontrado: aponte RAG_NODE_MODULES para um node_modules que o tenha');
}

const require = createRequire(join(acharModulos(), 'noop.js'));
const { chromium } = require('playwright');

/**
 * AS VARIANTES fotografadas em cada tela. `premium` e o que o jogador ve ao entrar: o chat em bolinha, as missoes
 * no icone, a barra de skills desligada (o arco em volta do Auto). `busca` sao os parametros do arnes.
 */
/* `fps=1` em quase todas: o dono joga com o contador de FPS ligado, e ele tem de caber em cada estado (ele
   chegou a cobrir a aba Codex das missoes). A `premium` fica sem ele: e o que o jogador ve ao entrar. */
const VARIANTES = {
	antes: { busca: '' },
	premium: { busca: '?premium=1' },
	'premium-chat': { busca: '?premium=1&chat=aberto&missoes=abertas&fps=1' },
	'premium-atalhos': { busca: '?premium=1&atalhos=1&fps=1' },
	/* muitos buffs com o cartao de missoes aberto: a coluna quebra em colunas antes do chat (e do FPS) */
	'premium-buffs': { busca: '?premium=1&buffs=14&missoes=abertas&fps=1' },
	/* o jogo em ingles: o que a premium desenha por CSS (o convite do chat, o "J" do Job Lv. no 320) segue a lingua */
	'premium-en': { busca: '?premium=1&lang=en&chat=aberto' },
	/* os detalhes do dono de 15/10: o minimapa minimizado na pilula do nome, o ping alto, o FPS ligado */
	'premium-detalhes': { busca: '?premium=1&minimapa=recolhido&ping=1234&fps=1&missoes=abertas&buffs=8' },
	/* a folha do Menu aberta: os buffs descem para o rodape, e so eles sao cobrados. No 320x568 a folha desce ate
	   516 de 568 e cobre o que passar de UMA fileira (duas pilulas, entre a bolinha e o arco): os buffs da fileira
	   de cima ficam atras dela - nao ha onde mais caber, e e a unica excecao, escrita com a tela. */
	'premium-menu': {
		busca: '?premium=1&menu=aberto&buffs=6&fps=1',
		soOsBuffs: true,
		permitidos: { '320x568': ['buffs|leque'] }
	},
	'premium-70': { busca: '?premium=1&escala=70&fps=1', escala: 70 },
	'premium-120': { busca: '?premium=1&escala=120&fps=1', escala: 120 },
	/* O CELULAR DEITADO (a HUD premium deitada, `hud-premium-horizontal.png`): o que o jogador ve ao entrar, e
	   os estados que mudam a geometria */
	deitado: { busca: '?premium=1&paisagem=1' },
	'deitado-chat': { busca: '?premium=1&paisagem=1&chat=aberto&missoes=abertas&fps=1' },
	'deitado-atalhos': { busca: '?premium=1&paisagem=1&atalhos=1&fps=1' },
	'deitado-buffs': { busca: '?premium=1&paisagem=1&buffs=14&missoes=abertas&fps=1' },
	'deitado-menu': { busca: '?premium=1&paisagem=1&menu=aberto&buffs=6&fps=1', soOsBuffs: true }
};

/** As telas do celular em pe (a matriz do pacote: 320/375/393/430). */
const TELAS_EM_PE = [
	{ id: '320x568', viewport: { width: 320, height: 568 } },
	{ id: '375x667', viewport: { width: 375, height: 667 } },
	{ id: '393x852', viewport: { width: 393, height: 852 } },
	{ id: '430x932', viewport: { width: 430, height: 932 } }
];

/** As telas do celular DEITADO (as mesmas, giradas): a HUD premium deitada (`?paisagem=1`). */
const TELAS_DEITADAS = [
	{ id: '568x320', viewport: { width: 568, height: 320 } },
	{ id: '667x375', viewport: { width: 667, height: 375 } },
	{ id: '852x393', viewport: { width: 852, height: 393 } },
	{ id: '932x430', viewport: { width: 932, height: 430 } }
];

/**
 * Pares de pecas que PODEM se tocar, cada um com o motivo. Fora desta lista,
 * cruzamento e defeito.
 */
const CRUZAMENTOS_PERMITIDOS = new Set([
	/* O Auto e o 2o degrau do trilho: ele mora DENTRO da caixa do trilho de
	   proposito (Common.css, D-939). */
	'auto|trilho',
	'autoRotulo|trilho',
	/* O rotulo "Auto · OFF" e a pilula do proprio disco do Auto. */
	'auto|autoRotulo',
	/* Voltar e Sentar orbitam o Cacar, como no mockup; o host e um so. */
	'cacar|sentar',
	'cacar|voltar',
	'sentar|voltar',
	/* A pilula do nome do mapa e a coroa do medalhao do minimapa, como no mockup. */
	'mapaNome|minimapa'
]);

function cruzaCaixa(a, b) {
	return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** O circulo inscrito de uma peca redonda: centro e raio. */
function circulo(c) {
	return { cx: c.x + c.w / 2, cy: c.y + c.h / 2, r: Math.min(c.w, c.h) / 2 };
}

/* Peca redonda cruza pelo CIRCULO (o disco da diagonal do arco encosta no canto
   da caixa do Auto sem tocar o Auto); 1px de tolerancia para o arredondamento
   das caixas. */
function cruza(a, b) {
	if (!a.redondo && !b.redondo) return cruzaCaixa(a, b);
	if (a.redondo && b.redondo) {
		const p = circulo(a);
		const q = circulo(b);
		return Math.hypot(p.cx - q.cx, p.cy - q.cy) < p.r + q.r - 1;
	}
	const [redonda, caixa] = a.redondo ? [a, b] : [b, a];
	const p = circulo(redonda);
	const px = Math.max(caixa.x, Math.min(p.cx, caixa.x + caixa.w));
	const py = Math.max(caixa.y, Math.min(p.cy, caixa.y + caixa.h));
	return Math.hypot(p.cx - px, p.cy - py) < p.r - 1;
}

/* O piso de toque e de 44 UNIDADES DA HUD: com o Tamanho da HUD abaixo de 100% o alvo encolhe junto, por
   escolha do jogador (Configuracoes de Video). Acima de 100% o piso segue 44. */
function analisar(medida, premium, piso = 44, soOsBuffs = false, permitidosAqui = []) {
	const problemas = [];
	const nomes = Object.keys(medida.caixas).filter(n => medida.caixas[n]);
	for (let i = 0; i < nomes.length; i++) {
		for (let j = i + 1; j < nomes.length; j++) {
			const [a, b] = [nomes[i], nomes[j]].sort();
			/* Com a folha do Menu aberta, tudo o que ela cobre fica ATRAS dela de proposito; o que se cobra e que
			   os buffs nao fiquem (pedido do dono). */
			if (soOsBuffs && a !== 'buffs' && b !== 'buffs') continue;
			if (CRUZAMENTOS_PERMITIDOS.has(`${a}|${b}`) || permitidosAqui.includes(`${a}|${b}`)) continue;
			if (cruza(medida.caixas[a], medida.caixas[b])) {
				problemas.push(`cruzamento ${a} x ${b}`);
			}
		}
	}
	const { w, h } = medida.viewport;
	for (const nome of nomes) {
		const c = medida.caixas[nome];
		if (c.x < 0 || c.y < 0 || c.x + c.w > w + 1 || c.y + c.h > h + 1) {
			problemas.push(`${nome} sai da tela (${c.x},${c.y} ${c.w}x${c.h})`);
		}
	}
	/* O piso de toque so e cobrado da camada premium: a de hoje tem a medida
	   dela na `prove:hud-responsiva`, e esta prova nao e o lugar de reabri-la. */
	if (premium) {
		for (const alvo of medida.alvos) {
			if (alvo.w < piso - 0.5 || alvo.h < piso - 0.5) {
				problemas.push(`alvo pequeno ${alvo.peca} "${alvo.rotulo}" ${alvo.w}x${alvo.h}`);
			}
		}
	}
	return problemas;
}

async function esperarVite() {
	for (let i = 0; i < 120; i++) {
		try {
			const r = await fetch(`${URL_BASE}/scripts/arnes-hud-premium.html`);
			if (r.ok) return;
		} catch {
			/* ainda subindo */
		}
		await new Promise(ok => setTimeout(ok, 500));
	}
	throw new Error(`o vite nao respondeu em ${URL_BASE}`);
}

async function main() {
	const so = (process.argv.find(a => a.startsWith('--so=')) || '').slice(5);
	const variantes = so ? so.split(',') : Object.keys(VARIANTES);
	for (const v of variantes) {
		if (!VARIANTES[v])
			throw new Error(`variante desconhecida: ${v} (conhecidas: ${Object.keys(VARIANTES).join(', ')})`);
	}
	mkdirSync(SAIDA, { recursive: true });

	console.log('[foto-hud-premium] subindo o vite...');
	/* `--open false`: o `vite.config.js` abre o navegador por padrao, e numa
	   maquina sem desktop o `xdg-open` falha. A saida vai para `ignore` - um
	   pipe que ninguem le enche e trava o vite. */
	const vite = spawn(
		process.platform === 'win32' ? 'npx.cmd' : 'npx',
		['vite', '--port', String(PORTA), '--strictPort', '--open', 'false'],
		{ cwd: RAIZ, stdio: 'ignore' }
	);
	let navegador;
	let falhou = false;
	const relatorio = [];
	try {
		await esperarVite();
		const opcoes = {
			args: ['--no-first-run', '--disable-background-networking', '--disable-component-update']
		};
		if (process.env.RAG_CHROMIUM) opcoes.executablePath = process.env.RAG_CHROMIUM;
		navegador = await chromium.launch(opcoes);
		for (const variante of variantes) {
			const { busca, escala, soOsBuffs, permitidos = {} } = VARIANTES[variante];
			const premium = variante !== 'antes';
			const deitada = busca.includes('paisagem=1');
			for (const tela of deitada ? TELAS_DEITADAS : TELAS_EM_PE) {
				const contexto = await navegador.newContext({
					viewport: tela.viewport,
					hasTouch: true,
					isMobile: true,
					deviceScaleFactor: 2
				});
				const page = await contexto.newPage();
				const erros = [];
				page.on('pageerror', e => erros.push(String(e)));
				/* O "Failed to load resource" do console nao diz QUAL recurso; a
				   resposta diz. Um 404 de icone premium e defeito desta camada. */
				page.on('response', r => {
					if (r.status() >= 400) erros.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`);
				});
				page.on('console', m => {
					if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) erros.push(m.text());
				});
				/* `load`, e nao `networkidle`: o websocket do HMR do vite e o
				   Chromium tentando falar com o Google (num ambiente com proxy, ele
				   insiste) deixam a rede eternamente "ocupada", e a prova travava
				   sem dizer por que. O sinal de pronto e o do proprio arnes. */
				await page.goto(`${URL_BASE}/scripts/arnes-hud-premium.html${busca}`, {
					waitUntil: 'load'
				});
				await page.waitForFunction(() => window.__arnesPronto === true, null, { timeout: 30000 });
				await page.waitForTimeout(700);
				const marcas = await page.evaluate(() => window.__arnes.marcas());
				const medida = await page.evaluate(() => window.__arnes.medir());
				const arquivo = join(SAIDA, `${variante}-${tela.id}.png`);
				await page.screenshot({ path: arquivo });
				const problemas = analisar(
					medida,
					premium,
					44 * Math.min(1, (escala || 100) / 100),
					soOsBuffs,
					permitidos[tela.id] || []
				);
				if (!marcas.vertical)
					problemas.push('a marca ri-vertical nao entrou (o criterio de celular em pe nao casou)');
				if (marcas.premium !== premium)
					problemas.push(`marca ri-premium = ${marcas.premium}, bandeira = ${premium}`);
				const comAtalhos = busca.includes('atalhos=1');
				if (marcas.comAtalhos !== comAtalhos)
					problemas.push(`marca ri-com-atalhos = ${marcas.comAtalhos}, barra pedida = ${comAtalhos}`);
				if (marcas.deitado !== deitada)
					problemas.push(`marca ri-deitado = ${marcas.deitado}, paisagem pedida = ${deitada}`);
				const recolhido = busca.includes('minimapa=recolhido');
				if (marcas.minimapaRecolhido !== recolhido)
					problemas.push(`marca ri-minimapa-recolhido = ${marcas.minimapaRecolhido}, pedida = ${recolhido}`);
				/* O que a variante pediu tem de estar NA TELA: uma peca que some passa em todo cruzamento. */
				if (busca.includes('fps=1') && !medida.caixas.fps) problemas.push('o contador de FPS nao apareceu');
				if (recolhido && medida.caixas.minimapa)
					problemas.push('o minimapa recolhido ainda desenha o medalhao');
				if (premium && !medida.caixas.mapaNome) problemas.push('a pilula do nome do mapa nao apareceu');
				for (const e of erros) problemas.push(`erro no console: ${e.slice(0, 160)}`);
				relatorio.push({ variante, tela: tela.id, arquivo, problemas, caixas: medida.caixas });
				const marca = problemas.length ? 'REPROVA' : 'ok';
				console.log(
					`[${variante}] ${tela.id}: ${marca}${problemas.length ? '\n    - ' + problemas.join('\n    - ') : ''}`
				);
				if (problemas.length && premium) falhou = true;
				await contexto.close();
			}
		}
	} finally {
		if (navegador) await navegador.close();
		vite.kill();
	}
	writeFileSync(join(SAIDA, 'relatorio.json'), JSON.stringify(relatorio, null, '\t'));
	console.log(`[foto-hud-premium] fotos em ${SAIDA}`);
	/* So a variante premium reprova: o "antes" e a referencia, e o que ele
	   mede e informacao, nao portao. */
	process.exitCode = falhou ? 1 : 0;
}

main().catch(e => {
	console.error(e);
	process.exitCode = 2;
});
