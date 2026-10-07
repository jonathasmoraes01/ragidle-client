/**
 * O "REDE PRIMEIRO" DO SERVICE WORKER PERGUNTA A REDE DE VERDADE (07/10/2026,
 * D-2075 do servidor).
 *
 * O ramo do `sw.js` para URL sem carimbo fazia `fetch(req)`, e esse `fetch`
 * passa pelo cache HTTP do navegador: uma copia guardada como FRESCA volta sem
 * a rede ser consultada. Foi assim que o `ThreadEventHandler.js` de setembro
 * (servido `immutable` por um ano ate 01/09) chegou a paginas de 07/10. O
 * worker agora sai carimbado (`carimboDosWorkers.test.js`), e este arquivo
 * cobra a outra metade: o que ainda e pedido sem carimbo REVALIDA.
 *
 * O `sw.js` e um script solto: ele roda aqui com `self`, `caches` e `fetch`
 * falsificados, e o teste dispara o evento `fetch` como o navegador faria.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SW = readFileSync(resolve(__dirname, '../../applications/pwa/sw.js'), 'utf8');
const ORIGEM = 'https://play.exemplo';

function montarSw({ guardado = null } = {}) {
	const ouvintes = {};
	const pedidos = [];
	const postos = [];
	const cacheFalso = {
		match: async () => guardado,
		put: async (req) => {
			postos.push(typeof req === 'string' ? req : req.url);
		}
	};
	const self = {
		location: { origin: ORIGEM },
		addEventListener: (tipo, fn) => {
			ouvintes[tipo] = fn;
		},
		clients: { claim: async () => {} },
		skipWaiting: () => {}
	};
	const caches = { open: async () => cacheFalso, keys: async () => [], delete: async () => true };
	const fetchFalso = async (req, init) => {
		pedidos.push({ url: typeof req === 'string' ? req : req.url, init });
		return { status: 200, type: 'basic', clone: () => ({}) };
	};
	// eslint-disable-next-line no-new-func
	new Function('self', 'caches', 'fetch', 'Response', SW)(self, caches, fetchFalso, { error: () => 'erro' });
	return { ouvintes, pedidos, postos };
}

async function pedir(sw, caminho) {
	let resposta;
	sw.ouvintes.fetch({
		request: { method: 'GET', url: ORIGEM + caminho, mode: 'same-origin' },
		respondWith: (p) => {
			resposta = p;
		}
	});
	return resposta;
}

describe('o service worker e o worker do jogo', () => {
	it('sem carimbo: vai a rede REVALIDANDO, e nao pelo cache HTTP fresco', async () => {
		const sw = montarSw();
		await pedir(sw, '/ThreadEventHandler.js');
		expect(sw.pedidos).toHaveLength(1);
		expect(sw.pedidos[0].init).toEqual({ cache: 'no-cache' });
	});

	it('sem carimbo e com copia no cache do SW: a rede vem antes mesmo assim', async () => {
		const sw = montarSw({ guardado: { velho: true } });
		await pedir(sw, '/PathFindingWorker.js');
		expect(sw.pedidos.map((p) => p.url)).toEqual([ORIGEM + '/PathFindingWorker.js']);
	});

	it('com o carimbo do build: cache primeiro, pela URL INTEIRA (a de outro build nunca casa)', async () => {
		const sw = montarSw({ guardado: { daquele: 'build' } });
		const resposta = await pedir(sw, '/ThreadEventHandler.js?v=1791234567890');
		expect(await resposta).toEqual({ daquele: 'build' });
		expect(sw.pedidos).toHaveLength(0);
	});

	it('com o carimbo e sem copia: busca e guarda a resposta boa', async () => {
		const sw = montarSw();
		await pedir(sw, '/ThreadEventHandler.js?v=1791234567890');
		expect(sw.pedidos.map((p) => p.url)).toEqual([ORIGEM + '/ThreadEventHandler.js?v=1791234567890']);
		await new Promise((r) => setImmediate(r));
		expect(sw.postos).toHaveLength(1);
	});
});
