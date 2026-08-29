/**
 * UI/Components/TopMenuIdle/TopMenuIdle.js
 *
 * O MENU DA HUD, em DUAS PARTES (20/08/2026 — frente "menu em duas partes").
 * Gabarito de ORGANIZACAO: redesign/referencia-hud-origin.md (a leitura da
 * captura do Ragnarok Origin que o dono forneceu). Gabarito de ACABAMENTO: o
 * design system oficial e as janelas que este projeto ja refez — o
 * acabamento NUNCA imita o Origin.
 *
 *   ".tm-top"  — CLUSTER SUPERIOR DIREITO: fileira de CINCO essenciais
 *                (Personagem, Mochila, Skills, Caca, Correio) + a alca de
 *                recolher. E o que se usa toda hora jogando.
 *   ".tm-menu" — CANTO INFERIOR DIREITO: UM botao "Menu" (".tm-fab") que
 *                abre/fecha o LEQUE (".tm-fan") com os 11 secundarios.
 *                Fechado, o leque nao existe na tela — sobra so o botao.
 *
 * ─── RODADA 2 (20/08/2026): O LEQUE FICOU EM PE ─────────────────────────
 * Ele era uma FILEIRA HORIZONTAL de onze discos translucidos sem rotulo, e
 * reprovou: sobre o calcamento branco de Prontera aquilo lia como ruido, e
 * era inconsistente com o cluster de cima (mesmo componente, disco solido e
 * rotulado). O dono redefiniu a forma — duas colunas em pe, carga dividida
 * ao meio, uma linha dourada entre elas com um ornamento premium no topo — e
 * a secao 3 do gabarito foi reescrita com o pedido. Em pe sobra largura, e
 * por isso o ROTULO voltou, permanente, igual ao dos cinco de cima; a
 * aritmetica que o condenava na rodada 1 (11 rotulados = ~869px contra 587
 * de espaco util) so valia para UMA fileira horizontal.
 * Quem divide as colunas e distribuirColunas(), no JS, e nao o HTML: sem o
 * item de Admin (que so existe para a conta dona) sao 10 itens, e o corte
 * tem de virar 5/5 sozinho.
 *
 * O QUE MUDOU nesta rodada, e por que: ate ontem os 17 icones moravam TODOS
 * no canto superior direito — uma fileira de 5 e, colada abaixo dela, uma
 * grade de 6 colunas com 12. O gabarito (secao 1) diz que o superior e "uma
 * fileira, nao uma grade de tres linhas", e (secao 2) que o inferior direito
 * e "uma porta", nao um segundo cluster. Entao a grade inteira desceu para o
 * leque. A pele nao mudou em nada.
 *
 * ─── ONDE FOI PARAR CADA UM DOS 17 (nenhum sumiu sem destino) ────────────
 *   CLUSTER (7): Personagem, Mochila, Skills, Caca, Correio, MISSOES
 *                (entrou em 24/08/2026, D-551 — nao e um dos 17: e janela
 *                nova), Idle.
 *   LEQUE (10):  Guilda, Grupo, Admin, Loja, RO Shop, Troca, Leilao,
 *                Recompensas, Eventos, Passe.
 *   17 = 6 + 10 + 1, e o "1" e a FUSAO: "Config" e "Menu" eram dois icones
 *   de gaveta de ajuste e viraram um so (ver o bloco da fusao mais abaixo).
 *
 *   MUDOU EM 21/08/2026, a pedido do dono: o item fundido saiu do leque,
 *   subiu para o cluster e passou a se chamar "Idle" -- o nome do que ele
 *   abre. Ele e o painel que se mexe ENTRE uma sessao idle e outra (coleta,
 *   lista negra, pocao), nao um destino ocasional como Loja ou Leilao. O
 *   "data-action" continua "config" DE PROPOSITO: e a chave que o portao
 *   prova-clique-nao-vaza.ts ja mira, e renomear so trocaria o nome do mesmo
 *   destino em varios arquivos. Com isso o leque fica em 10 itens -- a
 *   divisao 5+5 que o dono desenhou.
 *
 * ─── FIACAO REAL (cada item chama o MESMO metodo publico que ja abre a
 * janela em outro lugar do fork — nenhum alias novo foi criado) ──────────
 *   - Personagem  -> StatusIdle.toggle()     (StatusIdle.js)
 *   - Mochila     -> MochilaIdle.toggle()    (MochilaIdle.js:429) — a janela
 *                 unificada (inventario + equipamento). A chave continua
 *                 "inventory": e o alvo que o gate de clique e os scripts de
 *                 foto ja miram.
 *   - Skills      -> IdleSkills.toggle()     (IdleSkills.js, mesmo metodo
 *                 que DockIdle.js:229 usa)
 *   - Caca        -> HuntMap.toggle()        (HuntMap.js:287) — MESMA janela
 *                 que "#HuntButtonIdle" abre; redundancia DECLARADA e pedida
 *                 pelo dono.
 *   - Correio     -> CorreioIdle.toggle()    — a caixa do SISTEMA
 *                 (rag-idle-master/servidor/caixa.ts, D-366). O toggle
 *                 tambem PEDE a caixa ao abrir (0x09e6).
 *   - Configuracoes -> IdleConfig.toggle()   (IdleConfig.js, mesmo metodo
 *                 que DockIdle.js:235 usava)
 *   - Guilda      -> Guild.toggle()          (Guild.js:404-418) — metodo
 *                 PUBLICO nativo. ATENCAO ao comportamento nativo: sem
 *                 guilda (!Session.hasGuild), Guild.toggle() NAO abre a
 *                 janela — chama Guild.promptCreateGuild(), exatamente como
 *                 o atalho de teclado nativo faz (Guild.js:420-423). Aceito
 *                 de proposito: e o unico caminho de entrada que existe.
 *   - Grupo       -> PartyFriends.toggle()   (PartyFriends.js:47-52) — proxy
 *                 PUBLICO do controller de versao (V0/V1), que delega pra
 *                 PartyFriendsCommon.js:132-138.
 *   - Admin       -> AdminPanel.toggle()     (AdminPanel.js:268), com a
 *                 MESMA trava de conta dona que AdminPanel.js:65/186 usa
 *                 (Session.AID === 2000000, ver isOwnerAccount()) — o item
 *                 e escondido client-side pra quem nao e a conta dona; o
 *                 servidor aplica a restricao de verdade.
 *
 * ─── A FUSAO "Config" + "Menu" -> "Configuracoes" (pedido do dono) ───────
 * Eram dois discos vizinhos, os dois com cara de ajuste, e o jogador tinha
 * de adivinhar qual era qual: "Config" abria a Configuracao idle
 * (IdleConfig) e "Menu" disparava a tecla ESC (Escape.js), que e a janela de
 * SISTEMA do cliente — audio, video, atalho, trocar personagem, fechar jogo.
 * O icone fundido abre a Configuracao idle: e a janela que o rotulo nomeia e
 * a que se usa jogando.
 * O QUE ISSO CUSTA, dito na cara: a janela de sistema perdeu a porta de
 * mouse e ficou so na TECLA ESC — que continua nativa e intocada (nenhum
 * arquivo de Escape.js foi tocado nesta rodada). Isso esta declarado como
 * pendencia [DONO] no relatorio da frente; se ele quiser a porta de mouse de
 * volta, o lugar barato e uma linha dentro da propria Configuracao idle.
 *
 * ─── EM BREVE (Loja, RO Shop, Troca, Leilao, Recompensas, Eventos, Passe):
 * a funcao ainda nao existe no jogo. Visual honesto (o DS manda dessaturar;
 * desde a rodada 2 a dessaturacao vale so pro MIOLO, e o aro dourado fica em
 * opacidade cheia — ver o CSS), "aria-disabled" pro leitor de tela, e o
 * clique responde com o toast proprio do componente (".tm-toast", ver
 * showToast()) — NENHUM pacote sai do cliente, NENHUMA janela falsa abre. A
 * lista inteira e o atributo "data-em-breve" no HTML, lido no clique.
 *
 * ─── ORDEM: dentro de cada parte, TODOS os funcionais primeiro. O cluster e
 * so funcional; o leque poe Guilda, Grupo, Admin e so depois
 * os "em breve" — nunca misturado, pra nao fazer o jogador procurar o que
 * funciona no meio do que ainda nao existe. Em duas colunas, a ordem de
 * leitura e a natural do portugues: desce a coluna da ESQUERDA inteira e so
 * entao desce a da DIREITA.
 *
 * ─── ESTADO ATIVO (aro azul-dourado, ".is-active"): DERIVADO da janela
 * estar aberta, a cada tique do polling — nunca lembrado do clique. Antes de
 * 19/08/2026 era lembrado, e por isso fechar a janela pelo "X" dela deixava
 * o aro aceso para sempre. Detecao de "esta aberta":
 *   - janelas RAGIDLE marcam ".xx-window.is-open" (mesmo formato de
 *     HuntMap/IdleConfig/IdleSkills/StatusIdle/MochilaIdle/AdminPanel, ver
 *     DockIdle.js:isRagIdleWindowOpen()).
 *   - Guilda/Grupo: janelas nativas escondem via display:none no proprio
 *     HOST (Guild.js usa this.ui.show()/.hide(), proxy jQuery-like sobre
 *     _host, GUIComponent.js:1322; PartyFriendsCommon.js:120-138 idem).
 *     MESMO helper isHostVisible() de DockIdle.js.
 *
 * ─── z-index / needFocus=false / pointer-events: mesmo contrato de
 * DockIdle.js/CombatCornerIdle.js — este componente nunca e uma janela,
 * entao nunca precisa vir pra frente (fica preso no z-index inicial 50,
 * GUIComponent.js:159) e nunca intercepta clique no mapa fora dos proprios
 * botoes (":host" pointer-events:none, cada botao reabre com auto).
 * O host continua PEQUENO (o tamanho da fileira de cima): quem desce pro
 * canto inferior e o ".tm-menu", com position:fixed na viewport. Foi
 * deliberado nao esticar o host pra tela toda — camada invisivel sobre o
 * mundo inteiro e exatamente a familia de defeito que o gate de clique
 * (rag-idle-master/scripts/prova-clique-nao-vaza.ts) existe pra pegar.
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
import LFGIdle from 'UI/Components/LFGIdle/LFGIdle.js'; // RAGIDLE: Procurar Grupo (D-634)
import SkillList from 'UI/Components/SkillList/SkillList.js';
import StatusIdle from 'UI/Components/StatusIdle/StatusIdle.js';
import MochilaIdle from 'UI/Components/MochilaIdle/MochilaIdle.js';
import HuntMap from 'UI/Components/HuntMap/HuntMap.js';
import CorreioIdle from 'UI/Components/CorreioIdle/CorreioIdle.js';
import HuntAnalyzer from 'UI/Components/HuntAnalyzer/HuntAnalyzer.js';
import MissoesIdle from 'UI/Components/MissoesIdle/MissoesIdle.js';
import PasseIdle from 'UI/Components/PasseIdle/PasseIdle.js';
import AdminPanel from 'UI/Components/AdminPanel/AdminPanel.js';
import RiIcones from 'UI/ri-icones.js';
import htmlText from './TopMenuIdle.html?raw';
import cssText from './TopMenuIdle.css?raw';

/**
 * Mesma constante de conta dona que AdminPanel.js:65 -- copia local (nao
 * exportada de la, e o instrucional pede pra nao tocar em AdminPanel.js).
 */
const OWNER_AID = 2000000;

/**
 * Mesmo intervalo de polling leve que DockIdle.js/BasicInfoIdle.js.
 */
const POLL_INTERVAL_MS = 250;

/**
 * Quanto tempo o toast "Em breve" fica visivel antes de sumir sozinho.
 */
const TOAST_DURATION_MS = 1500;

/**
 * Quanto o leque leva pra sumir depois de fechar: a transicao de saida
 * (--dur-fast, 160ms no DS) mais uma folga. Passado esse tempo o ".tm-fan"
 * volta a display:none e some do layout. Com "prefers-reduced-motion" nao ha
 * transicao nenhuma e este numero vira zero (ver aplicarEstadoDoLeque()).
 */
const LEQUE_SAIDA_MS = 220;

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
 * Fora do sistema de foco/z-index (mesmo motivo de DockIdle.js).
 */
TopMenuIdle.needFocus = false;

/**
 * @var {Preferences} estado recolhido/expandido do CLUSTER de cima.
 *
 * Versao 2.0 (a chave existe desde D-343 na 1.0): o SIGNIFICADO do booleano
 * mudou duas vezes — era "constelacao inteira recolhida", virou "nivel 2
 * fechado" e agora e "cluster de 5 recolhido". Como o valor salvo de uma
 * sessao antiga descreveria outra coisa (um jogador que fechou o nivel 2
 * ontem acharia os 5 essenciais sumidos hoje), a versao SOBE e o
 * Preferences descarta o valor antigo. O leque NAO entra aqui de proposito:
 * ele e uma porta, e porta comeca fechada toda sessao (gabarito secao 2).
 */
const _preferences = Preferences.get(
	'TopMenuIdle',
	{
		collapsed: false
	},
	2.0
);

/**
 * @var {boolean} leque aberto? Estado de sessao, nao persistido — ver acima.
 */
let _lequeAberto = false;

/**
 * @var {number|null} setTimeout que desmonta o leque no fim da animacao.
 */
let _lequeTimer = null;

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
 * O usuario pediu menos movimento? Lido na hora (e nao guardado) porque a
 * preferencia do sistema pode mudar com o jogo aberto. E o CSS que decide o
 * visual; aqui isto so serve pra nao ESPERAR uma animacao que nao vai rodar.
 */
function movimentoReduzido() {
	return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
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

	const fab = root.querySelector('.tm-fab');
	if (fab) {
		fab.addEventListener('click', onClickFab);
	}
};

/**
 * Sincroniza tudo assim que o menu aparece (cobre o caso de o jogador ja ter
 * aberto uma janela por outro caminho antes dele existir), aplica o estado
 * recolhido salvo, deixa o leque fechado e liga o polling leve.
 */
TopMenuIdle.onAppend = function onAppend() {
	applyCollapsedState();

	// Admin: mesma trava de conta dona de sempre -- so quem e a conta dona ve
	// o item; qualquer outra conta nunca ve nem consegue clicar. Precisa vir
	// ANTES de distribuirColunas() e de escalonarLeque(), que contam so os
	// itens visiveis.
	const root = _root();
	const adminBtn = root.querySelector('.tm-item-admin');
	if (adminBtn) {
		adminBtn.style.display = isOwnerAccount() ? '' : 'none';
	}

	distribuirColunas();
	distribuirFileiras();

	_lequeAberto = false;
	aplicarEstadoDoLeque(true);

	syncAllActiveStates();
	syncSkillDot();
	syncCorreioDot();
	syncToggleDot();
	startPolling();
	ligarFechamentoExterno();
};

/**
 * Desliga o polling, os ouvintes globais de fechar a gaveta e qualquer
 * temporizador pendente quando o componente sai de cena (troca de mapa) -
 * mesmo cuidado de DockIdle.js.
 */
TopMenuIdle.onRemove = function onRemove() {
	stopPolling();
	desligarFechamentoExterno();
	clearToastTimer();
	if (_lequeTimer != null) {
		clearTimeout(_lequeTimer);
		_lequeTimer = null;
	}
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
 *
 * TODO data-action daqui tem "case" abaixo, e todo "case" abre algo de
 * verdade. Isto e regra do projeto, nao zelo: ja houve botao com
 * "data-action" e "title" sem nenhum "case" no switch, e a Mochila quase
 * ficou inalcancavel. Quem somar um item soma o case junto — e clica nele.
 */
function onClickAction(e) {
	e.stopImmediatePropagation();
	const btn = e.currentTarget;

	if (btn.dataset.emBreve) {
		showToast();
		// Nao fecha o leque: nada abriu, entao nao ha nada de que sair da
		// frente -- e o jogador costuma clicar em mais de um "em breve"
		// seguido, olhando o que vem por ai.
		return;
	}

	const action = btn.dataset.action;

	switch (action) {
		case 'status':
			StatusIdle.toggle();
			break;
		case 'inventory':
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
		case 'correio':
			/* CorreioIdle.toggle() tambem PEDE a caixa ao abrir (0x09e6): a
			   lista so existe no cliente depois que o servidor a manda. */
			CorreioIdle.toggle();
			break;
		case 'missoes':
			/* MissoesIdle.toggle() tambem PEDE o estado ao abrir (0x0fec):
			   quem decide bloqueada/disponivel/concluida e o servidor. */
			MissoesIdle.toggle();
			break;
		case 'config':
			/* "Configuracoes" = a fusao de Config + Menu (ver cabecalho). */
			IdleConfig.toggle();
			break;
		case 'analyzer':
			/* A janela nao pede nada ao servidor ao abrir: o registro ja vem
			   sendo alimentado desde o primeiro abate da sessao, esteja ela
			   aberta ou fechada. Abrir e so passar a desenhar. */
			HuntAnalyzer.toggle();
			break;
		case 'guild':
			Guild.toggle();
			break;
		case 'group':
			PartyFriends.toggle();
			break;
		// O LFG e uma janela SEPARADA da de party (D-634): a nativa mostra
		// quem ja esta no grupo, esta procura grupo para entrar.
		case 'lfg':
			LFGIdle.toggle();
			break;
		case 'admin':
			if (!isOwnerAccount()) {
				return;
			}
			AdminPanel.toggle();
			break;
		/* O Passe saiu de "em breve" em D-813. Ele PEDE o estado ao abrir
		   (0x0fe4): preco, vencimento e o que cada dia entrega sao do
		   servidor — a janela so desenha. */
		case 'passe':
			PasseIdle.toggle();
			break;
		default:
			return;
	}

	// Escolheu no leque? O leque sai da frente. Ele e uma gaveta: abriu,
	// escolheu, fechou -- e a janela que acabou de abrir e que precisa da
	// tela agora. So vale pro leque; o cluster de cima nunca se fecha
	// sozinho.
	if (_lequeAberto && btn.closest('.tm-fan')) {
		fecharLeque();
	}

	updateActiveState(btn, action);
}

/**
 * Clique na alca: recolhe/traz de volta os CINCO do cluster de cima e SALVA
 * a preferencia (mesmo padrao de BasicInfoIdle.js:savePosition()). Aplica na
 * hora, sem esperar o tique de 250ms.
 */
function onClickToggle(e) {
	e.stopImmediatePropagation();
	_preferences.collapsed = !_preferences.collapsed;
	_preferences.save();
	applyCollapsedState();
	syncToggleDot();
}

/**
 * Reflete "_preferences.collapsed" no DOM: os 5 itens do cluster somem
 * (display:none, ver CSS) e a alca gira pra apontar pro lado contrario. A
 * alca NUNCA e escondida aqui -- ela e o unico caminho de volta.
 */
function applyCollapsedState() {
	const root = _root();
	const top = root.querySelector('.tm-top');
	const toggle = root.querySelector('.tm-toggle');
	if (!top || !toggle) {
		return;
	}

	const collapsed = !!_preferences.collapsed;

	/*
	 * GUARDA A ALTURA ABERTA antes de recolher (26/08/2026, pedido do dono: a
	 * alca "esta subindo" quando minimiza).
	 *
	 * Recolhido, as duas fileiras somem e a grade encolhe para os 28px da alca —
	 * entao ela saltava de y=89 para y=30, quase 60px para cima. O glifo sempre
	 * esteve centrado DENTRO do disco (medido: deslocamento 0 nos dois estados);
	 * quem se mexia era o disco inteiro.
	 *
	 * A altura e MEDIDA e nao cravada porque o numero de itens muda — este
	 * cluster ja foi de 5 a 8 em tres frentes. Guardar so quando ABERTO e o que
	 * importa: no estado recolhido a medida seria a da propria alca, e a cada
	 * ciclo de recolher/abrir o valor encolheria mais um pouco.
	 */
	if (!collapsed) {
		const altura = Math.round(top.getBoundingClientRect().height);
		if (altura > 0) {
			top.style.setProperty('--tm-altura', `${altura}px`);
		}
	}
	top.classList.toggle('is-collapsed', collapsed);
	toggle.classList.toggle('is-collapsed', collapsed);
	toggle.setAttribute('aria-expanded', String(!collapsed));

	const label = collapsed ? 'Abrir menu' : 'Recolher menu';
	toggle.title = label;
	toggle.setAttribute('aria-label', label);
}

/**
 * ─── FECHAR A GAVETA POR CLIQUE FORA E POR ESC ───────────────────────────
 *
 * O leque e uma GAVETA: o gabarito diz que o expandido "aparece e some", e um
 * bloco de 198x454 plantado sobre a cena enquanto o jogador anda nao e "some".
 * Ate a rodada 2 so o proprio botao Menu fechava, e isso era pouco.
 *
 * POR QUE UM OUVINTE GLOBAL AQUI NAO REPETE O BUG DE VAZAMENTO DE CLIQUE (o
 * conserto de 19/08, que ate deixou um gate proprio): aquele defeito era a UI
 * deixando o evento CHEGAR AO MUNDO por um caminho errado — direcao UI -> jogo.
 * Este ouvinte anda na direcao oposta: ele so OBSERVA. Nao chama
 * preventDefault, nao chama stopPropagation, nao chama
 * stopImmediatePropagation e nao reencaminha nada. O evento segue exatamente
 * o mesmo caminho que seguiria se este codigo nao existisse — e por isso o
 * clique no chao continua ANDANDO com o personagem enquanto a gaveta se
 * fecha. As duas coisas na mesma medicao, e e assim que a prova confere.
 *
 * "composedPath()" e nao "event.target": alvo de evento que nasce dentro de
 * Shadow DOM chega RETARGETADO (vira o host), entao "target" nao sabe dizer
 * se o clique caiu num item do leque ou no disco de outro componente. O
 * caminho composto atravessa as fronteiras de sombra e e a mesma tecnica que
 * a guarda central do projeto usa.
 *
 * "pointerdown" na fase de CAPTURA: captura e a primeira fase a rodar, entao
 * nenhum outro ouvinte consegue esconder o evento de nos parando a
 * propagacao antes. E "pointerdown" (e nao "click") cobre mouse e toque com
 * um ouvinte so, e fecha no comeco do gesto — que e quando o jogador ja
 * decidiu.
 *
 * ESC: fecha a gaveta e mais nada. O ESC nativo (Escape.js, a janela de
 * sistema) NAO e consumido de proposito — alem da regra de nao consumir, e
 * ele que carrega a regra de "morto nao abre menu nenhum"; se este ouvinte
 * comesse a tecla, essa regra passaria a depender daqui.
 */
function ligarFechamentoExterno() {
	desligarFechamentoExterno();
	window.addEventListener('pointerdown', onPointerDownGlobal, true);
	window.addEventListener('keydown', onKeyDownGlobal, true);
}

function desligarFechamentoExterno() {
	window.removeEventListener('pointerdown', onPointerDownGlobal, true);
	window.removeEventListener('keydown', onKeyDownGlobal, true);
}

/**
 * O clique caiu DENTRO do canto do menu (o botao Menu ou o leque)? Se caiu,
 * quem decide o que acontece e o proprio botao; se caiu fora, a gaveta sai da
 * frente.
 */
function onPointerDownGlobal(e) {
	if (!_lequeAberto) {
		return;
	}

	// Sem composedPath nao da pra saber se o clique caiu dentro do proprio
	// menu, e fechar no escuro faria o botao Menu se auto-cancelar (fecha no
	// pointerdown, reabre no click). Na duvida, nao fecha: o botao continua
	// sendo o caminho garantido.
	if (typeof e.composedPath !== 'function') {
		return;
	}

	const caminho = e.composedPath();
	for (let i = 0; i < caminho.length; i++) {
		const no = caminho[i];
		// Window/Document/ShadowRoot nao tem classList: so elemento interessa.
		if (no && no.classList && no.classList.contains('tm-menu')) {
			return;
		}
	}

	fecharLeque();
}

function onKeyDownGlobal(e) {
	if (!_lequeAberto) {
		return;
	}
	if (e.key === 'Escape' || e.key === 'Esc') {
		fecharLeque();
	}
}

/**
 * Clique no botao Menu: abre ou fecha o leque.
 */
function onClickFab(e) {
	e.stopImmediatePropagation();
	if (_lequeAberto) {
		fecharLeque();
	} else {
		abrirLeque();
	}
}

function abrirLeque() {
	_lequeAberto = true;
	aplicarEstadoDoLeque(false);
}

function fecharLeque() {
	_lequeAberto = false;
	aplicarEstadoDoLeque(false);
	// O toast mora fora do leque, mas se ele estiver de pe quando a gaveta
	// fecha, some junto: ele so faz sentido no contexto do que foi clicado.
	hideToastNow();
}

/**
 * Poe o leque no estado de "_lequeAberto".
 *
 * A dancinha das duas classes existe por uma limitacao real do navegador:
 * nada anima saindo de "display:none". Entao ABRIR e (1) montar
 * (".is-mounted" -> display:flex), (2) forcar um reflow lendo offsetWidth,
 * (3) so entao ligar ".is-open", que e o que a transicao persegue. FECHAR e
 * o contrario: tira ".is-open", espera a transicao e so ai desmonta.
 *
 * Desmontar de verdade importa: enquanto o leque fica montado ele tem CAIXA
 * na tela, e caixa invisivel sobre o mundo e a familia de defeito que o gate
 * de clique existe pra pegar (ver o cabecalho do CSS).
 *
 * @param {boolean} imediato pula a animacao (usado no onAppend, quando o
 *        leque nasce fechado e nao ha nada a animar).
 */
function aplicarEstadoDoLeque(imediato) {
	const root = _root();
	const fan = root.querySelector('.tm-fan');
	const fab = root.querySelector('.tm-fab');
	if (!fan || !fab) {
		return;
	}

	if (_lequeTimer != null) {
		clearTimeout(_lequeTimer);
		_lequeTimer = null;
	}

	fab.classList.toggle('is-open', _lequeAberto);
	fab.setAttribute('aria-expanded', String(_lequeAberto));
	fab.title = _lequeAberto ? 'Fechar menu' : 'Menu';
	fab.setAttribute('aria-label', fab.title);

	if (_lequeAberto) {
		escalonarLeque(fan);
		fan.classList.add('is-mounted');
		// Leitura que forca o reflow -- sem ela o navegador junta "montar" e
		// "abrir" no mesmo quadro e a transicao nao acontece.
		void fan.offsetWidth;
		fan.classList.add('is-open');
		return;
	}

	fan.classList.remove('is-open');

	const espera = imediato || movimentoReduzido() ? 0 : LEQUE_SAIDA_MS;
	if (espera === 0) {
		fan.classList.remove('is-mounted');
		return;
	}
	_lequeTimer = setTimeout(() => {
		fan.classList.remove('is-mounted');
		_lequeTimer = null;
	}, espera);
}

/**
 * Reparte os itens do leque nas DUAS COLUNAS, com a carga dividida ao meio.
 *
 * Por que isto e JS e nao HTML fixo: o item de Admin so existe para a conta
 * dona (ver onAppend()). Com ele sao 11 itens, sem ele sao 10 — e "10 vira 5
 * e 5" e literalmente o que o dono pediu. Um corte cravado no HTML acertaria
 * um dos dois casos e erraria o outro, deixando 6/4 para todo jogador que
 * nao e o dono.
 *
 * A COLUNA DA ESQUERDA E QUE LEVA O ITEM A MAIS quando o total e impar
 * (Math.ceil). Ela e a primeira da ordem de leitura, e coluna que comeca a
 * leitura nunca deve ser a mais curta: uma primeira coluna curta seguida de
 * uma longa se le como erro de montagem, enquanto o contrario se le como uma
 * lista que acabou. E a mesma regra de balanceamento de colunas de texto.
 *
 * O item ESCONDIDO (Admin, fora da conta dona) continua no DOM e vai junto
 * com os vizinhos, mas NAO conta para achar o meio -- senao a coluna da
 * esquerda ficaria com um buraco invisivel de um item.
 *
 * A ORDEM CANONICA e a ordem do documento (coluna A e depois a B), e ela
 * sobrevive a cada passagem: cada item e reinserido nessa mesma ordem, entao
 * chamar isto duas vezes da o mesmo resultado.
 */
/**
 * Quantas COLUNAS o cluster de cima tem — ou seja, onde ele quebra em duas
 * fileiras (26/08/2026, pedido do dono: "esta ficando muito grande essa
 * fileira, divida ela em 2").
 *
 * A conta e a metade dos itens VISIVEIS, arredondada para cima, e ela mora no
 * JS pelo mesmo motivo que a divisao das colunas do leque: o numero de itens
 * MUDA. Este cluster ja foi de 5 para 6, para 7 e para 8 em tres frentes
 * diferentes, e um "4" cravado no CSS acertaria hoje e erraria no proximo
 * botao que alguem somar.
 *
 * Item escondido nao entra na conta: se entrasse, uma fileira nasceria com
 * buraco. O piso e 1 porque zero coluna nao existe em grade.
 */
function distribuirFileiras() {
	const root = _root();
	if (!root) {
		return;
	}
	const topo = root.querySelector('.tm-top');
	if (!topo) {
		return;
	}
	const visiveis = [...topo.querySelectorAll('.tm-item')].filter(
		item => item.style.display !== 'none'
	);
	topo.style.setProperty('--tm-colunas', String(Math.max(1, Math.ceil(visiveis.length / 2))));
}

function distribuirColunas() {
	const root = _root();
	const fan = root.querySelector('.tm-fan');
	const colA = root.querySelector('.tm-col--a');
	const colB = root.querySelector('.tm-col--b');
	if (!fan || !colA || !colB) {
		return;
	}

	const itens = Array.prototype.slice.call(fan.querySelectorAll('.tm-item'));
	const visiveis = itens.filter(item => item.style.display !== 'none').length;
	const naEsquerda = Math.ceil(visiveis / 2);

	let contados = 0;
	itens.forEach(item => {
		const destino = contados < naEsquerda ? colA : colB;
		destino.appendChild(item);
		if (item.style.display !== 'none') {
			contados++;
		}
	});
}

/**
 * Numera os itens VISIVEIS do leque em "--i", que o CSS usa como atraso de
 * entrada (26ms x indice). E o que faz o leque entrar na ordem de leitura em
 * vez de piscar como um bloco.
 *
 * Conta so os visiveis de proposito: o item de Admin some pra quem nao e a
 * conta dona, e um indice "furado" deixaria um buraco de 26ms no meio da
 * animacao de todo mundo que nao e o dono.
 */
function escalonarLeque(fan) {
	/*
	 * A onda sobe DE BAIXO PARA CIMA (24/08/2026, pedido do dono: "ao abrir o
	 * botao deve fazer um efeito subindo os botoes").
	 *
	 * Antes o "--i" seguia a ORDEM DE LEITURA -- descia a coluna da esquerda
	 * inteira e depois a da direita. Com o leque em pe isso briga com o gesto:
	 * o disco do TOPO entrava primeiro e o de baixo por ultimo, o que le como
	 * algo CAINDO do alto, e nao brotando do botao. Agora as duas colunas sao
	 * indexadas a partir da BASE, entao os discos vizinhos do botao entram
	 * juntos e a onda sobe pelas duas ao mesmo tempo -- que e o que o olho
	 * espera de uma gaveta que se abre para cima.
	 *
	 * Item escondido (o Admin, fora da conta dona) NAO consome indice: com ele
	 * na conta sobraria um degrau vazio na onda.
	 */
	fan.querySelectorAll('.tm-col').forEach(coluna => {
		const visiveis = [...coluna.querySelectorAll('.tm-item')].filter(
			item => item.style.display !== 'none'
		);
		visiveis.forEach((item, ordem) => {
			item.style.setProperty('--i', String(visiveis.length - 1 - ordem));
		});
	});
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
 * Apaga o toast "Em breve" na hora, sem esperar o TOAST_DURATION_MS.
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
 * Aplica o aro no botao recem-clicado, para a resposta ser IMEDIATA
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
			return isRagIdleWindowOpen(MochilaIdle, '.mo-window');
		case 'skills':
			return isRagIdleWindowOpen(IdleSkills, '.is-window');
		case 'huntmap':
			return isRagIdleWindowOpen(HuntMap, '.hm-window');
		case 'correio':
			return isRagIdleWindowOpen(CorreioIdle, '.co-window');
		/*
		 * MISSOES (D-551) estava no switch de ABRIR e faltava neste, o de
		 * ESTADO -- achado ao mesclar, em 25/08/2026. Sem o caso, o botao caia
		 * no `default` e NUNCA acendia o aro, mesmo com a janela aberta: o
		 * unico item funcional do cluster sem realimentacao visual. A janela
		 * marca `.mi-window.is-open` no padrao RAGIDLE de sempre
		 * (MissoesIdle.js:146-153), entao a linha e identica as vizinhas.
		 */
		case 'missoes':
			return isRagIdleWindowOpen(MissoesIdle, '.mi-window');
		case 'config':
			return isRagIdleWindowOpen(IdleConfig, '.ic-window');
		case 'analyzer':
			return isRagIdleWindowOpen(HuntAnalyzer, '.ha-window');
		case 'admin':
			return isRagIdleWindowOpen(AdminPanel, '.ap-window');
		case 'guild':
			return isHostVisible(Guild);
		case 'group':
			return isHostVisible(PartyFriends.getUI());
		/*
		 * LFG (D-634): ele e janela RAGIDLE, e NAO nativa -- entao le
		 * ".lfg-window.is-open", como as vizinhas de cima.
		 *
		 * Ele nasceu com `isHostVisible`, copiado dos dois casos ACIMA
		 * (guild/group), e isso o deixava aceso o jogo inteiro: `GUIComponent`
		 * nunca escreve `display:none` no `_host` por conta propria, entao
		 * `_host.style.display !== 'none'` e sempre verdadeiro e o aro nunca
		 * apagava. E o MESMO defeito que o comentario de `missoes` acima
		 * registra, pelo avesso: la o caso faltava e nunca ACENDIA; aqui o
		 * caso existia com o helper errado e nunca APAGAVA. A licao e a
		 * mesma -- o helper se escolhe pela janela, nao pelo vizinho de linha.
		 */
		case 'lfg':
			return isRagIdleWindowOpen(LFGIdle, '.lfg-window');
		default:
			// os itens "em breve" caem aqui -- nunca acendem.
			return false;
	}
}

/**
 * Janelas RAGIDLE marcam "is-open" na classe do elemento ".xx-window" -
 * mesmo formato de DockIdle.js:isRagIdleWindowOpen().
 */
function isRagIdleWindowOpen(component, selector) {
	const root = component.getRoot();
	const win = root && root.querySelector(selector);
	return !!(win && win.classList.contains('is-open'));
}

/**
 * Janelas nativas (Guild/PartyFriends) escondem via display:none no proprio
 * HOST - mesmo helper de DockIdle.js:isHostVisible().
 */
function isHostVisible(component) {
	return !!(component && component._host && component._host.style.display !== 'none');
}

/**
 * O tique do polling: pontos de notificacao + destaque dos itens.
 */
function pollEstado() {
	syncSkillDot();
	syncCorreioDot();
	syncToggleDot();
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
 * Ponto de "ha mensagem por ler" no icone de Correio.
 *
 * A fonte e CorreioIdle.temNaoLidas() -- que conta o "Isread" da lista que o
 * SERVIDOR mandou (0x0ac2) e, enquanto essa lista nunca chegou nesta sessao,
 * cai no proprio ZC_RODEX_ICON. Nenhuma das duas e adivinhada, e nenhuma
 * exige fisgar pacote -- hookPacket SOBRESCREVE (NetworkManager.js:200-210)
 * e trocaria o handler nativo do correio em silencio.
 *
 * Mesma receita ".ri-dot" do ponto de skill acima, de proposito: o design
 * system tem UM indicador de notificacao, e este e ele.
 */
function syncCorreioDot() {
	const root = _root();
	const dot = root.querySelector('.tm-item[data-action="correio"] .ri-dot');
	if (!dot) {
		return;
	}

	const temNaoLidas = CorreioIdle.temNaoLidas();
	dot.style.display = temNaoLidas ? '' : 'none';

	// O numero exato so existe quando a lista ja chegou; sem ela o servidor so
	// disse QUE ha, nao QUANTAS. O titulo diz a verdade nos dois casos.
	const btn = dot.closest('.tm-item');
	if (btn) {
		const quantas = CorreioIdle.quantasNaoLidas();
		if (!temNaoLidas) {
			btn.title = 'Correio';
		} else if (quantas == null) {
			btn.title = 'Correio — você tem mensagens por ler';
		} else {
			btn.title = `Correio — ${quantas} por ler`;
		}
	}
}

/**
 * O aviso na ALCA -- e a razao de o Correio nao ter regredido ao ganhar um
 * botao que o esconde.
 *
 * Quando o jogador recolhe o cluster, os 5 discos somem e com eles sumiriam
 * os dois pontos de notificacao (correio por ler, ponto de skill a gastar).
 * Um aviso que some porque o jogador arrumou a tela nao e um aviso. Entao,
 * recolhido, o ponto migra pra alca -- que nunca some. Expandido, a alca nao
 * mostra ponto nenhum: quem avisa sao os proprios discos, e dois pontos
 * dizendo a mesma coisa a 20px um do outro so sujam.
 */
function syncToggleDot() {
	const root = _root();
	const dot = root.querySelector('.tm-toggle .ri-dot');
	if (!dot) {
		return;
	}

	if (!_preferences.collapsed) {
		dot.style.display = 'none';
		return;
	}

	// Le o estado JA CALCULADO dos pontos dos itens, em vez de refazer as
	// duas consultas: assim os tres nunca podem discordar entre si.
	const pontos = root.querySelectorAll('.tm-top .tm-item .ri-dot');
	let algum = false;
	pontos.forEach(p => {
		if (p.style.display !== 'none') {
			algum = true;
		}
	});

	dot.style.display = algum ? '' : 'none';
}

/**
 * Create component and export it
 */
export default UIManager.addComponent(TopMenuIdle);
