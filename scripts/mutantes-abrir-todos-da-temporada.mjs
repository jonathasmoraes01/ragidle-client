/**
 * scripts/mutantes-abrir-todos-da-temporada.mjs - a BATERIA DE MUTACAO do
 * "Abrir todos" da Temporada e do guarda da MACA no icone (05/10/2026).
 *
 *   node scripts/mutantes-abrir-todos-da-temporada.mjs [filtro-regex]
 *
 * O mesmo motor de `mutantes-versao-do-cliente.mjs`: cada mutante troca UM
 * trecho, roda os testes e devolve o arquivo no finally. Todo mutante tem de
 * MORRER; trecho que nao casa exatamente 1 vez NAO conta como morto.
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
const TESTES = ['tests/ui/abrirTodosDaTemporada.test.js', 'tests/ui/formatoDaTemporada.test.js'];

const F = 'src/UI/Components/TemporadaIdle/formatoDaTemporada.js';
const J = 'src/UI/Components/TemporadaIdle/TemporadaIdle.js';

const MUTANTES = [
	['AT1 o teto do pedido sobe para 20', F, 'export const TETO_DO_LOTE = 10;', 'export const TETO_DO_LOTE = 20;'],
	['AT2 pede todas de uma vez', F, '\treturn Math.min(n, TETO_DO_LOTE);', '\treturn n;'],
	['AT3 fechadas tortas viram pedido', F, '\tif (!Number.isFinite(n) || n <= 0) {', '\tif (!Number.isFinite(n)) {'],
	['AT4 segue mesmo com o jogador tendo fechado', F, '\tif (cancelado) {\n\t\treturn false;\n\t}\n\tif (!resultado', '\tif (!resultado'],
	[
		'AT5 segue depois da parada (mochila e correio cheios)',
		F,
		'if (!resultado || resultado.ok !== true || resultado.parada) {',
		'if (!resultado || resultado.ok !== true) {'
	],
	['AT6 segue com so repetidas (abriria caixa que o jogador nao viu)', F, '\tif (!aberturas.some(a => a && !a.repetida)) {', '\tif (false) {'],
	['AT7 segue sem caixa fechada', F, '\treturn quantidadeDoProximoLote(fechadasAgora) > 0;', '\treturn true;'],
	['AT8 o botao aparece com uma so', F, 'export const MINIMO_PARA_ABRIR_TODOS = 2;', 'export const MINIMO_PARA_ABRIR_TODOS = 1;'],
	[
		'AT9 o progresso conta as repetidas',
		F,
		'const abertas = ((lote && lote.aberturas) || []).filter(a => a && !a.repetida).length;',
		'const abertas = ((lote && lote.aberturas) || []).length;'
	],
	[
		'AT10 o item escreve o token cru da raridade',
		F,
		'te-lote-item-raridade te-raridade ${classe}">${escapeHtml(rotuloDaRaridade(a))}',
		'te-lote-item-raridade te-raridade ${classe}">${escapeHtml(a.raridade)}'
	],
	['AT11 a lista redesenha tudo (ignora o inicio)', F, '\t\t.slice(inicio)\n', ''],
	['AT12 o resumo nao diz a parada', F, '\t\tpartes.push(`Parou: ${ultimo.textoDaParada}`);', '\t\tvoid 0;'],
	['AT13 o resumo nao diz o correio', F, '\t\tif (noCorreio > 0) {', '\t\tif (false) {'],
	['AT14 a revelacao perde os raios', F, '\'<div class="te-reveal-raios" aria-hidden="true"></div>\' +', '\'\' +'],
	['AT15 o guarda da maca volta a ser pela identidade', J, '\t\t\t\tif (!temIconeProprio(info)) {', '\t\t\t\tif (!info || info === unknownItem) {'],
	['AT16 o lote nao entra na lista do ESC', J, '\tabrirBalao(BALAO_DO_LOTE, fecharLote);', '\tvoid 0;'],
	['AT17 a revelacao nao entra na lista do ESC', J, '\tabrirBalao(BALAO_DA_REVELACAO, fecharReveal);', '\tvoid 0;']
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
