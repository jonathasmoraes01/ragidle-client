/**
 * UI/Components/ChatBox/ChatBox.js
 *
 * ChatBox windows
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 *
 * ─────────────────────────────────────────────────────────────────────────
 * RAG IDLE, 20/08/2026 — o chat virou TRES CANAIS FIXOS: Global, Trade, Farm.
 *
 * O que mudou de mecanismo (e por que):
 *
 * 1. As abas DINAMICAS do roBrowser sairam. Elas eram criadas, renomeadas e
 *    apagadas pelo jogador, e cada uma guardava a propria lista de filtros,
 *    editavel na engrenagem (ChatBoxSettings). Com esse desenho, a regra dura
 *    desta frente — "nenhuma mensagem automatica do Farm aparece em Global ou
 *    Trade" — dependia de o jogador nao desmarcar uma caixa. Nao era garantia.
 *    Agora o canal sai de CANAL_DO_FILTRO abaixo: uma tabela FILTRO -> CANAL
 *    em que cada filtro pertence a exatamente UM canal. O roteamento e
 *    estrutural, nao configuravel, e nao depende do TEXTO da mensagem (que
 *    muda com traducao).
 *
 * 2. O ciclo de alturas de F10/".size" (updateHeight/_heightIndex) e o
 *    redimensionar por arrasto sairam: o painel tem UMA altura, definida em
 *    CSS pelo gabarito (~12% da tela), mais o estado recolhido. F10 passou a
 *    alternar recolhido/expandido, que e o unico eixo de tamanho que sobrou.
 *
 * 3. O painel nao e mais arrastavel. Ele mora no canto inferior esquerdo
 *    (gabarito, secao 4) e cede espaco a barra de habilidades e ao canto
 *    inferior direito. Nao chamar draggable() tambem desliga o clamp de
 *    viewport do GUIComponent (ver o cabecalho de ChatBox.css).
 *
 * 4. A engrenagem (ChatBoxSettings) saiu junto com as abas dinamicas: sem
 *    filtro por aba para configurar, o painel so poderia mentir sobre o que
 *    controla.
 *
 * O que NAO mudou: as cores por tipo de mensagem (getColorForType), o fluxo
 * de envio (onRequestTalk/submit), o modo batalha, os comandos "/", o
 * historico de mensagem e de nick, e o link de item.
 */

import DB from 'DB/DBManager.js';
import Events from 'Core/Events.js';
import Preferences from 'Core/Preferences.js';
import KEYS from 'Controls/KeyEventHandler.js';
import Mouse from 'Controls/MouseEventHandler.js';
import Cursor from 'UI/CursorManager.js';
import BattleMode from 'Controls/BattleMode.js';
import History from './History.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import 'UI/Elements/Elements.js';
import ContextMenu from 'UI/Components/ContextMenu/ContextMenu.js';
import htmlText from './ChatBox.html?raw';
import cssText from './ChatBox.css?raw';
import Commands from 'Controls/ProcessCommand.js';
import Configs from 'Core/Configs.js';
import EntityManager from 'Renderer/EntityManager.js';
import RiIcones from 'UI/ri-icones.js';

/**
 * @var {number} max message in the chatbox
 */
const MAX_MSG = 400;
const MAX_LENGTH = 100;

/**
 * @var {History} message cached in history
 */
const _historyMessage = new History();

/**
 * @var {History} nickname cached in history
 */
const _historyNickName = new History(true);

/**
 * Buffer para acumular mensagens antes de adicionar ao DOM.
 * @private
 */
let _messageBuffer = [];

/**
 * Flag que indica se um requestAnimationFrame foi agendado para processar o buffer.
 * @private
 */
let _rafScheduled = false;

/**
 * Preferencias do chat. Versao 2.0: as chaves de posicao/altura/abas
 * (x, y, height, magnet_*, tabs, tabOption) morreram com os tres canais
 * fixos e com o painel ancorado no canto — um save antigo nao pode
 * ressuscitar aba nenhuma.
 */
const _preferences = Preferences.get(
	'ChatBox',
	{
		fontScale: 1.0,
		canalAtivo: 'global'
	},
	2.0
);

/**
 * Estado recolhido/expandido do painel. Chave PROPRIA, como em TopMenuIdle.js.
 */
const _prefsRecolhido = Preferences.get('ChatBoxRecolhido', { recolhido: false }, 1.0);

/**
 * A ALTURA do log, em pixels — arrastavel pela alca (28/08/2026).
 *
 * Chave PROPRIA, como o recolhido: a de `ChatBox` esta na versao 2.0 e subir a
 * versao dela para caber um campo novo APAGARIA o canal ativo de todo mundo
 * (`Preferences.get` descarta o save inteiro quando a versao nao bate).
 *
 * `null` significa "nunca arrastei" — e ai vale o padrao do CSS, que e o
 * gabarito antigo. Guardar um numero de largada congelaria a altura de quem
 * nunca pediu nada, e ainda por cima em pixels, num painel cujo padrao e
 * relativo a viewport (`6.6vh`).
 */
const _prefsAltura = Preferences.get('ChatBoxAltura', { altura: null }, 1.0);

/** Os limites do arrasto. O piso e ~duas linhas; o teto, metade da tela. */
const ALTURA_MINIMA = 48;
const alturaMaxima = () => Math.max(ALTURA_MINIMA, Math.round(window.innerHeight * 0.5));

/** Escreve a altura no elemento. `null` devolve o padrao do CSS. */
function aplicarAltura(root) {
	const painel = root.querySelector('#chatbox') || root.host || root;
	if (!painel || !painel.style) return;
	if (_prefsAltura.altura === null) {
		painel.style.removeProperty('--cb-altura');
		return;
	}
	painel.style.setProperty('--cb-altura', `${_prefsAltura.altura}px`);
}

/**
 * Liga a alca de redimensionar.
 *
 * O arrasto e por `pointer*` e nao `mouse*`: o `setPointerCapture` mantem os
 * eventos vindo mesmo quando o cursor sai do elemento fino de 8px, que e o caso
 * comum de quem arrasta rapido. Com `mousemove` no documento daria para fazer
 * igual, mas seria preciso lembrar de tirar o listener — e listener esquecido e
 * o vazamento que este fork ja consertou em outros lugares.
 */
function ligarAlcaDeAltura(root) {
	const alca = root.querySelector('.cb-alca');
	const painel = root.querySelector('#chatbox');
	const corpo = root.querySelector('.contentwrapper');
	if (!alca || !painel || !corpo || alca.dataset.ligada === '1') return;
	alca.dataset.ligada = '1';

	let alturaInicial = 0;
	let yInicial = 0;

	alca.addEventListener('pointerdown', event => {
		event.preventDefault();
		alturaInicial = corpo.getBoundingClientRect().height;
		yInicial = event.clientY;
		painel.classList.add('cb-redimensionando');
		alca.setPointerCapture(event.pointerId);
	});

	alca.addEventListener('pointermove', event => {
		if (!alca.hasPointerCapture(event.pointerId)) return;
		// Para CIMA cresce: o painel e ancorado embaixo, entao subir a borda
		// superior aumenta o log. Dai o sinal invertido.
		const bruto = alturaInicial + (yInicial - event.clientY);
		const altura = Math.max(ALTURA_MINIMA, Math.min(alturaMaxima(), Math.round(bruto)));
		_prefsAltura.altura = altura;
		aplicarAltura(root);
	});

	const soltar = event => {
		if (!alca.hasPointerCapture(event.pointerId)) return;
		alca.releasePointerCapture(event.pointerId);
		painel.classList.remove('cb-redimensionando');
		// Grava SO no soltar, e nao a cada pixel do arrasto: `save()` escreve no
		// armazenamento, e um `pointermove` dispara dezenas de vezes por segundo.
		_prefsAltura.save();
		const ativo = root.querySelector('.content.active');
		if (ativo) ativo.scrollTop = ativo.scrollHeight;
	};
	alca.addEventListener('pointerup', soltar);
	alca.addEventListener('pointercancel', soltar);
}

/**
 * Create Basic Info component
 */
const ChatBox = new GUIComponent('ChatBox', cssText);

/**
 * Helper: query inside shadow root
 */
function _root() {
	return ChatBox._shadow || ChatBox._host;
}

/**
 * Render HTML — troca cada marcador "<!--RI_ICONE:chave-->" pela string SVG
 * do modulo de iconografia (UI/ri-icones.js), mesmo padrao de
 * TopMenuIdle.js/BasicInfoIdle.js.
 */
ChatBox.render = () => htmlText.replace(/<!--RI_ICONE:(\w+)-->/g, (_, chave) => RiIcones[chave] || '');

/**
 * Has input fields, protect key events
 */
ChatBox.captureKeyEvents = true;

/**
 * Constants
 */
ChatBox.TYPE = {
	SELF: 1 << 0,
	PUBLIC: 1 << 1,
	PRIVATE: 1 << 2,
	PARTY: 1 << 3,
	GUILD: 1 << 4,
	ANNOUNCE: 1 << 5,
	ERROR: 1 << 6,
	INFO: 1 << 7,
	BLUE: 1 << 8,
	ADMIN: 1 << 9,
	MAIL: 1 << 10,
	CLAN: 1 << 11
};

/**
 * Os filtros 0..21 sao os do roBrowser/rAthena e NAO podem mudar de numero:
 * cada "ChatBox.addText(..., FILTER.X)" espalhado por Engine/ e UI/ os cita.
 *
 * Os de 22 em diante sao do Rag Idle. Eles existem para o log automatico do
 * idle ter uma ORIGEM propria em vez de dividir "FILTER.ITEM" com as
 * mensagens de acao do jogador (equipar, usar, nao conseguir pegar) — sem
 * eles, separar "caiu um item da caca" de "voce nao pode equipar isso" so
 * daria por texto, que quebra com traducao.
 */
ChatBox.FILTER = {
	PUBLIC_LOG: 0,
	PUBLIC_CHAT: 1,
	WHISPER: 2,
	PARTY: 3,
	GUILD: 4,
	ITEM: 5,
	EQUIP: 6,
	STATUS: 7,
	PARTY_ITEM: 8,
	PARTY_STATUS: 9,
	SKILL_FAIL: 10,
	PARTY_SETUP: 11,
	EQUIP_DAMAGE: 12,
	WOE: 13,
	PARTY_SEARCH: 14,
	BATTLE: 15,
	PARTY_BATTLE: 16,
	EXP: 17,
	PARTY_EXP: 18,
	QUEST: 19,
	BATTLEFIELD: 20,
	CLAN: 21,
	// Rag Idle — log automatico da caca
	FARM_ITEM: 22,
	FARM_EXP: 23,
	FARM_ZENY: 24,
	FARM_NIVEL: 25,
	FARM_LOG: 26,
	// Rag Idle — canal de comercio (SEM FONTE no servidor de mapa de hoje)
	TRADE: 27
};

/**
 * Os tres canais, na ordem em que aparecem.
 */
const CANAIS = ['global', 'trade', 'farm'];

/**
 * FILTRO -> CANAL. Esta tabela E a regra dura: cada filtro pertence a
 * exatamente um canal, entao uma mensagem nunca pode aparecer em dois
 * lugares nem cair no canal errado por configuracao do jogador.
 *
 * Criterio do que e "farm": tudo que o personagem produz SOZINHO enquanto
 * caca — dano trocado, experiencia, nivel, item do chao, zeny do abate — mais
 * o relatorio da sessao desassistida. Fica de fora o que e resposta a uma
 * acao do jogador (equipar, usar item, falhar em pegar do chao): isso e
 * conversa do sistema com o jogador e continua no Global, junto com a fala.
 *
 * O que nao estiver nesta tabela cai em "global" (ver canalDaMensagem).
 */
const CANAL_DO_FILTRO = {
	[ChatBox.FILTER.PARTY_ITEM]: 'farm',
	[ChatBox.FILTER.BATTLE]: 'farm',
	[ChatBox.FILTER.PARTY_BATTLE]: 'farm',
	[ChatBox.FILTER.EXP]: 'farm',
	[ChatBox.FILTER.PARTY_EXP]: 'farm',
	[ChatBox.FILTER.FARM_ITEM]: 'farm',
	[ChatBox.FILTER.FARM_EXP]: 'farm',
	[ChatBox.FILTER.FARM_ZENY]: 'farm',
	[ChatBox.FILTER.FARM_NIVEL]: 'farm',
	[ChatBox.FILTER.FARM_LOG]: 'farm',
	[ChatBox.FILTER.TRADE]: 'trade'
};

function canalDaMensagem(filterType) {
	return CANAL_DO_FILTRO[filterType] || 'global';
}

/**
 * Where to send the message
 */
ChatBox.sendTo = ChatBox.TYPE.PUBLIC;

/**
 * Private Messages
 */
ChatBox.PrivateMessageStorage = {
	nick: '',
	msg: ''
};

/**
 * Canal em foco. Continua se chamando "activeTab" porque e API publica do
 * componente (ProcessCommand/savechat leem daqui); o valor agora e o id do
 * canal ('global' | 'trade' | 'farm'), nao mais um numero de aba.
 */
ChatBox.activeTab = 'global';

/**
 * Initialize UI
 */
ChatBox.init = function init() {
	const root = _root();

	if (!ContextMenu.__loaded) ContextMenu.prepare();
	ChatBox.applyFontScale();

	// Nem draggable() nem magnet: o painel mora no canto (ver ChatBox.css).
	this.magnet.TOP = false;
	this.magnet.BOTTOM = false;
	this.magnet.LEFT = false;
	this.magnet.RIGHT = false;

	// A HUD usa MouseMode.CROSS (o clique atravessa por desenho), entao cada
	// pedaco que precisa se comportar como UI desliga o hover do mundo na
	// mao. ".body" entrou na lista porque o log deixou de ser transparente:
	// virou um painel solido, e passar o mouse por cima nao pode mais mirar
	// monstro atras dele.
	const interactiveSelector = '.cb-abas, .body, .input, .battlemode, .cb-collapse';
	const interactiveEls = root.querySelectorAll(interactiveSelector);
	interactiveEls.forEach(el => {
		let _intersect;
		let _enter = 0;
		el.addEventListener('mouseenter', () => {
			if (_enter === 0) {
				_intersect = Mouse.intersect;
				_enter++;
				if (_intersect) {
					Mouse.intersect = false;
					Cursor.setType(Cursor.ACTION.DEFAULT);
					EntityManager.setOverEntity(null);
				}
			}
		});
		el.addEventListener('mouseleave', () => {
			if (_enter > 0) {
				_enter--;
				if (_enter === 0 && _intersect) {
					Mouse.intersect = true;
					EntityManager.setOverEntity(null);
				}
			}
		});
	});

	// Input selection
	const usernameInput = root.querySelector('.input .username');
	if (usernameInput) {
		usernameInput.addEventListener('mousedown', function (event) {
			this.select();
			event.stopImmediatePropagation();
			event.preventDefault();
		});

		// Nome no campo => a fala VIRA sussurro (regra de ChatBox.submit). A
		// etiqueta de destino acompanha, para a barra nunca dizer "Global"
		// enquanto a proxima linha vai sair como sussurro.
		usernameInput.addEventListener('input', definirEtiquetaDeDestino);
	}

	const inputChatbox = root.querySelector('.input-chatbox');

	if (Configs.get('restoreChatFocus', false) && inputChatbox) {
		inputChatbox.addEventListener('blur', () => {
			Events.setTimeout(() => {
				const active = KEYS.getDeepActiveElement();
				const movedInsideChatbox = active && root.querySelector('#chatbox').contains(active);
				const isTextInput = active && active.tagName && active.tagName.match(/input|select|textarea/i);
				if (!movedInsideChatbox && !isTextInput) {
					inputChatbox.focus();
				}
			}, 1000);
		});
	}

	// Move caret to end of text
	if (inputChatbox) {
		inputChatbox.addEventListener('click', function () {
			const range = document.createRange();
			const selection = window.getSelection();
			range.selectNodeContents(this);
			range.collapse(false);
			selection.removeAllRanges();
			selection.addRange(range);
		});

		inputChatbox.addEventListener('focus', function () {
			const range = document.createRange();
			const selection = window.getSelection();
			range.selectNodeContents(this);
			range.collapse(false);
			selection.removeAllRanges();
			selection.addRange(range);
		});

		inputChatbox.maxLength = MAX_LENGTH;

		inputChatbox.addEventListener('input', event => {
			const currentText = extractChatMessage(inputChatbox);
			if (currentText.length >= MAX_LENGTH) {
				event.preventDefault();
			}
		});

		inputChatbox.addEventListener('keydown', event => {
			const currentText = extractChatMessage(inputChatbox);
			if (currentText.length >= MAX_LENGTH) {
				const allowedKeys = [
					'ArrowLeft',
					'ArrowUp',
					'ArrowRight',
					'ArrowDown',
					'Backspace',
					'Delete',
					'Enter',
					'Insert'
				];

				if (allowedKeys.includes(event.key)) {
					return true;
				}

				if (event.ctrlKey || event.altKey) {
					return true;
				}
				event.preventDefault();
				return false;
			}
		});

		inputChatbox.addEventListener('paste', event => {
			event.preventDefault();

			const clipboard = (event.originalEvent || event).clipboardData || event.clipboardData;
			let pastedText = clipboard ? clipboard.getData('text/plain') : '';
			if (!pastedText) {
				return;
			}

			pastedText = pastedText.replace(/\u00A0/g, ' ');

			const currentText = extractChatMessage(inputChatbox);
			const remaining = MAX_LENGTH - currentText.length;
			if (remaining <= 0) {
				return;
			}

			const toInsert = pastedText.substr(0, remaining);

			if (document.queryCommandSupported && document.queryCommandSupported('insertText')) {
				document.execCommand('insertText', false, toInsert);
			} else {
				const node = document.createTextNode(toInsert);
				inputChatbox.appendChild(node);
			}
		});
	}

	const nickBox = root.querySelector('.input .username');
	if (nickBox) {
		nickBox.addEventListener('blur', () => {
			Events.setTimeout(() => {
				const active = KEYS.getDeepActiveElement();
				const movedInsideChatbox = active && root.querySelector('#chatbox').contains(active);
				const isTextInput = active && active.tagName && active.tagName.match(/input|select|textarea/i);
				const isChatMessage = active === inputChatbox;
				if (!movedInsideChatbox && !isTextInput && !isChatMessage) {
					nickBox.focus();
				}
			}, 1000);
		});
	}

	// Validate information dragged into text field
	root.querySelectorAll('input[type=text]').forEach(input => {
		input.addEventListener('drop', onDropText);
		input.addEventListener('dragover', stopPropagation);
	});

	// Send message to... (publico / grupo / guilda / cla). O servidor de mapa
	// tem chat de grupo (D-279) e de guilda (D-282), entao os quatro destinos
	// deste menu continuam com fio de verdade.
	const filterBtn = root.querySelector('.input .filter');
	if (filterBtn) {
		filterBtn.addEventListener('click', function () {
			const pos = this.getBoundingClientRect();
			const ui = ContextMenu.ui.find('.menu');

			ContextMenu.remove();
			ContextMenu.append();

			ContextMenu.addElement(DB.getMessage(85), onChangeTargetMessage(ChatBox.TYPE.PUBLIC));
			ContextMenu.addElement(DB.getMessage(86), onChangeTargetMessage(ChatBox.TYPE.PARTY));
			ContextMenu.addElement(DB.getMessage(437), onChangeTargetMessage(ChatBox.TYPE.GUILD));
			ContextMenu.addElement(DB.getMessage(2361), onChangeTargetMessage(ChatBox.TYPE.CLAN));

			ui.css({
				top: pos.top - ui.height() - 5,
				left: pos.left - ui.width() + 25
			});
		});
		filterBtn.addEventListener('mousedown', event => {
			event.stopImmediatePropagation();
			event.preventDefault();
		});
	}

	// Rolagem em bloco de linha. O ouvinte de roda do mundo mora no CANVAS
	// (Controls/MapControl.js:70, "Renderer.canvas.addEventListener('wheel')"),
	// nao no window — entao a roda dentro do chat nunca chega ao mapa. O
	// preventDefault aqui e contra o scroll da PAGINA.
	root.querySelectorAll('.content').forEach(el => {
		el.addEventListener('wheel', onScroll);
	});

	const chatboxEl = root.querySelector('#chatbox');

	// Prevent map right-click (camera rotate) when using chat right-click features
	const chatBody = root.querySelector('.body');
	if (chatBody) {
		chatBody.addEventListener('mousedown', event => {
			if (event.which !== 3) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
		});

		// Recolhido, o corpo inteiro expande (gabarito: "clicar expande").
		chatBody.addEventListener('click', event => {
			if (!_prefsRecolhido.recolhido) {
				return;
			}
			if (event.target.closest('a, .item-link')) {
				return;
			}
			event.stopImmediatePropagation();
			definirRecolhido(false);
		});
	}

	// Chat font scale context menu (right click)
	if (chatboxEl) {
		chatboxEl.addEventListener('contextmenu', event => {
			const target = event.target;
			if (target.closest('.body, .contentwrapper, .content')) {
				if (target.closest('a, .item-link')) {
					return;
				}

				event.preventDefault();
				event.stopPropagation();

				Mouse.screen.x = event.pageX;
				Mouse.screen.y = event.pageY;

				ContextMenu.remove();
				ContextMenu.append();
				ContextMenu.addElement('Chat font x1.0', setChatFontScale(1.0));
				ContextMenu.addElement('Chat font x1.2', setChatFontScale(1.2));
				ContextMenu.addElement('Chat font x1.4', setChatFontScale(1.4));
			}
		});

		// Clicking interactive elements in chat should not trigger map movement
		chatboxEl.addEventListener('mousedown', event => {
			if (event.target.closest('.tab, .cb-collapse, .content a, .content .item-link')) {
				event.stopPropagation();
			}
		});

		// Troca de canal (delegado nas tres abas fixas)
		chatboxEl.addEventListener('click', event => {
			const aba = event.target.closest('.tab');
			if (!aba) {
				return;
			}
			event.stopImmediatePropagation();
			ChatBox.switchTab(aba.dataset.canal);
		});
	}

	const bmtoggle = root.querySelector('.battlemode .bmtoggle');
	if (bmtoggle) {
		bmtoggle.addEventListener('click', () => {
			const inputEl = root.querySelector('.input');
			const bmEl = root.querySelector('.battlemode');
			if (inputEl) inputEl.style.display = inputEl.style.display === 'none' ? 'flex' : 'none';
			if (bmEl) bmEl.style.display = bmEl.style.display === 'none' ? 'flex' : 'none';
		});
	}

	const collapseBtn = root.querySelector('.cb-collapse');
	if (collapseBtn) {
		collapseBtn.addEventListener('click', event => {
			event.stopImmediatePropagation();
			definirRecolhido(!_prefsRecolhido.recolhido);
		});
		collapseBtn.addEventListener('mousedown', event => {
			event.stopImmediatePropagation();
			event.preventDefault();
		});
	}

	// Restaura o canal em foco (a preferencia so aceita canal que existe).
	ChatBox.switchTab(CANAIS.includes(_preferences.canalAtivo) ? _preferences.canalAtivo : 'global');

	// A barra de digitacao nasce dizendo para onde a fala vai.
	definirEtiquetaDeDestino();

	Commands.add(
		'savechat',
		'Saves current chat tab to txt file.',
		() => {
			ChatBox.saveCurrentTabChat();
			return;
		},
		['sc'],
		false
	);

	// Set up item link click handler inside shadow DOM
	ChatBox._setupItemLinkHandler();
};

/**
 * Clean up the box
 */
ChatBox.clean = function Clean() {
	const root = _root();

	const contents = root.querySelectorAll('.content');
	contents.forEach(content => {
		const matches = content.innerHTML.match(/(blob:[^"]+)/g);
		if (matches) {
			for (let i = 0, count = matches.length; i < count; ++i) {
				window.URL.revokeObjectURL(matches[i]);
			}
		}
		content.innerHTML = '';
	});

	const inputChatbox = root.querySelector('.input-chatbox');
	if (inputChatbox) inputChatbox.innerHTML = '';

	const nickBox = root.querySelector('.input .username');
	if (nickBox) nickBox.value = '';
	definirEtiquetaDeDestino();

	_historyMessage.clear();
	_historyNickName.clear();
};

/**
 * Troca o canal em foco. Marca a aba, mostra o log dela, apaga o ponto de
 * nao-lido e liga/desliga a digitacao (Farm e somente leitura, ver a classe
 * "canal-farm" em ChatBox.css).
 */
ChatBox.switchTab = function switchTab(canal) {
	const root = _root();
	if (!CANAIS.includes(canal)) {
		return;
	}

	this.activeTab = canal;
	_preferences.canalAtivo = canal;
	_preferences.save();

	root.querySelectorAll('.tab').forEach(aba => {
		const ativo = aba.dataset.canal === canal;
		aba.setAttribute('aria-selected', String(ativo));
		const pill = aba.querySelector('.cb-aba');
		if (pill) {
			pill.classList.toggle('is-active', ativo);
			if (ativo) {
				pill.classList.remove('tem-nova');
			}
		}
	});

	root.querySelectorAll('.content').forEach(el => {
		el.classList.toggle('active', el.dataset.content === canal);
	});

	const chatboxEl = root.querySelector('#chatbox');
	if (chatboxEl) {
		chatboxEl.classList.toggle('canal-farm', canal === 'farm');
		// Trade: a barra fica, o campo sai (ver ".cb-inerte" em ChatBox.css).
		chatboxEl.classList.toggle('canal-trade', canal === 'trade');
	}

	const contentDiv = root.querySelector(`.content[data-content="${canal}"]`);
	if (contentDiv) {
		contentDiv.scrollTop = contentDiv.scrollHeight;
	}
};

/**
 * Once append to HTML
 */
ChatBox.onAppend = function OnAppend() {
	const root = _root();

	aplicarRecolhido();
	// A altura arrastada ATRAVESSA a sessao: restaurada aqui, antes de o log
	// rolar para o fim logo abaixo — assim o `scrollHeight` ja e o da altura
	// certa e a primeira tela nao aparece rolada pela metade.
	aplicarAltura(root);
	ligarAlcaDeAltura(root);

	const inputEl = root.querySelector('.input');
	if (inputEl) inputEl.style.display = 'none';

	const bmEl = root.querySelector('.battlemode');
	if (bmEl) bmEl.style.display = 'flex';

	const content = root.querySelector('.content.active');
	if (content) content.scrollTop = content.scrollHeight;
};

/**
 * Stop custom scroll
 */
ChatBox.onRemove = function OnRemove() {
	_preferences.canalAtivo = this.activeTab;
	_preferences.save();
};

/**
 * @param {number} key id to check
 * @return {boolean} found a shortcut ?
 */
ChatBox.processBattleMode = function processBattleMode(keyId) {
	const root = _root();
	const bmEl = root.querySelector('.battlemode');
	if (
		(bmEl && bmEl.style.display !== 'none') ||
		KEYS.ALT ||
		KEYS.SHIFT ||
		KEYS.CTRL ||
		(keyId >= KEYS.F1 && keyId <= KEYS.F24) ||
		KEYS.INSERT
	) {
		return BattleMode.process(keyId);
	}

	return false;
};

/**
 * Key Event Handler
 */
ChatBox.onKeyDown = function OnKeyDown(event) {
	const root = _root();
	const messageBox = root.querySelector('.input-chatbox');
	const nickBox = root.querySelector('.input .username');

	const activeElement = KEYS.getDeepActiveElement();
	const isChatInputFocused = activeElement === messageBox || activeElement === nickBox;
	const isOtherTextInputFocused =
		activeElement &&
		!isChatInputFocused &&
		((activeElement.tagName && activeElement.tagName.match(/input|select|textarea/i)) ||
			activeElement.isContentEditable);

	if (isOtherTextInputFocused) {
		return true;
	}

	switch (event.which) {
		default:
			if (isChatInputFocused) {
				if (event.which >= KEYS.F1 && event.which <= KEYS.F24) {
					if (event.which === KEYS.F11 || event.which === KEYS.F12) {
						event.preventDefault();
						return true;
					}

					if (ChatBox.processBattleMode(event.which)) {
						event.preventDefault();
						event.stopImmediatePropagation();
						return false;
					}
					event.preventDefault();
					event.stopImmediatePropagation();
					return false;
				}

				if (event.getModifierState && event.getModifierState('AltGraph')) {
					event.stopImmediatePropagation();
					return true;
				}

				if (event.ctrlKey || KEYS.CTRL) {
					const isEditingCombo =
						event.which === KEYS.C ||
						event.which === KEYS.V ||
						event.which === KEYS.X ||
						event.which === KEYS.A ||
						event.which === KEYS.Z ||
						event.which === KEYS.Y;

					if (!isEditingCombo) {
						if (ChatBox.processBattleMode(event.which)) {
							event.preventDefault();
							event.stopImmediatePropagation();
							return false;
						}
						event.preventDefault();
						return true;
					}

					event.stopImmediatePropagation();
					return true;
				}

				if (event.altKey || KEYS.ALT) {
					const isAltEditingCombo =
						event.which === KEYS.LEFT ||
						event.which === KEYS.RIGHT ||
						event.which === KEYS.UP ||
						event.which === KEYS.DOWN ||
						event.which === KEYS.BACKSPACE ||
						event.which === KEYS.DELETE ||
						event.which === KEYS.HOME ||
						event.which === KEYS.END;

					if (!isAltEditingCombo) {
						if (ChatBox.processBattleMode(event.which)) {
							event.preventDefault();
							event.stopImmediatePropagation();
							return false;
						}
						event.preventDefault();
						return true;
					}

					event.stopImmediatePropagation();
					return true;
				}

				if (event.which === KEYS.ESCAPE || event.key === 'Escape') {
					return true;
				}

				event.stopImmediatePropagation();
				return true;
			}

			if (
				(event.target.tagName && !event.target.tagName.match(/input|select|textarea/i)) ||
				(event.which >= KEYS.F1 && event.which <= KEYS.F24) ||
				KEYS.ALT ||
				KEYS.SHIFT ||
				KEYS.CTRL
			) {
				if (ChatBox.processBattleMode(event.which)) {
					event.stopImmediatePropagation();
					return false;
				}
			}
			return true;

		// Message from history
		case KEYS.UP:
			if (!document.querySelector('#NpcMenu')) {
				if (activeElement === messageBox) {
					if (shouldLetChatInputHandleVerticalArrows(messageBox, 'up')) {
						event.stopImmediatePropagation();
						return true;
					}
					messageBox.innerHTML = _historyMessage.previous();
					break;
				}

				if (activeElement === nickBox) {
					nickBox.value = _historyNickName.previous();
					nickBox.select();
					break;
				}
			}
			return true;

		case KEYS.DOWN:
			if (!document.querySelector('#NpcMenu')) {
				if (activeElement === messageBox) {
					if (shouldLetChatInputHandleVerticalArrows(messageBox, 'down')) {
						event.stopImmediatePropagation();
						return true;
					}
					messageBox.innerHTML = _historyMessage.next();
					break;
				}

				if (activeElement === nickBox) {
					nickBox.value = _historyNickName.next();
					nickBox.select();
					break;
				}
			}
			return true;

		// F10 era o ciclo de 6 alturas do chat nativo. Com uma altura so
		// (gabarito) o unico eixo que sobrou e recolher/expandir, e a tecla
		// ficou nele em vez de virar tecla morta.
		case KEYS.F10:
			definirRecolhido(!_prefsRecolhido.recolhido);
			break;

		// Send message
		case KEYS.ENTER: {
			if (document.activeElement.className === 'message input-chatbox' && document.activeElement !== messageBox) {
				return true;
			}

			if (document.querySelector('#NpcMenu, #NpcBox')) {
				return true;
			}

			if (activeElement === messageBox) {
				this.submit();
				event.stopImmediatePropagation();
				return false;
			}

			// Farm e somente leitura, e Trade nao tem canal no servidor: em
			// nenhum dos dois o Enter abre digitacao. No Trade isso e a mesma
			// decisao do ".cb-inerte" (ChatBox.html) — sem esta guarda, digitar
			// no Trade sairia como fala PUBLICA e a linha apareceria no Global.
			if (this.activeTab === 'farm' || this.activeTab === 'trade') {
				event.stopImmediatePropagation();
				return false;
			}
			if (_prefsRecolhido.recolhido) {
				definirRecolhido(false);
			}

			const input = root.querySelector('.input');
			if (input && input.style.display === 'none') {
				input.style.display = 'flex';
				const bmEl = root.querySelector('.battlemode');
				if (bmEl) bmEl.style.display = 'none';
			}

			messageBox.focus();
			const range = document.createRange();
			const sel = window.getSelection();
			range.selectNodeContents(messageBox);
			range.collapse(false);
			sel.removeAllRanges();
			sel.addRange(range);
			event.stopImmediatePropagation();
			return false;
		}
	}

	event.stopImmediatePropagation();
	return false;
};

ChatBox.toggleChat = function toggleChat() {
	const root = _root();
	const messageBox = root.querySelector('.input-chatbox');

	const activeElement = KEYS.getDeepActiveElement();
	if (activeElement.tagName === 'INPUT' && activeElement !== messageBox) {
		return true;
	}

	if (document.querySelector('#NpcMenu, #NpcBox')) {
		return true;
	}

	messageBox.focus();
	this.submit();
};

/**
 * Process ChatBox message
 */
ChatBox.submit = function Submit() {
	const root = _root();
	const inputEl = root.querySelector('.input');
	const $user = root.querySelector('.input .username');
	const $text = root.querySelector('.input-chatbox');

	const user = $user ? $user.value : '';
	const text = extractChatMessage($text);
	const trimmedText = text.replace(/\u00A0/g, ' ').trim();

	// Battle mode
	if (!trimmedText.length) {
		const bmEl = root.querySelector('.battlemode');
		if (inputEl) inputEl.style.display = inputEl.style.display === 'none' ? 'flex' : 'none';
		if (bmEl) bmEl.style.display = bmEl.style.display === 'none' ? 'flex' : 'none';

		if (inputEl && inputEl.style.display !== 'none') {
			$text.focus();
		}

		return;
	}

	// Private message
	if (user.length && trimmedText[0] !== '/') {
		this.PrivateMessageStorage.nick = user;
		this.PrivateMessageStorage.msg = trimmedText;
		_historyNickName.push(user);
		_historyNickName.previous();
	}

	// Save in history
	_historyMessage.push(trimmedText);

	$text.innerHTML = '';

	// Command
	if (trimmedText[0] === '/') {
		Commands.processCommand.call(this, trimmedText.substr(1));
		return;
	}

	this.onRequestTalk(user, trimmedText, ChatBox.sendTo);
};

/**
 * Extract plain chat text from the contenteditable input while preserving item links.
 */
function extractChatMessage(inputEl) {
	if (!inputEl) return '';
	const clone = inputEl.cloneNode(true);

	clone.querySelectorAll('span.item-link').forEach(el => {
		const itemData = el.getAttribute('data-item') || el.dataset.item || '';
		el.replaceWith(document.createTextNode(itemData));
	});

	let result = clone.textContent;
	result = result.replace(/\u00A0/g, ' ');
	return result;
}

/**
 * Add text to chatbox
 */
ChatBox.addText = function addText(text, colorType, filterType, color, override) {
	text = text.replace(/<ITEMLINK>.*?<\/ITEMLINK>|<ITEML>.*?<\/ITEML>|<ITEM>.*?<\/ITEM>/gi, function (match) {
		const item = DB.parseItemLink(match);
		const span = `<span data-item="${match}" class="item-link" style="color:#FFFF63;">&lt;${item.name}&gt;</span>`;
		override = true;
		return span;
	});

	// Auto-detect client-generated HTML (nickname links in whispers)
	if (!override && /<span\s+class="nickname-link"/.test(text)) {
		override = true;
	}

	if (isNaN(filterType)) {
		filterType = ChatBox.FILTER.PUBLIC_LOG;
	}

	_messageBuffer.push({
		text: text,
		colorType: colorType,
		filterType: filterType,
		color: color,
		override: override
	});

	if (!_rafScheduled) {
		_rafScheduled = true;
		requestAnimationFrame(() => {
			_rafScheduled = false;
			flushMessageBuffer();
		});
	}
};

/**
 * Process all messages in the buffer at once.
 *
 * Cada mensagem vai para UM canal so, decidido por canalDaMensagem() a partir
 * do filtro que a origem declarou. Nao ha caminho por onde a mesma linha
 * aparecer em dois canais.
 */
function flushMessageBuffer() {
	if (_messageBuffer.length === 0) {
		return;
	}

	const root = _root();
	const messages = _messageBuffer.slice();
	_messageBuffer = [];

	const porCanal = {};

	messages.forEach(msg => {
		const canal = canalDaMensagem(msg.filterType);
		if (!porCanal[canal]) {
			porCanal[canal] = [];
		}
		porCanal[canal].push(msg);
	});

	Object.keys(porCanal).forEach(canal => {
		const content = root.querySelector(`.content[data-content="${canal}"]`);
		if (!content) return;

		const fragment = document.createDocumentFragment();
		const wasAtBottom = shouldScrollDownBeforeAdd(content, content.offsetHeight);

		porCanal[canal].forEach(msg => {
			const color = msg.color || getColorForType(msg.colorType);
			const div = document.createElement('div');
			div.style.color = color;

			const tag = etiquetaDaLinha(msg.colorType, msg.filterType);
			const tagHtml = `<span class="ri-badge ri-badge--${tag.variante} cb-tag">${tag.rotulo}</span>`;

			if (!msg.override) {
				div.innerHTML = tagHtml + highlightMessage(msg.text, msg.colorType);
			} else {
				// Override ja e HTML pronto (ITEMLINK, link de historico,
				// nickname-link) -- so a etiqueta de canal e somada por cima.
				div.innerHTML = tagHtml + msg.text;
			}
			fragment.appendChild(div);
		});

		content.appendChild(fragment);

		while (content.childElementCount > MAX_MSG) {
			const element = content.firstElementChild;
			const matches = element.innerHTML.match(/(blob:[^"]+)/g);
			if (matches) {
				for (let i = 0; i < matches.length; i++) {
					window.URL.revokeObjectURL(matches[i]);
				}
			}
			element.remove();
		}

		if (wasAtBottom) {
			content.scrollTop = content.scrollHeight;
		}

		marcarNaoLido(canal);
	});
}

/**
 * Ponto de nao-lido na aba do canal que recebeu mensagem, quando ele nao e o
 * canal em foco. Usa ".ri-dot" do design system (Common.css), nunca um
 * indicador proprio.
 */
function marcarNaoLido(canal) {
	if (canal === ChatBox.activeTab) {
		return;
	}
	const root = _root();
	const pill = root.querySelector(`.tab[data-canal="${canal}"] .cb-aba`);
	if (pill) {
		pill.classList.add('tem-nova');
	}
}

function getColorForType(colorType) {
	if (colorType & ChatBox.TYPE.PUBLIC && colorType & ChatBox.TYPE.SELF) {
		return '#00FF00';
	} else if (colorType & ChatBox.TYPE.PARTY) {
		return colorType & ChatBox.TYPE.SELF ? 'rgb(200, 200, 100)' : 'rgb(230,215,200)';
	} else if (colorType & ChatBox.TYPE.GUILD) {
		return 'rgb(180, 255, 180)';
	} else if (colorType & ChatBox.TYPE.PRIVATE) {
		return '#FFFF00';
	} else if (colorType & ChatBox.TYPE.ERROR) {
		return '#FF0000';
	} else if (colorType & ChatBox.TYPE.INFO) {
		return '#FFFF63';
	} else if (colorType & ChatBox.TYPE.BLUE) {
		return '#00FFFF';
	} else if (colorType & ChatBox.TYPE.ADMIN) {
		return '#FFFF00';
	} else if (colorType & ChatBox.TYPE.MAIL) {
		return '#FFFFFF';
	}

	return '#FFFFFF';
}

/**
 * Etiqueta de canal no inicio da linha (gabarito, secao 4). Dentro do Farm o
 * rotulo vem do FILTRO — que e o que distingue item, experiencia, zeny e
 * nivel — e no resto vem do tipo de cor, como sempre veio. So um NOME visivel
 * para o que o JS ja decidiu; nao inventa cor nem muda o fluxo.
 */
function etiquetaDaLinha(colorType, filterType) {
	switch (filterType) {
		case ChatBox.FILTER.FARM_ITEM:
		case ChatBox.FILTER.PARTY_ITEM:
			return { rotulo: 'Item', variante: 'ouro' };
		case ChatBox.FILTER.FARM_EXP:
		case ChatBox.FILTER.EXP:
		case ChatBox.FILTER.PARTY_EXP:
			return { rotulo: 'Exp', variante: 'ouro' };
		case ChatBox.FILTER.FARM_ZENY:
			return { rotulo: 'Zeny', variante: 'ouro' };
		case ChatBox.FILTER.FARM_NIVEL:
			return { rotulo: 'Nível', variante: 'ouro' };
		case ChatBox.FILTER.FARM_LOG:
			return { rotulo: 'Caça', variante: 'ouro' };
		case ChatBox.FILTER.BATTLE:
		case ChatBox.FILTER.PARTY_BATTLE:
			return { rotulo: 'Combate', variante: 'cinza' };
		case ChatBox.FILTER.TRADE:
			return { rotulo: 'Trade', variante: 'ouro' };
		default:
			break;
	}

	if (colorType & ChatBox.TYPE.ERROR) return { rotulo: 'Erro', variante: 'ouro' };
	if (colorType & ChatBox.TYPE.ADMIN) return { rotulo: 'Admin', variante: 'ouro' };
	if (colorType & ChatBox.TYPE.MAIL) return { rotulo: 'Correio', variante: 'ouro' };
	if (colorType & ChatBox.TYPE.CLAN) return { rotulo: 'Clã', variante: 'ouro' };
	if (colorType & ChatBox.TYPE.GUILD) return { rotulo: 'Guilda', variante: 'ouro' };
	if (colorType & ChatBox.TYPE.PARTY) return { rotulo: 'Grupo', variante: 'ouro' };
	if (colorType & ChatBox.TYPE.PRIVATE) return { rotulo: 'Sussurro', variante: 'ouro' };
	if (colorType & ChatBox.TYPE.ANNOUNCE) return { rotulo: 'Anúncio', variante: 'ouro' };
	if (colorType & ChatBox.TYPE.INFO) return { rotulo: 'Sistema', variante: 'ouro' };
	if (colorType & ChatBox.TYPE.BLUE) return { rotulo: 'Aviso', variante: 'ouro' };

	return { rotulo: 'Global', variante: 'cinza' };
}

/**
 * Escapa o texto CRU (mensagem de outro jogador, nunca confiavel) antes de
 * highlightMessage() envolver pedacos dela em spans.
 */
function escapeChatHtml(text) {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Envolve (NUNCA decide) dois pedacos da mensagem em spans:
 *  - o prefixo "Nome : " que o proprio rAthena manda PRONTO dentro de pkt.msg
 *  - numeros (zeny, quantidade, nivel) em qualquer mensagem.
 */
function highlightMessage(rawText, colorType) {
	const escaped = escapeChatHtml(rawText);

	const isSpeech = !!(
		colorType &
		(ChatBox.TYPE.PUBLIC | ChatBox.TYPE.PARTY | ChatBox.TYPE.GUILD | ChatBox.TYPE.PRIVATE | ChatBox.TYPE.CLAN)
	);
	const withName = isSpeech
		? escaped.replace(/^(\s*[^\n:]{1,24}?)\s:\s/, '<span class="cb-name">$1</span> : ')
		: escaped;

	return withName.replace(/\b\d+(?:[.,]\d+)*\b/g, match => `<span class="cb-num">${match}</span>`);
}

function shouldScrollDownBeforeAdd(container, height) {
	const tolerance = 5;
	const atBottom = container.scrollTop + height >= container.scrollHeight - tolerance;

	if (height >= container.scrollHeight || atBottom) {
		return true;
	}

	return false;
}

/**
 * Determine if vertical arrow should scroll the contenteditable rather than navigate history
 */
function shouldLetChatInputHandleVerticalArrows(inputEl, direction) {
	if (!inputEl) {
		return false;
	}

	const sel = window.getSelection();
	if (!sel || sel.rangeCount < 1) {
		return false;
	}

	const range = sel.getRangeAt(0);
	if (!range) {
		return false;
	}

	const anchorNode = sel.anchorNode || range.startContainer;
	if (!anchorNode) {
		return false;
	}

	if (anchorNode !== inputEl && !(inputEl.contains && inputEl.contains(anchorNode))) {
		return false;
	}

	if (!sel.isCollapsed) {
		return true;
	}

	const text = extractChatMessage(inputEl);
	const hasNewline = text.indexOf('\n') > -1;
	const hasOverflow = inputEl.scrollHeight > inputEl.clientHeight + 1;
	if (!hasNewline && !hasOverflow) {
		return false;
	}

	let caretRect;
	try {
		caretRect =
			range.getClientRects && range.getClientRects().length
				? range.getClientRects()[0]
				: range.getBoundingClientRect();
	} catch (_e) {
		return true;
	}

	if (!caretRect) {
		return true;
	}

	const inputRect = inputEl.getBoundingClientRect ? inputEl.getBoundingClientRect() : null;
	if (!inputRect) {
		return true;
	}

	if (direction === 'up') {
		return caretRect.top > inputRect.top + 2;
	}

	if (direction === 'down') {
		return caretRect.bottom < inputRect.bottom - 2;
	}

	return false;
}

/**
 * Save user name to nick name history
 */
ChatBox.saveNickName = function saveNickName(pseudo) {
	_historyNickName.push(pseudo);
};

/**
 * Save chat from current tab into a file.
 */
ChatBox.saveCurrentTabChat = function saveCurrentTabChat() {
	const root = _root();
	let data;

	const tzoffset = new Date().getTimezoneOffset() * 60000;
	let localISOTime = new Date(Date.now() - tzoffset).toISOString().slice(0, -1);
	localISOTime = localISOTime.replace('T', ' ');
	const timezone = new Date().getTimezoneOffset() / 60;
	const date = `${localISOTime} (GMT ${timezone > 0 ? '-' : '+'}${Math.abs(timezone).toString()})`;

	const contentEl = root.querySelector(`.content[data-content="${ChatBox.activeTab}"]`);
	const nome = ChatBox.activeTab;

	data =
		'<html><head><title>Chat History</title><style> body { background-color: DarkSlateGray; } </style></head><body>';
	data += contentEl ? contentEl.outerHTML : '';
	data += '</body></html>';

	const url = window.URL.createObjectURL(new Blob([data], { type: 'text/plain' }));

	ChatBox.addText(
		`Chat History [${nome}] ${date} can be saved by <a style="color:#F88" download="ChatHistory [${nome}] (${date.replace('/', '-')}).html" href="${url}" target="_blank">clicking here</a>.`,
		ChatBox.TYPE.PUBLIC,
		ChatBox.FILTER.PUBLIC_LOG,
		null,
		true
	);
};

/**
 * Update scroll by block (14px)
 */
function onScroll(event) {
	let delta;

	if (event.wheelDelta) {
		delta = event.wheelDelta / 120;
		if (window.opera) {
			delta = -delta;
		}
	} else if (event.detail) {
		delta = -event.detail;
	} else if (event.deltaY) {
		delta = -event.deltaY / Math.abs(event.deltaY);
	}

	const lineHeight = getScrollLineHeightPx(this);
	this.scrollTop = Math.floor(this.scrollTop / lineHeight) * lineHeight - (delta || 0) * lineHeight;
	event.preventDefault();
}

/**
 * Validate the type of information being dropped into the text field
 */
function onDropText(event) {
	event.stopImmediatePropagation();
	event.preventDefault();
	let data;
	try {
		data = JSON.parse(event.dataTransfer.getData('Text'));
	} catch (_e) {
		return;
	}

	if (data.type == 'item') {
		return;
	}

	event.currentTarget.value = data;
}

/**
 * Stop event propagation
 */
function stopPropagation(event) {
	event.stopImmediatePropagation();
	event.preventDefault();
}

/**
 * Change target of global chat (party, guild)
 */
function onChangeTargetMessage(type) {
	return function onChangeTargetMessageClosure() {
		const root = _root();
		const $input = root.querySelector('.input-chatbox');

		if ($input) {
			$input.classList.remove('guild', 'party', 'clan');

			if (type & ChatBox.TYPE.PARTY) {
				$input.classList.add('party');
			} else if (type & ChatBox.TYPE.GUILD) {
				$input.classList.add('guild');
			} else if (type & ChatBox.TYPE.CLAN) {
				$input.classList.add('clan');
			}
		}

		ChatBox.sendTo = type;
		definirEtiquetaDeDestino();
	};
}

/**
 * Etiqueta de DESTINO da barra de digitacao (20/08/2026, rodada 2).
 *
 * O problema que ela resolve: a barra do Global se anunciava como SUSSURRO. O
 * unico rotulo visivel era o placeholder "Sussurrar para" do campo de nick, e
 * o destino de verdade (publico / grupo / guilda / cla) vivia escondido atras
 * do botao ".filter" — um seletor que, sem rotulo, parecia um quarto canal
 * dentro de um chat que o dono definiu como exatamente TRES.
 *
 * Aqui nada de mecanismo muda: "ChatBox.sendTo" continua sendo a unica verdade
 * sobre para onde a fala vai, e "onRequestTalk" continua lendo dela. Esta
 * funcao so DIZ, em cima da barra, o que o estado ja e — inclusive a regra que
 * ChatBox.submit() aplica em silencio: se ha nome no campo de sussurro, a
 * mensagem sai como sussurro, aconteca o que acontecer com o ".filter".
 */
function definirEtiquetaDeDestino() {
	const root = _root();
	const etiqueta = root.querySelector('.input .cb-destino');
	if (!etiqueta) {
		return;
	}

	const nick = root.querySelector('.input .username');
	if (nick && nick.value && nick.value.trim().length) {
		etiqueta.textContent = 'Sussurro';
		etiqueta.dataset.destino = 'sussurro';
		return;
	}

	let rotulo = 'Global';
	let chave = 'publico';
	if (ChatBox.sendTo & ChatBox.TYPE.PARTY) {
		rotulo = 'Grupo';
		chave = 'grupo';
	} else if (ChatBox.sendTo & ChatBox.TYPE.GUILD) {
		rotulo = 'Guilda';
		chave = 'guilda';
	} else if (ChatBox.sendTo & ChatBox.TYPE.CLAN) {
		rotulo = 'Clã';
		chave = 'cla';
	}

	etiqueta.textContent = rotulo;
	etiqueta.dataset.destino = chave;
}

/**
 * Recolher/expandir: grava a preferencia e reflete no DOM.
 */
function definirRecolhido(recolhido) {
	_prefsRecolhido.recolhido = !!recolhido;
	_prefsRecolhido.save();
	aplicarRecolhido();
}

function aplicarRecolhido() {
	const root = _root();
	const chatboxEl = root.querySelector('#chatbox');
	const collapseBtn = root.querySelector('.cb-collapse');
	if (!chatboxEl || !collapseBtn) {
		return;
	}

	const recolhido = !!_prefsRecolhido.recolhido;
	chatboxEl.classList.toggle('is-recolhido', recolhido);
	collapseBtn.classList.toggle('is-recolhido', recolhido);
	collapseBtn.setAttribute('aria-expanded', String(!recolhido));

	const label = recolhido ? 'Expandir chat' : 'Recolher chat';
	collapseBtn.title = label;
	collapseBtn.setAttribute('aria-label', label);

	const content = root.querySelector('.content.active');
	if (content) {
		content.scrollTop = content.scrollHeight;
	}
}

function setChatFontScale(scale) {
	return function setChatFontScaleClosure() {
		_preferences.fontScale = clampChatFontScale(scale);
		_preferences.save();
		ChatBox.applyFontScale();
	};
}

function clampChatFontScale(scale) {
	const allowed = [1.0, 1.2, 1.4];
	let best = allowed[0];
	let bestDist = Infinity;

	scale = parseFloat(scale);
	if (!isFinite(scale) || scale <= 0) {
		return 1.0;
	}

	for (let i = 0; i < allowed.length; ++i) {
		const dist = Math.abs(allowed[i] - scale);
		if (dist < bestDist) {
			bestDist = dist;
			best = allowed[i];
		}
	}

	return best;
}

function getScrollLineHeightPx(element) {
	let style, lh;

	try {
		style = window.getComputedStyle(element);
		lh = parseFloat(style.lineHeight);
		if (isFinite(lh) && lh > 0) {
			return Math.round(lh);
		}
	} catch (_e) {
		// Ignore
	}

	return 14;
}

ChatBox.applyFontScale = function applyFontScale() {
	const root = _root();
	const scale = clampChatFontScale(_preferences.fontScale || 1.0);
	const baseFont = 12;
	const baseLineHeight = 14;
	const baseInputLineHeight = 18;

	const fontSize = Math.max(10, Math.round(baseFont * scale));
	const lineHeight = Math.max(12, Math.round(baseLineHeight * scale));
	const inputLineHeight = Math.max(14, Math.round(baseInputLineHeight * scale));

	_preferences.fontScale = scale;

	// Chat log
	root.querySelectorAll('.content').forEach(el => {
		el.style.fontSize = `${fontSize}px`;
		el.style.lineHeight = `${lineHeight}px`;
	});

	// Chat input
	root.querySelectorAll('.input input, .input .message').forEach(el => {
		el.style.fontSize = `${fontSize}px`;
	});

	const message = root.querySelector('.input .message');
	if (message) {
		message.style.lineHeight = `${inputLineHeight}px`;
	}
};

// CLICKABLE ITEM → OPEN ITEMINFO (handle inside shadow)
ChatBox._setupItemLinkHandler = function _setupItemLinkHandler() {
	const root = _root();
	if (!root) return;

	root.addEventListener('click', event => {
		const link = event.target.closest('.item-link');
		if (!link) return;

		// If the link is inside the chat input, keep focus there
		if (link.closest('.input-chatbox')) {
			event.stopImmediatePropagation();
			return;
		}

		const item = DB.parseItemLink(link.dataset.item || link.getAttribute('data-item'));
		if (!item) return;

		const ItemInfo = UIManager.getComponent('ItemInfo');
		ItemInfo.append();
		ItemInfo.setItem(item);
	});
};

// Also keep global handler for item links outside shadow (backwards compatibility)
document.addEventListener('click', event => {
	const link = event.target.closest('.item-link');
	if (!link) {
		return;
	}

	if (link.closest('#chatbox .input-chatbox')) {
		event.stopImmediatePropagation();
		event.preventDefault();
		return;
	}

	const item = DB.parseItemLink(link.dataset.item);
	if (!item) {
		return;
	}

	const ItemInfo = UIManager.getComponent('ItemInfo');
	ItemInfo.append();
	ItemInfo.setItem(item);
});

ChatBox.insertText = function (text) {
	const root = _root();
	const input = root.querySelector('.input-chatbox');
	if (!input) return;

	input.appendChild(document.createTextNode(text));
	input.focus();
};

// Override mouseMode to CROSS since chatbox body is click-through
ChatBox.mouseMode = GUIComponent.MouseMode.CROSS;

/**
 * Create component and export it
 */
export default UIManager.addComponent(ChatBox);
