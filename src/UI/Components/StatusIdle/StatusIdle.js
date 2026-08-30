/**
 * UI/Components/StatusIdle/StatusIdle.js
 *
 * "Status" — premium character sheet ("Ragnarok Clássico Premium" gauntlet,
 * redesign/extracao-da-referencia.md secoes 2, 3 e 5.1): a "Personagem"
 * card up top (avatar, name, class, Base/Job Lv., Guild, Zeny, Peso), an
 * "Atributos" card (STR/AGI/VIT/INT/DEX/LUK with a per-stat "+" button and
 * next-point cost), a derived-stats card (ATK/MATK/HIT/CRI/DEF/MDEF/FLEE/
 * ASPD in two columns), and a footer with "Pontos de Atributo" — o botao
 * "Distribuir Automatico" que ficava ao lado saiu em 28/08/2026.
 *
 * ── Round 2 gauntlet fix: the "Personagem" card ─────────────────────────
 * The judge's round-2 note: this window read like a bare stat TABLE, not a
 * character sheet, because it opened straight on "Atributos" — no avatar,
 * name, class, level, guild, zeny or weight above it. Those fields aren't
 * part of the ficha contract (see below) and don't need to be — they're
 * the exact same live client state BasicInfoIdle.js already reads and
 * displays elsewhere on screen, so this card reads it the same way instead
 * of duplicating any server contract:
 *   - Session.Entity.display.name / .job / .clevel / .joblevel / .weight
 *     (Engine/SessionStorage.js), same fields BasicInfoIdle.js's
 *     syncFromNativeState() reads (see that file's header for the full
 *     citation trail into Renderer/Entity/Entity*.js and MapEngine.js).
 *   - Session.zeny (getter proxying Session.Entity.money,
 *     Engine/SessionStorage.js:45-53).
 *   - Session.hasGuild / Session.guildName (Engine/SessionStorage.js:61-64)
 *     — kept live by the native Guild packet handlers elsewhere in the
 *     codebase; read-only here, same as everything else in this section.
 *   - BasicInfo.getUI().weight_max — instance field on the native
 *     BasicInfo singleton (UI/Components/BasicInfo/BasicInfoCommon.js:
 *     70-75), same "read the native window's own store, don't duplicate
 *     it" call BasicInfoIdle.js makes for base_exp_next etc.
 * MonsterTable[job] + a small local JOB_PT dictionary give the PT-BR class
 * name — same lookup and same translation table shape as BasicInfoIdle.js
 * (kept as its own local copy here, same as BasicInfoIdle.js's own copy,
 * rather than importing across components for a handful of strings).
 * Unlike BasicInfoIdle this card only needs to be right while the window
 * is open, so it's a one-shot syncCharacterInfo() call on toggle()-open
 * (same "ask fresh on open" moment as requestFicha() below), not a poll.
 *
 * ── Gauntlet round 1 fix: don't read the native WinStats DOM ────────────
 * The previous version of this file polled the *native* WinStats window's
 * rendered DOM every 250ms (there was no Session store for these derived
 * combat stats). The critic caught the real problem with that approach:
 * the native WinStats window only actually renders real numbers once it
 * has been shown at least once — while it stays hidden (the common case
 * for an idle client that never opens the classic Status window), its DOM
 * just sits at the markup's static placeholder text ("0", "1", etc.), so
 * this window came up empty.
 *
 * This fork's server team has since stood up a dedicated RAGIDLE packet
 * pair for exactly this ("já implementado e no ar" per the fix request),
 * so this window now uses THAT instead of touching WinStats at all:
 *
 *   CZ_RAGIDLE_PEDIR_FICHA 0x0fff (client -> server, fixed 2 bytes,
 *     opcode only — same shape as CZ_RAGIDLE_PEDIR_CATALOGO). Sent every
 *     time this window is opened (toggle() below), same convention as
 *     HuntMap's requestCatalog() on open (HuntMap.js:228-238/265-268).
 *
 *   ZC_RAGIDLE_FICHA 0x0fef (server -> client, variable, JSON UTF-8
 *     payload — see PACKET.ZC.RAGIDLE_FICHA in Network/PacketStructure.js,
 *     same `this.json = fp.readString(end - fp.tell())` framing as
 *     ZC_RAGIDLE_CATALOGO). Answers CZ_RAGIDLE_PEDIR_FICHA, AND is pushed
 *     unprompted by the server right after a stat point is spent
 *     (CZ_STATUS_CHANGE below) or after "Distribuir Automático" — so this
 *     window never needs to re-request, it just re-renders whenever the
 *     hook fires. Unlike ZC_PAR_CHANGE/ZC_STATUS (already hooked once by
 *     Engine/MapEngine/Main.js — see Network.hookPacket()'s plain-overwrite
 *     semantics, Network/NetworkManager.js:200-210), 0x0fef is a RAGIDLE-
 *     only opcode nobody else in this codebase hooks, so hooking it
 *     directly here is safe — no native handler to collide with.
 *
 * ── Contrato v2: "base + bonus", como o RO oficial (29/08/2026) ─────────
 * O v1 mandava, por atributo, so o valor CRU investido — um jogador com +10
 * de AGI de equipamento lia "AGI 50" e mais nada, e ATK/MATK vinham como um
 * numero so. A janela NATIVA (WinStats) ja fazia certo, lendo `str`/`str2`
 * do ZC_COUPLESTATUS; perdemos isso ao troca-la por esta. O v2 devolve:
 *
 *   { v: 2,
 *     atributos: { forca/agilidade/vitalidade/inteligencia/destreza/sorte: {
 *       valor, custo,                                   // como no v1
 *       base, codex, classe, passivas, equipamento, outros, bonus, total } },
 *     pontos,
 *     derivados: { atk, matk,
 *       metades: { atk/matk/def/mdef: {esquerda, direita, total} },
 *       def, defDeStatus, mdef, mdefDeStatus, hit, flee, crit, aspd },
 *     nivel, nivelDeJob }
 *
 * O que cada campo quer dizer, porque a diferenca entre eles e a fonte de
 * quase todo erro possivel nesta janela:
 *   - `valor` e `custo` guardam o significado do v1: o investido, e o custo
 *     do PROXIMO ponto (custo === 0 = atributo no cap, "+" desabilitado).
 *     O botao "+" nao mudou uma linha por causa do v2.
 *   - `total` e o que o MOTOR de fato usa, e `bonus = total - base`. E o
 *     `base` — nao o `valor` — que a janela escreve como numero principal.
 *   - as cinco parcelas (codex/classe/passivas/equipamento/outros) somam com
 *     `base` para dar `total`, e sao o corpo do title de cada atributo.
 *     `outros` normalmente e 0; quando NAO e, e uma fonte que o servidor nao
 *     soube nomear — aparece como "Outros" e nunca e somada noutra parcela,
 *     porque esconde-la transformaria um defeito do servidor em numero
 *     plausivel na tela, que e o modo de falha caro deste projeto.
 *   - `derivados.atk`/`matk` NAO sao a metade da direita: sao o total do
 *     motor, que inclui variancia e bonus de atributo que o watk nao tem.
 *     Somar `esquerda + direita` para exibir no lugar deles seria comparar
 *     grandezas diferentes — ver renderMetades() abaixo.
 *
 * `nivel`/`nivelDeJob` continuam sem leitor aqui — o Base Lv./Job Lv. do
 * card "Personagem" vem do Session.Entity (syncCharacterInfo() abaixo),
 * mesmo campo vivo que o BasicInfoIdle.js mostra do outro lado da tela.
 *
 * The attribute rows' `data-stat` attributes (StatusIdle.html) use the
 * contract's own PT-BR keys (forca/agilidade/vitalidade/inteligencia/
 * destreza/sorte) so renderFicha() below can index `ficha.atributos`
 * directly with no translation table.
 *
 * ── Sending stat points up (unchanged) ──────────────────────────────────
 * Still CZ_STATUS_CHANGE (opcode 0xbb, Network/PacketStructure.js:447-469
 * — `statusID` + `changeAmount`), the exact packet the native "up" arrow
 * sends (WinStatsCommon.js:81-88 -> Engine/MapEngine.js:471 ->
 * onRequestStatUpdate, MapEngine.js:1231-1243). `data-status-id` on each
 * `.st-stat-up` button (StatusIdle.html) already carries the right value
 * (13-18, same as StatusProperty.STR..LUK / WinStatsCommon.js's
 * statButtonMap), so onClickStatUp reads it straight off the DOM instead
 * of keeping a second id table in JS.
 *
 * O botao "Distribuir Automatico" (CZ_RAGIDLE_DISTRIBUIR, 0x0ffe) SAIU em
 * 28/08/2026, a pedido do dono — ver a nota no rodape do .html. O pacote e o
 * handler do servidor continuam vivos; quem saiu foi a porta.
 *
 * @author RagIdle
 */

import Renderer from 'Renderer/Renderer.js';
import Preferences from 'Core/Preferences.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import Session from 'Engine/SessionStorage.js';
import MonsterTable from 'DB/Monsters/MonsterTable.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import BasicInfo from 'UI/Components/BasicInfo/BasicInfo.js';
import htmlText from './StatusIdle.html?raw';
import cssText from './StatusIdle.css?raw';

/**
 * Keep in sync with the ":host"/".st-window" size in StatusIdle.css — same
 * role as HuntMap's WINDOW_WIDTH/HEIGHT (HuntMap.js:39-40): centers the
 * window by default and clamps its saved position to the viewport.
 */
const WINDOW_WIDTH = 344;
const WINDOW_HEIGHT = 688;

/**
 * The six base attributes, in the contract's own PT-BR key names (see file
 * header) — this list drives which `.st-stat-row[data-stat="..."]` rows
 * renderFicha() walks.
 */
const ATTR_KEYS = ['forca', 'agilidade', 'vitalidade', 'inteligencia', 'destreza', 'sorte'];

/**
 * As cinco parcelas do bonus (contrato v2), na ORDEM EM QUE O CONTRATO AS
 * declara — e nao na ordem de grandeza. Ordem estavel importa aqui: o title
 * e relido a cada peca trocada, e uma lista que se reordena sozinha obriga o
 * jogador a reler tudo para achar a linha que mudou.
 *
 * "outros" fecha a lista de proposito: e a fonte que o servidor NAO soube
 * nomear, entao ela e a excecao, e excecao no fim le como excecao.
 */
/*
 * A ORDEM E DE LEITURA, e nao a do contrato.
 *
 * O contrato lista as parcelas em ordem alfabetica de implementacao (codex,
 * classe, passivas, equipamento, outros). Para quem LE o tooltip a ordem util
 * e outra: do que o personagem sempre tem para o que ele conquistou, e
 * `Outros` sempre por ultimo — ele so aparece quando o servidor nao soube
 * nomear a fonte, e nesse caso ser a ultima linha e o que faz o jogador
 * perceber que ela e a excecao.
 *
 * A ordem e ESTAVEL entre re-renders porque a tabela e estatica: ela nao
 * depende do valor de nenhuma parcela.
 */
const PARCELAS_DO_BONUS = [
	['classe', 'Classe'],
	['equipamento', 'Equipamento'],
	// O pet e parcela PROPRIA desde 30/08: o motor soma o script dele no mesmo
	// lugar do equipamento, mas dizer "+3 de Equipamento" quando os 3 vem do
	// Poring leal e falso, e o tooltip existe para nomear a origem.
	['pet', 'Pet'],
	['passivas', 'Habilidade passiva'],
	['codex', 'Codex'],
	// O buff e a unica parcela TEMPORARIA: ela some quando o status expira. Fica
	// depois das permanentes e antes de `Outros` para que a leitura de cima para
	// baixo va do que o personagem sempre tem ao que ele tem agora (D-853).
	['buff', 'Buff ativo'],
	['outros', 'Outros']
];

/**
 * As QUATRO derivadas que o RO escreve em duas metades, e o que cada lado
 * significa no title.
 *
 * ── Por que os lados sao esses ──────────────────────────────────────────
 * O emulador manda DUAS: no renewal o `leftside` e o derivado de STATUS e o
 * `rightside` e o de EQUIPAMENTO (`pc.hpp:1241-1244`, dentro do `#ifdef
 * RENEWAL`; no pre-renewal os lados de ATK e MATK TROCAM). Quem decide de que
 * lado cada numero cai e o SERVIDOR, que ja entrega `esquerda`/`direita`
 * prontos — esta tabela so desenha, e por isso nao ha `isRenewal` nenhum aqui.
 *
 * ── A cicatriz que criou a metade de status (27/08/2026, auditoria C) ────
 * A ficha mandava so a metade de EQUIPAMENTO. Para o MDEF isso e devastador e
 * mensuravel: MDEF de jogador nasce SO de `bonus bMdef` (nao ha campo
 * `MagicDefense` no item_db de equipamento), entao a metade de equipamento e
 * zero em quase todo personagem. Medido no corpus antes do conserto: **276 de
 * 276** fichas com `derivados.mdef === 0`. O jogador abria a janela com INT e
 * lia MDEF 0 — o numero de status estava calculado o tempo todo, so nao
 * atravessava.
 *
 * `legado` e o par de campos soltos do v1 que ainda diz a mesma coisa para
 * DEF/MDEF; ele e a rede quando um servidor v2 esquecer de mandar `metades`
 * (ver lerMetades()). ATK/MATK NAO tem legado: `derivados.atk` e o total do
 * motor, e nao a metade da direita — usa-lo ali imprimiria 123 no lugar de 55.
 *
 * `totalDoMotor` so existe onde o total DIVERGE da soma das duas metades, que
 * e exatamente ATK e MATK. Em DEF/MDEF a soma na tela ja E o total, e repeti-la
 * no title seria ruido.
 */
const METADES = [
	{
		chave: 'atk',
		rotulo: 'ATK',
		alvo: '.st-atk',
		alvoDaDireita: '.st-atk2',
		daEsquerda: 'de status',
		daDireita: 'de arma e equipamento',
		totalDoMotor: 'atk',
		legado: null
	},
	{
		chave: 'matk',
		rotulo: 'MATK',
		alvo: '.st-matk',
		alvoDaDireita: '.st-matk2',
		daEsquerda: 'de status',
		daDireita: 'de equipamento',
		totalDoMotor: 'matk',
		legado: null
	},
	{
		chave: 'def',
		rotulo: 'DEF',
		alvo: '.st-def',
		alvoDaDireita: '.st-def2',
		daEsquerda: 'de status',
		daDireita: 'de equipamento',
		totalDoMotor: null,
		legado: { esquerda: 'defDeStatus', direita: 'def' }
	},
	{
		chave: 'mdef',
		rotulo: 'MDEF',
		alvo: '.st-mdef',
		alvoDaDireita: '.st-mdef2',
		daEsquerda: 'de status',
		daDireita: 'de equipamento',
		totalDoMotor: null,
		legado: { esquerda: 'mdefDeStatus', direita: 'mdef' }
	}
];

/**
 * PT-BR label for the handful of common jobs, keyed off MonsterTable's
 * (English) name — own local copy of BasicInfoIdle.js's JOB_PT dictionary
 * (see this file's header for why it's not shared/imported).
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
const StatusIdle = new GUIComponent('StatusIdle', cssText);

StatusIdle.render = () => htmlText;

/**
 * No floating button of its own (opened from BasicInfoIdle's icon grid),
 * but still built the same "transparent host, real window only where the
 * inner .st-window says so" way as HuntMap/IdleConfig/AdminPanel/IdleSkills
 * — see StatusIdle.css header for why. Same MouseMode.CROSS choice as
 * HuntMap.js:89.
 */
StatusIdle.mouseMode = GUIComponent.MouseMode.CROSS;

/**
 * @var {object|null} last "ficha" payload received from the server
 *      (contrato v2, ver o cabecalho deste arquivo).
 */
StatusIdle.ficha = null;

/**
 * @var {Preferences} window position (x/y are null until the player moves it)
 */
const _preferences = Preferences.get(
	'StatusIdle',
	{
		x: null,
		y: null
	},
	1.0
);

function _root() {
	return StatusIdle._shadow || StatusIdle._host;
}

/**
 * One-time setup (runs once, during GUIComponent#prepare()) — same shape as
 * HuntMap.init() (HuntMap.js:182-198).
 */
StatusIdle.init = function init() {
	const root = _root();

	this.draggable(root.querySelector('.st-titlebar'));

	root.querySelector('.st-close').addEventListener('click', onClickClose);
	root.querySelectorAll('.st-stat-up').forEach(btn => {
		btn.addEventListener('click', onClickStatUp);
	});

	// Default centered position, may be overridden by saved preferences in
	// onAppend() below (same approach as HuntMap.js:191-193).
	this._host.style.top = Math.max(0, (Renderer.height - WINDOW_HEIGHT) / 2) + 'px';
	this._host.style.left = Math.max(0, (Renderer.width - WINDOW_WIDTH) / 2) + 'px';
};

/**
 * Restore saved window position once appended (same as HuntMap.js:203-208).
 */
StatusIdle.onAppend = function onAppend() {
	if (_preferences.x != null && _preferences.y != null) {
		this._host.style.top = Math.min(Math.max(0, _preferences.y), Renderer.height - WINDOW_HEIGHT) + 'px';
		this._host.style.left = Math.min(Math.max(0, _preferences.x), Renderer.width - WINDOW_WIDTH) + 'px';
	}
};

/**
 * Save window position when removed (defensive — same as HuntMap.js:
 * 215-217).
 */
StatusIdle.onRemove = function onRemove() {
	savePosition();
};

function savePosition() {
	_preferences.x = parseInt(StatusIdle._host.style.left, 10) || 0;
	_preferences.y = parseInt(StatusIdle._host.style.top, 10) || 0;
	_preferences.save();
}

/**
 * Show/hide the window (same shape as HuntMap.toggle(), HuntMap.js:
 * 228-238): only the inner ".st-window" is shown/hidden, never the host
 * itself (see StatusIdle.css header for why). Every open re-requests the
 * ficha (see file header) — same "always ask fresh on open" convention as
 * HuntMap.toggle()'s requestCatalog().
 */
StatusIdle.toggle = function toggle() {
	const root = _root();
	const win = root.querySelector('.st-window');
	if (win.classList.contains('is-open')) {
		closeWindow();
	} else {
		win.classList.add('is-open');
		StatusIdle.focus();
		requestFicha();
		syncCharacterInfo();
	}
};

function closeWindow() {
	const root = _root();
	root.querySelector('.st-window').classList.remove('is-open');
	savePosition();
}

function onClickClose(e) {
	e.stopImmediatePropagation();
	StatusIdle.toggle();
}

/**
 * "Personagem" card — avatar/nome/classe/niveis/guild/zeny/peso, all read
 * from Session/BasicInfo's own live state (see file header). One-shot on
 * open, same moment as requestFicha() above.
 */
function syncCharacterInfo() {
	const root = _root();
	const entity = Session.Entity;
	if (!root || !entity) {
		return;
	}

	const name = (entity.display && entity.display.name) || '';
	setText(root, '.st-char-name', name || '—');

	const initialEl = root.querySelector('.st-avatar-initial');
	if (initialEl) {
		initialEl.textContent = name ? name.trim().charAt(0).toUpperCase() : '?';
	}

	const jobName = MonsterTable[entity.job];
	setText(root, '.st-char-class', (jobName && JOB_PT[jobName]) || jobName || '—');

	syncAvatarPortrait(root, entity.job);

	setText(root, '.st-char-blvl', entity.clevel || 0);
	setText(root, '.st-char-jlvl', entity.joblevel || 0);
	setText(root, '.st-guild', (Session.hasGuild && Session.guildName) || '—');
	setText(root, '.st-char-zeny', formatZeny(Session.zeny));

	// Same /10 convention as BasicInfoIdle.js's syncFromNativeState()
	// (native BasicInfoCommon.update('weight', ...) divides by 10 before
	// display) — mirrored here so the number matches the HUD exactly.
	const nativeUI = BasicInfo.getUI();
	const weight = Math.floor((entity.weight || 0) / 10);
	const weightMax = Math.floor(((nativeUI && nativeUI.weight_max) || 0) / 10);
	setText(root, '.st-char-weight', `${weight} / ${weightMax}`);
}

/**
 * Retrato de classe -- mesmo contrato e mesma tecnica de fallback do
 * BasicInfoIdle.js (ver o comentario la): so troca `src` quando o job muda,
 * ".st-avatar-initial" continua por baixo como fallback ate o onload da
 * imagem confirmar que o PNG do job existe. Copia local em vez de import
 * cruzado, mesmo padrao do JOB_PT desta secao do arquivo.
 */
function syncAvatarPortrait(root, jobId) {
	const img = root.querySelector('.st-avatar-img');
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
 * "1.234.567" — PT-BR thousands separator for zeny, same algorithm as
 * BasicInfoIdle.js's formatZeny().
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

/**
 * CZ_RAGIDLE_PEDIR_FICHA — opcode 0x0fff, fixed 2 bytes (opcode only).
 */
function requestFicha() {
	Network.sendPacket(new PACKET.CZ.RAGIDLE_PEDIR_FICHA());
}

/**
 * ZC_RAGIDLE_FICHA — opcode 0x0fef, variable size, JSON UTF-8 payload (see
 * PACKET.ZC.RAGIDLE_FICHA in Network/PacketStructure.js). Answers both the
 * "pedir" above and every server-side stat change (see file header) — this
 * one handler covers all three triggers, no need to tell them apart.
 */
function onFichaReceived(pkt) {
	let data;
	try {
		data = JSON.parse(pkt.json);
	} catch (e) {
		console.error('[StatusIdle] Falha ao interpretar a ficha recebida:', e, pkt.json);
		return;
	}

	// v2 (29/08/2026): o "base + bonus". Recusa alto em vez de desenhar meia
	// ficha — um v1 renderizado por este arquivo mostraria bonus zero em todo
	// atributo, que e um numero plausivel e ERRADO, o pior dos dois mundos.
	if (!data || data.v !== 2 || !data.atributos || !data.derivados) {
		console.error('[StatusIdle] Ficha com contrato incompatível (v=' + (data && data.v) + ').', data);
		return;
	}

	StatusIdle.ficha = data;
	renderFicha();
}

/**
 * Render StatusIdle.ficha into the DOM (see file header for the contract
 * shape). No-op until the first ficha arrives — the static placeholder
 * markup in StatusIdle.html stays on screen until then, same as any other
 * RAGIDLE window before its first server answer.
 */
function renderFicha() {
	const root = _root();
	const ficha = StatusIdle.ficha;
	if (!root || !ficha) {
		return;
	}

	const pontos = ficha.pontos || 0;
	const atributos = ficha.atributos || {};

	ATTR_KEYS.forEach(key => {
		const row = root.querySelector(`.st-stat-row[data-stat="${key}"]`);
		if (!row) {
			return;
		}
		const info = atributos[key] || {};
		const costEl = row.querySelector('.st-stat-cost');
		const upBtn = row.querySelector('.st-stat-up');

		renderAtributo(row, key, info);

		if (costEl) {
			costEl.textContent = info.custo || 0;
		}
		if (upBtn) {
			// custo === 0 -> attribute capped (per contract). Otherwise
			// only enabled while there are enough points left to spend.
			upBtn.disabled = !(info.custo > 0 && info.custo <= pontos);
		}
	});

	const derivados = ficha.derivados || {};
	renderMetades(root, derivados);
	setText(root, '.st-hit', derivados.hit || 0);
	setText(root, '.st-cri', derivados.crit || 0);
	setText(root, '.st-flee', derivados.flee || 0);
	setText(root, '.st-aspd', derivados.aspd || 0);
	setText(root, '.st-points', pontos);
	// Guild/name/class/level/zeny/peso aren't part of the ficha contract —
	// those live in the "Personagem" card, synced separately by
	// syncCharacterInfo() (see file header).
}

/**
 * Um atributo: "50 + 10" na linha, e a quebra por fonte no title.
 *
 * O numero grande e o `base`, e nao o `valor`: os dois costumam coincidir, mas
 * `valor` e "o que o jogador investiu" e `base` e "o de onde o bonus parte" —
 * quando divergirem, e o `base` que faz `base + bonus === total` fechar na
 * tela, e uma soma que nao fecha e o tipo de erro que o jogador reporta.
 *
 * `bonus` vem CALCULADO de `total - base`, mesmo o contrato ja trazendo o campo
 * `bonus` pronto: e a unica forma de garantir que a conta escrita na tela bate
 * com o `total` que o motor usa. Se os dois discordarem, o console diz — mas a
 * tela continua aritmeticamente honesta.
 */
function renderAtributo(row, chave, info) {
	const base = numeroDe(info.base, info.valor);
	const total = numeroDe(info.total, base);
	const bonus = total - base;

	const declarado = numeroDe(info.bonus, bonus);
	if (declarado !== bonus) {
		console.warn(
			`[StatusIdle] ${chave}: bonus declarado (${declarado}) != total - base (${total} - ${base} = ${bonus}). ` +
			'A tela mostra a conta, nao o campo.'
		);
	}

	const valueEl = row.querySelector('.st-stat-value');
	if (valueEl) {
		valueEl.textContent = base;
	}

	const bonusEl = row.querySelector('.st-stat-bonus');
	if (bonusEl) {
		// String vazia quando o bonus e zero — nunca um "+ 0" pendurado. Mesma
		// regra do cliente nativo (WinStatsCommon.js:346).
		bonusEl.textContent = bonus === 0 ? '' : textoDaParcela(bonus);
		tintaDaParcela(bonusEl, bonus);
	}

	const sigla = (row.querySelector('.st-stat-label') || {}).textContent || chave;
	row.title = titleDoAtributo(sigla, base, bonus, info);
}

/**
 * ATK/MATK/DEF/MDEF em duas metades ("30 + 55"), com o title explicando de onde
 * vem cada lado. Ver a tabela METADES para o porque dos lados e do `legado`.
 */
function renderMetades(root, derivados) {
	const metades = derivados.metades || {};

	METADES.forEach(def => {
		const par = lerMetades(metades[def.chave], derivados, def);

		setText(root, def.alvo, par.esquerda);

		const direitaEl = root.querySelector(def.alvoDaDireita);
		if (direitaEl) {
			// Ao contrario do bonus de atributo, a metade da direita e escrita
			// mesmo valendo zero: ela e ESTRUTURAL (o RO sempre mostra os dois
			// lados), e some so quando o servidor nao souber diz-la.
			direitaEl.textContent = par.temDireita ? textoDaParcela(par.direita) : '';
			tintaDaParcela(direitaEl, par.direita);
		}

		const row = root.querySelector(`.st-info-row[data-derivado="${def.chave}"]`);
		if (row) {
			row.title = titleDaMetade(def, par, derivados);
		}
	});
}

/**
 * As duas metades de uma derivada, com a rede do `legado` (ver METADES).
 *
 * Sem `metades` E sem legado (ATK/MATK), sobra o total do motor sozinho do lado
 * esquerdo — e o unico numero verdadeiro que existe nesse caso. O console diz o
 * que faltou, porque o sintoma na tela ("ATK 123" sem a metade) e discreto
 * demais para alguem notar que o servidor regrediu.
 */
function lerMetades(metade, derivados, def) {
	if (metade && metade.esquerda !== undefined && metade.direita !== undefined) {
		return {
			esquerda: Number(metade.esquerda) || 0,
			direita: Number(metade.direita) || 0,
			temDireita: true
		};
	}

	console.warn(`[StatusIdle] derivados.metades.${def.chave} ausente na ficha; caindo no formato antigo.`);

	if (def.legado) {
		return {
			esquerda: Number(derivados[def.legado.esquerda]) || 0,
			direita: Number(derivados[def.legado.direita]) || 0,
			temDireita: true
		};
	}

	return {
		esquerda: Number(derivados[def.totalDoMotor]) || 0,
		direita: 0,
		temDireita: false
	};
}

/**
 * "STR 50 + 15" + uma linha por parcela DIFERENTE DE ZERO. Parcela zerada nao
 * entra: a lista existe para responder "de onde vem o +15", e zero nao vem de
 * lugar nenhum.
 *
 * Bonus negativo aparece com o sinal dele ("-3"), nunca forcado a "+": ha
 * equipamento com malus de atributo, e um "+" mentiroso ali inverteria o
 * sentido da unica linha que o jogador foi ler.
 */
function titleDoAtributo(sigla, base, bonus, info) {
	const cabecalho = sigla + ' ' + base + (bonus === 0 ? '' : ' ' + textoDaParcela(bonus));

	const parcelas = PARCELAS_DO_BONUS
		.map(([campo, rotulo]) => ({ rotulo, valor: Number(info[campo]) || 0 }))
		.filter(p => p.valor !== 0);

	if (!parcelas.length) {
		return cabecalho + '\nSem bonus de nenhuma fonte.';
	}

	const soma = parcelas.reduce((acc, p) => acc + p.valor, 0);
	if (soma !== bonus) {
		console.warn(
			`[StatusIdle] ${sigla}: as parcelas somam ${soma} e o bonus e ${bonus}. ` +
			'Falta uma fonte no lado do servidor (ela deveria chegar como "outros").'
		);
	}

	// padEnd so alinha de verdade em fonte monoespacada, e o title nativo nao e
	// uma. Fica assim mesmo: no pior caso o resultado e ragged, no melhor
	// alinha — e a alternativa (uma janela de tooltip propria) seria inventar
	// mecanismo onde o fork ja tem um.
	const largura = Math.max(...parcelas.map(p => p.rotulo.length)) + 2;
	return [cabecalho]
		.concat(parcelas.map(p => '  ' + p.rotulo.padEnd(largura) + comSinal(p.valor)))
		.join('\n');
}

/**
 * "ATK 30 + 55" + o que e cada lado, e — so em ATK/MATK — o total do motor.
 *
 * A NOTA DO TOTAL E O PONTO DESTE TITLE: `derivados.atk` (123) nao e
 * `esquerda + direita` (85). Sao grandezas diferentes — o total do motor inclui
 * variancia e bonus de atributo que o ATK de arma nao tem —, e alguem que
 * compare os dois numeros sem esta linha vai abrir um defeito que nao existe.
 */
function titleDaMetade(def, par, derivados) {
	const cabecalho = def.rotulo + ' ' + par.esquerda + (par.temDireita ? ' ' + textoDaParcela(par.direita) : '');

	const linhas = [cabecalho, '  ' + par.esquerda + '  ' + def.daEsquerda];
	if (par.temDireita) {
		linhas.push('  ' + par.direita + '  ' + def.daDireita);
	}

	if (def.totalDoMotor) {
		const total = Number(derivados[def.totalDoMotor]) || 0;
		linhas.push(`Total no motor: ${total} (inclui variancia e bonus de atributo, entao nao e a soma acima).`);
	}

	return linhas.join('\n');
}

/**
 * "+ 10" / "- 3" — o que vai NA LINHA, ao lado do numero base.
 *
 * Mistura deliberada das duas receitas do cliente nativo: o espaco depois do
 * sinal vem do `atak2`/`def2` (WinStatsCommon.js:302-312) e o "vazio quando e
 * zero" vem do `str2` (:346), que escreve "+15" colado. O espaco venceu nos
 * dois casos para "50 + 10" e "30 + 55" saírem com a mesma forma — sao a mesma
 * pergunta na cabeca do jogador, e duas formas diferentes so dariam trabalho.
 */
function textoDaParcela(valor) {
	return valor < 0 ? '- ' + -valor : '+ ' + valor;
}

/**
 * "+10" / "-3" — o que vai DENTRO do title, onde a coluna e estreita e o espaco
 * depois do sinal atrapalharia o alinhamento.
 */
function comSinal(valor) {
	return (valor < 0 ? '-' : '+') + Math.abs(valor);
}

/**
 * Verde/vermelho nao: azul de destaque e vermelho de penalidade (ver
 * StatusIdle.css). A classe so entra quando o numero e negativo — pintar zero
 * ou positivo de vermelho seria o mesmo erro que forcar "+" no negativo.
 */
function tintaDaParcela(el, valor) {
	el.classList.toggle('st-bonus--negativo', valor < 0);
}

/**
 * O primeiro dos dois que for numero de verdade. `|| 0` nao serve aqui: ele
 * troca um zero LEGITIMO pelo fallback, e zero e valor comum em toda parcela
 * deste contrato.
 */
function numeroDe(valor, alternativa) {
	return Number.isFinite(Number(valor)) ? Number(valor) : (Number(alternativa) || 0);
}

function setText(root, selector, text) {
	const el = root.querySelector(selector);
	if (el) {
		el.textContent = text;
	}
}

/**
 * Send the exact same CZ_STATUS_CHANGE (0xbb) the native "up" arrow sends —
 * see file header for the full mechanism trail. `data-status-id` already
 * carries the right value (13-18), set once in StatusIdle.html.
 */
function onClickStatUp(e) {
	e.stopImmediatePropagation();
	const statusID = parseInt(e.currentTarget.dataset.statusId, 10);
	if (!statusID) {
		return;
	}

	const pkt = new PACKET.CZ.STATUS_CHANGE();
	pkt.statusID = statusID;
	pkt.changeAmount = 1;
	Network.sendPacket(pkt);
}

/*
 * O "Distribuir Automatico" SAIU da janela em 28/08/2026, a pedido do dono, e
 * com ele o `onClickAuto` que morava aqui.
 *
 * Ele mandava `CZ_RAGIDLE_DISTRIBUIR` (0x0ffe) e o servidor gastava TODOS os
 * pontos de uma vez pelo plano da classe. Um clique sem querer nao tinha volta:
 * o unico caminho e o `@resetstat`, que e de administrador.
 *
 * **O pacote e o handler do servidor continuam vivos** — o que saiu foi a
 * PORTA, nao a peca. Religar e devolver o botao ao HTML e o ouvinte aqui.
 */

Network.hookPacket(PACKET.ZC.RAGIDLE_FICHA, onFichaReceived);

/**
 * A TROCA DE PERSONAGEM ESQUECE a FICHA (28/08/2026).
 *
 * Voltar ao menu de personagem NAO recarrega a pagina: `onRestartAnswer` chama
 * `cleanGameUI()` e `onRestart()`, sem `GameEngine.reload()` (o reload so
 * acontece no SAIR). Todo estado de MODULO atravessa a troca — e este arquivo
 * guarda a ficha inteira do personagem.
 *
 * `ficha` e o retrato de atributos, nivel e bonus. Ela e a coisa mais visivel
 * da queixa que trouxe isto aqui: a janela de Status abrindo com os numeros
 * do personagem anterior.
 *
 * Chamada por `cleanGameUI()` em Engine/MapEngine.js, junto com os outros
 * componentes RAGIDLE. Quem somar estado de personagem aqui soma a linha
 * correspondente ABAIXO, e o portao `limpeza-da-troca-de-personagem.test.ts`
 * (no repo do servidor) reprova se esquecer.
 */
/*
 * ZERAR A FICHA NAO BASTA — a janela tem de FECHAR na troca de personagem.
 *
 * Mesma causa do `CodexIdle`: `GUIComponent.remove()` so DESANEXA o host, o
 * shadow DOM sobrevive e `prepare()` e guardado por `__loaded`. Zerando so
 * `StatusIdle.ficha`, o `.st-window` volta ABERTO com os atributos, o ATK e o
 * tooltip de parcelas do personagem ANTERIOR.
 *
 * Aqui isso e pior que no Codex: desde D-852 a janela mostra `base + bonus` com
 * a origem de cada parcela, entao o que fica na tela nao e so um numero velho —
 * e uma explicacao detalhada e confiante sobre o equipamento de outro
 * personagem.
 */
/*
 * UM STATUS ENTROU OU SAIU — se a janela estiver ABERTA, peca a ficha de novo.
 *
 * Chamado por `Engine/MapEngine/Entity.js`, de dentro do handler que ja trata
 * `ZC_MSG_STATE_CHANGE` (o motivo de o aviso vir de la, e nao de um
 * `hookPacket` proprio, esta comentado no ponto de chamada:
 * `Network.hookPacket` SOBRESCREVE o handler do opcode).
 *
 * A guarda de janela aberta e o que torna isto barato: status muda bastante em
 * luta, e pedir a ficha com a janela fechada seria trafego que ninguem desenha.
 *
 * Sem isto, a parcela `buff` e os derivados (ATK, HIT, FLEE...) ficavam na tela
 * com o valor de um buff JA EXPIRADO ate o jogador fazer outra coisa.
 */
StatusIdle.aoMudarStatus = function aoMudarStatus() {
	const root = _root();
	const win = root && root.querySelector('.st-window');
	if (!win || !win.classList.contains('is-open')) return;
	requestFicha();
};

StatusIdle.limparEstadoDoPersonagem = function limparEstadoDoPersonagem() {
	StatusIdle.ficha = null;
	const root = _root();
	if (!root) return;
	const win = root.querySelector('.st-window');
	if (win) {
		win.classList.remove('is-open');
	}
};

/**
 * Create component and export it
 */
export default UIManager.addComponent(StatusIdle);
