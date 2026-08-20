/**
 * UI/Components/DeathWindow/DeathWindow.js
 *
 * Full-screen "Você morreu" overlay. Shows itself once the player's OWN hp
 * reaches 0 and hides itself the moment it's above 0 again, by ANY means
 * (server heal, the "Voltar para a cidade" button below, or anything else).
 *
 * ── Gauntlet round 1+4 fix: don't fire on unpopulated data, DO fire on a
 *    character that logs in already dead ────────────────────────────────
 * A freshly-entered character can briefly report hp<=0 before the real
 * ZC_PAR_CHANGE/ZC_LONGPAR_CHANGE stream has populated Session.Entity.life
 * (Entity defaults, see Renderer/Entity/Entity.js — life starts at -1/-1
 * until the server tells it otherwise). Round 1's fix gated the overlay on
 * having seen the character ALIVE (hp > 0) at least once — but round 4's
 * critic found the real character this fork is being validated against
 * logs in already dead (hp <= 0 from the very first real packet), so that
 * gate never latched and the "voltar para a cidade" button never showed
 * up for exactly the player who needs it most.
 *
 * The corrected gate is "dados válidos vistos" (valid data seen), not
 * "vivo visto" (seen alive): Session.Entity.life is considered genuinely
 * populated the first time hp_max > 0 is observed, REGARDLESS of what hp
 * is at that moment. hp_max is what flips from its -1 default to a real
 * value once the server has actually told the client about this
 * character's life — hp itself can legitimately be 0 from that very same
 * tick (a corpse has a real hp_max and hp=0, not "no data yet"). So:
 *
 *   - hp_max > 0 the first time  -> `_dadosValidosVistos = true` (latched
 *     for the rest of this map session)
 *   - from then on, hp <= 0      -> overlay shows, even on the very first
 *     tick after append() if the character was already dead on load
 *   - hp > 0 at any point        -> overlay hides (unchanged)
 *
 * `_dadosValidosVistos` is reset to false in onRemove() ("nesta sessão de
 * mapa" — a new map session, e.g. after a zone change/relog, must see
 * real data again before the overlay is allowed to trigger).
 *
 * ── Where the data comes from ──────────────────────────────────────────
 * Exact same source/mechanism as BasicInfoIdle's HP bar (see
 * BasicInfoIdle.js's file header for the full citation trail): the native
 * BasicInfo window itself reads Session.Entity.life.hp/hp_max
 * (Engine/SessionStorage.js:30, Renderer/Entity/EntityLife.js:210), kept
 * live by Engine/MapEngine/Main.js's ZC_PAR_CHANGE/ZC_LONGPAR_CHANGE
 * handlers (e.g. Main.js:254/298/704 — `Session.Entity.life.hp`). Those
 * packets are already hooked exactly once by MapEngine/Main.js, and
 * Network.hookPacket() (Network/NetworkManager.js:200-210) overwrites
 * rather than chaining callbacks, so this window polls that same
 * Session.Entity.life state every 250ms instead of hooking anything itself
 * — nothing is stolen from the native HP handling.
 *
 * "Voltar para a cidade" sends this fork's own CZ_RAGIDLE_RENASCER (opcode
 * 0x0ffd, fixed 2 bytes, opcode only — same shape as
 * CZ_RAGIDLE_PEDIR_CATALOGO/CONFIG/ADMIN/SKILLS/DISTRIBUIR, see
 * Network/PacketStructure.js "RAGIDLE:" section) and closes the overlay
 * immediately client-side. The server is expected to fully heal and
 * teleport the character; the standard mapmove packet that follows already
 * makes the client reload the map on its own (same flow HuntMap's
 * CZ_RAGIDLE_VIAJAR relies on, HuntMap.js:483-485), so nothing else is
 * needed here — if the heal round-trips before the map actually changes,
 * this window's own polling loop will simply see hp > 0 and hide itself
 * anyway.
 *
 * ── A CAMADA, e o segundo dialogo (gauntlet 19/08/2026) ───────────────
 * O dono fotografou a morte "mal posicionada e atras da UI". Medido no jogo
 * rodando, eram DUAS coisas, e nenhuma era o cartao daqui (que ja nasce
 * centralizado pelo flex de ".dw-overlay"):
 *
 *   1. este overlay disputava a MESMA faixa de z-index das janelas comuns
 *      (50..88, medido) e so ficava na frente enquanto ninguem mais pedisse
 *      foco — ver o bloco da camada em DeathWindow.css e `needFocus` abaixo;
 *   2. o menu ESC nativo abria um SEGUNDO dialogo de morte, a 75% da altura
 *      e sem pedir foco (z-index 52, medido), aparecendo por baixo deste
 *      cartao. Isso morreu na ORIGEM, por dois cadeados (nada de limpeza
 *      periodica, que fazia o menu piscar na mao do jogador): o handler de
 *      ZC_NOTIFY_VANISH (Engine/MapEngine/Entity.js) nao abre o menu de
 *      morte e fecha uma vez o que estivesse aberto, e Escape.onKeyDown nao
 *      abre menu nenhum enquanto `aMorteEstaNaTela()` — a morte aqui e
 *      escolha forcada de uma opcao so.
 *
 * @author RagIdle
 */

import Session from 'Engine/SessionStorage.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import htmlText from './DeathWindow.html?raw';
import cssText from './DeathWindow.css?raw';

/**
 * Light polling interval for Session.Entity.life.hp (see file header).
 */
const POLL_INTERVAL_MS = 250;

/**
 * Create Component
 */
const DeathWindow = new GUIComponent('DeathWindow', cssText);

DeathWindow.render = () => htmlText;

/**
 * Full-viewport host must not block the 3D scene while alive — same
 * reasoning/choice as HuntMap (HuntMap.js:81-89): only the inner
 * ".dw-overlay.is-open" (see DeathWindow.css) re-enables pointer-events,
 * and only while actually shown.
 */
DeathWindow.mouseMode = GUIComponent.MouseMode.CROSS;

/**
 * FORA do sistema de foco (19/08/2026, gauntlet item 2).
 *
 * `focus()` existe pra decidir QUEM fica na frente entre janelas que o
 * jogador empilha (GUIComponent.js:333-372) — e a morte nao disputa isso:
 * ela mora acima de todas, cravada em `:host` com "!important"
 * (DeathWindow.css, ver o comentario da camada la). Com `needFocus = false`
 * duas coisas melhoram: nenhuma outra janela consegue nos ultrapassar
 * pedindo foco, e abrir a morte para de RENUMERAR o z-index das janelas do
 * jogador (o `focus()` reindexa todas as outras como efeito colateral).
 * Mesmo contrato dos componentes de HUD (DockIdle.js:90, TopMenuIdle.js:107,
 * HuntButtonIdle.js:78), so que pelo motivo oposto: eles ficam sempre
 * ATRAS, esta fica sempre NA FRENTE.
 */
DeathWindow.needFocus = false;

/**
 * "Esta janela e a dona da morte?" — quem pergunta e o handler de
 * `ZC_NOTIFY_VANISH` (Engine/MapEngine/Entity.js), para NAO abrir tambem o
 * menu ESC em modo morte e por um segundo dialogo na tela (o defeito do
 * print do dono, 19/08/2026; o porque completo esta la, na chamada).
 *
 * A resposta e "estou pendurada no documento", e nao uma flag propria: e o
 * MapEngine quem faz `DeathWindow.append()` ao entrar no mapa e `remove()`
 * ao sair, entao estar no DOM e exatamente "o jogo esta no ar e a morte e
 * minha". Em qualquer outro contexto (viewer, telas de login) o componente
 * nao esta appendado e o comportamento nativo continua de pe.
 *
 * @returns {boolean}
 */
DeathWindow.ehADonaDaMorte = function ehADonaDaMorte() {
	return !!(this._host && this._host.parentNode);
};

/**
 * "A morte esta na tela AGORA?" — quem pergunta e o ESC
 * (UI/Components/Escape/Escape.js), que com a morte no ar nao abre menu
 * nenhum: o motivo completo esta la, na guarda.
 *
 * Nao basta olhar `_visible`. O overlay so abre no proximo giro do laco de
 * 250 ms, entao existe uma fresta depois do golpe em que o personagem JA
 * esta morto e o cartao ainda nao subiu — um ESC apertado ali abriria um
 * menu que o cartao cobriria em seguida, exatamente o desenho quebrado que
 * queremos matar. Por isso a fresta e fechada lendo a MESMA fonte de
 * verdade do laco (ver syncFromNativeState), e nao uma copia dela.
 *
 * @returns {boolean}
 */
DeathWindow.aMorteEstaNaTela = function aMorteEstaNaTela() {
	if (!DeathWindow.ehADonaDaMorte()) {
		return false;
	}
	if (_visible) {
		return true;
	}
	const life = Session.Entity && Session.Entity.life;
	return !!(life && _dadosValidosVistos && life.hp <= 0);
};

/**
 * @var {boolean} whether the overlay is currently shown — mirrors the
 *      ".dw-overlay.is-open" class, kept here too so syncFromNativeState()
 *      doesn't have to touch the DOM on every tick when nothing changed.
 */
let _visible = false;

/**
 * @var {boolean} "dadosValidosVistos" — true once this map session's
 *      polling has observed hp_max > 0 at least once, i.e. Session.Entity
 *      .life is genuinely populated (not the -1/-1 pre-data default) —
 *      regardless of what hp itself was at that moment. See file header:
 *      this is deliberately NOT "seen alive" (hp > 0) anymore, so a
 *      character that logs in already dead still gets the overlay right
 *      away. Reset in onRemove().
 */
let _dadosValidosVistos = false;

/**
 * @var {number|null} setInterval handle for the hp polling loop.
 */
let _pollTimer = null;

function _root() {
	return DeathWindow._shadow || DeathWindow._host;
}

/**
 * One-time setup.
 */
DeathWindow.init = function init() {
	const root = _root();
	root.querySelector('.dw-btn').addEventListener('click', onClickReturn);
};

/**
 * Start polling once appended (same lifetime as the other RAGIDLE floating
 * components — stays appended for the whole map session, see
 * Engine/MapEngine.js's "Add Game UI" block).
 */
DeathWindow.onAppend = function onAppend() {
	syncFromNativeState();
	startPolling();
};

/**
 * Stop polling and reset the "valid data seen" gate — a new map session
 * (next onAppend) must see real Session.Entity.life data again before the
 * overlay can trigger (see file header).
 */
DeathWindow.onRemove = function onRemove() {
	stopPolling();
	_dadosValidosVistos = false;
	hideOverlay();
};

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

/**
 * Re-read Session.Entity.life.hp (see file header) and show/hide the
 * overlay to match — but never show it until "_dadosValidosVistos" has
 * been latched true by an earlier hp_max > 0 reading. Once latched, a
 * dead reading (hp <= 0) shows the overlay immediately, even on the very
 * same tick that latched the flag — this is what lets a character who
 * logs in already dead see the overlay right away.
 */
function syncFromNativeState() {
	const entity = Session.Entity;
	const life = entity && entity.life;
	if (!life) {
		return;
	}

	if (life.hp_max > 0) {
		_dadosValidosVistos = true;
	}

	const isDead = _dadosValidosVistos && life.hp <= 0;

	if (isDead && !_visible) {
		showOverlay();
	} else if (!isDead && _visible) {
		hideOverlay();
	}
}

function showOverlay() {
	_visible = true;
	const root = _root();
	const overlay = root.querySelector('.dw-overlay');
	if (overlay) {
		overlay.classList.add('is-open');
	}
	// Nada de focus() aqui: a camada e cravada no CSS (DeathWindow.css) e
	// "needFocus = false" (ver acima) — pedir foco nao subiria nada e ainda
	// renumeraria as janelas do jogador.
}

function hideOverlay() {
	_visible = false;
	const root = _root();
	if (!root) {
		return;
	}
	const overlay = root.querySelector('.dw-overlay');
	if (overlay) {
		overlay.classList.remove('is-open');
	}
}

/**
 * "Voltar para a cidade" — CZ_RAGIDLE_RENASCER, opcode 0x0ffd, fixed 2
 * bytes (opcode only). See Network/PacketStructure.js "RAGIDLE:" section.
 */
function onClickReturn(e) {
	e.stopImmediatePropagation();
	Network.sendPacket(new PACKET.CZ.RAGIDLE_RENASCER());
	hideOverlay();
}

/**
 * Create component and export it
 */
export default UIManager.addComponent(DeathWindow);
