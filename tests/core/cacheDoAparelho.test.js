/**
 * O CACHE DE ARQUIVOS DO APARELHO NO CAMINHO DE VERDADE (15/10/2026,
 * D-2547..D-2549): `FileManager.get` -> GRF local -> Cache Storage -> rede.
 *
 * Os casos montam o `FileManager` com um Cache Storage falso
 * (`cacheStorageFalso.js`) e um `fetch` falso que serve os arquivos e a rota da
 * versao. O que se prova:
 *  - SEM o cabecalho da versao (o servidor de hoje) nada muda: a rede e chamada
 *    na mesma volta, o Cache Storage nem e aberto, a rota nao e pedida;
 *  - com ele, o arquivo da segunda visita vem do cache BYTE A BYTE igual ao da
 *    rede, sem pedido;
 *  - versao nova invalida (o cache velho e apagado e o arquivo volta a rede);
 *  - sem Cache Storage, com ele quebrado, cota cheia ou leitura travada: a rede,
 *    calada, sem excecao.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Blob as BlobDoNode } from 'node:buffer';
import FileManager from 'Core/FileManager.js';
import FileSystem from 'Core/FileSystem.js';
import { criarCacheDoAparelho, URL_DO_INDICE } from 'Core/cacheDoAparelho.js';
import { ROTA_DA_VERSAO, nomeDoCache } from 'Core/cacheDeArquivos.js';
import { criarMedidaDaCarga } from 'Loaders/medidaDaCarga.js';
import { criarCacheStorageFalso, erroDeCotaCheia } from './cacheStorageFalso.js';

const HOST = 'https://assets.teste/';

/** Os bytes de cada arquivo no "servidor". */
function bytesDe(nome, tamanho = 64) {
	const b = new Uint8Array(tamanho);
	for (let i = 0; i < tamanho; i++) b[i] = (nome.charCodeAt(i % nome.length) + i * 7) & 255;
	return b;
}

/**
 * O servidor de assets falso. `versao` e o que a rota responde; `cabecalho` o
 * que vai nas respostas de arquivo (`null` = o servidor de hoje).
 */
function criarServidor() {
	const s = {
		versao: 'a1-v1',
		cabecalho: 'a1-v1',
		rotaExiste: true,
		pedidosDeArquivo: [],
		pedidosDaVersao: [],
		tamanho: 64,
		fetch: vi.fn(async (url, opcoes) => {
			if (url === HOST + ROTA_DA_VERSAO) {
				s.pedidosDaVersao.push(opcoes);
				if (!s.rotaExiste) return { ok: false, status: 404, text: async () => 'nao encontrado' };
				return { ok: true, status: 200, text: async () => s.versao };
			}
			s.pedidosDeArquivo.push(url);
			const nome = decodeURIComponent(url.slice(HOST.length));
			const corpo = bytesDe(nome, s.tamanho);
			const cabecalhos = { 'content-type': 'application/octet-stream' };
			if (s.cabecalho !== null) cabecalhos['x-versao-do-grf'] = s.cabecalho;
			return {
				ok: true,
				status: 200,
				headers: { get: n => (n in cabecalhos ? cabecalhos[n] : null) },
				arrayBuffer: async () => corpo.slice().buffer
			};
		})
	};
	return s;
}

/** Deixa as promessas e os relogios curtos (1 ms) assentarem. */
async function assentar() {
	for (let i = 0; i < 12; i++) {
		await new Promise(r => setTimeout(r, 0));
	}
}

/** `FileManager.get` como promessa: [buffer, erro, info]. */
function pegar(nome, opcoes) {
	return new Promise(resolver => {
		FileManager.get(nome, (buffer, erro, info) => resolver([buffer, erro, info]), opcoes);
	});
}

const igual = (buffer, nome, tamanho = 64) => expect([...new Uint8Array(buffer)]).toEqual([...bytesDe(nome, tamanho)]);

let servidor;
let falso;
let remoteAntes;
let cacheAntes;
let copias = 0;

function montar(dep = {}) {
	FileManager.cacheDoAparelho = criarCacheDoAparelho({
		caches: () => falso.storage,
		urlDaVersao: () => FileManager.urlDoArquivo(ROTA_DA_VERSAO),
		ativo: () => !FileSystem.disponivel(),
		cota: async () => 0,
		agendar: f => setTimeout(f, 1),
		...dep
	});
	return FileManager.cacheDoAparelho;
}

beforeEach(() => {
	servidor = criarServidor();
	falso = criarCacheStorageFalso();
	vi.stubGlobal('fetch', servidor.fetch);
	// O `Blob` do jsdom nao e aceito pelo `Response` do Node: o do navegador e.
	// Contado: cada `Blob` e uma COPIA de um arquivo inteiro.
	copias = 0;
	vi.stubGlobal(
		'Blob',
		class extends BlobDoNode {
			constructor(...argumentos) {
				super(...argumentos);
				copias++;
			}
		}
	);
	remoteAntes = FileManager.remoteClient;
	cacheAntes = FileManager.cacheDoAparelho;
	FileManager.remoteClient = HOST;
	FileManager.gameFiles.length = 0;
	montar();
});

afterEach(() => {
	FileManager.remoteClient = remoteAntes;
	FileManager.cacheDoAparelho = cacheAntes;
	vi.unstubAllGlobals();
});

describe('o servidor de hoje (sem a versao do GRF): nada muda', () => {
	it('toda visita vai a rede, na MESMA volta, e o Cache Storage nem e aberto', async () => {
		servidor.cabecalho = null;
		for (let i = 0; i < 3; i++) {
			const pronto = pegar('data/prt_fild08.gnd');
			// a rede foi chamada antes de qualquer espera: o caminho de antes
			expect(servidor.pedidosDeArquivo.length).toBe(i + 1);
			const [buffer, erro, info] = await pronto;
			expect(erro).toBeUndefined();
			expect(info.origem).toBe('rede');
			igual(buffer, 'data/prt_fild08.gnd');
			await assentar();
		}
		// o mapa novo (LOAD_MAP) tambem nao pergunta: o servidor nunca disse que sabe
		await FileManager.cacheDoAparelho.reverificar();
		await assentar();
		expect(servidor.pedidosDaVersao.length).toBe(0);
		expect(falso.conta.open).toBe(0);
		expect(falso.conta.put).toBe(0);
		expect(copias).toBe(0); // nem uma copia de arquivo
		expect(FileManager.cacheDoAparelho.consultavel()).toBe(false);
	});

	it('o cabecalho que nao e versao (o duble que responde o mesmo texto a tudo) tambem nao liga nada', async () => {
		servidor.cabecalho = 'application/octet-stream';
		await pegar('data/a.gnd');
		await assentar();
		expect(servidor.pedidosDaVersao.length).toBe(0);
		expect(falso.conta.open).toBe(0);
	});
});

describe('com a versao do GRF', () => {
	it('a 1a pergunta a versao, a 2a guarda, a 3a vem do cache byte a byte e sem rede', async () => {
		let [b1, , i1] = await pegar('data/prt_fild08.gnd');
		expect(i1.origem).toBe('rede');
		await assentar();
		// a versao da sessao saiu da rota, SEM cache
		expect(servidor.pedidosDaVersao).toEqual([{ cache: 'no-store' }]);
		expect(FileManager.cacheDoAparelho.estado().versao).toBe('a1-v1');
		expect(falso.caches.has(nomeDoCache('a1-v1'))).toBe(true);
		// a primeira nao foi guardada: chegou antes de a sessao saber a versao
		expect(falso.conta.put).toBe(0);

		const [b2, , i2] = await pegar('data/prt_fild08.gnd');
		expect(i2.origem).toBe('rede');
		await assentar();
		expect(falso.caches.get(nomeDoCache('a1-v1')).mapa.has(HOST + 'data/prt_fild08.gnd')).toBe(true);

		const antes = servidor.pedidosDeArquivo.length;
		const [b3, e3, i3] = await pegar('data/prt_fild08.gnd');
		expect(servidor.pedidosDeArquivo.length).toBe(antes);
		expect(e3).toBeUndefined();
		expect(i3.origem).toBe('cache-aparelho');
		expect([...new Uint8Array(b3)]).toEqual([...new Uint8Array(b2)]);
		expect([...new Uint8Array(b3)]).toEqual([...new Uint8Array(b1)]);
		igual(b3, 'data/prt_fild08.gnd');
	});

	it('a barra invertida do nome do GRF e a mesma chave da barra normal', async () => {
		await pegar('data/a.gnd');
		await assentar();
		await pegar('data\\texture\\b.bmp');
		await assentar();
		const antes = servidor.pedidosDeArquivo.length;
		const [buffer, , info] = await pegar('data/texture/b.bmp');
		expect(servidor.pedidosDeArquivo.length).toBe(antes);
		expect(info.origem).toBe('cache-aparelho');
		igual(buffer, 'data/texture/b.bmp');
	});

	it('a copia e feita ANTES da entrega: quem recebe pode mexer no buffer', async () => {
		await pegar('data/a.gnd');
		await assentar();
		await new Promise(resolver => {
			FileManager.get('data/c.gnd', buffer => {
				new Uint8Array(buffer).fill(0); // o parser, ou a transferencia ao fio principal
				resolver();
			});
		});
		await assentar();
		const [buffer, , info] = await pegar('data/c.gnd');
		expect(info.origem).toBe('cache-aparelho');
		igual(buffer, 'data/c.gnd');
	});

	it('o som nao passa pelo cache (o getHTTP o devolve como URL)', async () => {
		await pegar('data/a.gnd');
		await assentar();
		expect(FileManager.cacheDoAparelho.consultavel()).toBe(true);
		const leituras = falso.conta.match;
		// entregue na MESMA volta, como antes do cache: nem uma espera a mais
		let url = null;
		FileManager.get('data/wav/x.wav', u => {
			url = u;
		});
		expect(url).toBe(HOST + 'data/wav/x.wav');
		await assentar();
		expect(falso.conta.match).toBe(leituras);
		expect(servidor.pedidosDeArquivo).not.toContain(HOST + 'data/wav/x.wav');
	});

	it('o pedido cancelado durante a leitura do cache nao entrega os bytes', async () => {
		await pegar('data/a.gnd');
		await assentar();
		await pegar('data/a.gnd');
		await assentar();
		const controlador = new AbortController();
		const pronto = pegar('data/a.gnd', { sinal: controlador.signal });
		controlador.abort();
		const [buffer, erro, info] = await pronto;
		expect(buffer).toBeNull();
		expect(erro).toBe('Pedido cancelado');
		expect(info.cancelado).toBe(true);
	});

	it('a medida por fase conta o cache do aparelho como cache', () => {
		const medida = criarMedidaDaCarga(() => 0);
		medida.contarArquivo({ origem: 'cache-aparelho' }, 'rsw');
		medida.contarArquivo({ origem: 'cache-aparelho' }, 'gat');
		medida.contarArquivo({ origem: 'cache-aparelho' }, 'gnd');
		expect(medida.resumo().arquivosDoCache).toBe(3);
		expect(medida.resumo().baseDoCache).toBe(true);
	});
});

describe('a versao nova invalida o que foi guardado', () => {
	async function guardado() {
		await pegar('data/a.gnd');
		await assentar();
		await pegar('data/a.gnd');
		await assentar();
		expect((await pegar('data/a.gnd'))[2].origem).toBe('cache-aparelho');
	}

	it('a cada mapa novo (reverificar): o cache velho e apagado e o arquivo volta a rede', async () => {
		await guardado();
		servidor.versao = 'a1-v2';
		servidor.cabecalho = 'a1-v2';
		servidor.tamanho = 80; // o GRF novo tem outro conteudo
		await FileManager.cacheDoAparelho.reverificar();
		await assentar();
		expect(FileManager.cacheDoAparelho.estado().versao).toBe('a1-v2');
		expect(falso.caches.has(nomeDoCache('a1-v1'))).toBe(false);
		const [buffer, , info] = await pegar('data/a.gnd');
		expect(info.origem).toBe('rede');
		igual(buffer, 'data/a.gnd', 80);
	});

	it('uma resposta da rede com a versao nova faz perguntar sozinha', async () => {
		await guardado();
		servidor.versao = 'a1-v2';
		servidor.cabecalho = 'a1-v2';
		await pegar('data/outro.gnd'); // um arquivo que nao estava guardado
		await assentar();
		expect(FileManager.cacheDoAparelho.estado().versao).toBe('a1-v2');
		expect((await pegar('data/a.gnd'))[2].origem).toBe('rede');
	});

	it('a copia velha do cache HTTP (versao desmentida pela rota) nao entra e nao faz perguntar de novo', async () => {
		await pegar('data/a.gnd');
		await assentar();
		servidor.cabecalho = 'a1-v0'; // o navegador entregando o de ontem
		await pegar('data/b.gnd');
		await assentar();
		const perguntas = servidor.pedidosDaVersao.length;
		await pegar('data/b.gnd');
		await pegar('data/c.gnd');
		await assentar();
		expect(servidor.pedidosDaVersao.length).toBe(perguntas);
		expect(FileManager.cacheDoAparelho.estado().versao).toBe('a1-v1');
		expect(falso.caches.get(nomeDoCache('a1-v1')).mapa.has(HOST + 'data/b.gnd')).toBe(false);
	});

	it('a rota que nao existe (404) nao e perguntada de novo na sessao', async () => {
		servidor.rotaExiste = false;
		await pegar('data/a.gnd');
		await assentar();
		await pegar('data/b.gnd');
		await FileManager.cacheDoAparelho.reverificar();
		await assentar();
		expect(servidor.pedidosDaVersao.length).toBe(1);
		expect(falso.conta.open).toBe(0);
	});
});

describe('sem Cache Storage, ou com ele quebrado: a rede, calada', () => {
	async function tresVisitas() {
		const origens = [];
		for (let i = 0; i < 3; i++) {
			const [buffer, erro, info] = await pegar('data/a.gnd');
			expect(erro).toBeUndefined();
			igual(buffer, 'data/a.gnd');
			origens.push(info.origem);
			await assentar();
		}
		return origens;
	}

	it('navegador sem `caches`: nem pergunta a versao', async () => {
		montar({ caches: () => undefined });
		expect(await tresVisitas()).toEqual(['rede', 'rede', 'rede']);
		expect(servidor.pedidosDaVersao.length).toBe(0);
	});

	it('o `caches` do ambiente que LANCA (aba anonima): a rede', async () => {
		vi.stubGlobal('caches', undefined);
		Object.defineProperty(globalThis, 'caches', {
			configurable: true,
			get() {
				throw new DOMException('privado', 'SecurityError');
			}
		});
		try {
			montar({ caches: undefined });
			expect(await tresVisitas()).toEqual(['rede', 'rede', 'rede']);
		} finally {
			delete globalThis.caches;
		}
	});

	it('o `open` que rejeita: a rede, e o cache fica desligado', async () => {
		falso.sabotagem.abrir = () => new DOMException('privado', 'SecurityError');
		expect(await tresVisitas()).toEqual(['rede', 'rede', 'rede']);
		expect(FileManager.cacheDoAparelho.consultavel()).toBe(false);
	});

	it('cota cheia: a escrita falha UMA vez e a sessao para de escrever', async () => {
		falso.sabotagem.put = erroDeCotaCheia;
		expect(await tresVisitas()).toEqual(['rede', 'rede', 'rede']);
		const tentativas = falso.conta.put;
		expect(tentativas).toBe(1);
		await pegar('data/b.gnd');
		await assentar();
		expect(falso.conta.put).toBe(tentativas);
		expect(FileManager.cacheDoAparelho.estado().escritaBloqueada).toBe(true);
		// e nem copia mais os bytes de quem chega (a memoria do celular)
		const copiasAntes = copias;
		await pegar('data/c.gnd');
		await assentar();
		expect(copias).toBe(copiasAntes);
	});

	it('cota cheia com duas escritas na fila: a segunda nem tenta', async () => {
		await pegar('data/a.gnd');
		await assentar();
		falso.sabotagem.put = erroDeCotaCheia;
		await Promise.all([pegar('data/b.gnd'), pegar('data/c.gnd')]);
		await assentar();
		expect(falso.conta.put).toBe(1);
	});

	it('a leitura que nunca responde: passado o prazo, a rede', async () => {
		await pegar('data/a.gnd');
		await assentar();
		await pegar('data/a.gnd');
		await assentar();
		falso.sabotagem.match = () => new Promise(() => {});
		const antes = servidor.pedidosDeArquivo.length;
		const [buffer, , info] = await pegar('data/a.gnd');
		expect(info.origem).toBe('rede');
		expect(servidor.pedidosDeArquivo.length).toBe(antes + 1);
		igual(buffer, 'data/a.gnd');
	});

	it('a leitura que rejeita: a rede, e a entrada sai do indice', async () => {
		await pegar('data/a.gnd');
		await assentar();
		await pegar('data/a.gnd');
		await assentar();
		falso.sabotagem.match = () => Promise.reject(new Error('disco'));
		expect((await pegar('data/a.gnd'))[2].origem).toBe('rede');
	});

	it('a entrada que sumiu do cache (o navegador despejou): a rede, e o indice esquece', async () => {
		await pegar('data/a.gnd');
		await assentar();
		await pegar('data/a.gnd');
		await assentar();
		falso.caches.get(nomeDoCache('a1-v1')).mapa.delete(HOST + 'data/a.gnd');
		expect((await pegar('data/a.gnd'))[2].origem).toBe('rede');
		await assentar();
		expect((await pegar('data/a.gnd'))[2].origem).toBe('cache-aparelho');
	});

	it('a entrada com outro tamanho que o guardado: a rede', async () => {
		await pegar('data/a.gnd');
		await assentar();
		await pegar('data/a.gnd');
		await assentar();
		falso.caches.get(nomeDoCache('a1-v1')).mapa.get(HOST + 'data/a.gnd').bytes = new Uint8Array(3);
		const [buffer, , info] = await pegar('data/a.gnd');
		expect(info.origem).toBe('rede');
		igual(buffer, 'data/a.gnd');
	});

	it('com o FileSystem presente (o cache do Chrome), este fica desligado', async () => {
		montar({ ativo: () => false });
		expect(await tresVisitas()).toEqual(['rede', 'rede', 'rede']);
		expect(servidor.pedidosDaVersao.length).toBe(0);
		expect(falso.conta.open).toBe(0);
	});

	it('o FileSystem que aparece depois de o cache abrir: o cache deixa de ser lido', async () => {
		let semFileSystem = true;
		montar({ ativo: () => semFileSystem });
		await pegar('data/a.gnd');
		await assentar();
		await pegar('data/a.gnd');
		await assentar();
		expect((await pegar('data/a.gnd'))[2].origem).toBe('cache-aparelho');
		semFileSystem = false;
		expect((await pegar('data/a.gnd'))[2].origem).toBe('rede');
	});

	it('o FileManager de verdade consulta o FileSystem: presente, nem a versao e perguntada', async () => {
		FileManager.cacheDoAparelho = cacheAntes;
		vi.stubGlobal('caches', falso.storage);
		const disponivel = vi.spyOn(FileSystem, 'disponivel').mockReturnValue(true);
		try {
			await pegar('data/a.gnd');
			await assentar();
			expect(servidor.pedidosDaVersao.length).toBe(0);
			// o controle: ausente (iOS), a versao e perguntada na rota do host do cliente
			disponivel.mockReturnValue(false);
			await pegar('data/b.gnd');
			await assentar();
			expect(servidor.pedidosDaVersao).toEqual([{ cache: 'no-store' }]);
			expect(servidor.fetch.mock.calls.some(([u]) => u === HOST + ROTA_DA_VERSAO)).toBe(true);
		} finally {
			disponivel.mockRestore();
		}
	});

	it('o FileSystem deste ambiente de teste nao existe (o caso do iOS)', () => {
		expect(FileSystem.disponivel()).toBe(false);
	});
});

describe('o teto e o despejo', () => {
	it('com 20% de uma cota de 1000 bytes (200), o terceiro arquivo de 80 despeja o menos usado', async () => {
		servidor.tamanho = 80;
		montar({ cota: async () => 1000 });
		await pegar('data/a.gnd');
		await assentar();
		expect(FileManager.cacheDoAparelho.estado().teto).toBe(200);
		await pegar('data/a.gnd');
		await assentar();
		await pegar('data/b.gnd');
		await assentar();
		// `a` usado de novo: o menos usado passa a ser `b`
		expect((await pegar('data/a.gnd'))[2].origem).toBe('cache-aparelho');
		await assentar();
		await pegar('data/c.gnd');
		await assentar();
		const mapa = falso.caches.get(nomeDoCache('a1-v1')).mapa;
		expect(mapa.has(HOST + 'data/a.gnd')).toBe(true);
		expect(mapa.has(HOST + 'data/b.gnd')).toBe(false);
		expect(mapa.has(HOST + 'data/c.gnd')).toBe(true);
		expect((await pegar('data/b.gnd'))[2].origem).toBe('rede');
	});

	it('o arquivo maior que o teto nao entra (e nada e despejado por ele)', async () => {
		servidor.tamanho = 300;
		montar({ cota: async () => 1000 });
		await pegar('data/a.gnd');
		await assentar();
		await pegar('data/a.gnd');
		await assentar();
		expect(falso.conta.put).toBe(0);
	});

	it('o indice sobrevive a sessao nova; a entrada sem indice (orfa) e apagada', async () => {
		await pegar('data/a.gnd');
		await assentar();
		await pegar('data/a.gnd');
		await assentar();
		const cache = falso.caches.get(nomeDoCache('a1-v1'));
		expect(cache.mapa.has(URL_DO_INDICE)).toBe(true);
		cache.mapa.set(HOST + 'data/orfa.gnd', { bytes: new Uint8Array(5), tipo: '' });

		montar(); // a sessao nova (a aba recarregada)
		await pegar('data/z.gnd');
		await assentar();
		expect(cache.mapa.has(HOST + 'data/orfa.gnd')).toBe(false);
		const antes = servidor.pedidosDeArquivo.length;
		const [buffer, , info] = await pegar('data/a.gnd');
		expect(info.origem).toBe('cache-aparelho');
		expect(servidor.pedidosDeArquivo.length).toBe(antes);
		igual(buffer, 'data/a.gnd');
	});
});

describe('a copia que nao abre', () => {
	it('sai do cache e o arquivo e baixado de novo (FileManager.load)', async () => {
		await pegar('data/m.rsw');
		await assentar();
		await pegar('data/m.rsw');
		await assentar();
		const cache = falso.caches.get(nomeDoCache('a1-v1'));
		expect(cache.mapa.has(HOST + 'data/m.rsw')).toBe(true);
		const apagados = falso.conta.delete;
		const antes = servidor.pedidosDeArquivo.length;
		const [, erro] = await new Promise(resolver => {
			FileManager.load('data/m.rsw', (resultado, e) => resolver([resultado, e]));
		});
		// os bytes falsos nao sao um .rsw: a copia do cache foi esquecida e a
		// rede foi pedida de novo (que tambem nao abre: o erro chega)
		expect(erro).toBeTruthy();
		expect(servidor.pedidosDeArquivo.length).toBe(antes + 1);
		await assentar();
		expect(falso.conta.delete).toBeGreaterThan(apagados);
	});
});

describe('as costuras que o worker le do disco', () => {
	it('cada mapa novo reconfere a versao, sem esperar, antes de montar a carga', async () => {
		const { readFileSync } = await import('node:fs');
		const fonte = readFileSync(`${process.cwd()}/src/Core/ThreadEventHandler.js`, 'utf8').replace(/\r\n/g, '\n');
		const caso = fonte.slice(fonte.indexOf("case 'LOAD_MAP'"), fonte.indexOf('new MapLoader()'));
		expect(caso).toContain('FileManager.cacheDoAparelho.reverificar();');
		expect(caso).not.toContain('await FileManager.cacheDoAparelho');
	});

	it('a rota da versao e os arquivos moram no host do cliente (ou em /client/ sem ele)', () => {
		FileManager.remoteClient = 'https://assets.exemplo/';
		expect(FileManager.urlDoArquivo(ROTA_DA_VERSAO)).toBe('https://assets.exemplo/__versao-do-grf');
		FileManager.remoteClient = '';
		expect(FileManager.urlDoArquivo('data\\a b.gnd')).toBe('/client/data/a%20b.gnd');
	});
});
