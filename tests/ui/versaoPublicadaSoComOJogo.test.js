/**
 * A VERSAO PUBLICADA SO SAI COM O JOGO (29/09/2026, D-1822 do servidor - o
 * achado #13 da revisao).
 *
 * `versao-do-cliente.json` era escrito no passo da CASCA (`copyPwaFiles`), e um
 * build parcial (`--PWA` sem `-O`) publicava um carimbo novo com o `Online.js`
 * de antes. O servidor subia o minimo para essa versao dez minutos depois, e
 * todo login era recusado. Aqui:
 *
 *  - o COMPORTAMENTO do publicador, numa pasta temporaria: escreve a versao que
 *    esta DENTRO do Online.js, e RECUSA (sem escrever) quando o jogo gerado nao
 *    a traz - o caso do build parcial, em que o jogo e o de antes;
 *  - a COSTURA no builder (lendo o fonte): o publicador so e chamado no passo
 *    que compila o Online.js, DEPOIS do `build` do vite, e o passo da casca nao
 *    escreve mais o arquivo.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ARQUIVO_DA_VERSAO, apagarVersaoPublicada, escreverVersaoPublicada } from '../../applications/tools/versaoPublicada.mjs';

const COMPILADA = '2.0.0-20260929100000';
const OUTRA = '2.0.0-20260929113000';

let pasta;
beforeEach(() => {
	pasta = mkdtempSync(join(tmpdir(), 'ragidle-versao-publicada-'));
});
afterEach(() => {
	rmSync(pasta, { recursive: true, force: true });
});

/** Um Online.js como o vite o deixa: o `define` vira o literal da versao. */
function jogoCom(versao) {
	writeFileSync(join(pasta, 'Online.js'), `const VERSAO_DO_BUILD = "${versao}";\nexport {};\n`);
}

const publicado = () => JSON.parse(readFileSync(join(pasta, ARQUIVO_DA_VERSAO), 'utf8'));

describe('o publicador (comportamento)', () => {
	it('escreve a versao compilada no jogo, com o numero do login (AAMMDDHHMM)', () => {
		jogoCom(COMPILADA);
		expect(escreverVersaoPublicada(pasta, COMPILADA)).toEqual({ versao: COMPILADA, login: 2609291000 });
		expect(publicado()).toEqual({ versao: COMPILADA, login: 2609291000 });
	});

	it('o jogo gerado NAO traz a versao (o jogo servido e outro): recusa, e nao escreve', () => {
		jogoCom(COMPILADA);
		expect(() => escreverVersaoPublicada(pasta, OUTRA)).toThrow(/nao traz a versao/);
		expect(existsSync(join(pasta, ARQUIVO_DA_VERSAO))).toBe(false);
	});

	it('uma recusa nao apaga nem troca a versao que ja estava publicada com o jogo dela', () => {
		jogoCom(COMPILADA);
		escreverVersaoPublicada(pasta, COMPILADA);
		expect(() => escreverVersaoPublicada(pasta, OUTRA)).toThrow();
		expect(publicado().versao).toBe(COMPILADA);
	});

	it('versao sem o carimbo de 14 digitos recusa (o login mandaria zero)', () => {
		jogoCom('2.0.0');
		expect(() => escreverVersaoPublicada(pasta, '2.0.0')).toThrow(/carimbo/);
		expect(existsSync(join(pasta, ARQUIVO_DA_VERSAO))).toBe(false);
	});

	it('sem Online.js nao ha o que publicar', () => {
		expect(() => escreverVersaoPublicada(pasta, COMPILADA)).toThrow();
		expect(existsSync(join(pasta, ARQUIVO_DA_VERSAO))).toBe(false);
	});

	it('apagar tira a versao de antes, e apagar o que nao existe nao falha', () => {
		jogoCom(COMPILADA);
		escreverVersaoPublicada(pasta, COMPILADA);
		apagarVersaoPublicada(pasta);
		expect(existsSync(join(pasta, ARQUIVO_DA_VERSAO))).toBe(false);
		expect(() => apagarVersaoPublicada(pasta)).not.toThrow();
	});
});

describe('a costura no builder (lendo o fonte)', () => {
	const BUILDER = readFileSync('applications/tools/builder-web.mjs', 'utf8').replace(/\r\n/g, '\n');
	const inicioDoCompile = BUILDER.indexOf('async function compile(appName, isMinify) {');
	const fimDoCompile = BUILDER.indexOf('\nfunction createHTML(');
	const compile = BUILDER.slice(inicioDoCompile, fimDoCompile);
	const inicioDaCasca = BUILDER.indexOf('async function copyPwaFiles() {');
	const casca = BUILDER.slice(inicioDaCasca, BUILDER.indexOf('\nfunction copyFolder(', inicioDaCasca));

	it('os recortes acharam as duas funcoes (controle)', () => {
		expect(inicioDoCompile).toBeGreaterThan(0);
		expect(fimDoCompile).toBeGreaterThan(inicioDoCompile);
		expect(inicioDaCasca).toBeGreaterThan(0);
		expect(casca.length).toBeGreaterThan(100);
	});

	it('o passo da CASCA nao escreve mais a versao publicada', () => {
		expect(casca).not.toContain('versao-do-cliente.json\'');
		expect(casca).not.toContain('escreverVersaoPublicada(');
		expect(casca).not.toMatch(/writeFileSync\([^)]*versao-do-cliente/);
	});

	it('so o passo do Online.js a escreve, DEPOIS do build do vite, e o builder inteiro a escreve num lugar so', () => {
		expect(BUILDER.split('escreverVersaoPublicada(').length - 1).toBe(1);
		const chamada = compile.indexOf('escreverVersaoPublicada(outDir, versaoDoBuild);');
		expect(chamada).toBeGreaterThan(compile.indexOf('await build('));
		// Dentro do `if (appName === 'Online')` que vem depois do build.
		const ramoDoOnline = compile.lastIndexOf("if (appName === 'Online') {", chamada);
		expect(ramoDoOnline).toBeGreaterThan(compile.indexOf('await build('));
	});

	it('a versao de antes sai ANTES de compilar o Online.js', () => {
		const apagar = compile.indexOf('apagarVersaoPublicada(outDir);');
		expect(apagar).toBeGreaterThan(0);
		expect(apagar).toBeLessThan(compile.indexOf('await build('));
	});

	it('a recusa do publicador faz o build sair com erro (o deploy nao segue calado)', () => {
		const chamada = compile.indexOf('escreverVersaoPublicada(outDir, versaoDoBuild);');
		expect(compile.slice(chamada, chamada + 200)).toContain('process.exitCode = 1;');
	});
});
