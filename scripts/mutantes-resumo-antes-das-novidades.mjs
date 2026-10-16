/**
 * scripts/mutantes-resumo-antes-das-novidades.mjs - o LACO da bateria do resumo
 * da volta antes da "Novidades" (16/10/2026, D-2595).
 *
 *   node scripts/mutantes-resumo-antes-das-novidades.mjs [filtro-regex]
 *
 * Duas listas (`tests/mutantes/resumo-antes-das-novidades.config.mjs`):
 *   - `mutantes`: so na memoria do Vitest (a fila e o cartaz, que o teste importa);
 *   - `COSTURAS_NO_DISCO`: as tres costuras que o teste le do disco (o popup do
 *     sono no UIManager, a janela da ausencia, o tutorial). Estas escrevem o
 *     arquivo mutado e o RESTAURAM POR COPIA no `finally` (nunca `git checkout`):
 *     nao rode com o Vite desta worktree servindo o cliente.
 * O trecho que nao casa exatamente uma vez e RECUSADO (conta como falha), e o
 * controle (sem mutante) roda primeiro e tem de passar.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VITEST = [
	resolve(RAIZ, 'node_modules/vitest/vitest.mjs'),
	resolve(RAIZ, '../../../node_modules/vitest/vitest.mjs')
].find(p => existsSync(p));
const CONFIG = 'tests/mutantes/resumo-antes-das-novidades.config.mjs';
const { mutantes, COSTURAS_NO_DISCO } = await import(pathToFileURL(resolve(RAIZ, CONFIG)).href);

function rodar(nome) {
	const r = spawnSync(process.execPath, [VITEST, 'run', '--config', CONFIG], {
		cwd: RAIZ,
		env: { ...process.env, RAG_MUTANTE_RESUMO: nome },
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

function veredito(nome, r) {
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

for (const [nome, [alvo, de]] of Object.entries(mutantes)) {
	if (SO && !SO.test(nome)) continue;
	const texto = readFileSync(resolve(RAIZ, alvo), 'utf8').replace(/\r\n/g, '\n');
	if (texto.split(de).length !== 2) {
		recusados.push(nome);
		console.log(`RECUSADO  ${nome} (o trecho nao casa exatamente uma vez em ${alvo})`);
		continue;
	}
	veredito(nome, rodar(nome));
}

for (const [nome, [alvo, de, para]] of Object.entries(COSTURAS_NO_DISCO)) {
	if (SO && !SO.test(nome)) continue;
	const caminho = resolve(RAIZ, alvo);
	const original = readFileSync(caminho, 'utf8');
	const crlf = original.includes('\r\n');
	const normal = original.replace(/\r\n/g, '\n');
	if (normal.split(de).length !== 2) {
		recusados.push(nome);
		console.log(`RECUSADO  ${nome} (o trecho nao casa exatamente uma vez em ${alvo})`);
		continue;
	}
	let mutado = normal.replace(de, () => para);
	if (crlf) mutado = mutado.replace(/\n/g, '\r\n');
	try {
		writeFileSync(caminho, mutado, 'utf8');
		veredito(nome + ' (disco)', rodar(''));
	} finally {
		writeFileSync(caminho, original, 'utf8');
	}
	if (readFileSync(caminho, 'utf8') !== original) {
		console.error(`O RESTAURO de ${alvo} FALHOU: confira o arquivo antes de qualquer outra coisa.`);
		process.exit(3);
	}
}

const total = mortos.length + sobreviventes.length + recusados.length;
console.log(`\n${mortos.length}/${total} mortos · ${sobreviventes.length} sobreviventes · ${recusados.length} recusados`);
if (sobreviventes.length) console.log('sobreviventes: ' + sobreviventes.join(', '));
if (recusados.length) console.log('recusados: ' + recusados.join(', '));
process.exit(sobreviventes.length || recusados.length ? 1 : 0);
