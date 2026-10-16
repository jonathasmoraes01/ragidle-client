/**
 * scripts/mutantes-cache-do-aparelho.mjs - o LACO da bateria de mutacao do
 * cache de arquivos do aparelho (15/10/2026, D-2547..D-2549).
 *
 *   node scripts/mutantes-cache-do-aparelho.mjs [filtro-regex]
 *
 * A mutacao e so na memoria do Vitest (`tests/mutantes/cache-do-aparelho.config.mjs`):
 * nenhum arquivo do cliente e tocado. Antes de rodar, o laco confere que o
 * trecho de cada mutante casa EXATAMENTE uma vez no alvo: o que nao casa e
 * RECUSADO (e conta como falha da bateria), porque o Vitest reprovaria com
 * "nao casa" e o mutante pareceria morto sem ter medido nada. O controle (sem
 * mutante) roda primeiro e tem de passar.
 */
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VITEST = [
	resolve(RAIZ, 'node_modules/vitest/vitest.mjs'),
	resolve(RAIZ, '../../../node_modules/vitest/vitest.mjs')
].find(p => existsSync(p));
const CONFIG = 'tests/mutantes/cache-do-aparelho.config.mjs';
const { mutantes } = await import(pathToFileURL(resolve(RAIZ, CONFIG)).href);

function rodar(nome) {
	const r = spawnSync(process.execPath, [VITEST, 'run', '--config', CONFIG], {
		cwd: RAIZ,
		env: { ...process.env, RAG_MUTANTE_CACHE: nome },
		encoding: 'utf8'
	});
	return { status: r.status, saida: (r.stdout || '') + (r.stderr || '') };
}

const controle = rodar('');
if (controle.status !== 0) {
	console.error(controle.saida.slice(-3000));
	console.error('O CONTROLE (sem mutante) reprovou: a bateria nao mede nada assim.');
	process.exit(2);
}
console.log('controle: verde');

const SO = process.argv[2] ? new RegExp(process.argv[2]) : null;
const mortos = [];
const sobreviventes = [];
const recusados = [];
for (const [nome, [alvo, de]] of Object.entries(mutantes)) {
	if (SO && !SO.test(nome)) continue;
	const texto = readFileSync(resolve(RAIZ, alvo), 'utf8').replace(/\r\n/g, '\n');
	if (texto.split(de).length !== 2) {
		recusados.push(nome);
		console.log(`RECUSADO  ${nome} (o trecho nao casa exatamente uma vez em ${alvo})`);
		continue;
	}
	const r = rodar(nome);
	if (/nao casa exatamente uma vez/.test(r.saida)) {
		recusados.push(nome);
		console.log(`RECUSADO  ${nome} (o Vitest nao achou o trecho)`);
	} else if (r.status === 0) {
		sobreviventes.push(nome);
		console.log(`SOBREVIVE ${nome}`);
	} else {
		mortos.push(nome);
		console.log(`morto     ${nome}`);
	}
}

const total = mortos.length + sobreviventes.length + recusados.length;
console.log(`\n${mortos.length}/${total} mortos · ${sobreviventes.length} sobreviventes · ${recusados.length} recusados`);
if (sobreviventes.length) console.log('sobreviventes: ' + sobreviventes.join(', '));
if (recusados.length) console.log('recusados: ' + recusados.join(', '));
process.exit(sobreviventes.length || recusados.length ? 1 : 0);
