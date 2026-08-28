/**
 * UI/Components/CorreioIdle/CorreioIdle.js
 *
 * "Correio" -- a janela da CAIXA DO SISTEMA no design system oficial (gauntlet
 * item 3, 20/08/2026). Substitui visualmente as TRES janelas nativas do RODEX
 * (Rodex = lista, ReadRodex = leitura, RodexIcon = o sino solto no canto),
 * escondidas de forma REVERSIVEL -- mesmo padrao de MochilaIdle/BasicInfoIdle:
 * "display:none" no _host, nunca .remove(), e conversa com elas por fora.
 *
 * ── O QUE O SERVIDOR REALMENTE FALA (levantado antes de desenhar) ─────────
 * Isto NAO e uma tela vazia: `rag-idle-master/servidor/caixa.ts` (D-366) e um
 * recorte real do Rodex -- **so o SISTEMA escreve; o jogador le, retira e
 * apaga**. Os handlers vivem em `servidor/mapa/servidor-mapa.ts`:
 *   - `CZ_OPEN_RODEXBOX`/`CZ_REQ_REFRESH_RODEX` -> `enviarCaixa()`  (~5676)
 *   - `CZ_REQ_READ_RODEX`   -> corpo + anexos, e marca lida         (~5694)
 *   - `CZ_REQ_ZENY_FROM_RODEX` -> credita zeny                      (~5745)
 *   - `CZ_REQ_ITEM_FROM_RODEX` -> confere PESO e credita item       (~5780)
 *   - `CZ_REQ_DELETE_RODEX` -> apaga (RECUSA em silencio se ha anexo
 *     por retirar -- `caixa.ts:197-202`)                            (~5864)
 *   - `ZC_RODEX_ICON` -> acende/apaga o indicador de nao-lida        (~2096)
 * Nada aqui e simulado no cliente: cada botao manda o pacote de verdade e o
 * que aparece na tela e o que voltou.
 *
 * O que o servidor NAO faz, e por isso esta janela nao tem: **escrever**. Nao
 * ha `REQ_SEND_RODEX`, nao ha `CHECK_RECEIVE_CHARACTER_NAME`, e o recorte
 * declara isso como escolha (caixa.ts:18-19). Entao nao ha "Nova mensagem"
 * nem "Responder" -- botao que nao tem destino nao entra (a mesma regra que
 * tirou "Organizar/+/Atalho" da Mochila).
 *
 * ── DE ONDE VEM CADA DADO ────────────────────────────────────────────────
 *   - a LISTA: `Rodex.list` (array publico, preenchido por
 *     `Rodex.initData(pkt)` em Rodex.js:139-146 quando o 0x0ac2 chega).
 *     Campos por carta: MailID, Isread, SenderName, title, openType.
 *   - o CONTEUDO: lido do DOM do host ESCONDIDO da ReadRodex nativa. Ela
 *     continua recebendo o 0x09eb e preenchendo `.title-text`/`.name`/
 *     `.content-text`/`.value`/`.item-list` normalmente (esconder o host so
 *     tira ele da TELA; o shadow root segue vivo) -- exatamente o que
 *     MochilaIdle ja faz com o host da Equipment.
 *   - o INDICADOR de nao lidas: DUAS fontes, nesta ordem. (1) a contagem de
 *     `Isread === 0` em `Rodex.list`, que e exata quando a lista ja chegou;
 *     (2) enquanto a lista nunca chegou, o proprio `ZC_RODEX_ICON` -- o motor
 *     nativo faz `RodexIcon.append()`/`.remove()` com ele (Engine/MapEngine/
 *     Rodex.js:260-266), entao "o host esta no DOM" E o sinal do servidor.
 *     Nenhuma das duas e inventada, e nenhuma exige fisgar pacote.
 *
 * ── POR QUE POLLING, E NAO hookPacket ────────────────────────────────────
 * `Network.hookPacket()` **SOBRESCREVE** (NetworkManager.js:200-210 guarda UM
 * callback por pacote). Fisgar qualquer ACK do correio trocaria em silencio o
 * handler de Engine/MapEngine/Rodex.js e quebraria o que ja funciona. Entao,
 * como toda janela RAGIDLE: tique de 250 ms lendo estado.
 *
 * ── O QUE ESTA JANELA NAO CONSEGUE MOSTRAR, E POR QUE ────────────────────
 *   - **Se uma carta da LISTA tem anexo**: o bloco de 41 bytes tem o campo
 *     (o cliente le como `Mail.type`, PacketStructure.js:11921-11930), mas o
 *     servidor manda `classe: 0` fixo (`enviarCaixa`, servidor-mapa.ts:2107).
 *     Entao a lista nao sabe, e nao ha icone de anexo por linha -- inventar um
 *     seria mentir. O anexo aparece na LEITURA, que e onde o dado existe.
 *   - **A DATA de cada carta**: o 0x0ac2 nao carrega `regDateTime` (so o
 *     0x09f0 antigo carrega), e `expiraEm` vai 0 de proposito -- carta do
 *     sistema nao expira. Sem dado, sem campo: nada de "0 dias".
 *   - **O NOME do item anexado**: a ReadRodex nativa desenha o icone e a
 *     quantidade mas nao guarda o `ITID` em lugar nenhum do DOM, e o unico
 *     jeito de obte-lo seria fisgar o 0x09eb (ver acima). Mostramos icone +
 *     quantidade, que sao reais, e nenhum nome falso.
 *
 * @author RagIdle
 */

import Renderer from 'Renderer/Renderer.js';
import Preferences from 'Core/Preferences.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import Rodex from 'UI/Components/Rodex/Rodex.js';
import ReadRodex from 'UI/Components/Rodex/ReadRodex.js';
import RodexIcon from 'UI/Components/Rodex/RodexIcon.js';
import htmlText from './CorreioIdle.html?raw';
import cssText from './CorreioIdle.css?raw';

/**
 * Mantido em sincronia com ":host"/".co-window"/".co-frame" em
 * CorreioIdle.css -- cicatriz D-341, a mesma anotada em MochilaIdle.js.
 */
const WINDOW_WIDTH = 560;
const WINDOW_HEIGHT = 360;

/** Mesma cadencia das outras janelas RAGIDLE. */
const POLL_INTERVAL_MS = 250;

/**
 * Espera antes de pedir a lista de novo depois de LER ou APAGAR.
 *
 * Existe porque o cliente nativo **nao atualiza `Rodex.list`** nesses dois
 * casos: `rodexDelete` so reescreve o DOM da lista nativa
 * (`Rodex.updateDeletedMailContent`) e a leitura nao mexe no array nenhum.
 * Quem tem a verdade e o servidor, entao a gente repede -- e de quebra e o
 * refresh que corrige o "lida/nao lida" e o indicador do menu.
 */
const REPEDIR_LISTA_MS = 600;

/**
 * Espera antes de concluir que um pedido de APAGAR foi recusado.
 *
 * A recusa do servidor e SILENCIOSA de proposito (o 0x09f6 so sai no sucesso
 * -- servidor-mapa.ts:5869-5871), entao a unica observacao limpa e "a carta
 * continuou na lista depois do refresh". Mesma tecnica de FALLBACK POR
 * AUSENCIA DE MUDANCA que MochilaIdle usa para equipar/tirar.
 */
const RECUSA_DELAY_MS = 1500;

/** Quanto tempo o aviso de recusa fica na tela. */
const AVISO_MS = 3600;

const MSG_APAGAR_RECUSADO =
	'Não foi possível apagar: retire o anexo desta mensagem primeiro.';

/**
 * Create Component
 */
const CorreioIdle = new GUIComponent('CorreioIdle', cssText);

CorreioIdle.render = () => htmlText;

/**
 * Mesmo modo dos outros flutuantes/janelas RAGIDLE: clique na cena atravessa
 * a UI quando o mouse nao esta sobre um elemento clicavel de verdade.
 */
CorreioIdle.mouseMode = GUIComponent.MouseMode.CROSS;

/**
 * @var {Preferences} posicao da janela -- centralizada por padrao, igual
 * MochilaIdle/StatusIdle.
 */
const _preferences = Preferences.get(
	'CorreioIdle',
	{
		x: null,
		y: null
	},
	1.0
);

/** @var {number|null} handle do polling. */
let _pollTimer = null;

/** @var {number|null} MailID aberto no painel direito; null = nenhum. */
let _selecionada = null;

/** @var {string|null} assinatura da ultima lista desenhada. */
let _sigLista = null;

/** @var {string|null} assinatura do ultimo detalhe desenhado. */
let _sigDetalhe = null;

/** @var {number|null} handle do timeout do aviso. */
let _avisoTimer = null;

/**
 * @var {Array|null} a referencia do array VIRGEM de `Rodex.list` (o literal
 * `[]` que Rodex.js:30 cria e ninguem toca ate o primeiro 0x0ac2 chegar).
 *
 * E o unico jeito honesto de distinguir "o servidor respondeu e a caixa esta
 * vazia" de "o servidor ainda nao respondeu": `Rodex.initData` ATRIBUI um
 * array NOVO (`Rodex.list = pkt.MailList`), entao a identidade do objeto
 * muda mesmo quando a lista volta vazia. Sem isso a janela diria "Voce nao
 * tem mensagens" para um servidor mudo, que e exatamente o tipo de mentira
 * que a regra 1 deste projeto proibe.
 */
let _listaVirgem = null;

/** @var {number} quando o ultimo pedido de lista saiu (Date.now()). */
let _pedidoEm = 0;

/**
 * Depois disto sem resposta, a janela FALA que o servidor nao respondeu, em
 * vez de continuar dizendo "carregando" para sempre.
 */
const ESPERA_DO_SERVIDOR_MS = 8000;

/**
 * @var {MutationObserver[]} os observadores que mantem os hosts nativos
 * escondidos -- ver travarHostNativo().
 */
const _observadores = [];

/**
 * @var {Set} quais nativos ja estao travados. O host de um GUIComponent so
 * nasce no `prepare()`, e nem todos os tres sao preparados no mesmo momento
 * -- ver o tique.
 */
const _travados = new Set();

function _root() {
	return CorreioIdle._shadow || CorreioIdle._host;
}

/**
 * As funcoes de rede do correio sao enxertadas no objeto `Rodex` por
 * Engine/MapEngine/Rodex.js (que o MapEngine importa). Se alguma faltar, o
 * certo e FALHAR ALTO dizendo o que falta -- nunca desenhar uma janela que
 * parece funcionar e nao manda pacote nenhum.
 */
function exigirRede(nome) {
	if (typeof Rodex[nome] !== 'function') {
		throw new Error(
			`[CorreioIdle] Rodex.${nome}() nao existe. ` +
				'Ele e enxertado por Engine/MapEngine/Rodex.js -- confira se o RodexEngine foi inicializado.'
		);
	}
	return Rodex[nome];
}

/**
 * Esconde um host nativo de forma REVERSIVEL e o mantem escondido.
 *
 * Por que MutationObserver e nao so o tique de 250 ms: os tres nativos
 * reacendem o proprio host DENTRO do handler do pacote
 * (`Rodex.initData`/`ReadRodex.initData` fazem `_host.style.display = ''`).
 * Com polling puro, cada leitura piscava a janela nativa por ate 250 ms na
 * cara do jogador. O observador devolve o `display:none` no MESMO tique de
 * microtask, entao nao ha quadro nenhum com a janela antiga visivel.
 * Continua REVERSIVEL: nada e removido, e desligar o observador basta.
 */
function travarHostNativo(componente) {
	if (!componente || _travados.has(componente)) {
		return;
	}
	const host = componente._host;
	if (!host) {
		return;
	}
	_travados.add(componente);
	host.style.display = 'none';
	const obs = new MutationObserver(() => {
		if (host.style.display !== 'none') {
			host.style.display = 'none';
		}
	});
	obs.observe(host, { attributes: true, attributeFilter: ['style'] });
	_observadores.push(obs);
}

/**
 * Trava os TRES nativos do correio.
 *
 * `ReadRodex` e o caso chato: ele NAO e preparado pelo MapEngine (so
 * `Rodex`/`RodexIcon` sao), entao o `_host` dele so nasceria no primeiro
 * `append()`, que acontece dentro do handler do 0x09eb -- tarde demais para
 * travar antes de aparecer. `prepare()` e o metodo publico que cria o host
 * SEM po-lo no DOM, e chama-lo aqui e a mesma coisa que o MapEngine faz com
 * as outras janelas, so que no momento em que o Correio precisa.
 */
function travarNativos() {
	ReadRodex.prepare();
	travarHostNativo(Rodex);
	travarHostNativo(ReadRodex);
	travarHostNativo(RodexIcon);
}

function destravarHostsNativos() {
	while (_observadores.length) {
		_observadores.pop().disconnect();
	}
	_travados.clear();
}

/**
 * One-time setup.
 */
CorreioIdle.init = function init() {
	const root = _root();

	// A referencia do array antes de qualquer resposta -- ver `_listaVirgem`.
	_listaVirgem = Rodex.list;

	this.draggable(root.querySelector('.co-header-esq'));

	root.querySelector('.co-close').addEventListener('click', onClickFechar);

	// Delegacao: as linhas da lista sao reconstruidas a cada mudanca, entao o
	// listener mora no container, que nunca e recriado.
	root.querySelector('.co-lista').addEventListener('click', onClickLista);
	root.querySelector('.co-painel-esq').addEventListener('click', onClickAcao);
	root.querySelector('.co-painel-dir').addEventListener('click', onClickAcao);

	this._host.style.top = Math.max(0, (Renderer.height - WINDOW_HEIGHT) / 2) + 'px';
	this._host.style.left = Math.max(0, (Renderer.width - WINDOW_WIDTH) / 2) + 'px';
};

CorreioIdle.onAppend = function onAppend() {
	if (_preferences.x != null && _preferences.y != null) {
		this._host.style.top = Math.min(Math.max(0, _preferences.y), Renderer.height - WINDOW_HEIGHT) + 'px';
		this._host.style.left = Math.min(Math.max(0, _preferences.x), Renderer.width - WINDOW_WIDTH) + 'px';
	}

	travarNativos();

	sincronizarTudo();
	iniciarPolling();
};

CorreioIdle.onRemove = function onRemove() {
	pararPolling();
	destravarHostsNativos();
	salvarPosicao();
};

function salvarPosicao() {
	_preferences.x = parseInt(CorreioIdle._host.style.left, 10) || 0;
	_preferences.y = parseInt(CorreioIdle._host.style.top, 10) || 0;
	_preferences.save();
}

function iniciarPolling() {
	pararPolling();
	_pollTimer = setInterval(tique, POLL_INTERVAL_MS);
}

function pararPolling() {
	if (_pollTimer != null) {
		clearInterval(_pollTimer);
		_pollTimer = null;
	}
}

function tique() {
	// Defensivo, e barato: se algum dos tres nativos ganhou host depois (ou
	// um observador foi perdido numa troca de mapa), ele volta a ficar
	// escondido em ate um tique -- mesma guarda que MochilaIdle faz com
	// Inventory/Equipment todo tique.
	travarNativos();
	if (estaAberta()) {
		manterNaTela();
		repedirSeORetratoEnvelheceu();
		sincronizarTudo();
	}
}

/**
 * @var {number} quando o repedido automatico abaixo saiu pela ultima vez.
 */
let _repedidoAutoEm = 0;

/**
 * Com a JANELA ABERTA, o retrato da lista nao pode ficar mentindo.
 *
 * O caso: a lista chegou vazia, e depois uma carta caiu na caixa. O servidor
 * avisa com o 0x09e7, mas NAO reenvia a lista -- entao a janela mostraria
 * "Nenhuma mensagem" com o ponto de nao-lida aceso ao lado. Aqui a janela
 * repede sozinha, no maximo uma vez a cada 3 s (a condicao se resolve na
 * primeira, porque a lista nova ja traz a carta).
 */
function repedirSeORetratoEnvelheceu() {
	if (!iconeDoServidorAceso() || !listaConhecida() || quantasNaoLidas() > 0) {
		return;
	}
	const agora = Date.now();
	if (agora - _repedidoAutoEm < 3000) {
		return;
	}
	_repedidoAutoEm = agora;
	repedirLista();
}

/**
 * Guarda contra a janela encostar na borda da tela.
 *
 * A posicao e calculada uma vez (centro da tela do momento em que a janela
 * foi preparada). Numa tela mais BAIXA a janela ficava com a borda de baixo
 * exatamente no ultimo pixel -- medido a 1280x720 na prova, o rodape aparecia
 * mas a moldura arredondada era cortada. O clamp que o GUIComponent faz sozinho
 * encosta sem folga; aqui a folga e explicita.
 */
const MARGEM_DE_TELA = 8;

function manterNaTela() {
	const host = CorreioIdle._host;
	if (!host) {
		return;
	}
	const maxTop = Math.max(0, Renderer.height - WINDOW_HEIGHT - MARGEM_DE_TELA);
	const maxLeft = Math.max(0, Renderer.width - WINDOW_WIDTH - MARGEM_DE_TELA);
	const top = parseInt(host.style.top, 10) || 0;
	const left = parseInt(host.style.left, 10) || 0;
	if (top > maxTop) {
		host.style.top = maxTop + 'px';
	}
	if (left > maxLeft) {
		host.style.left = maxLeft + 'px';
	}
}

function sincronizarTudo() {
	sincronizarLista();
	sincronizarDetalhe();
	sincronizarRodape();
}

function estaAberta() {
	const root = _root();
	const win = root && root.querySelector('.co-window');
	return !!(win && win.classList.contains('is-open'));
}

/**
 * A caixa do personagem, do jeito que o servidor mandou. `Rodex.list` comeca
 * `[]` e so e preenchido pelo 0x0ac2.
 */
function cartas() {
	return Array.isArray(Rodex.list) ? Rodex.list : [];
}

/** O servidor ja respondeu a caixa alguma vez? Ver `_listaVirgem`. */
function listaConhecida() {
	return _listaVirgem !== null && Rodex.list !== _listaVirgem;
}

/** Pedimos e ainda nao veio resposta nenhuma, passado o tempo de espera? */
function servidorMudo() {
	return !listaConhecida() && _pedidoEm > 0 && Date.now() - _pedidoEm > ESPERA_DO_SERVIDOR_MS;
}

/** Toda saida de pedido de lista passa por aqui, para o relogio ser um so. */
function pedirLista() {
	_pedidoEm = Date.now();
	exigirRede('openRodexBox')(0, 0);
}

function repedirLista() {
	_pedidoEm = Date.now();
	exigirRede('requestRefreshRodexPage')(0, 0);
}

function quantasNaoLidas() {
	return cartas().filter(m => !m.Isread).length;
}

/**
 * O sinal AO VIVO do servidor: ha carta por ler?
 *
 * O motor nativo APENDA o RodexIcon quando o 0x09e7 chega com "mostrar 1" e o
 * REMOVE com "mostrar 0" (Engine/MapEngine/Rodex.js:260-266). Entao "o host
 * tem pai" E, literalmente, o ultimo que o servidor disse -- e o servidor diz
 * nos dois momentos que importam: quando entrega uma carta
 * (`entregarNaCaixa`, servidor-mapa.ts:2096) e quando a ultima nao-lida e
 * lida (`~5739`).
 */
function iconeDoServidorAceso() {
	return !!(RodexIcon._host && RodexIcon._host.parentNode);
}

/**
 * Ha mensagem por ler? PUBLICO -- e o que o icone do menu (TopMenuIdle) usa
 * para acender o ponto de notificacao.
 *
 * As duas fontes entram em OU, e a ordem NAO e "lista primeiro". Isto foi
 * medido: com a lista ja carregada e VAZIA, uma carta que chega depois nao
 * mexe em `Rodex.list` (o servidor manda so o 0x09e7; a lista so muda quando
 * alguem a repede). Confiar na lista sozinha deixava o ponto APAGADO com
 * carta nova na caixa -- a foto da rodada anterior mostrou exatamente isso.
 * A lista e um retrato que envelhece; o 0x09e7 e o sinal vivo.
 */
CorreioIdle.temNaoLidas = function temNaoLidas() {
	return iconeDoServidorAceso() || (listaConhecida() && quantasNaoLidas() > 0);
};

/**
 * Quantas por ler -- `null` sempre que o numero exato nao for conhecido:
 * a lista nunca chegou, OU ela chegou mas o servidor ja acendeu o sinal por
 * uma carta que aquele retrato nao continha. Nunca devolve um numero
 * adivinhado.
 */
CorreioIdle.quantasNaoLidas = function quantasNaoLidasPublico() {
	if (!listaConhecida()) {
		return null;
	}
	const pelaLista = quantasNaoLidas();
	if (pelaLista === 0 && iconeDoServidorAceso()) {
		return null;
	}
	return pelaLista;
};

/**
 * Show/hide -- mesmo mecanismo das outras janelas RAGIDLE.
 *
 * Abrir PEDE a caixa (0x09e6): a lista nao existe no cliente ate o servidor
 * mandar, e e esse pedido que a traz.
 */
CorreioIdle.toggle = function toggle() {
	const root = _root();
	const win = root.querySelector('.co-window');
	if (win.classList.contains('is-open')) {
		win.classList.remove('is-open');
		salvarPosicao();
		exigirRede('closeRodexBox')();
	} else {
		win.classList.add('is-open');
		CorreioIdle.focus();
		manterNaTela();
		pedirLista();
		sincronizarTudo();
	}
};

function onClickFechar(e) {
	e.stopImmediatePropagation();
	CorreioIdle.toggle();
}

/**
 * Clique numa linha da lista = LER (0x09ea). O servidor responde com o corpo
 * e marca a carta como lida; o refresh logo depois e quem faz a lista e o
 * indicador do menu contarem a verdade nova.
 */
function onClickLista(e) {
	const li = e.target.closest('.co-item');
	if (!li) {
		return;
	}
	e.stopImmediatePropagation();
	const id = parseInt(li.dataset.id, 10);
	if (isNaN(id)) {
		return;
	}
	_selecionada = id;
	esconderConfirmacao();
	exigirRede('requestReadRodex')(0, id);
	setTimeout(repedirLista, REPEDIR_LISTA_MS);
	// Redesenha ja com a linha selecionada, sem esperar o tique.
	_sigLista = null;
	sincronizarLista();
}

/**
 * Os botoes -- um `case` por `data-acao`, e todo `data-acao` do .html tem o
 * seu. (Ja aconteceu neste projeto de um botao ter atributo e nao ter case,
 * deixando a acao inalcancavel.)
 */
function onClickAcao(e) {
	const btn = e.target.closest('[data-acao]');
	if (!btn) {
		return;
	}
	e.stopImmediatePropagation();

	switch (btn.dataset.acao) {
		case 'atualizar':
			repedirLista();
			break;

		case 'zeny':
			if (_selecionada != null) {
				exigirRede('requestZenyFromRodex')(0, _selecionada);
			}
			break;

		case 'itens':
			if (_selecionada != null) {
				exigirRede('requestItemsFromRodex')(0, _selecionada);
			}
			break;

		case 'apagar':
			mostrarConfirmacao();
			break;

		case 'apagar-sim':
			esconderConfirmacao();
			apagarSelecionada();
			break;

		case 'apagar-nao':
			esconderConfirmacao();
			break;

		default:
			break;
	}
}

function mostrarConfirmacao() {
	const root = _root();
	root.querySelector('.co-confirma').hidden = false;
	root.querySelector('.co-acoes').hidden = true;
}

function esconderConfirmacao() {
	const root = _root();
	root.querySelector('.co-confirma').hidden = true;
	root.querySelector('.co-acoes').hidden = false;
}

/**
 * Apagar (0x09f5) + a checagem de recusa por AUSENCIA DE MUDANCA.
 *
 * O servidor recusa em silencio quando ha anexo por retirar (`caixa.ts`
 * `apagar()` devolve `null`, e o ack so sai no sucesso). Entao o unico jeito
 * honesto de saber e repedir a lista e olhar se a carta ficou.
 */
function apagarSelecionada() {
	const id = _selecionada;
	if (id == null) {
		return;
	}
	exigirRede('requestDeleteRodex')(0, id);
	setTimeout(repedirLista, REPEDIR_LISTA_MS);
	setTimeout(() => {
		if (cartas().some(m => Number(m.MailID) === id)) {
			mostrarAviso(MSG_APAGAR_RECUSADO);
		}
	}, RECUSA_DELAY_MS);
}

function mostrarAviso(msg) {
	const root = _root();
	const el = root.querySelector('.co-aviso');
	if (!el) {
		return;
	}
	el.textContent = msg;
	el.hidden = false;
	if (_avisoTimer) {
		clearTimeout(_avisoTimer);
	}
	_avisoTimer = setTimeout(() => {
		el.hidden = true;
		_avisoTimer = null;
	}, AVISO_MS);
}

/**
 * A LISTA. So reconstroi quando a assinatura muda (id + lida + selecao), pra
 * nao recriar <img> a cada 250 ms.
 */
function sincronizarLista() {
	const root = _root();
	const lista = cartas();

	/*
	 * A assinatura carrega tambem o ESTADO DA RESPOSTA, porque o painel vazio
	 * tem tres textos diferentes (esperando / vazia de verdade / servidor
	 * mudo) e o do meio nao pode ser desenhado antes do primeiro 0x0ac2.
	 */
	const estadoDaResposta = listaConhecida() ? 'ok' : servidorMudo() ? 'mudo' : 'esperando';
	const sig =
		String(_selecionada) +
		'|' +
		estadoDaResposta +
		'|' +
		lista.map(m => `${m.MailID}:${m.Isread ? 1 : 0}`).join(',');
	if (sig === _sigLista) {
		return;
	}
	_sigLista = sig;

	const ul = root.querySelector('.co-lista');
	const vazio = root.querySelector('.co-vazio');

	if (lista.length === 0) {
		ul.innerHTML = '';
		ul.hidden = true;
		vazio.hidden = false;
		desenharPainelVazio(root, estadoDaResposta);
		return;
	}

	ul.hidden = false;
	vazio.hidden = true;
	ul.innerHTML = '';

	for (const carta of lista) {
		const id = Number(carta.MailID);
		const lida = !!carta.Isread;
		const li = document.createElement('li');
		li.className = 'co-item' + (lida ? '' : ' is-nao-lida') + (id === _selecionada ? ' is-selecionada' : '');
		li.dataset.id = String(id);
		li.title = carta.title || '';

		// Arte REAL do cliente (envelope fechado/aberto do rodexsystem,
		// convertida por rag-idle-master/scripts/icones-de-menu.ts) -- e o
		// MESMO par que a lista nativa escolhe por carta (Rodex.js:174).
		const img = document.createElement('img');
		img.className = 'co-item-envelope';
		img.alt = '';
		img.src = lida ? '/ragidle/dock-icons/correioLido.png' : '/ragidle/dock-icons/correio.png';

		const texto = document.createElement('div');
		texto.className = 'co-item-texto';
		const titulo = document.createElement('span');
		titulo.className = 'co-item-titulo';
		titulo.textContent = carta.title || '';
		const remetente = document.createElement('span');
		remetente.className = 'co-item-remetente';
		remetente.textContent = carta.SenderName || '';
		texto.appendChild(titulo);
		texto.appendChild(remetente);

		li.appendChild(img);
		li.appendChild(texto);
		ul.appendChild(li);
	}
}

/**
 * "1.234.567" — separador de milhar PT-BR, o MESMO algoritmo do `formatZeny`
 * de BasicInfoIdle.js (a copia local e a convencao ja usada por
 * StatusIdle.js:345, que traz a mesma nota).
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
 * Os TRES textos do painel esquerdo sem cartas.
 *
 * "Voce nao tem mensagens" e uma AFIRMACAO sobre o servidor, e por isso so
 * pode aparecer depois que ele respondeu (ver `_listaVirgem`). Antes disso a
 * janela diz que esta esperando; e se a resposta nao vier, ela FALA que nao
 * veio, em vez de fingir uma caixa vazia. E a regra 1 aplicada a uma tela.
 */
function desenharPainelVazio(root, estadoDaResposta) {
	const titulo = root.querySelector('.co-vazio-titulo');
	const texto = root.querySelector('.co-vazio-texto');
	if (!titulo || !texto) {
		return;
	}
	if (estadoDaResposta === 'ok') {
		titulo.textContent = 'Você não tem mensagens';
		texto.textContent = 'Recompensas e avisos do sistema chegam aqui.';
	} else if (estadoDaResposta === 'mudo') {
		titulo.textContent = 'O servidor não respondeu';
		texto.textContent = 'O pedido da caixa (0x09e6) saiu e nada voltou. Tente "Atualizar".';
	} else {
		titulo.textContent = 'Carregando…';
		texto.textContent = 'Pedindo a caixa ao servidor.';
	}
}

/**
 * O CONTEUDO, lido do host escondido da ReadRodex nativa.
 *
 * `ReadRodex.MailID` so vale depois que o 0x09eb daquela carta chegou -- por
 * isso a comparacao com `_selecionada`: enquanto a resposta nao vem, o painel
 * fica no estado "nenhuma mensagem aberta" em vez de mostrar a anterior.
 */
function sincronizarDetalhe() {
	const root = _root();
	const detalhe = root.querySelector('.co-detalhe');
	const vazio = root.querySelector('.co-detalhe-vazio');

	const pronto = _selecionada != null && Number(ReadRodex.MailID) === _selecionada;
	if (!pronto) {
		detalhe.hidden = true;
		vazio.hidden = false;
		_sigDetalhe = null;
		return;
	}

	const lido = lerDaReadRodex();
	const sig = JSON.stringify(lido);
	detalhe.hidden = false;
	vazio.hidden = true;
	if (sig === _sigDetalhe) {
		return;
	}
	_sigDetalhe = sig;

	root.querySelector('.co-msg-titulo').textContent = lido.titulo;
	root.querySelector('.co-msg-remetente').textContent = lido.remetente ? `de ${lido.remetente}` : '';
	root.querySelector('.co-msg-corpo').textContent = lido.corpo;

	/*
	 * `.value` da ReadRodex nativa e SEMPRE preenchido, inclusive com "0"
	 * quando nao ha zeny nenhum (`prettifyZeny(0)` devolve "0"). Tratar
	 * "tem texto" como "tem anexo" desenhava "ANEXOS 0 zeny" e um botao
	 * "Coletar zeny" em TODA carta de notificacao -- pego na foto da primeira
	 * rodada da prova. O criterio certo e o NUMERO, e o separador de milhar
	 * (a mesma funcao poe virgula) sai antes de converter.
	 */
	const zenyNumero = parseInt(lido.zeny.replace(/[^0-9]/g, ''), 10) || 0;
	const temZeny = zenyNumero > 0;
	const temItens = lido.itens.length > 0;

	root.querySelector('.co-anexos').hidden = !temZeny && !temItens;
	root.querySelector('.co-anexo-zeny').hidden = !temZeny;
	/*
	 * O NUMERO reformatado, e nao o texto da ReadRodex nativa.
	 *
	 * `prettifyZeny` (o formatador do upstream) escreve "5,000" -- separador
	 * de milhar em INGLES. O painel do personagem, na MESMA tela, escreve
	 * "5.000" pelo `formatZeny` da HUD. Os dois formatos visiveis ao mesmo
	 * tempo foi o que o dono viu na foto da carta do kit inicial (D-387).
	 * Como `zenyNumero` ja existe (ele e o criterio de "tem anexo?"), so
	 * falta reescrever.
	 */
	root.querySelector('.co-anexo-zeny-valor').textContent = formatZeny(zenyNumero);
	root.querySelector('.co-btn-zeny').hidden = !temZeny;
	root.querySelector('.co-btn-itens').hidden = !temItens;

	const caixaDeItens = root.querySelector('.co-anexo-itens');
	caixaDeItens.innerHTML = '';
	for (const item of lido.itens) {
		const tile = document.createElement('div');
		tile.className = 'ri-tile co-anexo-item';
		// Sem `title` com nome: o ITID nao chega ao DOM da ReadRodex (ver o
		// cabecalho do arquivo). Quantidade e icone sao reais; nome nao ha.
		const icone = document.createElement('span');
		icone.className = 'co-anexo-item-icone';
		if (item.icone) {
			icone.style.backgroundImage = item.icone;
		}
		const qtd = document.createElement('span');
		qtd.className = 'co-anexo-item-qtd';
		qtd.textContent = item.quantidade;
		tile.appendChild(icone);
		tile.appendChild(qtd);
		caixaDeItens.appendChild(tile);
	}
}

/**
 * Uma leitura pura do DOM ja renderizado do host nativo escondido.
 *
 * `.value` e `.item-list` sao ESVAZIADOS pelo proprio motor nativo quando o
 * servidor confirma a retirada (`ReadRodex.clearZeny()`/`clearItemList()`,
 * chamadas em Engine/MapEngine/Rodex.js:312/331 no ack de sucesso). E por
 * isso que "sumiu daqui" quer dizer "o servidor creditou" -- e nao um estado
 * que este arquivo adivinhou.
 */
function lerDaReadRodex() {
	const raiz = ReadRodex.getRoot();
	if (!raiz) {
		return { titulo: '', remetente: '', corpo: '', zeny: '', itens: [] };
	}
	const texto = seletor => {
		const el = raiz.querySelector(seletor);
		return el ? (el.textContent || '').trim() : '';
	};

	const itens = Array.from(raiz.querySelectorAll('.item-list .item')).map(el => {
		const icone = el.querySelector('.icon');
		const conta = el.querySelector('.count');
		return {
			icone: icone ? icone.style.backgroundImage : '',
			quantidade: conta ? (conta.textContent || '1').trim() : '1'
		};
	});

	return {
		titulo: texto('.title-text'),
		remetente: texto('.name'),
		corpo: texto('.content-text'),
		zeny: texto('.value'),
		itens: itens
	};
}

/**
 * Rodape da lista: quantas mensagens e quantas por ler. Numeros contados no
 * que o servidor mandou, nunca lembrados.
 */
function sincronizarRodape() {
	const root = _root();
	const el = root.querySelector('.co-contagem');
	if (!el) {
		return;
	}
	const total = cartas().length;
	if (!listaConhecida()) {
		// Sem resposta do servidor nao ha numero honesto a mostrar.
		el.textContent = servidorMudo() ? 'sem resposta' : '—';
		return;
	}
	if (total === 0) {
		// O sinal vivo do servidor vence o retrato velho -- ver temNaoLidas().
		el.textContent = iconeDoServidorAceso() ? 'mensagem nova a caminho' : 'Nenhuma mensagem';
		return;
	}
	const naoLidas = quantasNaoLidas();
	const plural = total === 1 ? 'mensagem' : 'mensagens';
	el.textContent = naoLidas > 0 ? `${total} ${plural} · ${naoLidas} por ler` : `${total} ${plural}`;
}

/**
 * A TROCA DE PERSONAGEM ESQUECE O CORREIO (28/08/2026).
 *
 * Voltar ao menu de personagem NAO recarrega a pagina: `onRestartAnswer` chama
 * `cleanGameUI()` e `onRestart()`, sem `GameEngine.reload()` (o reload so
 * acontece no SAIR). Todo estado de MODULO atravessa a troca — e este arquivo
 * guarda a lista, a carta aberta e as assinaturas de desenho.
 *
 * `_selecionada` e a carta ABERTA do personagem anterior, e as assinaturas
 * seguram o redesenho enquanto nao mudarem. `_listaVirgem` e a marca de "ainda
 * nao pedi": sem zerar, o novo personagem nunca pede a propria caixa.
 *
 * Chamada por `cleanGameUI()` em Engine/MapEngine.js, junto com os outros
 * componentes RAGIDLE. Quem somar estado de personagem aqui soma a linha
 * correspondente ABAIXO, e o portao `limpeza-da-troca-de-personagem.test.ts`
 * (no repo do servidor) reprova se esquecer.
 */
CorreioIdle.limparEstadoDoPersonagem = function limparEstadoDoPersonagem() {
	_selecionada = null;
	_sigLista = null;
	_sigDetalhe = null;
	_listaVirgem = null;
	_pedidoEm = 0;
	_repedidoAutoEm = 0;
};

/**
 * Create component and export it
 */
export default UIManager.addComponent(CorreioIdle);
