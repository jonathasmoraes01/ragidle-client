/**
 * scripts/mutantes-ro-shop-rodada2.mjs - a BATERIA DE MUTACAO dos pontos novos
 * da rodada 2 do RO Shop (22/09/2026).
 *
 *   node scripts/mutantes-ro-shop-rodada2.mjs [filtro-regex]
 *
 * Cada mutante troca UM trecho do codigo, roda os testes do RO Shop e devolve o
 * arquivo original no finally. Todo mutante tem de MORRER (algum teste
 * reprova); um que sobrevive e um ponto que os testes nao guardam. O vitest e o
 * do repositorio principal do cliente (a worktree nao tem node_modules).
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
const TESTES = ['tests/ui/roShopRodada2.test.js', 'tests/ui/roShop.test.js'];

const C = 'src/UI/Components/RoShop/controladorDoRoShop.js';
const F = 'src/UI/Components/RoShop/formatoDoRoShop.js';
const V = 'src/UI/Components/CharSelect/vagasDaSelecao.js';
const S = 'src/Utils/saldoDeCash.js';
const CS = 'src/UI/Components/CharSelect/CharSelectCommon.js';
const TC = 'src/UI/Components/TemporadaIdle/TemporadaIdle.css';
const FT = 'src/UI/Components/TemporadaIdle/formatoDaTemporada.js';

const MUTANTES = [
	['C1 parametros fora do corpo', C, 'corpo.parametros = p.parametros;', ''],
	[
		'C2 chave nao presa aos parametros',
		C,
		'if (!s.servico.chave || s.servico.assinatura !== assinatura) {',
		'if (!s.servico.chave) {'
	],
	['C3 estado nao publica saldo', C, 'publicar(dados && dados.moeda && dados.moeda.saldoMinor);', ''],
	[
		'C4 replay publica saldo velho',
		C,
		'if (dados.pedido && dados.pedido.repetido !== true) {',
		'if (dados.pedido) {'
	],
	['C5 saldo de fora nao entra', C, 's.estado = { ...s.estado, moeda: { ...moeda, saldoMinor: minor } };', ''],
	[
		'C6 formulario redesenha a cada tecla',
		C,
		'if (forma === _servicoDesenhado && corpo.firstChild) {',
		'if (false) {'
	],
	['C7 recusados perdidos', C, '				recusados,\n', ''],
	['C8 frase da recusa nao sai ao digitar', C, 'erro.remove();', ''],
	[
		'C9 invalido sai do cliente',
		C,
		"if (!p.ok) {\n\t\t\taviso(p.erro, 'erro');\n\t\t\treturn;\n\t\t}",
		'if (false) {\n\t\t}'
	],
	[
		'C10 atualizarSaldo aceita negativo',
		C,
		'if (!s.estado || !ehMinor(minor) || minor < 0) {',
		'if (!s.estado || !ehMinor(minor)) {'
	],
	[
		'F1 Number(null) volta a marcar Feminino',
		F,
		'const ativo = valor === null ? semSexo : !semSexo && Number(c.sexo) === valor;',
		'const ativo = valor === null ? semSexo : Number(c.sexo) === valor;'
	],
	[
		'F2 requerRelog truthy',
		F,
		'const relog = ok && resultado && resultado.requerRelog === true;',
		'const relog = ok && resultado && resultado.requerRelog;'
	],
	[
		'F3 contador aceita teto 0',
		F,
		'return x === null || y === null || y === 0 ? null : { x, y };',
		'return x === null || y === null ? null : { x, y };'
	],
	[
		'F4 servicos sem filtro de categoria',
		F,
		'servicosComCredito(estado).filter(s => !alvo || categoriaDoServico(estado, s) === alvo)',
		'servicosComCredito(estado)'
	],
	[
		'F5 faixa do cabelo ignorada',
		F,
		'(lido.invalido || (!lido.vazio && (lido.numero < f.min || lido.numero > f.max)))',
		'(lido.invalido)'
	],
	['F6 nome sem normalizar', F, 'const nome = normalizarNome(c.novoNome);', "const nome = String(c.novoNome || '');"],
	['F7 sexo fixo ignorado', F, 'const travada = valor !== null && lim.sexoFixo;', 'const travada = false;'],
	[
		'F8 limites do servidor ignorados',
		F,
		'f && Number.isInteger(f.min) && Number.isInteger(f.max) && f.min <= f.max ? { min: f.min, max: f.max } : { min, max };',
		'({ min, max });'
	],
	['V1 personagem alem do total some', V, 'const aparece = i < vagas || tem;', 'const aparece = i < vagas;'],
	[
		'V2 cria na vaga do total',
		V,
		'indice >= 0 && indice < vagas && !ocupada',
		'indice >= 0 && indice <= vagas && !ocupada'
	],
	['V3 sem teto da grade', V, 'return Math.min(VAGAS_DESENHAVEIS, Math.max(1, n));', 'return Math.max(1, n);'],
	['V4 cursor passa do total', V, 'if (i >= vagas && !(ocupada && ocupada(i))) {', 'if (false) {'],
	['S1 saldo negativo aceito', S, 'if (!ehMinor(minor) || minor < 0) {', 'if (!ehMinor(minor)) {'],
	[
		'S2 ouvinte com defeito cala os outros',
		S,
		"try {\n\t\t\tfn(minor);\n\t\t} catch (err) {\n\t\t\tconsole.error('[saldoDeCash] ouvinte falhou', err);\n\t\t}",
		'fn(minor);'
	],
	['S3 igual acorda ouvinte', S, 'const mudou = !_conhecido || Session.cash !== minor;', 'const mudou = true;'],
	[
		'CS1 create sem guarda',
		CS,
		'if (gridLayout && !podeCriarNaVaga(_index, _maxSlots, !!_slots[_index])) {',
		'if (false) {'
	],
	['CS2 total fixo 15', CS, '_maxSlots = vagasDaConta(pkt, defaultMaxSlots);', '_maxSlots = 15;'],
	[
		'TC1 modal da Temporada volta a static',
		TC,
		'position: relative !important;\n\tz-index: 1;',
		'position: relative;\n\tz-index: 1;'
	],
	[
		'FT1 Temporada ignora saldo da conta',
		FT,
		'if (Number.isInteger(saldoDaConta) && saldoDaConta >= 0) {',
		'if (false) {'
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
		writeFileSync(caminho, original.replace(de, para));
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
