/**
 * UI/Components/IdleConfig/IdleConfig.js
 *
 * "Configuração idle" — custom RAGIDLE window. Lets the player review and
 * edit the server-side idle-automation config (auto-hunt, target filter,
 * skill rotation, auto-rest, auto-potions, auto-buffs) across 5 tabs.
 *
 * Protocol (custom extension, not part of stock rAthena/roBrowser):
 *   CZ_RAGIDLE_PEDIR_CONFIG    0x0ff3  (client -> server, fixed, opcode only)
 *   ZC_RAGIDLE_CONFIG          0x0ff4  (server -> client, variable, JSON;
 *                                       answers BOTH pedir and aplicar)
 *   CZ_RAGIDLE_APLICAR_CONFIG  0x0ff5  (client -> server, variable, JSON —
 *                                       just the "config" object, applied
 *                                       transactionally server-side)
 * Declared in Network/PacketStructure.js (search "RAGIDLE:") and registered
 * for receive-side framing in Network/PacketRegister.js and
 * Network/Packets/packets2021_len_main.js (see comments there). Opcodes
 * 0x0ff3-0x0ff5 sit right after HuntMap's 0x0ff0-0x0ff2 in the same free
 * range of this fork's packet tables.
 *
 * Pattern followed here is IdleConfig's sibling window, HuntMap
 * (UI/Components/HuntMap/HuntMap.js): GUIComponent base class, ES modules,
 * shadow DOM, CSS/HTML via `?raw`, a floating button that toggles the
 * window, `Network.hookPacket(...)` self-registered at module top-level,
 * mounted in Engine/MapEngine.js next to HuntMap (import + prepare() +
 * append()). HuntMap.js was read in full before writing this file and is
 * cited by file:line throughout below wherever a mechanism is reused.
 *
 * @author RagIdle
 */

import Renderer from 'Renderer/Renderer.js';
import Preferences from 'Core/Preferences.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import UIManager from 'UI/UIManager.js';
import ChatBox from 'UI/Components/ChatBox/ChatBox.js';
import GUIComponent from 'UI/GUIComponent.js';
import { pocoesDoEixo, escolherPocaoPadrao } from './escolhaDePocao.js';
import htmlText from './IdleConfig.html?raw';
import cssText from './IdleConfig.css?raw';
import { fecharEEsquecer } from '../limpezaDeJanelaIdle.js';
import { abaLembrada, lembrarAba } from '../memoriaDeAba.js';

/**
 * Keep in sync with the ":host" / ".ic-window" size in IdleConfig.css —
 * used to clamp the saved window position to the current viewport (same
 * role as HuntMap's WINDOW_WIDTH/HEIGHT, HuntMap.js:39-40).
 */
const WINDOW_WIDTH = 620;
const WINDOW_HEIGHT = 540;

/**
 * Create Component
 */
const IdleConfig = new GUIComponent('IdleConfig', cssText);

IdleConfig.render = () => htmlText;

/**
 * Floating icon must not block scene clicks/hover — same reasoning and same
 * choice as HuntMap (HuntMap.js:81-89) and CashShopIcon
 * (UI/Components/CashShopIcon/CashShopIcon.js:60).
 */
IdleConfig.mouseMode = GUIComponent.MouseMode.CROSS;

/**
 * @var {object|null} last config confirmed by the server (contract v1's
 *      "config" object) — the baseline that IdleConfig.dirty compares
 *      IdleConfig.editConfig against.
 */
IdleConfig.serverConfig = null;

/**
 * @var {object|null} draft config being edited in the window. Only sent to
 *      the server when the player clicks "Aplicar".
 */
IdleConfig.editConfig = null;

/**
 * @var {object|null} last "contexto" received (current map, its monsters,
 *      the player's skills, healing consumables, capabilities).
 */
IdleConfig.contexto = null;

/**
 * O contexto que esta na mao descreve o mapa ANTERIOR? (27/08/2026, auditoria C)
 *
 * `contexto` so e `null` no boot do modulo e nunca mais volta a ser — a unica
 * outra escrita e a da resposta do servidor. Entao toda guarda escrita como
 * `if (!IdleConfig.contexto) return` funciona UMA vez por sessao e depois vira
 * decoracao, enquanto o problema real e contexto OBSOLETO, e nao ausente.
 *
 * Na troca de mapa, `IdleConfig.sondarMapa()` e `HuntButtonIdle.append()` saem
 * no MESMO bloco sincrono (Engine/MapEngine.js): a resposta nao pode ter
 * chegado, e quem ler `contexto` ali le o mapa de onde o jogador saiu.
 *
 * Esta marca e ADITIVA de proposito: `contexto` tem consumidores em seis
 * arquivos (drop de caca, registro da caca, dock, pocao...), e anula-lo para
 * fazer a guarda funcionar mudaria o comportamento de todos eles.
 */
IdleConfig.contextoObsoleto = false;

/**
 * @var {string[]} as abas que existem, na ordem em que o HTML as declara. E a
 *      lista que valida a aba vinda do `localStorage` (ver memoriaDeAba.js):
 *      quem tirar uma aba do HTML tira daqui, e o jogador que estava nela cai
 *      no padrao em vez de abrir a janela sem aba nenhuma acesa.
 */
const ABAS = ['geral', 'alvos', 'skills', 'recuperacao', 'itens'];

/**
 * @var {string} a aba de fabrica — a que vale para quem nunca escolheu.
 */
const ABA_PADRAO = 'geral';

/**
 * @var {string} active tab: 'geral' | 'alvos' | 'skills' | 'recuperacao' | 'itens'
 *
 * Nasce no padrao e e trocada pela aba LEMBRADA no init() — a leitura mora la
 * porque depende de `_preferences`, declarada mais abaixo neste arquivo.
 */
IdleConfig.activeTab = ABA_PADRAO;

/**
 * @var {boolean} true when editConfig differs from serverConfig (drives the
 *      "Aplicar" button's disabled state).
 */
IdleConfig.dirty = false;

/**
 * @var {string[]} problems returned by a rejected "aplicar" (contract's
 *      non-empty "problemas" — transactional refusal, nothing changed
 *      server-side).
 */
IdleConfig.problemas = [];

/**
 * @var {Preferences} posicao da janela (x/y sao null ate o jogador mover) E a
 *      aba em que ele estava (`aba`, null ate ele trocar de aba a primeira
 *      vez). A versao continua 1.0 DE PROPOSITO: somar chave nova aos padroes
 *      nao exige subir versao, e subir apagaria a posicao ja salva — a conta
 *      esta no cabecalho de memoriaDeAba.js.
 */
const _preferences = Preferences.get(
	'IdleConfig',
	{
		x: null,
		y: null,
		aba: null
	},
	1.0
);

/**
 * Helper: query inside shadow root
 */
function _root() {
	return IdleConfig._shadow || IdleConfig._host;
}

/**
 * Escape user/server supplied text before injecting into innerHTML. Mirrors
 * HuntMap's private helper (HuntMap.js:133-148) — not exported there, so
 * re-declared here rather than imported (task instructions: don't alter
 * HuntMap.js).
 */
function escapeHtml(value) {
	return String(value == null ? '' : value).replace(/[&<>"']/g, ch => {
		switch (ch) {
			case '&':
				return '&amp;';
			case '<':
				return '&lt;';
			case '>':
				return '&gt;';
			case '"':
				return '&quot;';
			default:
				return '&#39;';
		}
	});
}

/**
 * Deep-clone a JSON-shaped config object (everything in the contract is
 * plain data: booleans, numbers, strings, arrays, nested objects).
 */
function cloneConfig(config) {
	return JSON.parse(JSON.stringify(config));
}

/**
 * Dot-path set helper so the tab renderers below can bind a single generic
 * handler (bindGenericControls) to nested fields like "descanso.hpAbaixo" or
 * "pocaoDeHp.itemId" via a `data-bool` / `data-select` / `data-range`
 * attribute instead of one bespoke listener per field.
 */
function setPath(obj, path, value) {
	const keys = path.split('.');
	let cur = obj;
	for (let i = 0; i < keys.length - 1; i++) {
		cur = cur[keys[i]];
	}
	cur[keys[keys.length - 1]] = value;
}

/**
 * One-time setup (runs once, during GUIComponent#prepare(), GUIComponent.js
 * :140-151/:182-198 — init() is called at the end of _prepare()).
 */
IdleConfig.init = function init() {
	const root = _root();

	// A aba em que o jogador estava da ultima vez, antes do primeiro desenho:
	// renderTabs()/renderBody() la embaixo ja pintam a certa, sem piscar a
	// "Geral" no caminho.
	IdleConfig.activeTab = abaLembrada(_preferences, ABA_PADRAO, ABAS);

	root.querySelector('.ic-button').addEventListener('click', onClickButton);
	root.querySelector('.ic-close').addEventListener('click', onClickClose);
	root.querySelectorAll('.ic-tab').forEach(btn => btn.addEventListener('click', onClickTab));
	root.querySelector('.ic-apply').addEventListener('click', onClickApply);

	// GUIComponent#draggable() (GUIComponent.js:516-747) moves ":host" via
	// left/top, using the titlebar as the drag handle — same call shape as
	// HuntMap.js:189.
	this.draggable(root.querySelector('.ic-titlebar'));

	// Default centered position, may be overridden by saved preferences in
	// onAppend() below (same approach as HuntMap.js:191-193/203-208).
	this._host.style.top = Math.max(0, (Renderer.height - WINDOW_HEIGHT) / 2) + 'px';
	this._host.style.left = Math.max(0, (Renderer.width - WINDOW_WIDTH) / 2) + 'px';

	renderTabs();
	renderBody();
	renderProblemas();
	updateFooter();
};

/**
 * Restore saved window position once appended to the DOM (same as
 * HuntMap.js:203-208).
 */
IdleConfig.onAppend = function onAppend() {
	if (_preferences.x != null && _preferences.y != null) {
		this._host.style.top = Math.min(Math.max(0, _preferences.y), Renderer.height - WINDOW_HEIGHT) + 'px';
		this._host.style.left = Math.min(Math.max(0, _preferences.x), Renderer.width - WINDOW_WIDTH) + 'px';
	}
};

/**
 * Save window position when the component is removed (defensive — in
 * practice this floating icon stays appended for the whole map session,
 * same as HuntMap.js:215-217).
 */
IdleConfig.onRemove = function onRemove() {
	savePosition();
};

function savePosition() {
	_preferences.x = parseInt(IdleConfig._host.style.left, 10) || 0;
	_preferences.y = parseInt(IdleConfig._host.style.top, 10) || 0;
	_preferences.save();
}

/**
 * Show/hide the window (button stays visible either way). Same shape as
 * HuntMap.toggle() (HuntMap.js:228-238).
 */
IdleConfig.toggle = function toggle() {
	const root = _root();
	const win = root.querySelector('.ic-window');
	if (win.classList.contains('is-open')) {
		closeWindow();
	} else {
		win.classList.add('is-open');
		IdleConfig.focus();
		requestConfig();
	}
};

function closeWindow() {
	const root = _root();
	root.querySelector('.ic-window').classList.remove('is-open');
	savePosition();
}

function onClickButton(e) {
	e.stopImmediatePropagation();
	IdleConfig.toggle();
}

function onClickClose(e) {
	e.stopImmediatePropagation();
	closeWindow();
}

function onClickTab(e) {
	e.stopImmediatePropagation();
	IdleConfig.activeTab = e.currentTarget.dataset.tab;
	lembrarAba(_preferences, IdleConfig.activeTab);
	renderTabs();
	renderBody();
}

function onClickApply(e) {
	e.stopImmediatePropagation();
	applyConfig();
}

/**
 * Ask the server for the current idle config.
 * CZ_RAGIDLE_PEDIR_CONFIG — opcode 0x0ff3, fixed 2 bytes (opcode only), same
 * shape as HuntMap's requestCatalog() (HuntMap.js:265-268).
 */
/**
 * RAGIDLE: em CIDADE nao ha caca (D-246) e o botao AVISA isso (D-355). Mas
 * a cidade NAO tranca a janela (D-359, ordem do dono em 18/08 a noite):
 * a versao anterior desabilitava o botao E fechava a janela na resposta do
 * servidor, e o efeito medido foi o dono em Prontera sem conseguir ALTERAR
 * a rotacao de skills — a config e exatamente o que se ajusta NA cidade,
 * antes de viajar. Fica o aviso (classe + hover + nota no rodape), sai a
 * trava. O sinal vem de contexto.ehCidade (mapa sem populacao de mobs).
 */
function aplicarEstadoDeCidade() {
	const ehCidade = !!(IdleConfig.contexto && IdleConfig.contexto.ehCidade);
	const btn = _root().querySelector('.ic-button');
	if (!btn) {
		return;
	}
	btn.disabled = false;
	btn.classList.toggle('ic-button-cidade', ehCidade);
	btn.title = ehCidade
		? 'Voce esta na cidade — de para editar a configuracao; a caca comeca quando viajar.'
		: 'Configuracao idle';
}

/**
 * RAGIDLE: pergunta o contexto SEM abrir a janela, so para saber se este
 * mapa e cidade e ajustar o botao. Chamado ao entrar no mapa.
 */
IdleConfig.sondarMapa = function sondarMapa() {
	// A sondagem so acontece na TROCA DE MAPA, entao o contexto na mao passa a
	// descrever o mapa anterior a partir daqui — ate a resposta chegar.
	IdleConfig.contextoObsoleto = true;
	Network.sendPacket(new PACKET.CZ.RAGIDLE_PEDIR_CONFIG());
};
function requestConfig() {
	setStatus(IdleConfig.serverConfig ? 'Atualizando configuração...' : 'Carregando configuração...');
	Network.sendPacket(new PACKET.CZ.RAGIDLE_PEDIR_CONFIG());
}

/**
 * Send the edited draft to the server for transactional validation.
 * CZ_RAGIDLE_APLICAR_CONFIG — opcode 0x0ff5, variable, JSON UTF-8 payload
 * (just the "config" object, per contract). See Network/PacketStructure.js
 * "RAGIDLE:" section for how the packet's byte length is computed.
 */
function enviarConfig(config) {
	setStatus('Aplicando...');
	IdleConfig.problemas = [];
	renderProblemas();

	const pkt = new PACKET.CZ.RAGIDLE_APLICAR_CONFIG();
	pkt.json = JSON.stringify(config);
	Network.sendPacket(pkt);
}

function applyConfig() {
	if (!IdleConfig.editConfig) {
		return;
	}
	enviarConfig(IdleConfig.editConfig);
}

/**
 * O BOTAO "Auto" DA BARRA DE ACOES — e ele manda SO o campo dele.
 *
 * Antes, `DockIdle.onClickAuto` invertia `IdleConfig.editConfig.cacaAutomatica`
 * e chamava `aplicarConfig()`, que serializa o RASCUNHO INTEIRO da janela de
 * Config. O rascunho sobrevive ao fechar da janela (`closeWindow` so tira a
 * classe `.is-open`), entao um clique num botao da barra de acoes enviava
 * edicoes que o jogador nunca apertou "Aplicar" para enviar.
 *
 * Pior: se qualquer uma delas fosse invalida, o servidor recusa
 * TRANSACIONALMENTE — nada muda, nem o `cacaAutomatica` que o jogador acabou
 * de pedir. O caso medido: marcar "Desabilitar ataques basicos" e depois
 * remover a unica skill da rotacao deixa `{modoDeAtaque:'apenas-skills',
 * rotacao:[]}`, que o servidor recusa. O botao Auto entao nunca funciona, e a
 * causa esta numa janela fechada.
 *
 * O pedido sai do `serverConfig` — o ultimo estado que o servidor ACEITOU —,
 * com um campo trocado. E `editConfig` nao e tocado: o rascunho do jogador e
 * dele.
 */
function alternarCacaAutomatica() {
	if (!IdleConfig.serverConfig) {
		// Config ainda nao chegou: nao ha estado conhecido para inverter.
		requestConfig();
		return;
	}
	enviarConfig(
		Object.assign(cloneConfig(IdleConfig.serverConfig), {
			cacaAutomatica: !IdleConfig.serverConfig.cacaAutomatica
		})
	);
}

function setStatus(text) {
	const root = _root();
	const el = root.querySelector('.ic-status');
	if (el) {
		el.textContent = text || '';
	}
}

/**
 * ZC_RAGIDLE_CONFIG — opcode 0x0ff4, variable size, JSON UTF-8 payload (see
 * PACKET.ZC.RAGIDLE_CONFIG in Network/PacketStructure.js, which decodes the
 * remainder of the packet into pkt.json — same framing as
 * PACKET.ZC.RAGIDLE_CATALOGO, HuntMap.js:278-311).
 *
 * This single opcode answers both CZ_RAGIDLE_PEDIR_CONFIG and
 * CZ_RAGIDLE_APLICAR_CONFIG. The contract tells them apart with "aplicado":
 * present (true) only on an apply response, absent on a pedir response.
 */
function onConfigReceived(pkt) {
	let data;
	try {
		data = JSON.parse(pkt.json);
	} catch (e) {
		console.error('[IdleConfig] Falha ao interpretar a configuração recebida:', e, pkt.json);
		setStatus('Configuração incompatível.');
		return;
	}

	if (!data || data.v !== 1 || !data.config || !data.contexto) {
		console.error('[IdleConfig] Configuração com contrato incompatível (v=' + (data && data.v) + ').', data);
		setStatus('Configuração incompatível.');
		return;
	}

	const isApplyResponse = Object.prototype.hasOwnProperty.call(data, 'aplicado');
	const rejected = isApplyResponse && Array.isArray(data.problemas) && data.problemas.length > 0;

	IdleConfig.contexto = data.contexto;
	IdleConfig.contextoObsoleto = false;
	aplicarEstadoDeCidade();
	IdleConfig.problemas = rejected ? data.problemas : [];

	if (!rejected) {
		// Either the initial "pedir" answer, or a successful "aplicar":
		// adopt the server's config as the new baseline AND the new draft.
		IdleConfig.serverConfig = data.config;
		IdleConfig.editConfig = cloneConfig(data.config);
		IdleConfig.dirty = false;
		// Em cidade o aviso mora AQUI (D-359): a janela edita normalmente e o
		// rodape lembra que a caca so comeca fora da cidade.
		setStatus(isApplyResponse
			? 'Aplicado.'
			: (data.contexto.ehCidade ? 'Voce esta na cidade — a caca comeca quando voce viajar.' : ''));
	} else {
		// Transactional refusal (contract: "NÃO-vazio = recusado
		// transacionalmente (nada mudou)"). Deliberately do NOT touch
		// serverConfig/editConfig — the player's draft stays on screen so
		// they can see what they tried and fix it; IdleConfig.dirty is left
		// as-is so "Aplicar" stays enabled for a retry.
		setStatus('');

		/*
		 * COM A JANELA FECHADA, A RECUSA ERA MUDA (27/08/2026, auditoria).
		 *
		 * `renderProblemas()` escreve dentro da janela de Config. Se ela nao
		 * estiver aberta — e o caso do botao "Auto" da barra de acoes — o texto
		 * vai para um DOM que ninguem ve, e o jogador fica com um botao que
		 * simplesmente nao faz nada, sem uma palavra na tela.
		 *
		 * "Nao aconteceu nada" e o sintoma mais caro de diagnosticar deste
		 * projeto. Aqui ele custava uma linha.
		 */
		const janela = _root().querySelector('.ic-window');
		if (!janela || !janela.classList.contains('is-open')) {
			ChatBox.addText(
				'Config idle recusada: ' + IdleConfig.problemas.join('; '),
				ChatBox.TYPE.ERROR,
				ChatBox.FILTER.PUBLIC_LOG
			);
		}
	}

	renderTabs();
	renderBody();
	renderProblemas();
	updateFooter();
}

/**
 * Tab strip: the 5 buttons already exist in IdleConfig.html, this just
 * toggles which one carries .is-active.
 */
function renderTabs() {
	const root = _root();
	root.querySelectorAll('.ic-tab').forEach(btn => {
		btn.classList.toggle('is-active', btn.dataset.tab === IdleConfig.activeTab);
	});
}

/**
 * Enable/disable the "Aplicar" footer button based on IdleConfig.dirty.
 */
function updateFooter() {
	const root = _root();
	const btn = root.querySelector('.ic-apply');
	btn.disabled = !(IdleConfig.editConfig && IdleConfig.dirty);
}

/**
 * Recompute IdleConfig.dirty by comparing the draft to the last confirmed
 * server config, then refresh the footer button.
 */
function markDirty() {
	IdleConfig.dirty = JSON.stringify(IdleConfig.editConfig) !== JSON.stringify(IdleConfig.serverConfig);
	updateFooter();
}

/**
 * Render the "problemas" list under the footer (red bullet list) — only
 * populated after a rejected "aplicar" (see onConfigReceived above).
 */
function renderProblemas() {
	const root = _root();
	const el = root.querySelector('.ic-problemas');
	if (!IdleConfig.problemas || !IdleConfig.problemas.length) {
		el.innerHTML = '';
		return;
	}
	el.innerHTML =
		'<ul class="ic-problemas-list">' + IdleConfig.problemas.map(p => `<li>${escapeHtml(p)}</li>`).join('') + '</ul>';
}

/**
 * Render the active tab's content into .ic-body, then wire up its controls.
 */
function renderBody() {
	const root = _root();
	const bodyEl = root.querySelector('.ic-body');

	if (!IdleConfig.editConfig || !IdleConfig.contexto) {
		bodyEl.innerHTML = '<div class="ic-empty">Abra a configuração idle para carregar.</div>';
		return;
	}

	switch (IdleConfig.activeTab) {
		case 'alvos':
			bodyEl.innerHTML = renderAlvos();
			break;
		case 'skills':
			bodyEl.innerHTML = renderSkills();
			break;
		case 'recuperacao':
			bodyEl.innerHTML = renderRecuperacao();
			break;
		case 'itens':
			bodyEl.innerHTML = renderItens();
			break;
		case 'geral':
		default:
			bodyEl.innerHTML = renderGeral();
			break;
	}

	bindGenericControls(bodyEl);
	if (IdleConfig.activeTab === 'alvos') {
		bindAlvosExtra(bodyEl);
	}
	if (IdleConfig.activeTab === 'skills') {
		bindSkillsExtra(bodyEl);
	}
}

/**
 * Wires the 3 generic field kinds used across every tab:
 *   data-bool="path"    checkbox <-> boolean field, full re-render on
 *                        change (several fields gate other controls'
 *                        disabled state, e.g. descanso.ligado)
 *   data-select="path"  <select> <-> string/number field (numeric fields
 *                        also carry data-select-number)
 *   data-range="path"   <input type=range> <-> number field; 'input' only
 *                        patches the paired [data-range-display] text (no
 *                        re-render, so dragging the slider doesn't get
 *                        interrupted); 'change' (mouse release) runs
 *                        onSliderSettled() for cross-field validation, then
 *                        re-renders.
 */
function bindGenericControls(bodyEl) {
	bodyEl.querySelectorAll('[data-bool]').forEach(el => {
		el.addEventListener('change', () => {
			setPath(IdleConfig.editConfig, el.dataset.bool, el.checked);
			// D-536: ligar a poção automática tem que ESCOLHER a poção. O
			// `<select>` já mostrava a primeira da lista, mas o itemId no
			// payload continuava 0 e o servidor recusava com "o item 0 nao e
			// um consumivel de cura do jogo".
			if (el.checked && (el.dataset.bool === 'pocaoDeHp.ligado' || el.dataset.bool === 'pocaoDeSp.ligado')) {
				const campo = el.dataset.bool.split('.')[0];
				const pocao = IdleConfig.editConfig[campo];
				const disponiveis = pocoesDoEixo(
					IdleConfig.contexto && IdleConfig.contexto.consumiveisDeCura,
					campo === 'pocaoDeSp' ? 'curaSp' : 'curaHp'
				);
				pocao.itemId = escolherPocaoPadrao(disponiveis, pocao.itemId);
			}
			markDirty();
			renderBody();
		});
	});

	// D-342: 'Usar ataque básico' mapeia um booleano de UI para o ENUM
	// modoDeAtaque — por isso não cabe no data-bool genérico.
	bodyEl.querySelectorAll('[data-modo-basico]').forEach(el => {
		el.addEventListener('change', () => {
			// D-361: o rótulo virou "Desabilitar ataques básicos" — MARCADO
			// agora significa 'apenas-skills' (o inverso de antes).
			IdleConfig.editConfig.modoDeAtaque = el.checked ? 'apenas-skills' : 'skills-e-basico';
			markDirty();
		});
	});

	bodyEl.querySelectorAll('[data-select]').forEach(el => {
		el.addEventListener('change', () => {
			const value = el.dataset.selectNumber ? Number(el.value) : el.value;
			setPath(IdleConfig.editConfig, el.dataset.select, value);
			markDirty();
		});
	});

	bodyEl.querySelectorAll('input[type=range][data-range]').forEach(el => {
		const path = el.dataset.range;
		el.addEventListener('input', () => {
			setPath(IdleConfig.editConfig, path, Number(el.value));
			const disp = bodyEl.querySelector(`[data-range-display="${path}"]`);
			if (disp) {
				disp.textContent = el.value + '%';
			}
			markDirty();
		});
		el.addEventListener('change', () => {
			onSliderSettled(path);
		});
	});
}

/**
 * Cross-field slider validation (UI-side only — the server is the real
 * judge per contract). Keeps "levantar" thresholds strictly above the
 * matching "abaixo" threshold by nudging the levantar value, instead of
 * letting the two sliders cross (spec: "não deixe levantarHp <= hpAbaixo
 * quando hpLigado ... ajuste o slider").
 */
function onSliderSettled(path) {
	const cfg = IdleConfig.editConfig;
	const d = cfg.descanso;

	if (path === 'descanso.hpAbaixo' || path === 'descanso.levantarHp') {
		if (d.levantarHp <= d.hpAbaixo) {
			d.levantarHp = Math.min(100, d.hpAbaixo + 1);
		}
	}
	if (path === 'descanso.spAbaixo' || path === 'descanso.levantarSp') {
		if (d.levantarSp <= d.spAbaixo) {
			d.levantarSp = Math.min(100, d.spAbaixo + 1);
		}
	}

	markDirty();
	renderBody();
}

/**
 * ─── Tab: Geral ─────────────────────────────────────────────
 */
function renderGeral() {
	const cfg = IdleConfig.editConfig;

	// Rodada 2 (gauntlet): as duas opcoes viviam em cards separados com um
	// vazio vertical enorme abaixo. Agrupadas num so card (com .ri-divisor
	// entre elas) e com um segundo card de orientacao, o corpo ganha
	// hierarquia e respiro constante em vez de terminar no vazio — sem
	// mudar nenhum data-bool nem o contrato com bindGenericControls().
	return `
		<div class="ic-section">
			<h3>Automação</h3>
			<label class="ic-switch-row">
				<span class="ic-switch">
					<input type="checkbox" data-bool="cacaAutomatica" ${cfg.cacaAutomatica ? 'checked' : ''} />
					<span class="ic-switch-track"></span>
				</span>
				<span class="ic-switch-text">
					<span class="ic-switch-label">Caça automática</span>
					<span class="ic-switch-sub">O personagem caça sozinho no mapa.</span>
				</span>
			</label>
			<div class="ri-divisor"></div>
			<label class="ic-checkbox-row">
				<input type="checkbox" data-bool="coletarItens" ${cfg.coletarItens ? 'checked' : ''} />
				<span>Coletar itens automaticamente</span>
			</label>
			<div class="ri-divisor"></div>
			<label class="ic-switch-row">
				<span class="ic-switch">
					<input type="checkbox" data-bool="atacarTodosNaMissao" ${cfg.atacarTodosNaMissao ? 'checked' : ''} />
					<span class="ic-switch-track"></span>
				</span>
				<span class="ic-switch-text">
					<span class="ic-switch-label">Atacar todos os mobs durante missão</span>
					<span class="ic-switch-sub">Desligado, uma missão de caça foca só no alvo dela. Ligado, ataca qualquer monstro do mapa enquanto a missão roda.</span>
				</span>
			</label>
		</div>
		<div class="ic-section ic-section-tip">
			<h3>Próximos passos</h3>
			<ul class="ic-tip-list">
				<li>Escolha os alvos na aba <strong>Alvos</strong> — só monstros marcados são caçados.</li>
				<li>Monte a ordem de golpes na aba <strong>Skills</strong>.</li>
				<li>Configure quando descansar e usar poções na aba <strong>Recuperação</strong>.</li>
			</ul>
		</div>`;
}

/**
 * ─── Tab: Alvos ─────────────────────────────────────────────
 * Checked = caçável = mobId is NOT in editConfig.alvosDesabilitados.
 */
function renderAlvos() {
	const cfg = IdleConfig.editConfig;
	const ctx = IdleConfig.contexto;
	const mobs = ctx.mobsDoMapa || [];
	const disabledSet = new Set(cfg.alvosDesabilitados || []);
	const selectedCount = mobs.filter(m => !disabledSet.has(m.mobId)).length;

	const rows = mobs.length
		? mobs
				.map(
					m => `
			<label class="ic-mob-row">
				<input type="checkbox" data-mob-toggle="${m.mobId}" ${disabledSet.has(m.mobId) ? '' : 'checked'} />
				<span class="ic-mob-icon"><img src="/ragidle/mobs/${m.mobId}.png" alt="" onerror="this.style.display='none'" /></span>
				<span>${escapeHtml(m.nome)}</span>
			</label>`
				)
				.join('')
		: '<div class="ic-empty">Nenhum monstro conhecido neste mapa.</div>';

	return `
		<div class="ic-alvos-head">
			<h3>${escapeHtml(ctx.rotuloDoMapa)}</h3>
			<div class="ic-alvos-sub">${selectedCount}/${mobs.length} selecionados</div>
			<div class="ic-alvos-actions">
				<button type="button" class="ic-btn-secondary" data-action="alvos-todos">Todos</button>
				<button type="button" class="ic-btn-secondary" data-action="alvos-limpar">Limpar</button>
			</div>
		</div>
		<div class="ic-mob-list">${rows}</div>`;
}

function bindAlvosExtra(bodyEl) {
	const ctx = IdleConfig.contexto;
	const mobIds = (ctx.mobsDoMapa || []).map(m => m.mobId);

	const todosBtn = bodyEl.querySelector('[data-action="alvos-todos"]');
	if (todosBtn) {
		// "Todos" — clear this map's mobs from the negative list (leaves
		// entries for OTHER maps untouched).
		todosBtn.addEventListener('click', () => {
			const cfg = IdleConfig.editConfig;
			cfg.alvosDesabilitados = (cfg.alvosDesabilitados || []).filter(id => !mobIds.includes(id));
			markDirty();
			renderBody();
		});
	}

	const limparBtn = bodyEl.querySelector('[data-action="alvos-limpar"]');
	if (limparBtn) {
		// "Limpar" — disable every mob on this map (add to the negative
		// list, deduped via Set).
		limparBtn.addEventListener('click', () => {
			const cfg = IdleConfig.editConfig;
			const set = new Set(cfg.alvosDesabilitados || []);
			mobIds.forEach(id => set.add(id));
			cfg.alvosDesabilitados = Array.from(set);
			markDirty();
			renderBody();
		});
	}

	bodyEl.querySelectorAll('[data-mob-toggle]').forEach(el => {
		el.addEventListener('change', () => {
			const mobId = Number(el.dataset.mobToggle);
			const cfg = IdleConfig.editConfig;
			const set = new Set(cfg.alvosDesabilitados || []);
			if (el.checked) {
				set.delete(mobId);
			} else {
				set.add(mobId);
			}
			cfg.alvosDesabilitados = Array.from(set);
			markDirty();
			renderBody();
		});
	});
}

/**
 * ─── Tab: Skills ────────────────────────────────────────────
 */

/**
 * Os TRES selos de passiva (D-399/D-405).
 *
 * Antes, TODA passiva recebia "ativa automaticamente" — e para duas das tres
 * razoes isso era FALSO: o Teleporte nao faz nada em combate, e o que o motor
 * recusa nao faz nada em lugar nenhum. Dizer o contrario e pior que nao dizer.
 *
 * Quem decide e o SERVIDOR: ele manda `motivo` em `skillsPassivas` desde
 * D-399. A janela nao recalcula nada — recalcular daria uma segunda copia da
 * regra, e a copia da janela e a que ninguem lembra de atualizar.
 *
 * As cores sao as do design system (`ri-badge--*`), e nao um conjunto proprio.
 */
const SELO_DE_PASSIVA = {
	'passiva-que-vale': {
		classe: 'ri-badge--verde',
		texto: 'ativa automaticamente',
		ajuda: 'Ela vale sozinha, so de estar aprendida — muda numero na ficha.',
	},
	'sem-efeito-de-combate': {
		classe: 'ri-badge--cinza',
		texto: 'sem efeito em combate',
		ajuda: 'O motor executa, mas o efeito e fora da luta (deslocamento, carga, pre-requisito).',
	},
	'nao-portada': {
		classe: 'ri-badge--ouro',
		texto: 'nao implementada',
		ajuda: 'O motor de combate ainda nao executa esta habilidade.',
	},
};

/**
 * O nome de EXIBIÇÃO de uma skill (D-359, queixa do dono: a aba mostrava
 * "MG_COLDBOLT"). O servidor manda `nome` (o PT do cliente instalado, o
 * mesmo da janela de skills) em skillsAtivas/skillsPassivas; contrato
 * antigo sem o campo cai no id técnico, o comportamento de antes.
 */
function nomeDaSkill(skillId) {
	const ctx = IdleConfig.contexto || {};
	const todas = [].concat(ctx.skillsAtivas || [], ctx.skillsPassivas || []);
	const achada = todas.find(s => s.skillId === skillId);
	return (achada && achada.nome) || skillId;
}

function renderSkills() {
	const cfg = IdleConfig.editConfig;
	const ctx = IdleConfig.contexto;
	const ativas = ctx.skillsAtivas || [];
	const passivas = ctx.skillsPassivas || [];
	const rotacao = cfg.rotacao || [];

	let rotationHtml;
	if (!ativas.length) {
		// NAO e "nenhuma configurada": e nenhuma DISPONIVEL. As duas frases eram
		// a mesma string, e a primeira mandava o jogador procurar uma
		// configuracao que ele nao tem como fazer.
		rotationHtml =
			'<div class="ic-empty">Este personagem ainda não aprendeu nenhuma skill de ataque que o motor execute.</div>';
	} else {
		const rows = rotacao.length
			? rotacao
					.map(
						(r, i) => `
			<div class="ic-rot-row">
				<span class="ic-rot-num">${i + 1}</span>
				<span class="ic-rot-name" title="${escapeHtml(r.skillId)}">${escapeHtml(nomeDaSkill(r.skillId))}</span>
				<span class="ic-rot-level ri-badge ri-badge--azul">Nv ${r.nivelDeUso}</span>
				<span class="ic-rot-actions">
					<button type="button" class="ic-icon-btn" data-rot-action="up" data-rot-index="${i}" ${i === 0 ? 'disabled' : ''} title="Mover para cima">↑</button>
					<button type="button" class="ic-icon-btn" data-rot-action="down" data-rot-index="${i}" ${i === rotacao.length - 1 ? 'disabled' : ''} title="Mover para baixo">↓</button>
					<button type="button" class="ic-icon-btn" data-rot-action="remove" data-rot-index="${i}" title="Remover">✕</button>
				</span>
			</div>`
					)
					.join('')
			: '<div class="ic-empty">Nenhuma skill na rotação — o personagem só usará o ataque básico.</div>';

		const used = new Set(rotacao.map(r => r.skillId));
		const available = ativas.filter(s => !used.has(s.skillId));

		let addHtml;
		if (rotacao.length >= 3) {
			addHtml = '<div class="ic-note">Limite de 3 skills atingido.</div>';
		} else if (!available.length) {
			// Sumir sem dizer nada e uma afirmacao tambem — a de que nao ha mais
			// nada. Aqui ha: e que TUDO ja esta na lista.
			addHtml = '<div class="ic-note">Todas as skills de ataque disponíveis já estão na rotação.</div>';
		} else {
			addHtml = `
				<select class="ic-add-skill" data-action="skill-add">
					<option value="">+ Adicionar Skill</option>
					${available
						.map(s => `<option value="${escapeHtml(s.skillId)}">${escapeHtml(s.nome || s.skillId)} (Nv ${s.aprendido})</option>`)
						.join('')}
				</select>`;
		}

		rotationHtml = `<div class="ic-rot-list">${rows}</div>${addHtml}`;
	}

	const passivasHtml = passivas.length
		? passivas
				.map(
					s => `
			<div class="ic-passiva-row">
				<span title="${escapeHtml(s.skillId)}">${escapeHtml(s.nome || s.skillId)} (Nv ${s.aprendido})</span>
				<span class="ic-badge ri-badge ${(SELO_DE_PASSIVA[s.motivo] || SELO_DE_PASSIVA['passiva-que-vale']).classe}" title="${escapeHtml(s.motivo === 'nao-portada' && s.explicacao ? s.explicacao : (SELO_DE_PASSIVA[s.motivo] || SELO_DE_PASSIVA['passiva-que-vale']).ajuda)}">${(SELO_DE_PASSIVA[s.motivo] || SELO_DE_PASSIVA['passiva-que-vale']).texto}</span>
			</div>`
				)
				.join('')
		: '<div class="ic-empty">Nenhuma skill passiva aprendida.</div>';

	return `
		<div class="ic-section">
			<h3>Prioridade de skills</h3>
			<div class="ic-note">A primeira skill utilizável da lista será escolhida.</div>
			${rotationHtml}
		</div>
		<div class="ic-section">
			<label class="ic-checkbox-row">
				<!-- D-361 (19/08): o rótulo virou a AÇÃO que o dono pediu
				     ("desabilitar ataques básicos"). Marcado = 'apenas-skills'. -->
				<input type="checkbox" data-modo-basico ${cfg.modoDeAtaque === 'apenas-skills' ? 'checked' : ''} ${!(ctx.capacidades && ctx.capacidades.suprimirAtaqueBasico) || (cfg.modoDeAtaque !== 'apenas-skills' && !rotacao.length) ? 'disabled' : ''} />
				<span>Desabilitar ataques básicos</span>
			</label>
			<div class="ic-note">Marcado: só skills — conjura à distância e espera o SP voltar, sem socar. Desmarcado: ataca normalmente quando nenhuma skill está disponível.</div>
			${!(ctx.capacidades && ctx.capacidades.suprimirAtaqueBasico) ? '<div class="ic-note ic-note-warn">Este servidor não sabe lutar sem o ataque básico.</div>' : ''}
			${(ctx.capacidades && ctx.capacidades.suprimirAtaqueBasico) && cfg.modoDeAtaque !== 'apenas-skills' && !rotacao.length ? '<div class="ic-note ic-note-warn">Adicione ao menos uma skill à rotação para poder desligar o ataque básico — sem ela o personagem ficaria sem nenhum ataque, e o servidor recusa.</div>' : ''}
		</div>
		${renderBuffsDeSkill()}
		<div class="ic-section">
			<h3>Passivas</h3>
			<div class="ic-note">Valem sozinhas, só de estarem aprendidas — não entram em rotação nenhuma (Recuperação de SP/HP, maestrias, Habilidades Básicas).</div>
			${passivasHtml}
		</div>`;
}

/**
 * A ROTAÇÃO DE BUFFS (D-361): as passivas ATIVÁVEIS que o autômato mantém
 * de pé sozinho — até 3, renovadas quando o efeito expira. A lista de
 * candidatas vem do servidor em `contexto.skillsDeBuff` (as que o motor
 * executa como buff próprio); contrato antigo sem o campo simplesmente não
 * desenha a seção.
 */
function renderBuffsDeSkill() {
	const cfg = IdleConfig.editConfig;
	const todas = (IdleConfig.contexto && IdleConfig.contexto.skillsDeBuff) || [];
	// D-363: só o MANTÍVEL entra na rotação. Curar/Desintoxicar aparecem
	// como suporte, para o jogador saber que existem, mas não se "mantêm".
	const disponiveis = todas.filter(s => s.mantivel !== false);
	const suporte = todas.filter(s => s.mantivel === false);
	const notaDeSuporte = suporte.length
		? `<div class="ic-note">Suporte pontual (não se mantém de pé): ${suporte
				.map(s => escapeHtml(s.nome || s.skillId))
				.join(', ')}.</div>`
		: '';
	if (!disponiveis.length) {
		return `
		<div class="ic-section">
			<h3>Buffs automáticos</h3>
			<div class="ic-note">Nenhuma skill mantível aprendida. Têm: Espadachim (Vigor), Arqueiro (Concentração), Noviço (Angelus, Bênção, Agilidade, Pneuma) e Mago (Barreira Mágica).</div>
			${notaDeSuporte}
		</div>`;
	}

	const lista = cfg.rotacaoDeBuffs || (cfg.rotacaoDeBuffs = []);
	const minutos = ms => (ms >= 60000 ? `${Math.round(ms / 60000)} min` : `${Math.round(ms / 1000)} s`);
	const nomeDe = id => {
		const achada = disponiveis.find(s => s.skillId === id);
		return (achada && (achada.nome || achada.skillId)) || id;
	};

	const linhas = lista.length
		? lista
				.map((b, i) => {
					const info = disponiveis.find(s => s.skillId === b.skillId);
					return `
			<div class="ic-rot-row">
				<span class="ic-rot-num">${i + 1}</span>
				<span class="ic-rot-name" title="${escapeHtml(b.skillId)}">${escapeHtml(nomeDe(b.skillId))}</span>
				<span class="ic-rot-level ri-badge ri-badge--azul">Nv ${b.nivelDeUso}</span>
				${info ? `<span class="ic-rot-level ri-badge">${minutos(info.duracaoMs)}</span>` : ''}
				<span class="ic-rot-actions">
					<button type="button" class="ic-icon-btn" data-buff-action="remove" data-buff-index="${i}" title="Remover">✕</button>
				</span>
			</div>`;
				})
				.join('')
		: '<div class="ic-empty">Nenhum buff automático configurado.</div>';

	const usados = new Set(lista.map(b => b.skillId));
	const livres = disponiveis.filter(s => !usados.has(s.skillId));
	let addHtml = '';
	if (lista.length >= 3) {
		addHtml = '<div class="ic-note">Limite de 3 buffs atingido.</div>';
	} else if (livres.length) {
		addHtml = `
			<select class="ic-add-skill" data-action="buff-add">
				<option value="">+ Adicionar buff</option>
				${livres
					.map(s => `<option value="${escapeHtml(s.skillId)}">${escapeHtml(s.nome || s.skillId)} (Nv ${s.aprendido} · ${minutos(s.duracaoMs)} · ${s.custoSp} SP)</option>`)
					.join('')}
			</select>`;
	}

	return `
		<div class="ic-section">
			<h3>Buffs automáticos</h3>
			<div class="ic-note">O personagem mantém estes buffs de pé sozinho e os renova assim que o efeito expira. Até 3.</div>
			<div class="ic-rot-list">${linhas}</div>
			${addHtml}
			${notaDeSuporte}
		</div>`;
}

function bindSkillsExtra(bodyEl) {
	bodyEl.querySelectorAll('[data-rot-action]').forEach(btn => {
		btn.addEventListener('click', () => {
			const idx = Number(btn.dataset.rotIndex);
			const action = btn.dataset.rotAction;
			const rot = IdleConfig.editConfig.rotacao;

			if (action === 'remove') {
				rot.splice(idx, 1);
			} else if (action === 'up' && idx > 0) {
				[rot[idx - 1], rot[idx]] = [rot[idx], rot[idx - 1]];
			} else if (action === 'down' && idx < rot.length - 1) {
				[rot[idx + 1], rot[idx]] = [rot[idx], rot[idx + 1]];
			}
			markDirty();
			renderBody();
		});
	});

	const addSelect = bodyEl.querySelector('[data-action="skill-add"]');
	if (addSelect) {
		addSelect.addEventListener('change', () => {
			const skillId = addSelect.value;
			if (!skillId) {
				return;
			}
			const cfg = IdleConfig.editConfig;
			const skill = (IdleConfig.contexto.skillsAtivas || []).find(s => s.skillId === skillId);
			if (skill && cfg.rotacao.length < 3) {
				cfg.rotacao.push({ skillId: skill.skillId, nivelDeUso: skill.aprendido });
				markDirty();
				renderBody();
			}
		});
	}

	// A rotação de BUFFS (D-361): mesma mecânica da de ataque, teto 3.
	bodyEl.querySelectorAll('[data-buff-action]').forEach(btn => {
		btn.addEventListener('click', () => {
			const idx = Number(btn.dataset.buffIndex);
			const lista = IdleConfig.editConfig.rotacaoDeBuffs || [];
			if (btn.dataset.buffAction === 'remove') {
				lista.splice(idx, 1);
			}
			markDirty();
			renderBody();
		});
	});

	const addBuff = bodyEl.querySelector('[data-action="buff-add"]');
	if (addBuff) {
		addBuff.addEventListener('change', () => {
			const skillId = addBuff.value;
			if (!skillId) {
				return;
			}
			const cfg = IdleConfig.editConfig;
			if (!cfg.rotacaoDeBuffs) {
				cfg.rotacaoDeBuffs = [];
			}
			const buff = (IdleConfig.contexto.skillsDeBuff || []).find(s => s.skillId === skillId);
			if (buff && cfg.rotacaoDeBuffs.length < 3) {
				cfg.rotacaoDeBuffs.push({ skillId: buff.skillId, nivelDeUso: buff.aprendido });
				markDirty();
				renderBody();
			}
		});
	}
}

/**
 * ─── Tab: Recuperação ───────────────────────────────────────
 */
function renderRecuperacao() {
	const cfg = IdleConfig.editConfig;
	const ctx = IdleConfig.contexto;
	const d = cfg.descanso;
	const canSentar = !!(ctx.capacidades && ctx.capacidades.sentarParaRecuperar);
	const canSp = !!(ctx.capacidades && ctx.capacidades.pocaoDeSp);

	return `
		<div class="ic-section">
			<h3>Descanso automático</h3>
			${!canSentar ? '<div class="ic-note ic-note-warn">Sentar para recuperar não está disponível neste personagem/mapa.</div>' : ''}
			<label class="ic-switch-row">
				<span class="ic-switch">
					<input type="checkbox" data-bool="descanso.ligado" ${d.ligado ? 'checked' : ''} ${canSentar ? '' : 'disabled'} />
					<span class="ic-switch-track"></span>
				</span>
				<span class="ic-switch-text"><span class="ic-switch-label">Ligado</span></span>
			</label>

			<div class="ic-subsection${d.ligado ? '' : ' ic-subsection-disabled'}">
				<div class="ic-subtitle">Sentar quando:</div>

				<label class="ic-checkbox-row">
					<input type="checkbox" data-bool="descanso.hpLigado" ${d.hpLigado ? 'checked' : ''} ${d.ligado ? '' : 'disabled'} />
					<span>HP estiver abaixo de <span class="ic-inline-value" data-range-display="descanso.hpAbaixo">${d.hpAbaixo}%</span></span>
				</label>
				<input type="range" class="ic-slider" min="1" max="99" step="1" value="${d.hpAbaixo}" data-range="descanso.hpAbaixo" ${d.ligado && d.hpLigado ? '' : 'disabled'} />

				<label class="ic-checkbox-row">
					<input type="checkbox" data-bool="descanso.spLigado" ${d.spLigado ? 'checked' : ''} ${d.ligado ? '' : 'disabled'} />
					<span>SP estiver abaixo de <span class="ic-inline-value" data-range-display="descanso.spAbaixo">${d.spAbaixo}%</span></span>
				</label>
				<input type="range" class="ic-slider" min="1" max="99" step="1" value="${d.spAbaixo}" data-range="descanso.spAbaixo" ${d.ligado && d.spLigado ? '' : 'disabled'} />

				<div class="ic-field-row">
					<span>Se ambos ativos</span>
				</div>
				<select class="ic-select" data-select="descanso.condicao" ${d.ligado && d.hpLigado && d.spLigado ? '' : 'disabled'}>
					<option value="qualquer" ${d.condicao === 'qualquer' ? 'selected' : ''}>Qualquer condição</option>
					<option value="ambas" ${d.condicao === 'ambas' ? 'selected' : ''}>Ambas as condições</option>
				</select>

				<div class="ic-subtitle">Levantar quando estiver recuperado:</div>
				<div class="ic-field-row">
					<span>HP: <span class="ic-inline-value" data-range-display="descanso.levantarHp">${d.levantarHp}%</span></span>
				</div>
				<input type="range" class="ic-slider" min="1" max="100" step="1" value="${d.levantarHp}" data-range="descanso.levantarHp" ${d.ligado ? '' : 'disabled'} />
				<div class="ic-field-row">
					<span>SP: <span class="ic-inline-value" data-range-display="descanso.levantarSp">${d.levantarSp}%</span></span>
				</div>
				<input type="range" class="ic-slider" min="1" max="100" step="1" value="${d.levantarSp}" data-range="descanso.levantarSp" ${d.ligado ? '' : 'disabled'} />

				<div class="ic-note">Ao descansar, a caça pausa após concluir a luta em curso. A poção é bebida entre as lutas.</div>
			</div>
		</div>

		<div class="ic-section">
			<h3>Poções automáticas</h3>
			${renderPocao('pocaoDeHp', cfg.pocaoDeHp, ctx.consumiveisDeCura, true, 'HP')}
			${!canSp ? '<div class="ic-note ic-note-warn">Recuperação automática de SP não está disponível.</div>' : ''}
			${renderPocao('pocaoDeSp', cfg.pocaoDeSp, ctx.consumiveisDeCura, canSp, 'SP')}
		</div>`;
}

function renderPocao(fieldName, pocao, itens, enabled, label) {
	const campoDoEixo = fieldName === 'pocaoDeSp' ? 'curaSp' : 'curaHp';
	const disponiveis = pocoesDoEixo(itens, campoDoEixo);
	const temPocao = disponiveis.length > 0;
	// O interruptor só liga se houver o que beber — e a escolha mostrada é a
	// mesma que vai no payload (escolherPocaoPadrao roda no toggle).
	const ligavel = enabled && temPocao;
	const selecionado = escolherPocaoPadrao(disponiveis, pocao.itemId);

	const options = disponiveis
		.map(
			it =>
				`<option value="${it.itemId}" ${selecionado === it.itemId ? 'selected' : ''}>${escapeHtml(it.nome)} — ${it.estoque} em estoque</option>`
		)
		.join('');

	return `
		<div class="ic-subsection${ligavel ? '' : ' ic-subsection-disabled'}">
			<label class="ic-switch-row">
				<span class="ic-switch">
					<input type="checkbox" data-bool="${fieldName}.ligado" ${pocao.ligado ? 'checked' : ''} ${ligavel ? '' : 'disabled'} />
					<span class="ic-switch-track"></span>
				</span>
				<span class="ic-switch-text"><span class="ic-switch-label">Recuperação automática de ${label}</span></span>
			</label>
			<select class="ic-select" data-select="${fieldName}.itemId" data-select-number="1" ${ligavel && pocao.ligado ? '' : 'disabled'}>
				${options}
			</select>
			${!temPocao && enabled ? `<div class="ic-note ic-note-warn">Nenhum consumível que restaure ${label} está disponível.</div>` : ''}
			<div class="ic-field-row">
				<span>Usar com <span class="ic-inline-value" data-range-display="${fieldName}.usarCom">${pocao.usarCom}%</span> ou menos de ${label}</span>
			</div>
			<input type="range" class="ic-slider" min="1" max="99" step="1" value="${pocao.usarCom}" data-range="${fieldName}.usarCom" ${ligavel && pocao.ligado ? '' : 'disabled'} />
		</div>`;
}

/**
 * ─── Tab: Itens ─────────────────────────────────────────────
 */
function renderItens() {
	const cfg = IdleConfig.editConfig;
	const ctx = IdleConfig.contexto;
	const enabled = !!(ctx.capacidades && ctx.capacidades.buffsAutomaticos);

	return `
		<div class="ic-section">
			<label class="ic-switch-row">
				<span class="ic-switch">
					<input type="checkbox" data-bool="usarBuffsDeItem" ${cfg.usarBuffsDeItem ? 'checked' : ''} ${enabled ? '' : 'disabled'} />
					<span class="ic-switch-track"></span>
				</span>
				<span class="ic-switch-text">
					<span class="ic-switch-label">Uso automático de buffs</span>
					<span class="ic-switch-sub">O personagem usa consumíveis de buff sozinho, quando disponíveis.</span>
				</span>
			</label>
			${enabled
				? '<div class="ic-note">Servidos hoje (D-360): as poções de ASPD — Concentração (645) e Despertar (656, nível 40+), à venda no Tool Dealer. O bônus entra na próxima luta e dura 30 min; o autômato só bebe de novo quando expira.</div>'
				: '<div class="ic-note ic-note-warn">Nenhum consumível de buff existe no jogo ainda — o interruptor guarda sua escolha para quando existir.</div>'}
		</div>
		<div class="ic-section">
			<div class="ic-note">A seleção e a ordem individual de itens ainda não estão disponíveis.</div>
		</div>`;
}

Network.hookPacket(PACKET.ZC.RAGIDLE_CONFIG, onConfigReceived);

/**
 * Aliases publicos minimos (gauntlet 18/08/2026, ver
 * UI/Components/CombatCornerIdle/CombatCornerIdle.js) pra outro componente
 * RAGIDLE que so precisa ler/gravar um campo pontual do config (ex.: o
 * botao "Auto" do canto de combate, pra cacaAutomatica) sem duplicar o
 * pedido/envio do pacote. Apontam pras MESMAS funcoes internas que a
 * propria janela usa pra pedir a config ao abrir (IdleConfig.toggle()
 * acima) e pra enviar quando o jogador clica "Aplicar" (onClickApply()
 * acima) - nenhuma logica nova, so tornar exportavel o que ja existia.
 */
IdleConfig.pedirConfig = requestConfig;
IdleConfig.aplicarConfig = applyConfig;

/**
 * ESQUECE O PERSONAGEM ANTERIOR (27/08/2026, auditoria C).
 *
 * `cleanGameUI()` (Engine/MapEngine.js) percorre uma lista de OITO componentes
 * nativos e nenhum RAGIDLE. Voltar ao menu de personagem NAO recarrega a
 * pagina (`onRestartAnswer` chama `cleanGameUI()` + `onRestart()`, sem
 * `GameEngine.reload()`), entao todo estado de MODULO atravessa a troca.
 *
 * O estrago mais direto: `DockIdle.onAppend` faz
 * `if (!IdleConfig.editConfig) IdleConfig.pedirConfig();` — com o `editConfig`
 * do personagem A na mao, a condicao e falsa e o pedido nao sai por ali. Ate a
 * sondagem de mapa responder, a barra de acoes desenha a configuracao do
 * personagem ANTERIOR, e um clique no "Auto" nessa janela mandaria a config
 * de A para o servidor logado como B.
 *
 * Cada modulo sabe qual e o seu estado; por isso a limpeza mora aqui, e nao
 * numa lista no motor.
 */
IdleConfig.limparEstadoDoPersonagem = function limparEstadoDoPersonagem() {
	IdleConfig.serverConfig = null;
	IdleConfig.editConfig = null;
	IdleConfig.contexto = null;
	IdleConfig.contextoObsoleto = false;
	IdleConfig.dirty = false;
	IdleConfig.problemas = [];
	/*
	 * ZERAR O DADO NAO BASTA: `GUIComponent.remove()` so DESANEXA o host,
	 * entao o shadow DOM (com `is-open` e o HTML do personagem anterior)
	 * atravessa a troca. Ver `UI/Components/limpezaDeJanelaIdle.js`.
	 */
	fecharEEsquecer(_root(), '.ic-window');
};
IdleConfig.alternarCacaAutomatica = alternarCacaAutomatica;

/**
 * Abre a janela (reusando IdleConfig.toggle() - mesmo metodo que o botao
 * de engrenagem usa) ja na aba pedida, usando o MESMO mecanismo de troca
 * de aba que onClickTab() usa internamente (activeTab + renderTabs() +
 * renderBody()) - literalmente as mesmas 3 linhas, so exportadas (gauntlet
 * 18/08/2026, ver UI/Components/CombatCornerIdle/CombatCornerIdle.js, que
 * chama isto pro medalhao de rotacao de skills abrir direto na aba
 * "skills"). Se a janela ja estava aberta, so troca a aba (sem fechar) e
 * traz pra frente; se estava fechada, abre (toggle() dispara o
 * requestConfig() de sempre) e ja pinta a aba pedida com o que estiver em
 * cache - quando a resposta do servidor chegar, onConfigReceived() vai
 * re-renderizar do mesmo jeito, sem duplicar estado.
 */
IdleConfig.abrirNaAba = function abrirNaAba(tab) {
	const root = _root();
	const win = root.querySelector('.ic-window');
	const jaAberta = win.classList.contains('is-open');

	if (!jaAberta) {
		IdleConfig.toggle();
	}
	IdleConfig.focus();

	IdleConfig.activeTab = tab;
	// Entrar pela porta do medalhao conta como estar na aba: o jogador vai
	// fechar a janela daqui, e "a ultima aba em que eu estava" e esta.
	lembrarAba(_preferences, IdleConfig.activeTab);
	renderTabs();
	renderBody();
};

/**
 * Create component and export it
 */
export default UIManager.addComponent(IdleConfig);
