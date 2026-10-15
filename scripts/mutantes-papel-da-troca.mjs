/**
 * scripts/mutantes-papel-da-troca.mjs - a BATERIA DE MUTACAO do papel na
 * janela de troca (14/10/2026, R127 e D-2476 do servidor: o VIP da, o FREE
 * so recebe).
 *
 *   node scripts/mutantes-papel-da-troca.mjs [filtro-regex]
 *
 * O mesmo motor de `mutantes-versao-do-cliente.mjs`: cada mutante troca UM
 * trecho, roda os testes e devolve o arquivo no finally. Todo mutante tem de
 * MORRER. Um trecho que nao casa exatamente 1 vez NAO conta como morto.
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
const TESTES = ['tests/ui/papelDaTroca.test.js'];

const P = 'src/UI/Components/Trade/papelDaTroca.js';
const T = 'src/UI/Components/Trade/Trade.js';
const E = 'src/Engine/MapEngine/Trade.js';
const I = 'src/UI/Components/TrocaIdle/TrocaIdle.js';
const C = 'src/UI/Components/Trade/Trade.css';

const MUTANTES = [
	// A regra.
	['PT1 o zeny 0 do "Confirmar" tambem e barrado (o FREE nao confirma)', P, 'return !ehZeny || quantidade > 0;', 'return true;'],
	['PT2 o zeny acima de zero passa no lado FREE', P, 'return !ehZeny || quantidade > 0;', 'return !ehZeny;'],
	['PT3 o lado VIP tambem e barrado', P, 'if (!papel || papel.podeOferecer) {', 'if (!papel) {'],
	[
		'PT4 o corpo sem `podeOferecer` booleano vira papel',
		P,
		" || typeof dados.podeOferecer !== 'boolean') {",
		') {'
	],
	// A janela.
	['PT5 a faixa do papel nunca aparece', P, 'faixa.hidden = !papel || !papel.texto;', 'faixa.hidden = true;'],
	['PT6 o zeny do FREE nao trava', P, 'zeny.disabled = true;', 'zeny.disabled = false;'],
	["PT7 o zeny do FREE nao volta a 0", P, "zeny.value = '0';", 'void zeny;'],
	['PT8 o zeny do lado VIP tambem trava', P, 'if (zeny && soRecebe) {', 'if (zeny) {'],
	["PT9 a marca do lado FREE nao liga", P, "janela.classList.toggle('so-recebe', soRecebe);", "janela.classList.toggle('so-recebe', false);"],
	["PT10 a recusa nao pisca", P, "faixa.classList.add('is-recusa');", 'void faixa;'],
	[
		'PT11 o papel novo nao apaga o vermelho da recusa anterior',
		P,
		"faixa.hidden = !papel || !papel.texto;\n\t\tfaixa.classList.remove('is-recusa');",
		'faixa.hidden = !papel || !papel.texto;'
	],
	// A costura na janela de troca.
	['TJ1 o pedido de oferta nao pergunta o papel', T, 'if (ofertaBarradaPeloPapel(_papel, index === 0, count)) {', 'if (false) {'],
	[
		'TJ2 o arrasto nao pergunta o papel (pede a quantidade ao FREE)',
		T,
		'if (ofertaBarradaPeloPapel(_papel, false, 1)) {\n\t\trecusarOferta();\n\t\treturn false;',
		'if (false) {\n\t\trecusarOferta();\n\t\treturn false;'
	],
	[
		'TJ3 o "Confirmar" do FREE manda o zeny digitado',
		T,
		'if (ofertaBarradaPeloPapel(_papel, true, zeny)) {\n\t\tzeny = 0;',
		'if (ofertaBarradaPeloPapel(_papel, true, zeny)) {\n\t\tvoid zeny;'
	],
	['TJ4 a abertura nao aplica o papel que ja chegou', T, 'aplicarPapel(root, _papel);', 'void root;'],
	['TJ5 fechar nao esquece o papel', T, 'resetUI.call(this);\n\t_papel = null;', 'resetUI.call(this);'],
	[
		'TJ6 a recusa nao diz a frase no chat',
		T,
		'ChatBox.addText(_papel.texto, ChatBox.TYPE.ERROR, ChatBox.FILTER.PUBLIC_LOG);',
		'void _papel;'
	],
	[
		'TJ7 o toque na coluna da oferta nao recusa',
		T,
		'if (ofertaBarradaPeloPapel(_papel, false, 1)) {\n\t\t\t\trecusarOferta();\n\t\t\t}',
		'if (false) {\n\t\t\t\trecusarOferta();\n\t\t\t}'
	],
	['TJ8 o pacote nao e lido (o papel fica cru)', T, '_papel = papelDoPacote(dados);', '_papel = dados;'],
	// O motor e o dono do 0x0fb3.
	['EM1 a troca nova herda o papel da anterior', E, '\t\tTrade.definirPapel(null);\n', '\n'],
	['EM2 o papel nao chega a janela de troca', E, '\tTrade.definirPapel(dados);\n}', '\tvoid dados;\n}'],
	["TI1 o papel cai no controlador da janela \"Trade\" (que o ignora)", I, "if (dados.acao === 'papel') {", 'if (false) {'],
	[
		'TI2 o papel so passa com a janela "Trade" preparada',
		I,
		'if (!dados || dados.v !== 1) {',
		'if (!dados || dados.v !== 1 || !_controlador) {'
	],
	// O celular.
	['CS1 a janela volta a 560px fixos (sai da tela do celular)', C, 'width: min(560px, calc(100vw - 16px));', 'width: 560px;'],
	[
		'CS2 o zeny desligado do FREE engole o toque (sem recusa visivel)',
		C,
		'#Trade.so-recebe .zeny.send {\n\tpointer-events: none;',
		'#Trade.so-recebe .zeny.send {\n\tpointer-events: auto;'
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
