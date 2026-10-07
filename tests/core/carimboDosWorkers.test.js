// @vitest-environment node
/**
 * O WORKER SAI COM O MESMO CARIMBO DO PRINCIPAL (07/10/2026, D-2075 do servidor).
 *
 * No deploy da leva 1 o `Online.js?v=<novo>` conversou com um
 * `ThreadEventHandler.js` de outro build: a URL do worker era relativa ao
 * principal e perdia o `?v=`, e o navegador devolvia a copia que guardou em
 * setembro, quando o arquivo era servido `immutable` por um ano. 23 relatos de
 * `Can't find file "[object Object]"` no /analytics.
 *
 * Este arquivo compila uma fixture com as MESMAS opcoes do builder
 * (`opcoesDoVite`), com as duas formas de criar worker que o cliente usa, e
 * reprova a URL de worker sem o carimbo. O controle positivo (sem o plugin)
 * prova que a busca enxerga a forma real do vite - um detector que nao acha
 * nada aprovaria de graca.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build } from 'vite';
import {
	carimbarUrlsDeScript,
	conferirCarimboDosWorkers,
	urlsDeScriptSemCarimbo
} from '../../applications/tools/carimboDosWorkers.mjs';
import { opcoesDoVite } from '../../applications/tools/opcoesDoVite.mjs';

const RAIZ = resolve(__dirname, '../..');
const FIXTURE = resolve(__dirname, '../fixtures/workers-com-carimbo/principal.js');
const CARIMBO = '1791234567890';

async function compilar({ comPlugin = true, minificar = false } = {}) {
	const opcoes = opcoesDoVite({
		projectRoot: RAIZ,
		entry: FIXTURE,
		outDir: join(tmpdir(), 'ragidle-carimbo-nao-escreve'),
		appName: 'Principal',
		aliases: {},
		isMinify: minificar,
		versaoDoBuild: '0.0.0-teste',
		carimbo: CARIMBO,
		header: '/* teste */'
	});
	if (!comPlugin) {
		opcoes.plugins = [];
	}
	opcoes.build.write = false;
	const saida = await build(opcoes);
	const lista = Array.isArray(saida) ? saida.flatMap(s => s.output) : saida.output;
	const principal = lista.find(s => s.type === 'chunk' && s.fileName === 'Principal.js');
	return { principal, arquivos: lista.map(s => s.fileName) };
}

describe('o bundle do builder carimba os workers', () => {
	let comPlugin;
	let semPlugin;
	let minificado;

	beforeAll(async () => {
		comPlugin = await compilar();
		semPlugin = await compilar({ comPlugin: false });
		minificado = await compilar({ minificar: true });
	}, 120_000);

	it('o controle: sem o plugin, a forma real do vite sai SEM carimbo e a busca a ve', () => {
		expect(urlsDeScriptSemCarimbo(semPlugin.principal.code).sort()).toEqual(['caminho.js', 'trabalho.js']);
	});

	it('os dois workers saem com nome fixo, ao lado do principal (o que o vercel.json e o SW tratam)', () => {
		expect(comPlugin.arquivos).toEqual(expect.arrayContaining(['Principal.js', 'trabalho.js', 'caminho.js']));
	});

	it('com as opcoes do builder, nenhuma URL de worker fica sem o carimbo', () => {
		expect(urlsDeScriptSemCarimbo(comPlugin.principal.code)).toEqual([]);
		expect(comPlugin.principal.code).toContain(`trabalho.js?v=${CARIMBO}`);
		expect(comPlugin.principal.code).toContain(`caminho.js?v=${CARIMBO}`);
	});

	it('o build minificado (terser) tambem sai carimbado', () => {
		expect(urlsDeScriptSemCarimbo(minificado.principal.code)).toEqual([]);
		expect(minificado.principal.code).toContain(`trabalho.js?v=${CARIMBO}`);
		expect(minificado.principal.code).toContain(`caminho.js?v=${CARIMBO}`);
	});

	it('a URL carimbada resolve ao lado do principal, com o carimbo na query', () => {
		const principal = 'https://play.exemplo/Online.js?v=' + CARIMBO;
		const nome = comPlugin.principal.code.match(/new URL\("(trabalho\.js\?v=\d+)"/)[1];
		const url = new URL(nome, principal);
		expect(url.pathname).toBe('/trabalho.js');
		expect(url.searchParams.get('v')).toBe(CARIMBO);
	});
});

describe('a conferencia do arquivo gerado (o builder falha alto)', () => {
	let pasta;
	beforeAll(() => {
		pasta = mkdtempSync(join(tmpdir(), 'ragidle-carimbo-'));
	});
	afterAll(() => rmSync(pasta, { recursive: true, force: true }));

	it('reprova o worker sem carimbo, dizendo qual', () => {
		const arquivo = join(pasta, 'Online.js');
		writeFileSync(arquivo, '_source = new Worker(new URL("ThreadEventHandler.js", import.meta.url));');
		expect(() => conferirCarimboDosWorkers(arquivo, CARIMBO)).toThrow(/ThreadEventHandler\.js/);
	});

	it('aprova o carimbado e devolve quem tem ESTE carimbo (e nao outro)', () => {
		const arquivo = join(pasta, 'Online.js');
		writeFileSync(
			arquivo,
			`a = new URL("ThreadEventHandler.js?v=${CARIMBO}", import.meta.url); b = new URL('PathFindingWorker.js?v=999', import.meta.url);`
		);
		expect(conferirCarimboDosWorkers(arquivo, CARIMBO)).toEqual(['ThreadEventHandler.js']);
	});
});

describe('a costura no builder (lendo o fonte; a prova de verdade e o build com o plugin tirado, que sai 1)', () => {
	const builder = readFileSync(resolve(RAIZ, 'applications/tools/builder-web.mjs'), 'utf8');
	const compile = builder.slice(builder.indexOf('async function compile('), builder.indexOf('function createHTML('));

	it('o carimbo dos workers e o MESMO numero do ?v= do api.html', () => {
		expect(builder).toContain('const CARIMBO = String(startTime);');
		expect(builder).toContain("import('./' + scriptFile + '?v=${startTime}')");
		expect(compile).toContain('carimbo: CARIMBO,');
	});

	it('a conferencia vem DEPOIS do build e ANTES da versao publicada', () => {
		const construir = compile.indexOf('await build(');
		const conferir = compile.indexOf('conferirCarimboDosWorkers(');
		const publicar = compile.indexOf('escreverVersaoPublicada(outDir, versaoDoBuild);');
		expect(construir).toBeGreaterThan(0);
		expect(conferir).toBeGreaterThan(construir);
		expect(publicar).toBeGreaterThan(conferir);
	});
});

describe('as regras do texto', () => {
	it('cola o carimbo so em script relativo, sem tocar data:, http: nem quem ja tem query', () => {
		const codigo = [
			'new URL("ThreadEventHandler.js", import.meta.url)',
			"new URL('./PathFindingWorker.js',import.meta.url)",
			'new URL("ja.js?v=1", import.meta.url)',
			'new URL("data:text/javascript,1", import.meta.url)',
			'new URL("https://cdn/x.js", import.meta.url)',
			'new URL("imagem.png", import.meta.url)',
			'new URL("index.js", document.baseURI)'
		].join('\n');
		const saida = carimbarUrlsDeScript(codigo, CARIMBO).split('\n');
		expect(saida[0]).toBe(`new URL("ThreadEventHandler.js?v=${CARIMBO}", import.meta.url)`);
		expect(saida[1]).toBe(`new URL('./PathFindingWorker.js?v=${CARIMBO}',import.meta.url)`);
		expect(saida.slice(2)).toEqual(codigo.split('\n').slice(2));
	});

	it('a query sem v= conta como sem carimbo', () => {
		expect(urlsDeScriptSemCarimbo('new URL("w.js?x=1", import.meta.url)')).toEqual(['w.js']);
		expect(urlsDeScriptSemCarimbo('new URL("w.js?x=1&v=7", import.meta.url)')).toEqual([]);
	});

	it('carimbo vazio ou com caractere de URL e recusado', () => {
		expect(() => carimbarUrlsDeScript('', '')).toThrow(/Carimbo invalido/);
		expect(() => carimbarUrlsDeScript('', '1&x=2')).toThrow(/Carimbo invalido/);
	});
});
