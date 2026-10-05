/**
 * UI/Components/AmigosIdle/AmigosIdle.js
 *
 * RAGIDLE: a janela "Amigos" (05/10/2026, sugestao de jogador que o dono
 * pediu). Ve quem esta online e offline, manda mensagem privada e convida para
 * o grupo os que estao online, e adiciona/remove amigo pelo nome.
 *
 * TRES PECAS, como a Troca:
 * - `controladorDosAmigos.js`: a lista, os botoes e o recado, sem motor;
 * - este arquivo: a COSTURA com o jogo (pacotes, chat, grupo, arrasto, pilha);
 * - o servidor (`servidor/amigos.ts` e o /friend em `servidor-mapa.ts`): a
 *   decisao. NADA mudou no servidor: os sete pacotes oficiais do rAthena ja
 *   eram servidos desde 27/08/2026.
 *
 * NENHUM `hookPacket` AQUI, de proposito: os pacotes de amizade sao de
 * `Engine/MapEngine/Friends.js`, a resposta ao convite e de
 * `Engine/MapEngine/Group.js` e a fala do sistema e de `Engine/MapEngine/Main.js`
 * — um segundo gancho no mesmo opcode roubaria o pacote do dono. A janela
 * ouve pelas assinaturas de la.
 *
 * This file is part of the ragidle fork of ROBrowser.
 */
import Renderer from 'Renderer/Renderer.js';
import Preferences from 'Core/Preferences.js';
import Session from 'Engine/SessionStorage.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import ChatBox from 'UI/Components/ChatBox/ChatBox.js';
import PartyFriends from 'UI/Components/PartyFriends/PartyFriends.js';
import FriendEngine, { aoMudarAmigos, aoResultadoDeAmizade } from 'Engine/MapEngine/Friends.js';
import GroupEngine, { aoResponderConvite } from 'Engine/MapEngine/Group.js';
import { ehCelularEmPe } from 'UI/hudVertical.js';
import htmlText from './AmigosIdle.html?raw';
import cssText from './AmigosIdle.css?raw';
import { fecharEEsquecer } from '../limpezaDeJanelaIdle.js';
import { criarControladorDosAmigos } from './controladorDosAmigos.js';
import { ouvirFalaDoSistema } from './ouvidoDaFala.js';

const WINDOW_WIDTH = 380;
const WINDOW_HEIGHT = 520;

/* O tamanho REAL na tela: a folha usa `min()`, e no celular e menor que a constante. */
function larguraNaTela() {
	return Math.min(WINDOW_WIDTH, Math.max(0, Renderer.width - 16));
}

function alturaNaTela() {
	return Math.min(WINDOW_HEIGHT, Math.max(0, Renderer.height - 132));
}

const AmigosIdle = new GUIComponent('AmigosIdle', cssText);

AmigosIdle.render = () => htmlText;

AmigosIdle.mouseMode = GUIComponent.MouseMode.CROSS;

/** O controlador nasce no `init`, quando a shadow DOM ja existe. */
let _controlador = null;
/** A ultima lista do motor — guardada para o controlador que nasce depois dela. */
let _ultimaLista = [];

const _preferences = Preferences.get(
	'AmigosIdle',
	{
		x: null,
		y: null
	},
	1.0
);

function _root() {
	return AmigosIdle._shadow || AmigosIdle._host;
}

/** O nome do personagem em jogo, para a recusa "Esse e voce". */
function meuNome() {
	const entidade = Session.Entity;
	return (entidade && entidade.display && entidade.display.name) || '';
}

function removerAmigo(amigo) {
	// O par (AID, GID) do proprio motor: e o que o servidor procura na lista.
	const pkt = new PACKET.CZ.DELETE_FRIENDS();
	pkt.AID = amigo.AID;
	pkt.GID = amigo.GID;
	Network.sendPacket(pkt);
}

function sussurrar(nome) {
	/*
	 * No celular em pe a janela e um painel de TELA CHEIA por cima do chat: o
	 * nome iria para um campo que o jogador nao ve. Ela sai da frente primeiro,
	 * e o teclado sobe ja no chat. No desktop ela fica: o jogador pode querer
	 * mandar mensagem a mais de um amigo seguido.
	 */
	if (ehCelularEmPe()) {
		closeWindow();
	}
	ChatBox.sussurrarPara(nome);
}

AmigosIdle.limparEstadoDoPersonagem = function limparEstadoDoPersonagem() {
	/*
	 * A LISTA E DO PERSONAGEM. O servidor so manda o 0x0201 quando ha amigo
	 * (servidor-mapa.ts, `enviarListaDeAmigos`): trocar para um personagem SEM
	 * amigos deixaria a lista do anterior viva no motor — e nesta janela.
	 * `free()` nunca era chamado por ninguem.
	 */
	FriendEngine.free();
	if (_controlador) {
		_controlador.aoFechar();
	}
	fecharEEsquecer(_root(), '.am-window');
	const campo = _root() && _root().querySelector('.am-campo');
	if (campo) {
		campo.value = '';
	}
};

AmigosIdle.init = function init() {
	const root = _root();
	if (root) {
		_controlador = criarControladorDosAmigos({
			raiz: root,
			pedirAmizade: nome => FriendEngine.addFriend(nome),
			removerAmigo,
			sussurrar,
			// O convite classico (0x02c4): o mesmo do menu de contexto do jogador.
			convidar: nome => GroupEngine.onRequestInvitation(0, nome),
			grupo: () => ({ temGrupo: !!Session.hasParty, souLider: !!Session.isPartyLeader }),
			ehDoMeuGrupo: nome => !!PartyFriends.isGroupMember(nome),
			meuNome
		});
		_controlador.receberLista(_ultimaLista);

		const fechar = root.querySelector('.am-close');
		if (fechar) {
			fechar.addEventListener('click', onClickClose);
		}
		const titulo = root.querySelector('.am-titlebar');
		if (titulo) {
			this.draggable(titulo);
		}
		const corpo = root.querySelector('.am-body');
		if (corpo) {
			corpo.addEventListener('click', onClickCorpo);
			// Digitar o nome nao pode virar tecla de jogo (atalho, ESC da pilha).
			corpo.addEventListener('keydown', e => e.stopPropagation());
		}
		const form = root.querySelector('.am-adicionar');
		if (form) {
			form.addEventListener('submit', onSubmit);
		}
	}
	this._host.style.top = Math.max(0, (Renderer.height - alturaNaTela()) / 2) + 'px';
	this._host.style.left = Math.max(0, (Renderer.width - larguraNaTela()) / 2) + 'px';
};

AmigosIdle.onAppend = function onAppend() {
	if (_preferences.x != null && _preferences.y != null) {
		this._host.style.top =
			Math.min(Math.max(0, _preferences.y), Math.max(0, Renderer.height - alturaNaTela())) + 'px';
		this._host.style.left =
			Math.min(Math.max(0, _preferences.x), Math.max(0, Renderer.width - larguraNaTela())) + 'px';
	}
};

AmigosIdle.onRemove = function onRemove() {
	savePosition();
};

function savePosition() {
	_preferences.x = parseInt(AmigosIdle._host.style.left, 10) || 0;
	_preferences.y = parseInt(AmigosIdle._host.style.top, 10) || 0;
	_preferences.save();
}

AmigosIdle.toggle = function toggle() {
	const root = _root();
	const win = root && root.querySelector('.am-window');
	if (!win) {
		return;
	}
	if (win.classList.contains('is-open')) {
		closeWindow();
	} else {
		win.classList.add('is-open');
		AmigosIdle.focus();
		if (_controlador) {
			_controlador.aoAbrir();
		}
	}
};

function closeWindow() {
	const root = _root();
	const win = root && root.querySelector('.am-window');
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

function onClickCorpo(e) {
	if (!_controlador) {
		return;
	}
	if (_controlador.clicar(e.target)) {
		e.stopImmediatePropagation();
	}
}

function onSubmit(e) {
	e.preventDefault();
	e.stopImmediatePropagation();
	if (_controlador) {
		_controlador.adicionar();
	}
}

/* As tres assinaturas — a janela so desenha o que os donos dos pacotes contam. */
aoMudarAmigos(lista => {
	_ultimaLista = lista;
	if (_controlador) {
		_controlador.receberLista(lista);
	}
});

aoResultadoDeAmizade((resultado, nome) => {
	if (_controlador) {
		_controlador.receberResultadoDeAmizade(resultado, nome);
	}
});

aoResponderConvite((resposta, nome) => {
	if (_controlador) {
		_controlador.receberRespostaDoConvite(resposta, nome);
	}
});

ouvirFalaDoSistema(msg => {
	if (_controlador) {
		_controlador.receberFala(msg);
	}
});

export default UIManager.addComponent(AmigosIdle);
