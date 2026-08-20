/**
 * UI/Components/HuntButtonIdle/HuntButtonIdle.js
 *
 * "Botao de caca contextual" — pedido do dono, 19/08/2026: um unico botao
 * fixo logo ABAIXO do minimapa (ver HuntButtonIdle.css pro numero exato de
 * respiro, medido com getBoundingClientRect contra #MiniMapV2) que muda de
 * rotulo SOZINHO conforme o jogador troca de mapa:
 *   - Na cidade                    -> "Caçar"
 *   - Fora da cidade (mapa de caça) -> "Retornar para Prontera"
 *
 * Fonte de "estou na cidade": IdleConfig.contexto.ehCidade — o MESMO sinal
 * que o botao preto da Config idle ja usa pra se avisar (D-355,
 * IdleConfig.js:269-288, "O sinal vem de contexto.ehCidade (mapa sem
 * populacao de mobs)"). E pedido ao servidor a CADA troca de mapa por
 * IdleConfig.sondarMapa() (Engine/MapEngine.js, dentro de onMapChange, logo
 * apos IdleConfig.append()) — este arquivo NAO pede de novo, so LE o
 * resultado. Lido por polling de 250ms (mesma cadencia e mesma tecnica de
 * DockIdle.js/TopMenuIdle.js) porque IdleConfig nao expoe nenhum evento de
 * "contexto mudou", so a propriedade publica.
 *
 * Acao de cada rotulo:
 *   - "Caçar" abre a janela Mapa de Caça (HuntMap.toggle(), MESMO metodo
 *     publico que o item "Caça" do DockIdle ja usa — DockIdle.js:266-268).
 *     Nao existe um "mapa de caça obvio" pra abrir direto: a propria janela
 *     ja lista os mapas por regiao/nivel/nome/busca, e abrir ela em vez de
 *     sortear um destino e o comportamento honesto pedido no briefing.
 *   - "Retornar para Prontera" viaja de volta SEM abrir janela nenhuma, via
 *     HuntMap.travelToCity() (metodo publico novo em HuntMap.js que manda o
 *     MESMO pacote CZ_RAGIDLE_VIAJAR que o botao "Retornar ao ponto salvo"
 *     do painel ja manda — nenhum pacote novo, so um segundo gatilho pro
 *     mesmo handler; ver o comentario de HuntMap.travelToCity em HuntMap.js).
 *
 * Remove (de forma REVERSIVEL) o botao preto redondo do AdminPanel
 * (".ap-button", position:fixed dentro do proprio shadow root dele — ver
 * AdminPanel.css:50-56) que ficava sozinho logo abaixo do minimapa: MESMA
 * tecnica hideButton() que DockIdle.js:241-247 usa pros 3 botoes flutuantes
 * redundantes dele (display:none via JS, nunca .remove() — AdminPanel.js
 * continua dono do elemento e do seu listener, nenhum arquivo dele e
 * tocado). O esconderijo mora AQUI (nao mais em DockIdle.js, que nunca
 * escondia ".ap-button" de proposito) porque o dono esta aposentando o
 * DockIdle nesta mesma rodada — este componente novo e o lugar que
 * sobrevive a isso. O painel de admin continua alcancavel pela grade do
 * painel do personagem (data-action="admin" em BasicInfoIdle.html).
 *
 * @author RagIdle
 */

import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import HuntMap from 'UI/Components/HuntMap/HuntMap.js';
import IdleConfig from 'UI/Components/IdleConfig/IdleConfig.js';
import AdminPanel from 'UI/Components/AdminPanel/AdminPanel.js';
import htmlText from './HuntButtonIdle.html?raw';
import cssText from './HuntButtonIdle.css?raw';

/**
 * Mesmo intervalo de polling leve que DockIdle.js/TopMenuIdle.js.
 */
const POLL_INTERVAL_MS = 250;

const LABEL_CACAR = 'Caçar';
const LABEL_RETORNAR = 'Retornar para Prontera';

/**
 * Create Component
 */
const HuntButtonIdle = new GUIComponent('HuntButtonIdle', cssText);

HuntButtonIdle.render = () => htmlText;

/**
 * Mesmo modo dos outros flutuantes RAGIDLE: nao intercepta clique/hover fora
 * do proprio botao (":host" fica pointer-events:none, ver HuntButtonIdle.css).
 */
HuntButtonIdle.mouseMode = GUIComponent.MouseMode.CROSS;

/**
 * Fora do sistema de foco/z-index — este componente nunca e uma janela,
 * entao nunca precisa vir pra frente (mesmo motivo de DockIdle.js/
 * TopMenuIdle.js, ver os cabecalhos deles).
 */
HuntButtonIdle.needFocus = false;

/**
 * @var {number|null} setInterval handle do polling leve de contexto.
 */
let _pollTimer = null;

/**
 * @var {boolean|null} ultimo valor de ehCidade aplicado ao rotulo — evita
 * reescrever o DOM a cada tique quando nada mudou.
 */
let _lastEhCidade = null;

/**
 * Helper: query dentro do shadow root
 */
function _root() {
	return HuntButtonIdle._shadow || HuntButtonIdle._host;
}

/**
 * One-time setup (roda uma vez, durante GUIComponent#prepare()).
 */
HuntButtonIdle.init = function init() {
	const root = _root();
	root.querySelector('.hb-btn').addEventListener('click', onClickButton);
};

/**
 * Esconde o botao preto do AdminPanel, sincroniza o rotulo com o mapa atual
 * e liga o polling que mantem as duas coisas atualizadas a cada troca de
 * mapa (este componente e recriado do zero em todo onMapChange, ver
 * Engine/MapEngine.js).
 */
HuntButtonIdle.onAppend = function onAppend() {
	hideAdminButton();
	_lastEhCidade = null;
	syncLabel();
	startPolling();
};

/**
 * Desliga o polling quando o componente sai de cena (troca de mapa) — mesmo
 * cuidado de DockIdle.js/TopMenuIdle.js.
 */
HuntButtonIdle.onRemove = function onRemove() {
	stopPolling();
};

function startPolling() {
	stopPolling();
	_pollTimer = setInterval(poll, POLL_INTERVAL_MS);
}

function stopPolling() {
	if (_pollTimer != null) {
		clearInterval(_pollTimer);
		_pollTimer = null;
	}
}

function poll() {
	hideAdminButton();
	syncLabel();
}

/**
 * Esconde ".ap-button" do AdminPanel — reversivel, MESMA tecnica de
 * DockIdle.js:hideButton() (display:none via JS, nunca .remove()). Repetido
 * no polling pela mesma razao de DockIdle.js:hideNativeLevelUpButton(): se o
 * botao de algum jeito reaparecesse, o proximo tique esconde de novo.
 */
function hideAdminButton() {
	const root = AdminPanel.getRoot();
	const btn = root && root.querySelector('.ap-button');
	if (btn && btn.style.display !== 'none') {
		btn.style.display = 'none';
	}
}

function ehCidadeAtual() {
	return !!(IdleConfig.contexto && IdleConfig.contexto.ehCidade);
}

/**
 * Atualiza o rotulo do botao a partir do sinal REAL (IdleConfig.contexto.
 * ehCidade), so tocando o DOM quando o valor muda (ver _lastEhCidade acima).
 */
function syncLabel() {
	if (!IdleConfig.contexto) {
		// Ainda sem resposta do servidor pra esta troca de mapa (sondada em
		// IdleConfig.sondarMapa(), chamada em Engine/MapEngine.js a cada
		// onMapChange) — mantem o rotulo atual (o HTML ja nasce com "Caçar",
		// ver HuntButtonIdle.html) em vez de piscar algo no meio termo.
		return;
	}

	const ehCidade = ehCidadeAtual();
	if (ehCidade === _lastEhCidade) {
		return;
	}
	_lastEhCidade = ehCidade;

	const root = _root();
	const btn = root.querySelector('.hb-btn');
	if (!btn) {
		return;
	}
	const label = ehCidade ? LABEL_CACAR : LABEL_RETORNAR;
	btn.textContent = label;
	btn.title = label;
}

function onClickButton(e) {
	e.stopImmediatePropagation();
	if (ehCidadeAtual()) {
		// Nao ha um "mapa obvio" pra abrir direto — a propria janela Mapa de
		// Caça ja lista tudo por regiao/nivel/nome. Mesmo metodo publico que
		// o item "Caça" do DockIdle ja usa (DockIdle.js:266-268).
		HuntMap.toggle();
	} else {
		// Viaja de volta SEM abrir a janela — mesmo pacote CZ_RAGIDLE_VIAJAR
		// que o botao "Retornar ao ponto salvo" do painel ja manda, so um
		// segundo gatilho pro mesmo handler (ver HuntMap.js:travelToCity).
		HuntMap.travelToCity();
	}
}

/**
 * Create component and export it
 */
export default UIManager.addComponent(HuntButtonIdle);
