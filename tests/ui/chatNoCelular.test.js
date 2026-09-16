/**
 * O CHAT DO CELULAR (10/09/2026). Relato do alfa: *"nem digitar no chat
 * global"*.
 *
 * A `prove:jogador-no-celular` NAO reproduziu: no Chromium sem cabeca o toque
 * abria a barra, o campo focava, o texto entrava e a linha voltava no Global.
 * A varredura do que so morde em aparelho de verdade achou as causas lendo o
 * codigo, e a maior delas a prova nunca exercitou: TODA troca de mapa — a Asa
 * de Mosca, a Asa automatica do VIP depois de 10 s sem alvo, a viagem — tirava
 * o chat da pagina, o teclado fechava e ele voltava minimizado.
 *
 * Cada caso le o fonte, SEM comentarios (o comentario de cada conserto cita o
 * codigo que ele consertou): `MapEngine`, `ChatBox` e `GUIComponent` arrastam a
 * cadeia de render, que nao sobe no jsdom.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ler = caminho =>
	readFileSync(join(process.cwd(), caminho), 'utf8')
		.replace(/\r\n/g, '\n')
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const MAP_RENDERER = ler('src/Renderer/MapRenderer.js');
const MAP_ENGINE = ler('src/Engine/MapEngine.js');
const UI_MANAGER = ler('src/UI/UIManager.js');
const GUI_COMPONENT = ler('src/UI/GUIComponent.js');
const MOBILE = ler('src/Core/Mobile.js');
const CHATBOX = ler('src/UI/Components/ChatBox/ChatBox.js');
const CHATBOX_CSS = ler('src/UI/Components/ChatBox/ChatBox.css');

/** O corpo de uma funcao ou metodo, do nome ate o fecho no mesmo recuo. */
function corpo(fonte, inicio) {
	const i = fonte.indexOf(inicio);
	expect(i, `sumiu: ${inicio}`).toBeGreaterThan(-1);
	const recuo = /^\s*/.exec(fonte.slice(fonte.lastIndexOf('\n', i) + 1))[0];
	const fim = fonte.indexOf(`\n${recuo}}`, i);
	return fonte.slice(i, fim);
}

describe('o chat atravessa a troca de mapa', () => {
	it('a troca de mapa tira todos os componentes MENOS o chat', () => {
		const setMap = corpo(MAP_RENDERER, 'setMap(');
		expect(setMap).toContain("UIManager.removeComponents(['ChatBox'])");
		expect(setMap).not.toContain('UIManager.removeComponents();');
	});

	it('o removeComponents pula o que foi pedido para ficar, e sem argumento tira tudo', () => {
		const remove = corpo(UI_MANAGER, 'static removeComponents(');
		expect(remove).toContain('manter = []');
		expect(remove).toContain('manter.includes(keys[i])');
	});

	it('o mapa carregado so anexa o chat de novo se ele saiu — anexar de novo o MOVE e tira o foco', () => {
		expect(MAP_ENGINE).toContain('if (!ChatBox.__active) ChatBox.append();');
		expect(MAP_ENGINE.match(/ChatBox\.append\(\)/g)).toHaveLength(1);
	});

	it('sair do jogo continua tirando TUDO, o chat junto — cada entrada no jogo nasce minimizada', () => {
		const i = MAP_ENGINE.indexOf('Network.close();');
		expect(i, 'o caminho de sair do jogo sumiu').toBeGreaterThan(-1);
		expect(MAP_ENGINE.slice(Math.max(0, i - 300), i)).toContain('UIManager.removeComponents();');
	});
});

describe('digitar no celular', () => {
	it('o "Modo batalha" abre a barra JA com o campo focado, no mesmo toque', () => {
		const i = CHATBOX.indexOf("bmtoggle.addEventListener('click'");
		expect(i, 'o clique do Modo batalha sumiu').toBeGreaterThan(-1);
		const clique = CHATBOX.slice(i, CHATBOX.indexOf('\n\t});', i));
		expect(clique).toContain("root.querySelector('.input-chatbox')");
		expect(clique).toContain('campo.focus()');
	});

	it('o cursor vai ao fim sem apagar o cursor do toque (nada de removeAllRanges)', () => {
		expect(CHATBOX).toContain('selecao.collapse(campo, campo.childNodes.length)');
		expect(CHATBOX).not.toContain('removeAllRanges');
	});

	it('o campo editavel aceita selecao', () => {
		const regra = corpo(CHATBOX_CSS, '#chatbox .input .message {');
		expect(regra).toContain('user-select: text');
	});

	it('no toque, o campo nao ganha a barra de rolagem legada e tem alvo de dedo', () => {
		// A regra do campo DENTRO do bloco de toque (dois tabs de recuo): o
		// primeiro `overflow-x: auto` do arquivo e o das abas, e nao este.
		const regra = corpo(CHATBOX_CSS, '#chatbox .input .message {\n\t\twhite-space: nowrap;');
		expect(regra).toContain('overflow-x: auto');
		expect(regra).toContain('overflow-y: hidden');
		expect(regra).toContain('padding: 13px 0');
		expect(GUI_COMPONENT).toContain('if (node.isContentEditable) {');
	});

	it('o chat sobe acima do teclado tambem no celular em pe e na posicao escolhida', () => {
		const vertical = corpo(CHATBOX_CSS, '.ri-vertical #chatbox {');
		expect(vertical).toMatch(/bottom:[^;]*var\(--teclado-altura/);
		expect(CHATBOX).toContain('+ var(--teclado-altura, 0px))`;');
	});

	it('a posicao escolhida conta o teclado dos DOIS lados: soma quem escreve, desconta quem mede', () => {
		// Sem o desconto, a subida do teclado entraria na posicao gravada e o
		// chat subiria duas vezes na abertura seguinte.
		expect(CHATBOX).not.toMatch(/style\.bottom = `\$\{Math\.round\(baixo\)\}px`;/);
		expect(CHATBOX.match(/\+ var\(--teclado-altura, 0px\)\)`;/g)).toHaveLength(2);
		expect(corpo(CHATBOX, 'function gravarLayout(')).toContain('caixa.bottom - tecladoAgora()');
		expect(CHATBOX, 'o botao de tamanho tambem grava a posicao').not.toContain('(window.innerHeight - caixa.bottom) /');
		expect(CHATBOX).toContain('baixo: window.innerHeight - caixa.bottom - tecladoAgora(),');
		expect(corpo(CHATBOX, 'function tecladoAgora(')).toContain("getPropertyValue('--teclado-altura')");
	});

	it('tocar num campo de texto nao pede tela cheia', () => {
		const i = MOBILE.indexOf("window.addEventListener('touchstart'");
		expect(i, 'o pedido de tela cheia sumiu').toBeGreaterThan(-1);
		const toque = MOBILE.slice(i, MOBILE.indexOf('});', i));
		expect(toque).toContain('isContentEditable');
		expect(toque.indexOf('isContentEditable')).toBeLessThan(toque.indexOf('requestFullScreen'));
	});
});
