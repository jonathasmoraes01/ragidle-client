/**
 * UI/Components/HuntMap/HuntMap.js
 *
 * "Mapa de Caça" — custom RAGIDLE window. Lets the player browse the
 * hunting-map catalog (level range, monsters, drops, MVP) and travel
 * between maps by menu instead of the classic warp portals.
 *
 * Protocol (custom extension, not part of stock rAthena/roBrowser):
 *   CZ_RAGIDLE_PEDIR_CATALOGO 0x0ff0  (client -> server, fixed, opcode only)
 *   ZC_RAGIDLE_CATALOGO       0x0ff1  (server -> client, variable, JSON payload)
 *   CZ_RAGIDLE_VIAJAR         0x0ff2  (client -> server, fixed 18 bytes)
 * Declared in Network/PacketStructure.js (search "RAGIDLE:") and registered
 * for receive-side framing in Network/PacketRegister.js and
 * Network/Packets/packets2021_len_main.js (see comments there).
 *
 * Pattern followed here (module self-registers its own packet hook, no
 * separate Engine/MapEngine/*.js file): same as
 * UI/Components/Enchant/Enchant.js:1986 (`Network.hookPacket(...)` at
 * module top-level, right before the default export) and
 * UI/Components/CashShopIcon/CashShopIcon.js (floating icon that toggles a
 * window and sends packets straight from the UI component).
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
import { dropsDoMapa } from './dropsDoMapa.js'; // RAGIDLE: a visao agregada (I6)
import htmlText from './HuntMap.html?raw';
import cssText from './HuntMap.css?raw';
import { fecharEEsquecer } from '../limpezaDeJanelaIdle.js';

/**
 * Keep in sync with the ":host" / ".hm-window" size in HuntMap.css — used
 * to clamp the saved window position to the current viewport.
 *
 * Builder de polimento (18/08/2026), responsividade 1366x768: media com
 * Playwright (getBoundingClientRect) mostrou esta janela centralizada
 * batendo no DockIdle no piso de resolucao — janela em y:74-696 (620 +
 * bordas) contra o dock em y:690-768, 6px de sobreposicao real. O CONSERTO
 * mora so em HuntMap.css (".hm-window"/":host" dentro de "@media
 * (max-height:800px)" encolhem pra 590 so em telas baixas) — este WINDOW_
 * HEIGHT continua 620 de propósito, e a matematica de centralizar/travar
 * (onAppend, onRemove abaixo) continua assumindo 620 em toda resolucao.
 * Isso e SEGURO, nao um desalinho esquecido: em telas baixas o retangulo
 * real fica MENOR que os 620 que o JS supoe, entao "top" calculado pra uma
 * caixa de 620 sobra folga embaixo (a caixa de 590 nunca alcanca onde uma
 * de 620 alcancaria) — nunca o contrario. Ver o mesmo raciocinio, por
 * extenso, no comentario do default de StatusIdle.js/.css.
 */
const WINDOW_WIDTH = 900;
const WINDOW_HEIGHT = 620;

/**
 * Cap on how many mob avatars are shown overlapped in a map card's
 * "avatar-stack" row (HuntMap.css .hm-mob-stack) — the "N monstros" count
 * text next to it always reflects the REAL total, this only bounds the
 * icons.
 */
const MOB_STACK_MAX = 5;

/**
 * Race translation (PT-BR), fixed dictionary as requested.
 */
const RACE_PT = {
	Formless: 'Amorfo',
	Undead: 'Morto-vivo',
	Brute: 'Bruto',
	Plant: 'Planta',
	Insect: 'Inseto',
	Fish: 'Peixe',
	Demon: 'Demônio',
	DemiHuman: 'Semi-humano',
	Angel: 'Anjo',
	Dragon: 'Dragão'
};

/**
 * Element translation (PT-BR), fixed dictionary as requested.
 */
const ELEMENT_PT = {
	Neutral: 'Neutro',
	Water: 'Água',
	Earth: 'Terra',
	Fire: 'Fogo',
	Wind: 'Vento',
	Poison: 'Veneno',
	Holy: 'Sagrado',
	Dark: 'Sombrio',
	Ghost: 'Fantasma',
	Undead: 'Morto-vivo'
};

/**
 * Create Component
 */
const HuntMap = new GUIComponent('HuntMap', cssText);

HuntMap.render = () => htmlText;

/**
 * Floating icon must not block scene clicks/hover — same choice as the
 * other always-on floating icon, CashShopIcon (see
 * UI/Components/CashShopIcon/CashShopIcon.js:60). Also sidesteps having to
 * reason about GUIComponent's MouseMode.STOP hover listeners
 * (GUIComponent.js:823-866) firing on a ":host" box that is mostly
 * transparent to the pointer (see HuntMap.css header comment).
 */
HuntMap.mouseMode = GUIComponent.MouseMode.CROSS;

/**
 * @var {object|null} last catalog received from the server (contract v1)
 */
HuntMap.catalog = null;

/**
 * @var {string} currently selected map (right-hand monster panel)
 */
HuntMap.selectedMapa = null;

/**
 * @var {string} active region tab ("Todas" or one of catalog.regioes)
 */
HuntMap.activeTab = 'Todas';

/**
 * @var {string} current search term (matches map name, monster name AND
 *      drop name — see mapaMatchesSearch below)
 */
HuntMap.searchTerm = '';

/**
 * @var {boolean} "Filtros" popover's "só ideais para mim" checkbox
 */
HuntMap.filterIdealOnly = false;

/**
 * @var {string} left-list sort key: 'nivel' | 'nivel-recomendado' | 'nome'
 */
HuntMap.sortKey = 'nivel';

/**
 * @var {number|string|null} mobId selected in the right-hand "Monstros
 *      presentes" chip grid (drives the mob detail block below it). Reset
 *      to null whenever the selected map changes so the panel falls back
 *      to the first monster of the new map (see onClickCard/renderPanel).
 */
/**
 * QUAL VISAO DE DROP o painel mostra (RAGIDLE, I6 — 31/08/2026).
 *
 * `'mob'` e a de sempre: escolhe um monstro no chip e ve o drop DELE.
 * `'mapa'` e a nova: todo o drop do mapa numa lista so, deduplicado.
 *
 * O dono pediu "ter as 2 opcoes" com todas as letras, entao a visao por
 * monstro continua sendo o padrao — quem abre a janela ve o que sempre viu.
 */
HuntMap.visaoDeDrop = 'mob';
HuntMap.selectedMobId = null;

/**
 * @var {boolean} RAGIDLE: true when a catalog fetch was kicked off by
 * HuntMap.travelToCity() (see below) instead of the window opening — once
 * the catalog arrives, onCatalogReceived travels straight to the city and
 * leaves the window closed, instead of the usual render.
 */
let _pendingAutoTravel = false;

/**
 * ESQUECE O PERSONAGEM ANTERIOR — ver a nota gemea em IdleConfig.js
 * (27/08/2026, auditoria C).
 *
 * Aqui o catalogo depende do NIVEL (o filtro "ideal para mim"), entao o de A
 * mostrado para B nao e so estranho: e errado. E `_pendingAutoTravel` armada
 * atravessando a troca teleportaria o personagem novo.
 */
HuntMap.limparEstadoDoPersonagem = function limparEstadoDoPersonagem() {
	HuntMap.catalog = null;
	HuntMap.selectedMapa = null;
	HuntMap.selectedMobId = null;
	_pendingAutoTravel = false;
	/*
	 * ZERAR O DADO NAO BASTA: `GUIComponent.remove()` so DESANEXA o host,
	 * entao o shadow DOM (com `is-open` e o HTML do personagem anterior)
	 * atravessa a troca. Ver `UI/Components/limpezaDeJanelaIdle.js`.
	 */
	fecharEEsquecer(_root(), '.hm-window');
};

/**
 * @var {Preferences} window position (x/y are null until the player moves it)
 */
const _preferences = Preferences.get(
	'HuntMap',
	{
		x: null,
		y: null
	},
	1.0
);

/**
 * Helper: query inside shadow root
 */
function _root() {
	return HuntMap._shadow || HuntMap._host;
}

/**
 * Escape user/server supplied text before injecting into innerHTML.
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
 * Drop chance comes in ten-thousandths (7000 = 70%, per the contract).
 * Presentation rule requested: no decimals normally, one decimal place
 * when the result is below 1%.
 */
function formatChance(chance) {
	const pct = (chance || 0) / 100;
	const text = pct < 1 ? pct.toFixed(1) : String(Math.round(pct));
	return text + '%';
}

/**
 * Difficulty badge relative to the player's level. Pure presentation rule
 * (as specced): not a server concept, computed client-side from the
 * catalog fields nivelQueAbre/nivelMinimo/nivelMaximo.
 */
function computeBadge(nivel, mapa) {
	if (nivel < mapa.nivelQueAbre) {
		return { cls: 'locked', label: '🔒 Bloqueado' };
	}
	if (nivel > mapa.nivelMaximo) {
		return { cls: 'easy', label: 'Fácil' };
	}
	if (nivel >= mapa.nivelMinimo) {
		return { cls: 'ideal', label: 'Ideal para você' };
	}
	return { cls: 'challenge', label: 'Desafio' };
}

/**
 * One-time setup (runs once, during GUIComponent#prepare()).
 */
HuntMap.init = function init() {
	const root = _root();

	root.querySelector('.hm-button').addEventListener('click', onClickButton);
	root.querySelector('.hm-close').addEventListener('click', onClickClose);
	root.querySelector('.hm-search').addEventListener('input', onSearchInput);
	root.querySelector('.hm-filters-btn').addEventListener('click', onClickFiltersToggle);
	root.querySelector('.hm-filter-ideal').addEventListener('change', onChangeFilterIdeal);
	root.querySelector('.hm-sort').addEventListener('change', onChangeSort);

	// Capture-phase listener so it always runs before a card/chip/button's
	// own bubble-phase handler (several of those call
	// e.stopImmediatePropagation(), which would otherwise stop a bubble-phase
	// listener up on ".hm-window" from ever seeing the click) — closes the
	// filters popover on any click outside ".hm-filters-wrap".
	root.querySelector('.hm-window').addEventListener('click', onWindowClickCapture, true);

	this.draggable(root.querySelector('.hm-titlebar'));

	// Default centered position, may be overridden by saved preferences in onAppend()
	this._host.style.top = Math.max(0, (Renderer.height - WINDOW_HEIGHT) / 2) + 'px';
	this._host.style.left = Math.max(0, (Renderer.width - WINDOW_WIDTH) / 2) + 'px';

	renderTabs();
	renderList();
	renderPanel();
};

/**
 * Restore saved window position once appended to the DOM.
 */
HuntMap.onAppend = function onAppend() {
	if (_preferences.x != null && _preferences.y != null) {
		this._host.style.top = Math.min(Math.max(0, _preferences.y), Renderer.height - WINDOW_HEIGHT) + 'px';
		this._host.style.left = Math.min(Math.max(0, _preferences.x), Renderer.width - WINDOW_WIDTH) + 'px';
	}
};

/**
 * Save window position when the component is removed (defensive — in
 * practice this floating icon stays appended for the whole map session,
 * same as CashShopIcon/ChatBox/etc, see Engine/MapEngine.js).
 */
HuntMap.onRemove = function onRemove() {
	savePosition();
};

function savePosition() {
	_preferences.x = parseInt(HuntMap._host.style.left, 10) || 0;
	_preferences.y = parseInt(HuntMap._host.style.top, 10) || 0;
	_preferences.save();
}

/**
 * Show/hide the window (button stays visible either way).
 */
HuntMap.toggle = function toggle() {
	const root = _root();
	const win = root.querySelector('.hm-window');
	if (win.classList.contains('is-open')) {
		closeWindow();
	} else {
		win.classList.add('is-open');
		HuntMap.focus();
		requestCatalog();
	}
};

function closeWindow() {
	const root = _root();
	root.querySelector('.hm-window').classList.remove('is-open');
	savePosition();
}

function onClickButton(e) {
	e.stopImmediatePropagation();
	HuntMap.toggle();
}

function onClickClose(e) {
	e.stopImmediatePropagation();
	closeWindow();
}

function onSearchInput(e) {
	HuntMap.searchTerm = e.target.value;
	renderList();
}

function onClickFiltersToggle(e) {
	e.stopImmediatePropagation();
	_root().querySelector('.hm-filters-wrap').classList.toggle('is-open');
}

function onChangeFilterIdeal(e) {
	HuntMap.filterIdealOnly = e.target.checked;
	renderList();
}

function onChangeSort(e) {
	HuntMap.sortKey = e.target.value;
	renderList();
}

function onWindowClickCapture(e) {
	const wrap = _root().querySelector('.hm-filters-wrap');
	if (wrap && wrap.classList.contains('is-open') && !wrap.contains(e.target)) {
		wrap.classList.remove('is-open');
	}
}

/**
 * Ask the server for the hunting-map catalog.
 * CZ_RAGIDLE_PEDIR_CATALOGO — opcode 0x0ff0, fixed 2 bytes (opcode only).
 */
function requestCatalog() {
	setStatus(HuntMap.catalog ? 'Atualizando catálogo...' : 'Carregando mapas de caça...');
	Network.sendPacket(new PACKET.CZ.RAGIDLE_PEDIR_CATALOGO());
}

function setStatus(text) {
	const root = _root();
	const el = root.querySelector('.hm-status');
	if (el) {
		el.textContent = text || '';
	}
}

/**
 * Avisa NO CHAT quando a janela esta fechada (27/08/2026, auditoria C).
 *
 * `setStatus` escreve dentro da janela do Mapa de Caca. Quando o pedido veio
 * do botao contextual — que e o caminho do `travelToCity` — a janela esta
 * fechada, e a mensagem ia para um DOM que ninguem ve: o jogador clicava
 * "Retornar para Prontera", nao viajava, e nada aparecia na tela.
 *
 * Com a janela ABERTA nao se repete: ela ja mostra o status.
 */
function avisarSeAJanelaEstaFechada(texto) {
	const janela = _root().querySelector('.hm-window');
	if (janela && janela.classList.contains('is-open')) {
		return;
	}
	ChatBox.addText(texto, ChatBox.TYPE.ERROR, ChatBox.FILTER.PUBLIC_LOG);
}

/**
 * ZC_RAGIDLE_CATALOGO — opcode 0x0ff1, variable size, JSON UTF-8 payload
 * (see PACKET.ZC.RAGIDLE_CATALOGO in Network/PacketStructure.js, which
 * decodes the remainder of the packet into pkt.json).
 */
function onCatalogReceived(pkt) {
	/*
	 * A VIAGEM PENDENTE MORRE COM A RESPOSTA RUIM (27/08/2026, auditoria C).
	 *
	 * `travelToCity()` arma `_pendingAutoTravel` e pede o catalogo so para
	 * descobrir `catalog.cidade.mapa` — a janela fica fechada o tempo todo. Os
	 * dois `return` antecipados abaixo ficavam ANTES do consumo da flag, entao
	 * uma resposta ilegivel a deixava armada PARA SEMPRE (ela e de modulo e nao
	 * e zerada no `onRemove`).
	 *
	 * O estrago aparecia muito depois e sem relacao com a causa: o jogador abre
	 * a janela "Mapa de Caca" pela primeira vez, o catalogo bom chega, a flag
	 * ainda e `true` — e ele e TELEPORTADO para a cidade e a janela fecha na
	 * cara dele, sem ter pedido nada.
	 *
	 * Desarmar aqui, antes de qualquer `return`, e o conserto inteiro: a viagem
	 * que a resposta ruim nao pode cumprir nao fica pendurada esperando outra.
	 */
	const viagemPendente = _pendingAutoTravel;
	_pendingAutoTravel = false;

	let data;
	try {
		data = JSON.parse(pkt.json);
	} catch (e) {
		console.error('[HuntMap] Falha ao interpretar o catálogo recebido:', e, pkt.json);
		setStatus('Catálogo incompatível.');
		avisarSeAJanelaEstaFechada('Catálogo de mapas incompatível — a viagem não saiu.');
		return;
	}

	if (!data || data.v !== 1) {
		console.error('[HuntMap] Catálogo com contrato incompatível (v=' + (data && data.v) + ').', data);
		setStatus('Catálogo incompatível.');
		avisarSeAJanelaEstaFechada('Catálogo de mapas incompatível — a viagem não saiu.');
		return;
	}

	HuntMap.catalog = data;

	// RAGIDLE: HuntMap.travelToCity() asked for this catalog just to learn
	// catalog.cidade.mapa, not to open the window — finish that trip now and
	// skip the normal render (the window stays closed the whole time).
	if (viagemPendente) {
		sendTravel(data.cidade && data.cidade.mapa);
		return;
	}

	if (!HuntMap.selectedMapa || !data.mapas.some(m => m.mapa === HuntMap.selectedMapa)) {
		HuntMap.selectedMapa = data.mapaAtual;
	}
	if (HuntMap.activeTab !== 'Todas' && !data.regioes.includes(HuntMap.activeTab)) {
		HuntMap.activeTab = 'Todas';
	}

	setStatus('');
	renderTabs();
	renderList();
	renderPanel();
}

/**
 * Region tabs: "Todas" + every region that has at least one map, each with
 * a real count of maps in that region (spec: "Todas 21", "Prontera 2", ...).
 * Counts come from the FULL catalog (not filtered by search/sort) — a tab's
 * number is "how many maps are in this region", independent of what is
 * currently typed in the search box.
 */
function renderTabs() {
	const root = _root();
	const tabsEl = root.querySelector('.hm-tabs');
	const catalog = HuntMap.catalog;
	const allMapas = (catalog && catalog.mapas) || [];
	const regions = ['Todas'].concat((catalog && catalog.regioes) || []);

	tabsEl.innerHTML = regions
		.map(region => {
			const count = region === 'Todas' ? allMapas.length : allMapas.filter(m => m.regiao === region).length;
			return `<button type="button" class="hm-tab ri-tab${region === HuntMap.activeTab ? ' is-active' : ''}" data-region="${escapeHtml(region)}">${escapeHtml(region)} <span class="hm-tab-count">${count}</span></button>`;
		})
		.join('');

	tabsEl.querySelectorAll('.hm-tab').forEach(btn => btn.addEventListener('click', onClickTab));
}

function onClickTab(e) {
	e.stopImmediatePropagation();
	HuntMap.activeTab = e.currentTarget.dataset.region;
	renderTabs();
	renderList();
}

/**
 * All monsters of a map as one flat list, common population first, MVP
 * last (if any) — used everywhere a map's "every monster" set is needed
 * (card avatar-stack, right-panel chip grid, search-by-monster/drop).
 */
function allMonstersOf(mapa) {
	return (mapa.monstros || []).concat(mapa.mvp ? [mapa.mvp] : []);
}

/**
 * Search box matches map name, map id, monster name AND — since the
 * catalog carries drops per monster — drop name (spec: "filtra por nome de
 * mapa E nome de monstro E ... nome de drop").
 */
function mapaMatchesSearch(mapa, term) {
	if (!term) {
		return true;
	}
	if (mapa.rotulo.toLowerCase().includes(term) || mapa.mapa.toLowerCase().includes(term)) {
		return true;
	}
	return allMonstersOf(mapa).some(monster => {
		if (monster.nome.toLowerCase().includes(term)) {
			return true;
		}
		return (monster.drops || []).some(d => d.nome.toLowerCase().includes(term));
	});
}

/**
 * Left-list sort orders (spec: "Para meu nível" / "Nível" / "Nome").
 * "Para meu nível" ranks maps by how close their average population level
 * (nivelMedio) is to the player's current level — the same "how well does
 * this map fit me right now" idea the badges already convey, just used as
 * a sort key instead of a color.
 */
function sortMapas(mapas, sortKey, nivel) {
	const arr = mapas.slice();
	if (sortKey === 'nivel') {
		arr.sort((a, b) => (a.nivelMinimo - b.nivelMinimo) || (a.nivelMedio - b.nivelMedio) || a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
	} else if (sortKey === 'nome') {
		arr.sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
	} else {
		arr.sort((a, b) => Math.abs(a.nivelMedio - nivel) - Math.abs(b.nivelMedio - nivel));
	}
	return arr;
}

/**
 * Left-hand map card grid, filtered by active tab + search term + the
 * "Filtros" popover's "só ideais para mim" checkbox, then sorted by the
 * sub-bar's "Ordenar por" select.
 */
function renderList() {
	const root = _root();
	const listEl = root.querySelector('.hm-list');
	const countEl = root.querySelector('.hm-count');
	const catalog = HuntMap.catalog;

	if (!catalog) {
		listEl.innerHTML = '';
		if (countEl) {
			countEl.textContent = '';
		}
		return;
	}

	const term = HuntMap.searchTerm.trim().toLowerCase();
	let mapas = catalog.mapas.filter(mapa => {
		if (HuntMap.activeTab !== 'Todas' && mapa.regiao !== HuntMap.activeTab) {
			return false;
		}
		if (!mapaMatchesSearch(mapa, term)) {
			return false;
		}
		if (HuntMap.filterIdealOnly && computeBadge(catalog.nivel, mapa).cls !== 'ideal') {
			return false;
		}
		return true;
	});
	mapas = sortMapas(mapas, HuntMap.sortKey, catalog.nivel);

	if (countEl) {
		countEl.textContent = mapas.length === 1 ? '1 mapa encontrado' : mapas.length + ' mapas encontrados';
	}

	if (!mapas.length) {
		listEl.innerHTML = '<div class="hm-list-empty">Nenhum mapa encontrado.</div>';
		return;
	}

	listEl.innerHTML = mapas.map(renderCard).join('');
	listEl.querySelectorAll('.hm-card').forEach(card => card.addEventListener('click', onClickCard));
	// "Caçar Aqui" per card: same travel handler as the detail panel's
	// "Trocar para X" (onClickTravel) — just a second trigger, no new logic.
	listEl.querySelectorAll('.hm-card-go').forEach(btn => btn.addEventListener('click', onClickTravel));
}

/**
 * NOTE on the wrapper tag: this used to be a <button>, but it now contains
 * an inner ".hm-card-go" <button> ("Caçar Aqui") for available maps, and
 * HTML forbids nesting interactive controls inside a <button> (the parser
 * would silently close the outer button early and break the layout). The
 * wrapper is a <div role="button" tabindex="0"> instead — same click
 * listener (onClickCard), same data-mapa attribute, same classes/ids
 * everything else relies on, just a tag swap so the nested action button
 * is valid markup.
 */
function renderCard(mapa) {
	const catalog = HuntMap.catalog;
	const badge = computeBadge(catalog.nivel, mapa);
	const isCurrent = mapa.mapa === catalog.mapaAtual;
	const isSelected = mapa.mapa === HuntMap.selectedMapa;
	const monstros = allMonstersOf(mapa);
	const avatarsHtml = monstros
		.slice(0, MOB_STACK_MAX)
		.map(m => `<img class="hm-mob-avatar" src="/ragidle/mobs/${m.mobId}.png" alt="" onerror="this.style.display='none'" />`)
		.join('');

	// Same trigger everywhere: only available (not current, not locked) maps
	// get the button, mirroring the detail panel's own "Trocar para X" rule.
	const goButtonHtml =
		!isCurrent && badge.cls !== 'locked'
			? `<button type="button" class="hm-card-go ri-btn" data-mapa="${escapeHtml(mapa.mapa)}">Caçar Aqui</button>`
			: '';

	return `
		<div class="hm-card badge-${badge.cls}${isCurrent ? ' is-current' : ''}${isSelected ? ' is-selected' : ''}" data-mapa="${escapeHtml(mapa.mapa)}" role="button" tabindex="0">
			<div class="hm-card-thumb">
				<img src="/ragidle/minimapas/${escapeHtml(mapa.mapa)}.webp" alt="" onerror="this.style.display='none'" />
			</div>
			<div class="hm-card-body">
				<div class="hm-card-top">
					<span class="hm-card-name">${escapeHtml(mapa.rotulo)}</span>
					<span class="hm-badge hm-badge-${badge.cls} ri-badge${badge.cls === 'ideal' ? ' ri-badge--verde' : badge.cls === 'locked' ? ' ri-badge--cinza' : ''}">${badge.label}</span>
				</div>
				<div class="hm-card-range">Rec. ${mapa.nivelMinimo}–${mapa.nivelMaximo}</div>
				<div class="hm-card-mobs">
					<span class="hm-mob-stack">${avatarsHtml}</span>
					<span class="hm-card-mob-count">${monstros.length} monstro${monstros.length === 1 ? '' : 's'}</span>
				</div>
				${isCurrent ? '<div class="hm-card-here">Você está aqui</div>' : ''}
				${goButtonHtml}
			</div>
		</div>`;
}

function onClickCard(e) {
	e.stopImmediatePropagation();
	HuntMap.selectedMapa = e.currentTarget.dataset.mapa;
	HuntMap.selectedMobId = null;
	renderList();
	renderPanel();
}

/**
 * Right-hand "Destino" panel for the selected map: recommended level,
 * "Monstros presentes" as a 2-column chip grid (click a chip to show that
 * monster's level/race/element/drops below), then the travel actions.
 */
function renderPanel() {
	const root = _root();
	const panelEl = root.querySelector('.hm-panel');
	const catalog = HuntMap.catalog;

	if (!catalog) {
		panelEl.innerHTML = '<div class="hm-panel-empty">Abra o mapa de caça para carregar o catálogo.</div>';
		return;
	}

	const mapa = catalog.mapas.find(m => m.mapa === HuntMap.selectedMapa);
	if (!mapa) {
		panelEl.innerHTML = '<div class="hm-panel-empty">Selecione um mapa para ver os monstros.</div>';
		return;
	}

	const badge = computeBadge(catalog.nivel, mapa);
	const isCurrent = mapa.mapa === catalog.mapaAtual;
	const monstros = allMonstersOf(mapa);

	if (!HuntMap.selectedMobId || !monstros.some(m => String(m.mobId) === String(HuntMap.selectedMobId))) {
		HuntMap.selectedMobId = monstros.length ? monstros[0].mobId : null;
	}

	const chipsHtml = monstros.length
		? monstros
				.map(m => {
					const isMvp = !!(mapa.mvp && m.mobId === mapa.mvp.mobId);
					const isSelected = String(m.mobId) === String(HuntMap.selectedMobId);
					return `
				<button type="button" class="hm-chip${isSelected ? ' is-selected' : ''}${isMvp ? ' is-mvp' : ''}" data-mob-id="${m.mobId}">
					<span class="hm-chip-avatar"><img src="/ragidle/mobs/${m.mobId}.png" alt="" onerror="this.style.display='none'" /></span>
					<span class="hm-chip-name">${escapeHtml(m.nome)}</span>
					${isMvp ? '<span class="hm-chip-mvp">MVP</span>' : ''}
				</button>`;
				})
				.join('')
		: '<div class="hm-panel-empty">Nenhum monstro conhecido.</div>';

	/*
	 * AS DUAS VISOES (RAGIDLE, I6 — 31/08/2026). O dono: "mostrar todo o drop do
	 * mapa, em vez de separado por mobs (ter as 2 opcoes)". O "ter as 2" e
	 * explicito, entao a de sempre continua e esta entra ao lado.
	 */
	const porMapa = HuntMap.visaoDeDrop === 'mapa';
	const alternadorHtml = `
		<div class="hm-visao" role="tablist">
			<button type="button" class="hm-visao-btn${porMapa ? '' : ' is-selected'}" data-visao="mob" role="tab" aria-selected="${porMapa ? 'false' : 'true'}">Por monstro</button>
			<button type="button" class="hm-visao-btn${porMapa ? ' is-selected' : ''}" data-visao="mapa" role="tab" aria-selected="${porMapa ? 'true' : 'false'}">Do mapa</button>
		</div>`;

	const selectedMonster = monstros.find(m => String(m.mobId) === String(HuntMap.selectedMobId));
	const detailHtml = porMapa
		? renderDropsDoMapa(mapa)
		: (selectedMonster ? renderMobDetail(selectedMonster, mapa) : '');

	let actionsHtml = '';
	if (isCurrent) {
		actionsHtml += '<div class="hm-here-note">Você já está neste mapa.</div>';
	} else {
		actionsHtml += `<button type="button" class="hm-btn-go ri-btn" data-mapa="${escapeHtml(mapa.mapa)}"${badge.cls === 'locked' ? ' disabled' : ''}>Trocar para ${escapeHtml(mapa.rotulo)}</button>`;
	}
	const atCity = catalog.mapaAtual === catalog.cidade.mapa;
	actionsHtml += `<button type="button" class="hm-btn-city ri-btn ri-btn--sec" data-mapa="${escapeHtml(catalog.cidade.mapa)}"${atCity ? ' disabled' : ''}>Retornar ao ponto salvo</button>`;

	panelEl.innerHTML = `
		<div class="hm-panel-label">Destino</div>
		<h3 class="hm-panel-title">${escapeHtml(mapa.rotulo)}</h3>
		<div class="hm-panel-stat">
			<span class="hm-panel-stat-label">Nível recomendado</span>
			<span class="hm-panel-stat-value">${mapa.nivelMinimo}–${mapa.nivelMaximo}</span>
		</div>
		<div class="hm-panel-section-title">Monstros presentes</div>
		<div class="hm-chip-grid">${chipsHtml}</div>
		${alternadorHtml}
		${detailHtml}
		<div class="hm-panel-actions">${actionsHtml}</div>`;

	panelEl.querySelectorAll('[data-mob-id]').forEach(chip => chip.addEventListener('click', onClickChip));
	panelEl.querySelectorAll('[data-visao]').forEach(b => b.addEventListener('click', onClickVisao));
	const goBtn = panelEl.querySelector('.hm-btn-go');
	if (goBtn) {
		goBtn.addEventListener('click', onClickTravel);
	}
	const cityBtn = panelEl.querySelector('.hm-btn-city');
	if (cityBtn) {
		cityBtn.addEventListener('click', onClickTravel);
	}
}

/**
 * Detail block for the monster selected in the chip grid: level / race /
 * element (translated, same dictionaries as before) and its drop list with
 * chance percentages (contract already provides them, see formatChance).
 */
function renderMobDetail(monster, mapa) {
	const raca = RACE_PT[monster.raca] || monster.raca;
	const elemento = ELEMENT_PT[monster.elemento] || monster.elemento;
	const isMvp = !!(mapa.mvp && monster.mobId === mapa.mvp.mobId);
	const drops = monster.drops || [];
	const dropsHtml = drops.length
		? `<ul class="hm-drops-list">${drops.map(d => `<li><span>${escapeHtml(d.nome)}</span><span>${formatChance(d.chance)}</span></li>`).join('')}</ul>`
		: '<div class="hm-drops-empty">Sem drops conhecidos.</div>';

	return `
		<div class="hm-mob-detail">
			<div class="hm-mob-detail-name">${escapeHtml(monster.nome)}${isMvp ? ' <span class="hm-mvp-badge">MVP</span>' : ''}</div>
			<div class="hm-mob-detail-row"><span>Nível</span><span>${monster.nivel}</span></div>
			<div class="hm-mob-detail-row"><span>Raça</span><span>${escapeHtml(raca)}</span></div>
			<div class="hm-mob-detail-row"><span>Elemento</span><span>${escapeHtml(elemento)} ${monster.nivelDoElemento}</span></div>
			<div class="hm-drops-title">Drops</div>
			${dropsHtml}
		</div>`;
}

/**
 * TODO O DROP DO MAPA, numa lista so (RAGIDLE, I6 — 31/08/2026).
 *
 * A REGRA (deduplicar por `itemId`, escolher a MAIOR chance, ordenar de forma
 * estavel) mora em `dropsDoMapa.js`, num modulo sem imports — e tem teste que a
 * EXECUTA (`servidor/mapa/drops-do-mapa.test.ts`, 11 casos). Aqui so se desenha.
 *
 * A coluna da direita diz "melhor", e nao "chance": medido no catalogo de hoje,
 * 25 dos 33 mapas tem item que cai de mais de um monstro, e a chance de um item
 * "no mapa" nao existe no rAthena — ela e por monstro. Somar daria numero
 * inventado. Quando ha mais de uma origem, a linha mostra de quantas, e o
 * `title` nomeia cada monstro com a chance dele.
 */
function renderDropsDoMapa(mapa) {
	const linhas = dropsDoMapa(mapa);
	if (!linhas.length) {
		return '<div class="hm-mob-detail"><div class="hm-drops-empty">Sem drops conhecidos neste mapa.</div></div>';
	}

	const itensHtml = linhas
		.map(l => {
			const varios = l.deQuantosMobs > 1;
			const origem = l.monstros
				.map(m => `${m.nome} ${formatChance(m.chance)}`)
				.join(' · ');
			return `
			<li title="${escapeHtml(origem)}">
				<span>${escapeHtml(l.nome)}${varios ? `<span class="hm-drop-origens">${l.deQuantosMobs} mobs</span>` : ''}</span>
				<span>${formatChance(l.melhorChance)}</span>
			</li>`;
		})
		.join('');

	return `
		<div class="hm-mob-detail">
			<div class="hm-mob-detail-name">Todo o drop de ${escapeHtml(mapa.rotulo)}</div>
			<div class="hm-drops-title">${linhas.length} ${linhas.length === 1 ? 'item' : 'itens'} <span class="hm-drops-legenda">melhor chance</span></div>
			<ul class="hm-drops-list hm-drops-list--mapa">${itensHtml}</ul>
		</div>`;
}

function onClickVisao(e) {
	e.stopImmediatePropagation();
	HuntMap.visaoDeDrop = e.currentTarget.dataset.visao;
	renderPanel();
}

function onClickChip(e) {
	e.stopImmediatePropagation();
	HuntMap.selectedMobId = e.currentTarget.dataset.mobId;
	renderPanel();
}

/**
 * "Ir para [mapa]" / "Voltar para [cidade]" — both send the same custom
 * packet, only the target map name changes. Shared by onClickTravel (the
 * panel/card buttons below) AND HuntMap.travelToCity (RAGIDLE, the
 * "Retornar para Prontera" contextual button — see HuntButtonIdle.js).
 * CZ_RAGIDLE_VIAJAR — opcode 0x0ff2, fixed 18 bytes (opcode + 16-byte name).
 */
function sendTravel(mapName) {
	if (!mapName) {
		return;
	}

	const pkt = new PACKET.CZ.RAGIDLE_VIAJAR();
	pkt.mapName = mapName;
	Network.sendPacket(pkt);

	// Server answers with the standard mapmove packet; the client reloads
	// the map on its own, so just close our window.
	closeWindow();
}

function onClickTravel(e) {
	e.stopImmediatePropagation();
	sendTravel(e.currentTarget.dataset.mapa);
}

/**
 * RAGIDLE: usado pelo botao de caca contextual (UI/Components/HuntButtonIdle
 * /HuntButtonIdle.js) para viajar direto de volta pra cidade SEM abrir esta
 * janela. Manda o MESMO pacote CZ_RAGIDLE_VIAJAR que o botao "Retornar ao
 * ponto salvo" do painel ja manda (sendTravel acima) — nenhum pacote novo,
 * so um segundo gatilho pro mesmo handler.
 *
 * Se o catalogo ja foi carregado nesta sessao (a janela foi aberta ao menos
 * uma vez), catalog.cidade.mapa ja e conhecido e a viagem sai na hora. Caso
 * contrario (jogador nunca abriu o Mapa de Caça), pede o catalogo — o MESMO
 * CZ_RAGIDLE_PEDIR_CATALOGO de sempre (requestCatalog) — e viaja assim que a
 * resposta chegar (ver o _pendingAutoTravel dentro de onCatalogReceived),
 * sem em nenhum momento abrir a janela.
 */
HuntMap.travelToCity = function travelToCity() {
	if (HuntMap.catalog && HuntMap.catalog.cidade) {
		sendTravel(HuntMap.catalog.cidade.mapa);
		return;
	}
	_pendingAutoTravel = true;
	requestCatalog();
};

Network.hookPacket(PACKET.ZC.RAGIDLE_CATALOGO, onCatalogReceived);

/**
 * Create component and export it
 */
export default UIManager.addComponent(HuntMap);
