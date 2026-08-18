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
import GUIComponent from 'UI/GUIComponent.js';
import htmlText from './IdleConfig.html?raw';
import cssText from './IdleConfig.css?raw';

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
 * @var {string} active tab: 'geral' | 'alvos' | 'skills' | 'recuperacao' | 'itens'
 */
IdleConfig.activeTab = 'geral';

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
 * @var {Preferences} window position (x/y are null until the player moves it)
 */
const _preferences = Preferences.get(
	'IdleConfig',
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
function applyConfig() {
	if (!IdleConfig.editConfig) {
		return;
	}
	setStatus('Aplicando...');
	IdleConfig.problemas = [];
	renderProblemas();

	const pkt = new PACKET.CZ.RAGIDLE_APLICAR_CONFIG();
	pkt.json = JSON.stringify(IdleConfig.editConfig);
	Network.sendPacket(pkt);
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
	IdleConfig.problemas = rejected ? data.problemas : [];

	if (!rejected) {
		// Either the initial "pedir" answer, or a successful "aplicar":
		// adopt the server's config as the new baseline AND the new draft.
		IdleConfig.serverConfig = data.config;
		IdleConfig.editConfig = cloneConfig(data.config);
		IdleConfig.dirty = false;
		setStatus(isApplyResponse ? 'Aplicado.' : '');
	} else {
		// Transactional refusal (contract: "NÃO-vazio = recusado
		// transacionalmente (nada mudou)"). Deliberately do NOT touch
		// serverConfig/editConfig — the player's draft stays on screen so
		// they can see what they tried and fix it; IdleConfig.dirty is left
		// as-is so "Aplicar" stays enabled for a retry.
		setStatus('');
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
			markDirty();
			renderBody();
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

	return `
		<div class="ic-section">
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
		</div>
		<div class="ic-section">
			<label class="ic-checkbox-row">
				<input type="checkbox" data-bool="coletarItens" ${cfg.coletarItens ? 'checked' : ''} />
				<span>Coletar itens automaticamente</span>
			</label>
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
function renderSkills() {
	const cfg = IdleConfig.editConfig;
	const ctx = IdleConfig.contexto;
	const ativas = ctx.skillsAtivas || [];
	const passivas = ctx.skillsPassivas || [];
	const rotacao = cfg.rotacao || [];

	let rotationHtml;
	if (!ativas.length) {
		rotationHtml = '<div class="ic-empty">Nenhuma skill ativa configurada.</div>';
	} else {
		const rows = rotacao.length
			? rotacao
					.map(
						(r, i) => `
			<div class="ic-rot-row">
				<span class="ic-rot-name">${escapeHtml(r.skillId)}</span>
				<span class="ic-rot-level">Nv ${r.nivelDeUso}</span>
				<span class="ic-rot-actions">
					<button type="button" class="ic-icon-btn" data-rot-action="up" data-rot-index="${i}" ${i === 0 ? 'disabled' : ''} title="Mover para cima">↑</button>
					<button type="button" class="ic-icon-btn" data-rot-action="down" data-rot-index="${i}" ${i === rotacao.length - 1 ? 'disabled' : ''} title="Mover para baixo">↓</button>
					<button type="button" class="ic-icon-btn" data-rot-action="remove" data-rot-index="${i}" title="Remover">✕</button>
				</span>
			</div>`
					)
					.join('')
			: '<div class="ic-empty">Nenhuma skill ativa configurada.</div>';

		const used = new Set(rotacao.map(r => r.skillId));
		const available = ativas.filter(s => !used.has(s.skillId));

		let addHtml;
		if (rotacao.length >= 3) {
			addHtml = '<div class="ic-note">Limite de 3 skills atingido.</div>';
		} else if (!available.length) {
			addHtml = '';
		} else {
			addHtml = `
				<select class="ic-add-skill" data-action="skill-add">
					<option value="">+ Adicionar skill</option>
					${available
						.map(s => `<option value="${escapeHtml(s.skillId)}">${escapeHtml(s.skillId)} (Nv ${s.aprendido})</option>`)
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
				<span>${escapeHtml(s.skillId)} (Nv ${s.aprendido})</span>
				<span class="ic-badge">ativa automaticamente</span>
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
			<label class="ic-checkbox-row ic-checkbox-locked" title="Suprimir o ataque básico depende do motor de combate (contrato congelado) — em breve.">
				<input type="checkbox" checked disabled />
				<span>Usar ataque básico</span>
			</label>
			<div class="ic-note">O personagem ataca normalmente quando nenhuma skill da lista está disponível.</div>
		</div>
		<div class="ic-section">
			<h3>Passivas</h3>
			${passivasHtml}
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
	const options = (itens || [])
		.map(
			it =>
				`<option value="${it.itemId}" ${pocao.itemId === it.itemId ? 'selected' : ''}>${escapeHtml(it.nome)} — ${it.estoque} em estoque</option>`
		)
		.join('');

	return `
		<div class="ic-subsection${enabled ? '' : ' ic-subsection-disabled'}">
			<label class="ic-switch-row">
				<span class="ic-switch">
					<input type="checkbox" data-bool="${fieldName}.ligado" ${pocao.ligado ? 'checked' : ''} ${enabled ? '' : 'disabled'} />
					<span class="ic-switch-track"></span>
				</span>
				<span class="ic-switch-text"><span class="ic-switch-label">Recuperação automática de ${label}</span></span>
			</label>
			<select class="ic-select" data-select="${fieldName}.itemId" data-select-number="1" ${enabled && pocao.ligado ? '' : 'disabled'}>
				${options}
			</select>
			<div class="ic-field-row">
				<span>Usar com <span class="ic-inline-value" data-range-display="${fieldName}.usarCom">${pocao.usarCom}%</span> ou menos de ${label}</span>
			</div>
			<input type="range" class="ic-slider" min="1" max="99" step="1" value="${pocao.usarCom}" data-range="${fieldName}.usarCom" ${enabled && pocao.ligado ? '' : 'disabled'} />
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
			${!enabled ? '<div class="ic-note ic-note-warn">Nenhum consumível de buff existe no jogo ainda — o interruptor guarda sua escolha para quando existir.</div>' : ''}
		</div>
		<div class="ic-section">
			<div class="ic-note">A seleção e a ordem individual de itens ainda não estão disponíveis.</div>
		</div>`;
}

Network.hookPacket(PACKET.ZC.RAGIDLE_CONFIG, onConfigReceived);

/**
 * Create component and export it
 */
export default UIManager.addComponent(IdleConfig);
