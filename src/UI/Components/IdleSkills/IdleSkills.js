/**
 * UI/Components/IdleSkills/IdleSkills.js
 *
 * "Skills de {classe}" — custom RAGIDLE window. Replicates the layout of
 * the reference "Skills de Aprendiz" print from Midgard Idle: a 2-column
 * window (left = skill card list, right = detail panel of the selected
 * skill, with a "mecânica por nível" breakdown, progress pips and a
 * "learn next level" action), plus a footer bar with the count of
 * learnable skills and the player's available skill points.
 *
 * Protocol (custom extension, not part of stock rAthena/roBrowser):
 *   CZ_RAGIDLE_PEDIR_SKILLS  0x0ff9  (client -> server, fixed, opcode only)
 *   ZC_RAGIDLE_SKILLS        0x0ffa  (server -> client, variable, JSON;
 *                                      answers BOTH pedir and aprender)
 *   CZ_RAGIDLE_APRENDER      0x0ffb  (client -> server, variable, JSON —
 *                                      { skillId } of the skill to learn
 *                                      one more level of)
 * Declared in Network/PacketStructure.js (search "RAGIDLE:") and registered
 * for receive-side framing in Network/PacketRegister.js and
 * Network/Packets/packets2021_len_main.js (see comments there). Opcodes
 * 0x0ff9-0x0ffb sit right after AdminPanel's 0x0ff6-0x0ff8 in the same free
 * range of this fork's packet tables.
 *
 * Unlike IdleConfig/AdminPanel (which diff a local "draft" against a
 * "baseline" and only send the diff on an explicit "Aplicar"), this window
 * has no draft/dirty state at all: "aprender" is a single explicit action
 * (learn one more level of ONE skill) sent immediately on click, and per
 * the frozen contract the server's answer — to EITHER opcode — is always
 * the complete, current state (contrast with IdleConfig/AdminPanel, where a
 * rejected "aplicar" deliberately does NOT touch the local baseline/draft;
 * here there is no draft to protect, so the received state is adopted
 * unconditionally and "problemas" is purely a transient red message).
 *
 * Pattern followed here is IdleConfig (UI/Components/IdleConfig/IdleConfig.js,
 * read in full before writing this file) and AdminPanel
 * (UI/Components/AdminPanel/AdminPanel.js, also read in full): GUIComponent
 * base class, ES modules, shadow DOM, CSS/HTML via `?raw`, a floating
 * button that toggles the window, `Network.hookPacket(...)` self-registered
 * at module top-level, mounted in Engine/MapEngine.js next to
 * HuntMap/IdleConfig/AdminPanel (import + prepare() + append()).
 * IdleConfig.js's variable-length CZ build (u16 opcode + u16 length in
 * UTF-8 BYTES + JSON) is copied verbatim in PacketStructure.js for
 * CZ_RAGIDLE_APRENDER. Both files are cited by file:line throughout below
 * wherever a mechanism is reused.
 *
 * @author RagIdle
 */

import Renderer from 'Renderer/Renderer.js';
import Preferences from 'Core/Preferences.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import htmlText from './IdleSkills.html?raw';
import cssText from './IdleSkills.css?raw';

/**
 * Keep in sync with the ":host" / ".is-window" size in IdleSkills.css —
 * used to clamp the saved window position to the current viewport (same
 * role as IdleConfig's WINDOW_WIDTH/HEIGHT, IdleConfig.js:46-47).
 */
const WINDOW_WIDTH = 640;
const WINDOW_HEIGHT = 560;

/**
 * How long a rejected "aprender" (contract's non-empty "problemas") stays
 * visible in red on the footer bar before clearing (spec: "mostra em
 * vermelho na barra inferior por 5 s").
 */
const PROBLEMAS_TIMEOUT_MS = 5000;

/**
 * Create Component
 */
const IdleSkills = new GUIComponent('IdleSkills', cssText);

IdleSkills.render = () => htmlText;

/**
 * Floating icon must not block scene clicks/hover — same reasoning and same
 * choice as HuntMap (HuntMap.js:81-89), IdleConfig (IdleConfig.js:56-61) and
 * AdminPanel (AdminPanel.js:88-92).
 */
IdleSkills.mouseMode = GUIComponent.MouseMode.CROSS;

/**
 * @var {object|null} last full contract payload confirmed by the server
 *      ({ v, aplicado?, problemas: [], classe, pontos, skills: [...] }).
 *      Always replaced wholesale by every non-malformed answer (see
 *      onSkillsReceived below) — there is no draft/baseline split here,
 *      unlike IdleConfig.serverConfig/editConfig (IdleConfig.js:64-74).
 */
IdleSkills.serverData = null;

/**
 * @var {string|null} skillId of the card selected in the left list (drives
 *      the right-hand detail panel).
 */
IdleSkills.selectedSkillId = null;

/**
 * @var {string} category rail filter (rodada 2 do gauntlet, 18/08/2026):
 *      'todas' | 'ativa' | 'passiva' | 'suporte'. Pure client-side view
 *      filter over the already-loaded IdleSkills.serverData.skills — no
 *      packet, no server round-trip. 'ativa'/'passiva' match skill.categoria
 *      (the same field that already feeds the list/detail badge); 'suporte'
 *      has no matching categoria in today's data contract (only 'ativa' |
 *      'passiva' exist, see combat/skills.ts PorteDeHabilidade), so it
 *      renders the tab for visual parity with the reference but is
 *      honestly empty until the contract grows a third category.
 */
IdleSkills.categoriaFiltro = 'todas';

/**
 * @var {string[]} problems from the last rejected "aprender" (contract's
 *      non-empty "problemas"). Purely transient here (cleared automatically
 *      after PROBLEMAS_TIMEOUT_MS, see showProblemas below) since — unlike
 *      IdleConfig.problemas/AdminPanel.problemas — nothing about the local
 *      state is being protected from a server round-trip that already
 *      landed and was fully adopted.
 */
IdleSkills.problemas = [];

/**
 * @var {number|null} setTimeout handle clearing IdleSkills.problemas.
 */
IdleSkills._problemasTimer = null;

/**
 * @var {Preferences} window position (x/y are null until the player moves it)
 */
const _preferences = Preferences.get(
	'IdleSkills',
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
	return IdleSkills._shadow || IdleSkills._host;
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
 * Two-letter placeholder icon from a skillId (e.g. "NV_BASIC" -> "NB",
 * "MG_FIREBOLT" -> "MF"). Falls back to the first 2 characters of the raw
 * id when there is no "_" to split on.
 */
function skillInitials(skillId) {
	const parts = String(skillId || '').split('_');
	if (parts.length >= 2 && parts[0] && parts[1]) {
		return (parts[0][0] + parts[1][0]).toUpperCase();
	}
	return String(skillId || '').slice(0, 2).toUpperCase();
}

/**
 * "N skill(s) disponível(is)" (spec) rendered as proper PT-BR singular/
 * plural instead of literally printing the "(s)"/"(is)" placeholders.
 */
function pluralizeDisponiveis(n) {
	return n === 1 ? '1 skill disponível' : n + ' skills disponíveis';
}

/**
 * Build the "SP {sp} · alcance {alcance} · conjuração {s} · recarga {s} ·
 * dano +{razaoAdicional}%" fallback line for a level that has no matching
 * "[Nv X]:" description text, omitting any zeroed/absent field (spec).
 */
function buildMecanicaLine(m) {
	const parts = [];
	if (m.sp) {
		parts.push('SP ' + m.sp);
	}
	if (m.alcance) {
		parts.push('alcance ' + m.alcance);
	}
	if (m.conjuracaoMs) {
		parts.push('conjuração ' + m.conjuracaoMs / 1000 + 's');
	}
	if (m.recargaMs) {
		parts.push('recarga ' + m.recargaMs / 1000 + 's');
	}
	if (m.razaoAdicional) {
		parts.push('dano +' + m.razaoAdicional + '%');
	}
	return parts.join(' · ');
}

/**
 * Build the "Mecânica por nível" rows for a skill: one row per level from 1
 * to nivelMaximo. A level's text comes from the "[Nv X]: ..." lines in
 * `descricao` when present (multiple matching lines for the same level are
 * joined with a space); otherwise it falls back to the numeric line built
 * from `mecanica` (buildMecanicaLine above); otherwise an em-dash.
 *
 * Returns null when BOTH `descricao` and `mecanica` are empty — the caller
 * then renders the single "Sem dados nesta build." fallback message
 * (spec), instead of nivelMaximo empty/dash rows.
 */
function buildMecanicaRows(skill) {
	const descricao = skill.descricao || [];
	const mecanica = skill.mecanica || [];

	if (!descricao.length && !mecanica.length) {
		return null;
	}

	const textByLevel = {};
	descricao.forEach(line => {
		const match = /^\[Nv\s*(\d+)\]:\s*(.*)$/i.exec(String(line || '').trim());
		if (match) {
			const lvl = Number(match[1]);
			textByLevel[lvl] = textByLevel[lvl] ? textByLevel[lvl] + ' ' + match[2] : match[2];
		}
	});

	const mecByLevel = {};
	mecanica.forEach(m => {
		if (m && typeof m.nivel === 'number') {
			mecByLevel[m.nivel] = m;
		}
	});

	const rows = [];
	const max = skill.nivelMaximo || 0;
	for (let lvl = 1; lvl <= max; lvl++) {
		let texto = textByLevel[lvl];
		if (!texto) {
			const m = mecByLevel[lvl];
			texto = m ? buildMecanicaLine(m) : '';
		}
		rows.push({ nivel: lvl, texto: texto || '—' });
	}
	return rows;
}

/**
 * First line of `descricao`, used as the summary paragraph, but only when
 * it is NOT itself a "[Nv X]:" per-level line (spec: "Primeira linha da
 * descricao (se começar sem "[Nv") como texto de resumo").
 */
function buildResumo(skill) {
	const descricao = skill.descricao || [];
	if (!descricao.length) {
		return null;
	}
	const first = String(descricao[0] || '').trim();
	if (/^\[Nv/i.test(first)) {
		return null;
	}
	return first;
}

/**
 * One-time setup (runs once, during GUIComponent#prepare(), GUIComponent.js
 * :140-151/:182-198 — init() is called at the end of _prepare()).
 */
IdleSkills.init = function init() {
	const root = _root();

	root.querySelector('.is-button').addEventListener('click', onClickButton);
	root.querySelector('.is-close').addEventListener('click', onClickClose);
	root.querySelectorAll('.is-cat-tab').forEach(btn => btn.addEventListener('click', onClickCategoria));

	// GUIComponent#draggable() (GUIComponent.js:516-747) moves ":host" via
	// left/top, using the titlebar as the drag handle — same call shape as
	// IdleConfig.js:180.
	this.draggable(root.querySelector('.is-titlebar'));

	// Default centered position, may be overridden by saved preferences in
	// onAppend() below (same approach as IdleConfig.js:182-190).
	this._host.style.top = Math.max(0, (Renderer.height - WINDOW_HEIGHT) / 2) + 'px';
	this._host.style.left = Math.max(0, (Renderer.width - WINDOW_WIDTH) / 2) + 'px';

	renderAll();
};

/**
 * Restore saved window position once appended to the DOM (same as
 * IdleConfig.js:197-202).
 */
IdleSkills.onAppend = function onAppend() {
	if (_preferences.x != null && _preferences.y != null) {
		this._host.style.top = Math.min(Math.max(0, _preferences.y), Renderer.height - WINDOW_HEIGHT) + 'px';
		this._host.style.left = Math.min(Math.max(0, _preferences.x), Renderer.width - WINDOW_WIDTH) + 'px';
	}
};

/**
 * Save window position when the component is removed (defensive — in
 * practice this floating icon stays appended for the whole map session,
 * same as IdleConfig.js:209-211).
 */
IdleSkills.onRemove = function onRemove() {
	savePosition();
	clearProblemasTimeout();
};

function savePosition() {
	_preferences.x = parseInt(IdleSkills._host.style.left, 10) || 0;
	_preferences.y = parseInt(IdleSkills._host.style.top, 10) || 0;
	_preferences.save();
}

/**
 * Show/hide the window (button stays visible either way). Same shape as
 * IdleConfig.toggle() (IdleConfig.js:223-233).
 */
IdleSkills.toggle = function toggle() {
	const root = _root();
	const win = root.querySelector('.is-window');
	if (win.classList.contains('is-open')) {
		closeWindow();
	} else {
		win.classList.add('is-open');
		IdleSkills.focus();
		requestSkills();
	}
};

function closeWindow() {
	const root = _root();
	root.querySelector('.is-window').classList.remove('is-open');
	savePosition();
}

function onClickButton(e) {
	e.stopImmediatePropagation();
	IdleSkills.toggle();
}

function onClickClose(e) {
	e.stopImmediatePropagation();
	closeWindow();
}

function clearProblemasTimeout() {
	if (IdleSkills._problemasTimer != null) {
		clearTimeout(IdleSkills._problemasTimer);
		IdleSkills._problemasTimer = null;
	}
}

/**
 * Ask the server for the current skills state. Sent when the window opens.
 * CZ_RAGIDLE_PEDIR_SKILLS — opcode 0x0ff9, fixed 2 bytes (opcode only), same
 * shape as IdleConfig's requestConfig() (IdleConfig.js:268-271).
 */
function requestSkills() {
	setStatus(IdleSkills.serverData ? 'Atualizando...' : 'Carregando...');
	Network.sendPacket(new PACKET.CZ.RAGIDLE_PEDIR_SKILLS());
}

/**
 * Ask the server to learn one more level of `skillId`.
 * CZ_RAGIDLE_APRENDER — opcode 0x0ffb, variable, JSON UTF-8 payload
 * ({"skillId": "..."}). See Network/PacketStructure.js "RAGIDLE:" section
 * for how the packet's byte length is computed (same build as
 * CZ_RAGIDLE_APLICAR_CONFIG, IdleConfig.js:274-290).
 */
function sendAprender(skillId) {
	setStatus('Aprendendo...');

	const pkt = new PACKET.CZ.RAGIDLE_APRENDER();
	pkt.json = JSON.stringify({ skillId });
	Network.sendPacket(pkt);
}

function setStatus(text) {
	const root = _root();
	const el = root.querySelector('.is-status');
	if (el) {
		el.textContent = text || '';
	}
}

/**
 * Show `problemas` in red on the footer for PROBLEMAS_TIMEOUT_MS, then
 * clear it back out. Spec: "se problemas, mostra em vermelho na barra
 * inferior por 5 s" — unlike IdleConfig.renderProblemas()/
 * AdminPanel.renderProblemas() (which just render whatever is in
 * .problemas and let the NEXT server answer clear it), this window's
 * contract always answers with the full current state, so nothing else
 * would ever clear a stale message without this timer.
 */
function showProblemas(list) {
	clearProblemasTimeout();
	IdleSkills.problemas = list;
	renderFooter();
	IdleSkills._problemasTimer = setTimeout(() => {
		IdleSkills._problemasTimer = null;
		IdleSkills.problemas = [];
		renderFooter();
	}, PROBLEMAS_TIMEOUT_MS);
}

/**
 * ZC_RAGIDLE_SKILLS — opcode 0x0ffa, variable size, JSON UTF-8 payload (see
 * PACKET.ZC.RAGIDLE_SKILLS in Network/PacketStructure.js, which decodes the
 * remainder of the packet into pkt.json — same framing as
 * PACKET.ZC.RAGIDLE_CONFIG, IdleConfig.js:300-311).
 *
 * This single opcode answers both CZ_RAGIDLE_PEDIR_SKILLS and
 * CZ_RAGIDLE_APRENDER. The contract tells them apart with "aplicado":
 * present (true) only on an aprender response, absent on a pedir response
 * (same convention as ZC_RAGIDLE_CONFIG, IdleConfig.js:326) — but, unlike
 * that window, the server's answer is ALWAYS the complete state (per the
 * frozen contract), so it is always adopted here, whether or not
 * "problemas" came back non-empty.
 */
function onSkillsReceived(pkt) {
	let data;
	try {
		data = JSON.parse(pkt.json);
	} catch (e) {
		console.error('[IdleSkills] Falha ao interpretar os dados de skills recebidos:', e, pkt.json);
		setStatus('Dados incompatíveis.');
		return;
	}

	if (!data || data.v !== 1 || !data.classe || !Array.isArray(data.skills) || typeof data.pontos !== 'number') {
		console.error('[IdleSkills] Dados de skills com contrato incompatível (v=' + (data && data.v) + ').', data);
		setStatus('Dados incompatíveis.');
		return;
	}

	const isApplyResponse = Object.prototype.hasOwnProperty.call(data, 'aplicado');
	const problemas = Array.isArray(data.problemas) ? data.problemas : [];

	// Always adopt: the contract guarantees this payload IS the current
	// complete state, whether it answers a "pedir" or an "aprender" — see
	// file header for why this differs from IdleConfig/AdminPanel.
	IdleSkills.serverData = data;

	// Keep the current selection if it still exists in the new list;
	// otherwise fall back to the first skill (if any).
	if (!IdleSkills.selectedSkillId || !data.skills.some(s => s.skillId === IdleSkills.selectedSkillId)) {
		IdleSkills.selectedSkillId = data.skills.length ? data.skills[0].skillId : null;
	}

	setStatus(isApplyResponse ? '' : '');

	if (problemas.length) {
		showProblemas(problemas);
	} else {
		clearProblemasTimeout();
		IdleSkills.problemas = [];
	}

	renderAll();
}

/**
 * Render the whole window (title, list, detail, footer) from
 * IdleSkills.serverData/selectedSkillId/problemas.
 */
function renderAll() {
	renderTitle();
	renderList();
	renderDetail();
	renderFooter();
}

/**
 * Window title: "Skills de {classe.nomePt}" (spec), falling back to the
 * generic "Skills" placeholder from IdleSkills.html before the first
 * answer arrives.
 */
function renderTitle() {
	const root = _root();
	const el = root.querySelector('.is-title');
	if (!el) {
		return;
	}
	const data = IdleSkills.serverData;
	el.textContent = data && data.classe ? 'Skills de ' + (data.classe.nomePt || data.classe.nome) : 'Skills';
}

/**
 * Client-side-only filter over the already-loaded skill list (rodada 2, see
 * IdleSkills.categoriaFiltro above). Never touches serverData/network.
 */
function filtrarPorCategoria(skills) {
	const f = IdleSkills.categoriaFiltro;
	if (!f || f === 'todas') {
		return skills;
	}
	return skills.filter(s => s.categoria === f);
}

function onClickCategoria(e) {
	e.stopImmediatePropagation();
	const btn = e.currentTarget;
	IdleSkills.categoriaFiltro = btn.dataset.cat || 'todas';
	_root()
		.querySelectorAll('.is-cat-tab')
		.forEach(b => b.classList.toggle('is-active', b === btn));
	renderList();
}

/**
 * Left-hand card list.
 */
function renderList() {
	const root = _root();
	const listEl = root.querySelector('.is-list');
	const data = IdleSkills.serverData;

	if (!data || !data.skills.length) {
		listEl.innerHTML = '<div class="is-empty">Nenhuma skill disponível para esta classe.</div>';
		return;
	}

	const visiveis = filtrarPorCategoria(data.skills);
	if (!visiveis.length) {
		listEl.innerHTML = '<div class="is-empty">Nenhuma skill nesta categoria.</div>';
		return;
	}

	listEl.innerHTML = visiveis.map(renderCard).join('');
	listEl.querySelectorAll('[data-skill-card]').forEach(card => card.addEventListener('click', onClickCard));
}

function renderCard(skill) {
	const isSelected = skill.skillId === IdleSkills.selectedSkillId;
	const categoriaLabel = skill.categoria === 'passiva' ? 'Passiva' : 'Ativa';

	return `
		<button type="button" class="is-card ri-card${isSelected ? ' is-selected' : ''}" data-skill-card="${escapeHtml(skill.skillId)}">
			<span class="is-card-icon">
				<img src="/ragidle/skills/${encodeURIComponent(skill.skillId)}.png" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
				<span class="is-card-icon-fallback">${escapeHtml(skillInitials(skill.skillId))}</span>
			</span>
			<span class="is-card-info">
				<span class="is-card-name">${escapeHtml(skill.nome)}</span>
				<span class="is-card-meta">
					<span class="is-badge ri-badge ${skill.categoria === 'passiva' ? 'ri-badge--verde' : 'ri-badge--azul'}">${categoriaLabel}</span>
				</span>
			</span>
			<span class="is-card-level">Nv. ${skill.aprendido}/${skill.nivelMaximo}</span>
		</button>`;
}

function onClickCard(e) {
	e.stopImmediatePropagation();
	IdleSkills.selectedSkillId = e.currentTarget.dataset.skillCard;
	renderList();
	renderDetail();
}

/**
 * Right-hand detail panel for the selected skill.
 */
function renderDetail() {
	const root = _root();
	const detailEl = root.querySelector('.is-detail');
	const data = IdleSkills.serverData;

	if (!data) {
		detailEl.innerHTML = '<div class="is-empty">Abra a janela de skills para carregar.</div>';
		return;
	}

	const skill = data.skills.find(s => s.skillId === IdleSkills.selectedSkillId);
	if (!skill) {
		detailEl.innerHTML = '<div class="is-empty">Selecione uma skill.</div>';
		return;
	}

	const categoriaLabel = skill.categoria === 'passiva' ? 'Passiva' : 'Ativa';
	const resumo = buildResumo(skill);
	const mecanicaRows = buildMecanicaRows(skill);
	const mecanicaHtml = mecanicaRows
		? mecanicaRows
				.map(
					r => `
			<div class="is-mecanica-row">
				<span class="is-mecanica-nivel">Nv. ${r.nivel}</span>
				<span class="is-mecanica-texto">${escapeHtml(r.texto)}</span>
			</div>`
				)
				.join('')
		: '<div class="is-mecanica-empty">Sem dados nesta build.</div>';

	let pipsHtml = '';
	for (let i = 1; i <= skill.nivelMaximo; i++) {
		pipsHtml += `<span class="is-pip${i <= skill.aprendido ? ' is-pip-filled' : ''}"></span>`;
	}

	const atMax = skill.aprendido >= skill.nivelMaximo;
	const proximo = skill.aprendido + 1;
	const disabled = !skill.podeAprender || atMax;
	const title = skill.motivo ? escapeHtml(skill.motivo) : atMax ? 'Nível máximo alcançado' : '';
	// atMax: reference print shows a disabled "Dominada" button instead of
	// the normal "Aprender Nv. X" one (spec: "em vez do botão Aprender,
	// texto 'Nível máximo alcançado' + botão desabilitado 'Dominada'").
	const btnLabel = atMax ? 'Dominada' : `Aprender Nv. ${proximo}`;

	const footerHtml = atMax
		? '<div class="is-detail-max">Nível máximo alcançado</div>'
		: `
			<div class="is-detail-next">Próximo nível <strong>Nv. ${proximo}</strong></div>
			<div class="is-detail-custo">Custo: ${skill.custo} ponto de skill</div>`;

	detailEl.innerHTML = `
		<div class="is-detail-header">
			<span class="is-detail-icon">
				<img src="/ragidle/skills/${encodeURIComponent(skill.skillId)}.png" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
				<span class="is-detail-icon-fallback">${escapeHtml(skillInitials(skill.skillId))}</span>
			</span>
			<div class="is-detail-header-text">
				<div class="is-detail-title-row">
					<span class="is-detail-name">${escapeHtml(skill.nome)}</span>
					<span class="is-pill">Nv. ${skill.aprendido}/${skill.nivelMaximo}</span>
				</div>
				<div class="is-pips">${pipsHtml}</div>
				<div class="is-detail-badges">
					<span class="is-badge ri-badge ${skill.categoria === 'passiva' ? 'ri-badge--verde' : 'ri-badge--azul'}">${categoriaLabel}</span>
					${!skill.portada ? '<span class="is-badge ri-badge ri-badge--cinza" title="Skill pode ser aprendida, mas ainda não tem efeito em combate.">sem efeito em combate ainda</span>' : ''}
				</div>
			</div>
		</div>
		<div class="is-detail-maxline">Nível máximo : ${skill.nivelMaximo}</div>
		${resumo ? `<div class="is-detail-resumo">${escapeHtml(resumo)}</div>` : ''}
		<div class="ri-divisor"></div>
		<div class="is-detail-section">
			<h4>Mecânica por nível</h4>
			<div class="is-mecanica-box ri-card ri-scroll">${mecanicaHtml}</div>
		</div>
		<div class="is-detail-footer">
			${footerHtml}
			<button type="button" class="is-btn-aprender ri-btn" data-skill-aprender="${escapeHtml(skill.skillId)}" ${disabled ? 'disabled' : ''} title="${title}">${btnLabel}</button>
		</div>`;

	const btn = detailEl.querySelector('[data-skill-aprender]');
	if (btn) {
		btn.addEventListener('click', onClickAprender);
	}
}

function onClickAprender(e) {
	e.stopImmediatePropagation();
	const skillId = e.currentTarget.dataset.skillAprender;
	if (!skillId) {
		return;
	}
	sendAprender(skillId);
}

/**
 * Bottom bar: left = count of learnable skills, right = available skill
 * points pill, center = transient rejection message (see showProblemas).
 */
function renderFooter() {
	const root = _root();
	const leftEl = root.querySelector('.is-footer-left');
	const rightEl = root.querySelector('.is-footer-right');
	const problemasEl = root.querySelector('.is-problemas');

	const data = IdleSkills.serverData;
	if (!data) {
		leftEl.textContent = '';
		rightEl.innerHTML = '';
	} else {
		const disponiveis = data.skills.filter(s => s.podeAprender).length;
		leftEl.textContent = pluralizeDisponiveis(disponiveis);
		// "ri-badge--ouro" (Common.css, pivo do design system em 19/08/2026) e a
		// variante dourada pronta que faltava aqui -- ".is-pontos-pill" ficou so
		// com o delta de tamanho (ver IdleSkills.css).
		rightEl.innerHTML = `<span class="is-pontos-pill ri-badge ri-badge--ouro">Pontos disponíveis: ${data.pontos}</span>`;
	}

	problemasEl.textContent = IdleSkills.problemas && IdleSkills.problemas.length ? IdleSkills.problemas.join(' · ') : '';
}

Network.hookPacket(PACKET.ZC.RAGIDLE_SKILLS, onSkillsReceived);

/**
 * Create component and export it
 */
export default UIManager.addComponent(IdleSkills);
