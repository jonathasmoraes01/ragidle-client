/*
 * AS OPCOES DO VITE DE CADA BUNDLE DO `builder-web.mjs`, num lugar que o teste
 * tambem le (07/10/2026, D-2075 do servidor).
 *
 * Elas moravam dentro de `compile()`, e o builder roda o build inteiro quando
 * e importado - nenhum teste conseguia montar um bundle com a MESMA
 * configuracao de producao. `tests/core/carimboDosWorkers.test.js` compila uma
 * fixture com estas opcoes e confere que o worker sai com o carimbo; se
 * alguem tirar o plugin daqui, o teste reprova.
 */
import { pluginDoCarimboDosWorkers } from './carimboDosWorkers.mjs';

/**
 * @param {object} p
 * @param {string} p.projectRoot
 * @param {string} p.entry
 * @param {string} p.outDir
 * @param {string} p.appName - o nome do arquivo de saida (Online -> Online.js)
 * @param {object} p.aliases
 * @param {boolean} p.isMinify
 * @param {string} p.versaoDoBuild
 * @param {string} p.carimbo - o MESMO `?v=` que o api.html poe no `Online.js`
 * @param {string} p.header
 */
export function opcoesDoVite({ projectRoot, entry, outDir, appName, aliases, isMinify, versaoDoBuild, carimbo, header }) {
	return {
		configFile: false,
		root: projectRoot,
		base: './',
		logLevel: 'warn',
		resolve: {
			alias: aliases
		},
		// A versao do build no jogo (D-1635): o login a manda ao servidor.
		define: {
			__RAGIDLE_VERSAO_DO_BUILD__: JSON.stringify(versaoDoBuild)
		},
		/* O worker sai com o carimbo do build (D-2075): sem ele, a URL relativa
		   ao `Online.js?v=<carimbo>` derruba a query e o navegador devolve a
		   copia do worker que guardou de outro build. */
		plugins: [pluginDoCarimboDosWorkers(carimbo)],
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
	};
}
