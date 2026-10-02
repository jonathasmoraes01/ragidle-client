/**
 * UI/Components/TrocaIdle/TrocaIdle.js
 *
 * RAGIDLE: a janela "Trade" do menu (02/10/2026, pedido do dono). O botao
 * "Troca" do leque - que era "em breve" - abre esta janela, no PC e no
 * celular: um campo com o nome do jogador e o botao "Confirmar".
 *
 * O servidor confere se os DOIS sao VIP (R50) e se estao no mesmo mapa a ate
 * 2 celulas (`TRADE_DISTANCE`, trade.cpp), e so entao manda ao outro o pedido
 * NATIVO de troca. Toda recusa volta com a frase do motivo, que aparece aqui
 * na janela. Aceito, a janela de troca de sempre abre nos dois lados e esta
 * sai da frente.
 *
 * TRES PECAS, como a Doacao:
 * - `controladorDaTroca.js`: o campo, o botao, a trava e o recado, sem motor;
 * - este arquivo: a COSTURA com o jogo (pacote, arrasto, posicao, pilha);
 * - `servidor/mapa/troca-pelo-nome.ts` (no servidor): a decisao.
 *
 * O PACOTE TEM UM DONO SO: o `ZC_RAGIDLE_TROCA` (0x0fb3) e fisgado aqui. A
 * resposta nativa ao pedido (`ZC_ACK_EXCHANGE_ITEM`) e de
 * `Engine/MapEngine/Trade.js`, e esta janela a ouve pela assinatura de la
 * (`aoResponderPedidoDeTroca`) - um segundo `hookPacket` no mesmo opcode
 * roubaria o pacote do dono (`NetworkManager.js`).
 *
 * This file is part of the ragidle fork of ROBrowser.
 */
import Renderer from 'Renderer/Renderer.js';
import Preferences from 'Core/Preferences.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import { aoResponderPedidoDeTroca } from 'Engine/MapEngine/Trade.js';
import htmlText from './TrocaIdle.html?raw';
import cssText from './TrocaIdle.css?raw';
import { fecharEEsquecer } from '../limpezaDeJanelaIdle.js';
import { criarControladorDaTroca } from './controladorDaTroca.js';

const WINDOW_WIDTH = 360;
const WINDOW_HEIGHT = 240;

/* O tamanho REAL na tela: a folha usa `min()`, e no celular e menor que a constante. */
function larguraNaTela() {
	return Math.min(WINDOW_WIDTH, Math.max(0, Renderer.width - 16));
}

function alturaNaTela() {
	return Math.min(WINDOW_HEIGHT, Math.max(0, Renderer.height - 132));
}

const TrocaIdle = new GUIComponent('TrocaIdle', cssText);

TrocaIdle.render = () => htmlText;

TrocaIdle.mouseMode = GUIComponent.MouseMode.CROSS;

/** O controlador nasce no `init`, quando a shadow DOM ja existe. */
let _controlador = null;

const _preferences = Preferences.get(
	'TrocaIdle',
	{
		x: null,
		y: null
	},
	1.0
);

function _root() {
	return TrocaIdle._shadow || TrocaIdle._host;
}

function enviar(corpo) {
	const pkt = new PACKET.CZ.RAGIDLE_TROCA_ACAO();
	pkt.json = JSON.stringify(corpo);
	Network.sendPacket(pkt);
}

TrocaIdle.limparEstadoDoPersonagem = function limparEstadoDoPersonagem() {
	if (_controlador) {
		_controlador.aoFechar();
	}
	// Sem "corpo de partida": o recado vazio e o estado de partida, e quem o
	// limpa e o `aoFechar` acima (o `fecharEEsquecer` escreveria "Carregando...").
	fecharEEsquecer(_root(), '.tr-window');
	const campo = _root() && _root().querySelector('.tr-nome');
	if (campo) {
		campo.value = '';
	}
};

TrocaIdle.init = function init() {
	const root = _root();
	if (root) {
		_controlador = criarControladorDaTroca({ raiz: root, enviar, fechar: closeWindow });
		const fechar = root.querySelector('.tr-close');
		if (fechar) {
			fechar.addEventListener('click', onClickClose);
		}
		const titulo = root.querySelector('.tr-titlebar');
		if (titulo) {
			this.draggable(titulo);
		}
		const corpo = root.querySelector('.tr-body');
		if (corpo) {
			corpo.addEventListener('submit', onSubmit);
			// Digitar o nome nao pode virar tecla de jogo (atalho, ESC da pilha).
			corpo.addEventListener('keydown', e => e.stopPropagation());
		}
	}
	this._host.style.top = Math.max(0, (Renderer.height - alturaNaTela()) / 2) + 'px';
	this._host.style.left = Math.max(0, (Renderer.width - larguraNaTela()) / 2) + 'px';
};

TrocaIdle.onAppend = function onAppend() {
	if (_preferences.x != null && _preferences.y != null) {
		this._host.style.top =
			Math.min(Math.max(0, _preferences.y), Math.max(0, Renderer.height - alturaNaTela())) + 'px';
		this._host.style.left =
			Math.min(Math.max(0, _preferences.x), Math.max(0, Renderer.width - larguraNaTela())) + 'px';
	}
};

TrocaIdle.onRemove = function onRemove() {
	savePosition();
};

function savePosition() {
	_preferences.x = parseInt(TrocaIdle._host.style.left, 10) || 0;
	_preferences.y = parseInt(TrocaIdle._host.style.top, 10) || 0;
	_preferences.save();
}

TrocaIdle.toggle = function toggle() {
	const root = _root();
	const win = root && root.querySelector('.tr-window');
	if (!win) {
		return;
	}
	if (win.classList.contains('is-open')) {
		closeWindow();
	} else {
		win.classList.add('is-open');
		TrocaIdle.focus();
		if (_controlador) {
			_controlador.aoAbrir();
		}
	}
};

function closeWindow() {
	const root = _root();
	const win = root && root.querySelector('.tr-window');
	if (win) {
		win.classList.remove('is-open');
	}
	if (_controlador) {
		_controlador.aoFechar();
	}
	savePosition();
}

function onClickClose(e) {
	e.stopImmediatePropagation();
	closeWindow();
}

function onSubmit(e) {
	e.preventDefault();
	e.stopImmediatePropagation();
	if (_controlador) {
		_controlador.confirmar();
	}
}

function onTrocaRecebida(pkt) {
	let dados;
	try {
		dados = JSON.parse(pkt.json);
	} catch (err) {
		console.error('[TrocaIdle] payload nao e JSON valido', err);
		return;
	}
	if (!dados || dados.v !== 1 || !_controlador) {
		return;
	}
	_controlador.receber(dados);
}

Network.hookPacket(PACKET.ZC.RAGIDLE_TROCA, onTrocaRecebida);

aoResponderPedidoDeTroca(resultado => {
	if (_controlador) {
		_controlador.receberRespostaNativa(resultado);
	}
});

export default UIManager.addComponent(TrocaIdle);
