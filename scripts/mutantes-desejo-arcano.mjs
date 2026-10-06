/**
 * scripts/mutantes-desejo-arcano.mjs - a BATERIA DE MUTACAO do cartao do
 * Desejo Arcano na Config Idle (06/10/2026).
 *
 *   node scripts/mutantes-desejo-arcano.mjs [filtro-regex]
 *
 * O mesmo motor de `mutantes-abrir-todos-da-temporada.mjs`: cada mutante troca
 * UM trecho, roda os testes e devolve o arquivo no finally. Todo mutante tem
 * de MORRER; trecho que nao casa exatamente 1 vez NAO conta como morto.
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
const TESTES = ['tests/ui/desejoArcano.test.js'];

const F = 'src/UI/Components/IdleConfig/desejoArcano.js';
const J = 'src/UI/Components/IdleConfig/IdleConfig.js';
const C = 'src/UI/Components/IdleConfig/IdleConfig.css';

const MUTANTES = [
	['DA1 o cartao aparece sem o contexto', F, "\treturn !!(d && Array.isArray(d.magias) && typeof d.chance === 'number');", '\treturn true;'],
	[
		'DA2 a escolhida fora do menu fica marcada',
		F,
		'\tif (typeof v === \'string\' && (v === SEGUIR_A_RECOMENDACAO || magias.some(m => m.magia === v))) {',
		"\tif (typeof v === 'string') {"
	],
	['DA3 o menu vazio desenha o seletor', F, '\tif (d.magias.length === 0 || !d.efetiva) {', '\tif (!d.efetiva) {'],
	['DA4 o selo vai a todas as magias', F, "\t\t\tconst recomendada = rec && rec.magia === m.magia;", '\t\t\tconst recomendada = true;'],
	['DA5 o aviso de indisponivel nunca aparece', F, '\tconst aviso = d.escolhidaIndisponivel', '\tconst aviso = false'],
	['DA6 a magia que sai e a recomendada, e nao a efetiva', F, '<span class="ri-badge ri-badge--verde">${nome(d.efetiva.magia)}</span>', '<span class="ri-badge ri-badge--verde">${nome(rec.magia)}</span>'],
	['DA7 a aba Ataque nao desenha o cartao', J, '\t\t${htmlDoDesejoArcano({ cfg, ctx, escapar: escapeHtml, nomeDaSkill })}\n', ''],
	['DA8 o celular perde os 44px', C, '\t#IdleConfig .ic-seg--desejo .ic-seg-btn {\n\t\tmin-height: var(--hit-touch, 44px);', '\t#IdleConfig .ic-seg--desejo .ic-seg-btn {\n\t\tmin-height: 24px;']
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
