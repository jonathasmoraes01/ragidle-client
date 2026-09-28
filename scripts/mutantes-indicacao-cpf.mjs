/**
 * scripts/mutantes-indicacao-cpf.mjs - a BATERIA DE MUTACAO do CPF do
 * indicador na janela Indique & Ganhe (28/09/2026, D-1634 do servidor).
 *
 *   node scripts/mutantes-indicacao-cpf.mjs [filtro-regex]
 *
 * O mesmo motor das baterias do RO Shop (`mutantes-ro-shop-rodada3.mjs`):
 * cada mutante troca UM trecho, roda os testes da janela e devolve o arquivo
 * no finally. Todo mutante tem de MORRER. Um trecho que nao casa exatamente
 * 1 vez NAO conta como morto.
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
const TESTES = ['tests/ui/indicacaoCpf.test.js'];

const P = 'src/UI/Components/IndicacaoIdle/cpfDoIndicador.js';
const J = 'src/UI/Components/IndicacaoIdle/IndicacaoIdle.js';
const CSS = 'src/UI/Components/IndicacaoIdle/IndicacaoIdle.css';

const MUTANTES = [
	['IC1 CPF com verificador errado abre a confirmacao', P, '\tif (!cpfValido(digitos)) {', '\tif (false) {'],
	['IC2 CPF curto nao diz que faltam numeros', P, '\tif (digitos.length !== 11) {', '\tif (false) {'],
	['IC3 a secao aparece sem o sal no servidor', P, '\tif (!estado || estado.cpfDisponivel !== true) {', '\tif (!estado) {'],
	['IC4 cadastrado continua com o campo', P, '\tif (estado.cpfCadastrado === true) {', '\tif (false) {'],
	['IC5 a comissao retida some da janela', P, '\tif (retida > 0) {', '\tif (false) {'],
	['IC6 a confirmacao some (um digito errado vira cadastro sem volta)', P, '\tif (confirmando) {', '\tif (false) {'],
	[
		'IC7 a recusa do CODIGO aparece na secao do CPF',
		P,
		"\tconst recusa = ehRecusaDeCpf(estado.recusa) ? RECUSAS_DO_CPF[estado.recusa] : '';",
		"\tconst recusa = estado.recusa ? RECUSAS_DO_CPF[estado.recusa] || String(estado.recusa) : '';"
	],
	['IC8 o texto da confirmacao nao e escapado', P, '\t\t\tescapeHtml(confirmando) +', '\t\t\tconfirmando +'],
	[
		'IC9 o envio manda o CPF mascarado em vez dos digitos',
		J,
		"enviarAcao({ acao: 'cpf', cpf: envio.digitos });",
		"enviarAcao({ acao: 'cpf', cpf: envio.mascarado });"
	],
	[
		'IC10 a troca de personagem nao esquece o CPF em confirmacao',
		J,
		'IndicacaoIdle.estado = null;\n\t_cpfEmConfirmacao = null;',
		'IndicacaoIdle.estado = null;'
	],
	[
		'IC11 a recusa do CPF vaza para a linha do codigo',
		J,
		'const recusaDoCodigo = estado.recusa && !ehRecusaDeCpf(estado.recusa) ? estado.recusa : null;',
		'const recusaDoCodigo = estado.recusa ? estado.recusa : null;'
	],
	['IC12 no dedo o campo e os botoes do CPF ficam pequenos', CSS, '\t\tmin-height: var(--hit-touch, 44px);', ''],
	['IC13 o campo do CPF perde a mascara', J, "\t\t\tcorpo.addEventListener('input', onInputCorpo);", '']
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
