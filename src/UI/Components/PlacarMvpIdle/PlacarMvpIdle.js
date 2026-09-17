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
import Preferences from 'Core/Preferences.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import arrastarPorPonteiro, { prenderNaTela } from 'UI/arrastarPorPonteiro.js';
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

/**
 * O jogador MEXEU no placar (D-1565)?
 *
 * Enquanto ele nao mexe, quem manda na posicao e o CSS — inclusive a regra do
 * celular em pe, que e `!important` no `Common.css`. Depois que ele arrasta, o
 * `data-movido` no host desarma aquela regra e a escolha dele vale: o inverso
 * faria o arrasto parecer quebrado no celular.
 */
const _preferences = Preferences.get(
	'PlacarMvpIdle',
	{
		x: null,
		y: null,
		compacto: false
	},
	1.0
);

function esconder() {
	const caixa = _root() && _root().querySelector('.pm-placar');
	const corpo = _root() && _root().querySelector('.pm-corpo');
	if (caixa) {
		caixa.hidden = true;
	}
	if (corpo) {
		corpo.innerHTML = '';
	}
}

function aplicarCompacto() {
	const caixa = _root() && _root().querySelector('.pm-placar');
	const botao = _root() && _root().querySelector('.pm-minimizar');
	if (caixa) {
		caixa.classList.toggle('is-compact', !!_preferences.compacto);
	}
	if (botao) {
		botao.innerHTML = _preferences.compacto ? '&plus;' : '&minus;';
		botao.title = _preferences.compacto ? 'Expandir' : 'Recolher';
		botao.setAttribute(
			'aria-label',
			_preferences.compacto ? 'Expandir o placar do MVP' : 'Recolher o placar do MVP'
		);
	}
}

PlacarMvpIdle.alternarCompacto = function alternarCompacto() {
	_preferences.compacto = !_preferences.compacto;
	_preferences.save();
	aplicarCompacto();
};

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
	const corpo = _root().querySelector('.pm-corpo');
	if (corpo) {
		corpo.innerHTML = html;
	}
	caixa.hidden = false;
	aplicarCompacto();
	_sumir = setTimeout(esconder, PLACAR_SOME_EM_MS);
}

PlacarMvpIdle.init = function init() {
	Network.hookPacket(PACKET.ZC.RAGIDLE_PLACAR_MVP, receber);
	const root = _root();
	if (!root) {
		return;
	}
	const minimizar = root.querySelector('.pm-minimizar');
	if (minimizar) {
		minimizar.addEventListener('click', (event) => {
			// Sem isto o clique sobe para a alca e vira um arrasto de zero
			// pixel — a faixa "pisca" sem sair do lugar.
			event.stopPropagation();
			PlacarMvpIdle.alternarCompacto();
		});
	}
	const alca = root.querySelector('.pm-alca');
	if (alca) {
		/*
		 * O PLACAR NASCE CENTRALIZADO por `transform: translateX(-50%)`, e o
		 * arrasto escreve `left` em pixel. Com o `transform` de pe, os dois se
		 * somam e a faixa pula meia largura para a esquerda no primeiro gesto.
		 *
		 * Este ouvinte entra ANTES do helper (mesma alca, mesma fase: a ordem
		 * de registro manda) e troca a centralizacao pela posicao que ela JA
		 * tem na tela — a faixa nao se move, e o gesto comeca do lugar certo.
		 */
		alca.addEventListener('pointerdown', fixarPosicaoEmPixel);
	}
	arrastarPorPonteiro({
		alca,
		painel: PlacarMvpIdle._host,
		aoSoltar: ({ left, top }) => {
			_preferences.x = left;
			_preferences.y = top;
			_preferences.save();
		}
	});
	aplicarCompacto();
};

/** Troca a centralizacao por `left`/`top` em pixel, sem mover nada na tela. */
function fixarPosicaoEmPixel() {
	const host = PlacarMvpIdle._host;
	if (!host || host.dataset.movido === '1') {
		return;
	}
	const caixa = host.getBoundingClientRect();
	host.dataset.movido = '1';
	host.style.transform = 'none';
	host.style.left = Math.round(caixa.left) + 'px';
	host.style.top = Math.round(caixa.top) + 'px';
}

/**
 * A posicao escolhida pelo jogador, se houver.
 *
 * O `transform: translateX(-50%)` do CSS centraliza o placar; com a posicao em
 * pixel ele tem de SAIR, senao a faixa fica meia largura a esquerda do ponto
 * onde ela foi solta.
 */
PlacarMvpIdle.onAppend = function onAppend() {
	if (_preferences.x == null || _preferences.y == null) {
		return;
	}
	const host = PlacarMvpIdle._host;
	host.dataset.movido = '1';
	host.style.transform = 'none';
	host.style.left = _preferences.x + 'px';
	host.style.top = _preferences.y + 'px';
	prenderNaTela(host);
	aplicarCompacto();
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
