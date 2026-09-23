/**
 * scripts/mutantes-ro-shop-rodada3.mjs - a BATERIA DE MUTACAO dos consertos da
 * rodada 3 do RO Shop (22/09/2026, achados da QA independente do cliente).
 *
 *   node scripts/mutantes-ro-shop-rodada3.mjs [filtro-regex]
 *
 * O mesmo motor da rodada 2 (`mutantes-ro-shop-rodada2.mjs`): cada mutante
 * troca UM trecho, roda os testes do RO Shop e devolve o arquivo no finally.
 * Todo mutante tem de MORRER. Um trecho que nao casa exatamente 1 vez NAO
 * conta como morto (foi assim que o F8 da rodada 2 passou despercebido).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VITEST = [
	resolve(RAIZ, 'node_modules/vitest/vitest.mjs'),
	resolve(RAIZ, '../../../node_modules/vitest/vitest.mjs')
].find(p => existsSync(p));
const TESTES = [
	'tests/ui/roShopRodada3.test.js',
	'tests/ui/roShopRodada2.test.js',
	'tests/ui/roShop.test.js',
	'tests/db/nomesLocais.test.js'
];

const IC = 'src/UI/Components/RoShop/iconeDoRoShop.js';
const FI = 'src/DB/Items/FichaDoItem.js';
const NL = 'src/DB/Items/nomesLocais.js';
const IO = 'src/UI/Components/ItemObtain/ItemObtain.js';
const C = 'src/UI/Components/RoShop/controladorDoRoShop.js';
const F = 'src/UI/Components/RoShop/formatoDoRoShop.js';
const CSS = 'src/UI/Components/RoShop/RoShop.css';
const TC = 'src/UI/Components/TemporadaIdle/TemporadaIdle.css';

const MUTANTES = [
	[
		'A01a guarda volta a aceitar a copia com a maca',
		IC,
		'if (!temIconeProprio(ficha)) {',
		'if (!ficha || !ficha.identifiedResourceName) {'
	],
	[
		'A01b temIconeProprio aceita o recurso da maca',
		FI,
		" && recurso !== unknownItem.identifiedResourceName;",
		';'
	],
	['A01c Pack Pocao Azul perde a reserva', NL, String.raw`	9000103: '\xc6\xc4\xb6\xf5\xc6\xf7\xbc\xc7', //`, '	//'],
	[
		'A01d aviso de obtido so conhece o GRF',
		IO,
		'preferirArtePublicada(itemIconUrl(item.ITID), aplicarIcone, () => {',
		'((_url, _ok, falha) => falha())(0, 0, () => {'
	],
	[
		'A04a Season 1 cravado',
		F,
		"return m ? `Season ${Number(m[1])}` : '';",
		"return 'Season 1';"
	],
	[
		'A04b banner ignora o rotulo',
		F,
		"const titulo = rotulo && !/^season\\b/i.test(nome) ? `${rotulo} - ${nome}` : nome;",
		'const titulo = nome;'
	],
	['A06a fita nao rola', C, 'cats.scrollLeft += delta;', ''],
	[
		'A06b fita puxada a cada redesenho',
		C,
		'if (chave === _categoriaMostrada) {\n\t\t\treturn;\n\t\t}',
		''
	],
	[
		'A06c reabrir nao traz a chip de volta',
		C,
		'_categoriaMostrada = null;\n\t\trender();',
		'render();'
	],
	['A06d deslocamento pela esquerda zerado', F, 'return Math.round(chip.left - fita.left - folga);', 'return 0;'],
	[
		'A07a gaveta nao esconde a barra',
		CSS,
		'.rs-window.is-gaveta-aberta .rs-barra-carrinho {\n\t\tdisplay: none;',
		'.rs-window.is-gaveta-aberta .rs-barra-carrinho {\n\t\tdisplay: flex;'
	],
	['A07b aviso fica no rodape com a gaveta', CSS, 'top: 56px;\n\t\tbottom: auto;', 'bottom: 72px;'],
	[
		'A07c aviso volta ao centro da janela',
		CSS,
		'left: calc((100% - var(--rs-lateral)) / 2);',
		'left: 50%;'
	],
	[
		'A08 erro volta a mostrar a paginacao',
		C,
		"data-rs=\"tentar-de-novo\">Tentar de novo</button></div>';\n\t\t\tif (pag) {\n\t\t\t\tpag.innerHTML = '';",
		"data-rs=\"tentar-de-novo\">Tentar de novo</button></div>';\n\t\t\tif (pag) {\n\t\t\t\tpag.innerHTML = paginacaoHtml(1, 1);"
	],
	['A09a servico volta ao icone da categoria', F, 'ids = [ICONE_DO_SERVICO[produto.sku]];', ''],
	['A09b dois servicos no mesmo icone', F, 'SERVICE_STAT_RESET: 12040,', 'SERVICE_STAT_RESET: 1550,'],
	['A03 chamada do Passe volta a encolher', TC, '\tappearance: none;\n\tflex-shrink: 0;\n', '\tappearance: none;\n'],
	[
		'A05a janela grande volta a 1040',
		CSS,
		'width: min(1200px, 100vw - 16px);',
		'width: min(1040px, 100vw - 16px);'
	],
	[
		'A05b selo volta a 9px',
		CSS,
		'--type-badge: var(--fw-bold) 10px / 1 var(--font-ui);',
		'--type-badge: var(--fw-bold) 9px / 1 var(--font-ui);'
	]
];

const resultados = [];
const SO = process.argv[2] ? new RegExp(process.argv[2]) : null;
for (let [nome, arquivo, de, para] of MUTANTES) {
	if (SO && !SO.test(nome)) {
		continue;
	}
	const caminho = `${RAIZ}/${arquivo}`;
	const original = readFileSync(caminho, 'utf8');
	/* Os arquivos do cliente estao em CRLF na arvore de trabalho. */
	if (original.includes('\r\n')) {
		de = de.replace(/\n/g, '\r\n');
		para = para.replace(/\n/g, '\r\n');
	}
	const vezes = original.split(de).length - 1;
	if (vezes !== 1) {
		resultados.push([nome, `TRECHO ACHADO ${vezes}x - mutante nao aplicado`]);
		continue;
	}
	try {
		writeFileSync(caminho, original.replace(de, () => para));
		const r = spawnSync(process.execPath, [VITEST, 'run', ...TESTES], { cwd: RAIZ, encoding: 'utf8' });
		const saida = (r.stdout || '') + (r.stderr || '');
		const linha = (saida.match(/Tests\s+[^\n]*/) || ['?'])[0].trim();
		resultados.push([nome, r.status === 0 ? `SOBREVIVEU (${linha})` : `morto (${linha})`]);
	} finally {
		writeFileSync(caminho, original);
	}
}
for (const [n, r] of resultados) {
	console.log(`${r.startsWith('morto') ? 'ok ' : '!! '} ${n}: ${r}`);
}
const vivos = resultados.filter(([, r]) => !r.startsWith('morto')).length;
console.log(`\n${resultados.length - vivos}/${resultados.length} mutantes mortos`);
process.exitCode = vivos ? 1 : 0;
