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
 *   testador nao tem o que fazer com ele; alem disso e ali que esta o
 *   FORMULARIO de cadastro (D-542), que nao existe na tela de login.
 * - `applications/deploy/vercel.json` -> os cabecalhos de cache. Sem ele o
 *   `Config.local.js` deixa de ser `no-cache`, e o testador fica com endereco
 *   de tunel velho em cache justamente quando ele muda.
 *
 * Os tres sao copiados DEPOIS do build de proposito: o build limpa o `dist`.
 *
 * ---------------------------------------------------------------------------
 * O PROJETO DO VERCEL NAO PODE FICAR CONECTADO AO GIT (24/08/2026, D-543)
 * ---------------------------------------------------------------------------
 * O `rag-idle-v0` nasceu conectado ao `jonathasmoraes01/ragidle-client`, e cada
 * push para `master` disparava um build automatico na Vercel. Esse build roda
 * na RAIZ do repositorio, nao aqui — sobe vazio e TOMA O ALIAS DE PRODUCAO. A
 * v0 caiu duas vezes em 24/08 por isso, e as duas vezes o sintoma foi
 * `404: NOT_FOUND` na URL publica, minutos depois de um deploy manual que
 * tinha sido provado 7/7.
 *
 * E nao ha configuracao de build que conserte, porque o pacote publicado
 * depende de `applications/deploy/Config.local.js`, que e IGNORADO PELO GIT de
 * proposito (as URLs de tunel gratuito mudam a cada reinicio do `cloudflared`).
 * Um build a partir do repositorio nunca teria esse arquivo.
 *
 * O projeto foi DESCONECTADO (`vercel git disconnect`). Se alguem reconectar,
 * a v0 volta a cair no push seguinte.
 *
 * Uso:  node oraculo/preparar-deploy.mjs
 *       npx vercel deploy dist/Web --prod     (o `.vercel` mora em dist/Web)
 */

import { execFileSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(RAIZ, 'dist', 'Web');
const FONTES = join(RAIZ, 'applications', 'deploy');
const PUBLICO = join(RAIZ, 'public');

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

console.log('1/5  build do cliente (leva alguns minutos)...');
execFileSync('node', ['./applications/tools/builder-web.mjs'], { cwd: RAIZ, stdio: 'inherit' });

console.log('\n2/5  tirando os visualizadores...');
for (const arquivo of VISUALIZADORES) {
	const caminho = join(DIST, arquivo);
	if (existsSync(caminho)) {
		rmSync(caminho);
		console.log(`     - ${arquivo}`);
	}
}

/*
 * A ARTE DA INTERFACE (`public/ragidle`), e por que ela precisa de um passo.
 *
 * Sao ~30 MB de arte NOSSA — icones do dock, minimapas do teleporte, retratos
 * de mob e de classe, icones de item e de skill, telas de carregamento. No
 * localhost quem serve isso e o vite, direto de `public/`, no caminho
 * `/ragidle/...`; o codigo (e o CSS) pede sempre por esse caminho ABSOLUTO.
 *
 * O `builder-web.mjs` desliga `copyPublicDir` de proposito — sem isso os 30 MB
 * seriam copiados uma vez para CADA um dos sete aplicativos. So que ninguem os
 * copiava no fim, e o `dist/Web` saia sem a pasta.
 *
 * O resultado em producao: todo `<img src="/ragidle/...">` dava 404, e o
 * `onerror="this.style.display=none"` que o proprio codigo poe ESCONDIA a
 * falha. O jogo carregava, entrava no mapa e jogava — sem icone nenhum e com o
 * teleporte mostrando cartoes sem miniatura de mapa. Queixa do dono em 24/08.
 *
 * A licao: `onerror` que esconde transforma asset faltando em "a tela ficou
 * meio vazia", que ninguem reporta como erro — e a prova de tela passava,
 * porque ela media o mapa carregado e nao a interface vestida.
 */
console.log('\n' + '3/5  copiando a arte da interface (public/ragidle)...');
cpSync(PUBLICO, DIST, { recursive: true });
for (const pasta of readdirSync(join(DIST, 'ragidle'))) {
	const quantos = readdirSync(join(DIST, 'ragidle', pasta)).length;
	console.log(`     ${pasta.padEnd(12)} ${String(quantos).padStart(5)} arquivo(s)`);
}

console.log('\n' + '4/5  copiando a configuracao e a porta de entrada da v0...');
copyFileSync(join(FONTES, 'Config.local.js'), join(DIST, 'Config.local.js'));
copyFileSync(join(FONTES, 'index.html'), join(DIST, 'index.html'));
copyFileSync(join(FONTES, 'vercel.json'), join(DIST, 'vercel.json'));
console.log('     Config.local.js  (enderecos dos tuneis)');
console.log('     index.html       (como se cadastrar)');
console.log('     vercel.json      (cabecalhos de cache)');

console.log('\n5/5  conferindo...');
const faltando = OBRIGATORIOS.filter((a) => !existsSync(join(DIST, a)));
if (faltando.length > 0) {
	console.error(`
DEPLOY INCOMPLETO — faltam: ${faltando.join(', ')}`);
	process.exit(1);
}
// A configuracao ainda aponta para o roBrowser publico? Entao a copia falhou.
const config = (await import('node:fs')).readFileSync(join(DIST, 'Config.local.js'), 'utf8');
if (!config.includes('socketProxy')) {
	console.error('\nConfig.local.js sem `socketProxy` — o cliente nao saberia com quem falar.');
	process.exit(1);
}

/*
 * A arte chegou? Conferido por AMOSTRA de cada pasta, e nao pela existencia da
 * pasta: um `ragidle/` vazio passaria por uma checagem de pasta e reproduziria
 * exatamente o defeito de 24/08.
 */
const PASTAS_DE_ARTE = [
	'classes',
	'collection',
	'dock-icons',
	'item',
	'loading',
	'login',
	'minimapas',
	'mobs',
	'skills',
];
const semArte = PASTAS_DE_ARTE.filter((pasta) => {
	const caminho = join(DIST, 'ragidle', pasta);
	return !existsSync(caminho) || readdirSync(caminho).length === 0;
});
if (semArte.length > 0) {
	console.error(`\nARTE FALTANDO em ragidle/: ${semArte.join(', ')}`);
	console.error('Em producao isso vira icone sumido — e o `onerror` do codigo esconde.');
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
