/**
 * Um Cache Storage falso para os testes do cache do aparelho (D-2547): guarda
 * os BYTES que o `put` consome (como o de verdade, ele le o corpo da resposta)
 * e devolve uma resposta nova a cada `match`. Conta cada chamada, e cada
 * operacao pode ser sabotada (cota cheia, aba anonima, leitura travada).
 */
export function criarCacheStorageFalso() {
	const caches = new Map();
	const sabotagem = { abrir: null, put: null, match: null };
	const conta = { open: 0, put: 0, match: 0, delete: 0, keys: 0, apagarCache: 0 };

	const chave = pedido => (typeof pedido === 'string' ? pedido : pedido.url);

	function criarCache() {
		const mapa = new Map();
		return {
			mapa,
			async put(pedido, resposta) {
				conta.put++;
				if (sabotagem.put) throw sabotagem.put();
				const bytes = new Uint8Array(await resposta.arrayBuffer());
				mapa.set(chave(pedido), { bytes, tipo: resposta.headers.get('content-type') });
			},
			async match(pedido) {
				conta.match++;
				if (sabotagem.match) return sabotagem.match();
				const e = mapa.get(chave(pedido));
				if (!e) return undefined;
				return new Response(e.bytes.slice(), { headers: { 'content-type': e.tipo || '' } });
			},
			async delete(pedido) {
				conta.delete++;
				return mapa.delete(chave(pedido));
			},
			async keys() {
				conta.keys++;
				return [...mapa.keys()].map(url => ({ url }));
			}
		};
	}

	const storage = {
		async open(nome) {
			conta.open++;
			if (sabotagem.abrir) throw sabotagem.abrir();
			if (!caches.has(nome)) caches.set(nome, criarCache());
			return caches.get(nome);
		},
		async keys() {
			return [...caches.keys()];
		},
		async delete(nome) {
			conta.apagarCache++;
			return caches.delete(nome);
		},
		async has(nome) {
			return caches.has(nome);
		}
	};

	return { storage, caches, sabotagem, conta };
}

/** O erro que o navegador lanca com a cota cheia. */
export function erroDeCotaCheia() {
	const erro = new Error('cota cheia');
	erro.name = 'QuotaExceededError';
	return erro;
}
