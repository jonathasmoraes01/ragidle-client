/**
 * AS DECISOES DO CACHE DE ARQUIVOS DO APARELHO (15/10/2026, D-2547..D-2549).
 * Puras: a versao, o nome do cache, o que entra, o teto e o despejo.
 */
import { describe, expect, it } from 'vitest';
import {
	CABECALHO_DA_VERSAO,
	FRACAO_DA_COTA,
	PREFIXO_DO_CACHE,
	TETO_DE_UM_ARQUIVO_BYTES,
	TETO_FIXO_BYTES,
	arquivoGuardavel,
	cachesParaApagar,
	despejo,
	erroDeCota,
	indiceConferido,
	nomeDoCache,
	podeGuardar,
	reconciliar,
	tetoTotal,
	totalDoIndice,
	versaoValida
} from 'Core/cacheDeArquivos.js';
import { CABECALHO_DA_VERSAO_DO_GRF, baixarComVigia, versaoDoGrfDe } from 'Core/baixarComVigia.js';

const MB = 1024 * 1024;

describe('a versao do GRF', () => {
	it('aceita a etiqueta do servidor e apara os espacos', () => {
		expect(versaoValida('a1-3fQx_9.k')).toBe('a1-3fQx_9.k');
		expect(versaoValida('  a1-abc  ')).toBe('a1-abc');
	});

	it('recusa o que nao e versao: vazio, barra, aspas, espaco no meio, longo demais, nao-texto', () => {
		for (const ruim of ['', '   ', 'application/octet-stream', '"a1"', 'a 1', 'x'.repeat(81), null, undefined, 7]) {
			expect(versaoValida(ruim), String(ruim)).toBeNull();
		}
		expect(versaoValida('x'.repeat(80))).toBe('x'.repeat(80));
	});

	it('o cabecalho e o mesmo dos dois lados (o vigia le, o cache decide)', () => {
		expect(CABECALHO_DA_VERSAO_DO_GRF).toBe(CABECALHO_DA_VERSAO);
		expect(CABECALHO_DA_VERSAO).toBe(CABECALHO_DA_VERSAO.toLowerCase());
	});

	it('o vigia devolve a versao junto com os bytes, no corpo inteiro e no corpo em pedacos', async () => {
		const cabecalhos = { get: n => ({ 'content-type': 'application/octet-stream', 'x-versao-do-grf': 'a1-x' })[n] ?? null };
		const inteiro = await baixarComVigia('/a.gnd', {
			buscar: () =>
				Promise.resolve({ ok: true, status: 200, headers: cabecalhos, arrayBuffer: async () => new ArrayBuffer(4) })
		});
		expect(inteiro.versaoDoGrf).toBe('a1-x');
		const pedacos = [new Uint8Array([1, 2]), new Uint8Array([3])];
		const leitor = {
			read: async () => (pedacos.length ? { done: false, value: pedacos.shift() } : { done: true }),
			cancel() {}
		};
		const emPedacos = await baixarComVigia('/b.gnd', {
			buscar: () => Promise.resolve({ ok: true, status: 200, headers: cabecalhos, body: { getReader: () => leitor } })
		});
		expect(emPedacos.bytes).toBe(3);
		expect(emPedacos.versaoDoGrf).toBe('a1-x');
	});

	it('o vigia le o cabecalho cru, e sem ele devolve null', () => {
		const de = mapa => ({ get: nome => (nome in mapa ? mapa[nome] : null) });
		expect(versaoDoGrfDe(de({ 'x-versao-do-grf': 'a1-x' }))).toBe('a1-x');
		expect(versaoDoGrfDe(de({}))).toBeNull();
		expect(versaoDoGrfDe(undefined)).toBeNull();
		expect(
			versaoDoGrfDe({
				get() {
					throw new Error('cabecalho');
				}
			})
		).toBeNull();
	});
});

describe('o nome do cache e quem sai dele', () => {
	it('o nome leva o prefixo, o esquema e a versao, e nunca o prefixo da casca do sw.js', () => {
		expect(nomeDoCache('a1-x')).toBe('ragidle-arquivos-1-a1-x');
		expect(PREFIXO_DO_CACHE.startsWith('ragidle-casca-')).toBe(false);
	});

	it('a versao nova apaga as velhas e o esquema velho, e deixa a casca do PWA', () => {
		const atual = nomeDoCache('a1-novo');
		const nomes = ['ragidle-casca-123', nomeDoCache('a1-velho'), 'ragidle-arquivos-0-a1-novo', atual, 'outro'];
		expect(cachesParaApagar(nomes, atual)).toEqual([nomeDoCache('a1-velho'), 'ragidle-arquivos-0-a1-novo']);
	});
});

describe('o que entra', () => {
	it('o som que o getHTTP nao baixa nao entra; o resto entra', () => {
		expect(arquivoGuardavel('data/wav/x.wav')).toBe(false);
		expect(arquivoGuardavel('bgm/01.mp3')).toBe(false);
		expect(arquivoGuardavel('data/prt_fild08.gnd')).toBe(true);
		expect(arquivoGuardavel('data/sprite/x.spr')).toBe(true);
		expect(arquivoGuardavel(undefined)).toBe(false);
	});

	const base = { versaoDaResposta: 'v1', versaoDaSessao: 'v1', bytes: 10, teto: TETO_FIXO_BYTES };

	it('so com a versao da resposta IGUAL a da sessao', () => {
		expect(podeGuardar(base)).toBe(true);
		expect(podeGuardar({ ...base, versaoDaResposta: 'v0' })).toBe(false);
		expect(podeGuardar({ ...base, versaoDaSessao: null, versaoDaResposta: null })).toBe(false);
		expect(podeGuardar({ ...base, versaoDaResposta: null })).toBe(false);
	});

	it('nem vazio, nem maior que o teto de um arquivo, nem maior que o teto total', () => {
		expect(podeGuardar({ ...base, bytes: 0 })).toBe(false);
		expect(podeGuardar({ ...base, bytes: TETO_DE_UM_ARQUIVO_BYTES })).toBe(true);
		expect(podeGuardar({ ...base, bytes: TETO_DE_UM_ARQUIVO_BYTES + 1 })).toBe(false);
		expect(podeGuardar({ ...base, bytes: 11, teto: 10 })).toBe(false);
		expect(podeGuardar({ ...base, bytes: 10, teto: 10 })).toBe(true);
	});
});

describe('o teto', () => {
	it('150 MiB fixos, ou 20% da cota quando ela e menor', () => {
		expect(TETO_FIXO_BYTES).toBe(150 * MB);
		expect(FRACAO_DA_COTA).toBe(0.2);
		expect(tetoTotal(0)).toBe(150 * MB);
		expect(tetoTotal(NaN)).toBe(150 * MB);
		expect(tetoTotal(10_000 * MB)).toBe(150 * MB);
		expect(tetoTotal(500 * MB)).toBe(100 * MB);
		expect(tetoTotal(1001)).toBe(200);
	});
});

describe('o indice e o despejo', () => {
	const indice = () => ({
		uso: 5,
		arquivos: {
			a: { bytes: 4, uso: 1 },
			b: { bytes: 4, uso: 3 },
			c: { bytes: 4, uso: 2 }
		}
	});

	it('o total soma os bytes', () => {
		expect(totalDoIndice(indice())).toBe(12);
	});

	it('cabe sem despejar: ninguem sai', () => {
		expect(despejo(indice(), 20, 'd', 8)).toEqual([]);
		expect(despejo(indice(), 16, 'd', 4)).toEqual([]);
	});

	it('sai o menos usado ha mais tempo primeiro, so o necessario', () => {
		expect(despejo(indice(), 16, 'd', 5)).toEqual(['a']);
		expect(despejo(indice(), 16, 'd', 9)).toEqual(['a', 'c']);
		expect(despejo(indice(), 16, 'd', 16)).toEqual(['a', 'c', 'b']);
	});

	it('o arquivo que se regrava nao conta contra si mesmo', () => {
		expect(despejo(indice(), 12, 'a', 4)).toEqual([]);
	});

	it('maior que o teto: null (nem com o cache vazio cabe)', () => {
		expect(despejo(indice(), 16, 'd', 17)).toBeNull();
	});

	it('o indice lido e conferido campo a campo', () => {
		expect(indiceConferido(null)).toEqual({ uso: 0, arquivos: {} });
		expect(indiceConferido({ arquivos: 3 })).toEqual({ uso: 0, arquivos: {} });
		const lido = indiceConferido({
			uso: 2,
			arquivos: { boa: { bytes: 3, uso: 9 }, semBytes: { uso: 1 }, zero: { bytes: 0, uso: 1 }, semUso: { bytes: 3 } }
		});
		expect(lido).toEqual({ uso: 9, arquivos: { boa: { bytes: 3, uso: 9 } } });
		expect(indiceConferido({ uso: -4, arquivos: {} }).uso).toBe(0);
	});

	it('a reconciliacao tira do indice o que o cache perdeu e devolve as orfas', () => {
		const r = reconciliar(indice(), ['a', 'c', 'x']);
		expect(Object.keys(r.indice.arquivos).sort()).toEqual(['a', 'c']);
		expect(r.orfas).toEqual(['x']);
		expect(r.indice.uso).toBe(5);
	});

	it('o erro de cota e reconhecido pelo nome ou pelo codigo antigo', () => {
		expect(erroDeCota({ name: 'QuotaExceededError' })).toBe(true);
		expect(erroDeCota({ code: 22 })).toBe(true);
		expect(erroDeCota(new Error('outra'))).toBe(false);
		expect(erroDeCota(null)).toBe(false);
	});
});
