/*
 * O WORKER SAI COM O MESMO CARIMBO DO PRINCIPAL (07/10/2026, D-2075 do servidor).
 *
 * O `Online.js` e pedido com `?v=<carimbo>` (o buster do api.html), mas os
 * dois workers que ele cria - `ThreadEventHandler.js` e `PathFindingWorker.js`
 * - saiam do bundle como `new URL("ThreadEventHandler.js", import.meta.url)`:
 * a URL relativa derruba a query do principal, e o worker era pedido SEM
 * carimbo, com o mesmo nome em todo build.
 *
 * O caminho do worker velho (medido em laboratorio, Chromium do Playwright):
 * ate 01/09/2026 estes arquivos eram servidos com
 * `public, max-age=31536000, immutable` (o vercel.json de antes de 0a200d3f).
 * Quem baixou o worker naquela epoca guardou uma copia FRESCA por um ano, e o
 * navegador a devolve sem perguntar a rede - a troca do cabecalho para
 * `max-age=0` nunca chega a quem nao pede. O `Online.js` escapou porque
 * ganhou o `?v=` no mesmo commit; o worker nao. O service worker nao salva:
 * o ramo "rede primeiro" faz `fetch(req)`, e o `fetch` passa pelo mesmo cache
 * HTTP. No deploy de 07/10 o principal novo mandou o pedido de carga num
 * formato que o worker de setembro nao conhecia: `Can't find file
 * "[object Object]"`.
 *
 * A regra: toda URL de script relativa ao `import.meta.url` no bundle
 * principal carrega o carimbo do build. Ela e posta por um plugin no fim do
 * build (depois de o vite resolver os workers) e CONFERIDA no arquivo gerado:
 * se sobrar uma sem carimbo, o build falha alto.
 *
 * O dev (`npx vite`) nao passa por aqui: la o vite serve o worker como
 * `/src/Core/ThreadEventHandler.js?worker_file&type=module`, sem cache velho.
 */
import fs from 'fs';

/**
 * Uma URL de script relativa ao proprio bundle, na forma que o vite (e o
 * terser) deixam: `new URL("X.js", import.meta.url)`. So nome relativo e
 * terminado em `.js` (sem `:` - nada de `data:`/`http:` - e sem query).
 */
const URL_DE_SCRIPT = /new URL\(\s*(["'`])((?:\.\/)?[\w\-./]+\.js)(\?[^"'`]*)?\1\s*,\s*import\.meta\.url\s*\)/g;

/**
 * As URLs de script relativas do codigo que NAO carregam `v=<carimbo>`.
 *
 * @param {string} codigo
 * @returns {string[]} os nomes, na ordem em que aparecem
 */
export function urlsDeScriptSemCarimbo(codigo) {
	const sem = [];
	for (const achado of codigo.matchAll(URL_DE_SCRIPT)) {
		const query = achado[3] || '';
		if (!/[?&]v=[^&]+/.test(query)) {
			sem.push(achado[2]);
		}
	}
	return sem;
}

/**
 * Cola `?v=<carimbo>` em toda URL de script relativa que ainda nao tem query.
 *
 * @param {string} codigo
 * @param {string} carimbo
 * @returns {string}
 */
export function carimbarUrlsDeScript(codigo, carimbo) {
	if (!carimbo || /[^\w.-]/.test(carimbo)) {
		throw new Error(`Carimbo invalido para os workers: "${carimbo}".`);
	}
	return codigo.replace(URL_DE_SCRIPT, (inteiro, aspas, nome, query) => {
		if (query) {
			return inteiro;
		}
		return inteiro.replace(aspas + nome + aspas, aspas + nome + '?v=' + carimbo + aspas);
	});
}

/**
 * O plugin do build. `generateBundle` roda depois do `renderChunk` do vite
 * (que troca o marcador do worker pelo nome do arquivo) e do minificador, e
 * por isso ve o texto final.
 *
 * @param {string} carimbo
 */
export function pluginDoCarimboDosWorkers(carimbo) {
	return {
		name: 'ragidle-carimbo-dos-workers',
		enforce: 'post',
		generateBundle(_opcoes, bundle) {
			for (const saida of Object.values(bundle)) {
				if (saida.type === 'chunk') {
					saida.code = carimbarUrlsDeScript(saida.code, carimbo);
				}
			}
		}
	};
}

/**
 * Confere o arquivo gerado. Lanca se sobrar URL de script sem carimbo, ou se o
 * carimbo do build nao estiver nela.
 *
 * @param {string} arquivo
 * @param {string} carimbo
 */
export function conferirCarimboDosWorkers(arquivo, carimbo) {
	const codigo = fs.readFileSync(arquivo, 'utf8');
	const sem = urlsDeScriptSemCarimbo(codigo);
	if (sem.length > 0) {
		throw new Error(
			`${arquivo}: ${sem.length} URL(s) de script sem o carimbo do build (${sem.join(', ')}). ` +
				'Um worker de nome fixo sem ?v= pode chegar velho a uma pagina nova (D-2075).'
		);
	}
	const comEsteCarimbo = [...codigo.matchAll(URL_DE_SCRIPT)].filter(a => (a[3] || '').includes('v=' + carimbo));
	return comEsteCarimbo.map(a => a[2]);
}
