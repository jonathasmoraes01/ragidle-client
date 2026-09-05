/**
 * applications/pwa/sw.js — O SERVICE WORKER DO RAG IDLE (D-933, 05/09/2026).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * A REGRA QUE MANDA EM TUDO AQUI: O SAVE É DO SERVIDOR
 * ═══════════════════════════════════════════════════════════════════════
 * Este arquivo NUNCA guarda resposta de API nem estado de jogo. Nem uma. O
 * personagem vive no servidor (D-244), e um cache que devolvesse um inventário
 * velho seria a coisa mais parecida com perder progresso que um cliente
 * consegue fazer sozinho — e a Regra 9 deste projeto existe porque isso já
 * aconteceu por outro caminho.
 *
 * O que ele guarda é a CASCA: o HTML, os quatro bundles e o ícone. Nada que
 * mude sem um build novo.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * NÃO HÁ HASH NO NOME DOS ARQUIVOS, E ISSO MUDA A ESTRATÉGIA
 * ═══════════════════════════════════════════════════════════════════════
 * O plano da frente dizia "cacheie os assets versionados por hash — o pipeline
 * já nomeia por hash". **Ele não nomeia.** Auditado em 05/09/2026:
 * `Online.js`, `ThreadEventHandler.js`, `PathFindingWorker.js` e `Config.js`
 * saem com nome FIXO do `builder-web.mjs`, e o cache-busting de hoje é um
 * `?v=<carimbo>` colado na hora de importar.
 *
 * Consequência: não dá para fazer cache-first eterno por nome. O que existe é
 * o carimbo na QUERY, e ele muda a cada build — então a URL COMPLETA (com a
 * query) é única por versão, e cache-first sobre ela é seguro. Uma URL de
 * build antigo simplesmente nunca mais é pedida.
 *
 * E o cache inteiro é nomeado com a versão do build (`VERSAO`, injetada pelo
 * `copyPwaFiles`). Publicar troca o nome do cache, o `activate` apaga o
 * anterior, e não sobra lixo de versão nenhuma.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * NAVEGAÇÃO É REDE PRIMEIRO — de propósito
 * ═══════════════════════════════════════════════════════════════════════
 * O HTML sai da rede sempre que a rede responde, e só cai no cache quando ela
 * não responde. O contrário (cache primeiro) daria um jogo que abre instantâneo
 * numa versão velha e só atualiza no segundo F5 — num jogo AO VIVO, com o
 * servidor já atualizado do outro lado, isso é cliente desatualizado falando
 * com servidor novo em silêncio, que é exatamente o que a frente pediu para
 * evitar.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * NÃO EXISTE JOGO OFFLINE, E O SW NÃO FINGE QUE EXISTE
 * ═══════════════════════════════════════════════════════════════════════
 * Sem rede, ele devolve a casca cacheada — e a casca sem WebSocket mostra a
 * tela de conexão do próprio cliente. Nenhuma tela falsa de "jogando offline",
 * nenhum estado inventado. O personagem continua caçando no servidor, e é o que
 * a tela diz.
 */

/* eslint-env serviceworker */

/** Trocado pelo build (`copyPwaFiles`). O literal aqui é só o fallback do dev. */
const VERSAO = '__VERSAO_DO_BUILD__';
const CACHE = `ragidle-casca-${VERSAO}`;

/**
 * A CASCA. Curta de propósito: cada item aqui é um arquivo que só muda com um
 * build novo. Nada de `/remote-client/**` (a arte do jogo, dezenas de milhares
 * de arquivos servidos por outro host) e nada de API.
 */
const CASCA = ['./', './api.html', './index.html', './api.js', './icon.png', './manifest.webmanifest'];

self.addEventListener('install', (evento) => {
	evento.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			/* `Promise.allSettled` e não `cache.addAll`: o `addAll` é atômico e
			   um único 404 (o `index.html` não existe em todo build) abortaria a
			   instalação inteira, deixando o jogo sem service worker nenhum. */
			await Promise.allSettled(CASCA.map((url) => cache.add(new Request(url, { cache: 'reload' }))));
			/* NÃO chama `skipWaiting()` aqui. O worker novo espera, e quem
			   decide a hora de trocar é o JOGADOR, pelo aviso na tela — trocar
			   sozinho recarregaria a página no meio de uma caçada. */
		})(),
	);
});

self.addEventListener('activate', (evento) => {
	evento.waitUntil(
		(async () => {
			const nomes = await caches.keys();
			await Promise.all(
				nomes.filter((n) => n.startsWith('ragidle-casca-') && n !== CACHE).map((n) => caches.delete(n)),
			);
			await self.clients.claim();
		})(),
	);
});

/** O jogador aceitou a versão nova: o worker em espera assume agora. */
self.addEventListener('message', (evento) => {
	if (evento.data && evento.data.tipo === 'ragidle:assumir') {
		self.skipWaiting();
	}
});

/** Isto é estado de jogo ou resposta de API? Se for, o SW não encosta. */
function ehDoJogo(url) {
	return (
		url.pathname.startsWith('/remote-client/') ||
		url.pathname.startsWith('/get') ||
		url.pathname.startsWith('/userconfig') ||
		url.pathname.startsWith('/emblem') ||
		url.pathname.startsWith('/saude') ||
		url.pathname.startsWith('/api/')
	);
}

self.addEventListener('fetch', (evento) => {
	const req = evento.request;
	if (req.method !== 'GET') {
		return;
	}
	const url = new URL(req.url);

	/* Outra origem, WebSocket, arte do cliente, API: passa direto. O SW não
	   participa, e é isso que garante que nenhum estado de jogo seja guardado. */
	if (url.origin !== self.location.origin || ehDoJogo(url)) {
		return;
	}

	/* NAVEGAÇÃO: rede primeiro, cache como rede de segurança. */
	if (req.mode === 'navigate') {
		evento.respondWith(
			(async () => {
				try {
					const resposta = await fetch(req);
					const cache = await caches.open(CACHE);
					cache.put(req, resposta.clone());
					return resposta;
				} catch (erro) {
					const cache = await caches.open(CACHE);
					return (await cache.match(req)) || (await cache.match('./api.html')) || Response.error();
				}
			})(),
		);
		return;
	}

	/* RESTO DA CASCA: cache primeiro. A URL carrega o `?v=<carimbo>` do build,
	   então uma entrada cacheada nunca pertence a outra versão. */
	evento.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);
			const guardado = await cache.match(req);
			if (guardado) {
				return guardado;
			}
			try {
				const resposta = await fetch(req);
				/* Só respostas boas e da nossa origem entram. Um 404 cacheado
				   viraria um 404 permanente até a próxima publicação. */
				if (resposta && resposta.status === 200 && resposta.type === 'basic') {
					cache.put(req, resposta.clone());
				}
				return resposta;
			} catch (erro) {
				return Response.error();
			}
		})(),
	);
});
