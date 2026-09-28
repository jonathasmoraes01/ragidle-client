/**
 * scripts/mutantes-versao-do-cliente.mjs - a BATERIA DE MUTACAO da versao do
 * cliente no login e da recusa por versao (28/09/2026, D-1635 do servidor).
 *
 *   node scripts/mutantes-versao-do-cliente.mjs [filtro-regex]
 *
 * O mesmo motor das baterias do RO Shop (`mutantes-ro-shop-rodada3.mjs`):
 * cada mutante troca UM trecho, roda os testes e devolve o arquivo no
 * finally. Todo mutante tem de MORRER. Um trecho que nao casa exatamente 1
 * vez NAO conta como morto.
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
const TESTES = ['tests/ui/versaoDoClienteNoLogin.test.js'];

const V = 'src/Core/versaoDoCliente.js';
const D = 'src/Engine/clienteDesatualizado.js';
const L = 'src/Engine/LoginEngine.js';
const B = 'applications/tools/builder-web.mjs';

const MUTANTES = [
	['VD1 o carimbo e cortado nas casas erradas', V, 'return m ? Number(m[1].slice(2, 12)) : 0;', 'return m ? Number(m[1].slice(0, 10)) : 0;'],
	[
		'VD2 sem build o login manda zero (e nao a versao da configuracao)',
		V,
		'return versaoDoCliente > 0 ? versaoDoCliente : parseInt(versaoDaConfiguracao, 10);',
		'return versaoDoCliente;'
	],
	[
		'VD3 a versao da configuracao vence a do build',
		V,
		'return versaoDoCliente > 0 ? versaoDoCliente : parseInt(versaoDaConfiguracao, 10);',
		'return parseInt(versaoDaConfiguracao, 10);'
	],
	[
		'VD4 sem o prazo: a recusa recarrega sempre (laco)',
		D,
		"if (typeof ultimaRecargaEm === 'number' && agora - ultimaRecargaEm < MS_SEM_REPETIR_A_MESMA_VERSAO) {",
		'if (false) {'
	],
	[
		'VD5 recarrega mesmo sem conseguir anotar (laco na aba privada)',
		D,
		"if (acao === 'recarregar' && anotarRecarga(agora, armazenamento)) {",
		"if (acao === 'recarregar') {\n\t\tanotarRecarga(agora, armazenamento);"
	],
	['VD6 recarrega so o iframe, e a casca fica velha', D, '(w.top || w).location.reload();', 'w.location.reload();'],
	['VD7 o motivo 5 cai na frase do EXE', L, 'if (pkt.ErrorCode === MOTIVO_DE_CLIENTE_DESATUALIZADO) {', 'if (false) {'],
	[
		'VD8 o login volta a mandar a versao da configuracao',
		L,
		'// minimo dele. Sem build (o dev), o `version` da config, como antes.\n\t\t\t\tpkt.Version = versaoParaOLogin(_server.version);',
		'// minimo dele. Sem build (o dev), o `version` da config, como antes.\n\t\t\t\tpkt.Version = parseInt(_server.version, 10);'
	],
	['VD9 o "Ok" nunca recarrega', L, "if (decidirERecarregar(Date.now()) === 'recarregar') {", 'if (false) {'],
	[
		'VD10 o build nao injeta a versao no jogo',
		B,
		'__RAGIDLE_VERSAO_DO_BUILD__: JSON.stringify(versaoDoBuild)',
		"__RAGIDLE_VERSAO_DO_BUILD__: JSON.stringify('')"
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
