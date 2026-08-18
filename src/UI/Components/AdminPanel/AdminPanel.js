/**
 * UI/Components/AdminPanel/AdminPanel.js
 *
 * "Painel de admin" — custom RAGIDLE window. Lets the OWNER's account
 * (Session.AID === 2000000, see isOwnerAccount() below) inspect and edit
 * a handful of admin-only character fields: class, zeny, base/job level,
 * and attribute/skill points.
 *
 * Protocol (custom extension, not part of stock rAthena/roBrowser):
 *   CZ_RAGIDLE_PEDIR_ADMIN    0x0ff6  (client -> server, fixed, opcode only)
 *   ZC_RAGIDLE_ADMIN          0x0ff7  (server -> client, variable, JSON;
 *                                       answers BOTH pedir and aplicar)
 *   CZ_RAGIDLE_APLICAR_ADMIN  0x0ff8  (client -> server, variable, JSON —
 *                                       a PARTIAL object, applied
 *                                       transactionally server-side)
 * Declared in Network/PacketStructure.js (search "RAGIDLE:") and registered
 * for receive-side framing in Network/PacketRegister.js and
 * Network/Packets/packets2021_len_main.js (see comments there). Opcodes
 * 0x0ff6-0x0ff8 sit right after IdleConfig's 0x0ff3-0x0ff5 in the same free
 * range of this fork's packet tables.
 *
 * IMPORTANT — the server only ever answers ZC_RAGIDLE_ADMIN for the owner's
 * account (AID 2000000); for any other account it stays silent. That silence
 * is enforced server-side; this client only decides whether to SHOW the
 * button/window at all (isOwnerAccount()/AdminPanel.onAppend below) and,
 * separately, how to react if a "pedir" for the owner's account itself gets
 * no answer within 3s (requestAdmin()/onClickButton below).
 *
 * Pattern followed here is IdleConfig (UI/Components/IdleConfig/IdleConfig.js,
 * read in full before writing this file): GUIComponent base class, ES
 * modules, shadow DOM, CSS/HTML via `?raw`, a floating button that toggles
 * the window, `Network.hookPacket(...)` self-registered at module top-level,
 * mounted in Engine/MapEngine.js next to HuntMap/IdleConfig (import +
 * prepare() + append()). IdleConfig.js's variable-length CZ build (u16
 * opcode + u16 length in UTF-8 BYTES + JSON) is copied verbatim in
 * PacketStructure.js for CZ_RAGIDLE_APLICAR_ADMIN. IdleConfig.js is cited by
 * file:line throughout below wherever a mechanism is reused.
 *
 * @author RagIdle
 */

import Renderer from 'Renderer/Renderer.js';
import Preferences from 'Core/Preferences.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import Session from 'Engine/SessionStorage.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import htmlText from './AdminPanel.html?raw';
import cssText from './AdminPanel.css?raw';

/**
 * Keep in sync with the ":host" / ".ap-window" size in AdminPanel.css — used
 * to clamp the saved window position to the current viewport (same role as
 * IdleConfig's WINDOW_WIDTH/HEIGHT, IdleConfig.js:46-47).
 */
const WINDOW_WIDTH = 380;
const WINDOW_HEIGHT = 520;

/**
 * The one account this window ever works for. The server enforces this on
 * every packet (silence for anyone else); this constant only drives whether
 * the client shows the button/window at all (see onAppend() below).
 */
const OWNER_AID = 2000000;

/**
 * How long to wait for a ZC_RAGIDLE_ADMIN answer to a "pedir" before telling
 * the player they don't have admin access (spec: 3s).
 */
const PEDIR_TIMEOUT_MS = 3000;

/**
 * Editable field list. Each key matches both a "personagem" field from the
 * contract and a `data-field` attribute in the rendered HTML — one small
 * generic binder (bindFieldControls) below handles all of them instead of
 * one bespoke listener per field.
 */
const EDITABLE_FIELDS = ['classe', 'zeny', 'nivel', 'nivelDeJob', 'pontosDeAtributo', 'pontosDeSkill'];

/**
 * Create Component
 */
const AdminPanel = new GUIComponent('AdminPanel', cssText);

AdminPanel.render = () => htmlText;

/**
 * Floating icon must not block scene clicks/hover — same reasoning and same
 * choice as HuntMap (HuntMap.js:81-89) and IdleConfig (IdleConfig.js:56-61).
 */
AdminPanel.mouseMode = GUIComponent.MouseMode.CROSS;

/**
 * @var {object|null} last full contract payload confirmed by the server
 *      ({ v, personagem, classes, limites }) — classes/limites are only
 *      ever replaced by a fresh non-rejected answer, same lifetime as
 *      IdleConfig.serverConfig (IdleConfig.js:64-68).
 */
AdminPanel.serverData = null;

/**
 * @var {object|null} baseline of EDITABLE_FIELDS taken from the last
 *      confirmed personagem — what applyAdmin() diffs the draft against to
 *      build the partial patch.
 */
AdminPanel.baseline = null;

/**
 * @var {object|null} draft of EDITABLE_FIELDS being edited in the window.
 *      Only sent to the server (as a diff against baseline) when the player
 *      clicks "Aplicar".
 */
AdminPanel.draft = null;

/**
 * @var {string[]} problems returned by a rejected "aplicar" (contract's
 *      non-empty "problemas" — transactional refusal, nothing changed
 *      server-side). Same semantics as IdleConfig.problemas (IdleConfig.js:
 *      94-98).
 */
AdminPanel.problemas = [];

/**
 * @var {boolean} true when draft differs from baseline (drives the
 *      "Aplicar" button's disabled state).
 */
AdminPanel.dirty = false;

/**
 * @var {number|null} setTimeout handle for the "no answer within 3s" check
 *      on a "pedir" request.
 */
AdminPanel._pedirTimer = null;

/**
 * @var {Preferences} window position (x/y are null until the player moves it)
 */
const _preferences = Preferences.get(
	'AdminPanel',
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
	return AdminPanel._shadow || AdminPanel._host;
}

/**
 * Escape user/server supplied text before injecting into innerHTML. Mirrors
 * IdleConfig's private helper (IdleConfig.js:125-140) — not exported there,
 * so re-declared here rather than imported (task instructions: don't alter
 * IdleConfig.js).
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
 * Only the owner's account (Session.AID, populated at login/char-select —
 * see Engine/LoginEngine.js:386 and Engine/CharEngine.js:98) ever gets this
 * window shown. The server independently enforces the same restriction on
 * every packet — this is purely a client-side "don't even show the button"
 * check, not the real access control.
 */
function isOwnerAccount() {
	return Session.AID === OWNER_AID;
}

/**
 * Pick out just the editable fields from a "personagem" object (contract's
 * shape — nome/nivelDeJob/hp/etc — into the flat draft/baseline shape this
 * window edits).
 */
function pickFields(personagem) {
	const out = {};
	EDITABLE_FIELDS.forEach(key => {
		out[key] = personagem[key];
	});
	return out;
}

/**
 * One-time setup (runs once, during GUIComponent#prepare(), GUIComponent.js
 * :140-151/:182-198 — init() is called at the end of _prepare()).
 */
AdminPanel.init = function init() {
	const root = _root();

	root.querySelector('.ap-button').addEventListener('click', onClickButton);
	root.querySelector('.ap-close').addEventListener('click', onClickClose);
	root.querySelector('.ap-apply').addEventListener('click', onClickApply);

	// GUIComponent#draggable() (GUIComponent.js:516-747) moves ":host" via
	// left/top, using the titlebar as the drag handle — same call shape as
	// IdleConfig.js:180.
	this.draggable(root.querySelector('.ap-titlebar'));

	// Default centered position, may be overridden by saved preferences in
	// onAppend() below (same approach as IdleConfig.js:182-190).
	this._host.style.top = Math.max(0, (Renderer.height - WINDOW_HEIGHT) / 2) + 'px';
	this._host.style.left = Math.max(0, (Renderer.width - WINDOW_WIDTH) / 2) + 'px';

	renderBody();
	renderProblemas();
	updateFooter();
};

/**
 * Restore saved window position once appended to the DOM (same as
 * IdleConfig.js:197-202), then hide the whole component (button + window)
 * for every account except the owner's — same "hide the whole host" pattern
 * as UI/Components/CartItems/CartItems.js:148-151
 * (`if (Session.Entity.hasCart === false) { this._host.style.display =
 * 'none'; }`), just keyed on Session.AID instead of Session.Entity.hasCart.
 */
AdminPanel.onAppend = function onAppend() {
	if (_preferences.x != null && _preferences.y != null) {
		this._host.style.top = Math.min(Math.max(0, _preferences.y), Renderer.height - WINDOW_HEIGHT) + 'px';
		this._host.style.left = Math.min(Math.max(0, _preferences.x), Renderer.width - WINDOW_WIDTH) + 'px';
	}

	if (!isOwnerAccount()) {
		this._host.style.display = 'none';
	}
};

/**
 * Save window position when the component is removed (defensive — in
 * practice this floating icon stays appended for the whole map session,
 * same as IdleConfig.js:209-211).
 */
AdminPanel.onRemove = function onRemove() {
	savePosition();
	clearPedirTimeout();
};

function savePosition() {
	_preferences.x = parseInt(AdminPanel._host.style.left, 10) || 0;
	_preferences.y = parseInt(AdminPanel._host.style.top, 10) || 0;
	_preferences.save();
}

/**
 * Show/hide the window (button stays visible either way). Same shape as
 * IdleConfig.toggle() (IdleConfig.js:223-233).
 */
AdminPanel.toggle = function toggle() {
	const root = _root();
	const win = root.querySelector('.ap-window');
	if (win.classList.contains('is-open')) {
		closeWindow();
	} else {
		win.classList.add('is-open');
		AdminPanel.focus();
		requestAdmin();
	}
};

function closeWindow() {
	const root = _root();
	root.querySelector('.ap-window').classList.remove('is-open');
	savePosition();
	clearPedirTimeout();
}

function onClickButton(e) {
	e.stopImmediatePropagation();
	AdminPanel.toggle();
}

function onClickClose(e) {
	e.stopImmediatePropagation();
	closeWindow();
}

function onClickApply(e) {
	e.stopImmediatePropagation();
	applyAdmin();
}

function clearPedirTimeout() {
	if (AdminPanel._pedirTimer != null) {
		clearTimeout(AdminPanel._pedirTimer);
		AdminPanel._pedirTimer = null;
	}
}

/**
 * Ask the server for the current admin data.
 * CZ_RAGIDLE_PEDIR_ADMIN — opcode 0x0ff6, fixed 2 bytes (opcode only), same
 * shape as IdleConfig's requestConfig() (IdleConfig.js:268-271).
 *
 * The server only answers this for the owner's account (see file header);
 * everyone else who somehow reaches this code path (button is hidden for
 * them, see onAppend above) gets silence. Either way, arm a 3s timer so a
 * missing answer surfaces as "Sem permissão de admin." instead of the
 * window spinning forever (spec: "ao pedir sem resposta em 3 s").
 */
function requestAdmin() {
	setStatus(AdminPanel.serverData ? 'Atualizando...' : 'Carregando...');
	clearPedirTimeout();
	AdminPanel._pedirTimer = setTimeout(() => {
		AdminPanel._pedirTimer = null;
		setStatus('Sem permissão de admin.');
	}, PEDIR_TIMEOUT_MS);

	Network.sendPacket(new PACKET.CZ.RAGIDLE_PEDIR_ADMIN());
}

/**
 * Send the edited draft to the server for transactional validation — but
 * only the fields that actually changed vs. baseline (spec: "monta o objeto
 * parcial APENAS com os campos que o usuário alterou").
 * CZ_RAGIDLE_APLICAR_ADMIN — opcode 0x0ff8, variable, JSON UTF-8 payload.
 * See Network/PacketStructure.js "RAGIDLE:" section for how the packet's
 * byte length is computed (same build as CZ_RAGIDLE_APLICAR_CONFIG).
 */
function applyAdmin() {
	if (!AdminPanel.draft || !AdminPanel.baseline) {
		return;
	}

	const patch = { v: 1 };
	EDITABLE_FIELDS.forEach(key => {
		if (AdminPanel.draft[key] !== AdminPanel.baseline[key]) {
			patch[key] = AdminPanel.draft[key];
		}
	});

	setStatus('Aplicando...');
	AdminPanel.problemas = [];
	renderProblemas();

	const pkt = new PACKET.CZ.RAGIDLE_APLICAR_ADMIN();
	pkt.json = JSON.stringify(patch);
	Network.sendPacket(pkt);
}

function setStatus(text) {
	const root = _root();
	const el = root.querySelector('.ap-status');
	if (el) {
		el.textContent = text || '';
	}
}

/**
 * ZC_RAGIDLE_ADMIN — opcode 0x0ff7, variable size, JSON UTF-8 payload (see
 * PACKET.ZC.RAGIDLE_ADMIN in Network/PacketStructure.js, which decodes the
 * remainder of the packet into pkt.json — same framing as
 * PACKET.ZC.RAGIDLE_CONFIG, IdleConfig.js:300-311).
 *
 * This single opcode answers both CZ_RAGIDLE_PEDIR_ADMIN and
 * CZ_RAGIDLE_APLICAR_ADMIN. The contract tells them apart with "aplicado":
 * present (true) only on an apply response, absent on a pedir response
 * (same convention as ZC_RAGIDLE_CONFIG, IdleConfig.js:326).
 */
function onAdminReceived(pkt) {
	clearPedirTimeout();

	let data;
	try {
		data = JSON.parse(pkt.json);
	} catch (e) {
		console.error('[AdminPanel] Falha ao interpretar os dados de admin recebidos:', e, pkt.json);
		setStatus('Dados incompatíveis.');
		return;
	}

	if (!data || data.v !== 1 || !data.personagem || !data.classes || !data.limites) {
		console.error('[AdminPanel] Dados de admin com contrato incompatível (v=' + (data && data.v) + ').', data);
		setStatus('Dados incompatíveis.');
		return;
	}

	const isApplyResponse = Object.prototype.hasOwnProperty.call(data, 'aplicado');
	const rejected = isApplyResponse && Array.isArray(data.problemas) && data.problemas.length > 0;

	AdminPanel.problemas = rejected ? data.problemas : [];

	if (!rejected) {
		// Either the initial "pedir" answer, or a successful "aplicar":
		// adopt the server's personagem/classes/limites as the new baseline
		// AND the new draft (same lifecycle as IdleConfig.onConfigReceived,
		// IdleConfig.js:332-338).
		AdminPanel.serverData = data;
		AdminPanel.baseline = pickFields(data.personagem);
		AdminPanel.draft = pickFields(data.personagem);
		AdminPanel.dirty = false;
		setStatus(isApplyResponse ? 'Aplicado.' : '');
	} else {
		// Transactional refusal (contract: non-empty "problemas" = nothing
		// changed server-side). Deliberately do NOT touch
		// serverData/baseline/draft — the player's edits stay on screen so
		// they can see what they tried and fix it; AdminPanel.dirty is left
		// as-is so "Aplicar" stays enabled for a retry (same reasoning as
		// IdleConfig.onConfigReceived, IdleConfig.js:339-346).
		setStatus('');
	}

	renderBody();
	renderProblemas();
	updateFooter();
}

/**
 * Enable/disable the "Aplicar" footer button based on AdminPanel.dirty.
 */
function updateFooter() {
	const root = _root();
	const btn = root.querySelector('.ap-apply');
	btn.disabled = !(AdminPanel.draft && AdminPanel.dirty);
}

/**
 * Recompute AdminPanel.dirty by comparing the draft to the last confirmed
 * baseline, then refresh the footer button. Same shape as IdleConfig's
 * markDirty() (IdleConfig.js:378-381), just field-by-field instead of a
 * whole-object JSON.stringify compare (EDITABLE_FIELDS is flat, so this is
 * simpler and avoids false positives from key ordering).
 */
function markDirty() {
	AdminPanel.dirty = EDITABLE_FIELDS.some(key => AdminPanel.draft[key] !== AdminPanel.baseline[key]);
	updateFooter();
}

/**
 * Render the "problemas" list under the footer (red bullet list) — only
 * populated after a rejected "aplicar" (see onAdminReceived above). Same
 * shape as IdleConfig.renderProblemas() (IdleConfig.js:387-396).
 */
function renderProblemas() {
	const root = _root();
	const el = root.querySelector('.ap-problemas');
	if (!AdminPanel.problemas || !AdminPanel.problemas.length) {
		el.innerHTML = '';
		return;
	}
	el.innerHTML =
		'<ul class="ap-problemas-list">' + AdminPanel.problemas.map(p => `<li>${escapeHtml(p)}</li>`).join('') + '</ul>';
}

/**
 * Render the whole (single-column) body, then wire up its controls. Unlike
 * IdleConfig there is only one "tab" worth of content, so this plays the
 * role of both IdleConfig.renderBody() and its per-tab render* functions
 * combined (IdleConfig.js:401-436).
 */
function renderBody() {
	const root = _root();
	const bodyEl = root.querySelector('.ap-body');

	if (!AdminPanel.draft || !AdminPanel.serverData) {
		bodyEl.innerHTML = '<div class="ap-empty">Abra o painel de admin para carregar.</div>';
		return;
	}

	const draft = AdminPanel.draft;
	const classes = AdminPanel.serverData.classes || [];
	const limites = AdminPanel.serverData.limites || {};
	const nomePersonagem = AdminPanel.serverData.personagem.nome;

	const nivelRange = limites.nivel || [1, 99];
	const nivelDeJobRange = limites.nivelDeJob || [1, 70];
	const pontosRange = limites.pontos || [0, 999];

	const classOptions = classes
		.map(c => `<option value="${c.id}" ${c.id === draft.classe ? 'selected' : ''}>${escapeHtml(c.nome)}</option>`)
		.join('');

	bodyEl.innerHTML = `
		<div class="ap-section">
			<h3>Personagem</h3>
			<div class="ap-field-row">
				<label>Nome</label>
				<input type="text" class="ap-input ap-readonly" value="${escapeHtml(nomePersonagem)}" readonly />
			</div>
			<div class="ap-field-row">
				<label>Classe</label>
				<select class="ap-select" data-field="classe">${classOptions}</select>
			</div>
			<div class="ap-field-row">
				<label>Zeny</label>
				<input type="number" class="ap-input" data-field="zeny" min="0" value="${draft.zeny}" />
			</div>
		</div>
		<div class="ap-section">
			<h3>Níveis</h3>
			<div class="ap-field-row">
				<label>Nível base</label>
				<input type="number" class="ap-input" data-field="nivel" min="${nivelRange[0]}" max="${nivelRange[1]}" value="${draft.nivel}" />
				<span class="ap-hint">${nivelRange[0]}–${nivelRange[1]}</span>
			</div>
			<div class="ap-field-row">
				<label>Nível de classe</label>
				<input type="number" class="ap-input" data-field="nivelDeJob" min="${nivelDeJobRange[0]}" max="${nivelDeJobRange[1]}" value="${draft.nivelDeJob}" />
				<span class="ap-hint">${nivelDeJobRange[0]}–${nivelDeJobRange[1]}</span>
			</div>
		</div>
		<div class="ap-section">
			<h3>Pontos</h3>
			<div class="ap-field-row">
				<label>Pontos de atributo</label>
				<input type="number" class="ap-input" data-field="pontosDeAtributo" min="${pontosRange[0]}" max="${pontosRange[1]}" value="${draft.pontosDeAtributo}" />
				<span class="ap-hint">${pontosRange[0]}–${pontosRange[1]}</span>
			</div>
			<div class="ap-field-row">
				<label>Pontos de skill</label>
				<input type="number" class="ap-input" data-field="pontosDeSkill" min="${pontosRange[0]}" max="${pontosRange[1]}" value="${draft.pontosDeSkill}" />
				<span class="ap-hint">${pontosRange[0]}–${pontosRange[1]}</span>
			</div>
		</div>`;

	bindFieldControls(bodyEl);
}

/**
 * Wires every `data-field` control (the <select> for classe, the <input
 * type=number> for the rest). Deliberately does NOT re-render on change —
 * unlike IdleConfig's data-bool/data-range handlers (IdleConfig.js:452-483)
 * which re-render to reflect cross-field effects, nothing here affects any
 * other field's presentation, and re-rendering a number input on every
 * keystroke would fight the caret position/focus.
 */
function bindFieldControls(bodyEl) {
	bodyEl.querySelectorAll('[data-field]').forEach(el => {
		const key = el.dataset.field;
		const eventName = el.tagName === 'SELECT' ? 'change' : 'input';
		el.addEventListener(eventName, () => {
			AdminPanel.draft[key] = Number(el.value);
			markDirty();
		});
	});
}

Network.hookPacket(PACKET.ZC.RAGIDLE_ADMIN, onAdminReceived);

/**
 * Create component and export it
 */
export default UIManager.addComponent(AdminPanel);
