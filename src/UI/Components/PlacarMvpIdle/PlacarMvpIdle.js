/**
 * UI/Components/PlacarMvpIdle/PlacarMvpIdle.js
 *
 * RAGIDLE: O PLACAR AO VIVO DO MVP (16/09/2026, D-1533).
 *
 * Pedido do dono: *"Placar ao vivo do dano durante a luta, com o top 5 numa
 * janelinha"*. O servidor manda o `ZC_RAGIDLE_PLACAR_MVP` (~1 por segundo) a
 * quem esta no mapa do MVP enquanto ha dano registrado nele, e `ativo:false`
 * quando ele morre. Este componente e o UNICO dono desse opcode
 * (`Network.hookPacket` guarda um callback so).
 *
 * E uma faixa informativa, e nao uma janela: nao entra na pilha de janelas, nao
 * engole clique (`CROSS`), e some sozinha depois de alguns segundos sem pacote
 * — quem saiu do mapa nao fica com o placar congelado na tela. No celular em pe
 * a posicao e do `Common.css` (`html.ri-vertical #PlacarMvpIdle`).
 *
 * This file is part of the ragidle fork of ROBrowser.
 */
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import { htmlDoPlacar, lerPlacar, PLACAR_SOME_EM_MS } from './placarDoMvp.js';
import htmlText from './PlacarMvpIdle.html?raw';
import cssText from './PlacarMvpIdle.css?raw';

const PlacarMvpIdle = new GUIComponent('PlacarMvpIdle', cssText);

PlacarMvpIdle.render = () => htmlText;
PlacarMvpIdle.mouseMode = GUIComponent.MouseMode.CROSS;
PlacarMvpIdle.needFocus = false;

/** @var {number|null} o relogio que esconde o placar sem pacote. */
let _sumir = null;

function _root() {
	return PlacarMvpIdle._shadow || PlacarMvpIdle._host;
}

function esconder() {
	const caixa = _root() && _root().querySelector('.pm-placar');
	if (caixa) {
		caixa.hidden = true;
		caixa.innerHTML = '';
	}
}

function receber(pkt) {
	const html = htmlDoPlacar(lerPlacar(pkt.json));
	const caixa = _root() && _root().querySelector('.pm-placar');
	if (!caixa) {
		return;
	}
	if (_sumir !== null) {
		clearTimeout(_sumir);
		_sumir = null;
	}
	if (html === '') {
		esconder();
		return;
	}
	caixa.innerHTML = html;
	caixa.hidden = false;
	_sumir = setTimeout(esconder, PLACAR_SOME_EM_MS);
}

PlacarMvpIdle.init = function init() {
	Network.hookPacket(PACKET.ZC.RAGIDLE_PLACAR_MVP, receber);
};

PlacarMvpIdle.limparEstadoDoPersonagem = function limparEstadoDoPersonagem() {
	if (_sumir !== null) {
		clearTimeout(_sumir);
		_sumir = null;
	}
	esconder();
};

PlacarMvpIdle.onRemove = function onRemove() {
	PlacarMvpIdle.limparEstadoDoPersonagem();
};

/** Para a prova de tela: o que o jogador ve agora. */
PlacarMvpIdle._receberParaProva = receber;

export default UIManager.addComponent(PlacarMvpIdle);
