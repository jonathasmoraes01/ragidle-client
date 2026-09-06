/* eslint-disable */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const pkg = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url)));

const startTime = Date.now();
const args = getArgs();

const buildDate = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
const dist = './dist/';
const platform = 'Web';

// Aliases (same as vite.config.js)
const aliases = {
	App: path.resolve(__dirname, '../../src/App'),
	Audio: path.resolve(__dirname, '../../src/Audio'),
	Controls: path.resolve(__dirname, '../../src/Controls'),
	Core: path.resolve(__dirname, '../../src/Core'),
	DB: path.resolve(__dirname, '../../src/DB'),
	Engine: path.resolve(__dirname, '../../src/Engine'),
	Loaders: path.resolve(__dirname, '../../src/Loaders'),
	Network: path.resolve(__dirname, '../../src/Network'),
	Plugins: path.resolve(__dirname, '../../src/Plugins'),
	Preferences: path.resolve(__dirname, '../../src/Preferences'),
	Renderer: path.resolve(__dirname, '../../src/Renderer'),
	UI: path.resolve(__dirname, '../../src/UI'),
	Utils: path.resolve(__dirname, '../../src/Utils'),
	Vendors: path.resolve(__dirname, '../../src/Vendors')
};

const header = [
	'/*',
	' * Build with RONW Builder [MrUnzO] (https://github.com/MrUnzO/RONW)',
	' * ',
	' * This file is part of ROBrowser, (http://www.robrowser.com/).',
	' * @author Vincent Thibault and the community',
	' */\n'
].join('\n');

// Map appName to entry file path (relative to project root)
const entryMap = {
	ThreadEventHandler: 'src/Core/ThreadEventHandler.js',
	GrannyModelViewer: 'src/App/GrannyModelViewer.js',
	GrfViewer: 'src/App/GrfViewer.js',
	MapViewer: 'src/App/MapViewer.js',
	ModelViewer: 'src/App/ModelViewer.js',
	Online: 'src/App/Online.js',
	StrViewer: 'src/App/StrViewer.js',
	EffectViewer: 'src/App/EffectViewer.js'
};

(async function build() {
	const basePath = dist + platform;

	const modules = {
		G: { path: '/GrannyModelViewer.js', action: () => compile('GrannyModelViewer', args['m']) },
		D: { path: '/GrfViewer.js', action: () => compile('GrfViewer', args['m']) },
		V: { path: '/MapViewer.js', action: () => compile('MapViewer', args['m']) },
		M: { path: '/ModelViewer.js', action: () => compile('ModelViewer', args['m']) },
		O: { path: '/Online.js', action: () => compile('Online', args['m']) },
		S: { path: '/StrViewer.js', action: () => compile('StrViewer', args['m']) },
		E: { path: '/EffectViewer.js', action: () => compile('EffectViewer', args['m']) },
		T: { path: '/ThreadEventHandler.js', action: () => compile('ThreadEventHandler', args['m']) },
		H: { path: '/index.html', action: () => createHTML(false, args, isAll) },
		PWA: {
			path: '/index.html',
			action: async () => {
				createHTML(true, args, isAll);
				await copyPwaFiles();
			}
		}
	};

	// Ensure base directories exist
	if (!fs.existsSync(dist)) {
		fs.mkdirSync(dist);
	}
	if (!fs.existsSync(basePath)) {
		fs.mkdirSync(basePath);
	}

	// Filter and process only necessary modules
	const isAll = args['all'] || Object.keys(args).length === 0;
	const activeModules = Object.keys(modules).filter(key => isAll || args[key]);

	for (const key of activeModules) {
		const { path: modPath, action } = modules[key];
		const fullPath = `${basePath}${modPath}`;
		if (fs.existsSync(fullPath)) {
			fs.rmSync(fullPath, { recursive: true, force: true });
		}
		await action();
	}
})();

async function compile(appName, isMinify) {
	console.log(appName + '.js', '- Compiling...', '[ Minify:', isMinify ? 'true' : 'false', ']');

	const { build } = await import('vite');
	const projectRoot = path.resolve(__dirname, '../../');
	const entry = path.resolve(projectRoot, entryMap[appName]);
	const outDir = path.resolve(projectRoot, dist + platform);

	try {
		await build({
			configFile: false,
			root: projectRoot,
			base: './',
			logLevel: 'warn',
			resolve: {
				alias: aliases
			},
			worker: {
				rollupOptions: {
					output: {
						entryFileNames: '[name].js'
					}
				}
			},
			build: {
				outDir: outDir,
				emptyOutDir: false,
				assetsInlineLimit: 1024 * 1024,
				rollupOptions: {
					input: entry,
					output: {
						format: 'es',
						entryFileNames: appName + '.js', //Online -> Online.js
						codeSplitting: false,
						banner: header
					},
					onwarn(warning, warn) {
						if (warning.code === 'PLUGIN_TIMINGS') {
							// just appears if vite spending much time to compile css and assets
							return;
						}
						warn(warning);
					}
				},
				minify: isMinify ? 'terser' : false,
				terserOptions: isMinify
					? {
							format: {
								ascii_only: true,
								comments: false
							}
						}
					: undefined,
				// Don't copy public assets for each module build
				copyPublicDir: false
			}
		});

		console.log(appName + '.js has been created in', Date.now() - startTime, 'ms.');
	} catch (err) {
		console.error('Error building ' + appName + ':', err);
	}
}

function createHTML(includeManifest = false, buildArgs = {}, isAllBuild = false) {
	const start = Date.now();
	const manifest = includeManifest ? `<link rel="manifest" href="./manifest.webmanifest">` : ``;

	const appButtonMap = [
		{ flag: 'O', app: 'ONLINE', label: 'Online' },
		{ flag: 'G', app: 'GRANNYMODELVIEWER', label: 'Granny Model Viewer' },
		{ flag: 'D', app: 'GRFVIEWER', label: 'GRF Viewer' },
		{ flag: 'V', app: 'MAPVIEWER', label: 'Map Viewer' },
		{ flag: 'M', app: 'MODELVIEWER', label: 'Model Viewer' },
		{ flag: 'S', app: 'STRVIEWER', label: 'STR Viewer' },
		{ flag: 'E', app: 'EFFECTVIEWER', label: 'Effect Viewer' }
	];

	const viewerFlags = appButtonMap.filter(v => v.flag !== 'O').map(v => v.flag);
	const hasViewerFlags = isAllBuild || viewerFlags.some(flag => buildArgs[flag]);

	const commonHead = `<!DOCTYPE html>    
<html>    
    <head>    
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>    
        <meta charset="UTF-8">    
        <title>Ragnarok Classic Idle [${pkg.version} - ${buildDate}]</title>
        <link rel="icon" type="image/png" href="./icon.png">    
    
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">    
        <meta name="HandheldFriendly" content="true">    
    
        <meta name="apple-mobile-web-app-capable" content="yes">    
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">    
        <meta name="apple-mobile-web-app-title" content="roBrowser">    
        <meta name="mobile-web-app-capable" content="yes">    
    
        <meta name="description" content="roBrowser">    
        <meta name="keywords" content="roBrowser">    
        <meta name="author" content="roBrowser">    
        <meta name="robots" content="index">    
    
        <meta name="theme-color" content="#ff8cb5">    
    
        <meta property="og:title" content="roBrowser">    
        <meta property="og:description" content="roBrowser">    
        <meta property="og:type" content="website">    
        <meta property="og:locale" content="en_US">    
    
        <link rel="apple-touch-icon" href="./icon.png">    
        ${manifest}
        ${includeManifest ? `<script src="./registrar-sw.js" defer></script>` : ``}`;

	let body;

	if (hasViewerFlags) {
		const activeViewers = appButtonMap.filter(v => isAllBuild || buildArgs[v.flag]);
		const buttons = activeViewers
			.map(v => `                <button class="app-btn" onclick="launchApp('${v.app}')">${v.label}</button>`)
			.join('\n');

		/* O `api.html` herda a decisao de manifesto do `index.html`: quem
		   builda com `--PWA` (ou sem argumento nenhum, que e `--all`) copia o
		   `manifest.webmanifest` para o `dist` em `copyPwaFiles()`, e so ai o
		   `<link rel="manifest">` daqui aponta para um arquivo que existe. */
		createApiHTML(includeManifest);

		body = `${commonHead}    
  
        <style>    
            html, body {    
                margin: 0; padding: 0; border: 0;    
                height: 100%; width: 100%; overflow: hidden;    
            }    
            #ro-preloader {    
                position: fixed;    
                top: 0; left: 0;    
                width: 100%; height: 100%;    
                z-index: 99999;    
                background: rgba(6, 8, 16, 0.97);    
                display: flex;    
                align-items: center;    
                justify-content: center;    
                flex-direction: column;    
            }    
            #ro-preloader .pre-spinner {    
                width: 48px; height: 48px;    
                margin: 0 auto 16px;    
                border: 4px solid rgba(232, 184, 75, 0.2);    
                border-top-color: #e8b84b;    
                border-radius: 50%;    
                animation: ro-pre-spin 0.8s linear infinite;    
            }    
            #ro-preloader .pre-text {    
                font-family: serif;    
                font-size: 16px;    
                letter-spacing: 3px;    
                text-transform: uppercase;    
                color: #e8b84b;    
            }    
            #ro-preloader .pre-text span {    
                display: inline-block;    
                animation: ro-pre-wave 1.2s ease-in-out infinite;    
                animation-delay: calc(var(--i) * 0.08s);    
            }    
            @keyframes ro-pre-spin {    
                to { transform: rotate(360deg); }    
            }    
            @keyframes ro-pre-wave {    
                0%, 60%, 100% { transform: translateY(0); }    
                30% { transform: translateY(-8px); }    
            }    
            #ro-preloader.fade-out {    
                opacity: 0;    
                transition: opacity 0.3s ease;    
            }    
            .app-launcher {    
                display: flex;    
                flex-direction: column;    
                align-items: center;    
                justify-content: center;    
                min-height: 100vh;    
                background: rgba(6, 8, 16, 0.97);    
                font-family: serif;    
                color: #e8b84b;    
            }    
            .app-launcher h1 {    
                font-size: 28px;    
                letter-spacing: 3px;    
                text-transform: uppercase;    
                margin-bottom: 32px;    
            }    
            .button-grid {    
                display: flex;    
                flex-wrap: wrap;    
                gap: 16px;    
                justify-content: center;    
                max-width: 600px;    
            }    
            .app-btn {    
                padding: 14px 28px;    
                font-family: serif;    
                font-size: 16px;    
                letter-spacing: 2px;    
                color: #e8b84b;    
                background: transparent;    
                border: 2px solid rgba(232, 184, 75, 0.4);    
                border-radius: 8px;    
                cursor: pointer;    
                transition: all 0.3s ease;    
            }    
            .app-btn:hover {    
                background: rgba(232, 184, 75, 0.15);    
                border-color: #e8b84b;    
            }    
        </style>    
    </head>    
    <body>    
        <div class="app-launcher">    
            <h1>roBrowser App Launcher</h1>    
            <div class="button-grid">    
${buttons}    
            </div>    
        </div>    
  
        <script type="text/javascript">    
            function launchApp(appName) {    
                var w = 800, h = 600;    
                var top = (screen.height - h) / 2;    
                var left = (screen.width - w) / 2;    
                window.open(    
                    'api.html?app=' + appName,    
                    '_blank',    
                    'width=' + w + ',height=' + h + ',top=' + top + ',left=' + left + ',menubar=0,toolbar=0,location=0,status=0,resizable=1,scrollbars=0'    
                );    
            }    
        </script>    
    </body>    
</html>    
`;
	} else {
		body = `${commonHead}    
  
        <style>    
            html, body {    
                margin: 0; padding: 0; border: 0;    
                height: 100%; width: 100%; overflow: hidden;    
            }    
            #ro-preloader {    
                position: fixed;    
                top: 0; left: 0;    
                width: 100%; height: 100%;    
                z-index: 99999;    
                background: rgba(6, 8, 16, 0.97);    
                display: flex;    
                align-items: center;    
                justify-content: center;    
                flex-direction: column;    
            }    
            #ro-preloader .pre-spinner {    
                width: 48px; height: 48px;    
                margin: 0 auto 16px;    
                border: 4px solid rgba(232, 184, 75, 0.2);    
                border-top-color: #e8b84b;    
                border-radius: 50%;    
                animation: ro-pre-spin 0.8s linear infinite;    
            }    
            #ro-preloader .pre-text {    
                font-family: serif;    
                font-size: 16px;    
                letter-spacing: 3px;    
                text-transform: uppercase;    
                color: #e8b84b;    
            }    
            #ro-preloader .pre-text span {    
                display: inline-block;    
                animation: ro-pre-wave 1.2s ease-in-out infinite;    
                animation-delay: calc(var(--i) * 0.08s);    
            }    
            @keyframes ro-pre-spin {    
                to { transform: rotate(360deg); }    
            }    
            @keyframes ro-pre-wave {    
                0%, 60%, 100% { transform: translateY(0); }    
                30% { transform: translateY(-8px); }    
            }    
            #ro-preloader.fade-out {    
                opacity: 0;    
                transition: opacity 0.3s ease;    
            }    
        </style>    
    </head>    
    <body>    
        <div id="ro-preloader">    
            <div class="pre-spinner"></div>    
            <p class="pre-text">    
                <span style="--i:0">L</span><span style="--i:1">o</span><span style="--i:2">a</span><span style="--i:3">d</span><span style="--i:4">i</span><span style="--i:5">n</span><span style="--i:6">g</span><span style="--i:7">.</span><span style="--i:8">.</span><span style="--i:9">.</span>    
            </p>    
        </div>    
  
        <script src="Config.js"></script>    
        <script>    
            // Load optional Config.local.js for overrides (fails silently if not present)    
            window.ROConfigLocalReady = new Promise(function(resolve) {
                var script = document.createElement('script');    
                script.src = 'Config.local.js';    
                script.onload = resolve;
                script.onerror = function() {    
                    console.log('Config.local.js not found, using defaults from Config.js');    
                    resolve();
                };    
                document.head.appendChild(script);    
            });
        </script>    
        <script>    
            function deepMerge(target, source) {    
                for (var key in source) {    
                    if (source.hasOwnProperty(key)) {    
                        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {    
                            target[key] = deepMerge(target[key] || {}, source[key]);    
                        } else {    
                            target[key] = source[key];    
                        }    
                    }    
                }    
                return target;    
            }    
    
            window.addEventListener("load", async (event) => {
                await window.ROConfigLocalReady;
                // Merge Config.js defaults with Config.local.js overrides    
                var config = deepMerge({}, window.ROConfigBase || {});    
                if (window.ROConfigLocal) {    
                    config = deepMerge(config, window.ROConfigLocal);    
                }    
                window.ROConfig = config;    
    
				var script = document.createElement('script');
				script.type = 'module';
				// ?v=<build>: mesmo buster do api.html — nome de bundle fixo
				// com cache do navegador serve a versao velha para sempre.
				script.src = 'Online.js?v=${startTime}';
				document.getElementsByTagName('body')[0].appendChild(script);  
            });    
        </script>    
    </body>    
</html>    
`;
	}

	fs.writeFileSync(dist + platform + '/index.html', body, { encoding: 'utf8' });
	createConfigJS();
	console.log('index.html has been created in', Date.now() - start, 'ms.');
}

function createConfigJS() {
	const configContent = `/**  
 * ROBrowser Configuration - Default Settings  
 *  
 * This file contains default configuration values.  
 * To override settings without modifying this file, create Config.local.js  
 * with your custom values in window.ROConfigLocal.  
 *  
 * Example Config.local.js:  
 *   window.ROConfigLocal = {  
 *       servers: [{ display: 'My Server', address: '192.168.1.1', ... }],  
 *       skipIntro: true  
 *   };  
 */  
window.ROConfigBase = {  
    development: false,  
    remoteClient: 'https://grf.robrowser.com/',  
    servers: [{  
        display: 'roBrowser Demo Server',  
        desc: 'roBrowser demo server',  
        address: '127.0.0.1',  
        port: 6900,  
        version: 55,  
        langtype: 1,  
        packetver: 20130618,  
        renewal: false,  
        worldMapSettings: { episode: 12 },  
        packetKeys: false,  
        socketProxy: 'wss://connect.robrowser.com',  
        adminList: [2000000]  
    }],
    packetDump: false,  
    skipServerList: true,  
    skipIntro: false,  
    aura: {},  
    autoLogin: [],  
    BGMFileExtension: ['mp3'],  
    calculateHash: false,  
    CameraMaxZoomOut: 5,  
    charBlockSize: 0,  
    clientHash: null,  
    clientVersionMode: "PacketVer",  
    disableConsole: false,  
	enableAchievements: true,
    enableBank: true,  
    enableCashShop: true,  
    enableCheckAttendance: true,  
    enableDmgSuffix: true,  
    enableHomunAutoFeed: true,  
    enableMapName: true,  
    enableRefineUI: true,  
    enableRoulette: false,  
    FirstPersonCamera: false,  
    grfList: null,  
    hashFiles: [],  
    loadLua: false,  
    customItemInfo: [],  
    onReady: null,  
    plugins: {},  
    registrationweb: '',  
    saveFiles: true,  
    ThirdPersonCamera: false,  
    transitionDuration: 500,  
    restoreChatFocus: false
};  
`;
	fs.writeFileSync(dist + platform + '/Config.js', configContent, { encoding: 'utf8' });
}

/*
 * D-928 (05/09/2026) — O `<head>` DE PRODUCAO ESTAVA PELADO, E ISSO APAGAVA A
 * RESPONSIVIDADE INTEIRA DO JOGO NO CELULAR.
 *
 * `applications/deploy/vercel.json` roteia a raiz de `play.roclassicidle.com.br`
 * para ESTE arquivo (`api.html`) — nao para o `index.html` que o
 * `createHTML()` logo acima monta com o `<head>` completo. E o `<head>` daqui
 * tinha `charset`, `title` e o `<style>` do pre-carregador. Mais nada.
 *
 * SEM `<meta name="viewport">`, o navegador de celular assume o viewport de
 * compatibilidade de **980px** e encolhe a pagina inteira. Medido em
 * 05/09/2026 na URL real, com um Pixel 8 emulado (tela de 375px):
 *
 *   document.clientWidth .............. 980   (e nao 375)
 *   matchMedia('(max-width: 599px)') ... false
 *   matchMedia('(max-width: 899px)') ... false
 *
 * Ou seja: as tres faixas que a rodada I1+I2 de 31/08 escreveu no
 * `Common.css` (899/759/599) **nunca casaram num celular em producao**. O
 * conserto estava certo e estava desligado — quem testava local via
 * funcionar (o `dev` serve `applications/pwa/index.html`, que TEM o viewport)
 * e quem abria no celular via tudo minusculo. As duas observacoes eram
 * verdadeiras ao mesmo tempo, e essa e a forma mais cara de defeito que este
 * projeto ja registrou.
 *
 * O `<link rel="manifest">` vem pelo mesmo motivo: sem ele nao existe PWA
 * instalavel, por mais completo que o `manifest.webmanifest` esteja — e ele
 * estava completo e orfao desde sempre.
 *
 * `viewport-fit=cover` ENTROU em D-936, e a ordem importa: ele so podia
 * entrar DEPOIS do CSS que o acompanha. Sozinho, ele estende a pagina para
 * baixo do entalhe e da barra de gestos — e a HUD, que se ancora nos cantos,
 * passaria a correr por baixo dos dois. Com ele, `env(safe-area-inset-*)`
 * deixa de ser zero e os tokens `--safe-*` do `Common.css` passam a valer.
 *
 * Este comentario dizia "NAO entra aqui de proposito... e da Fase 2" enquanto
 * a linha logo abaixo ja o incluia — a Fase 2 chegou e o comentario ficou.
 *
 * O `theme_color` e `#060810` — o tom do proprio pre-carregador logo abaixo, e
 * do fundo escuro do jogo. O `#ff8cb5` que o `createHTML` usa e rosa, e e
 * heranca do template do roBrowser: nunca descreveu a arte deste jogo.
 */
function createApiHTML(includeManifest = false) {
	const manifest = includeManifest ? `<link rel="manifest" href="./manifest.webmanifest">` : ``;
	/* O registrador anda COM o manifesto: sem manifesto nao ha instalacao, e um
	   service worker sem instalacao seria so cache sem o resto do PWA. */
	const registrador = includeManifest ? `<script src="./registrar-sw.js" defer></script>` : ``;
	const apiHtml = `<!DOCTYPE html>
<html>
    <head>
        <meta charset="UTF-8">
        <title>Ragnarok Classic Idle</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
        <meta name="HandheldFriendly" content="true">
        <meta name="mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
        <meta name="apple-mobile-web-app-title" content="Ragnarok Classic Idle">
        <meta name="theme-color" content="#060810">
        <link rel="apple-touch-icon" href="./icon.png">
        ${manifest}
        ${registrador}
        <style>
            html, body {    
                margin: 0; padding: 0; border: 0;    
                height: 100%; width: 100%; overflow: hidden;    
            }    
            #ro-preloader {    
                position: fixed;    
                top: 0; left: 0;    
                width: 100%; height: 100%;    
                z-index: 99999;    
                background: rgba(6, 8, 16, 0.97);    
                display: flex;    
                align-items: center;    
                justify-content: center;    
                flex-direction: column;    
                gap: 18px;    
            }    
            .pre-spinner {    
                width: 48px; height: 48px;    
                border: 4px solid rgba(232, 184, 75, 0.2);    
                border-top-color: #e8b84b;    
                border-radius: 50%;    
                animation: ro-spin 0.8s linear infinite;    
            }    
            @keyframes ro-spin {    
                to { transform: rotate(360deg); }    
            }    
            .pre-text {    
                font-family: 'Cinzel', serif;    
                font-size: 16px;    
                letter-spacing: 3px;    
                text-transform: uppercase;    
                color: #e8b84b;    
                display: flex;    
                gap: 2px;    
            }    
            .pre-text span {    
                animation: ro-wave 1.2s ease-in-out infinite;    
                animation-delay: calc(var(--i) * 0.08s);    
            }    
            @keyframes ro-wave {    
                0%, 100% { opacity: 0.4; transform: translateY(0); }    
                50% { opacity: 1; transform: translateY(-4px); }    
            }    
        </style>    
        <script src="api.js"></script>    
    </head>    
    <body>    
        <div id="ro-preloader">    
            <div class="pre-spinner"></div>    
            <p class="pre-text">    
                <span style="--i:0">L</span><span style="--i:1">o</span><span style="--i:2">a</span><span style="--i:3">d</span><span style="--i:4">i</span><span style="--i:5">n</span><span style="--i:6">g</span><span style="--i:7">.</span><span style="--i:8">.</span><span style="--i:9">.</span>    
            </p>    
        </div>    
    
        <script src="Config.js"></script>    
        <script>    
            window.ROConfigLocalReady = new Promise(function(resolve) {
                var script = document.createElement('script');    
                script.src = 'Config.local.js';    
                script.onload = resolve;
                script.onerror = function() {    
                    console.log('Config.local.js not found, using defaults from Config.js');    
                    resolve();
                };    
                document.head.appendChild(script);    
            });
        </script>    
        <script>    
            function deepMerge(target, source) {    
                for (var key in source) {    
                    if (source.hasOwnProperty(key)) {    
                        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {    
                            target[key] = deepMerge(target[key] || {}, source[key]);    
                        } else {    
                            target[key] = source[key];    
                        }    
                    }    
                }    
                return target;    
            }    
    
            var APP_SCRIPTS = {    
                ONLINE: 'Online.js',    
                MAPVIEWER: 'MapViewer.js',    
                GRFVIEWER: 'GrfViewer.js',    
                MODELVIEWER: 'ModelViewer.js',    
                STRVIEWER: 'StrViewer.js',    
                GRANNYMODELVIEWER: 'GrannyModelViewer.js',    
                EFFECTVIEWER: 'EffectViewer.js'    
            };    
            var APP_IDS = { 1: 'ONLINE', 2: 'MAPVIEWER', 3: 'GRFVIEWER', 4: 'MODELVIEWER', 5: 'STRVIEWER', 6: 'GRANNYMODELVIEWER', 7: 'EFFECTVIEWER' };    
    
            function loadApp(appName, extraConfig) {    
                var scriptFile = APP_SCRIPTS[appName] || 'Online.js';    
                var config = deepMerge({}, window.ROConfigBase || {});    
                if (window.ROConfigLocal) { config = deepMerge(config, window.ROConfigLocal); }    
                if (extraConfig) { config = deepMerge(config, extraConfig); }    
                window.ROConfig = config;    
                // ?v=<build> — o BUSTER DE CACHE. Os bundles tem nome fixo
                // (Online.js), entao um navegador que guardou o arquivo antigo
                // continuaria servindo ele; a query muda a URL e forca a busca.
                // Isto resgata quem JA ficou preso: o api.html e no-cache e
                // sempre rebaixa, entao o ?v novo chega mesmo a esses.
                import('./' + scriptFile + '?v=${startTime}').then(function() {
                    var preloader = document.getElementById('ro-preloader');    
                    if (preloader) { preloader.remove(); }    
                }).catch(function(err) { console.error('Failed to load app:', scriptFile, err); });    
            }    
    
            window.addEventListener('load', async function() {
                await window.ROConfigLocalReady;
                var params = new URLSearchParams(window.location.search);    
                var appName = params.get('app');    
                if (appName) {    
                    loadApp(appName, null);    
                } else {    
                    window.addEventListener('message', function onMsg(event) {    
                        if (!event.data || typeof event.data !== 'object') return;    
                        if (!event.data.application) return;    
                        window.removeEventListener('message', onMsg, false);    
                        var name = APP_IDS[event.data.application] || 'ONLINE';    
                        loadApp(name, event.data);    
                        if (event.source) { event.source.postMessage('ready', '*'); }    
                    }, false);    
                }    
            });    
        </script>    
    </body>    
</html>    
`;
	fs.writeFileSync(dist + platform + '/api.html', apiHtml, { encoding: 'utf8' });
	fs.copyFileSync('./applications/api/api.js', dist + platform + '/api.js');
}

/**
 * D-933 (05/09/2026) — OS ARQUIVOS DO PWA, E POR QUE CADA UM MUDOU.
 *
 * --- ICONES ------------------------------------------------------------
 * O manifesto declarava UM icone de 144x144, e o arquivo em disco tem
 * **450x450** — a declaracao estava errada desde sempre. Pior: 144 fica
 * abaixo do minimo que Chrome e Android pedem para OFERECER a instalacao
 * (192), entao o jogo nao seria instalavel nem se a pagina linkasse o
 * manifesto.
 *
 * Agora saem quatro, gerados do MESMO arquivo de 450px (que tem resolucao de
 * sobra): 192 e 512 normais, e 192 e 512 `maskable`.
 *
 * O MASKABLE nao e capricho. O Android recorta o icone na forma do sistema
 * (circulo, "squircle", gota) e come ate 20% de cada borda. Um icone `any`
 * usado como mascara perde a arte nas pontas. A variante maskable tem a arte
 * encolhida para 60% e centrada sobre o fundo do jogo, entao qualquer
 * recorte razoavel cai no vazio e nao no desenho. Os 60% vem da "zona
 * segura" da especificacao: um circulo inscrito de 80% de diametro, mais
 * uma folga.
 *
 * --- CAPTURAS DE TELA --------------------------------------------------
 * As duas eram o PAPEL DE PAREDE da tela de Intro redimensionado por
 * `sharp` — nao uma captura do jogo. O cartao de instalacao mostrava uma
 * arte bonita que nao diz nada sobre o que o jogo e.
 *
 * Agora sao capturas REAIS, tiradas do jogo de pe pela matriz de resolucoes
 * desta frente: 1920x1080 no computador e 393x852 num celular. O fallback
 * para o papel de parede fica, para o build nao quebrar numa arvore que nao
 * tenha as duas.
 */
async function copyPwaFiles() {
	const start = Date.now();
	const sharp = (await import('sharp')).default;
	const origem = './applications/pwa/icon.png';
	const destino = dist + platform;
	const FUNDO = { r: 6, g: 8, b: 16, alpha: 1 }; // #060810, o mesmo do theme_color

	fs.copyFileSync(origem, destino + '/icon.png');
	fs.copyFileSync('./applications/pwa/manifest.webmanifest', destino + '/manifest.webmanifest');

	/*
	 * O SERVICE WORKER, com a VERSAO DO BUILD injetada.
	 *
	 * O nome do cache carrega essa versao (`ragidle-casca-<versao>`), e e assim
	 * que publicar troca o cache inteiro: o `activate` do worker novo apaga
	 * todo cache cujo nome nao seja o dele. Sem a injecao, o literal do
	 * arquivo-fonte ficaria congelado e o cache de duas publicacoes
	 * diferentes teria o MESMO nome — que e a definicao de servir arquivo
	 * velho para sempre.
	 *
	 * A versao e `<versao do package> + carimbo do build`, os dois numeros que
	 * o `createHTML` ja usa no `<title>`.
	 */
	const versaoDoBuild = pkg.version + '-' + buildDate.replace(/[^0-9]/g, '');
	const sw = fs.readFileSync('./applications/pwa/sw.js', 'utf8').replace('__VERSAO_DO_BUILD__', versaoDoBuild);
	fs.writeFileSync(destino + '/sw.js', sw, { encoding: 'utf8' });
	fs.copyFileSync('./applications/pwa/registrar-sw.js', destino + '/registrar-sw.js');

	for (const lado of [192, 512]) {
		await sharp(origem)
			.resize(lado, lado, { fit: 'contain', background: FUNDO })
			.png()
			.toFile(destino + '/icon-' + lado + '.png');

		/* A arte em 60% do lado, centrada sobre o fundo do jogo: sobra 20% de
		   margem em cada borda, que e o que o recorte do sistema come. */
		const miolo = Math.round(lado * 0.6);
		const arte = await sharp(origem)
			.resize(miolo, miolo, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
			.png()
			.toBuffer();
		await sharp({ create: { width: lado, height: lado, channels: 4, background: FUNDO } })
			.composite([{ input: arte, gravity: 'center' }])
			.png()
			.toFile(destino + '/icon-maskable-' + lado + '.png');
	}

	const capturas = [
		['./applications/pwa/screenshot-wide.png', 'screenshotwide.png', 1920, 1080],
		['./applications/pwa/screenshot-narrow.png', 'screenshotnarrow.png', 393, 852],
	];
	const papelDeParede = './src/UI/Components/Intro/images/background.jpg';
	for (const [real, nome, w, h] of capturas) {
		if (fs.existsSync(real)) {
			fs.copyFileSync(real, destino + '/' + nome);
		} else {
			/* Sem a captura real, o papel de parede volta: o build nao pode
			   quebrar numa arvore incompleta, e cartao sem imagem e pior que
			   cartao generico. */
			await sharp(papelDeParede).resize(w, h).png().toFile(destino + '/' + nome);
		}
	}

	console.log('PWA files copied', Date.now() - start, 'ms.');
}

function copyFolder(src, dest) {
	const start = Date.now();
	fs.cpSync(src, dest, { recursive: true });
	console.log(src.replace('./', '') + ' folder and files has been created in', Date.now() - start, 'ms.');
}

function getArgs() {
	const args = {};
	process.argv.slice(2, process.argv.length).forEach(arg => {
		if (arg.slice(0, 2) === '--') {
			const longArg = arg.split('=');
			const longArgFlag = longArg[0].slice(2, longArg[0].length);
			const longArgValue = longArg.length > 1 ? longArg[1] : true;
			args[longArgFlag] = longArgValue;
		} else if (arg[0] === '-') {
			const flags = arg.slice(1, arg.length).split('');
			flags.forEach(flag => {
				args[flag] = true;
			});
		}
	});
	return Object.keys(args).length === 0 ? false : args;
}
