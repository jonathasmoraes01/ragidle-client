/**
 * UI/atalhos-da-ui-nova.js
 *
 * OS ATALHOS DE TECLADO ABREM A UI NOVA (27/08/2026).
 *
 * Queixa do dono: "Alt+A esta abrindo a janela de status com a UI antiga".
 * Todo atalho de janela (Alt+E, Alt+A, Alt+S, Alt+Q, Alt+U, Alt+V) apontava
 * para o componente NATIVO — as janelas que o fork esconde desde a chegada
 * das *Idle. O atalho era a unica porta que ainda dava nelas.
 *
 * ── POR QUE DELEGAR NO DESTINO, E NAO TROCAR A TABELA ────────────────────
 * A tabela de atalhos (`Preferences/ShortCutControls.js`) e uma Preferences
 * PERSISTIDA: o objeto inteiro — nome do componente incluso — mora no
 * localStorage de quem ja jogou, e o que esta salvo VENCE o default do
 * codigo (`Preferences.get('ShortCutControls', ..., 1.2)`). Trocar
 * `component: 'WinStats'` por `'StatusIdle'` no fonte so valeria para
 * jogador novo; subir a versao da Preferences para forcar a troca APAGARIA
 * os rebinds que o jogador fez na janela de atalhos. Delegar no COMPONENTE
 * que a tabela ja nomeia atravessa os dois mundos: o nome salvo continua
 * valido, o rebind continua valido, e o gesto cai na janela nova.
 *
 * `UIManager.getComponent(nome)` resolve o alias de versao e devolve o MESMO
 * objeto que `BattleMode.process` vai chamar (UIManager.js:188-198) — e
 * LANCA para nome desconhecido, entao religar cedo demais falha alto em vez
 * de instalar em objeto errado. Por isso quem chama e o MapEngine, depois de
 * todos os prepare().
 *
 * O mapa gesto-a-gesto (os `cmd` sao os da tabela: TOGGLE em todos, EXTEND
 * so no BasicInfo):
 *
 *   Alt+E  Inventory  -> MochilaIdle   (a janela unificada)
 *   Alt+Q  Equipment  -> MochilaIdle   (mesma janela — equipamento mora nela)
 *   Alt+A  WinStats   -> StatusIdle
 *   Alt+S  SkillList  -> IdleSkills
 *   Alt+U  Quest      -> MissoesIdle
 *   Alt+V  BasicInfo  -> BasicInfoIdle.alternarCompacto (o EXTEND de la era
 *                        exatamente este gesto: expandir/recolher o painel)
 *
 * O que fica NO NATIVO de proposito: PartyFriends (Alt+Z/Alt+H), Guild
 * (Alt+G), carrinho, pet, homunculo, mercenario, banco, cla, conquistas,
 * emoticons, mapa-mundi — sao as janelas que o fork USA como estao; o menu
 * superior abre as mesmas.
 */

import UIManager from 'UI/UIManager.js';
import BasicInfo from 'UI/Components/BasicInfo/BasicInfo.js';
import MochilaIdle from 'UI/Components/MochilaIdle/MochilaIdle.js';
import StatusIdle from 'UI/Components/StatusIdle/StatusIdle.js';
import IdleSkills from 'UI/Components/IdleSkills/IdleSkills.js';
import MissoesIdle from 'UI/Components/MissoesIdle/MissoesIdle.js';
import BasicInfoIdle from 'UI/Components/BasicInfoIdle/BasicInfoIdle.js';

/** nome na tabela de atalhos -> o que o gesto abre hoje. */
const DESTINOS = {
	Inventory: () => MochilaIdle.toggle(),
	Equipment: () => MochilaIdle.toggle(),
	WinStats: () => StatusIdle.toggle(),
	SkillList: () => IdleSkills.toggle(),
	Quest: () => MissoesIdle.toggle(),
	BasicInfo: () => BasicInfoIdle.alternarCompacto()
};

/**
 * Religa o `onShortCut` dos seis nativos para a UI nova. Chamar DEPOIS de
 * todo `prepare()` do MapEngine — `getComponent` lanca para componente que
 * ainda nao existe, e falhar alto aqui e melhor que atalho mudo.
 */
/**
 * O religamento ESPECIFICO do BasicInfo, chamado de novo DEPOIS de
 * `BasicInfo.selectUIVersionWithJob(...)` (MapEngine.js, na entrada do mapa).
 *
 * MEDIDO em 27/08: o BasicInfo e o unico dos seis cuja versao troca DE NOVO
 * apos o prepare — a selecao POR CLASSE substitui o componente inteiro e
 * re-registra o alias, entao o objeto religado no boot morre substituido e a
 * sonda encontrava o `onShortCut` nativo de volta. Os outros cinco nao tem
 * selecao por classe e o religamento do boot basta.
 */
export function religarAtalhoDoBasicInfo() {
	try {
		UIManager.getComponent('BasicInfo').onShortCut = function onShortCutDaUiNova() {
			BasicInfoIdle.alternarCompacto();
		};
	} catch {
		console.warn(`[atalhos] 'BasicInfo' nao registrado; Alt+V segue mudo`);
	}
}

export function religarAtalhosParaUiNova() {
	/*
	 * O BasicInfo versionado so ganha o ALIAS de `getComponent('BasicInfo')`
	 * quando `selectUIVersion()` roda (UIVersionManager.js:66 grava
	 * `_UIAliases[publicName]`) — e `getUI()` NAO seleciona: ele so devolve
	 * `_selectedUI`, que e undefined ate la (UIVersionManager.js:92-94; a
	 * primeira versao desta funcao chamava getUI() achando que selecionava, e
	 * a sonda mostrou o alias ainda ausente). Neste packetver o MapEngine
	 * pula o prepare do BasicInfo (`PACKETVER.value < 20200520`), entao ate
	 * aqui ninguem selecionou. Selecionar e idempotente e nao apenda nada.
	 *
	 * E a licao MEDIDA da primeira sonda: sem resolver isto,
	 * `getComponent('BasicInfo')` lancava DENTRO do prepare do MapEngine e o
	 * mapa subia pela metade — sem TopMenu, sem StatusIdle, sem HuntButton.
	 */
	if (!BasicInfo.getUI()) {
		BasicInfo.selectUIVersion();
	}

	for (const [nome, abrir] of Object.entries(DESTINOS)) {
		let componente;
		try {
			componente = UIManager.getComponent(nome);
		} catch {
			/*
			 * Componente que este build nao registra (packetver/feature): o
			 * atalho fica como estava — mudo — em vez de derrubar o boot do
			 * mapa inteiro. Foi exatamente o modo de falha da primeira versao
			 * desta funcao, e "falhar alto" no MEIO do prepare do MapEngine
			 * nao e alto: e um mapa pela metade sem nenhuma janela nova.
			 */
			console.warn(`[atalhos] '${nome}' nao registrado neste build; atalho segue no nativo (mudo)`);
			continue;
		}
		componente.onShortCut = function onShortCutDaUiNova() {
			// O `cmd` e ignorado de proposito: cada um destes so tem UM gesto
			// na tabela (TOGGLE — e EXTEND no BasicInfo, que ja e o proprio
			// destino). Um cmd novo no futuro cai aqui e abre a janela nova,
			// que e o comportamento menos surpreendente.
			abrir();
		};
	}
}
