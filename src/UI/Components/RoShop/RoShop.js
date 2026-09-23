/**
 * UI/Components/RoShop/RoShop.js
 *
 * O RO SHOP (22/09/2026): a loja de consumiveis, packs, boosts, utilidades e
 * servicos de conta, paga em RO Cash. Substitui a loja de cash NATIVA do
 * roBrowser como caminho de compra (D-RS-03): o item "RO Shop" do menu e o
 * `CashShopIcon` abrem ESTA janela.
 *
 * ---------------------------------------------------------------------------
 * O SERVIDOR DECIDE TUDO, O CLIENTE SO DESENHA
 * ---------------------------------------------------------------------------
 * Contrato: `docs/ro-shop/CONTRATO.md` (rag-idle-master, branch feat/ro-shop).
 * Um CZ com JSON (`CZ_RAGIDLE_ROSHOP`, 0x0fb9) e um ZC com JSON
 * (`ZC_RAGIDLE_ROSHOP`, 0x0fb8), o mesmo padrao da Temporada. Saldo, preco,
 * disponivel, selo e o veredito da compra chegam prontos; esta janela nunca
 * calcula `saldo >= total` para decidir nada (so para AVISAR antes do clique)
 * e nunca manda preco, desconto, saldo ou item id.
 *
 * ---------------------------------------------------------------------------
 * TRES PECAS
 * ---------------------------------------------------------------------------
 * - `formatoDoRoShop.js`: a metade PURA (carrinho, filtros, HTML);
 * - `controladorDoRoShop.js`: a tela (cliques, trava, chave do checkout),
 *   sem motor nenhum - roda no jsdom e no arnes de foto;
 * - este arquivo: a COSTURA com o jogo (pacote, arrasto, pilha de janelas,
 *   icone do GRF, abrir a Temporada).
 *
 * ---------------------------------------------------------------------------
 * UM DONO POR PACOTE
 * ---------------------------------------------------------------------------
 * `Network.hookPacket` SUBSTITUI (NetworkManager.js: `callback = cb`): o
 * segundo gancho no mesmo opcode rouba o pacote do primeiro. Este arquivo e o
 * UNICO dono do 0x0fb8. O saldo da HUD continua com o dono dele
 * (`Engine/MapEngine/RagidleCash.js`, 0x0fce). Desde a rodada 2 as carteiras
 * concordam por `Utils/saldoDeCash.js`: o saldo que chega aqui e publicado la,
 * e o que chega por la (HUD, Temporada, Passe) entra na carteira desta janela.
 *
 * @author RagIdle
 */

import Renderer from 'Renderer/Renderer.js';
import Preferences from 'Core/Preferences.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import DB from 'DB/DBManager.js';
import Client from 'Core/Client.js';
import RiIcones from 'UI/ri-icones.js';
import arrastarPorPonteiro, { prenderNaTela } from 'UI/arrastarPorPonteiro.js';
import { itemIconUrl, preferirArtePublicada } from 'Utils/ItemArt.js';
import { fecharEEsquecer } from '../limpezaDeJanelaIdle.js';
import { criarControlador } from './controladorDoRoShop.js';
import { criarResolverDeIcone } from './iconeDoRoShop.js';
import { gerarChaveDeCheckout } from './formatoDoRoShop.js';
import { assinarSaldoDeCash, publicarSaldoDeCash } from 'Utils/saldoDeCash.js';
import htmlText from './RoShop.html?raw';
import cssText from './RoShop.css?raw';

/** Manter em sincronia com o `.rs-window` do CSS. */
const WINDOW_WIDTH = 1040;
const WINDOW_HEIGHT = 700;

const RoShop = new GUIComponent('RoShop', cssText);

/** Os marcadores `<!--RI_ICONE:chave-->` viram o glifo do design system. */
RoShop.render = () => htmlText.replace(/<!--RI_ICONE:([a-zA-Z0-9]+)-->/g, (_, chave) => RiIcones[chave] || '');

/** Janela fechada nao pode engolir clique de cena. */
RoShop.mouseMode = GUIComponent.MouseMode.CROSS;

/**
 * A ponte para a Temporada (o botao "Ir para Temporada"). Quem a liga e o
 * `MapEngine`, que conhece as duas janelas - um import de uma janela dentro da
 * outra prenderia a ordem de carga (mesma regra das pontes do Grupo/LFG).
 */
RoShop.aoIrParaTemporada = null;

/**
 * As pontes da DOACAO VIA PIX (23/09/2026), ligadas no `MapEngine` pela mesma
 * razao da Temporada: `aoAbrirDoacao` e o "Recarregar" com a recarga
 * disponivel; `aoDoacao` recebe as mensagens `tipo: 'doacao'` que descem no
 * 0x0fb8 - este arquivo e o UNICO dono do pacote, entao a janela de doacao so
 * as ve por aqui.
 */
RoShop.aoAbrirDoacao = null;
RoShop.aoDoacao = null;

const _preferences = Preferences.get('RoShop', { x: null, y: null }, 1.0);

function _root() {
	return RoShop._shadow || RoShop._host;
}

function janela() {
	const root = _root();
	return root ? root.querySelector('.rs-window') : null;
}

function estaAberta() {
	const win = janela();
	return !!(win && win.classList.contains('is-open'));
}

/**
 * O ICONE REAL por item id: a arte PUBLICADA primeiro (`/ragidle/item/<id>.png`,
 * que conhece os custom), o GRF depois - o mesmo caminho da Temporada. Arte
 * errada e pior que a reserva: a maca NUNCA e aceita, e a pergunta e pelo
 * CAMPO do recurso, nao pela identidade da ficha (ver `iconeDoRoShop.js`).
 */
const resolverIcone = criarResolverDeIcone({
	preferirArtePublicada,
	urlPublicada: itemIconUrl,
	fichaDoItem: itemId => DB.getItemInfo(itemId),
	carregarDoGrf: (recurso, aoCarregar, aoFalhar) =>
		Client.loadFile(DB.INTERFACE_PATH + 'item/' + recurso + '.bmp', aoCarregar, aoFalhar)
});

function enviar(corpo) {
	const pkt = new PACKET.CZ.RAGIDLE_ROSHOP();
	pkt.json = JSON.stringify(corpo);
	Network.sendPacket(pkt);
}

let _controlador = null;

function controlador() {
	if (!_controlador) {
		const root = _root();
		if (!root) {
			return null;
		}
		_controlador = criarControlador({
			raiz: root,
			enviar,
			gerarChave: gerarChaveDeCheckout,
			resolverIcone,
			aoSaldo: publicarSaldoDeCash,
			abrirTemporada: () => {
				if (typeof RoShop.aoIrParaTemporada === 'function') {
					RoShop.aoIrParaTemporada();
				}
			},
			abrirDoacao: () => {
				if (typeof RoShop.aoAbrirDoacao === 'function') {
					RoShop.aoAbrirDoacao();
				}
			}
		});
		/* O saldo que chega por FORA (HUD 0x0fce, Temporada, Passe) entra na
		   carteira desta janela - aberta ou fechada, para ela nunca reabrir com
		   um numero mais velho que o da pilula (risco P1-02). */
		const c = _controlador;
		assinarSaldoDeCash(minor => c.atualizarSaldo(minor));
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
		RoShop.toggle();
		return;
	}
	if (tratado) {
		e.stopImmediatePropagation();
	}
}

function savePosition() {
	if (!RoShop._host) {
		return;
	}
	_preferences.x = parseInt(RoShop._host.style.left, 10) || 0;
	_preferences.y = parseInt(RoShop._host.style.top, 10) || 0;
	_preferences.save();
}

RoShop.init = function init() {
	const root = _root();
	// Guardas nos querySelector: este init roda dentro de MapEngine.init, e uma
	// excecao aqui derruba o motor de mapa inteiro (ClassChangeNotice.js:68-88).
	const container = root && root.querySelector('#RoShop');
	if (container) {
		container.addEventListener('click', onClickRaiz);
		container.addEventListener('input', e => {
			const c = controlador();
			if (c) {
				c.onInput(e);
			}
		});
	}
	const titulo = root && root.querySelector('.rs-titlebar');
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

RoShop.onAppend = function onAppend() {
	if (_preferences.x != null && _preferences.y != null) {
		this._host.style.left = _preferences.x + 'px';
		this._host.style.top = _preferences.y + 'px';
	}
	// A tela de hoje pode ser menor que a de ontem (PainelComandoIdle.js).
	prenderNaTela(this._host);
};

RoShop.onRemove = function onRemove() {
	savePosition();
};

/** Abre/fecha; ao abrir, pede o estado ao servidor. */
RoShop.toggle = function toggle() {
	const win = janela();
	const c = controlador();
	if (!win || !c) {
		return;
	}
	if (win.classList.contains('is-open')) {
		win.classList.remove('is-open');
		c.fechar();
		savePosition();
	} else {
		win.classList.add('is-open');
		/* Sem posicao guardada, a janela nasce no CENTRO pelo tamanho que ela
		   TEM agora: desde a rodada 3 ela cresce em tela grande (A-05), e as
		   constantes 1040x700 do `init` a punham fora do centro. */
		if (_preferences.x == null || _preferences.y == null) {
			RoShop._host.style.left = Math.max(0, Math.round((Renderer.width - win.offsetWidth) / 2)) + 'px';
			RoShop._host.style.top = Math.max(0, Math.round((Renderer.height - win.offsetHeight) / 2)) + 'px';
		}
		RoShop.focus();
		prenderNaTela(RoShop._host);
		c.abrir();
	}
};

RoShop.estaAberta = estaAberta;

/** Troca de personagem: carrinho, estado e desenho do anterior saem. */
RoShop.limparEstadoDoPersonagem = function limparEstadoDoPersonagem() {
	const c = controlador();
	if (c) {
		c.limpar();
	}
	fecharEEsquecer(_root(), '.rs-window');
};

/**
 * O ZC_RAGIDLE_ROSHOP (0x0fb8). Defensivo: uma excecao aqui abortaria o laco
 * de rede e descartaria o resto do quadro WS (excecao-no-laco-de-rede).
 */
function onRoShopRecebido(pkt) {
	let dados;
	try {
		dados = JSON.parse(pkt.json);
	} catch (err) {
		console.error('[RoShop] payload nao e JSON valido', err);
		return;
	}
	/* A doacao via PIX fala neste mesmo pacote: o que e dela vai para ela, e
	   so. Chega aqui mesmo com a loja fechada (o `doacao-confirmada`). */
	if (dados && dados.tipo === 'doacao') {
		try {
			if (typeof RoShop.aoDoacao === 'function') {
				RoShop.aoDoacao(dados);
			}
		} catch (err) {
			console.error('[RoShop] falha ao repassar a doacao', err);
		}
		return;
	}
	try {
		const c = controlador();
		if (c) {
			c.receber(dados);
		}
	} catch (err) {
		console.error('[RoShop] falha ao desenhar o estado', err);
	}
}

Network.hookPacket(PACKET.ZC.RAGIDLE_ROSHOP, onRoShopRecebido);

export default UIManager.addComponent(RoShop);
