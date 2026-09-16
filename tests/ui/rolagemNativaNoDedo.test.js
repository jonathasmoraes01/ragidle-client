/**
 * NO DEDO, QUEM ROLA E O NAVEGADOR (D-1489, 15/09/2026).
 *
 * ---------------------------------------------------------------------------
 * O RELATO, E O QUE A MEDICAO ACHOU
 * ---------------------------------------------------------------------------
 * Dono, no iPhone: *"nao conseguimos descer a janela do menu (arrastar para
 * baixo)"*.
 *
 * Medido no aparelho emulado (402x714, dedo), com o menu aberto e o jogo
 * rodando de verdade:
 *
 *   scrollHeight 369 · clientHeight 309  -> 60px de conteudo escondido
 *   overflow-y COMPUTADO: `hidden`       -> com a folha declarando `auto`
 *   estilo inline: "overflow-y: hidden; box-sizing: border-box; padding-right: 8px"
 *
 * O escondido era o botao "Instalar app" INTEIRO (topo em 640, com a caixa da
 * folha terminando em 640) — a barra azul cortada que aparecia no print dele.
 *
 * **Quem escreve o `hidden` e `UI/Scrollbar.js`, INLINE** (por isso vence a
 * folha de estilo): a barra legada do roBrowser desliga a rolagem nativa e
 * desenha um puxador com a arte do RO, feito para ser ARRASTADO COM O MOUSE.
 * Num celular nao ha o que pegar — o dedo escorrega sobre os botoes e a lista
 * nao anda.
 *
 * E **nao era do menu**: a varredura que aplica essa barra roda em
 * `GUIComponent`, sobre TODO elemento com `overflow-y: auto` de TODA janela.
 * Por isso a guarda mora la, num lugar so.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTE TESTE LE O FONTE
 * ---------------------------------------------------------------------------
 * O defeito so existe com um `GUIComponent` montado, com folha de estilo
 * aplicada e layout resolvido — tres coisas que o jsdom nao faz. A prova de
 * verdade foi feita no navegador e esta transcrita acima, com os numeros.
 *
 * O que ESTE arquivo impede e a REGRESSAO barata: alguem tirar a guarda sem
 * saber por que ela existe. Ele le o fonte com os comentarios REMOVIDOS — sem
 * isso passaria pela propria prosa que explica o conserto.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const GUI = readFileSync('src/UI/GUIComponent.js', 'utf8');
const BARRA = readFileSync('src/UI/Scrollbar.js', 'utf8');

/** O codigo, sem os comentarios que narram o conserto. */
function semComentario(texto) {
	return texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

const GUI_CRU = semComentario(GUI);

describe('a barra legada do RO nao pisa na rolagem do dedo', () => {
	it('CONTROLE: a barra legada realmente desliga a rolagem nativa', () => {
		/*
		 * Sem este caso os outros dois perdem o sentido: se a barra parasse de
		 * escrever `overflow-y: hidden`, a guarda deixaria de ser necessaria e
		 * ninguem saberia. Ele fixa a PREMISSA do conserto.
		 */
		expect(
			semComentario(BARRA),
			'a barra legada parou de escrever `overflow-y: hidden` — se isso for de proposito, esta guarda pode sair'
		).toMatch(/style\.overflowY\s*=\s*'hidden'/);
	});

	it('a varredura de barras SAI antes de tocar em qualquer no quando o ponteiro e dedo', () => {
		const i = GUI_CRU.indexOf('const checkScrollbars');
		expect(i, 'sumiu a varredura de barras').toBeGreaterThan(-1);
		const corpo = GUI_CRU.slice(i, i + 400);
		expect(corpo, 'a guarda de dedo saiu da varredura — a rolagem do celular volta a travar').toMatch(
			/ehDedo\(\)/
		);

		// A guarda tem de vir ANTES do laco: sair no meio ja teria aplicado a
		// barra nos primeiros nos, e a folha do menu e um deles.
		const ondeGuarda = corpo.indexOf('ehDedo()');
		const ondeLaco = corpo.indexOf('querySelectorAll');
		expect(ondeLaco, 'o laco da varredura mudou de forma — reveja este caso').toBeGreaterThan(-1);
		expect(ondeGuarda, 'a guarda ficou DEPOIS do laco: alguns nos ja teriam perdido a rolagem').toBeLessThan(
			ondeLaco
		);
	});

	it('o predicado vem do modulo unico, e nao de um `matchMedia` novo', () => {
		/*
		 * A regra do projeto: quem pergunta "isto e um dedo?" usa `ehDedo()`. Um
		 * segundo `matchMedia('(pointer: coarse)')` escrito noutro arquivo e como
		 * a cicatriz de `--hud-acima-da-doca` (D-929) comecou.
		 */
		expect(GUI_CRU, 'a guarda nao importa `ehDedo`').toMatch(/import\s*\{\s*ehDedo\s*\}\s*from\s*'UI\/escalaDaHud\.js'/);
		expect(GUI_CRU, 'apareceu um matchMedia proprio em vez de reusar `ehDedo`').not.toMatch(
			/matchMedia\(\s*'\(pointer: coarse\)'/
		);
	});
});
