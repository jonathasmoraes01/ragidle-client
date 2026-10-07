/**
 * scripts/mutantes-janelas-por-diferenca.mjs - a BATERIA DE MUTACAO das
 * janelas so por diferenca e em paginas (D-2071, 07/10/2026): o parcial de
 * lista de missoes, a revisao da lista e da arvore, a declaracao das bases na
 * entrada no mapa e o juntador de paginas.
 *
 *   node scripts/mutantes-janelas-por-diferenca.mjs [filtro-regex]
 *
 * O mesmo motor de `mutantes-parcial-das-skills.mjs`: cada mutante troca UM
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
	resolve(RAIZ, '../../../node_modules/vitest/vitest.mjs'),
	resolve(RAIZ, '../../../../ragidle-client/node_modules/vitest/vitest.mjs')
].find(p => existsSync(p));
const TESTES = [
	'tests/ui/parcialDaLista.test.js',
	'tests/ui/listaDeMissoesPorParcial.test.js',
	'tests/ui/juntarPaginas.test.js',
	'tests/ui/janelaDeSkillsPorParcial.test.js',
	'tests/ui/quadroDeGruposEmPaginas.test.js'
];

const L = 'src/UI/Components/MissoesIdle/parcialDaLista.js';
const M = 'src/UI/Components/MissoesIdle/MissoesIdle.js';
const J = 'src/Network/juntarPaginas.js';
const D = 'src/Engine/declaracaoDasBases.js';
const S = 'src/UI/Components/IdleSkills/IdleSkills.js';
const G = 'src/UI/Components/LFGIdle/LFGIdle.js';

const MUTANTES = [
	['JL1 a versao do parcial e a do inteiro', L, 'export const VERSAO_DO_PARCIAL_DA_LISTA = 4;', 'export const VERSAO_DO_PARCIAL_DA_LISTA = 1;'],
	['JL2 qualquer parcial e o de lista', L, "dados.v === VERSAO_DO_PARCIAL_DA_LISTA && dados.parcial === 'lista';", 'dados.v === VERSAO_DO_PARCIAL_DA_LISTA;'],
	['JL3 a revisao aceita texto', L, "return dados && typeof dados.rev === 'number' ? dados.rev : null;", 'return dados && dados.rev != null ? Number(dados.rev) : null;'],
	['JL4 o parcial sem `de` nao cai (o servidor antigo fica cego)', L, "\tif (!dados || typeof dados.de !== 'number') {\n\t\treturn true;\n\t}", "\tif (!dados || typeof dados.de !== 'number') {\n\t\treturn false;\n\t}"],
	['JL5 o `de` nao e conferido', L, '\treturn revDaLista === dados.de;', '\treturn true;'],
	['JL6 o pedido nao leva a revisao', L, "return { acao: 'pedir', base: typeof revDaLista === 'number' ? revDaLista : null };", "return { acao: 'pedir', base: null };"],
	['JL7 a declaracao sem a chave da arvore', L, "\t\tskills: typeof revDaArvore === 'number' ? revDaArvore : null\n", ''],
	['JL8 a declaracao manda a revisao da lista como a da arvore', L, "\t\tskills: typeof revDaArvore === 'number' ? revDaArvore : null", "\t\tskills: typeof revDaLista === 'number' ? revDaLista : null"],
	['JL9 a ordem cita missao que nao ha e passa', L, '\t\t\tif (!m) {\n\t\t\t\treturn null;\n\t\t\t}\n\t\t\tlista.push(m);', '\t\t\tif (m) {\n\t\t\t\tlista.push(m);\n\t\t\t}'],
	['JL10 a missao nova sem ordem entra calada', L, '\t\t\tif (!atuais.has(id)) {\n\t\t\t\treturn null;\n\t\t\t}', ''],
	['JL11 a missao do parcial nao troca a de antes', L, 'lista = missoes.map(m => (m && novas.has(m.id) ? novas.get(m.id) : m));', 'lista = missoes.slice();'],
	['JL12 a ordem prefere a de antes a que veio', L, 'const m = novas.has(id) ? novas.get(id) : atuais.get(id);', 'const m = atuais.has(id) ? atuais.get(id) : novas.get(id);'],
	['JL13 o progresso que nao casa e desenhado', L, '\tif (r.divergentes.length > 0) {\n\t\treturn null;\n\t}', ''],
	['JL14 o progresso do parcial e ignorado', L, 'progressos: parcial.progressos && typeof parcial.progressos === \'object\' ? parcial.progressos : {},', 'progressos: {},'],
	['JL15 as prontas sao ignoradas', L, 'prontas: Array.isArray(parcial.prontas) ? parcial.prontas : undefined', 'prontas: undefined'],
	['JL16 os campos se perdem', L, "campos: parcial.campos && typeof parcial.campos === 'object' ? parcial.campos : {},", 'campos: {},'],
	['JL17 o rastreador nunca troca', L, "const temRastreador = Object.prototype.hasOwnProperty.call(parcial, 'codexRastreado');", 'const temRastreador = false;'],
	['JL18 missao sem id entra', L, "\t\tif (!m || typeof m.id !== 'string') {\n\t\t\treturn null;\n\t\t}\n\t\tnovas.set", '\t\tnovas.set'],
	['JM1 abrir vai sempre pelo 0x0fec', M, '\tif (_servidorNumera && _revDaLista !== null && MissoesIdle.recebeuAlgumaVez) {\n\t\tmandarAcaoDeMissaoCorpo(pedidoDaLista(_revDaLista));\n\t\treturn;\n\t}\n', ''],
	['JM2 abrir pelo verbo com servidor que nao numera', M, '\tif (_servidorNumera && _revDaLista !== null && MissoesIdle.recebeuAlgumaVez) {', '\tif (MissoesIdle.recebeuAlgumaVez) {'],
	['JM3 a revisao da declaracao vale com a inteira pedida', M, 'return MissoesIdle.recebeuAlgumaVez && !_pediuAListaInteira ? _revDaLista : null;', 'return MissoesIdle.recebeuAlgumaVez ? _revDaLista : null;'],
	['JM4 a inteira e pedida a cada parcial que nao cai', M, '\tif (_pediuAListaInteira) {\n\t\treturn;\n\t}\n\t_pediuAListaInteira = true;', '\t_pediuAListaInteira = true;'],
	['JM5 a inteira vai sempre pelo 0x0fec', M, '\tif (_servidorNumera) {\n\t\tmandarAcaoDeMissaoCorpo(pedidoDaLista(null));\n\t\treturn;\n\t}\n', ''],
	['JM6 o parcial do rastreador nao confere a revisao', M, "\t\tif (!caiSobreARevisao(_revDaLista, dados)) {\n\t\t\tpedirListaInteira('o parcial do rastreador nao cai sobre a revisao da lista');\n\t\t\treturn;\n\t\t}\n", ''],
	['JM7 o parcial do rastreador nao anda a revisao', M, '\t\tanotarRastreadorDoCodex(dados.codexRastreado);\n\t\t_revDaLista = revisaoDoCorpo(dados) ?? _revDaLista;', '\t\tanotarRastreadorDoCodex(dados.codexRastreado);'],
	['JM8 o parcial de progresso nao confere a revisao', M, "\t\tif (typeof dados.de === 'number' && (!MissoesIdle.recebeuAlgumaVez || !caiSobreARevisao(_revDaLista, dados))) {", "\t\tif (typeof dados.de === 'number' && !MissoesIdle.recebeuAlgumaVez) {"],
	['JM9 o parcial de progresso nao anda a revisao', M, '\t\tfundirProgressoParcial(dados);\n\t\t_revDaLista = revisaoDoCorpo(dados) ?? _revDaLista;', '\t\tfundirProgressoParcial(dados);'],
	['JM10 o parcial de lista e ignorado', M, '\tif (ehParcialDaLista(dados)) {\n\t\tif (_pediuAListaInteira) {', '\tif (false) {\n\t\tif (_pediuAListaInteira) {'],
	['JM11 o parcial de lista nao confere a revisao', M, '\t\t\tMissoesIdle.recebeuAlgumaVez && caiSobreARevisao(_revDaLista, dados)', '\t\t\tMissoesIdle.recebeuAlgumaVez'],
	['JM12 o parcial de lista nao troca a execucao', M, '\t\t\tMissoesIdle.execucao = execucao && typeof execucao === \'object\' ? execucao : null;\n\t\t}', '\t\t}'],
	['JM13 o parcial de lista nao anda a revisao', M, '\t\t_revDaLista = revisaoDoCorpo(dados);\n\t\trender();', '\t\trender();'],
	['JM14 o parcial de lista com a inteira pedida e aplicado', M, '\tif (ehParcialDaLista(dados)) {\n\t\tif (_pediuAListaInteira) {\n\t\t\treturn;\n\t\t}', '\tif (ehParcialDaLista(dados)) {'],
	['JM15 a inteira nao guarda a revisao', M, '\t_revDaLista = revisaoDoCorpo(dados);\n\t_servidorNumera = _revDaLista !== null;', '\t_servidorNumera = revisaoDoCorpo(dados) !== null;'],
	['JM16 a troca de personagem lembra a revisao', M, '\t_revDaLista = null;\n\t_servidorNumera = false;\n', ''],
	['JD1 a declaracao nao sai', D, '\tNetwork.sendPacket(pkt);', ''],
	['JD2 a declaracao manda a lista no lugar da arvore', D, 'pkt.json = JSON.stringify(declaracaoDasBases(lista, arvore));', 'pkt.json = JSON.stringify(declaracaoDasBases(lista, lista));'],
	['JJ1 o corpo sem paginas e engolido', J, "\t\tif (!dados || !(Number(dados.partes) > 1)) {\n\t\t\tguardado = null;\n\t\t\treturn dados;\n\t\t}", "\t\tif (!dados) {\n\t\t\treturn dados;\n\t\t}"],
	['JJ2 a pagina do meio fora de ordem e aceita', J, 'guardado.proxima === parte && guardado.rev === dados.rev', 'guardado.rev === dados.rev'],
	['JJ3 outra serie (rev) e misturada', J, 'guardado.proxima === parte && guardado.rev === dados.rev', 'guardado.proxima === parte'],
	['JJ4 outra serie (partes) e misturada', J, 'guardado && guardado.partes === partes && guardado.proxima', 'guardado && guardado.proxima'],
	['JJ5 a primeira pagina devolve o corpo', J, '\t\tif (parte < partes) {\n\t\t\treturn null;\n\t\t}', ''],
	['JJ6 a pagina seguinte nao soma', J, '\t\t\tguardado.corpo[chave] = guardado.corpo[chave].concat(fatia);', ''],
	['JJ7 o corpo pronto leva parte/partes', J, '\t\tdelete pronto.parte;\n\t\tdelete pronto.partes;\n', ''],
	['JS1 a arvore em paginas nao e juntada', S, '\t\tdata = juntarPaginasDaArvore(data);\n\t\tif (data === null) {\n\t\t\treturn;\n\t\t}', ''],
	['JS2 a revisao da arvore vale com o inteiro pedido', S, '\tif (IdleSkills._inteiroPedido || !servidorNumera(IdleSkills._estadoDoServidor)) {', '\tif (!servidorNumera(IdleSkills._estadoDoServidor)) {'],
	['JG1 o quadro em paginas nao e juntado', G, '\tdados = juntarPaginasDoQuadro(dados);\n\tif (dados === null) {\n\t\treturn;\n\t}\n', '']
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
