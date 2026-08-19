/**
 * UI/Components/DockIdle/DockIdle.js
 *
 * "Barra inferior" (dock) do design system "Ragnarok Classico Premium"
 * (gauntlet 18/08/2026, ver redesign/extracao-da-referencia.md secao 4.8).
 * Faixa fixa na base da tela, largura total, com atalhos para as janelas
 * RAGIDLE que ja existem — nenhuma logica de jogo nova, so toggle().
 *
 * Regra dura do briefing: SO atalho para o que EXISTE. Por isso os 7 itens
 * sao exatamente:
 *   - Personagem  -> StatusIdle.toggle()      (StatusIdle.js)
 *   - Skills      -> IdleSkills.toggle()      (IdleSkills.js)
 *   - Inventario  -> Inventory.getUI().toggle() (mesmo metodo que o atalho
 *                    de teclado nativo chama, ver Inventory.js:46-52 —
 *                    "component.toggle()" dentro do onKeyDown do ESC)
 *   - Equipamento -> Equipment.getUI().toggle() (idem, Equipment.js:48-54)
 *   - Caca        -> HuntMap.toggle()         (HuntMap.js, item central,
 *                    maior, com asas douradas + Poring por cima)
 *   - Config      -> IdleConfig.toggle()      (IdleConfig.js)
 *   - Menu        -> Escape.onKeyDown({...})  (chama a MESMA funcao que o
 *                    atalho de teclado ESC nativo chama — Escape.js:108-117
 *                    — sem duplicar a logica de show/hide)
 * Nada de Loja/Guilda/Leilao/etc: essas janelas nao existem no fork ainda.
 *
 * Esconde os 3 botoes flutuantes redondos que ficaram REDUNDANTES com o
 * dock (o mesmo destino ja coberto por um item da barra): ".hm-button"
 * (HuntMap), ".ic-button" (IdleConfig) e ".is-button" (IdleSkills) — todos
 * "position:fixed" dentro do proprio shadow root de cada componente (ver
 * HuntMap.css:66-81 e irmãs), entao esconder e so um display:none no
 * elemento certo, feito em onAppend() (mesma tecnica reversivel que
 * BasicInfoIdle.js usa pra esconder a janela nativa BasicInfo — ver
 * BasicInfoIdle.js:218-223 — nenhum arquivo desses 3 componentes e tocado).
 * NAO esconde ".ap-button" (AdminPanel): o dock nao tem item de Admin, essa
 * funcao continua sem cobertura equivalente.
 *
 * z-index: precisa ficar ABAIXO de qualquer janela aberta (nunca cobrir
 * HuntMap/IdleConfig/IdleSkills/Status/etc quando elas abrem). O sistema de
 * foco do GUIComponent (GUIComponent.js:317-360) da z-index crescente a
 * cada `component.focus()` — e toggle() de HuntMap/IdleConfig/IdleSkills/
 * StatusIdle chama `.focus()` toda vez que ABRE a janela (ver IdleConfig.js
 * :223-233, por exemplo). Setando `needFocus = false` aqui, o DockIdle sai
 * inteiramente desse sistema e fica preso no z-index inicial (50, o mesmo
 * valor de partida de TODO componente — GUIComponent.js:159) pra sempre:
 * qualquer janela que abrir/focar sobe para 51+ e passa por cima do dock
 * sem o dock precisar de nenhum numero magico maior.
 *
 * pointer-events: ":host" fica pointer-events:none (a faixa nao intercepta
 * clique nenhum), e cada ".dk-item" reabre com pointer-events:auto — clicar
 * no mapa atraves da area vazia da barra continua funcionando (ver
 * DockIdle.css, mesmo contrato de MobileUI.css e das janelas RAGIDLE que
 * usam GUIComponent.MouseMode.CROSS).
 *
 * @author RagIdle
 */

import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import KEYS from 'Controls/KeyEventHandler.js';
import HuntMap from 'UI/Components/HuntMap/HuntMap.js';
import IdleConfig from 'UI/Components/IdleConfig/IdleConfig.js';
import IdleSkills from 'UI/Components/IdleSkills/IdleSkills.js';
import StatusIdle from 'UI/Components/StatusIdle/StatusIdle.js';
import Escape from 'UI/Components/Escape/Escape.js';
import Inventory from 'UI/Components/Inventory/Inventory.js';
import Equipment from 'UI/Components/Equipment/Equipment.js';
import SkillList from 'UI/Components/SkillList/SkillList.js';
import RiIcones from 'UI/ri-icones.js';
import htmlText from './DockIdle.html?raw';
import cssText from './DockIdle.css?raw';

/**
 * Intervalo do polling leve de estado nativo read-only (mesma cadencia de
 * BasicInfoIdle.js:90, POLL_INTERVAL_MS = 250ms) usado tanto pra manter o
 * #lvlup_job escondido (ele pode reaparecer depois do onAppend, ver
 * hideNativeLevelUpButton()) quanto pra ler o ponto de skill disponivel
 * (ver syncSkillDot()).
 */
const POLL_INTERVAL_MS = 250;

/**
 * @var {number|null} setInterval handle do polling leve descrito acima.
 */
let _pollTimer = null;

/**
 * Create Component
 */
const DockIdle = new GUIComponent('DockIdle', cssText);

/**
 * Troca cada marcador "<!--RI_ICONE:chave-->" do .html pela string SVG
 * correspondente do modulo de iconografia (UI/ri-icones.js) — os
 * ids/data-attrs/listeners de fora do <svg> nunca mudam de lugar, so o
 * miolo do ".dk-icon-wrap" e substituido antes do innerHTML ir pro shadow
 * DOM (ver GUIComponent#prepare(), que chama render() uma vez e usa o
 * retorno como innerHTML).
 */
DockIdle.render = () => htmlText.replace(/<!--RI_ICONE:(\w+)-->/g, (_, chave) => RiIcones[chave] || '');

/**
 * Mesmo modo dos outros flutuantes RAGIDLE (HuntMap.js, IdleConfig.js,
 * IdleSkills.js, StatusIdle.js): scene click atravessa a UI quando o mouse
 * nao esta sobre um elemento clicavel de verdade. Aqui isso ja e garantido
 * pelo pointer-events:none do ":host" (ver DockIdle.css), CROSS so evita
 * o listener extra de touchstart que o modo padrao (STOP) adicionaria.
 */
DockIdle.mouseMode = GUIComponent.MouseMode.CROSS;

/**
 * Fora do sistema de foco/z-index dos componentes com janela (ver
 * comentario do topo do arquivo) — o dock nunca precisa vir pra frente
 * porque ele nao e uma janela, e por isso tambem nunca deve cobrir uma.
 */
DockIdle.needFocus = false;

/**
 * Helper: query dentro do shadow root
 */
function _root() {
	return DockIdle._shadow || DockIdle._host;
}

/**
 * One-time setup (roda uma vez, durante GUIComponent#prepare()).
 */
DockIdle.init = function init() {
	const root = _root();
	root.querySelectorAll('.dk-item[data-action]').forEach(btn => {
		btn.addEventListener('click', onClickAction);
	});
};

/**
 * Esconde os 3 botoes flutuantes redundantes (ver cabecalho do arquivo),
 * sincroniza o destaque azul com o estado real de cada janela, esconde o
 * #lvlup_job encalhado (ver hideNativeLevelUpButton()) e liga o polling leve
 * que mantem essas duas coisas atualizadas (mesma tecnica de
 * BasicInfoIdle.js:183-197/225-235).
 */
DockIdle.onAppend = function onAppend() {
	hideRedundantFloatingButtons();
	syncAllActiveStates();
	hideNativeLevelUpButton();
	syncSkillDot();
	startPolling();
};

/**
 * Desliga o polling quando o dock sai de cena (troca de mapa) — mesmo
 * cuidado de BasicInfoIdle.js:203-206, senao o setInterval ficaria rodando
 * pra sempre sobre um componente removido.
 */
DockIdle.onRemove = function onRemove() {
	stopPolling();
};

function startPolling() {
	stopPolling();
	_pollTimer = setInterval(pollNativeState, POLL_INTERVAL_MS);
}

function stopPolling() {
	if (_pollTimer != null) {
		clearInterval(_pollTimer);
		_pollTimer = null;
	}
}

function pollNativeState() {
	hideNativeLevelUpButton();
	syncSkillDot();
}

/**
 * O botao nativo "#lvlup_job" (janela SkillList — SkillListCommon.js:137-161)
 * fica encalhado no canto inferior direito da tela: ele e um <ui-button>
 * pendurado direto em document.body (SkillListCommon.js:1060-1064,
 * `document.body.appendChild(_btnLevelUp)`, disparado a cada StatusProperty
 * .JOBLEVEL — Engine/MapEngine/Main.js:496-499) que originalmente se
 * ancorava visualmente no canto da janela nativa BasicInfo. Como a
 * BasicInfoIdle esconde essa janela nativa (BasicInfoIdle.js:218-223), o
 * botao perde a referencia visual e sobra solto, sempre visivel, no canto
 * da tela.
 *
 * Escondido aqui de forma REVERSIVEL (display:none via JS, nunca .remove())
 * — o proprio SkillListCommon.js continua dono do elemento, com seu click
 * listener intacto; nenhum arquivo dele e tocado. Precisa rodar no polling
 * (nao so uma vez no onAppend) porque o elemento so entra em document.body
 * quando SkillList.getUI().onLevelUp() roda pela primeira vez — se isso
 * acontecer DEPOIS do onAppend do DockIdle, um hide unico o perderia.
 */
function hideNativeLevelUpButton() {
	const btn = document.getElementById('lvlup_job');
	if (btn && btn.style.display !== 'none') {
		btn.style.display = 'none';
	}
}

/**
 * Esconde ".hm-button"/".ic-button"/".is-button" — display:none reversivel,
 * nenhum arquivo de HuntMap/IdleConfig/IdleSkills e alterado. Precisa
 * rodar DEPOIS de HuntMap.prepare()/IdleConfig.prepare()/IdleSkills.prepare()
 * (a shadow DOM deles so existe apos o prepare()) — em Engine/MapEngine.js
 * o DockIdle.prepare()/append() ficam depois desses tres, entao a ordem ja
 * esta garantida.
 */
function hideRedundantFloatingButtons() {
	hideButton(HuntMap, '.hm-button');
	hideButton(IdleConfig, '.ic-button');
	hideButton(IdleSkills, '.is-button');
	// AdminPanel (".ap-button") fica de fora de proposito: o dock nao tem
	// item de Admin, essa funcao continua sem atalho equivalente.
}

function hideButton(component, selector) {
	const root = component.getRoot();
	const btn = root && root.querySelector(selector);
	if (btn && btn.style.display !== 'none') {
		btn.style.display = 'none';
	}
}

/**
 * Despacha o clique de um item do dock pro toggle() do componente
 * correspondente — mesma funcao publica que os botoes originais de cada
 * janela ja chamavam (ver cabecalho do arquivo pra cada caso).
 */
function onClickAction(e) {
	e.stopImmediatePropagation();
	const btn = e.currentTarget;
	const action = btn.dataset.action;

	switch (action) {
		case 'status':
			StatusIdle.toggle();
			break;
		case 'skills':
			IdleSkills.toggle();
			break;
		case 'huntmap':
			HuntMap.toggle();
			break;
		case 'idleconfig':
			IdleConfig.toggle();
			break;
		case 'inventory':
			Inventory.getUI().toggle();
			break;
		case 'equip':
			Equipment.getUI().toggle();
			break;
		case 'menu':
			// Chama a MESMA funcao que o atalho de teclado ESC nativo chama
			// (Escape.js:108-117) — nao existe Escape.toggle() publico, e
			// duplicar a logica de show/hide aqui seria o unico jeito de
			// evitar isso. `this` dentro de onKeyDown vira `Escape` porque a
			// chamada e feita como metodo (Escape.onKeyDown(...)).
			Escape.onKeyDown({ which: KEYS.ESCAPE });
			break;
		default:
			return;
	}

	updateActiveState(btn, action);
}

/**
 * Confere se a janela de uma acao esta aberta AGORA (logo apos o toggle) e
 * aplica/remove a classe "is-active" (destaque azul) no botao clicado. So
 * roda no clique — o briefing aceita isso explicitamente ("aceitavel
 * atualizar o estado so no clique"), entao nao ha polling nem listener
 * extra em nenhuma das janelas nativas ou RAGIDLE.
 */
function updateActiveState(btn, action) {
	btn.classList.toggle('is-active', isActionOpen(action));
}

function isActionOpen(action) {
	switch (action) {
		case 'status':
			return isRagIdleWindowOpen(StatusIdle, '.st-window');
		case 'skills':
			return isRagIdleWindowOpen(IdleSkills, '.is-window');
		case 'huntmap':
			return isRagIdleWindowOpen(HuntMap, '.hm-window');
		case 'idleconfig':
			return isRagIdleWindowOpen(IdleConfig, '.ic-window');
		case 'inventory':
			return isHostVisible(Inventory.getUI());
		case 'equip':
			return isHostVisible(Equipment.getUI());
		case 'menu':
			return isHostVisible(Escape);
		default:
			return false;
	}
}

/**
 * Janelas RAGIDLE (HuntMap/IdleConfig/IdleSkills/StatusIdle) marcam
 * "is-open" na classe do elemento ".xx-window" — o HOST fica sempre do
 * mesmo tamanho, so a janela interna aparece/some (ver HuntMap.js:265-270
 * e as janelas irmas, mesmo formato).
 */
function isRagIdleWindowOpen(component, selector) {
	const root = component.getRoot();
	const win = root && root.querySelector(selector);
	return !!(win && win.classList.contains('is-open'));
}

/**
 * Janelas nativas (Inventory/Equipment) e a Escape usam display:none no
 * proprio HOST pra esconder (ver InventoryCommon.js:445-458,
 * EquipmentCommon.js:469+ e Escape.js:108-117).
 */
function isHostVisible(component) {
	return !!(component && component._host && component._host.style.display !== 'none');
}

/**
 * Le o mesmo dado que o proprio #lvlup_job usa pra saber se ha ponto de
 * skill pra gastar: StatusProperty.SKPOINT (Engine/MapEngine/Main.js:353-355,
 * `SkillList.getUI().setPoints(amount)`), que a janela nativa SkillList
 * guarda tanto no closure privado `_points` (sem getter publico) quanto no
 * texto de `.skpoints_count` dentro da propria shadow DOM
 * (SkillListCommon.js:1037-1043). Como `_points` nao e exposto, lemos o
 * mesmo numero de onde ele MESMO e escrito — leitura pura de DOM, nenhum
 * arquivo de SkillList e tocado. Da mesma forma que hideNativeLevelUpButton()
 * acima, e leitura read-only: nunca escreve em SkillList.
 */
function syncSkillDot() {
	const root = _root();
	const dot = root.querySelector('.dk-item[data-action="skills"] .ri-dot');
	if (!dot) {
		return;
	}

	const skillListRoot = SkillList.getUI() && SkillList.getUI().getRoot();
	const countEl = skillListRoot && skillListRoot.querySelector('.skpoints_count');
	const points = countEl ? parseInt(countEl.textContent, 10) || 0 : 0;

	dot.style.display = points > 0 ? '' : 'none';
}

/**
 * Sincroniza o destaque de todo item assim que o dock aparece — cobre o
 * caso de o jogador ja ter aberto uma janela por outro caminho (grade do
 * BasicInfoIdle, tecla de atalho) antes do dock existir.
 */
function syncAllActiveStates() {
	const root = _root();
	root.querySelectorAll('.dk-item[data-action]').forEach(btn => {
		updateActiveState(btn, btn.dataset.action);
	});
}

/**
 * Create component and export it
 */
export default UIManager.addComponent(DockIdle);
