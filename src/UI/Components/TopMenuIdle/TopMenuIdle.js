/**
 * UI/Components/TopMenuIdle/TopMenuIdle.js
 *
 * "Menu superior direito" (constelacao de atalhos) do design system
 * "Ragnarok Classico Premium" (gauntlet 18/08/2026, ver
 * redesign/extracao-da-referencia.md secao 4.3). Duas fileiras de botoes
 * circulares no canto superior direito, ABAIXO do minimapa (ver
 * TopMenuIdle.css pro numero exato de respiro).
 *
 * FIACAO REAL (autorizada pelo dono a incluir "em breve" ao lado dos
 * funcionais - ver briefing do gauntlet 18/08/2026):
 *   - Skills -> IdleSkills.toggle()          (IdleSkills.js, mesmo metodo
 *               que DockIdle.js:229 ja usa)
 *   - Config -> IdleConfig.toggle()          (IdleConfig.js, mesmo metodo
 *               que DockIdle.js:235 ja usa)
 *   - Guilda -> Guild.toggle()               (Guild.js:404-418) - metodo
 *               PUBLICO nativo, ja exportado, nenhum alias precisou ser
 *               criado. ATENCAO ao comportamento nativo: se o jogador nao
 *               tem guilda (!Session.hasGuild), Guild.toggle() NAO abre a
 *               janela de guilda - chama Guild.promptCreateGuild() (a MESMA
 *               coisa que o atalho de teclado nativo faz, Guild.js:420-423,
 *               onKeyDown ESC tambem chama this.toggle()). Aceito de
 *               proposito: e o unico caminho de entrada nativo que existe,
 *               entao "abre" aqui quer dizer "dispara a MESMA acao que o
 *               jogo ja dispara" - nao existe atalho equivalente que force
 *               a janela de guilda com personagem sem guilda.
 *   - Grupo  -> PartyFriends.toggle()        (PartyFriends.js:47-52) -
 *               proxy PUBLICO do controller de versao (V0/V1) que ja existia,
 *               delega pra PartyFriendsCommon.js:132-138 (_toggleWindow),
 *               MESMO metodo que o atalho nativo de Party/Friends usa.
 *               Nenhum alias novo precisou ser criado.
 *
 * EM BREVE (funcao ainda nao existe no jogo - Loja, RO Shop, Troca, Leilao,
 * Recompensas, Eventos, Passe): visual premium, estado desabilitado
 * honesto (~55% opacidade, sem hover de acao - ver TopMenuIdle.css). Ao
 * clicar, mostra o toast proprio do componente (".tm-toast", ver
 * showToast() abaixo) e some sozinho em ~1.5s. NENHUM pacote sai do
 * cliente, NENHUMA janela falsa abre - a lista inteira e so o atributo
 * "data-em-breve" no HTML, lido no clique.
 *
 * Estado ativo (aro azul, ".is-active"): so no clique, mesmo criterio
 * aceito por DockIdle.js ("aceitavel atualizar so no clique" - sem polling
 * nem listener novo em nenhuma janela nativa). Detecao de "esta aberta":
 *   - Skills/Config: janelas RAGIDLE marcam ".xx-window.is-open" (mesmo
 *     formato de HuntMap/IdleConfig/IdleSkills/StatusIdle, ver
 *     DockIdle.js:isRagIdleWindowOpen()).
 *   - Guilda/Grupo: janelas nativas escondem via display:none no proprio
 *     HOST (Guild.js usa this.ui.show()/.hide(), que e um proxy jQuery-like
 *     sobre _host - ver GUIComponent.js:1322; PartyFriendsCommon.js:120-138
 *     idem, ora via Component.ui, ora via Component._host.style.display
 *     direto dependendo da versao). MESMO helper isHostVisible() de
 *     DockIdle.js cobre os dois casos porque os dois caminhos terminam em
 *     "_host.style.display !== 'none'".
 *
 * z-index / needFocus=false / pointer-events: mesmo contrato de
 * DockIdle.js/CombatCornerIdle.js - a constelacao nunca precisa vir pra
 * frente (fica presa no z-index inicial 50, GUIComponent.js:159) e nunca
 * intercepta clique no mapa fora dos proprios botoes (":host"
 * pointer-events:none, cada ".tm-item" reabre com pointer-events:auto).
 *
 * @author RagIdle
 */

import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import IdleSkills from 'UI/Components/IdleSkills/IdleSkills.js';
import IdleConfig from 'UI/Components/IdleConfig/IdleConfig.js';
import Guild from 'UI/Components/Guild/Guild.js';
import PartyFriends from 'UI/Components/PartyFriends/PartyFriends.js';
import SkillList from 'UI/Components/SkillList/SkillList.js';
import RiIcones from 'UI/ri-icones.js';
import htmlText from './TopMenuIdle.html?raw';
import cssText from './TopMenuIdle.css?raw';

/**
 * Mesmo intervalo de polling leve que DockIdle.js/BasicInfoIdle.js
 * (POLL_INTERVAL_MS = 250) - usado so pro ponto de skill disponivel (ver
 * syncSkillDot()), nunca pra estado ativo (esse e so-no-clique, ver
 * cabecalho do arquivo).
 */
const POLL_INTERVAL_MS = 250;

/**
 * Quanto tempo o toast "Em breve" fica visivel antes de sumir sozinho.
 */
const TOAST_DURATION_MS = 1500;

/**
 * Create Component
 */
const TopMenuIdle = new GUIComponent('TopMenuIdle', cssText);

/**
 * Troca cada marcador "<!--RI_ICONE:chave-->" do .html pela string SVG do
 * modulo de iconografia (UI/ri-icones.js) — mesmo padrao de DockIdle.js.
 */
TopMenuIdle.render = () => htmlText.replace(/<!--RI_ICONE:(\w+)-->/g, (_, chave) => RiIcones[chave] || '');

/**
 * Mesmo modo dos outros flutuantes RAGIDLE: scene click atravessa a UI
 * quando o mouse nao esta sobre um elemento clicavel de verdade.
 */
TopMenuIdle.mouseMode = GUIComponent.MouseMode.CROSS;

/**
 * Fora do sistema de foco/z-index (mesmo motivo de DockIdle.js) - a
 * constelacao nunca e uma janela, entao nunca precisa vir pra frente.
 */
TopMenuIdle.needFocus = false;

/**
 * @var {number|null} setInterval handle do polling do ponto de skill.
 */
let _pollTimer = null;

/**
 * @var {number|null} setTimeout handle do toast "Em breve" em exibicao.
 */
let _toastTimer = null;

/**
 * Helper: query dentro do shadow root
 */
function _root() {
	return TopMenuIdle._shadow || TopMenuIdle._host;
}

/**
 * One-time setup (roda uma vez, durante GUIComponent#prepare()).
 */
TopMenuIdle.init = function init() {
	const root = _root();
	root.querySelectorAll('.tm-item[data-action]').forEach(btn => {
		btn.addEventListener('click', onClickAction);
	});
};

/**
 * Sincroniza o destaque de todo item assim que a constelacao aparece
 * (cobre o caso de o jogador ja ter aberto uma janela por outro caminho
 * antes dela existir) e liga o polling leve do ponto de skill.
 */
TopMenuIdle.onAppend = function onAppend() {
	syncAllActiveStates();
	syncSkillDot();
	startPolling();
};

/**
 * Desliga o polling e qualquer toast pendente quando o componente sai de
 * cena (troca de mapa) - mesmo cuidado de DockIdle.js.
 */
TopMenuIdle.onRemove = function onRemove() {
	stopPolling();
	clearToastTimer();
};

function startPolling() {
	stopPolling();
	_pollTimer = setInterval(syncSkillDot, POLL_INTERVAL_MS);
}

function stopPolling() {
	if (_pollTimer != null) {
		clearInterval(_pollTimer);
		_pollTimer = null;
	}
}

function clearToastTimer() {
	if (_toastTimer != null) {
		clearTimeout(_toastTimer);
		_toastTimer = null;
	}
}

/**
 * Despacha o clique de um item: "em breve" so mostra o toast (nenhum
 * pacote, nenhuma janela); os funcionais chamam o MESMO metodo publico
 * que ja abre a janela em outro lugar do fork (ver cabecalho do arquivo).
 */
function onClickAction(e) {
	e.stopImmediatePropagation();
	const btn = e.currentTarget;

	if (btn.dataset.emBreve) {
		showToast();
		return;
	}

	const action = btn.dataset.action;

	switch (action) {
		case 'skills':
			IdleSkills.toggle();
			break;
		case 'guild':
			Guild.toggle();
			break;
		case 'group':
			PartyFriends.toggle();
			break;
		case 'config':
			IdleConfig.toggle();
			break;
		default:
			return;
	}

	updateActiveState(btn, action);
}

/**
 * Mostra o toast "Em breve" (elemento proprio do componente, ver
 * TopMenuIdle.html/.css) e agenda o sumico sozinho.
 */
function showToast() {
	const root = _root();
	const toast = root.querySelector('.tm-toast');
	if (!toast) {
		return;
	}

	toast.textContent = 'Em breve';
	toast.classList.add('is-visible');

	clearToastTimer();
	_toastTimer = setTimeout(() => {
		toast.classList.remove('is-visible');
		_toastTimer = null;
	}, TOAST_DURATION_MS);
}

/**
 * Confere se a janela de uma acao esta aberta AGORA (logo apos o toggle) e
 * aplica/remove a classe "is-active" (aro azul) no botao clicado. So roda
 * no clique - mesmo criterio aceito por DockIdle.js (ver cabecalho do
 * arquivo).
 */
function updateActiveState(btn, action) {
	btn.classList.toggle('is-active', isActionOpen(action));
}

function isActionOpen(action) {
	switch (action) {
		case 'skills':
			return isRagIdleWindowOpen(IdleSkills, '.is-window');
		case 'config':
			return isRagIdleWindowOpen(IdleConfig, '.ic-window');
		case 'guild':
			return isHostVisible(Guild);
		case 'group':
			return isHostVisible(PartyFriends.getUI());
		default:
			return false;
	}
}

/**
 * Janelas RAGIDLE (IdleSkills/IdleConfig) marcam "is-open" na classe do
 * elemento ".xx-window" - mesmo formato de DockIdle.js:isRagIdleWindowOpen().
 */
function isRagIdleWindowOpen(component, selector) {
	const root = component.getRoot();
	const win = root && root.querySelector(selector);
	return !!(win && win.classList.contains('is-open'));
}

/**
 * Janelas nativas (Guild/PartyFriends) escondem via display:none no proprio
 * HOST - mesmo helper de DockIdle.js:isHostVisible(), reutilizado aqui
 * porque o contrato e identico (ver cabecalho do arquivo).
 */
function isHostVisible(component) {
	return !!(component && component._host && component._host.style.display !== 'none');
}

/**
 * Sincroniza o destaque de todo item assim que a constelacao aparece.
 */
function syncAllActiveStates() {
	const root = _root();
	root.querySelectorAll('.tm-item[data-action]').forEach(btn => {
		if (!btn.dataset.emBreve) {
			updateActiveState(btn, btn.dataset.action);
		}
	});
}

/**
 * Le o mesmo dado que DockIdle.js:syncSkillDot() ja le (leitura pura de
 * DOM, nenhum arquivo de SkillList e tocado - ver o comentario completo em
 * DockIdle.js).
 */
function syncSkillDot() {
	const root = _root();
	const dot = root.querySelector('.tm-item[data-action="skills"] .ri-dot');
	if (!dot) {
		return;
	}

	const skillListRoot = SkillList.getUI() && SkillList.getUI().getRoot();
	const countEl = skillListRoot && skillListRoot.querySelector('.skpoints_count');
	const points = countEl ? parseInt(countEl.textContent, 10) || 0 : 0;

	dot.style.display = points > 0 ? '' : 'none';
}

/**
 * Create component and export it
 */
export default UIManager.addComponent(TopMenuIdle);
