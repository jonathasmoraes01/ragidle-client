/**
 * UI/Components/TopMenuIdle/TopMenuIdle.js
 *
 * "Menu superior direito" (constelacao de atalhos) do design system
 * "Ragnarok Classico Premium" (gauntlet 18/08/2026, ver
 * redesign/extracao-da-referencia.md secao 4.3). Botoes circulares no canto
 * superior direito, AO LADO do minimapa (ver TopMenuIdle.css pro numero
 * exato de respiro).
 *
 * DOIS NIVEIS (gauntlet item 2, 19/08/2026 -- referencia de LAYOUT: print do
 * Ragnarok Origin que o dono anexou, "topo enxuto + menu lateral/inferior
 * que abre e fecha"; a PELE nunca mudou, continua so o design system):
 *   - ".tm-top" (NIVEL 1): 5 essenciais de gameplay -- Personagem,
 *     Inventario, Equipamento, Skills, Caca. SEMPRE visivel.
 *   - ".tm-secondary" (NIVEL 2, id "tm-secondary"): 5 secundarios
 *     funcionais (Config, Guilda, Grupo, Menu, Admin) + os 7 "em breve".
 *     Abre/fecha pelo ".tm-toggle", que mora no NIVEL 1 e por isso nunca
 *     some -- ver onClickToggle()/applyCollapsedState() mais abaixo pro
 *     mecanismo (reaproveita o recolher/expandir de D-343, so que agora
 *     comanda so o nivel 2, nunca a constelacao inteira).
 * O CORTE (10 funcionais divididos 5+5, mais os 7 "em breve" no nivel 2) foi
 * aplicado pelo criterio que o dono deixou explicito no briefing do item 2:
 * nivel 1 = o que se usa toda hora jogando; nivel 2 = o resto. Nenhum
 * destino sumiu -- os mesmos 10 metodos publicos de antes continuam
 * alcancaveis, so a casa de 5 deles mudou.
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
 * NOVOS EM 19/08/2026 (pedido do dono: BasicInfoIdle perdeu a propria grade
 * de icones nesta rodada, os destinos abaixo migraram pra ca -- mesmos
 * metodos/criterios que BasicInfoIdle.js usava, so a casa mudou):
 *   - Personagem  -> StatusIdle.toggle()     (StatusIdle.js) - janela de
 *                 status/atributos do fork, mesmo shape de HuntMap/
 *                 IdleConfig/IdleSkills/AdminPanel.
 *   - Inventario  -> MochilaIdle.toggle()    (MochilaIdle.js:429) - janela
 *   - Equipamento -> MochilaIdle.toggle()    unificada (19/08/2026 juntou as
 *                 duas nativas numa so); os dois itens da constelacao
 *                 chamam o MESMO metodo de proposito -- duplicacao aceita,
 *                 o jogador reconhece os dois nomes do jogo classico.
 *   - Caca        -> HuntMap.toggle()        (HuntMap.js:287) - MESMA janela
 *                 que "#HuntButtonIdle" (botao sob o minimapa, so em
 *                 cidade) ja abre; redundancia DECLARADA e pedida pelo dono.
 *   - Menu        -> Escape.onKeyDown({which: KEYS.ESCAPE})  (Escape.js) -
 *                 dispara a MESMA funcao que a tecla ESC nativa ja dispara,
 *                 sem duplicar logica de mostrar/esconder menu nenhuma.
 *   - Admin       -> AdminPanel.toggle()     (AdminPanel.js:268), com a
 *                 MESMA trava de conta dona que AdminPanel.js:65/186 usa
 *                 (Session.AID === 2000000, ver isOwnerAccount() abaixo) -
 *                 escondido client-side via display:none pra quem nao e a
 *                 conta dona; o servidor aplica a restricao de verdade.
 *
 * EM BREVE (funcao ainda nao existe no jogo - Loja, RO Shop, Troca, Leilao,
 * Recompensas, Eventos, Passe): visual premium, estado desabilitado
 * honesto (~55% opacidade, sem hover de acao - ver TopMenuIdle.css). Ao
 * clicar, mostra o toast proprio do componente (".tm-toast", ver
 * showToast() abaixo) e some sozinho em ~1.5s. NENHUM pacote sai do
 * cliente, NENHUMA janela falsa abre - a lista inteira e so o atributo
 * "data-em-breve" no HTML, lido no clique.
 *
 * ORDEM (pedido do dono, mantida na divisao em niveis de 19/08/2026): dentro
 * de cada nivel, TODOS os funcionais primeiro -- nivel 1 e so funcional
 * (Personagem, Inventario, Equipamento, Skills, Caca); nivel 2 poe Guilda,
 * Grupo, Config, Menu, Admin primeiro e "em breve" por ultimo -- nunca
 * misturado, pra nao fazer o jogador procurar o que funciona no meio do que
 * ainda nao existe.
 *
 * Estado ativo (aro azul, ".is-active"): DERIVADO da janela estar aberta, a
 * cada tique do polling (19/08/2026) — antes era lembrado do clique, e por
 * isso fechar a janela pelo "X" dela deixava o aro aceso para sempre.
 * Continua sem listener novo em janela nativa: e leitura de DOM no tique que
 * o componente ja tinha. Detecao de "esta aberta":
 *   - Skills/Config/Personagem/Inventario/Equipamento/Caca/Admin: janelas
 *     RAGIDLE marcam ".xx-window.is-open" (mesmo formato de HuntMap/
 *     IdleConfig/IdleSkills/StatusIdle/MochilaIdle/AdminPanel, ver
 *     DockIdle.js:isRagIdleWindowOpen()).
 *   - Guilda/Grupo: janelas nativas escondem via display:none no proprio
 *     HOST (Guild.js usa this.ui.show()/.hide(), que e um proxy jQuery-like
 *     sobre _host - ver GUIComponent.js:1322; PartyFriendsCommon.js:120-138
 *     idem, ora via Component.ui, ora via Component._host.style.display
 *     direto dependendo da versao). MESMO helper isHostVisible() de
 *     DockIdle.js cobre os dois casos porque os dois caminhos terminam em
 *     "_host.style.display !== 'none'".
 *   - Menu: nao tem estado de "aberta" persistente pra derivar (ESC e uma
 *     acao instantanea, nao uma janela que fica de pe) -- nunca acende.
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
import Preferences from 'Core/Preferences.js';
import Session from 'Engine/SessionStorage.js';
import IdleSkills from 'UI/Components/IdleSkills/IdleSkills.js';
import IdleConfig from 'UI/Components/IdleConfig/IdleConfig.js';
import Guild from 'UI/Components/Guild/Guild.js';
import PartyFriends from 'UI/Components/PartyFriends/PartyFriends.js';
import SkillList from 'UI/Components/SkillList/SkillList.js';
import StatusIdle from 'UI/Components/StatusIdle/StatusIdle.js';
import MochilaIdle from 'UI/Components/MochilaIdle/MochilaIdle.js';
import HuntMap from 'UI/Components/HuntMap/HuntMap.js';
import AdminPanel from 'UI/Components/AdminPanel/AdminPanel.js';
import Escape from 'UI/Components/Escape/Escape.js';
import KEYS from 'Controls/KeyEventHandler.js';
import RiIcones from 'UI/ri-icones.js';
import htmlText from './TopMenuIdle.html?raw';
import cssText from './TopMenuIdle.css?raw';

/**
 * Mesma constante de conta dona que AdminPanel.js:65 -- copia local (nao
 * exportada de la, mesma escolha que BasicInfoIdle.js fazia antes de perder
 * o botao de admin nesta rodada) porque o criterio precisa ser reproduzido
 * aqui, e o instrucional pede pra nao tocar em AdminPanel.js.
 */
const OWNER_AID = 2000000;

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
 * @var {Preferences} estado aberto/fechado do NIVEL 2 (menu retratil).
 * Chave e formato IDENTICOS ao "recolher/expandir a constelacao inteira" de
 * D-343 -- so o SIGNIFICADO do booleano mudou (agora e so o nivel 2, nunca
 * o nivel 1) -- entao uma preferencia salva de sessao anterior continua
 * lendo certo, sem precisar bump de versao nem migracao. Mesmo padrao de
 * Preferences.get() que BasicInfoIdle.js:144 ja usa pra posicao de janela.
 * Chave propria ("TopMenuIdle") -- nao concorre com nenhum outro componente
 * no localStorage.
 */
const _preferences = Preferences.get(
	'TopMenuIdle',
	{
		collapsed: false
	},
	1.0
);

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
 * Mesmo criterio de AdminPanel.js:186 (Session.AID === OWNER_AID) -- so
 * esconde o item client-side, o servidor aplica a restricao de verdade.
 */
function isOwnerAccount() {
	return Session.AID === OWNER_AID;
}

/**
 * One-time setup (roda uma vez, durante GUIComponent#prepare()).
 */
TopMenuIdle.init = function init() {
	const root = _root();
	root.querySelectorAll('.tm-item[data-action]').forEach(btn => {
		btn.addEventListener('click', onClickAction);
	});

	const toggle = root.querySelector('.tm-toggle');
	if (toggle) {
		toggle.addEventListener('click', onClickToggle);
	}
};

/**
 * Sincroniza o destaque de todo item assim que a constelacao aparece
 * (cobre o caso de o jogador ja ter aberto uma janela por outro caminho
 * antes dela existir), aplica o estado recolhido/expandido salvo e liga o
 * polling leve do ponto de skill.
 */
TopMenuIdle.onAppend = function onAppend() {
	applyCollapsedState();

	// Admin (19/08/2026): mesma trava de conta dona que BasicInfoIdle.js
	// aplicava antes de perder o proprio botao -- so quem e a conta dona ve
	// o item; qualquer outra conta nunca ve nem consegue clicar.
	const root = _root();
	const adminBtn = root.querySelector('.tm-item-admin');
	if (adminBtn) {
		adminBtn.style.display = isOwnerAccount() ? '' : 'none';
	}

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
	_pollTimer = setInterval(pollEstado, POLL_INTERVAL_MS);
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
		case 'status':
			StatusIdle.toggle();
			break;
		/*
		 * Inventario e Equipamento apontam para a MESMA janela: a MochilaIdle
		 * (19/08/2026) juntou as duas nativas numa so -- os dois itens da
		 * constelacao continuam separados de proposito (duplicacao aceita,
		 * ver cabecalho do arquivo).
		 */
		case 'inventory':
		case 'equip':
			MochilaIdle.toggle();
			break;
		case 'skills':
			IdleSkills.toggle();
			break;
		case 'huntmap':
			/* Duplicacao DECLARADA com "#HuntButtonIdle" (botao sob o
			   minimapa, so em cidade) -- os dois abrem a MESMA janela,
			   pedido do dono. */
			HuntMap.toggle();
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
		case 'menu':
			/* Mesma funcao que a tecla ESC nativa dispara (Escape.js), sem
			   duplicar a logica de mostrar/esconder -- BasicInfoIdle.js
			   fazia assim antes de perder o proprio botao de Menu. */
			Escape.onKeyDown({ which: KEYS.ESCAPE });
			break;
		case 'admin':
			if (!isOwnerAccount()) {
				return;
			}
			AdminPanel.toggle();
			break;
		default:
			return;
	}

	updateActiveState(btn, action);
}

/**
 * Clique no botao de abrir/fechar o NIVEL 2 (herdou o mecanismo do
 * recolher/expandir de D-343): alterna e SALVA a preferencia
 * (Preferences.get/.save(), mesmo padrao de BasicInfoIdle.js:savePosition()),
 * aplica o estado na hora -- nao espera o tique de 250ms, mesmo cuidado de
 * updateActiveState() acima. Ao FECHAR, tambem apaga qualquer toast "Em
 * breve" pendente (ver clearToastTimer() abaixo) -- o toast mora dentro do
 * nivel 2, entao ele ja some visualmente com o opacity:0 do pai, mas o
 * timer que o esconderia sozinho nao precisa continuar rodando escondido.
 */
function onClickToggle(e) {
	e.stopImmediatePropagation();
	_preferences.collapsed = !_preferences.collapsed;
	_preferences.save();
	applyCollapsedState();

	if (_preferences.collapsed) {
		hideToastNow();
	}
}

/**
 * Reflete "_preferences.collapsed" no DOM: o NIVEL 2 inteiro some
 * (".tm-secondary.is-collapsed", ver CSS) e o botao gira pra apontar pro
 * lado contrario. O NIVEL 1 (".tm-top") nunca e tocado aqui -- fica de pe
 * sempre, mesmo fechado. Chamado no onAppend() (restaura o que foi salvo) e
 * a cada clique.
 */
function applyCollapsedState() {
	const root = _root();
	const secondary = root.querySelector('.tm-secondary');
	const toggle = root.querySelector('.tm-toggle');
	if (!secondary || !toggle) {
		return;
	}

	const collapsed = !!_preferences.collapsed;
	secondary.classList.toggle('is-collapsed', collapsed);
	toggle.classList.toggle('is-collapsed', collapsed);
	toggle.setAttribute('aria-expanded', String(!collapsed));

	const label = collapsed ? 'Abrir menu' : 'Fechar menu';
	toggle.title = label;
	toggle.setAttribute('aria-label', label);
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
 * Apaga o toast "Em breve" na hora (sem esperar o TOAST_DURATION_MS) --
 * chamado ao fechar o NIVEL 2 (ver onClickToggle() acima), pra nao deixar o
 * setTimeout rodando escondido atras de um pai com opacity:0.
 */
function hideToastNow() {
	clearToastTimer();
	const root = _root();
	const toast = root.querySelector('.tm-toast');
	if (toast) {
		toast.classList.remove('is-visible');
	}
}

/**
 * Aplica o aro azul no botao recem-clicado, para a resposta ser IMEDIATA
 * (esperar o tique de 250ms deixaria um atraso perceptivel). Quem mantem o
 * estado honesto dali em diante e pollEstado()/syncAllActiveStates().
 */
function updateActiveState(btn, action) {
	btn.classList.toggle('is-active', isActionOpen(action));
}

function isActionOpen(action) {
	switch (action) {
		case 'status':
			return isRagIdleWindowOpen(StatusIdle, '.st-window');
		case 'inventory':
		case 'equip':
			return isRagIdleWindowOpen(MochilaIdle, '.mo-window');
		case 'skills':
			return isRagIdleWindowOpen(IdleSkills, '.is-window');
		case 'huntmap':
			return isRagIdleWindowOpen(HuntMap, '.hm-window');
		case 'config':
			return isRagIdleWindowOpen(IdleConfig, '.ic-window');
		case 'admin':
			return isRagIdleWindowOpen(AdminPanel, '.ap-window');
		case 'guild':
			return isHostVisible(Guild);
		case 'group':
			return isHostVisible(PartyFriends.getUI());
		default:
			// "menu" (ESC nao tem janela propria com estado persistente) e
			// os itens "em breve" caem aqui -- nunca acendem.
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
 * O tique do polling: ponto de skill + destaque dos itens.
 *
 * O destaque entrou aqui em 19/08/2026. Antes ele so era aplicado no CLIQUE
 * e quando a constelacao aparecia — entao fechar a janela pelo "X" dela (ou
 * pelo ESC, ou pelo dock) deixava o item aceso para sempre, mentindo sobre
 * uma janela ja fechada. E o defeito que o dono relatou. O estado agora e
 * DERIVADO da janela de verdade a cada tique, nunca lembrado do clique.
 */
function pollEstado() {
	syncSkillDot();
	syncAllActiveStates();
}

/**
 * Sincroniza o destaque de todo item a partir do estado REAL de cada janela.
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
