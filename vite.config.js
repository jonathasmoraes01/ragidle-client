import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import uiCssHmrPlugin from './vite/csshotreload.plugin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isDocker = process.env.RO_PROXY_TARGET === 'docker';
const webTarget = isDocker ? 'http://rathena-web:8888' : 'http://127.0.0.1:8888';  
const remoteClientTarget = isDocker ? 'http://remote-client-php:80' : 'http://127.0.0.1:8000';  
  
const _proxy = {  
	'/get': {  
		target: webTarget,  
		changeOrigin: true,  
		secure: false,  
		ws: false  
	},  
	'/emblem': {  
		target: webTarget,  
		changeOrigin: true,  
		secure: false,  
		ws: false  
	},  
	'/userconfig': {  
		target: webTarget,  
		changeOrigin: true,  
		secure: false,  
		ws: false  
	}  
};  
  
// Rag Idle / oráculo M0: este proxy era criado SÓ quando RO_PROXY_TARGET=docker,
// embora o alvo de fora do Docker já estivesse calculado logo acima
// (`remoteClientTarget` → 127.0.0.1:8000). Sem ele, rodando o vite no host,
// `/remote-client/...` cai no servidor estático do próprio vite e devolve 404
// para todo asset. Com ele, o cliente pede o caminho relativo de sempre e não
// precisa de CORS nem de URL absoluta na config.
_proxy['/remote-client'] = {
	target: remoteClientTarget,
	changeOrigin: true,
	secure: false,
	rewrite: path => path.replace(/^\/remote-client/, '')
};

// Rag Idle: o EMBLEMA de guilda (D-350) e HTTP na porta 8888 do servidor de
// jogo -- e o cliente servido por http chama /emblem/* na PROPRIA ORIGEM
// (Guild.js so usa o webserverAddress em file://). Sem este proxy, o upload
// pela janela da guilda devolve 404 do proprio vite.
_proxy['/emblem'] = {
	target: 'http://127.0.0.1:8888',
	changeOrigin: true,
	secure: false
};

export default defineConfig({
	/**
	 * A RAIZ REDIRECIONA PARA O JOGO (03/09/2026).
	 *
	 * O `npm run dev` do Rag Idle imprime a URL completa
	 * (`/applications/pwa/index.html`), mas quem digita so `127.0.0.1:3000` — ou
	 * deixa o navegador completar do historico — cai na RAIZ, e a raiz devolvia
	 * **404**: este projeto nao tem `index.html` no topo, so
	 * `applications/<app>/index.html`.
	 *
	 * Um 404 na raiz de um servidor de desenvolvimento e armadilha: ele parece
	 * 'o jogo nao subiu' quando as quatro pecas estao no ar. O dono caiu nela em
	 * 03/09/2026 e reportou 'abriu e nao funcionou' — com a pilha inteira de pe.
	 *
	 * O redirecionamento e 302 (temporario) de proposito: ele e conveniencia de
	 * desenvolvimento, e nao rota do produto — cache permanente de 301 no
	 * navegador do dono seria pior que o 404.
	 */
	plugins: [
		uiCssHmrPlugin(),
		{
			name: 'ragidle-raiz-vai-para-o-jogo',
			apply: 'serve',
			configureServer(server) {
				server.middlewares.use((req, res, next) => {
					const url = req.url ?? '/';
					if (url === '/' || url === '/index.html') {
						res.writeHead(302, { Location: '/applications/pwa/index.html' });
						res.end();
						return;
					}
					next();
				});
			},
		},
	],
	root: './',
	base: './',
	resolve: {
		alias: {
			App: path.resolve(__dirname, './src/App'),
			Audio: path.resolve(__dirname, './src/Audio'),
			Controls: path.resolve(__dirname, './src/Controls'),
			Core: path.resolve(__dirname, './src/Core'),
			DB: path.resolve(__dirname, './src/DB'),
			Engine: path.resolve(__dirname, './src/Engine'),
			Loaders: path.resolve(__dirname, './src/Loaders'),
			Network: path.resolve(__dirname, './src/Network'),
			Plugins: path.resolve(__dirname, './src/Plugins'),
			Preferences: path.resolve(__dirname, './src/Preferences'),
			Renderer: path.resolve(__dirname, './src/Renderer'),
			UI: path.resolve(__dirname, './src/UI'),
			Utils: path.resolve(__dirname, './src/Utils'),
			Vendors: path.resolve(__dirname, './src/Vendors')
		}
	},
	optimizeDeps: {  
		include: ['bson', 'lodash', 'rijndael-js']  
	},
	test: {
		environment: 'jsdom',
		include: ['tests/**/*.test.js'],
		coverage: {  
			provider: 'v8',  
			reporter: ['text', 'html'],  
			include: ['src/**/*.js'],  
			exclude: ['src/Vendors/**']  
		}
	},
	build: {
		sourcemap: false, // Saves RAM
		minify: false, // Makes the build run much faster
		outDir: 'dist/Web',
		rollupOptions: {
			input: {
				main: path.resolve(__dirname, 'index.html')
			}
		}
	},
	server: {
		host: isDocker ? '0.0.0.0' : 'localhost', 
		port: 3000,
		open: !isDocker,
		cors: true,  
		...(isDocker && {  
			watch: {  
				usePolling: true, 
				interval: 1000  
			}  
		}),
		proxy: _proxy
	}	
});
