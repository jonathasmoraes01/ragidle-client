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
 * - `applications/deploy/index.html` -> a porta de entrada do JOGO, hoje em
 *   `/jogo/`. O `index.html` do build e um menu que abre os visualizadores em
 *   popup, e o testador nao tem o que fazer com ele; alem disso e ali que
 *   esta o FORMULARIO de cadastro (D-542), que nao existe na tela de login.
 * - `applications/deploy/vercel.json` -> os cabecalhos de cache. Sem ele o
 *   `Config.local.js` deixa de ser `no-cache`, e o testador fica com endereco
 *   de tunel velho em cache justamente quando ele muda.
 *
 *   **`Online.js` E COMPANHIA NAO PODEM SER `immutable` (30/08/2026).** Ate
 *   hoje a regra deles era `max-age=31536000, immutable`, e os quatro tem NOME
 *   FIXO entre builds (este pipeline escreve `Online.js`, sem hash de
 *   conteudo). `immutable` manda o navegador nem REVALIDAR: o bundle velho
 *   ficava servido por um ANO. O sintoma chegou como *"zerou os stats de todas
 *   as contas"* — a janela de Status ficou no esqueleto do HTML (atributos 1,
 *   derivados 0), porque o cliente v1 em cache nao sabe ler a ficha **v2** que
 *   o servidor novo manda, e a guarda de versao dele recusa em silencio. Nada
 *   tinha sido zerado: o save estava intacto.
 *
 *   O conserto e em DOIS niveis, e os dois sao necessarios:
 *   1. o cabecalho virou `max-age=0, must-revalidate` (para nao repetir);
 *   2. o `api.html` carrega `Online.js?v=<build>` (`builder-web.mjs`), porque
 *      mudar o cabecalho **nao resgata quem ja tem a copia `immutable` presa** —
 *      esse navegador nao pergunta. Trocar a URL e a unica coisa que alcanca
 *      esses, e o `api.html` e `no-cache`, entao ele sempre rebaixa.
 *
 *   `immutable` so e seguro com nome versionado por conteudo. Se algum dia o
 *   builder passar a emitir `Online.<hash>.js`, a regra antiga volta a valer.
 * - `../rag-idle-site` (repo IRMAO, `marcoslourencoads-svg/rag-idle-site`) ->
 *   a RAIZ do pacote. Desde 26/08 a v0 abre no site de entrada, com "Jogar" e
 *   "Cadastrar" apontando para `/jogo/`; o antigo `index.html` do jogo mudou
 *   de lugar por isso (item acima).
 *
 * Os quatro sao copiados DEPOIS do build de proposito: o build limpa o `dist`.
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
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(RAIZ, 'dist', 'Web');
const FONTES = join(RAIZ, 'applications', 'deploy');
const PUBLICO = join(RAIZ, 'public');
const SITE = resolve(RAIZ, '..', 'rag-idle-site');

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

console.log('1/6  build do cliente (leva alguns minutos)...');
execFileSync('node', ['./applications/tools/builder-web.mjs'], { cwd: RAIZ, stdio: 'inherit' });

console.log('\n2/6  tirando os visualizadores...');
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
console.log('\n' + '3/6  copiando a arte da interface (public/ragidle)...');
cpSync(PUBLICO, DIST, { recursive: true });
/*
 * O RELATORIO PRECISA ACEITAR ARQUIVO SOLTO, e nao so pasta.
 *
 * Ate 02/09 tudo em `public/ragidle` era pasta, e o laco fazia `readdirSync`
 * em cada entrada. D-919 pos o primeiro arquivo na raiz
 * (`fichas-de-item.json`, o peso e a raridade que a loja le) e o preparo
 * MORREU com ENOTDIR — o `cpSync` acima ja tinha copiado tudo certo, entao o
 * que quebrou foi so a contagem, mas quebrou o deploy inteiro junto.
 *
 * A licao e a de sempre com relatorio: ele nao pode ser mais exigente com a
 * arvore do que o passo que ele descreve.
 */
for (const entrada of readdirSync(join(DIST, 'ragidle'), { withFileTypes: true })) {
	const rotulo = entrada.name.padEnd(20);
	if (entrada.isDirectory()) {
		const quantos = readdirSync(join(DIST, 'ragidle', entrada.name)).length;
		console.log(`     ${rotulo} ${String(quantos).padStart(5)} arquivo(s)`);
	} else {
		const kb = Math.round(statSync(join(DIST, 'ragidle', entrada.name)).size / 1024);
		console.log(`     ${rotulo} ${String(kb).padStart(5)} KB`);
	}
}

console.log('\n' + '4/6  copiando a configuracao e a porta de entrada do jogo (/jogo)...');
const DIST_JOGO = join(DIST, 'jogo');
mkdirSync(DIST_JOGO, { recursive: true });
copyFileSync(join(FONTES, 'Config.local.js'), join(DIST, 'Config.local.js'));
copyFileSync(join(FONTES, 'index.html'), join(DIST_JOGO, 'index.html'));
copyFileSync(join(FONTES, 'vercel.json'), join(DIST, 'vercel.json'));
console.log('     Config.local.js  (enderecos dos tuneis)');
console.log('     jogo/index.html  (como se cadastrar)');
console.log('     vercel.json      (cabecalhos de cache)');

/*
 * O SITE DE ENTRADA (`../rag-idle-site`, repo irmao) VIRA A RAIZ.
 *
 * So os arquivos que o navegador serve: `index.html`, `css/`, `js/`,
 * `assets/`. Ficam de fora `.git`, `README.md`, `DESIGN-SYSTEM.md` e
 * `design-system.html` — sao documentacao interna (a segunda cita, com
 * todas as letras, o que no conteudo publico era placeholder), e o
 * `vercel.json` proprio do site, ja fundido no de `applications/deploy`.
 */
console.log('\n' + '5/6  copiando o site de entrada (../rag-idle-site)...');
if (!existsSync(SITE)) {
	console.error(`\nSITE NAO ENCONTRADO em ${SITE}`);
	console.error('Clone github.com/marcoslourencoads-svg/rag-idle-site como pasta irma de ragidle-client.');
	process.exit(1);
}
copyFileSync(join(SITE, 'index.html'), join(DIST, 'index.html'));
for (const pasta of ['css', 'js', 'assets']) {
	/*
	 * LIMPA antes de copiar: `cpSync` recursivo so SOBREPOE, nunca remove.
	 * Um arquivo apagado do lado do site (ex.: `js/auth.js` em 26/08) ficava
	 * PARA TRAS de um deploy para o outro, porque o `dist/Web` de uma corrida
	 * anterior nunca era limpo aqui — so o build dos 7 aplicativos limpa o
	 * que e dele.
	 */
	rmSync(join(DIST, pasta), { recursive: true, force: true });
	cpSync(join(SITE, pasta), join(DIST, pasta), { recursive: true });
	console.log(`     ${pasta}/`);
}
console.log('     index.html       (a home)');

console.log('\n6/6  conferindo...');
const faltando = [...OBRIGATORIOS, 'jogo/index.html'].filter((a) => !existsSync(join(DIST, a)));
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
for (const a of [...OBRIGATORIOS, 'Config.js', 'Config.local.js', 'index.html', 'jogo/index.html']) {
	bytes += statSync(join(DIST, a)).size;
}
console.log(`     ok — ${(bytes / 1024 / 1024).toFixed(1)} MB nos arquivos principais`);
console.log(`
Pronto: ${DIST}`);
console.log('Publicar:  npx vercel deploy dist/Web --prod');
