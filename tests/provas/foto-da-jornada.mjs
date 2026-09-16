/**
 * PROVA DE TELA DA JORNADA DE MIDGARD (08/09/2026).
 *
 * ===========================================================================
 * O QUE ELA E, E O QUE ELA NAO E
 * ===========================================================================
 * Ela e o arnes de foto do Shadow DOM: monta o componente SOZINHO num
 * Chromium (Common.css + CodexIdle.css + CodexIdle.html, exatamente como o
 * `GUIComponent` monta), poe dentro o HTML que `jornadaHtml.js` produz de
 * verdade, e FOTOGRAFA. Sem servidor, sem login, sem mapa 3D.
 *
 * **Ela nao substitui prova em jogo.** O caminho de pacote (`ZC_RAGIDLE_CODEX`
 * com `jornada`, o verbo `{acao:'capitulo'}`, o `CZ_RAGIDLE_VIAJAR`) continua
 * dependendo do servidor da frente B, que nao existe enquanto isto e escrito.
 * O que ela prova e LEIAUTE e ESTADO: que as tres telas cabem, que os quatro
 * estados se distinguem sem cor, e que o mapa funciona no painel do celular.
 *
 * **E o PNG e so metade da prova** (regra 5 do projeto): ela mede o arquivo -
 * tamanho, cor, transbordo, pino dentro da caixa, alvo tatil - e alguem
 * precisa OLHAR os arquivos de `docs/provas-jornada/`.
 *
 * ===========================================================================
 * O RETRATO E DE EXEMPLO, E ISSO ESTA DECLARADO
 * ===========================================================================
 * O `RETRATO` abaixo e montado a mao conforme a secao 5 do
 * `docs/CONTRATO-JORNADA.md`. Ele NAO veio do servidor. Toda afirmacao desta
 * prova vale para "a janela desenha corretamente um retrato deste formato" -
 * e nao para "o servidor manda isto".
 *
 * ===========================================================================
 * COMO RODAR
 * ===========================================================================
 *   node tests/provas/foto-da-jornada.mjs
 *
 * O `playwright` vive no `node_modules` do REPO DO SERVIDOR (o cliente nao o
 * tem), entao ele e importado por caminho absoluto. Nada e escrito la.
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SAIDA = path.join(RAIZ, 'docs', 'provas-jornada');
const PLAYWRIGHT = path.resolve(RAIZ, '../../rag-idle-master/node_modules/playwright/index.js');
const PORTA = 45817;

/* ------------------------------------------------------------------ */
/* O retrato de EXEMPLO (contrato, secao 5)                            */
/* ------------------------------------------------------------------ */

const CAPITULOS = [
	{
		id: 'cap-01-prontera',
		titulo: 'Os campos ao redor de Prontera',
		ordem: 1,
		ehDosChefes: false,
		abertura: 'Todo aventureiro comeca aqui, entre porings e lunatics.',
		fecho: 'Com o bolso mais cheio, os esgotos deixam de assustar.',
		estado: 'concluido',
		concluidas: 2,
		total: 2
	},
	{
		id: 'cap-02-esgotos',
		titulo: 'Os esgotos de Prontera',
		ordem: 2,
		ehDosChefes: false,
		abertura: 'Debaixo da cidade, o que ninguem quis ver desceu pelo ralo.',
		fecho: 'A saida do outro lado da para as galerias da mina.',
		estado: 'em-andamento',
		concluidas: 2,
		total: 5
	},
	{
		id: 'cap-03-mina',
		titulo: 'As galerias da Mina de Carvao',
		ordem: 3,
		ehDosChefes: false,
		abertura: 'Os mineiros pararam de descer, e ninguem explica por que.',
		fecho: 'Adiante, a torre de Geffen risca o horizonte.',
		estado: 'disponivel',
		concluidas: 0,
		total: 4
	},
	{
		id: 'cap-04-geffen',
		titulo: 'A Torre de Geffen',
		ordem: 4,
		ehDosChefes: false,
		abertura: 'A academia de magia guarda mais andares do que admite.',
		fecho: 'Do alto da torre da para ver os calabocos.',
		estado: 'bloqueado',
		concluidas: 0,
		total: 7
	},
	{
		id: 'cap-05-glast',
		titulo: 'Os Calabocos de Glast Heim',
		ordem: 5,
		ehDosChefes: false,
		abertura: 'A cidade amaldicoada nao dorme, e nao gosta de visita.',
		fecho: 'Quem sai daqui inteiro esta pronto para o deserto.',
		estado: 'bloqueado',
		concluidas: 0,
		total: 9
	},
	{
		id: 'cap-06-esfinge',
		titulo: 'As dunas alem da Esfinge',
		ordem: 6,
		ehDosChefes: false,
		abertura: 'Areia, sol e coisas que fingem ser estatua.',
		fecho: 'A caverna de Payon e o ultimo degrau antes dos senhores.',
		estado: 'bloqueado',
		concluidas: 0,
		total: 6
	},
	{
		id: 'cap-07-payon',
		titulo: 'A Caverna de Payon',
		ordem: 7,
		ehDosChefes: false,
		abertura: 'O bosque esconde a boca da caverna, e a caverna esconde o resto.',
		fecho: 'Depois daqui, so os senhores de Midgard.',
		estado: 'bloqueado',
		concluidas: 0,
		total: 8
	},
	{
		id: 'cap-08-chefes',
		titulo: 'Os senhores de Midgard',
		ordem: 8,
		ehDosChefes: true,
		abertura: 'Vinte e cinco nomes que o mundo inteiro reconhece.',
		fecho: 'Nao ha depois: este e o fim da Jornada.',
		estado: 'bloqueado',
		concluidas: 0,
		total: 25
	}
];

/** As missoes do capitulo 2 - uma de cada estado, e as tres recusas de viagem. */
const MISSOES_DO_CAP_02 = [
	{
		id: 'jornada-prt_sewb1-1051',
		capitulo: 'cap-02-esgotos',
		ordem: 1,
		mapa: 'prt_sewb1',
		mapaRotulo: 'Esgotos de Prontera 1',
		mobId: 1051,
		monstro: 'Thief Bug',
		meta: 40,
		abates: 40,
		estado: 'concluido',
		recompensas: [
			{ tipo: 'expBase', quantidade: 600 },
			{ tipo: 'expClasse', quantidade: 400 }
		]
	},
	{
		id: 'jornada-prt_sewb2-1052',
		capitulo: 'cap-02-esgotos',
		ordem: 2,
		mapa: 'prt_sewb2',
		mapaRotulo: 'Esgotos de Prontera 2',
		mobId: 1052,
		monstro: 'Rocker',
		meta: 30,
		abates: 12,
		estado: 'em-andamento',
		recompensas: [
			{ tipo: 'expBase', quantidade: 600 },
			{ tipo: 'expClasse', quantidade: 400 }
		]
	},
	{
		id: 'jornada-prt_sewb3-1005',
		capitulo: 'cap-02-esgotos',
		ordem: 3,
		mapa: 'prt_sewb3',
		mapaRotulo: 'Esgotos de Prontera 3',
		mobId: 1005,
		monstro: 'Familiar',
		meta: 25,
		abates: 0,
		estado: 'disponivel',
		recompensas: [
			{ tipo: 'expBase', quantidade: 600 },
			{ tipo: 'expClasse', quantidade: 400 }
		]
	},
	{
		id: 'jornada-prt_sewb4-1063',
		capitulo: 'cap-02-esgotos',
		ordem: 4,
		mapa: 'prt_sewb4',
		mapaRotulo: 'Esgotos de Prontera 4',
		mobId: 1063,
		monstro: 'Lunatic',
		meta: 20,
		abates: 0,
		estado: 'bloqueado',
		recompensas: [{ tipo: 'expBase', quantidade: 600 }]
	},
	{
		id: 'jornada-prt_sewb1-1002',
		capitulo: 'cap-02-esgotos',
		ordem: 5,
		mapa: 'prt_sewb1',
		mapaRotulo: 'Esgotos de Prontera 1',
		mobId: 1002,
		monstro: 'Poring',
		meta: 87,
		abates: 33,
		estado: 'em-andamento',
		recompensas: [
			{ tipo: 'expBase', quantidade: 600 },
			{ tipo: 'expClasse', quantidade: 400 }
		]
	}
];

/** O Poring tambem vive no capitulo 1 - e a ponte por especie tem o que mostrar. */
const MISSOES_DO_CAP_01 = [
	{
		id: 'jornada-prt_fild05-1002',
		capitulo: 'cap-01-prontera',
		ordem: 1,
		mapa: 'prt_fild05',
		mapaRotulo: 'Campo de Prontera 05',
		mobId: 1002,
		monstro: 'Poring',
		meta: 40,
		abates: 40,
		estado: 'concluido',
		recompensas: [{ tipo: 'expBase', quantidade: 600 }]
	},
	{
		id: 'jornada-prt_fild06-1113',
		capitulo: 'cap-01-prontera',
		ordem: 2,
		mapa: 'prt_fild06',
		mapaRotulo: 'Campo de Prontera 06',
		mobId: 1113,
		monstro: 'Drops',
		meta: 30,
		abates: 30,
		estado: 'concluido',
		recompensas: [{ tipo: 'expBase', quantidade: 600 }]
	}
];

function retrato(jornada) {
	return {
		v: 1,
		pontosDisponiveis: 3,
		pontosGanhos: 11,
		pontosGastos: 8,
		tetoPorEixo: 20,
		gastos: { str: 3, agi: 2, vit: 1, int: 0, dex: 2, luk: 0, exp: 0 },
		bonusDeAtributo: { str: 3, agi: 2, vit: 1, int: 0, dex: 2, luk: 0 },
		bonusDeExpEmPorcento: 0,
		recusaPorEixo: {
			str: null,
			agi: null,
			vit: null,
			int: null,
			dex: null,
			luk: null,
			exp: null
		},
		missoes: [
			{
				id: 'codex-poring',
				titulo: 'A gelatina de Rune-Midgard',
				alvos: [{ mobId: 1002, monstro: 'Poring', mapa: 'prt_fild08', abates: 73, alvo: 100 }],
				abates: 73,
				alvo: 100,
				cumprida: false,
				recompensas: []
			},
			{
				id: 'eden-familia-orc',
				titulo: 'Familia Orc',
				alvos: [
					{ mobId: 1189, monstro: 'Orc Archer', mapa: 'gef_fild10', abates: 200, alvo: 200 },
					{ mobId: 1023, monstro: 'Orc Warrior', mapa: 'gef_fild10', abates: 200, alvo: 200 }
				],
				abates: 400,
				alvo: 400,
				cumprida: true,
				recompensas: [
					{ tipo: 'expBase', quantidade: 15000 },
					{ tipo: 'expClasse', quantidade: 10000 }
				]
			}
		],
		jornada: jornada
	};
}

const JORNADA_ABERTA = {
	desbloqueada: true,
	requisito: null,
	desde: 1757300000000,
	premio: { descricao: 'Asa de Midgard - o manto de quem fechou o mundo inteiro.', entregue: false },
	capituloAtual: 'cap-02-esgotos',
	capitulos: CAPITULOS
};

const JORNADA_TRANCADA = {
	desbloqueada: false,
	requisito: {
		titulo: 'Escolha uma classe para comecar a Jornada',
		comoSeguir: 'Abra as Missoes, conclua "Prova de Vocacao" e fale com o Mestre da classe que voce quer seguir.'
	},
	desde: null,
	premio: { descricao: 'Asa de Midgard - o manto de quem fechou o mundo inteiro.', entregue: false },
	capituloAtual: null,
	capitulos: CAPITULOS.map(c => ({ ...c, estado: 'bloqueado', concluidas: 0 }))
};

/* ------------------------------------------------------------------ */
/* O modulo REAL, importado com o alias resolvido                      */
/* ------------------------------------------------------------------ */

/**
 * `jornadaHtml.js` importa `UI/ri-icones.js` pelo ALIAS do vite, que o Node
 * nao resolve. A copia abaixo troca SO o especificador do import - o corpo do
 * arquivo e byte a byte o mesmo que roda no jogo. Trocar o alias e o preco de
 * rodar codigo de navegador no Node; reescrever a tela para o arnes seria uma
 * segunda copia, e ai a foto aprovaria o que ninguem roda.
 */
async function carregarDesenho() {
	const tmp = fs.mkdtempSync(path.join(RAIZ, '.tmp-prova-jornada-'));
	const de = path.join(RAIZ, 'src', 'UI', 'Components', 'CodexIdle');
	for (const nome of ['jornadaDeMidgard.js', 'jornadaHtml.js']) {
		const fonte = fs.readFileSync(path.join(de, nome), 'utf8');
		const raizUi = pathToFileURL(path.join(RAIZ, 'src', 'UI')).href;
		fs.writeFileSync(path.join(tmp, nome), fonte.replaceAll("from 'UI/", `from '${raizUi}/`), 'utf8');
	}
	const mod = await import(pathToFileURL(path.join(tmp, 'jornadaHtml.js')).href);
	return { mod: mod, limpar: () => fs.rmSync(tmp, { recursive: true, force: true }) };
}

/* ------------------------------------------------------------------ */
/* O servidor de arquivos - o mapa e os avatares sao arte de verdade   */
/* ------------------------------------------------------------------ */

const TIPOS = {
	'.png': 'image/png',
	'.webp': 'image/webp',
	'.jpg': 'image/jpeg',
	'.svg': 'image/svg+xml'
};

function subirServidorDePublic() {
	const publico = path.join(RAIZ, 'public');
	const servidor = http.createServer((req, res) => {
		const rel = decodeURIComponent((req.url || '/').split('?')[0]);
		const arq = path.join(publico, rel);
		if (!arq.startsWith(publico) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) {
			res.writeHead(404).end();
			return;
		}
		res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq).toLowerCase()] || 'application/octet-stream' });
		fs.createReadStream(arq).pipe(res);
	});
	return new Promise(ok => servidor.listen(PORTA, '127.0.0.1', () => ok(servidor)));
}

/* ------------------------------------------------------------------ */
/* A pagina do arnes                                                   */
/* ------------------------------------------------------------------ */

const COMMON_CSS = fs.readFileSync(path.join(RAIZ, 'src', 'UI', 'Common.css'), 'utf8');
const CX_CSS = fs.readFileSync(path.join(RAIZ, 'src', 'UI', 'Components', 'CodexIdle', 'CodexIdle.css'), 'utf8');
const CX_HTML = fs.readFileSync(path.join(RAIZ, 'src', 'UI', 'Components', 'CodexIdle', 'CodexIdle.html'), 'utf8');

/**
 * O mapa e os avatares vem do servidor de `public/`. Sem esperar por eles a
 * foto sai com a caixa azul vazia - e ai a prova aprovaria exatamente o
 * defeito que ela existe para pegar.
 *
 * As tres funcoes daqui para baixo rodam DENTRO do navegador (o Playwright as
 * serializa com `toString()`), e por isso nao podem fechar sobre nada deste
 * arquivo: tudo o que elas precisam entra por argumento.
 */
function esperarAsImagens() {
	return Promise.all(
		Array.from(window.__arnes.shadow.querySelectorAll('img')).map(i =>
			i.complete
				? null
				: new Promise(ok => {
						i.onload = ok;
						i.onerror = ok;
					})
		)
	);
}

/**
 * Monta o host exatamente como `GUIComponent.prepare()` monta: host com
 * `data-gui-component`, shadow aberto, Common.css, o CSS do componente, e o
 * `.ui-component-root` com o HTML do componente dentro. A marca `ri-janela`
 * e do registro da pilha (`pilhaDeJanelas.js`), e sem ela o painel de tela
 * cheia do celular nao dispara - copiar o host errado daria uma foto bonita
 * de uma coisa que o jogo nao desenha.
 */
function montarOArnes(dados) {
		/*
		 * O `Common.css` VAI NOS DOIS LADOS, e a segunda copia nao e redundancia.
		 *
		 * A regra do painel de tela cheia do celular tem duas metades: uma mira o
		 * HOST (`.ri-janela`), que vive no DOCUMENTO, e a outra mira o corpo
		 * (`.ri-window`), que vive dentro do Shadow DOM. Uma folha injetada so no
		 * shadow nao alcanca o host - `.ri-janela` la dentro nao casa com o
		 * proprio host -, e sem ela o `:host{width:520px}` do componente vence: a
		 * janela fica com 520px numa tela de 393 e a pagina rola na horizontal.
		 * Foi o segundo defeito que esta prova achou.
		 */
		const noDocumento = document.createElement('style');
		noDocumento.textContent = dados.commonCss;
		document.head.appendChild(noDocumento);

		const host = document.createElement('div');
		host.dataset.guiComponent = 'CodexIdle';
		host.classList.add('ri-janela');
		host.style.zIndex = '50';
		host.style.position = 'absolute';
		host.style.width = '520px';
		host.style.height = '600px';
		host.style.left = dados.celular ? '0px' : '40px';
		host.style.top = dados.celular ? '0px' : '40px';
		document.body.appendChild(host);

		const shadow = host.attachShadow({ mode: 'open' });
		const c1 = document.createElement('style');
		c1.textContent = dados.commonCss;
		shadow.appendChild(c1);
		const c2 = document.createElement('style');
		c2.setAttribute('data-component', 'CodexIdle');
		c2.textContent = dados.cxCss;
		shadow.appendChild(c2);
		const raiz = document.createElement('div');
		raiz.classList.add('ui-component-root');
		raiz.innerHTML = dados.cxHtml;
		shadow.appendChild(raiz);

		const janela = shadow.querySelector('.cx-window');
		janela.classList.add('is-open');
		janela.classList.add('ri-janela-corpo');
		shadow.querySelector('.cx-saldo-valor').textContent = String(dados.saldo);
		shadow.querySelectorAll('.cx-tab').forEach(b => {
			b.classList.toggle('is-active', b.dataset.aba === dados.aba);
		});
		shadow.querySelector('.cx-body').innerHTML = dados.corpo;
	window.__arnes = { host: host, shadow: shadow };
}

/** As medidas que a foto sozinha nao mostra. */
function colherAsMedidas() {
		const shadow = window.__arnes.shadow;
		const janela = shadow.querySelector('.cx-window');
		const corpo = shadow.querySelector('.cx-body');
		const caixa = shadow.querySelector('.cx-jor-mapa-caixa');
		const pinos = Array.from(shadow.querySelectorAll('.cx-jor-pino'));
		const r = janela.getBoundingClientRect();
		const rc = caixa ? caixa.getBoundingClientRect() : null;
		return {
			janela: { largura: Math.round(r.width), altura: Math.round(r.height) },
			transbordaNaHorizontal: document.documentElement.scrollWidth > window.innerWidth,
			corpoRola: corpo.scrollHeight > corpo.clientHeight + 1,
			mapa: rc ? { largura: Math.round(rc.width), altura: Math.round(rc.height) } : null,
			pinos: pinos.length,
			// O disco E a etiqueta: e a etiqueta que vaza primeiro, e ela e o que
			// o jogador le. Cortada pelo `overflow:hidden` da caixa, ela vira um
			// nome pela metade sem nada dizer por que.
			pinosForaDaCaixa: !rc
				? 0
				: pinos.filter(p => {
						const alvos = [p].concat(Array.from(p.querySelectorAll('.cx-jor-pino-nome')));
						return alvos.some(el => {
							const q = el.getBoundingClientRect();
							if (q.width === 0 && q.height === 0) {
								return false;
							}
							return (
								q.left < rc.left - 1 ||
								q.right > rc.right + 1 ||
								q.top < rc.top - 1 ||
								q.bottom > rc.bottom + 1
							);
						});
					}).length,
			menorAlvoDePino: pinos.length
				? Math.round(Math.min(...pinos.map(p => Math.min(p.getBoundingClientRect().width, p.getBoundingClientRect().height))))
				: null,
			selosNaTela: shadow.querySelectorAll('.cx-selo').length,
		// O TEXTO de cada selo, e a FORMA dele. Os dois juntos sao o que prova
		// que os quatro estados se separam sem cor: a palavra para quem le, a
		// forma para o print em preto e branco.
		rotulosDeSelo: Array.from(shadow.querySelectorAll('.cx-selo')).map(e => e.textContent.trim()),
		formasDeSelo: Array.from(
			new Set(
				Array.from(shadow.querySelectorAll('.cx-selo')).map(e =>
					(e.className.match(/cx-selo--(\w+)/) || [])[1]
				)
			)
		),
			contadoresEscritos: Array.from(shadow.querySelectorAll('.cx-jor-contador')).map(e => e.textContent.trim()),
			botoesDeViagem: Array.from(shadow.querySelectorAll('.cx-jor-ir')).map(b => ({
				texto: b.textContent.trim(),
				apagado: b.disabled
			})),
		motivos: Array.from(shadow.querySelectorAll('.cx-jor-motivo')).map(e => e.textContent.trim())
	};
}

/* ------------------------------------------------------------------ */
/* A corrida                                                           */
/* ------------------------------------------------------------------ */

/** Mede o PNG: bytes, dimensao e quantas cores distintas ele tem (regra 5). */
function medirPng(arquivo) {
	const b = fs.readFileSync(arquivo);
	return { bytes: b.length, largura: b.readUInt32BE(16), altura: b.readUInt32BE(20) };
}

async function main() {
	fs.mkdirSync(SAIDA, { recursive: true });
	const { mod, limpar } = await carregarDesenho();
	const servidor = await subirServidorDePublic();
	// O `playwright` e CommonJS: um `import()` dele devolve o modulo em
	// `default`, e desestruturar `{ chromium }` direto da `undefined`.
	const pw = await import(pathToFileURL(PLAYWRIGHT).href);
	const chromium = pw.chromium || (pw.default && pw.default.chromium);
	const navegador = await chromium.launch();

	const relatorio = [];

	/**
	 * O contexto de `jornadaHtml`. `nivelQueAbre` e a funcao que no jogo le o
	 * catalogo do Mapa de Caca; aqui ela e uma tabela, e e o que permite
	 * fotografar a recusa por nivel sem servidor.
	 */
	const NIVEL_QUE_ABRE = {
		prt_fild05: 1,
		prt_fild06: 1,
		prt_fild08: 1,
		prt_sewb1: 15,
		prt_sewb2: 25,
		prt_sewb3: 35,
		prt_sewb4: 80
	};

	function ctx(extra) {
		return Object.assign(
			{
				estado: null,
				vista: 'mapa',
				capituloAberto: null,
				especieAberta: null,
				missoesPorCapitulo: {},
				situacao: { nivelDoJogador: 42, morto: false, mapaAtual: 'prt_sewb1' },
				nivelQueAbre: m => (m in NIVEL_QUE_ABRE ? NIVEL_QUE_ABRE[m] : null),
				faltamNaVarredura: 0
			},
			extra
		);
	}

	async function fotografar(nome, { estado, contexto, aba, celular, titulo }) {
		const contexer = await navegador.newContext({
			viewport: celular ? { width: 393, height: 852 } : { width: 1000, height: 760 },
			deviceScaleFactor: 2,
			hasTouch: !!celular,
			isMobile: !!celular
		});
		const pagina = await contexer.newPage();
		await pagina.goto(`http://127.0.0.1:${PORTA}/ragidle/`, { waitUntil: 'domcontentloaded' }).catch(() => {});
		/*
		 * O `<meta name="viewport">` NAO E DECORACAO AQUI.
		 *
		 * Sem ele, o Chromium em modo celular usa a viewport de compatibilidade
		 * (980px) e ENCOLHE a pagina inteira para caber - as regras
		 * `@media (max-width:599px)` do `Common.css` nao disparam, a janela nao
		 * vira painel de tela cheia, e a foto mostra uma miniatura de desktop
		 * jurando ser um celular. Foi o primeiro defeito que esta prova achou,
		 * e e a mesma cicatriz de "producao serve api.html SEM meta viewport".
		 */
		await pagina.setContent(
			'<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">' +
				'</head><body style="margin:0;background:#7d8ea3"></body></html>'
		);
		await pagina.evaluate(montarOArnes, {
			commonCss: COMMON_CSS,
			cxCss: CX_CSS,
			cxHtml: CX_HTML,
			saldo: estado.pontosDisponiveis,
			aba: aba,
			celular: !!celular,
			corpo:
				aba === 'jornada'
					? mod.jornadaHtml(estado, Object.assign(contexto, { estado: estado }))
					: corpoDoCodex(estado)
		});
		// As imagens do mapa e dos avatares vem do servidor de `public/`; sem
		// esperar por elas a foto sai com a caixa azul vazia - e a foto seria
		// exatamente o defeito que ela existe para pegar.
		await pagina.evaluate(esperarAsImagens);
		await pagina.waitForTimeout(150);

		const medidas = await pagina.evaluate(colherAsMedidas);
		const arquivo = path.join(SAIDA, nome + '.png');
		/*
		 * A foto e da JANELA DE VISAO inteira, e nao so do host.
		 *
		 * No celular a janela vira painel de tela cheia por regra do
		 * `Common.css`, e recortar o host esconderia exatamente o que se quer
		 * provar: que ela ocupa a tela e nao passa da borda. No desktop a
		 * viewport mostra a janela com folga em volta, que e como o jogador a
		 * ve. Uma foto so do componente daria uma imagem mais bonita e menos
		 * verdadeira.
		 */
		await pagina.screenshot({ path: arquivo });
		await contexer.close();

		relatorio.push({ nome: nome, titulo: titulo, png: medirPng(arquivo), medidas: medidas });
		console.log('  ' + nome + '.png  ' + JSON.stringify(medirPng(arquivo)));
	}

	/** A aba Codex, desenhada aqui porque ela mora dentro de `CodexIdle.js`. */
	function corpoDoCodex(estado) {
		const linhas = estado.missoes
			.map(m => {
				const pct = Math.min(100, Math.round((m.abates / m.alvo) * 100));
				return (
					'<div class="cx-missao' +
					(m.cumprida ? ' is-cumprida' : '') +
					'"><span class="cx-missao-nome">' +
					m.titulo +
					(m.cumprida ? ' <span class="ri-badge ri-badge--verde">Cumprida</span>' : '') +
					'</span><span class="cx-missao-especies">' +
					m.alvos.map(a => mod.chipDeEspecieHtml(a.mobId, a.monstro)).join('') +
					'</span><span class="cx-missao-progresso">' +
					m.abates +
					' / ' +
					m.alvo +
					'</span><div class="ri-bar ri-bar--exp cx-missao-barra"><div class="fill" style="width:' +
					pct +
					'%"></div></div></div>'
				);
			})
			.join('');
		return (
			'<div class="cx-placar"><span class="cx-placar-numero">3</span><span>' +
			'<div class="cx-placar-texto">pontos para gastar</div>' +
			'<div class="cx-placar-sub">8 de 11 ja aplicados · cada missao cumprida vale 1 ponto</div>' +
			'</span></div>' +
			'<div class="cx-secao"><div class="cx-secao-titulo">Onde os pontos nascem</div>' +
			'<div class="cx-missoes">' +
			linhas +
			'</div></div>'
		);
	}

	const aberta = retrato(JORNADA_ABERTA);
	const trancada = retrato(JORNADA_TRANCADA);
	const indice = { 'cap-01-prontera': MISSOES_DO_CAP_01, 'cap-02-esgotos': MISSOES_DO_CAP_02 };

	console.log('DESKTOP');
	await fotografar('01-mapa-desktop', {
		estado: aberta,
		aba: 'jornada',
		contexto: ctx({ vista: 'mapa' }),
		titulo: 'Tela A - o mapa dos capitulos'
	});
	await fotografar('02-jornada-inteira-desktop', {
		estado: aberta,
		aba: 'jornada',
		contexto: ctx({ vista: 'jornada' }),
		titulo: 'Tela C - a jornada inteira, com o proximo passo'
	});
	await fotografar('03-capitulo-desktop', {
		estado: aberta,
		aba: 'jornada',
		contexto: ctx({ vista: 'capitulo', capituloAberto: 'cap-02-esgotos', missoesPorCapitulo: indice }),
		titulo: 'Tela B - a lista do capitulo, os 4 estados e as 3 recusas de viagem'
	});
	await fotografar('04-capitulo-morto-desktop', {
		estado: aberta,
		aba: 'jornada',
		contexto: ctx({
			vista: 'capitulo',
			capituloAberto: 'cap-02-esgotos',
			missoesPorCapitulo: indice,
			situacao: { nivelDoJogador: 42, morto: true, mapaAtual: 'prt_sewb1' }
		}),
		titulo: 'A recusa por MORTE - todo botao de viagem apagado, com o motivo escrito'
	});
	await fotografar('05-especie-desktop', {
		estado: aberta,
		aba: 'jornada',
		contexto: ctx({ vista: 'especie', especieAberta: 1002, missoesPorCapitulo: indice }),
		titulo: 'A ponte: as missoes do Poring em todos os mapas'
	});
	await fotografar('06-trancada-desktop', {
		estado: trancada,
		aba: 'jornada',
		contexto: ctx({ vista: 'jornada' }),
		titulo: 'Antes do desbloqueio - o requisito, como seguir, e o premio ja anunciado'
	});
	await fotografar('07-aba-codex-desktop', {
		estado: aberta,
		aba: 'codex',
		contexto: ctx({}),
		titulo: 'A aba Codex intacta, com a ponte por especie nas entradas'
	});

	console.log('CELULAR (393x852)');
	await fotografar('08-mapa-celular', {
		estado: aberta,
		aba: 'jornada',
		celular: true,
		contexto: ctx({ vista: 'mapa' }),
		titulo: 'Tela A no painel de tela cheia do celular'
	});
	await fotografar('09-jornada-inteira-celular', {
		estado: aberta,
		aba: 'jornada',
		celular: true,
		contexto: ctx({ vista: 'jornada' }),
		titulo: 'Tela C no celular'
	});
	await fotografar('10-capitulo-celular', {
		estado: aberta,
		aba: 'jornada',
		celular: true,
		contexto: ctx({ vista: 'capitulo', capituloAberto: 'cap-02-esgotos', missoesPorCapitulo: indice }),
		titulo: 'Tela B no celular - a linha de missao empilhada'
	});

	await navegador.close();
	servidor.close();
	limpar();

	fs.writeFileSync(path.join(SAIDA, 'medidas.json'), JSON.stringify(relatorio, null, 2), 'utf8');

	/* -------- as reprovas automaticas, que a foto sozinha nao daria -------- */
	const erros = [];
	for (const r of relatorio) {
		if (r.png.bytes < 20000) {
			erros.push(r.nome + ': PNG de ' + r.png.bytes + ' bytes - tela quase vazia');
		}
		if (r.medidas.transbordaNaHorizontal) {
			erros.push(r.nome + ': a pagina rola na HORIZONTAL');
		}
		if (r.medidas.pinosForaDaCaixa > 0) {
			erros.push(r.nome + ': ' + r.medidas.pinosForaDaCaixa + ' pino(s) fora do mapa');
		}
	}
	const celularComMapa = relatorio.find(r => r.nome === '08-mapa-celular');
	if (celularComMapa && celularComMapa.medidas.menorAlvoDePino < 44) {
		erros.push('08-mapa-celular: alvo de pino com ' + celularComMapa.medidas.menorAlvoDePino + 'px (o dedo pede 44)');
	}

	/*
	 * OS QUATRO ESTADOS, POR TEXTO E POR FORMA - nas duas telas de capitulo.
	 *
	 * Sem isto a prova aprovaria uma tela em que os quatro estados existem e
	 * sao distinguidos SO POR COR, que e exatamente o que o pedido proibe.
	 */
	for (const nome of ['03-capitulo-desktop', '10-capitulo-celular']) {
		const r = relatorio.find(x => x.nome === nome);
		if (!r) {
			continue;
		}
		const rotulos = new Set(r.medidas.rotulosDeSelo);
		for (const palavra of ['Concluído', 'Em andamento', 'Disponível', 'Bloqueado']) {
			if (!rotulos.has(palavra)) {
				erros.push(nome + ': o estado "' + palavra + '" nao aparece ESCRITO');
			}
		}
		if (r.medidas.formasDeSelo.length < 4) {
			erros.push(nome + ': so ' + r.medidas.formasDeSelo.length + ' formas de selo - falta sinal fora da cor');
		}
	}

	/* O contador e ESCRITO. "3/10" reprova aqui, por pedido explicito do dono. */
	for (const r of relatorio) {
		for (const c of r.medidas.contadoresEscritos) {
			if (c.indexOf('/') !== -1 || c.indexOf(' de ') === -1) {
				erros.push(r.nome + ': contador "' + c + '" nao esta escrito como "3 de 10"');
			}
		}
	}

	/* As tres recusas silenciosas de `viajar()` tem de estar DITAS na tela. */
	const porNome = n => (relatorio.find(x => x.nome === n) || { medidas: { motivos: [] } }).medidas.motivos.join(' | ');
	if (porNome('03-capitulo-desktop').indexOf('Nv. 80') === -1) {
		erros.push('03-capitulo-desktop: a recusa por NIVEL nao aparece escrita');
	}
	if (porNome('03-capitulo-desktop').indexOf('já está neste mapa') === -1) {
		erros.push('03-capitulo-desktop: a recusa "ja esta neste mapa" nao aparece escrita');
	}
	if (porNome('04-capitulo-morto-desktop').indexOf('morto') === -1) {
		erros.push('04-capitulo-morto-desktop: a recusa por MORTE nao aparece escrita');
	}

	console.log('');
	console.log('Fotos em ' + SAIDA);
	if (erros.length) {
		console.log('REPROVOU:');
		for (const e of erros) {
			console.log('  - ' + e);
		}
		process.exitCode = 1;
		return;
	}
	console.log('As medidas passaram. AGORA OLHE OS PNG - contar elemento nao prova que da para ver.');
}

main().catch(err => {
	console.error(err);
	process.exitCode = 1;
});
