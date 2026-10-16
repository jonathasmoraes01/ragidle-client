/**
 * UI/Components/AusenciaIdle/AusenciaIdle.js
 *
 * RAGIDLE: "ENQUANTO VOCE ESTEVE FORA" (frente C do segundo plano, D-2565,
 * 16/10/2026).
 *
 * O pedido do dono (15/10): *"E inviavel que eu perca alguma coisa porque estou
 * com o jogo numa aba diferente, mas online."* O personagem segue cacando com a
 * aba escondida (e com o celular de tela apagada, pelo servidor); na VOLTA o
 * jogador ve o que aconteceu: a EXP, os niveis, o zeny, os monstros, os itens
 * e os avisos (morreu para um monstro, as pocoes acabaram, a mochila chegou a
 * 90%).
 *
 * Quem conta TUDO e o servidor (`servidor/idle/ausencia.ts`): a janela so
 * desenha o resumo que chega no `ZC_RAGIDLE_ECONOMIA` (`ausencia`) e, ao
 * fechar, devolve `{acao: 'visto', id}`. Sem o "visto" (a pagina congelou
 * entre o pacote e a tela) o servidor manda de novo na volta seguinte, somado
 * ao que veio depois; por isso a janela ABERTA que recebe outro resumo troca o
 * conteudo pelo novo (ele ja inclui o anterior) e guarda o id novo.
 *
 * E uma janela da PILHA (`pilhaDeJanelas`, D-931/D-932): no celular em pe ela
 * vira painel de tela cheia, o ESC e o voltar do Android a fecham, e fechar
 * por qualquer porta conta como "visto".
 *
 * This file is part of the ragidle fork of ROBrowser.
 */
import Renderer from 'Renderer/Renderer.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import DB from 'DB/DBManager.js';
import htmlText from './AusenciaIdle.html?raw';
import cssText from './AusenciaIdle.css?raw';
import { fecharEEsquecer } from '../limpezaDeJanelaIdle.js';
import { itemIconUrl } from 'Utils/ItemArt.js';
import { resumoParaATela } from './resumoDaAusencia.js';
import { localeDoIdioma } from 'Core/Idioma.js';

/* A COPIA da conta do `:host` de AusenciaIdle.css (420x520): e por ela que a janela se centraliza. */
const WINDOW_WIDTH = 420;
const WINDOW_HEIGHT = 520;

function larguraNaTela() {
	return Math.min(WINDOW_WIDTH, Math.max(0, Renderer.width - 16));
}

function alturaNaTela() {
	return Math.min(WINDOW_HEIGHT, Math.max(0, Renderer.height - 132));
}

const AusenciaIdle = new GUIComponent('AusenciaIdle', cssText);

AusenciaIdle.render = () => htmlText;

/* :host{pointer-events:none} - o clique atravessa fora da janela. */
AusenciaIdle.mouseMode = GUIComponent.MouseMode.CROSS;

/** O ultimo resumo que o servidor mandou e que o jogador ainda nao fechou. `null` = nada aberto. */
AusenciaIdle.resumo = null;

function _root() {
	return AusenciaIdle._shadow || AusenciaIdle._host;
}

function escapeHtml(value) {
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function nomeDoItem(itemId) {
	try {
		const info = DB.getItemInfo(itemId);
		return (info && (info.identifiedDisplayName || info.unidentifiedDisplayName)) || '';
	} catch (_e) {
		return '';
	}
}

function numero(n) {
	return n.toLocaleString(localeDoIdioma());
}

/**
 * A troca de personagem fecha a janela SEM "visto": o resumo e do personagem
 * de antes, e o servidor o manda de novo quando ele voltar (o mesmo contrato
 * das outras Idle, `janela-idle-esquece-o-desenho.test.ts`).
 */
AusenciaIdle.limparEstadoDoPersonagem = function limparEstadoDoPersonagem() {
	AusenciaIdle.resumo = null;
	fecharEEsquecer(_root(), '.au-window', { corpo: '.au-itens', texto: '' });
};

AusenciaIdle.init = function init() {
	const root = _root();
	if (root) {
		const fechar = root.querySelector('.au-close');
		if (fechar) {
			fechar.addEventListener('click', onClickClose);
		}
		const continuar = root.querySelector('.au-continuar');
		if (continuar) {
			continuar.addEventListener('click', onClickClose);
		}
		const titulo = root.querySelector('.au-titlebar');
		if (titulo) {
			this.draggable(titulo);
		}
	}
	centralizar();
	render();
};

function centralizar() {
	if (!AusenciaIdle._host) {
		return;
	}
	AusenciaIdle._host.style.top = Math.max(0, (Renderer.height - alturaNaTela()) / 2) + 'px';
	AusenciaIdle._host.style.left = Math.max(0, (Renderer.width - larguraNaTela()) / 2) + 'px';
}

function janela() {
	const root = _root();
	return root ? root.querySelector('.au-window') : null;
}

function abrir() {
	const win = janela();
	if (!win) {
		return;
	}
	if (!win.classList.contains('is-open')) {
		centralizar();
		// `toggle()` e a porta da pilha (ela o embrulha): abrir por ele e o que avisa a pilha de janelas.
		AusenciaIdle.toggle();
		return;
	}
	AusenciaIdle.focus();
}

/** A porta da pilha: abre (com o resumo guardado) ou fecha (e fechar e "visto"). */
AusenciaIdle.toggle = function toggle() {
	const win = janela();
	if (!win) {
		return;
	}
	if (win.classList.contains('is-open')) {
		fecharComoVisto();
	} else if (AusenciaIdle.resumo) {
		win.classList.add('is-open');
		AusenciaIdle.focus();
	}
};

function fecharComoVisto() {
	const win = janela();
	if (win) {
		win.classList.remove('is-open');
	}
	const resumo = AusenciaIdle.resumo;
	AusenciaIdle.resumo = null;
	if (resumo && Number(resumo.id) > 0) {
		const pkt = new PACKET.CZ.RAGIDLE_ECONOMIA_ACAO();
		pkt.json = JSON.stringify({ acao: 'visto', id: Number(resumo.id) });
		Network.sendPacket(pkt);
	}
}

function onClickClose(e) {
	e.stopImmediatePropagation();
	// Pela porta da pilha, para ela desempilhar (o ESC e o voltar do Android usam a mesma).
	AusenciaIdle.toggle();
}

function render() {
	const root = _root();
	if (!root) {
		return;
	}
	const tempo = root.querySelector('.au-tempo');
	const avisos = root.querySelector('.au-avisos');
	const numeros = root.querySelector('.au-numeros');
	const itens = root.querySelector('.au-itens');
	if (!tempo || !avisos || !numeros || !itens) {
		return;
	}
	if (!AusenciaIdle.resumo) {
		tempo.textContent = '';
		avisos.innerHTML = '';
		numeros.innerHTML = '';
		itens.innerHTML = '';
		return;
	}
	const tela = resumoParaATela(AusenciaIdle.resumo, nomeDoItem, numero);
	tempo.textContent = `Fora por ${tela.duracao}`;
	avisos.innerHTML = tela.avisos.map(a => '<p class="au-aviso">' + escapeHtml(a.texto) + '</p>').join('');
	numeros.innerHTML = tela.numeros
		.map(n => '<dt>' + escapeHtml(n.rotulo) + '</dt><dd>' + escapeHtml(n.valor) + '</dd>')
		.join('');
	if (tela.itens.length === 0 && tela.outros === 0) {
		itens.innerHTML = '';
		return;
	}
	itens.innerHTML =
		'<p class="au-itens-titulo">Itens recolhidos</p>' +
		tela.itens
			.map(
				it =>
					'<div class="au-item">' +
					'<img class="au-item-icone" src="' +
					escapeHtml(itemIconUrl(it.itemId)) +
					'" alt="" onerror="this.remove()">' +
					'<span class="au-item-nome">' +
					escapeHtml(it.nome) +
					'</span>' +
					'<span class="au-item-qtd">x' +
					escapeHtml(numero(it.quantidade)) +
					'</span>' +
					'</div>'
			)
			.join('') +
		(tela.outros > 0 ? '<p class="au-outros">e mais ' + escapeHtml(numero(tela.outros)) + ' itens de outros tipos</p>' : '');
}

/**
 * O servidor entregou um resumo (a volta). Abre a janela, ou troca o
 * conteudo se ela ja estava aberta: o resumo novo ja inclui o anterior.
 *
 * @param {object} resumo o `ausencia` do `ZC_RAGIDLE_ECONOMIA`
 */
AusenciaIdle.mostrar = function mostrar(resumo) {
	if (!resumo || typeof resumo !== 'object') {
		return;
	}
	AusenciaIdle.resumo = resumo;
	render();
	abrir();
};

export default UIManager.addComponent(AusenciaIdle);
