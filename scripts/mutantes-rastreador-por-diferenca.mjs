/**
 * scripts/mutantes-rastreador-por-diferenca.mjs - o LACO da bateria de mutacao da
 * diferenca do rastreador do Codex (`v: 5`, D-2543).
 *
 *   node scripts/mutantes-rastreador-por-diferenca.mjs [filtro-regex]
 *
 * Os mutantes moram em `tests/mutantes/rastreador-por-diferenca.config.mjs` e
 * sao aplicados SO na memoria do vitest (o `transform` do config): nenhum
 * arquivo do cliente e tocado. Antes de qualquer mutante, a corrida SEM mutante
 * tem de passar (teste que ja reprova "mata" todo mutante de graca). Mutante
 * que nao casa exatamente uma vez e contado a parte, nunca como morto.
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VITEST = [
	resolve(RAIZ, 'node_modules/vitest/vitest.mjs'),
	resolve(RAIZ, '../../../node_modules/vitest/vitest.mjs')
].find(p => existsSync(p));
const CONFIG = 'tests/mutantes/rastreador-por-diferenca.config.mjs';
const { NOMES } = await import(pathToFileURL(resolve(RAIZ, CONFIG)).href);

function correr(nome) {
	const env = { ...process.env };
	if (nome) {
		env.RAG_MUTANTE_RASTREADOR = nome;
	} else {
		delete env.RAG_MUTANTE_RASTREADOR;
	}
	const r = spawnSync(process.execPath, [VITEST, 'run', '--config', CONFIG], { cwd: RAIZ, encoding: 'utf8', env });
	const saida = (r.stdout || '') + (r.stderr || '');
	const linha = (saida.match(/Tests\s+[^\n]*/) || ['?'])[0].trim();
	return { status: r.status, saida, linha };
}

const base = correr(null);
if (base.status !== 0) {
	console.error(`A corrida SEM mutante reprova (${base.linha}): a bateria nao mede nada assim.`);
	process.exit(2);
}
console.log(`sem mutante: verde (${base.linha})\n`);

const SO = process.argv[2] ? new RegExp(process.argv[2]) : null;
const resultados = [];
for (const nome of NOMES) {
	if (SO && !SO.test(nome)) {
		continue;
	}
	const r = correr(nome);
	if (/nao casa exatamente uma vez/.test(r.saida)) {
		resultados.push([nome, 'NAO CASA - recusado, nao conta']);
	} else if (r.status === 0) {
		resultados.push([nome, `SOBREVIVEU (${r.linha})`]);
	} else {
		resultados.push([nome, `morto (${r.linha})`]);
	}
}
for (const [n, r] of resultados) {
	console.log(`${r.startsWith('morto') ? 'ok ' : '!! '} ${n}: ${r}`);
}
const mortos = resultados.filter(([, r]) => r.startsWith('morto')).length;
const recusados = resultados.filter(([, r]) => r.startsWith('NAO CASA')).length;
const vivos = resultados.length - mortos - recusados;
console.log(`\n${mortos} mortos · ${vivos} sobreviventes · ${recusados} nao casam (de ${resultados.length})`);
process.exitCode = vivos || recusados ? 1 : 0;
