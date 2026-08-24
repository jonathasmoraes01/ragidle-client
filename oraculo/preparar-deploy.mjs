/**
 * PREPARAR O DEPLOY DA v0 — o `dist/Web` que vai para o Vercel.
 *
 * ---------------------------------------------------------------------------
 * O QUE ESTE SCRIPT FAZ, E POR QUE NAO E SO `npm run build`
 * ---------------------------------------------------------------------------
 * `npm run build` monta os SETE aplicativos do roBrowser (o jogo e seis
 * visualizadores de ferramenta: mapa, GRF, modelo, STR, granny, efeito). Cada
 * um sai com ~13 MB, e o `dist` inteiro passa de 90 MB — a maior parte disso
 * e ferramenta de desenvolvimento que nenhum testador da v0 vai abrir.
 *
 * Aqui o `dist` fica com o JOGO e o que ele precisa em tempo de execucao
 * (`Online.js`, `ThreadEventHandler.js`, `PathFindingWorker.js`), o que derruba
 * o pacote para ~20 MB.
 *
 * ---------------------------------------------------------------------------
 * E O QUE ELE COPIA POR CIMA
 * ---------------------------------------------------------------------------
 * - `applications/deploy/Config.local.js` -> os enderecos dos tuneis. O
 *   `Config.js` gerado pelo build traz os padroes do roBrowser publico
 *   (`connect.robrowser.com`, `grf.robrowser.com`); sem esta copia o cliente
 *   publicado tentaria o servidor de outra pessoa.
 * - `applications/deploy/index.html` -> a porta de entrada da v0. O
 *   `index.html` do build e um menu que abre os visualizadores em popup, e o
 *   testador nao tem o que fazer com ele; alem disso e ali que esta escrito
 *   como se CADASTRAR (o sufixo `_M`/`_F`, D-539), que nao esta em lugar
 *   nenhum da tela de login.
 *
 * Os dois sao copiados DEPOIS do build de proposito: o build limpa o `dist`.
 *
 * Uso:  node oraculo/preparar-deploy.mjs
 */

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, rmSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(RAIZ, 'dist', 'Web');
const FONTES = join(RAIZ, 'applications', 'deploy');

/** Os visualizadores: ferramenta de dev, fora do pacote publico. */
const VISUALIZADORES = [
	'MapViewer.js',
	'GrfViewer.js',
	'ModelViewer.js',
	'StrViewer.js',
	'GrannyModelViewer.js',
	'EffectViewer.js'
];

/** O que o JOGO precisa para funcionar — se faltar, o deploy sai quebrado. */
const OBRIGATORIOS = ['Online.js', 'ThreadEventHandler.js', 'PathFindingWorker.js', 'api.html', 'api.js'];

console.log('1/4  build do cliente (leva alguns minutos)...');
execFileSync('node', ['./applications/tools/builder-web.mjs'], { cwd: RAIZ, stdio: 'inherit' });

console.log('
2/4  tirando os visualizadores...');
for (const arquivo of VISUALIZADORES) {
	const caminho = join(DIST, arquivo);
	if (existsSync(caminho)) {
		rmSync(caminho);
		console.log(`     - ${arquivo}`);
	}
}

console.log('
3/4  copiando a configuracao e a porta de entrada da v0...');
copyFileSync(join(FONTES, 'Config.local.js'), join(DIST, 'Config.local.js'));
copyFileSync(join(FONTES, 'index.html'), join(DIST, 'index.html'));
console.log('     Config.local.js  (enderecos dos tuneis)');
console.log('     index.html       (como se cadastrar)');

console.log('
4/4  conferindo...');
const faltando = OBRIGATORIOS.filter((a) => !existsSync(join(DIST, a)));
if (faltando.length > 0) {
	console.error(`
DEPLOY INCOMPLETO — faltam: ${faltando.join(', ')}`);
	process.exit(1);
}
// A configuracao ainda aponta para o roBrowser publico? Entao a copia falhou.
const config = (await import('node:fs')).readFileSync(join(DIST, 'Config.local.js'), 'utf8');
if (!config.includes('socketProxy')) {
	console.error('
Config.local.js sem `socketProxy` — o cliente nao saberia com quem falar.');
	process.exit(1);
}

let bytes = 0;
for (const a of [...OBRIGATORIOS, 'Config.js', 'Config.local.js', 'index.html']) {
	bytes += statSync(join(DIST, a)).size;
}
console.log(`     ok — ${(bytes / 1024 / 1024).toFixed(1)} MB nos arquivos principais`);
console.log(`
Pronto: ${DIST}`);
console.log('Publicar:  npx vercel deploy dist/Web --prod');
