/**
 * UI/Components/TopBarIdle/TopBarIdle.js
 *
 * "Top bar" (centro) do design system "Ragnarok Classico Premium" (gauntlet
 * 18/08/2026, ver redesign/extracao-da-referencia.md secao 4.2). Capsula
 * clara no topo-centro da tela com o medalhao dourado "Z" e o valor de zeny
 * formatado. SO zeny - nao existe segunda moeda neste fork, entao nao ha
 * segunda capsula (a referencia visual tem uma de gema vermelha que NAO
 * existe aqui, por instrucao explicita do briefing).
 *
 * Fonte do dado (MESMA que BasicInfoIdle usa pra zeny, ver
 * UI/Components/BasicInfoIdle/BasicInfoIdle.js:19-20/339): Session.zeny
 * (Engine/SessionStorage.js) - getter/setter que aponta pra
 * Session.Entity.money, mantido vivo pelo motor nativo a cada pacote de
 * dinheiro. Read-only aqui: este componente nunca escreve em Session.zeny.
 *
 * Mesmo mecanismo de atualizacao que BasicInfoIdle: nenhum hook de pacote
 * proprio (Network.hookPacket() sobrescreveria o handler nativo que ja
 * mantem Session.Entity/Session.zeny atualizados - ver BasicInfoIdle.js
 * :28-36 pra a explicacao completa). So um polling de 250ms relendo o
 * mesmo estado que o motor ja mantem vivo.
 *
 * needFocus=false / :host pointer-events:none com filhos auto: mesmo
 * contrato de DockIdle.js/DockIdle.css - a capsula nunca cobre uma janela
 * (fica presa no z-index inicial 50, GUIComponent.js:159) nem intercepta
 * clique no mapa fora dela mesma.
 *
 * @author RagIdle
 */

import Session from 'Engine/SessionStorage.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import RiIcones from 'UI/ri-icones.js';
import htmlText from './TopBarIdle.html?raw';
import cssText from './TopBarIdle.css?raw';

/**
 * Mesmo intervalo de polling que BasicInfoIdle.js (POLL_INTERVAL_MS = 250)
 * - mesma cadencia, mesma justificativa (ver cabecalho do arquivo).
 */
const POLL_INTERVAL_MS = 250;

/**
 * Create Component
 */
const TopBarIdle = new GUIComponent('TopBarIdle', cssText);

/**
 * Troca o marcador "<!--RI_ICONE:zeny-->" do .html pela string SVG do
 * modulo de iconografia (UI/ri-icones.js) — mesmo padrao de DockIdle.js.
 */
TopBarIdle.render = () => htmlText.replace(/<!--RI_ICONE:(\w+)-->/g, (_, chave) => RiIcones[chave] || '');

/**
 * Mesmo modo dos outros flutuantes RAGIDLE: scene click atravessa a UI
 * quando o mouse nao esta sobre um elemento clicavel de verdade.
 */
TopBarIdle.mouseMode = GUIComponent.MouseMode.CROSS;

/**
 * Fora do sistema de foco/z-index (mesmo motivo de DockIdle.js:76-90): a
 * capsula nunca precisa vir pra frente porque nao e uma janela.
 */
TopBarIdle.needFocus = false;

/**
 * @var {number|null} setInterval handle do polling.
 */
let _pollTimer = null;

/**
 * Helper: query dentro do shadow root
 */
function _root() {
	return TopBarIdle._shadow || TopBarIdle._host;
}

/**
 * "123.456" - PT-BR, separador de milhar por ponto. Mesmo algoritmo de
 * BasicInfoIdle.js:formatZeny() (nao exportado la, entao duplicado aqui -
 * e so formatacao de texto, nenhuma logica de jogo nova).
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
 * One-time setup (roda uma vez, durante GUIComponent#prepare()). Sem
 * controle clicavel nesta capsula, entao nao ha listener pra ligar aqui.
 */
TopBarIdle.init = function init() {};

/**
 * Sincroniza com o estado nativo assim que a capsula aparece e comeca o
 * polling (mesma sequencia de BasicInfoIdle.onAppend()).
 */
TopBarIdle.onAppend = function onAppend() {
	syncFromNativeState();
	startPolling();
};

/**
 * Para o polling quando o componente sai (troca de mapa - ver
 * UIManager.removeComponents(), Engine/MapEngine.js:902).
 */
TopBarIdle.onRemove = function onRemove() {
	stopPolling();
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
 * Releh Session.zeny (ver cabecalho do arquivo) e atualiza o texto.
 */
function syncFromNativeState() {
	const root = _root();
	const el = root.querySelector('.tb-valor');
	if (el) {
		el.textContent = formatZeny(Session.zeny);
	}
}

/**
 * Create component and export it
 */
export default UIManager.addComponent(TopBarIdle);
