/**
 * A FORJA (janela de Refino) NO DESIGN SYSTEM (01/09/2026).
 *
 * Queixa do dono, com print: *"Está totalmente disproporcional"*.
 *
 * A causa nao era alinhamento: esta janela nunca foi HTML. Ela era UM bitmap
 * de 262x301 do GRF (`bg_refining_*.bmp`) que desenhava a moldura inteira —
 * painel de cima, cinco sockets hexagonais, bigorna e ate as plaquinhas dos
 * botoes — com os elementos vivos cravados em pixel por cima. Na Fase 3 a
 * moldura virou `.ri-window` e o bitmap FICOU: um desenho de janela de 301px
 * dentro de uma janela de 350, rodape novo por cima da plaquinha desenhada, e
 * o botao "de novo" (bitmap 101x50) lendo como uma segunda janela.
 *
 * ===========================================================================
 * POR QUE O PORTAO MEDE ISTO, E NAO "a janela esta bonita"
 * ===========================================================================
 * `Refine.js` inteiro e escrito no padrao
 *
 *     const el = root.querySelector('.alguma_coisa');
 *     if (el) { ... }
 *
 * — 40 e tantas vezes. Esse `if` e uma defesa contra `null`, mas tem um preco:
 * uma classe renomeada no HTML NAO quebra nada. O codigo roda, verde, e a
 * funcionalidade some da tela sem uma linha de erro. E a forma ja catalogada
 * nesta casa ("prova verde e jogador vendo nada", a mesma de
 * `janelaDeRefinoLigada.test.js`), e um redesenho e exatamente o momento em
 * que ela acontece: o HTML e reescrito do zero, o JS nao.
 *
 * Entao o portao cobra o CONTRATO entre os dois arquivos: toda classe que o
 * JS procura tem de existir no HTML, ou estar declarada aqui como criada em
 * tempo de execucao. Nada de medir aparencia.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PASTA = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'../../src/UI/Components/Refine'
);

const JS = fs.readFileSync(path.join(PASTA, 'Refine.js'), 'utf8');
const HTML = fs.readFileSync(path.join(PASTA, 'Refine.html'), 'utf8');
const CSS = fs.readFileSync(path.join(PASTA, 'Refine.css'), 'utf8');

/**
 * As classes que o proprio JS INSERE no DOM e que por isso nao moram no HTML:
 * o ladrilho de item (`insertAdjacentHTML`, quatro lugares) e o numero da
 * chance, que nasce dentro do `initialsuccess`. Lista fechada de proposito:
 * se um dia uma delas deixar de ser criada pelo JS, tirar daqui faz o portao
 * cobrar o HTML.
 */
const CRIADAS_EM_TEMPO_DE_EXECUCAO = new Set(['item', 'icon', 'grade', 'mat_count', 'number']);

/** Toda classe citada num seletor de `querySelector`/`querySelectorAll`. */
function classesProcuradasPeloJs(fonte) {
	const classes = new Set();
	for (const achado of fonte.matchAll(/querySelector(?:All)?\(\s*'([^']+)'/g)) {
		for (const token of achado[1].matchAll(/\.([A-Za-z_][\w-]*)/g)) {
			classes.add(token[1]);
		}
	}
	/* `.material_${idx}` e montado por template literal — o laco de materiais
	   percorre `refiningMaterials`, entao os quatro slots precisam existir. */
	if (/querySelector\(\s*`\.material_\$\{/.test(fonte)) {
		[0, 1, 2, 3].forEach(i => classes.add(`material_${i}`));
	}
	return classes;
}

/** Toda classe declarada em algum `class="..."` do HTML. */
function classesDoHtml(fonte) {
	const classes = new Set();
	for (const achado of fonte.matchAll(/class="([^"]+)"/g)) {
		for (const nome of achado[1].split(/\s+/)) {
			if (nome) {
				classes.add(nome);
			}
		}
	}
	return classes;
}

describe('a forja e o design system', () => {
	it('toda classe que o Refine.js procura existe no Refine.html', () => {
		const procuradas = classesProcuradasPeloJs(JS);
		const declaradas = classesDoHtml(HTML);

		expect(procuradas.size, 'nenhum seletor encontrado — o Refine.js mudou de forma').toBeGreaterThan(
			20
		);

		const orfas = [...procuradas].filter(
			nome => !declaradas.has(nome) && !CRIADAS_EM_TEMPO_DE_EXECUCAO.has(nome)
		);

		expect(
			orfas,
			`o JS procura estas classes e o HTML nao tem nenhuma: ${orfas.join(', ')}. ` +
				'Cada `querySelector` do Refine.js esta atras de um `if (el)`, entao isto NAO ' +
				'lanca erro em jogo — a funcionalidade some calada.'
		).toEqual([]);
	});

	/**
	 * O bitmap que era MOLDURA nao pode voltar.
	 *
	 * A cena animada da fornalha (`bg_refining_*.bmp`, carregada pelo
	 * `controlPhase`) continua e deve continuar: ela e ARTE de conteudo. O que
	 * nao volta e o chrome — os sockets hexagonais e as plaquinhas de botao,
	 * que agora sao `.ri-tile` e `.ri-btn`. Meia troca foi o que produziu o
	 * print do dono.
	 */
	it('a moldura nao volta a ser bitmap do GRF', () => {
		const chrome = ['slot_select_', 'bt_refining_'];
		const reincidentes = chrome.filter(peca => HTML.includes(peca));
		expect(
			reincidentes,
			`arte de chrome de volta no HTML: ${reincidentes.join(', ')} — sockets e botoes ` +
				'moram no design system (.ri-tile / .ri-btn) desde 01/09/2026'
		).toEqual([]);
	});

	it('a janela usa as pecas do design system', () => {
		for (const peca of ['ri-window', 'ri-header', 'ri-title', 'ri-close', 'ri-btn', 'ri-tile']) {
			expect(HTML.includes(peca), `a forja deixou de usar \`.${peca}\``).toBe(true);
		}
	});

	/**
	 * PIXEL CRAVADO no tamanho da janela.
	 *
	 * Largura/altura em porcentagem colapsam dentro do Shadow DOM e a janela
	 * SOME — a cicatriz de Enchant/EnchantGrade, e a armadilha que custou uma
	 * frota inteira em 01/09. O portao cobra numero em `px` nos dois lugares
	 * que decidem o tamanho (`:host` e `#Refine`).
	 */
	it('o tamanho da janela e cravado em px, nunca em porcentagem', () => {
		const host = CSS.match(/:host\s*\{([^}]*)\}/);
		expect(host, 'sumiu o bloco `:host` do Refine.css').not.toBeNull();
		expect(/width:\s*\d+px/.test(host[1]), '`:host` sem largura em px').toBe(true);
		expect(/height:\s*\d+px/.test(host[1]), '`:host` sem altura em px').toBe(true);

		const janela = CSS.match(/#Refine\s*\{([^}]*)\}/);
		expect(janela, 'sumiu o bloco `#Refine` do Refine.css').not.toBeNull();
		expect(/width:\s*\d+px/.test(janela[1]), '`#Refine` sem largura em px').toBe(true);
		expect(/height:\s*\d+px/.test(janela[1]), '`#Refine` sem altura em px').toBe(true);
	});

	/**
	 * O BOTAO DE FECHAR NAO PODE CARREGAR `.base` (foto do dono, 01/09/2026).
	 *
	 * A marcacao herdada dava ao X `class="base close ri-close"`, e cada uma
	 * destas janelas tem uma regra para a alca invisivel de arrasto:
	 *
	 *     #Refine .titlebar .base { position: absolute; left: 0; top: 0; ... }
	 *
	 * Id + duas classes ganha de `.ri-close` (uma classe), entao o X ia parar
	 * no canto SUPERIOR ESQUERDO, esticado na altura do cabecalho. Nao e um
	 * escorregao de uma janela: a mesma dupla estava em ItemReform, LaphineSys
	 * e LaphineUpg, palavra por palavra — marcacao copiada carrega o defeito
	 * junto, e por isso o portao mede a MARCACAO e nao a posicao.
	 *
	 * O seletor da regra tambem passou a exigir DIV, mas isso e a segunda
	 * defesa; a primeira e esta.
	 */
	it('o botao de fechar nao herda a classe da alca de arrasto', () => {
		const botaoFechar = HTML.match(/<button[^>]*\bri-close\b[^>]*>/);
		expect(botaoFechar, 'sumiu o botao `.ri-close` do cabecalho').not.toBeNull();
		expect(
			/\bclass="[^"]*\bbase\b/.test(botaoFechar[0]),
			'o X voltou a carregar `.base`: a regra `.titlebar .base` tem especificidade ' +
				'maior que `.ri-close` e joga o botao para o canto superior esquerdo'
		).toBe(false);

		/* E a alca continua existindo como DIV — e ela que o JS escuta. */
		expect(
			/<div class="base"><\/div>/.test(HTML),
			'a alca de arrasto tem de continuar sendo um `<div class="base">`'
		).toBe(true);
	});

	/**
	 * A msgstringtable do cliente coreano e que fazia esta janela se chamar
	 * "Try Again" no print (msg 3241). O texto do jogador e nosso, como nas
	 * outras janelas da Fase 3.
	 */
	it('os rotulos sao nossos, nao a msgstringtable', () => {
		expect(/<ui-text/.test(HTML), 'voltou `ui-text` no HTML da forja').toBe(false);
		expect(HTML.includes('>Forja<'), 'a janela perdeu o titulo em portugues').toBe(true);
	});
});
