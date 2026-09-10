/**
 * A AREA DE TOQUE ANCORA NO PROPRIO BOTAO (10/09/2026).
 *
 * `Common.css` aumenta o alvo de dedo dos botoes pequenos com um `::before`
 * transparente, absoluto e com `inset` negativo — a area cresce, o desenho nao.
 * So que `position: absolute` ancora no ancestral POSICIONADO mais proximo: se
 * o botao for estatico, a "area de 44px" vira o tamanho de alguma caixa la em
 * cima, e varios botoes empilham areas do tamanho da janela.
 *
 * Foi o relato do alfa *"nao da pra colocar os pontos de atributo no mobile"*:
 * o `.st-stat-up` era estatico, e a `prove:jogador-no-celular` mediu o toque no
 * "+" de STR subindo DEX, e o de VIT subindo INT. Os vizinhos do mesmo bloco ja
 * tinham o par certo; ele era o unico sem.
 *
 * Este portao cobra a REGRA, e nao so o caso: todo seletor que ganha esse
 * `::before` em `Common.css` tem de ser posicionado — por uma regra dele (no
 * `Common.css` ou no CSS do componente) OU por outra classe do MESMO elemento,
 * como o `<button class="bi-minimize ri-close">` do painel de personagem, que
 * herda o `position: absolute` do `.ri-close`. A primeira versao deste portao
 * so conhecia a primeira via e acusou o minimizar sem motivo; um portao que
 * grita falso vira portao ignorado.
 *
 * Le os fontes, porque estilo computado exige navegador.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(process.cwd(), 'src');
const CAMINHO_DO_COMMON = join(RAIZ, 'UI', 'Common.css');
const ler = caminho => readFileSync(caminho, 'utf8').replace(/\r\n/g, '\n');

function arquivos(pasta, extensao) {
	const achados = [];
	for (const nome of readdirSync(pasta)) {
		const caminho = join(pasta, nome);
		if (statSync(caminho).isDirectory()) achados.push(...arquivos(caminho, extensao));
		else if (nome.endsWith(extensao)) achados.push(caminho);
	}
	return achados;
}

/** As regras `seletores { corpo }` de um CSS, sem comentarios. */
function regras(texto) {
	const limpo = texto.replace(/\/\*[\s\S]*?\*\//g, '');
	const achadas = [];
	for (const m of limpo.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
		const seletores = m[1]
			.split(',')
			.map(s => s.trim())
			.filter(Boolean);
		achadas.push({ seletores, corpo: m[2] });
	}
	return achadas;
}

/** Os seletores que ganham a area de toque absoluta com `inset` negativo. */
function comAreaDeToque(common) {
	const alvos = new Set();
	for (const { seletores, corpo } of regras(common)) {
		if (!/position:\s*absolute/.test(corpo) || !/inset:\s*-/.test(corpo)) continue;
		for (const s of seletores) {
			if (s.endsWith('::before')) alvos.add(s.slice(0, -'::before'.length).trim());
		}
	}
	return [...alvos];
}

const POSICIONADO = /position:\s*(relative|absolute|fixed|sticky)/;

function seletoresPosicionados(textos) {
	const posicionados = new Set();
	for (const texto of textos) {
		for (const { seletores, corpo } of regras(texto)) {
			if (!POSICIONADO.test(corpo)) continue;
			for (const s of seletores) posicionados.add(s);
		}
	}
	return posicionados;
}

/** A lista de classes de cada elemento dos templates HTML do cliente. */
function listasDeClasse() {
	const listas = [];
	for (const arquivo of arquivos(RAIZ, '.html')) {
		for (const m of ler(arquivo).matchAll(/class="([^"]+)"/g)) {
			listas.push(m[1].split(/\s+/).filter(Boolean));
		}
	}
	return listas;
}

/**
 * Os botoes com a area de toque que NAO estao posicionados: nem por regra
 * propria, nem por outra classe de TODO elemento que carrega a classe deles.
 */
function soltos(common, outrosCss, listas) {
	const posicionados = seletoresPosicionados([common, ...outrosCss]);
	return comAreaDeToque(common).filter(alvo => {
		if (posicionados.has(alvo)) return false;
		const classe = /^\.([\w-]+)$/.exec(alvo);
		if (classe === null) return true;
		const doAlvo = listas.filter(lista => lista.includes(classe[1]));
		const porOutraClasse =
			doAlvo.length > 0 &&
			doAlvo.every(lista => lista.some(c => c !== classe[1] && posicionados.has(`.${c}`)));
		return !porOutraClasse;
	});
}

const COMMON = ler(CAMINHO_DO_COMMON);
const OUTROS = arquivos(RAIZ, '.css')
	.filter(caminho => caminho !== CAMINHO_DO_COMMON)
	.map(ler);
const LISTAS = listasDeClasse();

describe('a area de toque de cada botao ancora nele mesmo', () => {
	it('o aparelho mede alguma coisa: ha botoes com a area de toque, e o do atributo e um deles', () => {
		const alvos = comAreaDeToque(COMMON);
		expect(alvos.length, 'a leitura do Common.css parou de achar a area de toque').toBeGreaterThan(4);
		expect(alvos).toContain('.st-stat-up');
		expect(LISTAS.length, 'a leitura dos templates parou de achar classes').toBeGreaterThan(100);
	});

	it('todo botao com a area de toque e posicionado (por regra propria ou por outra classe do elemento)', () => {
		expect(
			soltos(COMMON, OUTROS, LISTAS),
			'botao com `::before` absoluto de area de toque e SEM position: a area ancora fora dele'
		).toEqual([]);
	});

	it('o portao pega o defeito de 10/09: sem o position do "+", ele reprova nomeando o "+"', () => {
		const semOConserto = COMMON.replace(/\.st-stat-up\s*\{\s*position:\s*relative;\s*\}/, '');
		expect(semOConserto, 'o conserto do "+" saiu do Common.css').not.toBe(COMMON);
		expect(soltos(semOConserto, OUTROS, LISTAS)).toContain('.st-stat-up');
	});

	it('e aceita a outra via: o minimizar do painel e posicionado pela classe ri-close do mesmo botao', () => {
		expect(LISTAS.some(lista => lista.includes('bi-minimize') && lista.includes('ri-close'))).toBe(true);
		expect(soltos(COMMON, OUTROS, LISTAS)).not.toContain('.bi-minimize');
	});
});
