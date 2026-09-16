/**
 * OS DOIS CRUZAMENTOS QUE A `prove:hud-responsiva` ACHOU (10/09/2026, D-995).
 *
 * Os dois eram NUMERO COMPOSTO copiado a mao: uma posicao que dependia da
 * medida de outro arquivo e a repetia como literal. A tela e da prova, que
 * sobe o jogo e mede com `getBoundingClientRect`; estes casos amarram cada
 * numero composto as parcelas dele, para a proxima mudanca numa parcela
 * reprovar AQUI — e nao em silencio, na tela de alguem.
 *
 *   1. A barra do topo da HUD vertical tinha o token de altura cravado em
 *      56px, e a barra passou a 70 em 08/09 (a faixa de wifi e bateria): o
 *      cartao de missoes ficou 6px por baixo dela nas quatro telas em pe.
 *   2. Na faixa de 900 a 1263px o chat no canto e a barra de atalhos
 *      centrada se cruzavam: 112x42px em 1024x768, 37x33px em 900x600.
 *
 * Os fontes sao lidos SEM comentarios: o comentario de cada conserto cita o
 * codigo que ele consertou, e um `toContain` casaria com a citacao.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ler = caminho =>
	readFileSync(join(process.cwd(), caminho), 'utf8')
		.replace(/\r\n/g, '\n')
		.replace(/\/\*[\s\S]*?\*\//g, '');

const COMMON_CSS = ler('src/UI/Common.css');
const BASIC_INFO = ler('src/UI/Components/BasicInfoIdle/BasicInfoIdle.js');
const CHATBOX_CSS = ler('src/UI/Components/ChatBox/ChatBox.css');
const SHORTCUT_CSS = ler('src/UI/Components/ShortCut/ShortCut.css');

/** O respiro da pilha do rodape (ChatBox.css, D-930): 42 da fileira + 8. */
const RESPIRO = 8;

/** O valor de um token `--nome: <N>px;` declarado na folha. */
function token(fonte, nome) {
	const m = new RegExp(`${nome}:\\s*(\\d+)px;`).exec(fonte);
	expect(m, `sumiu o token ${nome}`).not.toBeNull();
	return Number(m[1]);
}

/** O primeiro `<propriedade>: <N>px` (ou `min(<N>px`) dentro do bloco que abre em `inicio`. */
function pxNoBloco(fonte, inicio, propriedade) {
	const i = fonte.indexOf(inicio);
	expect(i, `sumiu: ${inicio}`).toBeGreaterThan(-1);
	const bloco = fonte.slice(i, fonte.indexOf('}', i));
	const m = new RegExp(`(?:^|[\\s;{])${propriedade}:\\s*(?:min\\()?(\\d+)px`).exec(bloco);
	expect(m, `${inicio} sem ${propriedade} em px`).not.toBeNull();
	return Number(m[1]);
}

describe('1. a barra do topo da HUD vertical', () => {
	it('o token de altura LE a caixa que o painel mede, e nao um numero cravado', () => {
		expect(COMMON_CSS).toMatch(/--vr-topo-altura:\s*var\(--hud-basic-altura,\s*\d+px\);/);
	});

	it('o painel continua publicando a caixa com o MESMO nome que o token le', () => {
		// Sem este par o token cai no valor de nascenca para sempre, e calado.
		expect(BASIC_INFO).toContain("setProperty('--hud-basic-altura', altura)");
	});

	it('o que se pendura abaixo do topo continua descendo junto com a barra', () => {
		expect(COMMON_CSS).toMatch(
			/--vr-abaixo-do-topo:\s*calc\(var\(--vr-topo\) \+ var\(--vr-topo-altura\) \+ 8px\);/,
		);
	});
});

describe('2. o chat e a barra de atalhos na faixa do meio', () => {
	const margem = token(COMMON_CSS, '--chat-margem');
	const largura = token(COMMON_CSS, '--chat-larg');
	const larguraDaBarra = pxNoBloco(SHORTCUT_CSS, ':host {', 'width');
	const baixoDaBarra = pxNoBloco(SHORTCUT_CSS, ':host {', 'bottom');
	const fileira = pxNoBloco(SHORTCUT_CSS, '#ShortCut .row {', 'height');

	const REGRA =
		/@media \(min-width: (\d+)px\) and \(max-width: (\d+)px\) and \(min-height: (\d+)px\) \{\s*#chatbox \{\s*bottom: calc\((\d+)px \+ (\d+)px \+ (\d+)px\);\s*\}\s*\}/;
	const faixa = () => {
		const m = REGRA.exec(CHATBOX_CSS);
		expect(m, 'sumiu a regra da faixa do meio em ChatBox.css').not.toBeNull();
		return m.slice(1).map(Number);
	};

	it('ela comeca onde a pilha do rodape acaba, nos dois eixos', () => {
		expect(CHATBOX_CSS).toContain('@media (max-width: 899px), (max-height: 439px) {');
		const [minLargura, , minAltura] = faixa();
		expect(minLargura).toBe(900);
		expect(minAltura).toBe(440);
	});

	it('ela termina onde o chat e a barra cabem lado a lado, com o respiro da pilha', () => {
		const fim = 2 * (margem + largura + RESPIRO + larguraDaBarra / 2);
		expect(faixa()[1], `2 x (${margem} + ${largura} + ${RESPIRO} + ${larguraDaBarra / 2}) - 1`).toBe(fim - 1);
	});

	it('na faixa o chat nasce em cima da fileira da barra', () => {
		expect(faixa().slice(3)).toEqual([baixoDaBarra, fileira, RESPIRO]);
	});
});
