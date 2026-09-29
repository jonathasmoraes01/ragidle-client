/**
 * UI/Components/CacaMedidaIdle/CacaMedidaIdle.js
 *
 * RAGIDLE: A JANELA "SEUS MAPAS" (28/09/2026) — a caca MEDIDA de cada mapa e o
 * botao Explorar.
 *
 * Decisao do dono de 28/09/2026: a recomendacao de mapa deixa de ser PREVISAO e
 * passa a ser MEDICAO da caca real. Ela comeca isolada do Mapa de Caca, numa
 * janela propria aberta pelo comando `@cacamedida`, que so o administrador
 * alcanca (o A/B vem depois). Contrato: `docs/CONTRATO-CACA-MEDIDA.md`
 * (repositorio do servidor).
 *
 * ## As tres pecas
 *
 * - `formatoDaCacaMedida.js` — PURO: le o pacote, ordena, da o selo e monta o
 *   HTML do corpo numa string;
 * - `controladorDaCacaMedida.js` — abrir, fechar, receber e o relogio do
 *   `pedir`, com DOM, envio e relogio injetados (o teste roda de verdade);
 * - este arquivo — a COSTURA: o pacote fisgado, o pacote enviado, o arrasto,
 *   a posicao lembrada e a limpeza da troca de personagem.
 *
 * ## Quem abre
 *
 * O SERVIDOR, com `abrir: true` no `0x0fb5` (o comando). Quem abre de fato e o
 * `toggle()` — e nao o controlador direto — porque a pilha de janelas embrulha
 * o `toggle()` para saber o que esta aberto (ESC, voltar do Android, uma janela
 * por vez no celular em pe). Abrir por fora do `toggle()` deixaria a janela
 * fora da pilha.
 *
 * This file is part of the ragidle fork of ROBrowser.
 */
import Renderer from 'Renderer/Renderer.js';
import Preferences from 'Core/Preferences.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import { CRITERIO, lerCacaMedida } from './formatoDaCacaMedida.js';
import { criarControladorDaCacaMedida } from './controladorDaCacaMedida.js';
import { fecharEEsquecer } from '../limpezaDeJanelaIdle.js';
import htmlText from './CacaMedidaIdle.html?raw';
import cssText from './CacaMedidaIdle.css?raw';

const WINDOW_WIDTH = 460;
const WINDOW_HEIGHT = 600;

function larguraNaTela() {
	return Math.min(WINDOW_WIDTH, Math.max(0, Renderer.width - 16));
}

function alturaNaTela() {
	return Math.min(WINDOW_HEIGHT, Math.max(0, Renderer.height - 132));
}

const CacaMedidaIdle = new GUIComponent('CacaMedidaIdle', cssText);

CacaMedidaIdle.render = () => htmlText;

CacaMedidaIdle.mouseMode = GUIComponent.MouseMode.CROSS;

const _preferences = Preferences.get(
	'CacaMedidaIdle',
	{
		x: null,
		y: null,
		criterio: CRITERIO.EXP
	},
	1.0
);

function _root() {
	return CacaMedidaIdle._shadow || CacaMedidaIdle._host;
}

/** O verbo ao servidor. Nenhum outro dado viaja: o contrato so tem a acao. */
function enviar(acao) {
	const pkt = new PACKET.CZ.RAGIDLE_CACA_MEDIDA();
	pkt.json = JSON.stringify({ acao });
	Network.sendPacket(pkt);
}

const _controlador = criarControladorDaCacaMedida({
	raiz: _root,
	enviar,
	criterioInicial: _preferences.criterio,
	aoTrocarCriterio: criterio => {
		_preferences.criterio = criterio;
		_preferences.save();
	}
});

/** Exposto para a sonda de tela e para o teste: o estado, sem mexer nele. */
CacaMedidaIdle.controlador = _controlador;

/** O pacote que mandou abrir ja trouxe o estado: a abertura nao pede de novo. */
let _abrindoComDados = false;

CacaMedidaIdle.limparEstadoDoPersonagem = function limparEstadoDoPersonagem() {
	/*
	 * Trocar de personagem nao recarrega a pagina e o shadow DOM sobrevive: sem
	 * isto a janela voltaria aberta, com os mapas do personagem ANTERIOR e com
	 * o relogio do `pedir` ainda correndo. A peca compartilhada tira o
	 * `is-open` e o desenho; o controlador para o relogio e esquece o dado.
	 */
	_controlador.esquecer();
	fecharEEsquecer(_root(), '.cm-window', { corpo: '.cm-corpo', texto: '' });
};

CacaMedidaIdle.init = function init() {
	const root = _root();
	if (root) {
		const fechar = root.querySelector('.cm-close');
		if (fechar) {
			fechar.addEventListener('click', onClickClose);
		}
		const titulo = root.querySelector('.cm-titlebar');
		if (titulo) {
			this.draggable(titulo);
		}
		root.querySelectorAll('.cm-criterio').forEach(botao =>
			botao.addEventListener('click', event => {
				event.stopImmediatePropagation();
				_controlador.trocarCriterio(event.currentTarget.dataset.criterio);
			})
		);
		// UM ouvinte, delegado: o corpo e redesenhado a cada pacote, e religar
		// ouvinte por cartao a cada 15 s seria trabalho por nada.
		const corpo = root.querySelector('.cm-corpo');
		if (corpo) {
			corpo.addEventListener('click', event => {
				event.stopImmediatePropagation();
				_controlador.aoClicarNoCorpo(event);
			});
		}
	}
	this._host.style.top = Math.max(0, (Renderer.height - alturaNaTela()) / 2) + 'px';
	this._host.style.left = Math.max(0, (Renderer.width - larguraNaTela()) / 2) + 'px';
};

CacaMedidaIdle.onAppend = function onAppend() {
	if (_preferences.x != null && _preferences.y != null) {
		this._host.style.top =
			Math.min(Math.max(0, _preferences.y), Math.max(0, Renderer.height - alturaNaTela())) + 'px';
		this._host.style.left =
			Math.min(Math.max(0, _preferences.x), Math.max(0, Renderer.width - larguraNaTela())) + 'px';
	}
	/*
	 * A TROCA DE MAPA remove e reanexa todo componente, e o shadow DOM guarda o
	 * `is-open`. Quem estava aberta volta aberta — e o relogio do `pedir`, que
	 * o `onRemove` parou, volta junto, com um pedido na hora (o mapa mudou).
	 */
	if (_controlador.estaAberta()) {
		_controlador.abrir({ pedir: true });
	}
};

CacaMedidaIdle.onRemove = function onRemove() {
	// Fora do DOM nao ha quem ver o `pedir`: o relogio para aqui, sempre.
	_controlador.pararRelogio();
	savePosition();
};

function savePosition() {
	if (!CacaMedidaIdle._host) {
		return;
	}
	_preferences.x = parseInt(CacaMedidaIdle._host.style.left, 10) || 0;
	_preferences.y = parseInt(CacaMedidaIdle._host.style.top, 10) || 0;
	_preferences.save();
}

function onClickClose(e) {
	e.stopImmediatePropagation();
	CacaMedidaIdle.toggle();
}

CacaMedidaIdle.toggle = function toggle() {
	if (!_root()) {
		return;
	}
	if (_controlador.estaAberta()) {
		_controlador.fechar();
		savePosition();
		return;
	}
	_controlador.abrir({ pedir: !_abrindoComDados });
	CacaMedidaIdle.focus();
};

/** O `0x0fb5`. Um pacote, no maximo um desenho. */
function onCacaMedidaRecebida(pkt) {
	const dados = lerCacaMedida(pkt.json);
	if (!dados) {
		console.error('[CacaMedidaIdle] 0x0fb5 ilegivel ou de outro contrato');
		return;
	}
	if (_controlador.receber(dados) !== 'abrir') {
		return;
	}
	// O comando pediu e a janela esta fechada: abre pelo `toggle()` (a pilha
	// ve), sem pedir de novo o que acabou de chegar.
	if (!CacaMedidaIdle.__active) {
		CacaMedidaIdle.append();
	}
	_abrindoComDados = true;
	try {
		CacaMedidaIdle.toggle();
	} finally {
		_abrindoComDados = false;
	}
}

Network.hookPacket(PACKET.ZC.RAGIDLE_CACA_MEDIDA, onCacaMedidaRecebida);

export default UIManager.addComponent(CacaMedidaIdle);
