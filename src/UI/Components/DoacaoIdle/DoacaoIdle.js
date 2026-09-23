/**
 * UI/Components/DoacaoIdle/DoacaoIdle.js
 *
 * RAGIDLE: a janela "DOACAO VIA PIX" (23/09/2026). O botao "Recarregar" da
 * carteira do RO Shop a abre quando o servidor diz que a recarga esta
 * disponivel (`recarga.disponivel`, servidor/ro-shop/loja-do-ro-shop.ts).
 *
 * ---------------------------------------------------------------------------
 * O MESMO CANAL DO RO SHOP, E O PACOTE CONTINUA TENDO UM DONO SO
 * ---------------------------------------------------------------------------
 * Os pedidos saem no `CZ_RAGIDLE_ROSHOP` (0x0fb9) com `acao: 'doacao-*'`, e as
 * respostas descem no `ZC_RAGIDLE_ROSHOP` (0x0fb8) com `tipo: 'doacao'`.
 * `Network.hookPacket` SUBSTITUI o gancho anterior (NetworkManager.js), entao
 * esta janela NAO fisga o 0x0fb8: quem o fisga e o `RoShop.js`, que repassa o
 * que tem `tipo: 'doacao'` pela ponte `RoShop.aoDoacao`, ligada no MapEngine
 * a `DoacaoIdle.receber`. Um segundo gancho aqui roubaria o pacote da loja.
 *
 * ---------------------------------------------------------------------------
 * TRES PECAS, como o RO Shop
 * ---------------------------------------------------------------------------
 * - `formatoDaDoacao.js`: a metade PURA (faixa, total, CPF, textos);
 * - `controladorDaDoacao.js`: as telas e os cliques, sem motor;
 * - este arquivo: a COSTURA com o jogo (pacote, arrasto, fonte, pilha).
 *
 * @author RagIdle
 */

import Renderer from 'Renderer/Renderer.js';
import Preferences from 'Core/Preferences.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import arrastarPorPonteiro, { prenderNaTela } from 'UI/arrastarPorPonteiro.js';
import { fecharEEsquecer } from '../limpezaDeJanelaIdle.js';
import { confirmarCopia } from '../IndicacaoIdle/confirmarCopia.js';
import { criarControladorDaDoacao } from './controladorDaDoacao.js';
import htmlText from './DoacaoIdle.html?raw';
import cssText from './DoacaoIdle.css?raw';

/** Manter em sincronia com o `:host` do CSS. */
const WINDOW_WIDTH = 560;
const WINDOW_HEIGHT = 760;

const DoacaoIdle = new GUIComponent('DoacaoIdle', cssText);

DoacaoIdle.render = () => htmlText;

/** Janela fechada nao pode engolir clique de cena. */
DoacaoIdle.mouseMode = GUIComponent.MouseMode.CROSS;

const _preferences = Preferences.get('DoacaoIdle', { x: null, y: null }, 1.0);

function _root() {
	return DoacaoIdle._shadow || DoacaoIdle._host;
}

function janela() {
	const root = _root();
	return root ? root.querySelector('.dc-window') : null;
}

function estaAberta() {
	const win = janela();
	return !!(win && win.classList.contains('is-open'));
}

function enviar(corpo) {
	const pkt = new PACKET.CZ.RAGIDLE_ROSHOP();
	pkt.json = JSON.stringify(corpo);
	Network.sendPacket(pkt);
}

/**
 * O titulo e em Cinzel, como na referencia do dono. A tela de login ja a
 * carrega (Intro.js); quem entra direto no mapa (a retomada sem login, D-997)
 * nao passa por la, entao a janela confere e pede - com a MESMA guarda, para
 * nunca haver duas folhas da mesma fonte.
 */
function garantirFonteDoTitulo() {
	if (typeof document === 'undefined' || document.querySelector('link[href*="Cinzel"]')) {
		return;
	}
	const link = document.createElement('link');
	link.rel = 'stylesheet';
	link.href = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&display=swap';
	document.head.appendChild(link);
}

let _controlador = null;

function controlador() {
	if (!_controlador) {
		const root = _root();
		if (!root) {
			return null;
		}
		_controlador = criarControladorDaDoacao({ raiz: root, enviar, aoCopiar: confirmarCopia });
	}
	return _controlador;
}

function onClickRaiz(e) {
	const c = controlador();
	if (!c) {
		return;
	}
	const tratado = c.onClick(e);
	if (tratado === 'fechar') {
		e.stopImmediatePropagation();
		DoacaoIdle.toggle();
		return;
	}
	if (tratado) {
		e.stopImmediatePropagation();
	}
}

function onInputRaiz(e) {
	const c = controlador();
	if (c) {
		c.onInput(e);
	}
}

function savePosition() {
	if (!DoacaoIdle._host) {
		return;
	}
	_preferences.x = parseInt(DoacaoIdle._host.style.left, 10) || 0;
	_preferences.y = parseInt(DoacaoIdle._host.style.top, 10) || 0;
	_preferences.save();
}

DoacaoIdle.init = function init() {
	const root = _root();
	// Guardas nos querySelector: este init roda dentro de MapEngine.init, e uma
	// excecao aqui derruba o motor de mapa inteiro.
	const container = root && root.querySelector('#DoacaoIdle');
	if (container) {
		container.addEventListener('click', onClickRaiz);
		container.addEventListener('input', onInputRaiz);
		container.addEventListener('change', onInputRaiz);
		// Digitar nome, CPF ou quantidade nao pode virar tecla de jogo.
		container.addEventListener('keydown', e => {
			if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName) && e.key !== 'Escape') {
				e.stopPropagation();
			}
		});
	}
	const titulo = root && root.querySelector('.dc-titlebar');
	if (titulo) {
		arrastarPorPonteiro({
			alca: titulo,
			painel: this._host,
			aoSoltar: ({ left, top }) => {
				_preferences.x = left;
				_preferences.y = top;
				_preferences.save();
			}
		});
	}
	this._host.style.top = Math.max(0, (Renderer.height - WINDOW_HEIGHT) / 2) + 'px';
	this._host.style.left = Math.max(0, (Renderer.width - WINDOW_WIDTH) / 2) + 'px';
	const c = controlador();
	if (c) {
		c.render();
	}
};

DoacaoIdle.onAppend = function onAppend() {
	if (_preferences.x != null && _preferences.y != null) {
		this._host.style.left = _preferences.x + 'px';
		this._host.style.top = _preferences.y + 'px';
	}
	prenderNaTela(this._host);
};

DoacaoIdle.onRemove = function onRemove() {
	savePosition();
};

/** Abre/fecha; ao abrir, pede o estado da doacao ao servidor. */
DoacaoIdle.toggle = function toggle() {
	const win = janela();
	const c = controlador();
	if (!win || !c) {
		return;
	}
	if (win.classList.contains('is-open')) {
		win.classList.remove('is-open');
		c.fechar();
		savePosition();
		return;
	}
	garantirFonteDoTitulo();
	win.classList.add('is-open');
	if (_preferences.x == null || _preferences.y == null) {
		DoacaoIdle._host.style.left = Math.max(0, Math.round((Renderer.width - win.offsetWidth) / 2)) + 'px';
		DoacaoIdle._host.style.top = Math.max(0, Math.round((Renderer.height - win.offsetHeight) / 2)) + 'px';
	}
	DoacaoIdle.focus();
	prenderNaTela(DoacaoIdle._host);
	c.abrir();
};

/** Abre (sem alternar): o "Recarregar" do RO Shop so pede para mostrar. */
DoacaoIdle.abrir = function abrir() {
	if (!estaAberta()) {
		DoacaoIdle.toggle();
	}
};

DoacaoIdle.estaAberta = estaAberta;

/**
 * A entrada das mensagens `tipo: 'doacao'`, repassadas pelo RoShop.js (o dono
 * do 0x0fb8). Defensiva: uma excecao aqui voltaria pelo laco de rede.
 */
DoacaoIdle.receber = function receber(dados) {
	try {
		const c = controlador();
		if (c) {
			c.receber(dados);
		}
	} catch (err) {
		console.error('[DoacaoIdle] falha ao desenhar a resposta', err);
	}
};

/** Troca de personagem: nome, CPF, codigo aberto e tela do anterior saem. */
DoacaoIdle.limparEstadoDoPersonagem = function limparEstadoDoPersonagem() {
	const c = controlador();
	if (c) {
		c.limpar();
	}
	fecharEEsquecer(_root(), '.dc-window');
};

export default UIManager.addComponent(DoacaoIdle);
