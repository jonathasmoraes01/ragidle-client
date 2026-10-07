/**
 * O PEDIDO QUE NUNCA RESPONDE (D-2055, 06/10/2026 — "a tela de carregamento
 * trava em 2% e nunca termina"). Antes desta entrega o `fetch` pendurado nao
 * rejeitava nunca e o `callback` do arquivo nunca era chamado: os casos de
 * silencio abaixo REPROVAVAM (o `callback` ficava com zero chamadas).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SILENCIO_MAXIMO_MS, baixarComVigia, totalDoArquivo, totalQueCabe } from 'Core/baixarComVigia.js';
import { NOVAS_TENTATIVAS_DE_ARQUIVO } from 'Core/tentativasDeArquivo.js';
import FileManager, { PRAZO_DO_CACHE_LOCAL_MS } from 'Core/FileManager.js';
import FileSystem from 'Core/FileSystem.js';

/** Um `fetch` que nunca responde - e que solta a conexao quando abortado. */
function pendurado() {
	return (_url, init) =>
		new Promise((_resolver, rejeitar) => {
			if (init && init.signal) {
				init.signal.addEventListener('abort', () => rejeitar(Object.assign(new Error('abortado'), { name: 'AbortError' })));
			}
		});
}

function cabecalhos(mapa) {
	return { get: chave => mapa[String(chave).toLowerCase()] ?? null };
}

/** Uma resposta binaria inteira, sem corpo em fluxo (o caminho do `arrayBuffer`). */
function binario(bytes = 8) {
	return {
		ok: true,
		status: 200,
		headers: cabecalhos({ 'content-type': 'application/octet-stream', 'content-length': String(bytes) }),
		arrayBuffer: () => Promise.resolve(new ArrayBuffer(bytes))
	};
}

/**
 * Uma resposta em FLUXO: cada pedaco sai quando o teste chama `soltar()`. Um
 * pedaco `null` encerra o corpo.
 */
function emFluxo(total) {
	const fila = [];
	const esperando = [];
	const leitor = {
		read: () =>
			new Promise(resolver => {
				if (fila.length) resolver(fila.shift());
				else esperando.push(resolver);
			}),
		cancel: vi.fn()
	};
	const soltar = pedaco => {
		const item = pedaco === null ? { done: true, value: undefined } : { done: false, value: pedaco };
		if (esperando.length) esperando.shift()(item);
		else fila.push(item);
	};
	const resposta = {
		ok: true,
		status: 200,
		headers: cabecalhos({ 'content-type': 'application/octet-stream', 'content-length': String(total) }),
		body: { getReader: () => leitor }
	};
	return { resposta, soltar, leitor };
}

beforeEach(() => {
	vi.useFakeTimers();
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('baixarComVigia', () => {
	it('o pedido que nunca responde rejeita por SILENCIO no prazo, e o pedido e abortado', async () => {
		let sinal = null;
		const buscar = vi.fn((url, init) => {
			sinal = init.signal;
			return pendurado()(url, init);
		});
		const promessa = baixarComVigia('/x.gnd', { buscar });
		const resultado = promessa.then(
			() => 'resolveu',
			e => e
		);
		await vi.advanceTimersByTimeAsync(SILENCIO_MAXIMO_MS - 1);
		expect(sinal.aborted).toBe(false);
		await vi.advanceTimersByTimeAsync(1);
		const erro = await resultado;
		expect(erro).toBeInstanceOf(Error);
		expect(erro.silencio).toBe(true);
		expect(sinal.aborted).toBe(true);
	});

	it('o download LENTO que nunca para de chegar nao e cortado (o prazo e de silencio, e nao de duracao)', async () => {
		const { resposta, soltar } = emFluxo(40);
		const recebido = [];
		const promessa = baixarComVigia('/lento.gnd', {
			buscar: () => Promise.resolve(resposta),
			aoReceber: (recebidos, total) => recebido.push([recebidos, total])
		});
		// Quatro pedacos, um a cada 10 s: 40 s no total, nunca 15 s calado.
		for (let i = 0; i < 4; i++) {
			await vi.advanceTimersByTimeAsync(10000);
			soltar(new Uint8Array(10));
		}
		soltar(null);
		const r = await promessa;
		expect(r.ok).toBe(true);
		expect(r.buffer.byteLength).toBe(40);
		expect(r.bytes).toBe(40);
		expect(recebido).toEqual([
			[10, 40],
			[20, 40],
			[30, 40],
			[40, 40]
		]);
	});

	it('o corpo que para NO MEIO rejeita por silencio', async () => {
		const { resposta, soltar, leitor } = emFluxo(100);
		const resultado = baixarComVigia('/meio.gnd', { buscar: () => Promise.resolve(resposta) }).then(
			() => 'resolveu',
			e => e
		);
		await vi.advanceTimersByTimeAsync(1000);
		soltar(new Uint8Array(30));
		await vi.advanceTimersByTimeAsync(SILENCIO_MAXIMO_MS);
		const erro = await resultado;
		expect(erro.silencio).toBe(true);
		// Um pedaco tardio depois do prazo nao ressuscita o pedido.
		soltar(new Uint8Array(70));
		await vi.advanceTimersByTimeAsync(0);
		expect(leitor.cancel).toHaveBeenCalled();
	});

	it('o sinal de fora cancela, e o erro diz `cancelado` (nao e silencio)', async () => {
		const controlador = new AbortController();
		const resultado = baixarComVigia('/c.gnd', { buscar: pendurado(), sinal: controlador.signal }).then(
			() => 'resolveu',
			e => e
		);
		controlador.abort();
		const erro = await resultado;
		expect(erro.cancelado).toBe(true);
		expect(erro.silencio).toBeUndefined();
	});

	it('HTML no lugar do binario vale 404, e resposta nao-ok devolve o status', async () => {
		const html = { ok: true, status: 200, headers: cabecalhos({ 'content-type': 'text/html' }) };
		expect(await baixarComVigia('/a', { buscar: () => Promise.resolve(html) })).toEqual({ ok: false, status: 404 });
		const nao = { ok: false, status: 503, headers: cabecalhos({}) };
		expect(await baixarComVigia('/b', { buscar: () => Promise.resolve(nao) })).toEqual({ ok: false, status: 503 });
	});
});

describe('FileManager.getHTTP com o silencio (o arquivo que nunca responde)', () => {
	it('o pedido pendurado UMA vez e refeito, e o arquivo chega uma vez so', async () => {
		const fetch = vi.fn().mockImplementationOnce(pendurado()).mockResolvedValueOnce(binario(16));
		vi.stubGlobal('fetch', fetch);
		const callback = vi.fn();
		const novas = [];
		FileManager.getHTTP('data/glast_01.gnd', callback, { aoTentarDeNovo: n => novas.push(n) });
		await vi.advanceTimersByTimeAsync(SILENCIO_MAXIMO_MS + 1000 + 10);
		expect(fetch).toHaveBeenCalledTimes(2);
		expect(callback).toHaveBeenCalledTimes(1);
		const [buffer, erro, info] = callback.mock.calls[0];
		expect(buffer).toBeInstanceOf(ArrayBuffer);
		expect(erro).toBeUndefined();
		expect(info).toMatchObject({ origem: 'rede', tentativas: 1, silencios: 1, bytes: 16 });
		expect(novas).toEqual([1]);
	});

	it('o pedido que NUNCA responde termina em "Can\'t get file" depois das novas tentativas, e nao pendura', async () => {
		const fetch = vi.fn(pendurado());
		vi.stubGlobal('fetch', fetch);
		const callback = vi.fn();
		FileManager.getHTTP('data/glast_01.gnd', callback);
		// Quatro silencios mais o recuo de 1 + 2 + 4 s.
		await vi.advanceTimersByTimeAsync(4 * SILENCIO_MAXIMO_MS + 7000 + 10);
		expect(fetch).toHaveBeenCalledTimes(NOVAS_TENTATIVAS_DE_ARQUIVO + 1);
		expect(callback).toHaveBeenCalledTimes(1);
		expect(callback.mock.calls[0][0]).toBeNull();
		expect(callback.mock.calls[0][1]).toBe("Can't get file");
		expect(callback.mock.calls[0][2]).toMatchObject({ falhou: true, silencios: 4, tentativas: 3 });
	});

	it('o pedido cancelado nao tenta de novo', async () => {
		const fetch = vi.fn(pendurado());
		vi.stubGlobal('fetch', fetch);
		const callback = vi.fn();
		const controlador = new AbortController();
		FileManager.getHTTP('data/glast_01.gnd', callback, { sinal: controlador.signal });
		controlador.abort();
		await vi.advanceTimersByTimeAsync(60000);
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(callback).toHaveBeenCalledTimes(1);
		expect(callback.mock.calls[0][1]).toBe('Pedido cancelado');
	});

	it('o FileManager.load repassa a informacao do arquivo a quem pediu', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(binario(4)));
		const callback = vi.fn();
		FileManager.load('data/qualquer.bin', callback);
		await vi.advanceTimersByTimeAsync(10);
		expect(callback).toHaveBeenCalledTimes(1);
		expect(callback.mock.calls[0][2]).toMatchObject({ origem: 'rede', tentativas: 0 });
	});
});

describe('FileManager.get com o cache local calado', () => {
	it('o cache local que nao responde cede a vez a rede no prazo', async () => {
		vi.spyOn(FileSystem, 'getFile').mockImplementation(() => {});
		const fetch = vi.fn().mockResolvedValueOnce(binario(8));
		vi.stubGlobal('fetch', fetch);
		const callback = vi.fn();
		FileManager.get('data/prontera.rsw', callback);
		await vi.advanceTimersByTimeAsync(PRAZO_DO_CACHE_LOCAL_MS - 1);
		expect(fetch).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(10);
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(callback).toHaveBeenCalledTimes(1);
	});

	it('o cache local que responde tarde, depois do prazo, nao entrega o arquivo de novo', async () => {
		let achou = null;
		vi.spyOn(FileSystem, 'getFile').mockImplementation((_nome, onload) => {
			achou = onload;
		});
		vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(binario(8)));
		const callback = vi.fn();
		FileManager.get('data/prontera.rsw', callback);
		await vi.advanceTimersByTimeAsync(PRAZO_DO_CACHE_LOCAL_MS + 10);
		achou(new Blob([new Uint8Array(8)]));
		await vi.advanceTimersByTimeAsync(10);
		expect(callback).toHaveBeenCalledTimes(1);
	});
});

/**
 * O MAPA COMPRIMIDO (D-2072, 07/10/2026). O servidor de assets passou a mandar
 * brotli/gzip: o `Content-Length` vira o tamanho COMPRIMIDO, e os pedacos que o
 * `fetch` entrega sao DESCOMPRIMIDOS. Sem o `X-Tamanho-Original`, o aviso
 * "Baixando o mapa: X de Y MB" diria "5,1 de 0,4 MB".
 */
describe('o total do arquivo comprimido', () => {
	it('o X-Tamanho-Original vence o Content-Length (que e o comprimido)', () => {
		expect(totalDoArquivo(cabecalhos({ 'content-length': '400', 'x-tamanho-original': '5000', 'content-encoding': 'br' }))).toBe(5000);
	});

	it('comprimido sem o tamanho original: "nao sei" (0), e nunca o comprimido', () => {
		expect(totalDoArquivo(cabecalhos({ 'content-length': '400', 'content-encoding': 'gzip' }))).toBe(0);
		expect(totalDoArquivo(cabecalhos({ 'content-length': '400', 'content-encoding': ' BR ' }))).toBe(0);
	});

	it('cru (ou identity) continua com o Content-Length de sempre', () => {
		expect(totalDoArquivo(cabecalhos({ 'content-length': '400' }))).toBe(400);
		expect(totalDoArquivo(cabecalhos({ 'content-length': '400', 'content-encoding': 'identity' }))).toBe(400);
		expect(totalDoArquivo(cabecalhos({}))).toBe(0);
		expect(totalDoArquivo(undefined)).toBe(0);
	});

	it('o total que ja foi passado pelo recebido vira 0; o que ainda cabe fica', () => {
		expect(totalQueCabe(500, 400)).toBe(0);
		expect(totalQueCabe(400, 400)).toBe(400);
		expect(totalQueCabe(10, 0)).toBe(0);
	});

	it('no fluxo: o comprimido com o tamanho original avisa "X de Y" na unidade certa', async () => {
		const { resposta, soltar } = emFluxo(15);
		resposta.headers = cabecalhos({
			'content-type': 'application/octet-stream',
			'content-length': '15',
			'content-encoding': 'br',
			'x-tamanho-original': '40'
		});
		const recebido = [];
		const promessa = baixarComVigia('/comprimido.gnd', {
			buscar: () => Promise.resolve(resposta),
			aoReceber: (recebidos, total) => recebido.push([recebidos, total])
		});
		await vi.advanceTimersByTimeAsync(0);
		soltar(new Uint8Array(20));
		soltar(new Uint8Array(20));
		soltar(null);
		const r = await promessa;
		expect(r.bytes).toBe(40);
		expect(recebido).toEqual([
			[20, 40],
			[40, 40]
		]);
	});

	it('no fluxo: o servidor velho (so o Content-Length comprimido, encoding invisivel) nao avisa "20 de 15"', async () => {
		const { resposta, soltar } = emFluxo(15);
		const recebido = [];
		const promessa = baixarComVigia('/velho.gnd', {
			buscar: () => Promise.resolve(resposta),
			aoReceber: (recebidos, total) => recebido.push([recebidos, total])
		});
		await vi.advanceTimersByTimeAsync(0);
		soltar(new Uint8Array(10));
		soltar(new Uint8Array(10));
		soltar(null);
		await promessa;
		expect(recebido).toEqual([
			[10, 15],
			[20, 0]
		]);
	});

	it('sem corpo em fluxo (o caminho do arrayBuffer), a mesma regra', async () => {
		const resposta = binario(40);
		resposta.headers = cabecalhos({ 'content-type': 'application/octet-stream', 'content-length': '15', 'x-tamanho-original': '40' });
		const recebido = [];
		await baixarComVigia('/inteiro.gnd', {
			buscar: () => Promise.resolve(resposta),
			aoReceber: (recebidos, total) => recebido.push([recebidos, total])
		});
		expect(recebido).toEqual([[40, 40]]);
		const velho = binario(40);
		velho.headers = cabecalhos({ 'content-type': 'application/octet-stream', 'content-length': '15' });
		const doVelho = [];
		await baixarComVigia('/inteiro-velho.gnd', {
			buscar: () => Promise.resolve(velho),
			aoReceber: (recebidos, total) => doVelho.push([recebidos, total])
		});
		expect(doVelho).toEqual([[40, 0]]);
	});
});
