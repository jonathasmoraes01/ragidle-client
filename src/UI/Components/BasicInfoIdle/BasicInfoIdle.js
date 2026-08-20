/**
 * UI/Components/BasicInfoIdle/BasicInfoIdle.js
 *
 * "Informações básicas" — light-theme HUD replicating the Midgard Idle
 * print: avatar + name/class, HP/SP bars, Base/Classe level + exp, peso/zeny
 * and a 2-row icon-button grid that opens the sibling RAGIDLE windows.
 *
 * Where the data comes from (read-only — never written here):
 *   - Session.Entity (Engine/SessionStorage.js:30) is the player entity the
 *     native BasicInfo window itself reads from. Confirmed by
 *     Engine/MapEngine.js:623-627 ("BasicInfo.getUI().update('blvl',
 *     Session.Entity.clevel)" etc.) and Engine/MapEngine/Main.js:254/298/
 *     316/325/704/722 (hp/sp updates on ZC_PAR_CHANGE/ZC_LONGPAR_CHANGE,
 *     always read from Session.Entity.life.hp/hp_max/sp/sp_max).
 *   - Session.Entity.display.name / .clevel / .joblevel / .job / .weight /
 *     .life.{hp,hp_max,sp,sp_max} are plain mutable fields kept live by the
 *     engine — see Renderer/Entity/EntityLife.js:210 (this.life = new Life())
 *     and Renderer/Entity/EntityDisplay.js:425 (this.display = new Display()).
 *   - Session.zeny (Engine/SessionStorage.js:41-50) is a getter/setter that
 *     proxies to Session.Entity.money.
 *   - BasicInfo.getUI().base_exp / base_exp_next / job_exp / job_exp_next /
 *     weight_max are instance fields on the *native* BasicInfo singleton
 *     (UI/Components/BasicInfo/BasicInfoCommon.js:70-75), fed by
 *     Engine/MapEngine/Main.js:231/238/392/399/414. There is no separate
 *     Session store for these — the native window's own instance IS the
 *     store, so we read it directly instead of duplicating it.
 *
 * Why polling instead of hooking packets ourselves: Network.hookPacket()
 * (Network/NetworkManager.js:200-210) does `Packets.list[packet.id].callback
 * = callback` — a plain property assignment, so a second hookPacket() call
 * on the same opcode (e.g. ZC_PAR_CHANGE/ZC_LONGPAR_CHANGE, already hooked
 * by Engine/MapEngine/Main.js) would silently REPLACE the native handler
 * instead of adding a second listener. Since Session.Entity/BasicInfo.getUI()
 * are already updated by that native handler on every relevant packet, this
 * component just re-reads that same live state on a 250ms timer — no packet
 * hook of our own, nothing stolen from the native window.
 *
 * Hides the NATIVE BasicInfo window: BasicInfo.getUI() returns the
 * currently active version (V0/V1/V3/V4/V5, chosen by
 * UI/Components/BasicInfo/BasicInfo.js's UIVersionManager). We locate its
 * `_host` (the actual DOM element GUIComponent#append() puts on screen,
 * UI/GUIComponent.js:95/230) and set display:none on it — done both in our
 * onAppend() (right after Engine/MapEngine.js appends the native window,
 * see MapEngine.js:729) and again on every poll tick, defensively, in case
 * PACKETVER-driven version switching (MapEngine.js:618-621) ever re-shows a
 * freshly prepared instance later in the session. The native BasicInfo.js
 * file itself is never modified.
 *
 * Icon grid retired (19/08/2026, task ask from the owner): this panel used
 * to also open the sibling RAGIDLE windows (Status/Equipamento/Inventario/
 * Skills/Caca/Config/Menu/Admin) through a row of icon buttons at the
 * bottom. That grid — and the admin-owner gating that guarded its Admin
 * button — moved to UI/Components/TopMenuIdle/TopMenuIdle.js, which is now
 * the ONLY place with clickable icons. This file no longer imports any of
 * those sibling windows; it only reads native player state to display it.
 *
 * @author RagIdle
 */

import Renderer from 'Renderer/Renderer.js';
import Preferences from 'Core/Preferences.js';
import Session from 'Engine/SessionStorage.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import MonsterTable from 'DB/Monsters/MonsterTable.js';
import BasicInfo from 'UI/Components/BasicInfo/BasicInfo.js';
import htmlText from './BasicInfoIdle.html?raw';
import cssText from './BasicInfoIdle.css?raw';

/**
 * Light polling interval for native state that has no packet hook slot free
 * (see file header). 250ms matches the task's own suggested cadence.
 */
const POLL_INTERVAL_MS = 250;

/**
 * PT-BR label for the handful of common jobs, keyed off MonsterTable's
 * (English) name — MonsterTable (DB/Monsters/MonsterTable.js) is the same
 * lookup the native BasicInfo uses for its "job" field (see
 * UI/Components/BasicInfo/BasicInfoCommon.js:477-480,
 * `MonsterTable[val1]`). Deliberately a small pragmatic subset (base +
 * common 2nd jobs, same spirit as HuntMap's RACE_PT/ELEMENT_PT dictionaries,
 * HuntMap.js:45-72) — anything not listed here just falls back to
 * MonsterTable's English name instead of failing.
 */
const JOB_PT = {
	Novice: 'Aprendiz',
	Swordman: 'Espadachim',
	Mage: 'Mago',
	Archer: 'Arqueiro',
	Acolyte: 'Acólito',
	Merchant: 'Mercador',
	Thief: 'Ladino',
	Knight: 'Cavaleiro',
	Priest: 'Sacerdote',
	Wizard: 'Bruxo',
	Blacksmith: 'Ferreiro',
	Hunter: 'Caçador',
	Assassin: 'Assassino',
	Crusader: 'Cruzado',
	Monk: 'Monge',
	Sage: 'Sábio',
	Rogue: 'Vigarista',
	Alchemist: 'Alquimista',
	Bard: 'Bardo',
	Dancer: 'Dançarina',
	'Super Novice': 'Super Aprendiz',
	Gunslinger: 'Atirador',
	Ninja: 'Ninja'
};

/**
 * Create Component
 */
const BasicInfoIdle = new GUIComponent('BasicInfoIdle', cssText);

/**
 * Sem marcador "<!--RI_ICONE:chave-->" neste .html desde 19/08/2026 (a
 * grade de icones foi retirada, ver cabecalho do arquivo) -- so devolve o
 * html puro, nenhuma troca de glifo precisa acontecer aqui mais.
 */
BasicInfoIdle.render = () => htmlText;

/**
 * @var {Preferences} window position — defaults to the top-left corner
 * ("fixa por padrão no canto superior esquerdo").
 */
const _preferences = Preferences.get(
	'BasicInfoIdle',
	{
		x: 12,
		y: 12,
		// D-343: modo compacto (recolhido) do painel -- mesma chave/objeto
		// da posicao, so um campo novo. Nao precisa de bump de versao:
		// Preferences.get() so copia as chaves que EXISTEM no localStorage
		// salvo por cima do default, entao quem ja tinha "x"/"y" salvos de
		// antes desta mudanca simplesmente cai no default "compact: false"
		// (ver Core/Preferences.js:38-59).
		compact: false
	},
	1.0
);

/**
 * @var {number|null} setInterval handle for the native-state polling loop.
 */
let _pollTimer = null;

/**
 * Helper: query inside shadow root
 */
function _root() {
	return BasicInfoIdle._shadow || BasicInfoIdle._host;
}

/**
 * One-time setup (runs once, during GUIComponent#prepare()).
 */
BasicInfoIdle.init = function init() {
	const root = _root();

	this.draggable(root.querySelector('.bi-header'));

	const minimizeBtn = root.querySelector('.bi-minimize');
	if (minimizeBtn) {
		minimizeBtn.addEventListener('click', onClickMinimize);
	}
};

/**
 * Restore saved position (measured with the real rendered size, same
 * technique as BasicInfoCommon.js:236-240, since — unlike HuntMap — this
 * window's height isn't a fixed constant), hide the native BasicInfo
 * window and start the polling loop.
 */
BasicInfoIdle.onAppend = function onAppend() {
	// Aplica o modo compacto salvo ANTES de medir o host -- a altura real
	// renderizada (usada logo abaixo pro clamp de posicao) precisa ja
	// refletir o tamanho compacto quando for o caso, senao a janela abre
	// clampada pro tamanho ERRADO (ver contrato ":host"/JS no cabecalho).
	applyCompactState();

	const hostRect = this._host.getBoundingClientRect();
	this._host.style.top = Math.min(Math.max(0, _preferences.y), Renderer.height - hostRect.height) + 'px';
	this._host.style.left = Math.min(Math.max(0, _preferences.x), Renderer.width - hostRect.width) + 'px';

	hideNativeBasicInfo();
	syncFromNativeState();
	startPolling();
};

/**
 * Save position and stop polling when removed (map exit — see
 * UIManager.removeComponents(), Engine/MapEngine.js:902).
 */
BasicInfoIdle.onRemove = function onRemove() {
	stopPolling();
	savePosition();
};

function savePosition() {
	_preferences.x = parseInt(BasicInfoIdle._host.style.left, 10) || 0;
	_preferences.y = parseInt(BasicInfoIdle._host.style.top, 10) || 0;
	_preferences.save();
}

/**
 * Clique no botao de minimizar (19/08/2026 -- antes era a barra "Recolher"
 * embaixo da janela, D-343; agora mora no cabecalho, estilo Windows): alterna
 * e SALVA a preferencia (mesmo objeto/chave da posicao, ver _preferences
 * acima), aplica na hora e re-clampa a posicao -- expandir de volta pode
 * fazer o painel crescer pra baixo do que cabe na tela se ele estava perto
 * da borda enquanto compacto.
 */
function onClickMinimize(e) {
	e.stopImmediatePropagation();
	_preferences.compact = !_preferences.compact;
	_preferences.save();
	applyCompactState();
	clampPositionToViewport();
}

/**
 * Reflete "_preferences.compact" no DOM: ".bi-body.is-compact" esconde tudo
 * que nao e HP/SP/XP/niveis (ver BasicInfoIdle.css). O glifo do botao de
 * minimizar fica o MESMO nos dois estados (traco horizontal, igual ao botao
 * real de minimizar do Windows -- ele nao muda de desenho quando a janela ja
 * esta minimizada); so titulo/aria-label mudam, pra continuar dizendo o que
 * o clique faz agora ("restaurar" quando ja esta compacto). Chamado no
 * onAppend() (restaura o que foi salvo, antes de medir o host) e a cada
 * clique.
 */
function applyCompactState() {
	const root = _root();
	const body = root.querySelector('.bi-body');
	const minimizeBtn = root.querySelector('.bi-minimize');
	if (!body || !minimizeBtn) {
		return;
	}

	const compact = !!_preferences.compact;
	body.classList.toggle('is-compact', compact);
	minimizeBtn.classList.toggle('is-compact', compact);
	minimizeBtn.setAttribute('aria-expanded', String(!compact));

	const title = compact ? 'Restaurar painel' : 'Recolher painel';
	minimizeBtn.title = title;
	minimizeBtn.setAttribute('aria-label', compact ? 'Restaurar painel para o modo completo' : 'Recolher painel para modo compacto');
}

/**
 * Re-mede o host DEPOIS de uma mudanca de tamanho em tempo real (alternar
 * compacto) e clampa top/left pra caixa continuar inteira dentro da tela --
 * mesma conta de onAppend(), so que a partir da posicao ATUAL (ja em tela)
 * em vez de "_preferences.x/y" (que so vale pro primeiro append).
 */
function clampPositionToViewport() {
	const host = BasicInfoIdle._host;
	const rect = host.getBoundingClientRect();
	const maxTop = Math.max(0, Renderer.height - rect.height);
	const maxLeft = Math.max(0, Renderer.width - rect.width);
	const curTop = parseInt(host.style.top, 10) || 0;
	const curLeft = parseInt(host.style.left, 10) || 0;
	host.style.top = Math.min(Math.max(0, curTop), maxTop) + 'px';
	host.style.left = Math.min(Math.max(0, curLeft), maxLeft) + 'px';
}

/**
 * Locate the native BasicInfo window's host element and hide it (see file
 * header for why: display:none, never touching BasicInfo's own files).
 */
function hideNativeBasicInfo() {
	const nativeUI = BasicInfo.getUI();
	if (nativeUI && nativeUI._host && nativeUI._host.style.display !== 'none') {
		nativeUI._host.style.display = 'none';
	}
}

function startPolling() {
	stopPolling();
	_pollTimer = setInterval(syncFromNativeState, POLL_INTERVAL_MS);
}

function stopPolling() {
	if (_pollTimer != null) {
		clearInterval(_pollTimer);
		_pollTimer = null;
	}
}

function setText(root, selector, text) {
	const el = root.querySelector(selector);
	if (el) {
		el.textContent = text;
	}
}

/**
 * Retrato de classe (scripts/retratos-de-classe.ts converteu icon_job_<jobid>.bmp
 * do cliente para /ragidle/classes/<jobid>.png -- servido por public/, o
 * mesmo jobId que Session.Entity.job ja carrega). So troca o `src` quando o
 * job muda (dataset.jobId), pra nao reiniciar a carga da imagem a cada tick
 * de 250ms do polling. `.bi-avatar-initial` continua no DOM por baixo como
 * fallback -- se o PNG do job nao existir (onerror), a inicial continua
 * visivel porque `.bi-avatar-img` so ganha `.is-loaded` (opacity:1) no
 * `onload`.
 */
function syncAvatarPortrait(root, jobId) {
	const img = root.querySelector('.bi-avatar-img');
	if (!img) {
		return;
	}
	const key = String(jobId);
	if (img.dataset.jobId === key) {
		return;
	}
	img.dataset.jobId = key;
	img.classList.remove('is-loaded');
	img.onload = () => img.classList.add('is-loaded');
	img.onerror = () => img.classList.remove('is-loaded');
	img.src = `/ragidle/classes/${jobId}.png`;
}

/**
 * "89,0%" — one decimal place, PT-BR comma (task spec).
 */
function formatPercent(value, max) {
	const pct = max > 0 ? (value / max) * 100 : 0;
	return pct.toFixed(1).replace('.', ',') + '%';
}

/**
 * "1.234.567" — PT-BR thousands separator for zeny.
 */
function formatZeny(value) {
	const digits = String(Math.max(0, Math.floor(value || 0)));
	let out = '';
	for (let i = 0; i < digits.length; i++) {
		if (i > 0 && (digits.length - i) % 3 === 0) {
			out += '.';
		}
		out += digits[i];
	}
	return out;
}

function updateLifeBar(root, type, val, max) {
	const bar = root.querySelector(`.bi-bar-${type}`);
	if (!bar) {
		return;
	}
	const perc = max > 0 ? Math.max(0, Math.min(100, (val / max) * 100)) : 0;
	const fill = bar.querySelector('.bi-bar-fill');
	const text = bar.querySelector('.bi-bar-text');
	const pct = bar.querySelector('.bi-bar-pct');
	if (fill) {
		fill.style.width = perc + '%';
	}
	if (text) {
		text.textContent = `${val} / ${max}`;
	}
	if (pct) {
		pct.textContent = formatPercent(val, max);
	}
}

function updateExpBar(root, selector, val, max) {
	const el = root.querySelector(selector);
	if (!el) {
		return;
	}
	const perc = max > 0 ? Math.max(0, Math.min(100, (val / max) * 100)) : 0;
	el.style.width = perc + '%';
}

/**
 * Re-read Session.Entity / BasicInfo.getUI() (see file header) and refresh
 * the DOM. Called once on append and then every POLL_INTERVAL_MS.
 */
function syncFromNativeState() {
	hideNativeBasicInfo();

	const entity = Session.Entity;
	if (!entity) {
		return;
	}

	const root = _root();
	const nativeUI = BasicInfo.getUI();
	const name = (entity.display && entity.display.name) || '';

	setText(root, '.bi-name', name || '—');

	const jobName = MonsterTable[entity.job];
	setText(root, '.bi-class', (jobName && JOB_PT[jobName]) || jobName || '—');

	const initialEl = root.querySelector('.bi-avatar-initial');
	if (initialEl) {
		initialEl.textContent = name ? name.trim().charAt(0).toUpperCase() : '?';
	}

	syncAvatarPortrait(root, entity.job);

	if (entity.life) {
		updateLifeBar(root, 'hp', entity.life.hp || 0, entity.life.hp_max || 0);
		updateLifeBar(root, 'sp', entity.life.sp || 0, entity.life.sp_max || 0);
	}

	setText(root, '.bi-blvl-value', entity.clevel || 0);
	setText(root, '.bi-jlvl-value', entity.joblevel || 0);
	updateExpBar(root, '.bi-bexp-fill', nativeUI.base_exp || 0, nativeUI.base_exp_next || 0);
	updateExpBar(root, '.bi-jexp-fill', nativeUI.job_exp || 0, nativeUI.job_exp_next || 0);

	// Native BasicInfoCommon.update('weight', ...) divides by 10 before
	// display (BasicInfoCommon.js:507-512) — mirrored here so the number
	// shown matches the native window's own convention exactly.
	const weight = Math.floor((entity.weight || 0) / 10);
	const weightMax = Math.floor((nativeUI.weight_max || 0) / 10);
	setText(root, '.bi-weight', `${weight} / ${weightMax}`);

	setText(root, '.bi-zeny', formatZeny(Session.zeny));
}

/**
 * Create component and export it
 */
export default UIManager.addComponent(BasicInfoIdle);
