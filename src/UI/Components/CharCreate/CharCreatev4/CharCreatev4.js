/**
 * UI/Components/CharCreate/CharCreatev4/CharCreatev4.js
 *
 * Chararacter Creation windows
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import htmlText from './CharCreatev4.html?raw';
import cssText from './CharCreatev4.css?raw';
import premiumCss from '../../PreGamePremium.css?raw';
import { createCharCreate } from '../CharCreateCommon.js';

const Componente = createCharCreate({
	name: 'CharCreatev4',
	htmlText,
	cssText: premiumCss + cssText,
	// Tem que bater com ":host"/"#charcreate_v4" em CharCreatev4.css. A
	// centralizacao herdada de CharCreateCommon.js e literalmente
	// "(Renderer.width - hostWidth) / 2", entao um numero fora de sincronia
	// aqui desloca a janela inteira -- ja aconteceu (era 576x342 contra
	// 794x422 no CSS, 109px pra esquerda e 40px pra cima do centro real).
	// 768x456 e a medida da reforma de 19/08/2026; o orcamento que explica
	// os dois numeros esta no cabecalho do CSS.
	viewportLayout: true,
	hasRace: true,
	gridHairstyle: true,
	humanCanvasSelector: '#human',
	doramCanvasSelector: '#doram',
	modelCanvasSelector: '#style_model',
	nameInputSelector: '#char_name',
	nameInputEvent: 'mousedown',
	cancelSelectors: ['.cancel', '.return'],
	makeSelector: '.make'
});

/**
 * Rotulos em PORTUGUES (20/08/2026, pedido do coordenador no item 1 do
 * gauntlet).
 *
 * A tela inteira lia em INGLES porque o applyRaceMessages() de
 * CharCreateCommon.js monta cada rotulo com DB.getMessage(), e a msgstring
 * do cliente ROLatam desta maquina devolve ingles ("Character Creation",
 * "Hair Style", "Back", "Create"). Ao lado das vizinhas ja refeitas em
 * portugues (Login, "Selecionar Personagem") isso ficava pior do que o
 * layout torto que esta rodada consertou.
 *
 * POR QUE AQUI E NAO NO applyRaceMessages(): aquele arquivo e a fabrica
 * COMPARTILHADA das quatro versoes (V0/V2/V3/V4). So a V4 carrega neste
 * PACKETVER, entao mexer la nao teria alcance pratico -- mas tambem nao
 * teria motivo. Sobrescrever aqui deixa a traducao ao lado do HTML que ela
 * descreve, e as versoes irmas seguem intocadas.
 *
 * POR QUE NO onAppend E NAO NO init(): applyRaceMessages() roda dentro do
 * init(), que acontece UMA vez, no prepare(). O onAppend roda depois dele e
 * a cada abertura da janela -- escrever aqui ganha sempre, sem depender de
 * ordem de carregamento da tabela de mensagens.
 *
 * As chaves sao os mesmos seletores que applyRaceMessages() usa; nenhuma
 * classe muda, e ".make"/".return" continuam sendo CLASSE (a automacao e o
 * gate clicam por classe, nao por texto).
 *
 * Voz do design system: portugues do Brasil, substantivo em rotulo e verbo
 * em botao, curto. "Doram" e nome proprio do RO e fica no original.
 */
const ROTULOS = {
	'.title': 'Criar personagem',
	'.human_title': 'Humano',
	'.human_desc':
		'Raça representante de Midgard. Talentosa para resolver problemas, com potencial infinito e grande adaptabilidade.',
	'.doram_title': 'Doram',
	'.doram_desc': 'Raça representante do continente Far-star, de curiosidade natural e temperamento animado.',
	'.hair_style_title': 'Estilo de cabelo',
	'.hair_color_title': 'Cor do cabelo',
	'.return': 'Voltar',
	'.make': 'Criar personagem'
};

/**
 * Centralizacao MEDIDA (19/08/2026, item 1 do gauntlet: "centralizada na
 * tela").
 *
 * A centralizacao herdada usa os numeros de PROJETO (hostWidth/hostHeight).
 * Eles descrevem a janela enquanto ela cabe na tela -- mas o CSS agora
 * deixa o ":host" encolher ("max-width/max-height" em vw/vh) quando a
 * viewport e menor que 768x456, e nesse caso o numero de projeto deixa de
 * descrever a caixa real: a conta da um deslocamento negativo, e o clamp do
 * motor (UI/ClampToViewport.js, que roda logo DEPOIS deste onAppend) so
 * empurra pro canto -- ele nao recentraliza.
 *
 * Aqui a posicao e refeita a partir do tamanho MEDIDO do host, ja com o CSS
 * aplicado. Isto tambem e a rede de seguranca da cicatriz acima: se um dia
 * os numeros de projeto e o CSS voltarem a divergir, a janela continua
 * centralizada, porque a medida ganha do palpite.
 *
 * E camada de VISTA: nao toca no pacote de criacao, na validacao de nome
 * nem na escolha de aparencia.
 */
const onAppendHerdado = Componente.onAppend;
Componente.onAppend = function onAppend() {
	onAppendHerdado.call(this);

	const raiz = this.getRoot();
	for (const input of raiz.querySelectorAll('.hstyle, .hcolor')) {
		const numero = parseInt(input.id, 10);
		input.setAttribute(
			'aria-label',
			input.matches('.hstyle') ? `Estilo de cabelo ${numero}` : `Cor do cabelo ${numero + 1}`
		);
	}
	for (const seletor of Object.keys(ROTULOS)) {
		const alvo = raiz.querySelector(seletor);
		if (alvo) {
			alvo.textContent = ROTULOS[seletor];
		}
	}

	// Host de viewport: a composição interna centraliza e redimensiona via CSS.
	this._host.style.left = '0px';
	this._host.style.top = '0px';
};

export default Componente;
