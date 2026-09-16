/**
 * scripts/prova-tutorial.mjs - A PROVA DE TELA DO TUTORIAL GUIADO.
 *
 *   node scripts/prova-tutorial.mjs
 *
 * Ela sobe o vite deste repositorio, abre o arnes (`scripts/arnes-tutorial.html`)
 * num Chromium de verdade em DUAS telas (computador 1600x900 com mouse, celular
 * em pe 393x852 com dedo), poe cada uma das oito etapas na tela pelo
 * COMPONENTE DE VERDADE e:
 *
 *   - MEDE a geometria no DOM (o furo contem o alvo? os quatro retangulos
 *     ficam fora dele? quem recebe o toque no centro do alvo e o proprio
 *     controle? e num ponto qualquer fora, e a mascara?);
 *   - MEDE O PNG. A regra 5 do projeto: contar elemento nao prova que da para
 *     ver. Aqui o proprio arquivo gerado e decodificado e a luminancia media
 *     DENTRO do furo e comparada com a de FORA. Um furo que nao esta mais
 *     claro que a mascara reprova, mesmo com todo o DOM certo;
 *   - FOTOGRAFA tudo em `docs/provas-tutorial/`.
 *
 * E ALGUEM PRECISA OLHAR OS PRINTS. Nenhuma medida acima diz se a frase se le,
 * se a mao esta encostada no controle ou se o balao respira: isso e olho
 * humano, e a regra 5 existe porque este projeto ja reportou 81.364 triangulos
 * e zero erros com a tela preta.
 *
 * ─── O QUE ELA NAO PROVA, DITO POR ESCRITO ──────────────────────────────
 * O FIO. A etapa mora no servidor (`servidor/tutorial.ts`, frente C) e o
 * pacote 0x0fdf/0x0fde ainda nao tem o outro lado: nada aqui manda ou recebe
 * um byte. O avanco por resultado REAL de jogo (a missao que o servidor
 * ativou, o abate que chegou) tambem nao esta medido aqui - e prova de
 * servidor, com a pilha de pe.
 *
 * E A MAO: no jogo ela e o blob que o `CursorManager` rasteriza de
 * `data/sprite/cursors.spr`, e o `Cursor.init()` precisa do servidor de assets
 * para ler o GRF. O arnes injeta o MESMO quadro
 * (`docs/provas-tutorial/mao-cursor-click-quadro-0.png`, gerado do mesmo
 * arquivo do GRF com a mesma conta de posicao do CursorManager) como data URI,
 * entao a GEOMETRIA da mao e medida com os pixels certos, mas o caminho
 * `getCompiledFrameURL` -> blob so roda no jogo. As fotos `*-sem-cursor.png`
 * mostram o outro estado real: a seta de reserva do design system.
 */

import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..');
const SAIDA = join(RAIZ, 'docs', 'provas-tutorial');
const PORTA = Number(process.env.RAG_PORTA_PROVA_TUTORIAL || 5194);
const URL_BASE = `http://localhost:${PORTA}`;

/*
 * O `playwright` e o `pngjs` vivem no repositorio do SERVIDOR
 * (rag-idle-master/node_modules), e nao aqui - o cliente nao tem dependencia de
 * prova, e somar duas so para esta prova nao pagaria. Quem mudar a arvore
 * aponta RAG_NODE_MODULES para o node_modules que tiver os dois.
 */
const MODULOS =
	process.env.RAG_NODE_MODULES || resolve(RAIZ, '..', '..', 'rag-idle-master', 'node_modules');

function exigir(nome) {
	try {
		return createRequire(join(MODULOS, 'x.js'))(nome);
	} catch (erro) {
		console.error(
			`\n[prova-tutorial] nao achei "${nome}" em ${MODULOS}.\n` +
				'Aponte RAG_NODE_MODULES para um node_modules que tenha playwright e pngjs.\n'
		);
		throw erro;
	}
}

const { chromium } = exigir('playwright');
const { PNG } = exigir('pngjs');

/* ------------------------------------------------------------------ */
/* Placar                                                              */
/* ------------------------------------------------------------------ */

let passou = 0;
let falhou = 0;
const falhas = [];

function conferir(nome, condicao, detalhe) {
	if (condicao) {
		passou++;
		console.log(`  OK   ${nome}${detalhe ? `  (${detalhe})` : ''}`);
	} else {
		falhou++;
		falhas.push(`${nome}${detalhe ? `  (${detalhe})` : ''}`);
		console.log(`  FALHA ${nome}${detalhe ? `  (${detalhe})` : ''}`);
	}
}

/* ------------------------------------------------------------------ */
/* O vite                                                              */
/* ------------------------------------------------------------------ */

async function esperarOVite(ms = 30000) {
	const fim = Date.now() + ms;
	while (Date.now() < fim) {
		try {
			const r = await fetch(`${URL_BASE}/scripts/arnes-tutorial.html`);
			if (r.ok) return true;
		} catch (_erro) {
			/* ainda subindo */
		}
		await new Promise(ok => setTimeout(ok, 300));
	}
	return false;
}

/* ------------------------------------------------------------------ */
/* A medida do PNG (regra 5)                                           */
/* ------------------------------------------------------------------ */

/** Luminancia media de um retangulo em pixel de CSS, dentro do PNG. */
function brilhoMedio(png, escala, r) {
	const x0 = Math.max(0, Math.round(r.x * escala));
	const y0 = Math.max(0, Math.round(r.y * escala));
	const x1 = Math.min(png.width, Math.round((r.x + r.w) * escala));
	const y1 = Math.min(png.height, Math.round((r.y + r.h) * escala));
	let soma = 0;
	let n = 0;
	for (let y = y0; y < y1; y++) {
		for (let x = x0; x < x1; x++) {
			const o = (y * png.width + x) * 4;
			soma += 0.2126 * png.data[o] + 0.7152 * png.data[o + 1] + 0.0722 * png.data[o + 2];
			n++;
		}
	}
	return n === 0 ? null : soma / n;
}

/**
 * Um retangulo de amostra que NAO cruza o furo, o balao nem a mao. Ele varre a
 * tela em blocos ate achar um livre: amostrar um canto fixo ja deu falso
 * negativo (no celular o canto de cima e o cartao de missoes, e na etapa da
 * Mochila a janela aberta clareia tudo).
 */
function amostraForaDoFuro(furo, balao, mao, tela) {
	const cruza = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
	const lado = 40;
	for (let y = 0; y + lado <= tela.altura; y += 20) {
		for (let x = 0; x + lado <= tela.largura; x += 20) {
			const r = { x, y, w: lado, h: lado };
			if (!cruza(r, furo) && !cruza(r, balao) && !cruza(r, mao)) {
				return r;
			}
		}
	}
	return { x: 0, y: 0, w: lado, h: lado };
}

/* ------------------------------------------------------------------ */
/* A corrida                                                           */
/* ------------------------------------------------------------------ */

const TELAS = [
	{ id: 'desktop', viewport: { width: 1600, height: 900 }, hasTouch: false, rotulo: 'computador 1600x900, mouse' },
	{ id: 'celular', viewport: { width: 393, height: 852 }, hasTouch: true, rotulo: 'celular em pe 393x852, dedo' }
];

async function medirEFotografar(page, tela, n, sufixo, opcoes) {
	const m = await page.evaluate(
		async ([etapa, ops]) => window.__arnes.etapa(etapa, ops),
		[n, opcoes || null]
	);
	const arquivo = join(SAIDA, `${tela.id}-etapa-${n}${sufixo || ''}.png`);
	await page.screenshot({ path: arquivo });
	/*
	 * O MESMO QUADRO SEM A CAMADA. E a referencia da medida do PNG: comparar o
	 * brilho contra um numero fixo nao funciona (o fundo muda a cada etapa, e no
	 * celular uma janela aberta clareia a tela inteira). Comparar A com B
	 * responde a pergunta certa: dentro do furo a camada nao mudou nada, e fora
	 * dela escureceu.
	 */
	await page.evaluate(() => window.__arnes.camadaVisivel(false));
	/* O quadro de referencia so vai para o disco na PRIMEIRA etapa de cada tela:
	   ele existe para um humano poder comparar o par, e um par por tela basta.
	   Nas outras a comparacao acontece em memoria. */
	const guardar = n === 1 && !sufixo;
	const semCamada = guardar
		? await page.screenshot({ path: join(SAIDA, `${tela.id}-etapa-1-SEM-a-camada.png`) })
		: await page.screenshot();
	await page.evaluate(() => window.__arnes.camadaVisivel(true));
	return { m, arquivo, semCamada };
}

async function rodarTela(navegador, tela, maoDataUrl) {
	console.log(`\n=== ${tela.rotulo} =======================================`);
	const contexto = await navegador.newContext({
		viewport: tela.viewport,
		hasTouch: tela.hasTouch,
		isMobile: tela.hasTouch,
		/*
		 * ESCALA 1, e nao 2. O arnes de leiaute deste projeto usa 2 porque la se
		 * julga 1px de aro dourado; aqui o realce e um anel de 2px com brilho de
		 * 18px, que se le inteiro em escala 1 - e a pasta de fotos cai de 64 MB
		 * para poucos megabytes, que e a diferenca entre versionar as provas e
		 * nao versionar.
		 */
		deviceScaleFactor: 1
	});
	const page = await contexto.newPage();
	const erros = [];
	page.on('pageerror', e => erros.push(String(e)));
	page.on('console', msg => {
		if (msg.type() === 'error') erros.push(msg.text());
	});

	await page.goto(`${URL_BASE}/scripts/arnes-tutorial.html`, { waitUntil: 'networkidle' });
	await page.waitForFunction(() => window.__arnesPronto === true, { timeout: 20000 });

	conferir(`[${tela.id}] o arnes carregou sem erro de pagina`, erros.length === 0, erros.join(' | '));

	/* A ARMADILHA 4, medida e nao suposta: no celular em pe a marca
	   `ri-vertical` esconde quase todo `.tm-item` do cluster, e "Missoes" e
	   "Codex" so existem depois de o leque abrir. */
	const vertical = await page.evaluate(() => {
		const raiz = document.getElementById('TutorialIdle').shadowRoot.querySelector('.ui-component-root');
		return raiz ? raiz.classList.contains('ri-vertical') : false;
	});
	if (tela.hasTouch) {
		conferir(`[${tela.id}] a marca ri-vertical esta carimbada no shadow do tutorial`, vertical === true);
	}

	/*
	 * A SETA DE RESERVA VEM PRIMEIRO, e a ORDEM e o ponto.
	 *
	 * Antes de a arte do cursor entrar, o componente esta no estado em que ele
	 * nasce no jogo enquanto `Cursor.init()` nao rodou (ou com o cursor
	 * customizado desligado nas preferencias). Fotografar isso DEPOIS de a arte
	 * entrar nao mediria nada: `_urlDaMao` ja estaria preenchida, e a camada
	 * seguiria desenhando a mao. Foi assim que a primeira corrida desta prova
	 * reprovou o proprio aparelho, e nao o codigo.
	 */
	{
		const m = await page.evaluate(async () => window.__arnes.etapa(1));
		const arquivo = join(SAIDA, `${tela.id}-sem-cursor.png`);
		await page.screenshot({ path: arquivo });
		const setas = await page.evaluate(() => {
			const raiz = document.getElementById('TutorialIdle').shadowRoot;
			return [...raiz.querySelectorAll('.tu-mao-reserva')].filter(
				el => getComputedStyle(el).display !== 'none'
			).length;
		});
		conferir(`[${tela.id}] sem o cursor do jogo, a camada cai na seta de reserva`, m.maoReserva === true);
		conferir(`[${tela.id}] e aparece UMA seta so (a que aponta para o lado certo)`, setas === 1, `visiveis=${setas}`);
		console.log(`       foto: ${arquivo}`);
	}

	/* ── A mao do jogo, injetada com os pixels do cursors.spr ───────── */
	await page.evaluate(url => window.__arnes.porMaoDoJogo(url), maoDataUrl);
	/* A porta so e exercitada quando ha etapa desenhando: e o `ligarAMao()` do
	   componente que a chama. */
	const carregou = await page.evaluate(async () => (await window.__arnes.etapa(1)).maoCarregou);
	conferir(
		`[${tela.id}] a arte da mao entrou pela porta do componente (getCompiledFrameURL, CLICK quadro 0)`,
		carregou === true
	);

	const total = await page.evaluate(() => window.__arnes.total);
	conferir(`[${tela.id}] a tabela tem oito etapas`, total === 8, `total=${total}`);

	for (let n = 1; n <= 8; n++) {
		const { m, arquivo, semCamada } = await medirEFotografar(page, tela, n);
		const etiqueta = `[${tela.id}] etapa ${n}`;

		conferir(`${etiqueta}: a camada esta na tela`, m.aberta === true);

		/* ARMADILHA 1, PROVADA NA TELA: o escalaDaHud escreveu `style.zoom` em
		   todo host; o CSS do tutorial tem de vencer esse inline. */
		conferir(
			`${etiqueta}: o host do tutorial esta em zoom 1 (o !important venceu o inline)`,
			m.zoomDoHost === '1' || m.zoomDoHost === 'normal',
			`computado=${m.zoomDoHost} inline="${m.zoomInlineDoHost}" outroHost=${m.zoomDeOutroHost}`
		);

		conferir(`${etiqueta}: quem fala tem nome`, m.quem === 'Funcionária Kafra');
		conferir(`${etiqueta}: o passo esta escrito`, m.passo === `Passo ${n} de 8`, m.passo);
		conferir(`${etiqueta}: a frase e curta`, m.frase.length > 0 && m.frase.length <= 90, `${m.frase.length} chars: ${m.frase}`);
		conferir(`${etiqueta}: "Pular tutorial" esta visivel dentro da tela`, m.pularVisivel === true);

		if (n === 6) {
			/* A unica etapa sem furo: a mascara sai inteira para o jogador ver a
			   luta que a frase manda olhar. */
			conferir(`${etiqueta}: sem alvo, a mascara sai inteira (etapa de olhar)`, m.semMascara === true);
			conferir(`${etiqueta}: nenhum retangulo de mascara ficou na tela`, m.veus.length === 0, `${m.veus.length} visiveis`);
			conferir(`${etiqueta}: nada da camada rouba o clique da cena`, m.quemRecebeFora !== 'TutorialIdle', `recebeu=${m.quemRecebeFora}`);
			/* E no PNG: sem mascara, o quadro com e sem a camada tem de ser o
			   MESMO fora do balao. */
			const comCamada6 = PNG.sync.read(readFileSync(arquivo));
			const semCamada6 = PNG.sync.read(semCamada);
			const escala6 = comCamada6.width / m.tela.largura;
			const amostra6 = amostraForaDoFuro({ x: -1, y: -1, w: 0, h: 0 }, m.balao, m.mao, m.tela);
			const a = brilhoMedio(comCamada6, escala6, amostra6);
			const b = brilhoMedio(semCamada6, escala6, amostra6);
			conferir(
				`${etiqueta}: no PNG a cena NAO escureceu (a etapa e de olhar)`,
				a !== null && b !== null && Math.abs(a - b) < 6,
				`com=${a && a.toFixed(1)} sem=${b && b.toFixed(1)}`
			);
			console.log(`       foto: ${arquivo}`);
			continue;
		}

		conferir(`${etiqueta}: o alvo tem caixa`, !!m.alvo && m.alvo.w > 0 && m.alvo.h > 0);
		if (!m.alvo) {
			console.log(`       foto: ${arquivo}`);
			continue;
		}

		/* O furo contem o alvo INTEIRO. */
		const furo = m.anel;
		const contem =
			furo.x <= m.alvo.x + 1 &&
			furo.y <= m.alvo.y + 1 &&
			furo.x + furo.w >= m.alvo.x + m.alvo.w - 1 &&
			furo.y + furo.h >= m.alvo.y + m.alvo.h - 1;
		conferir(`${etiqueta}: o furo contem o alvo inteiro`, contem, `furo=${JSON.stringify(furo)} alvo=${JSON.stringify(m.alvo)}`);

		/* NENHUM dos quatro retangulos encosta no furo. */
		const cruzando = m.veus.filter(
			v => v.x < furo.x + furo.w && v.x + v.w > furo.x && v.y < furo.y + furo.h && v.y + v.h > furo.y
		);
		conferir(`${etiqueta}: os quatro retangulos da mascara NAO cobrem o alvo`, cruzando.length === 0, `${cruzando.length} cruzam`);

		/* QUEM RECEBE O TOQUE. Esta e a pergunta que "contar elemento" nao
		   responde: com um veu por cima, `elementFromPoint` no centro do alvo
		   devolveria o host do tutorial. */
		conferir(
			`${etiqueta}: o toque no centro do alvo chega ao componente dono, e nao ao tutorial`,
			m.quemRecebeNoAlvo && m.quemRecebeNoAlvo !== 'TutorialIdle',
			`recebeu=${m.quemRecebeNoAlvo}`
		);
		conferir(
			`${etiqueta}: fora do furo quem recebe e a mascara (o caminho errado fica desligado)`,
			m.quemRecebeFora === 'TutorialIdle',
			`recebeu=${m.quemRecebeFora}`
		);

		/* O balao nunca cobre o alvo. */
		const balaoCobre =
			m.balao.x < furo.x + furo.w &&
			m.balao.x + m.balao.w > furo.x &&
			m.balao.y < furo.y + furo.h &&
			m.balao.y + m.balao.h > furo.y;
		conferir(`${etiqueta}: o balao (casa "${m.balaoCasa}") nao cobre o alvo`, !balaoCobre);
		conferir(
			`${etiqueta}: o balao cabe na tela`,
			m.balao.x >= 0 && m.balao.y >= 0 && m.balao.x + m.balao.w <= m.tela.largura + 1 && m.balao.y + m.balao.h <= m.tela.altura + 1,
			JSON.stringify(m.balao)
		);

		/* A mao: dentro da tela, e encostada no alvo. */
		conferir(
			`${etiqueta}: a mao cabe na tela`,
			m.mao.x >= 0 && m.mao.y >= 0 && m.mao.x + m.mao.w <= m.tela.largura + 1 && m.mao.y + m.mao.h <= m.tela.altura + 1,
			JSON.stringify(m.mao)
		);
		const distancia = Math.max(
			0,
			Math.max(furo.x - (m.mao.x + m.mao.w), m.mao.x - (furo.x + furo.w)),
			Math.max(furo.y - (m.mao.y + m.mao.h), m.mao.y - (furo.y + furo.h))
		);
		conferir(`${etiqueta}: a mao esta ENCOSTADA no controle`, distancia === 0, `folga=${Math.round(distancia)}px espelho=${JSON.stringify(m.maoEspelhada)}`);
		conferir(`${etiqueta}: a mao e a arte do jogo, e nao a seta de reserva`, m.maoCarregou === true && m.maoReserva === false);

		/* ── A MEDIDA DO PNG (regra 5): o mesmo quadro, com e sem a camada ── */
		const comCamada = PNG.sync.read(readFileSync(arquivo));
		const semCamadaPng = PNG.sync.read(semCamada);
		const escala = comCamada.width / m.tela.largura;
		/* O miolo do furo (60% central), longe do anel dourado. */
		const miolo = {
			x: furo.x + furo.w * 0.2,
			y: furo.y + furo.h * 0.2,
			w: furo.w * 0.6,
			h: furo.h * 0.6
		};
		const dentroCom = brilhoMedio(comCamada, escala, miolo);
		const dentroSem = brilhoMedio(semCamadaPng, escala, miolo);
		conferir(
			`${etiqueta}: no PNG, o furo mostra a tela INTACTA (a camada nao escurece o alvo)`,
			dentroCom !== null && dentroSem !== null && Math.abs(dentroCom - dentroSem) < 12,
			`com=${dentroCom && dentroCom.toFixed(1)} sem=${dentroSem && dentroSem.toFixed(1)} furo=${JSON.stringify(furo)} miolo=${JSON.stringify(miolo)} escala=${escala}`
		);
		const fora = amostraForaDoFuro(furo, m.balao, m.mao, m.tela);
		const foraCom = brilhoMedio(comCamada, escala, fora);
		const foraSem = brilhoMedio(semCamadaPng, escala, fora);
		conferir(
			`${etiqueta}: no PNG, fora do furo a camada ESCURECE de verdade`,
			foraCom !== null && foraSem !== null && foraCom < foraSem - 15,
			`com=${foraCom && foraCom.toFixed(1)} sem=${foraSem && foraSem.toFixed(1)} amostra=${JSON.stringify(fora)}`
		);
		console.log(`       foto: ${arquivo}`);
	}

	/* ── RECUPERACAO: o alvo sumiu (armadilha 3) ─────────────────────── */
	{
		const { m, arquivo } = await medirEFotografar(page, tela, 8, '-alvo-sumido', { alvoSumido: true });
		conferir(`[${tela.id}] alvo sumido: a camada continua na tela`, m.aberta === true);
		conferir(
			`[${tela.id}] alvo sumido: a frase EXPLICA como voltar, e nao aponta o vazio`,
			/Menu/.test(m.frase),
			m.frase
		);
		/* O `m.alvo` desta medida e o descritor ORIGINAL da etapa (o item do
		   leque), que agora mede 0x0: por isso a pergunta e sobre o FURO
		   DESENHADO, que e o do caminho de volta. */
		conferir(
			`[${tela.id}] alvo sumido: o furo passou a apontar a porta de volta`,
			!m.semMascara && m.anel.w > 0 && m.anel.h > 0,
			`anel=${JSON.stringify(m.anel)} alvoOriginal=${JSON.stringify(m.alvo)}`
		);
		console.log(`       foto: ${arquivo}`);
	}


	/* ── O TUTORIAL DESLIGADO: concluido/pulado nao desenham nada ────── */
	for (const estado of ['concluido', 'pulado', 'nao-iniciado']) {
		const r = await page.evaluate(e => window.__arnes.desligar(e), estado);
		conferir(`[${tela.id}] estado "${estado}" nao desenha camada nenhuma`, r.aberta === false);
	}

	await contexto.close();
}

/* ------------------------------------------------------------------ */

async function principal() {
	mkdirSync(SAIDA, { recursive: true });

	const arte = join(SAIDA, 'mao-cursor-click-quadro-0.png');
	if (!existsSync(arte)) {
		console.error(`[prova-tutorial] falta ${arte} (o quadro da mao extraido do GRF).`);
		process.exit(2);
	}
	const maoDataUrl = `data:image/png;base64,${readFileSync(arte).toString('base64')}`;

	console.log('[prova-tutorial] subindo o vite...');
	const vite = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--port', String(PORTA), '--strictPort'], {
		cwd: RAIZ,
		stdio: 'ignore',
		shell: process.platform === 'win32'
	});

	let navegador = null;
	try {
		if (!(await esperarOVite())) {
			throw new Error(`o vite nao respondeu em ${URL_BASE}`);
		}
		navegador = await chromium.launch();
		for (const tela of TELAS) {
			await rodarTela(navegador, tela, maoDataUrl);
		}
	} finally {
		if (navegador) await navegador.close();
		vite.kill();
	}

	console.log('\n============================================================');
	console.log(`PROVA DO TUTORIAL: ${passou} passou, ${falhou} falhou`);
	console.log(`Fotos em: ${SAIDA}`);
	console.log('REGRA 5: contar elemento nao prova que da para ver. ALGUEM PRECISA OLHAR OS PRINTS.');
	if (falhou) {
		console.log('\nO que reprovou:');
		for (const f of falhas) console.log(`  - ${f}`);
	}
	console.log('============================================================');
	process.exit(falhou ? 1 : 0);
}

principal().catch(erro => {
	console.error(erro);
	process.exit(1);
});
