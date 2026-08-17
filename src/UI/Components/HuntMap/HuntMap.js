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
import GUIComponent from 'UI/GUIComponent.js';
import htmlText from './HuntMap.html?raw';
import cssText from './HuntMap.css?raw';

/**
 * Keep in sync with the ":host" / ".hm-window" size in HuntMap.css — used
 * to clamp the saved window position to the current viewport.
 */
const WINDOW_WIDTH = 640;
const WINDOW_HEIGHT = 460;

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
 * @var {string} current search term
 */
HuntMap.searchTerm = '';

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
		return { cls: 'locked', label: 'Bloqueado' };
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
 * ZC_RAGIDLE_CATALOGO — opcode 0x0ff1, variable size, JSON UTF-8 payload
 * (see PACKET.ZC.RAGIDLE_CATALOGO in Network/PacketStructure.js, which
 * decodes the remainder of the packet into pkt.json).
 */
function onCatalogReceived(pkt) {
	let data;
	try {
		data = JSON.parse(pkt.json);
	} catch (e) {
		console.error('[HuntMap] Falha ao interpretar o catálogo recebido:', e, pkt.json);
		setStatus('Catálogo incompatível.');
		return;
	}

	if (!data || data.v !== 1) {
		console.error('[HuntMap] Catálogo com contrato incompatível (v=' + (data && data.v) + ').', data);
		setStatus('Catálogo incompatível.');
		return;
	}

	HuntMap.catalog = data;
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
 * Region tabs: "Todas" + every region that has at least one map.
 */
function renderTabs() {
	const root = _root();
	const tabsEl = root.querySelector('.hm-tabs');
	const regions = ['Todas'].concat((HuntMap.catalog && HuntMap.catalog.regioes) || []);

	tabsEl.innerHTML = regions
		.map(
			region =>
				`<button type="button" class="hm-tab${region === HuntMap.activeTab ? ' is-active' : ''}" data-region="${escapeHtml(region)}">${escapeHtml(region)}</button>`
		)
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
 * Left-hand map card list, filtered by active tab + search term.
 */
function renderList() {
	const root = _root();
	const listEl = root.querySelector('.hm-list');
	const catalog = HuntMap.catalog;

	if (!catalog) {
		listEl.innerHTML = '';
		return;
	}

	const term = HuntMap.searchTerm.trim().toLowerCase();
	const mapas = catalog.mapas.filter(mapa => {
		if (HuntMap.activeTab !== 'Todas' && mapa.regiao !== HuntMap.activeTab) {
			return false;
		}
		if (term && !mapa.rotulo.toLowerCase().includes(term) && !mapa.mapa.toLowerCase().includes(term)) {
			return false;
		}
		return true;
	});

	if (!mapas.length) {
		listEl.innerHTML = '<div class="hm-list-empty">Nenhum mapa encontrado.</div>';
		return;
	}

	listEl.innerHTML = mapas.map(renderCard).join('');
	listEl.querySelectorAll('.hm-card').forEach(card => card.addEventListener('click', onClickCard));
}

function renderCard(mapa) {
	const catalog = HuntMap.catalog;
	const badge = computeBadge(catalog.nivel, mapa);
	const isCurrent = mapa.mapa === catalog.mapaAtual;
	const isSelected = mapa.mapa === HuntMap.selectedMapa;

	return `
		<button type="button" class="hm-card badge-${badge.cls}${isCurrent ? ' is-current' : ''}${isSelected ? ' is-selected' : ''}" data-mapa="${escapeHtml(mapa.mapa)}">
			<div class="hm-card-top">
				<span class="hm-card-name">${escapeHtml(mapa.rotulo)}</span>
				<span class="hm-card-id">${escapeHtml(mapa.mapa)}</span>
			</div>
			<div class="hm-card-bottom">
				<span class="hm-card-range">Rec. ${mapa.nivelMinimo}–${mapa.nivelMaximo}</span>
				<span class="hm-badge hm-badge-${badge.cls}">${badge.label}</span>
			</div>
			${isCurrent ? '<div class="hm-card-here">Você está aqui</div>' : ''}
		</button>`;
}

function onClickCard(e) {
	e.stopImmediatePropagation();
	HuntMap.selectedMapa = e.currentTarget.dataset.mapa;
	renderList();
	renderPanel();
}

/**
 * Right-hand "Monstros presentes" panel for the selected map.
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
	const monstersHtml = (mapa.monstros || []).map(m => renderMonster(m, false)).join('');
	const mvpHtml = mapa.mvp ? renderMonster(mapa.mvp, true) : '';

	let actionsHtml = '';
	if (isCurrent) {
		actionsHtml += '<div class="hm-here-note">Você já está neste mapa.</div>';
	} else {
		actionsHtml += `<button type="button" class="hm-btn-go" data-mapa="${escapeHtml(mapa.mapa)}"${badge.cls === 'locked' ? ' disabled' : ''}>Ir para ${escapeHtml(mapa.rotulo)}</button>`;
	}
	if (catalog.mapaAtual !== catalog.cidade.mapa) {
		actionsHtml += `<button type="button" class="hm-btn-city" data-mapa="${escapeHtml(catalog.cidade.mapa)}">Voltar para ${escapeHtml(catalog.cidade.rotulo)}</button>`;
	}

	panelEl.innerHTML = `
		<div class="hm-panel-header">
			<h3>${escapeHtml(mapa.rotulo)}</h3>
			<div class="hm-panel-sub">${escapeHtml(mapa.mapa)} · Rec. ${mapa.nivelMinimo}–${mapa.nivelMaximo} · ${badge.label}</div>
		</div>
		<ul class="hm-monster-list">${monstersHtml}${mvpHtml}</ul>
		<div class="hm-panel-actions">${actionsHtml}</div>`;

	const goBtn = panelEl.querySelector('.hm-btn-go');
	if (goBtn) {
		goBtn.addEventListener('click', onClickTravel);
	}
	const cityBtn = panelEl.querySelector('.hm-btn-city');
	if (cityBtn) {
		cityBtn.addEventListener('click', onClickTravel);
	}
}

function renderMonster(monster, isMvp) {
	const raca = RACE_PT[monster.raca] || monster.raca;
	const elemento = ELEMENT_PT[monster.elemento] || monster.elemento;
	const drops = (monster.drops || []).map(d => `${escapeHtml(d.nome)} ${formatChance(d.chance)}`).join(', ');

	return `
		<li class="hm-monster${isMvp ? ' is-mvp' : ''}">
			<div class="hm-monster-head">
				<span class="hm-monster-name">${escapeHtml(monster.nome)}</span>
				<span class="hm-monster-level">Nv ${monster.nivel}</span>
				${isMvp ? '<span class="hm-mvp-badge">MVP</span>' : ''}
			</div>
			<div class="hm-monster-meta">${escapeHtml(raca)} · ${escapeHtml(elemento)} ${monster.nivelDoElemento}</div>
			${drops ? `<div class="hm-monster-drops">${drops}</div>` : ''}
		</li>`;
}

/**
 * "Ir para [mapa]" / "Voltar para [cidade]" — both send the same custom
 * packet, only the target map name changes.
 * CZ_RAGIDLE_VIAJAR — opcode 0x0ff2, fixed 18 bytes (opcode + 16-byte name).
 */
function onClickTravel(e) {
	e.stopImmediatePropagation();
	const mapName = e.currentTarget.dataset.mapa;
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

Network.hookPacket(PACKET.ZC.RAGIDLE_CATALOGO, onCatalogReceived);

/**
 * Create component and export it
 */
export default UIManager.addComponent(HuntMap);
