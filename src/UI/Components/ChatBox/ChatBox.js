/**
 * UI/Components/ChatBox/ChatBox.js
 *
 * ChatBox windows
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 *
 * ─────────────────────────────────────────────────────────────────────────
 * RAG IDLE, 20/08/2026 — o chat virou CANAIS FIXOS: Global, Trade, Farm.
 * (Em 31/08/2026 entrou o quarto, "Logs" — CANAIS abaixo e a lista de hoje.
 * Este cabecalho dizia "TRES CANAIS" muito depois de serem quatro; o numero
 * saiu daqui porque uma contagem escrita a mao envelhece e a lista nao.)
 *
 * O que mudou de mecanismo (e por que):
 *
 * 1. As abas DINAMICAS do roBrowser sairam. Elas eram criadas, renomeadas e
 *    apagadas pelo jogador, e cada uma guardava a propria lista de filtros,
 *    editavel na engrenagem (ChatBoxSettings). Com esse desenho, a regra dura
 *    desta frente — "nenhuma mensagem automatica do Farm aparece em Global ou
 *    Trade" — dependia de o jogador nao desmarcar uma caixa. Nao era garantia.
 *    Agora o canal sai de CANAL_DO_FILTRO abaixo: uma tabela FILTRO -> CANAL
 *    em que cada filtro pertence a exatamente UM canal. O roteamento e
 *    estrutural, nao configuravel, e nao depende do TEXTO da mensagem (que
 *    muda com traducao).
 *
 * 2. O ciclo de alturas de F10/".size" (updateHeight/_heightIndex) saiu, e
 *    DEPOIS voltou em duas partes — este item ficou meses descrevendo um chat
 *    de altura unica que nao existia mais:
 *      - 28/08/2026, o ARRASTO: a alca ".cb-alca" na borda de cima, com a
 *        altura em pixels persistida em "ChatBoxAltura" (o dono desfez a
 *        altura unica com "esta muito ruim, pequeno e limitado assim");
 *      - 05/09/2026, a ESCADA: o botao "1x/2x" da barra de controles, que faz
 *        o painel crescer PARA CIMA em degraus e voltar ao normal. A
 *        aritmetica mora em ./degrausDeAltura.js, fora deste arquivo, para
 *        poder ser EXECUTADA por teste.
 *    Os dois escrevem no MESMO campo (o pixel); o degrau nunca e persistido,
 *    e sempre derivado — senao o arrasto, que nao passa pelo botao, deixaria
 *    o rotulo mentindo.
 *    F10 continua alternando minimizado/aberto.
 *
 * 2b. MINIMIZAR virou minimizar de verdade (05/09/2026, pedido do dono: "que
 *    ele minimize totalmente... vai ficar so o icon pequeno pra pessoa
 *    retomar o chat"). Antes ".is-recolhido" deixava 42px de log sobre o
 *    vidro; agora esconde o painel inteiro e sobra um disco com o glifo de
 *    conversa. O disco fica FORA do que esconde — a mesma regra que
 *    TopMenuIdle registra para a alca do cluster.
 *
 * 3. O painel nao e mais arrastavel. Ele mora no canto inferior esquerdo
 *    (gabarito, secao 4) e cede espaco a barra de habilidades e ao canto
 *    inferior direito. Nao chamar draggable() tambem desliga o clamp de
 *    viewport do GUIComponent (ver o cabecalho de ChatBox.css).
 *
 * 4. A engrenagem (ChatBoxSettings) saiu junto com as abas dinamicas: sem
 *    filtro por aba para configurar, o painel so poderia mentir sobre o que
 *    controla.
 *
 * O que NAO mudou: as cores por tipo de mensagem (getColorForType), o fluxo
 * de envio (onRequestTalk/submit), o modo batalha, os comandos "/", o
 * historico de mensagem e de nick, e o link de item.
 */

import DB from 'DB/DBManager.js';
import Events from 'Core/Events.js';
import Preferences from 'Core/Preferences.js';
import KEYS from 'Controls/KeyEventHandler.js';
import Mouse from 'Controls/MouseEventHandler.js';
import Cursor from 'UI/CursorManager.js';
import BattleMode from 'Controls/BattleMode.js';
import History from './History.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import 'UI/Elements/Elements.js';
import ContextMenu from 'UI/Components/ContextMenu/ContextMenu.js';
import htmlText from './ChatBox.html?raw';
import cssText from './ChatBox.css?raw';
import Commands from 'Controls/ProcessCommand.js';
import Configs from 'Core/Configs.js';
import EntityManager from 'Renderer/EntityManager.js';
import RiIcones from 'UI/ri-icones.js';
import { emUnidadesDaHud } from 'UI/escalaDaHud.js'; // D-934: geometria medida vira unidade da HUD
import { CANAIS_QUE_FALAM_NO_GLOBAL, CANAL_DE_FALA, cabeNoLimite, markupDoLink, preparoParaLinkar } from './linkDeItemNoChat.js'; // D-946: linkar item no chat
// O GID do personagem em foco — a preferencia do chat e POR PERSONAGEM
// (spec §9), e nao por conta.
import Session from 'Engine/SessionStorage.js';
import { alturasDosDegraus, proximoDegrau, degrauAtual, rotuloDoDegrau } from './degrausDeAltura.js';

/**
 * @var {number} max message in the chatbox
 */
const MAX_MSG = 400;
const MAX_LENGTH = 100;

/**
 * @var {History} message cached in history
 */
const _historyMessage = new History();

/**
 * @var {History} nickname cached in history
 */
const _historyNickName = new History(true);

/**
 * Buffer para acumular mensagens antes de adicionar ao DOM.
 * @private
 */
let _messageBuffer = [];

/**
 * Flag que indica se um requestAnimationFrame foi agendado para processar o buffer.
 * @private
 */
let _rafScheduled = false;

/**
 * Preferencias do chat. Versao 2.0: as chaves de posicao/altura/abas
 * (x, y, height, magnet_*, tabs, tabOption) morreram com os tres canais
 * fixos e com o painel ancorado no canto — um save antigo nao pode
 * ressuscitar aba nenhuma.
 */
const _preferences = Preferences.get(
	'ChatBox',
	{
		fontScale: 1.0,
		canalAtivo: 'global'
	},
	2.0
);

/**
 * ===========================================================================
 * O LAYOUT DO CHAT — POR PERSONAGEM, E EM PORCENTAGEM DA VIEWPORT (spec §9)
 * ===========================================================================
 * Duas escolhas aqui sao contra-intuitivas e as duas sao da spec:
 *
 * 1. **Por personagem, e nao por conta.** Quem joga de Mercador com a mochila
 *    aberta e de Mago com a barra de skills nao quer o mesmo chat. A chave
 *    carrega o GID do personagem em foco.
 *
 * 2. **Em PORCENTAGEM, e nao em pixels.** Um chat gravado a 1.400px da esquerda
 *    num monitor ultrawide e um chat FORA DA TELA num notebook. Gravando em
 *    fracao da viewport, trocar de monitor reposiciona sozinho — e no load
 *    ainda passa por `clamp` contra a viewport de agora, porque porcentagem
 *    resolve o deslocamento e nao resolve o tamanho minimo.
 *
 * O `Preferences` do fork e por CHAVE de `localStorage`, e as chaves sao lidas
 * no topo do modulo — antes de existir personagem. Por isso o layout NAO usa
 * `Preferences.get` de topo: ele e lido em `onAppend`, quando ja ha GID.
 */
const PADRAO_LAYOUT = { esquerdaPct: null, baixoPct: null, largPct: null, altPct: null };
/* `tema` entra aqui junto dos interruptores porque ele e a MESMA classe de
   preferencia: gosto do jogador, por personagem, sem efeito em regra de jogo.
   O padrao e a HUD moderna — ela e a que o dono desenhou nesta rodada; a
   classica e a escolha de quem a prefere, e nao o contrario. */
const PADRAO_OPCOES = { travado: false, horario: false, repouso: true, tema: 'moderna' };
const PADRAO_ENVIOS = { enviados: 0 };

let _layout = Object.assign({}, PADRAO_LAYOUT);
let _opcoes = Object.assign({}, PADRAO_OPCOES);
let _envios = Object.assign({}, PADRAO_ENVIOS);
/** O estado de abertura, por personagem — e estado de layout. */
let _recolhido = { estado: 'aberto' };

/** As chaves que este componente grava, para o "Restaurar padrao" saber apagar. */
const SUFIXOS = ['Layout', 'Opcoes', 'Envios', 'Recolhido'];

function chaveDoPersonagem(sufixo) {
	// `Session.GID` e o id do personagem em foco. Sem ele (tela de login, ou
	// um fluxo que suba o chat antes do mapa) o chat cai numa chave COMPARTILHADA
	// em vez de nao gravar nada: perder a preferencia e pior que compartilha-la,
	// e o caso e transitorio.
	const gid = Session && Session.GID ? Session.GID : 'sem-personagem';
	return `ChatBox:${gid}:${sufixo}`;
}

function lerPreferencia(sufixo, padrao) {
	try {
		const bruto = localStorage.getItem(chaveDoPersonagem(sufixo));
		if (!bruto) return Object.assign({}, padrao);
		const lido = JSON.parse(bruto);
		// Mescla sobre o padrao: campo novo numa versao futura nasce com valor,
		// em vez de `undefined` atravessando o codigo inteiro.
		return Object.assign({}, padrao, lido);
	} catch (_e) {
		// `localStorage` lanca em janela privada e com dados de site bloqueados.
		// O chat tem de abrir do mesmo jeito.
		return Object.assign({}, padrao);
	}
}

function gravarPreferencia(sufixo, valor) {
	try {
		localStorage.setItem(chaveDoPersonagem(sufixo), JSON.stringify(valor));
	} catch (_e) {
		// Ver acima: nao gravar e aceitavel, quebrar o chat nao e.
	}
}

/** Le as quatro do personagem em foco. Chamado em `onAppend`. */
function carregarPreferenciasDoPersonagem() {
	_layout = lerPreferencia('Layout', PADRAO_LAYOUT);
	_opcoes = lerPreferencia('Opcoes', PADRAO_OPCOES);
	_envios = lerPreferencia('Envios', PADRAO_ENVIOS);
	/* `escolhido` e da D-930 e entra SEM subir versao, de proposito: um save
	   antigo chega sem o campo, `lerPreferencia` mescla sobre o padrao e ele sai
	   `false` — que e exatamente o que "este jogador nunca decidiu" quer dizer.
	   A informacao que faltava ja estava codificada na ausencia. */
	_recolhido = lerPreferencia('Recolhido', { estado: 'aberto', escolhido: false });
	/* MIGRACAO do save booleano: ate 05/09/2026 este campo era
	   `{ recolhido: true|false }`, e desde entao sao TRES estados. Sem esta
	   linha, quem tinha o chat recolhido reabriria com ele aberto — perder a
	   preferencia e pequeno, mas o custo de nao perder e uma linha. */
	if (typeof _recolhido.recolhido === 'boolean' && !_recolhido.estado) {
		_recolhido.estado = _recolhido.recolhido ? 'recolhido' : 'aberto';
	}
}

/* ===========================================================================
 * GEOMETRIA
 * ===========================================================================
 * O painel cresce para CIMA e para a DIREITA, ancorado por `left` + `bottom`.
 * Nunca por `top`: com `top` ancorado, crescer a altura empurraria a barra de
 * digitacao para baixo — e ela tem de ficar no mesmo pixel, porque o jogador
 * aperta Enter por reflexo, sem olhar.
 */

/** Os limites da spec §3, lidos dos tokens para nao haver dois donos. */
function medidaDoToken(nome, reserva) {
	try {
		const bruto = getComputedStyle(document.documentElement).getPropertyValue(nome);
		const n = parseFloat(bruto);
		return isFinite(n) && n > 0 ? n : reserva;
	} catch (_e) {
		return reserva;
	}
}

const LIMITES = {
	largMin: () => medidaDoToken('--chat-larg-min', 320),
	largMax: () => medidaDoToken('--chat-larg-max', 640),
	altMin: () => medidaDoToken('--chat-alt-min', 100),
	altMax: () => medidaDoToken('--chat-alt-max', 380),
	margem: () => medidaDoToken('--chat-margem', 10),
	encaixe: () => medidaDoToken('--chat-encaixe', 20),
};

const prender = (valor, minimo, maximo) => Math.max(minimo, Math.min(maximo, valor));

/**
 * A altura do LOG que corresponde a uma altura de PAINEL.
 *
 * A casca (faixa de arrasto, abas, divisor, barra) nao e constante: ela muda
 * com o canal (Farm e Logs nao tem barra de digitacao) e com a fonte. Por isso
 * ela e MEDIDA, e nao um numero cravado — cravar deu, na primeira tentativa,
 * um painel 12px mais alto que o pedido em todo canal so-leitura.
 */
function cascaDoPainel(root) {
	const painel = root.querySelector('#chatbox');
	const corpo = root.querySelector('.contentwrapper');
	if (!painel || !corpo) return 0;
	const alturaPainel = painel.getBoundingClientRect().height;
	const alturaLog = corpo.getBoundingClientRect().height;
	return Math.max(0, Math.round(alturaPainel - alturaLog));
}

/** Escreve largura e altura no elemento, dentro dos limites da spec. */
function aplicarTamanho(root) {
	const painel = root.querySelector('#chatbox');
	if (!painel || !painel.style) return;

	if (_layout.largPct !== null) {
		const larg = prender(
			Math.round((_layout.largPct / 100) * window.innerWidth),
			LIMITES.largMin(),
			Math.min(LIMITES.largMax(), window.innerWidth - LIMITES.margem() * 2),
		);
		painel.style.width = `${larg}px`;
	} else {
		painel.style.removeProperty('width');
	}

	if (_layout.altPct !== null) {
		const altoPainel = prender(
			Math.round((_layout.altPct / 100) * window.innerHeight),
			LIMITES.altMin(),
			Math.min(LIMITES.altMax(), window.innerHeight - LIMITES.margem() * 2),
		);
		const log = Math.max(24, altoPainel - cascaDoPainel(root));
		painel.style.setProperty('--cb-altura', `${log}px`);
	} else {
		painel.style.removeProperty('--cb-altura');
	}
}

/**
 * O CHAT PUBLICA A PROPRIA ALTURA (D-930, 05/09/2026).
 *
 * Ele nao e o unico morador do rodape: a doca ocupa a faixa de baixo, o botao
 * "Menu" e a barra de atalhos nativa querem o mesmo lugar, e em tela estreita
 * os quatro deixam de se separar no eixo X. Quem precisa se pendurar ACIMA do
 * chat nao tem como saber a altura dele — ela e arrastavel (D-707), muda com o
 * recolhido e tem um padrao relativo a viewport.
 *
 * Entao ele publica, e quem precisa le. E o MESMO idioma que o painel de
 * personagem ja usa (`--hud-basic-fundo`, BasicInfoIdle.js:328) e que o botao
 * de caca usa (`--hud-td-altura-dos-botoes`): geometria medida vira custom
 * property no `documentElement`, que atravessa shadow DOM por heranca.
 *
 * Copiar o numero do outro lado seria a armadilha que criou estes tokens: a
 * altura mudaria e a sobreposicao voltaria em silencio, longe da causa.
 */
function publicarAlturaDoChat(root) {
	const painel = (root || _root()).querySelector('#chatbox');
	if (!painel || !painel.ownerDocument) return;
	const altura = Math.round(painel.getBoundingClientRect().height);
	/* D-934: unidade da HUD. Ver `emUnidadesDaHud`. */
	painel.ownerDocument.documentElement.style.setProperty(
		'--hud-chat-altura',
		`${Math.round(emUnidadesDaHud(altura))}px`,
	);
}

/**
 * Observa a caixa do chat e republica a altura a cada mudanca real.
 *
 * `ResizeObserver` e nao polling: as tres coisas que mudam a altura — o
 * arrasto da alca, o recolher e o resize da janela — todas passam por uma
 * mudanca de caixa, e nenhuma delas e frequente. Um `setInterval` aqui seria
 * trabalho constante para um evento raro.
 */
let _observadorDoChat = null;
function observarAlturaDoChat(root) {
	if (_observadorDoChat || typeof ResizeObserver === 'undefined') return;
	const painel = root.querySelector('#chatbox');
	if (!painel) return;
	_observadorDoChat = new ResizeObserver(() => publicarAlturaDoChat(root));
	_observadorDoChat.observe(painel);
}

/**
 * A TELA E ESTREITA OU BAIXA? — o mesmo criterio das faixas do `Common.css`
 * (D-929: 599px de largura, 439px de altura), lido aqui por `matchMedia` para
 * o JS e o CSS nunca discordarem sobre o que e "celular".
 */
function ehTelaDeToque() {
	if (typeof window === 'undefined' || !window.matchMedia) return false;
	return window.matchMedia('(max-width: 599px), (max-height: 439px)').matches;
}

/**
 * Escreve a posicao, sempre CLAMPADA contra a viewport de agora.
 *
 * O clamp no load e o que cumpre o criterio de aceite "redimensionar a janela
 * para metade da largura mantem o painel inteiramente visivel": porcentagem
 * sozinha reposiciona, mas um painel de 640px numa viewport de 500 ainda
 * sairia pela direita.
 */
function aplicarPosicao(root) {
	const painel = root.querySelector('#chatbox');
	if (!painel || !painel.style) return;

	if (_layout.esquerdaPct === null || _layout.baixoPct === null) {
		painel.style.removeProperty('left');
		painel.style.removeProperty('bottom');
		return;
	}

	const caixa = painel.getBoundingClientRect();
	const margem = LIMITES.margem();
	const esquerda = prender(
		(_layout.esquerdaPct / 100) * window.innerWidth,
		margem,
		Math.max(margem, window.innerWidth - caixa.width - margem),
	);
	const baixo = prender(
		(_layout.baixoPct / 100) * window.innerHeight,
		margem,
		Math.max(margem, window.innerHeight - caixa.height - margem),
	);
	painel.style.left = `${Math.round(esquerda)}px`;
	painel.style.bottom = `${Math.round(baixo)}px`;
}

function aplicarLayout(root) {
	aplicarTamanho(root);
	aplicarPosicao(root);
}

/** Grava o layout de agora, lendo do DOM. Chamado no SOLTAR, nunca durante. */
function gravarLayout(root) {
	const painel = root.querySelector('#chatbox');
	if (!painel) return;
	const caixa = painel.getBoundingClientRect();

	_layout.largPct = (caixa.width / window.innerWidth) * 100;
	_layout.altPct = (caixa.height / window.innerHeight) * 100;
	_layout.esquerdaPct = (caixa.left / window.innerWidth) * 100;
	_layout.baixoPct = ((window.innerHeight - caixa.bottom) / window.innerHeight) * 100;

	gravarPreferencia('Layout', _layout);
}

/* ===========================================================================
 * ARRASTAR E REDIMENSIONAR
 * ===========================================================================
 * Um mecanismo so, parametrizado por eixo. Tres alcas e uma faixa de arrasto
 * escritas a mao seriam quatro copias da mesma matematica de `pointer`, e
 * "duas rotas escritas a mao" e o defeito mais repetido deste projeto.
 *
 * `pointer*` e nao `mouse*`: o `setPointerCapture` mantem os eventos vindo
 * mesmo quando o cursor sai do elemento fino, que e o caso comum de quem
 * arrasta rapido. Com `mousemove` no documento daria para fazer igual, mas
 * seria preciso lembrar de tirar o ouvinte — e ouvinte esquecido e o
 * vazamento que este fork ja consertou em outros lugares.
 */
function ligarGesto(root, seletor, aoMover, classe) {
	const alvo = root.querySelector(seletor);
	const painel = root.querySelector('#chatbox');
	if (!alvo || !painel || alvo.dataset.ligada === '1') return;
	alvo.dataset.ligada = '1';

	let inicio = null;

	alvo.addEventListener('pointerdown', event => {
		// TRAVADO: nenhum gesto comeca. A guarda mora aqui, e nao so no
		// `pointer-events` do CSS, porque a trava pode ser ligada com um
		// arrasto EM CURSO — e ai o CSS ja nao tem a quem recusar.
		if (_opcoes.travado) return;
		event.preventDefault();
		const caixa = painel.getBoundingClientRect();
		inicio = {
			x: event.clientX,
			y: event.clientY,
			larg: caixa.width,
			alt: caixa.height,
			esquerda: caixa.left,
			baixo: window.innerHeight - caixa.bottom,
		};
		painel.classList.add(classe);
		alvo.setPointerCapture(event.pointerId);
	});

	alvo.addEventListener('pointermove', event => {
		if (inicio === null || !alvo.hasPointerCapture(event.pointerId)) return;
		aoMover(painel, inicio, event.clientX - inicio.x, event.clientY - inicio.y, root);
	});

	const soltar = event => {
		if (inicio === null || !alvo.hasPointerCapture(event.pointerId)) return;
		alvo.releasePointerCapture(event.pointerId);
		painel.classList.remove(classe);
		inicio = null;
		// Grava SO no soltar: `pointermove` dispara dezenas de vezes por
		// segundo, e `localStorage.setItem` e sincrono.
		gravarLayout(root);
		atualizarBotaoDeTamanho(root);
		rolarParaOFimSeColado(root);
	};
	alvo.addEventListener('pointerup', soltar);
	alvo.addEventListener('pointercancel', soltar);
}

/** Altura: para CIMA cresce, porque o painel e ancorado embaixo. */
function moverAltura(painel, inicio, _dx, dy, root) {
	const alvo = prender(inicio.alt - dy, LIMITES.altMin(), LIMITES.altMax());
	const log = Math.max(24, Math.round(alvo - cascaDoPainel(root)));
	painel.style.setProperty('--cb-altura', `${log}px`);
}

/** Largura: para a DIREITA cresce; a borda esquerda nao se move. */
function moverLargura(painel, inicio, dx) {
	const alvo = prender(inicio.larg + dx, LIMITES.largMin(), LIMITES.largMax());
	painel.style.width = `${Math.round(alvo)}px`;
}

function moverCanto(painel, inicio, dx, dy, root) {
	moverLargura(painel, inicio, dx);
	moverAltura(painel, inicio, dx, dy, root);
}

/**
 * Mover o painel, com ENCAIXE nas bordas (spec §7) e clamp na viewport.
 *
 * O encaixe e a 20px de qualquer borda. Ele existe porque HUD que quase encosta
 * na borda parece defeito — e acertar 0px a mao, num painel que o jogador
 * arrasta com o jogo rodando, nao acontece.
 */
function moverPainel(painel, inicio, dx, dy) {
	const margem = LIMITES.margem();
	const encaixe = LIMITES.encaixe();
	const maxEsquerda = Math.max(margem, window.innerWidth - inicio.larg - margem);
	const maxBaixo = Math.max(margem, window.innerHeight - inicio.alt - margem);

	let esquerda = prender(inicio.esquerda + dx, margem, maxEsquerda);
	let baixo = prender(inicio.baixo - dy, margem, maxBaixo);

	if (esquerda - margem < encaixe) esquerda = margem;
	if (maxEsquerda - esquerda < encaixe) esquerda = maxEsquerda;
	if (baixo - margem < encaixe) baixo = margem;
	if (maxBaixo - baixo < encaixe) baixo = maxBaixo;

	painel.style.left = `${Math.round(esquerda)}px`;
	painel.style.bottom = `${Math.round(baixo)}px`;
}

/**
 * A ALTURA-BASE do log — o que o CSS daria se ninguem tivesse mexido.
 *
 * Medida no DOM, e nao copiada: o padrao vem de um token com `calc()`, e
 * `getComputedStyle` devolve a STRING da expressao para custom property nao
 * registrada, nao o pixel resolvido. Reescrever a conta em JS criaria dois
 * donos do mesmo numero.
 *
 * Os modificadores saem antes da medida e voltam depois — o acrescimo dos
 * canais sem barra descreveria um degrau que nao e a base. Leitura e escrita
 * acontecem na MESMA tarefa sincrona, entao nao ha pintura entre elas.
 *
 * `cb-redimensionando` entra durante a medida porque e a classe que desliga a
 * transicao de altura: com a transicao valendo, `getBoundingClientRect`
 * devolveria o valor INTERPOLADO de uma animacao em curso, e dois cliques
 * rapidos no botao mediriam uma base fantasma.
 */
function alturaBase(root) {
	const painel = root.querySelector('#chatbox');
	const corpo = root.querySelector('.contentwrapper');
	if (!painel || !corpo) return null;

	const MODIFICADORES = ['canal-farm', 'canal-logs', 'is-recolhido'];
	const ligados = MODIFICADORES.filter(nome => painel.classList.contains(nome));
	const inline = painel.style.getPropertyValue('--cb-altura');

	painel.classList.add('cb-redimensionando');
	ligados.forEach(nome => painel.classList.remove(nome));
	painel.style.removeProperty('--cb-altura');

	const base = Math.round(corpo.getBoundingClientRect().height);

	if (inline) painel.style.setProperty('--cb-altura', inline);
	ligados.forEach(nome => painel.classList.add(nome));
	painel.classList.remove('cb-redimensionando');

	return base > 0 ? base : null;
}

/** O acrescimo que Farm e Logs dao ao log, lido do token que o CSS define. */
function acrescimoDoCanal(painel) {
	const bruto = getComputedStyle(painel).getPropertyValue('--cb-acrescimo-do-canal');
	const n = parseFloat(bruto);
	return isFinite(n) ? n : 0;
}

/**
 * O TETO da altura do LOG, para a escada de degraus.
 *
 * Ele sai do teto de PAINEL da spec (`--chat-alt-max`) menos a casca, e nao de
 * uma fracao da tela: dois tetos discordando fariam o botao oferecer um degrau
 * que o arrasto recusa. Farm e Logs somam o acrescimo DEPOIS do `--cb-altura`,
 * entao ele tambem e descontado aqui.
 */
function tetoDeAltura(root) {
	const painel = root.querySelector('#chatbox');
	if (!painel) return 24;
	let teto = LIMITES.altMax() - cascaDoPainel(root);
	if (painel.classList.contains('canal-farm') || painel.classList.contains('canal-logs')) {
		teto -= acrescimoDoCanal(painel);
	}
	return Math.max(24, Math.round(teto));
}

/**
 * A altura do log de agora, em pixels — a fonte da verdade do degrau.
 *
 * O INLINE vem primeiro, e nao a medida do DOM. A razao e um defeito que esta
 * prova pegou: `.contentwrapper` tem `transition: height`, e medir logo depois
 * de escrever `--cb-altura` devolve o valor INTERPOLADO de uma animacao em
 * curso — nao o alvo. O botao entao recalculava o rotulo a partir da altura
 * velha e ficava eternamente em "1x", com o painel crescendo atras dele.
 *
 * O inline E o alvo: foi ele que acabou de ser escrito. So quando nao ha
 * inline (o jogador nunca mexeu) e que vale medir o que o CSS deu.
 */
function alturaAtualDoLog(root) {
	const painel = root.querySelector('#chatbox');
	const corpo = root.querySelector('.contentwrapper');
	if (!corpo) return null;

	if (painel && painel.style) {
		const inline = parseFloat(painel.style.getPropertyValue('--cb-altura'));
		if (isFinite(inline) && inline > 0) return Math.round(inline);
	}
	return Math.round(corpo.getBoundingClientRect().height);
}

/**
 * Poe o botao de tamanho em dia: rotulo, titulo e leitor de tela.
 *
 * O rotulo e DERIVADO da altura medida toda vez — nunca um segundo estado
 * guardado. Se o degrau fosse persistido ao lado do tamanho, o primeiro
 * arrasto (que nao passa pelo botao) os poria em desacordo, e um F5
 * congelaria o desacordo.
 */
function atualizarBotaoDeTamanho(root) {
	const botao = root.querySelector('.cb-tamanho');
	if (!botao) return;

	const base = alturaBase(root);
	const teto = tetoDeAltura(root);
	const alturas = alturasDosDegraus(base, teto);

	// Escada de um degrau so (tela curta demais para o 2x) = botao que o
	// jogador aperta e nada acontece. Nesse caso ele nao existe.
	botao.hidden = alturas.length < 2;
	if (botao.hidden) return;

	const atual = rotuloDoDegrau(degrauAtual(alturaAtualDoLog(root), base, teto));
	botao.textContent = atual;

	if (_opcoes.travado) {
		botao.disabled = true;
		botao.title = `Tamanho do chat: ${atual} — travado`;
		botao.setAttribute(
			'aria-label',
			`Tamanho do chat: ${atual}. Travado — destrave nas configurações para mudar.`,
		);
		return;
	}

	botao.disabled = false;
	const proximo = proximoDegrau(alturaAtualDoLog(root), base, teto);
	const acao =
		proximo.indice === 0
			? 'Clique para voltar ao normal.'
			: `Clique para ${rotuloDoDegrau(proximo.indice)}.`;
	botao.title = `Tamanho do chat: ${atual}`;
	botao.setAttribute('aria-label', `Tamanho do chat: ${atual}. ${acao}`);
}

/** Um degrau acima; depois do ultimo, de volta ao normal. */
function subirUmDegrau(root) {
	if (_opcoes.travado) return;
	const painel = root.querySelector('#chatbox');
	const proximo = proximoDegrau(alturaAtualDoLog(root), alturaBase(root), tetoDeAltura(root));
	if (proximo.altura === null || !painel) return;

	painel.style.setProperty('--cb-altura', `${proximo.altura}px`);

	/*
	 * A altura e persistida a partir do ALVO, e nao de uma medida do painel.
	 *
	 * `gravarLayout` le `getBoundingClientRect`, e aqui a transicao de altura
	 * acabou de comecar — a medida devolveria um quadro intermediario e o F5
	 * traria de volta uma altura que nunca foi escolhida. A CASCA pode ser
	 * medida sem medo: ela e a diferenca entre painel e log, e os dois estao
	 * deslocados pelo mesmo tanto durante a animacao.
	 */
	const caixa = painel.getBoundingClientRect();
	_layout.altPct = ((proximo.altura + cascaDoPainel(root)) / window.innerHeight) * 100;
	_layout.largPct = (caixa.width / window.innerWidth) * 100;
	_layout.esquerdaPct = (caixa.left / window.innerWidth) * 100;
	_layout.baixoPct = ((window.innerHeight - caixa.bottom) / window.innerHeight) * 100;
	gravarPreferencia('Layout', _layout);

	atualizarBotaoDeTamanho(root);
	rolarParaOFimSeColado(root);
}


/**
 * Create Basic Info component
 */
const ChatBox = new GUIComponent('ChatBox', cssText);

/**
 * Helper: query inside shadow root
 */
function _root() {
	return ChatBox._shadow || ChatBox._host;
}

/**
 * Render HTML — troca cada marcador "<!--RI_ICONE:chave-->" pela string SVG
 * do modulo de iconografia (UI/ri-icones.js), mesmo padrao de
 * TopMenuIdle.js/BasicInfoIdle.js.
 */
ChatBox.render = () => htmlText.replace(/<!--RI_ICONE:(\w+)-->/g, (_, chave) => RiIcones[chave] || '');

/**
 * Has input fields, protect key events
 */
ChatBox.captureKeyEvents = true;

/**
 * Constants
 */
ChatBox.TYPE = {
	SELF: 1 << 0,
	PUBLIC: 1 << 1,
	PRIVATE: 1 << 2,
	PARTY: 1 << 3,
	GUILD: 1 << 4,
	ANNOUNCE: 1 << 5,
	ERROR: 1 << 6,
	INFO: 1 << 7,
	BLUE: 1 << 8,
	ADMIN: 1 << 9,
	MAIL: 1 << 10,
	CLAN: 1 << 11
};

/**
 * Os filtros 0..21 sao os do roBrowser/rAthena e NAO podem mudar de numero:
 * cada "ChatBox.addText(..., FILTER.X)" espalhado por Engine/ e UI/ os cita.
 *
 * Os de 22 em diante sao do Rag Idle. Eles existem para o log automatico do
 * idle ter uma ORIGEM propria em vez de dividir "FILTER.ITEM" com as
 * mensagens de acao do jogador (equipar, usar, nao conseguir pegar) — sem
 * eles, separar "caiu um item da caca" de "voce nao pode equipar isso" so
 * daria por texto, que quebra com traducao.
 */
ChatBox.FILTER = {
	PUBLIC_LOG: 0,
	PUBLIC_CHAT: 1,
	WHISPER: 2,
	PARTY: 3,
	GUILD: 4,
	ITEM: 5,
	EQUIP: 6,
	STATUS: 7,
	PARTY_ITEM: 8,
	PARTY_STATUS: 9,
	SKILL_FAIL: 10,
	PARTY_SETUP: 11,
	EQUIP_DAMAGE: 12,
	WOE: 13,
	PARTY_SEARCH: 14,
	BATTLE: 15,
	PARTY_BATTLE: 16,
	EXP: 17,
	PARTY_EXP: 18,
	QUEST: 19,
	BATTLEFIELD: 20,
	CLAN: 21,
	// Rag Idle — log automatico da caca
	FARM_ITEM: 22,
	FARM_EXP: 23,
	FARM_ZENY: 24,
	FARM_NIVEL: 25,
	FARM_LOG: 26,
	// Rag Idle — canal de comercio (SEM FONTE no servidor de mapa de hoje)
	TRADE: 27,
	/*
	 * Rag Idle — a FALA DO SISTEMA (31/08/2026, pedido do dono).
	 *
	 * Missoes, NPCs, respostas de comando, avisos de loja: tudo o que o
	 * SERVIDOR diz e nao e jogador nem anuncio da staff. Chega pelo opcode
	 * proprio 0x0fe2 (ZC_RAGIDLE_LOG), e nao pelo 0x008e — que carrega tambem
	 * o eco da fala do proprio jogador e por isso nao dava para separar.
	 */
	SISTEMA: 28
};

/**
 * Os tres canais, na ordem em que aparecem.
 */
const CANAIS = ['global', 'guilda', 'party', 'trade', 'farm', 'logs'];

/**
 * ROTULO por canal, para a etiqueta que abre cada linha.
 *
 * A etiqueta e TEXTO e nao so cor (spec §10): coral (guilda) e dourado (trade)
 * ficam proximos para daltonicos do tipo protanopia, entao "[Guilda]" escrito
 * e obrigatorio. A cor e reforco, nunca o unico sinal.
 */
const ROTULO_DO_CANAL = {
	global: 'Global',
	guilda: 'Guilda',
	party: 'Party',
	trade: 'Trade',
	farm: 'Farm',
	logs: 'Logs',
};

/*
 * OS CANAIS EM QUE NAO SE DIGITA (31/08/2026, pedido do dono).
 *
 * *"Ninguem pode digitar nesse chat de 'Logs'."* Ele e um registro do que o
 * servidor fez, e uma fala de jogador ali seria indistinguivel de um log — que
 * e justamente o problema que este canal existe para resolver.
 *
 * Lista, e nao um `=== 'logs'` no meio do `submit`: no dia em que houver um
 * segundo canal so-leitura, quem o criar acha esta linha em vez de descobrir a
 * regra espalhada pelo arquivo.
 */
/*
 * O CANAL EM QUE O ENTER NAO ABRE A CAIXA DE DIGITACAO.
 *
 * So o Trade (08/09/2026): ele nao tem canal no servidor de mapa, e o que
 * fosse digitado sairia como fala publica (ver ".cb-inerte" em ChatBox.html).
 * Farm e Logs SAIRAM desta lista por ordem do dono — la o Enter abre a caixa,
 * mas no Global: digitar nesses dois troca de canal antes de falar
 * (`CANAIS_QUE_FALAM_NO_GLOBAL`, em linkDeItemNoChat.js, a parte pura). Ate
 * 08/09 o Logs era so-leitura e recusava a frase DEPOIS de digitada.
 */
const CANAIS_SEM_DIGITACAO = ['trade'];

/**
 * FILTRO -> CANAL. Esta tabela E a regra dura: cada filtro pertence a
 * exatamente um canal, entao uma mensagem nunca pode aparecer em dois
 * lugares nem cair no canal errado por configuracao do jogador.
 *
 * Criterio do que e "farm": tudo que o personagem produz SOZINHO enquanto
 * caca — dano trocado, experiencia, nivel, item do chao, zeny do abate — mais
 * o relatorio da sessao desassistida. Fica de fora o que e resposta a uma
 * acao do jogador (equipar, usar item, falhar em pegar do chao): isso e
 * conversa do sistema com o jogador e continua no Global, junto com a fala.
 *
 * O que nao estiver nesta tabela cai em "global" (ver canalDaMensagem).
 */
const CANAL_DO_FILTRO = {
	[ChatBox.FILTER.PARTY_ITEM]: 'farm',
	[ChatBox.FILTER.BATTLE]: 'farm',
	[ChatBox.FILTER.PARTY_BATTLE]: 'farm',
	[ChatBox.FILTER.EXP]: 'farm',
	[ChatBox.FILTER.PARTY_EXP]: 'farm',
	[ChatBox.FILTER.FARM_ITEM]: 'farm',
	[ChatBox.FILTER.FARM_EXP]: 'farm',
	[ChatBox.FILTER.FARM_ZENY]: 'farm',
	[ChatBox.FILTER.FARM_NIVEL]: 'farm',
	[ChatBox.FILTER.FARM_LOG]: 'farm',
	[ChatBox.FILTER.TRADE]: 'trade',
	[ChatBox.FILTER.SISTEMA]: 'logs'
};

/*
 * OS TIPOS QUE SAO LOG, VENHAM DE ONDE VIEREM (31/08/2026, pedido do dono).
 *
 * *"No canal de Logs, as mensagens de 'Erro' e 'Aviso' no chat global tambem
 * devem ser disparadas la."*
 *
 * Estas nascem NO CLIENTE — "Faca [3] is put on.", "Faca is taken off." saem de
 * `Engine/MapEngine/Equipment.js` com `FILTER.PUBLIC_CHAT`, o mesmo filtro da
 * fala de jogador. O opcode nao ajuda aqui: nao ha pacote a separar, porque o
 * servidor nem participa.
 *
 * O que as separa e o TIPO, e ele ja e estrutural: `ERROR` e `BLUE` (o "Aviso")
 * sao rotulos do proprio `addText`, escolhidos por quem chama. Rotear por eles
 * nao e ler texto — e ler a classificacao que a origem ja declarou, que e o
 * mesmo criterio do filtro.
 *
 * `ANNOUNCE` fica de FORA: e o anuncio da staff, que o dono quer no Global.
 *
 * `MAIL` entrou em 07/09/2026 (D-950), com o print do dono: as tres linhas do
 * correio ("O item foi movido para o seu inventario", "Falha ao retirar os
 * Zenys", "A mensagem foi excluida") sairam no GLOBAL, e ele disse que elas
 * *"deveriam ter aparecido na aba Logs"*. Correio e registro do que aconteceu
 * com a sua caixa, e nao conversa.
 *
 * Elas nao caiam la por um motivo que nao era de roteamento: os 21 sitios que
 * as emitem citavam `ChatBox.TYPE.INFO_MAIL`, que **nao existe** neste objeto
 * (ha `INFO` e ha `MAIL`). `undefined` num `&` vira `NaN`, todo teste de tipo
 * deu falso, e a linha caia no rotulo de ultimo caso — "Global". O ChatBox ja
 * sabia desenhar correio (rotulo "Correio", cor propria) e nunca recebia o
 * tipo.
 */
const TIPOS_DE_LOG = ChatBox.TYPE.ERROR | ChatBox.TYPE.BLUE | ChatBox.TYPE.MAIL;

/**
 * O canal de uma mensagem.
 *
 * A ORDEM importa: o FILTRO decide primeiro, e o tipo so e consultado quando o
 * filtro nao tem canal proprio. Sem isso, um "pegou X" do farm (que usa
 * `TYPE.BLUE`) sairia do canal Farm e cairia no Logs — o dono nao pediu isso, e
 * o Farm perderia justamente o log que ele existe para juntar.
 */
function canalDaMensagem(filterType, colorType) {
	const doFiltro = CANAL_DO_FILTRO[filterType];
	if (doFiltro) return doFiltro;

	/*
	 * GUILDA e PARTY entraram em 05/09/2026, e a ORDEM importa: o filtro vem
	 * ANTES do tipo, de proposito.
	 *
	 * `CANAL_DO_FILTRO` manda `PARTY_ITEM`, `PARTY_BATTLE` e `PARTY_EXP` para o
	 * FARM — eles sao log de caca de um grupo, e nao conversa. Se o teste de
	 * tipo viesse primeiro, o `TYPE.PARTY` desses tres os arrastaria para a aba
	 * Party e o canal de conversa do grupo viraria um despejo de log de dano.
	 * O filtro e mais especifico que o tipo, entao decide antes.
	 *
	 * Os dois canais EXISTEM no servidor, com anti-flood: `CZ_GUILD_CHAT` /
	 * `ZC_GUILD_CHAT` e `CZ_REQUEST_CHAT_PARTY` / `ZC_NOTIFY_CHAT_PARTY`
	 * (0x0109) — ver `servidor/mapa/todo-canal-de-fala-tranca.test.ts`.
	 */
	if (typeof colorType === 'number') {
		if ((colorType & ChatBox.TYPE.GUILD) !== 0) return 'guilda';
		if ((colorType & ChatBox.TYPE.PARTY) !== 0) return 'party';
		if ((colorType & TIPOS_DE_LOG) !== 0) return 'logs';
	}
	return 'global';
}

/**
 * Where to send the message
 */
ChatBox.sendTo = ChatBox.TYPE.PUBLIC;

/**
 * Private Messages
 */
ChatBox.PrivateMessageStorage = {
	nick: '',
	msg: ''
};

/**
 * Canal em foco. Continua se chamando "activeTab" porque e API publica do
 * componente (ProcessCommand/savechat leem daqui); o valor agora e o id do
 * canal ('global' | 'trade' | 'farm'), nao mais um numero de aba.
 */
ChatBox.activeTab = 'global';

/**
 * Initialize UI
 */
ChatBox.init = function init() {
	const root = _root();

	if (!ContextMenu.__loaded) ContextMenu.prepare();
	ChatBox.applyFontScale();

	// Nem draggable() nem magnet: o painel mora no canto (ver ChatBox.css).
	this.magnet.TOP = false;
	this.magnet.BOTTOM = false;
	this.magnet.LEFT = false;
	this.magnet.RIGHT = false;

	// A HUD usa MouseMode.CROSS (o clique atravessa por desenho), entao cada
	// pedaco que precisa se comportar como UI desliga o hover do mundo na
	// mao. ".body" entrou na lista porque o log deixou de ser transparente:
	// virou um painel solido, e passar o mouse por cima nao pode mais mirar
	// monstro atras dele.
	// ".cb-controles" (e nao mais ".cb-collapse" sozinho): a barra ganhou o
	// botao de tamanho ao lado da seta, e sem o contêiner nesta lista passar o
	// mouse sobre ele continuaria mirando monstro atras do painel.
	// Cada pedaco que precisa se comportar como UI desliga o hover do mundo na
	// mao. As pecas novas de 05/09 entram aqui: sem elas, passar o mouse sobre
	// a faixa de arrasto, sobre uma alca ou sobre o popover continua MIRANDO
	// MONSTRO atras do painel.
	const interactiveSelector =
		'.cb-abas, .body, .input, .battlemode, .cb-controles, .cb-arrasto, ' +
		'.cb-alca, .cb-alca-direita, .cb-alca-canto, .cb-popover, .cb-novas';
	const interactiveEls = root.querySelectorAll(interactiveSelector);
	interactiveEls.forEach(el => {
		let _intersect;
		let _enter = 0;
		el.addEventListener('mouseenter', () => {
			if (_enter === 0) {
				_intersect = Mouse.intersect;
				_enter++;
				if (_intersect) {
					Mouse.intersect = false;
					Cursor.setType(Cursor.ACTION.DEFAULT);
					EntityManager.setOverEntity(null);
				}
			}
		});
		el.addEventListener('mouseleave', () => {
			if (_enter > 0) {
				_enter--;
				if (_enter === 0 && _intersect) {
					Mouse.intersect = true;
					EntityManager.setOverEntity(null);
				}
			}
		});
	});

	// Input selection
	const usernameInput = root.querySelector('.input .username');
	if (usernameInput) {
		usernameInput.addEventListener('mousedown', function (event) {
			this.select();
			event.stopImmediatePropagation();
			event.preventDefault();
		});

		// Nome no campo => a fala VIRA sussurro (regra de ChatBox.submit). A
		// etiqueta de destino acompanha, para a barra nunca dizer "Global"
		// enquanto a proxima linha vai sair como sussurro.
		usernameInput.addEventListener('input', definirEtiquetaDeDestino);
	}

	const inputChatbox = root.querySelector('.input-chatbox');

	if (Configs.get('restoreChatFocus', false) && inputChatbox) {
		inputChatbox.addEventListener('blur', () => {
			Events.setTimeout(() => {
				const active = KEYS.getDeepActiveElement();
				const movedInsideChatbox = active && root.querySelector('#chatbox').contains(active);
				const isTextInput = active && active.tagName && active.tagName.match(/input|select|textarea/i);
				if (!movedInsideChatbox && !isTextInput) {
					inputChatbox.focus();
				}
			}, 1000);
		});
	}

	// Move caret to end of text
	if (inputChatbox) {
		inputChatbox.addEventListener('click', function () {
			const range = document.createRange();
			const selection = window.getSelection();
			range.selectNodeContents(this);
			range.collapse(false);
			selection.removeAllRanges();
			selection.addRange(range);
		});

		inputChatbox.addEventListener('focus', function () {
			const range = document.createRange();
			const selection = window.getSelection();
			range.selectNodeContents(this);
			range.collapse(false);
			selection.removeAllRanges();
			selection.addRange(range);
		});

		inputChatbox.maxLength = MAX_LENGTH;

		inputChatbox.addEventListener('input', event => {
			const currentText = extractChatMessage(inputChatbox);
			if (currentText.length >= MAX_LENGTH) {
				event.preventDefault();
			}
		});

		inputChatbox.addEventListener('keydown', event => {
			const currentText = extractChatMessage(inputChatbox);
			if (currentText.length >= MAX_LENGTH) {
				const allowedKeys = [
					'ArrowLeft',
					'ArrowUp',
					'ArrowRight',
					'ArrowDown',
					'Backspace',
					'Delete',
					'Enter',
					'Insert'
				];

				if (allowedKeys.includes(event.key)) {
					return true;
				}

				if (event.ctrlKey || event.altKey) {
					return true;
				}
				event.preventDefault();
				return false;
			}
		});

		inputChatbox.addEventListener('paste', event => {
			event.preventDefault();

			const clipboard = (event.originalEvent || event).clipboardData || event.clipboardData;
			let pastedText = clipboard ? clipboard.getData('text/plain') : '';
			if (!pastedText) {
				return;
			}

			pastedText = pastedText.replace(/\u00A0/g, ' ');

			const currentText = extractChatMessage(inputChatbox);
			const remaining = MAX_LENGTH - currentText.length;
			if (remaining <= 0) {
				return;
			}

			const toInsert = pastedText.substr(0, remaining);

			if (document.queryCommandSupported && document.queryCommandSupported('insertText')) {
				document.execCommand('insertText', false, toInsert);
			} else {
				const node = document.createTextNode(toInsert);
				inputChatbox.appendChild(node);
			}
		});
	}

	const nickBox = root.querySelector('.input .username');
	if (nickBox) {
		nickBox.addEventListener('blur', () => {
			Events.setTimeout(() => {
				const active = KEYS.getDeepActiveElement();
				const movedInsideChatbox = active && root.querySelector('#chatbox').contains(active);
				const isTextInput = active && active.tagName && active.tagName.match(/input|select|textarea/i);
				const isChatMessage = active === inputChatbox;
				if (!movedInsideChatbox && !isTextInput && !isChatMessage) {
					nickBox.focus();
				}
			}, 1000);
		});
	}

	// Validate information dragged into text field
	root.querySelectorAll('input[type=text]').forEach(input => {
		input.addEventListener('drop', onDropText);
		input.addEventListener('dragover', stopPropagation);
	});

	// Send message to... (publico / grupo / guilda / cla). O servidor de mapa
	// tem chat de grupo (D-279) e de guilda (D-282), entao os quatro destinos
	// deste menu continuam com fio de verdade.
	const filterBtn = root.querySelector('.input .filter');
	if (filterBtn) {
		filterBtn.addEventListener('click', function () {
			const pos = this.getBoundingClientRect();
			const ui = ContextMenu.ui.find('.menu');

			ContextMenu.remove();
			ContextMenu.append();

			ContextMenu.addElement(DB.getMessage(85), onChangeTargetMessage(ChatBox.TYPE.PUBLIC));
			ContextMenu.addElement(DB.getMessage(86), onChangeTargetMessage(ChatBox.TYPE.PARTY));
			ContextMenu.addElement(DB.getMessage(437), onChangeTargetMessage(ChatBox.TYPE.GUILD));
			ContextMenu.addElement(DB.getMessage(2361), onChangeTargetMessage(ChatBox.TYPE.CLAN));

			ui.css({
				top: pos.top - ui.height() - 5,
				left: pos.left - ui.width() + 25
			});
		});
		filterBtn.addEventListener('mousedown', event => {
			event.stopImmediatePropagation();
			event.preventDefault();
		});
	}

	// Rolagem em bloco de linha. O ouvinte de roda do mundo mora no CANVAS
	// (Controls/MapControl.js:70, "Renderer.canvas.addEventListener('wheel')"),
	// nao no window — entao a roda dentro do chat nunca chega ao mapa. O
	// preventDefault aqui e contra o scroll da PAGINA.
	root.querySelectorAll('.content').forEach(el => {
		el.addEventListener('wheel', onScroll);
	});

	const chatboxEl = root.querySelector('#chatbox');

	// Prevent map right-click (camera rotate) when using chat right-click features
	const chatBody = root.querySelector('.body');
	if (chatBody) {
		chatBody.addEventListener('mousedown', event => {
			if (event.which !== 3) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
		});

		// AQUI MORAVA "recolhido, o corpo inteiro expande".
		//
		// Ele fazia sentido enquanto minimizar deixava 42px de log na tela: o
		// corpo continuava visivel e clicar em qualquer parte dele devolvia o
		// chat. Desde 05/09/2026 minimizar esconde o corpo inteiro
		// (`display:none` em ".is-recolhido .body"), entao este ouvinte nunca
		// mais poderia disparar — o unico caminho de volta e o disco da barra
		// de controles, que fica FORA do que ele esconde.
		//
		// Fica o registro em vez do codigo morto: um `addEventListener` que
		// nao pode rodar e uma pista falsa para quem for depurar o botao.
	}

	// Chat font scale context menu (right click)
	if (chatboxEl) {
		chatboxEl.addEventListener('contextmenu', event => {
			const target = event.target;
			if (target.closest('.body, .contentwrapper, .content')) {
				if (target.closest('a, .item-link')) {
					return;
				}

				event.preventDefault();
				event.stopPropagation();

				Mouse.screen.x = event.pageX;
				Mouse.screen.y = event.pageY;

				ContextMenu.remove();
				ContextMenu.append();
				ContextMenu.addElement('Chat font x1.0', setChatFontScale(1.0));
				ContextMenu.addElement('Chat font x1.2', setChatFontScale(1.2));
				ContextMenu.addElement('Chat font x1.4', setChatFontScale(1.4));
			}
		});

		// Clicking interactive elements in chat should not trigger map movement
		chatboxEl.addEventListener('mousedown', event => {
			// ".cb-controles" cobre a seta E o botao de tamanho. Sem ele aqui,
			// clicar em "2x" AUMENTA o chat e ANDA COM O PERSONAGEM junto.
			// Sem isto, clicar em qualquer destes ANDA COM O PERSONAGEM junto
			// com a acao do botao — o clique vaza para o mapa.
			if (
				event.target.closest(
					'.tab, .cb-controles, .cb-arrasto, .cb-alca, .cb-alca-direita, ' +
						'.cb-alca-canto, .cb-popover, .cb-novas, .content a, .content .item-link',
				)
			) {
				event.stopPropagation();
			}
		});

		// Troca de canal (delegado nas tres abas fixas)
		chatboxEl.addEventListener('click', event => {
			const aba = event.target.closest('.tab');
			if (!aba) {
				return;
			}
			event.stopImmediatePropagation();
			ChatBox.switchTab(aba.dataset.canal);
		});
	}

	const bmtoggle = root.querySelector('.battlemode .bmtoggle');
	if (bmtoggle) {
		bmtoggle.addEventListener('click', () => {
			const inputEl = root.querySelector('.input');
			const bmEl = root.querySelector('.battlemode');
			if (inputEl) inputEl.style.display = inputEl.style.display === 'none' ? 'flex' : 'none';
			if (bmEl) bmEl.style.display = bmEl.style.display === 'none' ? 'flex' : 'none';
		});
	}

	/*
	 * OS BOTOES DA BARRA — todos com o par `click` + `mousedown`.
	 *
	 * O `mousedown` com `stopImmediatePropagation` + `preventDefault` NAO e
	 * redundante: sem ele o clique vaza para o mapa e o personagem CAMINHA ate
	 * o chat enquanto o botao faz o que devia fazer.
	 */
	const ligarBotao = (seletor, aoClicar) => {
		const botao = root.querySelector(seletor);
		if (!botao) return;
		botao.addEventListener('click', event => {
			event.stopImmediatePropagation();
			acordarDoRepouso(root);
			aoClicar(event);
		});
		botao.addEventListener('mousedown', event => {
			event.stopImmediatePropagation();
			event.preventDefault();
		});
	};

	ligarBotao('.cb-collapse', () => definirEstado(proximoEstado()));
	ligarBotao('.cb-tamanho', () => subirUmDegrau(root));
	ligarBotao('.cb-config', () => alternarPopover(root));
	ligarBotao('.cb-novas', () => rolarParaOFimSeColado(root));
	ligarBotao('.cb-enviar', () => ChatBox.submit());

	/*
	 * AS OPCOES DO POPOVER, delegadas: um ouvinte no popover em vez de quatro
	 * nos botoes. Opcao nova nasce ligada sozinha, e nao esquecida — que e o
	 * modo de falha que este arquivo ja registrou em outros lugares ("a peca
	 * existe e falta o consumidor").
	 */
	const popover = root.querySelector('.cb-popover');
	if (popover) {
		popover.addEventListener('click', event => {
			const tema = event.target.closest('.cb-tema-op');
			if (tema) {
				event.stopImmediatePropagation();
				definirOpcao('tema', tema.dataset.tema);
				return;
			}

			const botao = event.target.closest('.cb-opcao');
			if (!botao) return;
			event.stopImmediatePropagation();
			const nome = botao.dataset.opcao;
			if (nome === 'restaurar') restaurarPadrao();
			else definirOpcao(nome, !_opcoes[nome]);
		});
		popover.addEventListener('mousedown', event => {
			event.stopImmediatePropagation();
			event.preventDefault();
		});
	}

	/*
	 * Clicar FORA fecha o popover. O ouvinte mora no painel (e nao no
	 * documento) porque o Shadow DOM nao deixa o clique de dentro chegar ao
	 * documento com o alvo real — `event.target` viria como o host, e o teste
	 * "o clique foi dentro do popover?" responderia sempre que sim.
	 */
	if (chatboxEl) {
		chatboxEl.addEventListener('pointerdown', event => {
			if (event.target.closest('.cb-popover, .cb-config')) return;
			fecharPopover(root);
		});
	}

	/*
	 * TAB CICLA ENTRE CANAIS (spec §6).
	 *
	 * O ouvinte mora no CAMPO, e nao na cadeia de teclas nativa: la o Tab e
	 * navegacao de foco do documento inteiro, e sequestra-lo naquele nivel
	 * tiraria do teclado o unico jeito de alcancar os botoes da barra — que e
	 * justamente o que a spec §10 pede para preservar. Dentro do campo, Tab nao
	 * tem outro papel.
	 *
	 * Ele pula os canais em que nao se digita: ciclar para o Trade ou o Logs
	 * poria o jogador num canal que recusa a fala que ele estava escrevendo.
	 */
	const campo = root.querySelector('.input-chatbox');
	if (campo) {
		campo.addEventListener('keydown', event => {
			if (event.key !== 'Tab' || event.ctrlKey || event.altKey) return;
			event.preventDefault();
			event.stopImmediatePropagation();

			const faladores = CANAIS.filter(c => !CANAIS_SEM_DIGITACAO.includes(c));
			if (faladores.length === 0) return;
			const atual = faladores.indexOf(ChatBox.activeTab);
			const passo = event.shiftKey ? -1 : 1;
			const proximo = (atual + passo + faladores.length) % faladores.length;
			ChatBox.switchTab(faladores[proximo]);
			campo.focus();
		});
	}

	/* ─── OS QUATRO GESTOS: mover, altura, largura, canto ─────────────────── */
	ligarGesto(root, '.cb-arrasto', moverPainel, 'cb-arrastando');
	ligarGesto(root, '.cb-alca', moverAltura, 'cb-redimensionando');
	ligarGesto(root, '.cb-alca-direita', moverLargura, 'cb-redimensionando');
	ligarGesto(root, '.cb-alca-canto', moverCanto, 'cb-redimensionando');

	/* ─── REPOUSO: qualquer toque no painel acorda ────────────────────────── */
	if (chatboxEl) {
		['pointerenter', 'pointerdown', 'focusin', 'wheel'].forEach(evento => {
			chatboxEl.addEventListener(evento, () => acordarDoRepouso(root), { passive: true });
		});
	}

	/* ─── ROLAGEM ANCORADA: o botao aparece quando se sobe no historico ───── */
	root.querySelectorAll('.content').forEach(conteudo => {
		conteudo.addEventListener('scroll', () => atualizarBotaoDeNovas(root), { passive: true });
	});

	/*
	 * A JANELA MUDOU DE TAMANHO: reancora o painel contra a viewport de agora.
	 * E o criterio de aceite "redimensionar para metade da largura mantem o
	 * painel inteiramente visivel" — e a razao de a posicao ser gravada em
	 * porcentagem em vez de pixels.
	 */
	window.addEventListener('resize', () => {
		aplicarLayout(root);
		atualizarBotaoDeTamanho(root);
	});

	// Restaura o canal em foco (a preferencia so aceita canal que existe).
	ChatBox.switchTab(CANAIS.includes(_preferences.canalAtivo) ? _preferences.canalAtivo : 'global');

	// A barra de digitacao nasce dizendo para onde a fala vai.
	definirEtiquetaDeDestino();

	Commands.add(
		'savechat',
		'Saves current chat tab to txt file.',
		() => {
			ChatBox.saveCurrentTabChat();
			return;
		},
		['sc'],
		false
	);

	// Set up item link click handler inside shadow DOM
	ChatBox._setupItemLinkHandler();
};

/**
 * Clean up the box
 */
ChatBox.clean = function Clean() {
	const root = _root();

	const contents = root.querySelectorAll('.content');
	contents.forEach(content => {
		const matches = content.innerHTML.match(/(blob:[^"]+)/g);
		if (matches) {
			for (let i = 0, count = matches.length; i < count; ++i) {
				window.URL.revokeObjectURL(matches[i]);
			}
		}
		content.innerHTML = '';
	});

	const inputChatbox = root.querySelector('.input-chatbox');
	if (inputChatbox) inputChatbox.innerHTML = '';

	const nickBox = root.querySelector('.input .username');
	if (nickBox) nickBox.value = '';
	definirEtiquetaDeDestino();

	_historyMessage.clear();
	_historyNickName.clear();
};

/**
 * Troca o canal em foco. Marca a aba, mostra o log dela, apaga o ponto de
 * nao-lido e liga/desliga a digitacao (Farm e somente leitura, ver a classe
 * "canal-farm" em ChatBox.css).
 */
ChatBox.switchTab = function switchTab(canal) {
	const root = _root();
	if (!CANAIS.includes(canal)) {
		return;
	}

	this.activeTab = canal;
	_preferences.canalAtivo = canal;
	_preferences.save();

	root.querySelectorAll('.tab').forEach(aba => {
		const ativo = aba.dataset.canal === canal;
		aba.setAttribute('aria-selected', String(ativo));
		const pill = aba.querySelector('.cb-aba');
		if (pill) pill.classList.toggle('is-active', ativo);
	});

	// O badge do canal em foco ZERA (spec §4): o jogador esta olhando para ele.
	zerarNaoLido(canal);
	atualizarBadges(root);

	root.querySelectorAll('.content').forEach(el => {
		el.classList.toggle('active', el.dataset.content === canal);
	});

	const chatboxEl = root.querySelector('#chatbox');
	if (chatboxEl) {
		chatboxEl.classList.toggle('canal-farm', canal === 'farm');
		// Trade: a barra fica, o campo sai (ver ".cb-inerte" em ChatBox.css).
		chatboxEl.classList.toggle('canal-trade', canal === 'trade');
		// Logs esconde a barra inteira, como o Farm (05/09/2026). Sem isto,
		// trocar para o Logs com a caixa ABERTA a deixava aberta e focada, e o
		// Enter seguinte ia direto ao `submit` sem passar por guarda de canal
		// nenhuma. Ver o bloco ".canal-logs" em ChatBox.css.
		chatboxEl.classList.toggle('canal-logs', canal === 'logs');
	}

	/*
	 * A ABA MANDA PARA ONDE A FALA VAI (pedido do dono, 05/09/2026).
	 *
	 * Esta era uma lacuna real da primeira versao das abas novas: o Guilda e o
	 * Party foram ligados na CHEGADA das mensagens e ninguem ligou a SAIDA.
	 * Trocar de aba acendia a pilula certa, e o que o jogador digitasse
	 * continuava saindo em PUBLICO e caindo no Global — ele falava numa aba e a
	 * linha aparecia em outra, sem nada avisar.
	 *
	 * Estar num canal E escolher aquele canal. E como o Tab cicla entre as abas
	 * (spec §6), ele passou a ser tambem o atalho para trocar o destino da fala
	 * sem tirar a mao do teclado — que e o segundo caminho que o dono pediu.
	 *
	 * O `.filter` continua existindo e continua mandando: quem quiser falar em
	 * CLA, ou em grupo de dentro do Global, muda por ele. Esta linha define o
	 * PADRAO ao entrar no canal, e nao uma prisao.
	 *
	 * O sussurro vence os dois, como sempre — `ChatBox.submit()` manda como
	 * sussurro sempre que houver nome no campo, e `definirEtiquetaDeDestino`
	 * diz isso na pilula.
	 */
	const DESTINO_DO_CANAL = {
		global: ChatBox.TYPE.PUBLIC,
		guilda: ChatBox.TYPE.GUILD,
		party: ChatBox.TYPE.PARTY,
	};
	if (Object.prototype.hasOwnProperty.call(DESTINO_DO_CANAL, canal)) {
		ChatBox.sendTo = DESTINO_DO_CANAL[canal];
	}
	definirEtiquetaDeDestino();

	// O canal muda o TETO da altura (Farm e Logs somam o acrescimo depois
	// dele), e o teto pode fazer o 2x deixar de caber.
	atualizarBotaoDeTamanho(root);

	const contentDiv = root.querySelector(`.content[data-content="${canal}"]`);
	if (contentDiv) {
		contentDiv.scrollTop = contentDiv.scrollHeight;
	}
	// Trocar de aba e interacao: o painel acorda, e o botao "novas mensagens"
	// se recalcula para o log que passou a estar visivel.
	acordarDoRepouso(root);
	atualizarBotaoDeNovas(root);
};

/**
 * Once append to HTML
 */
ChatBox.onAppend = function OnAppend() {
	const root = _root();

	/*
	 * A ORDEM AQUI E O CONTRATO, e cada passo depende do anterior:
	 *
	 * 1. LER as preferencias DESTE personagem. So agora existe `Session.GID` —
	 *    no topo do modulo, quando as chaves de `Preferences` sao criadas, o
	 *    jogador ainda estava na tela de login. E por isso que o layout nao usa
	 *    `Preferences.get` de topo.
	 * 2. aplicar layout ANTES de tudo: posicao e tamanho mudam a caixa, e o
	 *    resto mede a caixa.
	 * 3. recolhido e opcoes, que dependem do layout ja aplicado.
	 * 4. so entao rolar o log para o fim — com a altura certa, senao a primeira
	 *    tela aparece rolada pela metade.
	 *
	 * O passo 1.5 e a D-930, e ele so cabe ENTRE ler e aplicar: ele decide o
	 * estado inicial, e decidir depois de aplicar seria pintar duas vezes.
	 */
	carregarPreferenciasDoPersonagem();

	/*
	 * D-930 — EM TELA DE TOQUE O CHAT NASCE RECOLHIDO, e so na PRIMEIRA vez.
	 *
	 * A conta que obriga: num celular em pe de 393x852, a doca ocupa 96px do
	 * rodape, a barra de atalhos nativa pede 42 e o chat aberto pede ~126. Os
	 * tres somam 264px — quase um terco da tela — e a prioridade declarada e a
	 * CENA de caca. Recolhido, o chat vira a barra de digitacao e devolve ~86px.
	 *
	 * `escolhido` e o freio: no instante em que o jogador toca no botao de
	 * recolher, `definirEstado` marca a escolha e este bloco cala a boca para
	 * sempre. Um padrao que reaparece depois de o jogador ter decidido o
	 * contrario nao e padrao, e teimosia — e e a queixa classica de quem joga
	 * no celular e no computador com a mesma conta.
	 *
	 * Ele sobreviveu a reescrita do chat (D-948) mudando de SUJEITO: era o
	 * booleano `_prefsRecolhido.recolhido`, e hoje e um dos tres estados de
	 * `_recolhido.estado`. O 'recolhido' e o do meio de proposito — a barra de
	 * digitacao fica, e quem entra no celular ainda consegue falar sem reabrir
	 * nada.
	 */
	if (!_recolhido.escolhido && ehTelaDeToque()) {
		_recolhido.estado = 'recolhido';
	}

	aplicarLayout(root);
	aplicarRecolhido();
	aplicarOpcoes();
	aplicarDicaDoTab(root);
	atualizarBadges(root);
	agendarRepouso(root);
	/* D-930/D-934: a altura vai para o `documentElement` para quem se pendura
	   acima do chat (a barra de atalhos) se posicionar sem copiar numero
	   nenhum. Com as tres alcas de D-948 a caixa muda em mais lugares que
	   antes, e o `ResizeObserver` cobre todos eles sem uma linha nova. */
	publicarAlturaDoChat(root);
	observarAlturaDoChat(root);

	const inputEl = root.querySelector('.input');
	if (inputEl) inputEl.style.display = 'none';

	const bmEl = root.querySelector('.battlemode');
	if (bmEl) bmEl.style.display = 'flex';

	const content = root.querySelector('.content.active');
	if (content) content.scrollTop = content.scrollHeight;
};

/**
 * Stop custom scroll
 */
ChatBox.onRemove = function OnRemove() {
	_preferences.canalAtivo = this.activeTab;
	_preferences.save();
};

/**
 * @param {number} key id to check
 * @return {boolean} found a shortcut ?
 */
ChatBox.processBattleMode = function processBattleMode(keyId) {
	const root = _root();
	const bmEl = root.querySelector('.battlemode');
	if (
		(bmEl && bmEl.style.display !== 'none') ||
		KEYS.ALT ||
		KEYS.SHIFT ||
		KEYS.CTRL ||
		(keyId >= KEYS.F1 && keyId <= KEYS.F24) ||
		KEYS.INSERT
	) {
		return BattleMode.process(keyId);
	}

	return false;
};

/**
 * Key Event Handler
 */
ChatBox.onKeyDown = function OnKeyDown(event) {
	const root = _root();
	const messageBox = root.querySelector('.input-chatbox');
	const nickBox = root.querySelector('.input .username');

	const activeElement = KEYS.getDeepActiveElement();
	const isChatInputFocused = activeElement === messageBox || activeElement === nickBox;
	const isOtherTextInputFocused =
		activeElement &&
		!isChatInputFocused &&
		((activeElement.tagName && activeElement.tagName.match(/input|select|textarea/i)) ||
			activeElement.isContentEditable);

	if (isOtherTextInputFocused) {
		return true;
	}

	switch (event.which) {
		default:
			if (isChatInputFocused) {
				if (event.which >= KEYS.F1 && event.which <= KEYS.F24) {
					if (event.which === KEYS.F11 || event.which === KEYS.F12) {
						event.preventDefault();
						return true;
					}

					if (ChatBox.processBattleMode(event.which)) {
						event.preventDefault();
						event.stopImmediatePropagation();
						return false;
					}
					event.preventDefault();
					event.stopImmediatePropagation();
					return false;
				}

				if (event.getModifierState && event.getModifierState('AltGraph')) {
					event.stopImmediatePropagation();
					return true;
				}

				if (event.ctrlKey || KEYS.CTRL) {
					const isEditingCombo =
						event.which === KEYS.C ||
						event.which === KEYS.V ||
						event.which === KEYS.X ||
						event.which === KEYS.A ||
						event.which === KEYS.Z ||
						event.which === KEYS.Y;

					if (!isEditingCombo) {
						if (ChatBox.processBattleMode(event.which)) {
							event.preventDefault();
							event.stopImmediatePropagation();
							return false;
						}
						event.preventDefault();
						return true;
					}

					event.stopImmediatePropagation();
					return true;
				}

				if (event.altKey || KEYS.ALT) {
					const isAltEditingCombo =
						event.which === KEYS.LEFT ||
						event.which === KEYS.RIGHT ||
						event.which === KEYS.UP ||
						event.which === KEYS.DOWN ||
						event.which === KEYS.BACKSPACE ||
						event.which === KEYS.DELETE ||
						event.which === KEYS.HOME ||
						event.which === KEYS.END;

					if (!isAltEditingCombo) {
						if (ChatBox.processBattleMode(event.which)) {
							event.preventDefault();
							event.stopImmediatePropagation();
							return false;
						}
						event.preventDefault();
						return true;
					}

					event.stopImmediatePropagation();
					return true;
				}

				if (event.which === KEYS.ESCAPE || event.key === 'Escape') {
					return true;
				}

				event.stopImmediatePropagation();
				return true;
			}

			if (
				(event.target.tagName && !event.target.tagName.match(/input|select|textarea/i)) ||
				(event.which >= KEYS.F1 && event.which <= KEYS.F24) ||
				KEYS.ALT ||
				KEYS.SHIFT ||
				KEYS.CTRL
			) {
				if (ChatBox.processBattleMode(event.which)) {
					event.stopImmediatePropagation();
					return false;
				}
			}
			return true;

		// Message from history
		case KEYS.UP:
			if (!document.querySelector('#NpcMenu')) {
				if (activeElement === messageBox) {
					if (shouldLetChatInputHandleVerticalArrows(messageBox, 'up')) {
						event.stopImmediatePropagation();
						return true;
					}
					messageBox.innerHTML = _historyMessage.previous();
					break;
				}

				if (activeElement === nickBox) {
					nickBox.value = _historyNickName.previous();
					nickBox.select();
					break;
				}
			}
			return true;

		case KEYS.DOWN:
			if (!document.querySelector('#NpcMenu')) {
				if (activeElement === messageBox) {
					if (shouldLetChatInputHandleVerticalArrows(messageBox, 'down')) {
						event.stopImmediatePropagation();
						return true;
					}
					messageBox.innerHTML = _historyMessage.next();
					break;
				}

				if (activeElement === nickBox) {
					nickBox.value = _historyNickName.next();
					nickBox.select();
					break;
				}
			}
			return true;

		// F10 era o ciclo de 6 alturas do chat nativo, e ficou em
		// minimizar/abrir quando o chat passou a ter altura unica. A altura
		// voltou depois (arrasto em 28/08, escada em 05/09), mas a tecla FICA
		// aqui: minimizar e a acao que o jogador quer no meio de uma luta, e
		// remapear atalho que ja esta na mao custa mais do que ganha.
		case KEYS.F10:
			definirEstado(proximoEstado());
			break;

		// Send message
		case KEYS.ENTER: {
			if (document.activeElement.className === 'message input-chatbox' && document.activeElement !== messageBox) {
				return true;
			}

			if (document.querySelector('#NpcMenu, #NpcBox')) {
				return true;
			}

			if (activeElement === messageBox) {
				this.submit();
				event.stopImmediatePropagation();
				return false;
			}

			// FARM E LOGS FALAM NO GLOBAL (08/09/2026, ordem do dono): o Enter
			// nesses dois troca para o Global e abre a caixa la. O Trade continua
			// sem digitacao — nao tem canal no servidor (".cb-inerte", ChatBox.html).
			if (CANAIS_QUE_FALAM_NO_GLOBAL.includes(this.activeTab)) {
				this.switchTab(CANAL_DE_FALA);
			}
			if (CANAIS_SEM_DIGITACAO.includes(this.activeTab)) {
				event.stopImmediatePropagation();
				return false;
			}
			if (estaFechado()) {
				definirRecolhido(false);
			}

			const input = root.querySelector('.input');
			if (input && input.style.display === 'none') {
				input.style.display = 'flex';
				const bmEl = root.querySelector('.battlemode');
				if (bmEl) bmEl.style.display = 'none';
			}

			messageBox.focus();
			const range = document.createRange();
			const sel = window.getSelection();
			range.selectNodeContents(messageBox);
			range.collapse(false);
			sel.removeAllRanges();
			sel.addRange(range);
			event.stopImmediatePropagation();
			return false;
		}
	}

	event.stopImmediatePropagation();
	return false;
};

ChatBox.toggleChat = function toggleChat() {
	const root = _root();
	const messageBox = root.querySelector('.input-chatbox');

	const activeElement = KEYS.getDeepActiveElement();
	if (activeElement.tagName === 'INPUT' && activeElement !== messageBox) {
		return true;
	}

	if (document.querySelector('#NpcMenu, #NpcBox')) {
		return true;
	}

	messageBox.focus();
	this.submit();
};

/**
 * Process ChatBox message
 */
ChatBox.submit = function Submit() {
	const root = _root();
	const inputEl = root.querySelector('.input');
	const $user = root.querySelector('.input .username');
	const $text = root.querySelector('.input-chatbox');

	const user = $user ? $user.value : '';
	const text = extractChatMessage($text);
	const trimmedText = text.replace(/\u00A0/g, ' ').trim();

	/*
	 * FARM E LOGS FALAM NO GLOBAL (08/09/2026, ordem do dono: "o chat na aba Logs
	 * e Farm estao disponiveis sim, mas quando o player digita, a mensagem dele
	 * cai em Global"). Ate aqui o Logs recusava a frase depois de digitada
	 * (31/08). A guarda fica AQUI porque o Enter e o clique desaguam neste
	 * `submit`; trocar o canal ANTES de enviar faz o eco do servidor cair na aba
	 * que o jogador esta vendo. Com o campo VAZIO nada muda: o Enter continua
	 * alternando o modo batalha, e recolher o campo nao e falar.
	 */
	if (trimmedText.length && CANAIS_QUE_FALAM_NO_GLOBAL.includes(ChatBox.activeTab)) {
		ChatBox.switchTab(CANAL_DE_FALA);
	}

	// Battle mode
	if (!trimmedText.length) {
		const bmEl = root.querySelector('.battlemode');
		if (inputEl) inputEl.style.display = inputEl.style.display === 'none' ? 'flex' : 'none';
		if (bmEl) bmEl.style.display = bmEl.style.display === 'none' ? 'flex' : 'none';

		if (inputEl && inputEl.style.display !== 'none') {
			$text.focus();
		}

		return;
	}

	// Private message
	if (user.length && trimmedText[0] !== '/') {
		this.PrivateMessageStorage.nick = user;
		this.PrivateMessageStorage.msg = trimmedText;
		_historyNickName.push(user);
		_historyNickName.previous();
	}

	// Save in history
	_historyMessage.push(trimmedText);

	$text.innerHTML = '';

	// Command
	if (trimmedText[0] === '/') {
		Commands.processCommand.call(this, trimmedText.substr(1));
		return;
	}

	// A dica do Tab conta ENVIO DE FALA, e nao comando: quem digita "/comando"
	// nao esta aprendendo a trocar de canal (o `return` acima ja saiu daqui
	// nesse caso).
	contarEnvio(_root());

	this.onRequestTalk(user, trimmedText, ChatBox.sendTo);
};

/**
 * Extract plain chat text from the contenteditable input while preserving item links.
 */
function extractChatMessage(inputEl) {
	if (!inputEl) return '';
	const clone = inputEl.cloneNode(true);

	clone.querySelectorAll('span.item-link').forEach(el => {
		const itemData = el.getAttribute('data-item') || el.dataset.item || '';
		el.replaceWith(document.createTextNode(itemData));
	});

	let result = clone.textContent;
	result = result.replace(/\u00A0/g, ' ');
	return result;
}

/**
 * Add text to chatbox
 */
ChatBox.addText = function addText(text, colorType, filterType, color, override) {
	text = text.replace(/<ITEMLINK>.*?<\/ITEMLINK>|<ITEML>.*?<\/ITEML>|<ITEM>.*?<\/ITEM>/gi, function (match) {
		const item = DB.parseItemLink(match);
		const span = `<span data-item="${match}" class="item-link" style="color:#FFFF63;">&lt;${item.name}&gt;</span>`;
		override = true;
		return span;
	});

	// Auto-detect client-generated HTML (nickname links in whispers)
	if (!override && /<span\s+class="nickname-link"/.test(text)) {
		override = true;
	}

	if (isNaN(filterType)) {
		filterType = ChatBox.FILTER.PUBLIC_LOG;
	}

	_messageBuffer.push({
		text: text,
		colorType: colorType,
		filterType: filterType,
		color: color,
		override: override
	});

	if (!_rafScheduled) {
		_rafScheduled = true;
		requestAnimationFrame(() => {
			_rafScheduled = false;
			flushMessageBuffer();
		});
	}
};

/**
 * Process all messages in the buffer at once.
 *
 * Cada mensagem vai para UM canal so, decidido por canalDaMensagem() a partir
 * do filtro que a origem declarou. Nao ha caminho por onde a mesma linha
 * aparecer em dois canais.
 */
function flushMessageBuffer() {
	if (_messageBuffer.length === 0) {
		return;
	}

	const root = _root();
	const messages = _messageBuffer.slice();
	_messageBuffer = [];

	const porCanal = {};

	messages.forEach(msg => {
		/*
		 * `colorType`, e nao `type`: e o nome do campo no buffer
		 * (`_messageBuffer.push({ text, colorType, filterType, ... })`).
		 *
		 * Passar `msg.type` daria `undefined`, a guarda `typeof === 'number'`
		 * cairia fora, e TUDO continuaria indo para o global — sem erro, sem
		 * aviso, com o pedido do dono desfeito em silencio.
		 */
		const canal = canalDaMensagem(msg.filterType, msg.colorType);
		if (!porCanal[canal]) {
			porCanal[canal] = [];
		}
		porCanal[canal].push(msg);
	});

	Object.keys(porCanal).forEach(canal => {
		const content = root.querySelector(`.content[data-content="${canal}"]`);
		if (!content) return;

		const fragment = document.createDocumentFragment();
		const wasAtBottom = shouldScrollDownBeforeAdd(content, content.offsetHeight);

		porCanal[canal].forEach(msg => {
			const color = msg.color || getColorForType(msg.colorType);
			const div = document.createElement('div');
			div.style.color = color;

			/*
			 * A ETIQUETA E TEXTO, e a cor e reforco (spec §10).
			 *
			 * Coral (guilda) e dourado (trade) ficam proximos para daltonicos
			 * do tipo protanopia, entao "[Guilda]" ESCRITO e obrigatorio — nao
			 * da para depender so da cor para dizer de onde a linha veio.
			 *
			 * `etiquetaDaLinha` continua mandando quando tem algo MAIS
			 * especifico a dizer (Sussurro, Erro, Admin, Correio): "Sussurro"
			 * informa mais que "Global", e um sussurro que se anunciasse como
			 * Global seria pior que nao ter etiqueta.
			 */
			const especifica = etiquetaDaLinha(msg.colorType, msg.filterType);
			const rotulo = especifica.rotulo || ROTULO_DO_CANAL[canal] || 'Global';
			const corDaTag = especifica.rotulo === 'Sussurro' ? 'sussurro' : canal;
			const tagHtml = `<span class="cb-tag" data-canal="${corDaTag}">[${rotulo}]</span>`;

			// A hora nasce em TODA linha e some por CSS quando o interruptor
			// esta desligado — assim liga-lo mostra o horario do que ja esta no
			// log, e nao so das proximas.
			const agora = new Date();
			const hh = String(agora.getHours()).padStart(2, '0');
			const mm = String(agora.getMinutes()).padStart(2, '0');
			const horaHtml = `<span class="cb-hora">${hh}:${mm}</span> `;

			if (!msg.override) {
				div.innerHTML = horaHtml + tagHtml + ' ' + highlightMessage(msg.text, msg.colorType);
			} else {
				// Override ja e HTML pronto (ITEMLINK, link de historico,
				// nickname-link) -- so hora e etiqueta sao somadas por cima.
				div.innerHTML = horaHtml + tagHtml + ' ' + msg.text;
			}
			fragment.appendChild(div);
		});

		content.appendChild(fragment);

		while (content.childElementCount > MAX_MSG) {
			const element = content.firstElementChild;
			const matches = element.innerHTML.match(/(blob:[^"]+)/g);
			if (matches) {
				for (let i = 0; i < matches.length; i++) {
					window.URL.revokeObjectURL(matches[i]);
				}
			}
			element.remove();
		}

		/*
		 * ROLAGEM ANCORADA (spec §7): quem subiu no historico NAO e puxado de
		 * volta. Em vez disso o botao "novas mensagens" aparece, e ele e o
		 * caminho de volta — perder o lugar da leitura por causa de uma linha
		 * nova e o defeito que esta regra existe para evitar.
		 */
		if (wasAtBottom) {
			content.scrollTop = content.scrollHeight;
		} else if (canal === ChatBox.activeTab) {
			atualizarBotaoDeNovas(root, true);
		}

		marcarNaoLido(canal);
	});

	/*
	 * MENSAGEM NOVA ACORDA O PAINEL (spec §7).
	 *
	 * Sussurro e alerta critico acordam SEMPRE — sao as duas coisas que o
	 * jogador nao pode perder por estar de olho noutro canto da tela. O resto
	 * acorda tambem, mas so quando "sumir parado" nao esta ligado: quem ligou o
	 * repouso pediu justamente para o log de caca nao piscar o painel a cada
	 * abate.
	 */
	const temUrgente = messages.some(
		msg =>
			typeof msg.colorType === 'number' &&
			(msg.colorType & (ChatBox.TYPE.PRIVATE | ChatBox.TYPE.ERROR)) !== 0,
	);
	if (temUrgente || !_opcoes.repouso) acordarDoRepouso(root);
}

/**
 * CONTA o nao-lido do canal que recebeu mensagem (spec §4).
 *
 * Conta em vez de so marcar: o pontinho antigo dizia "ha algo" e nao dizia se
 * valia a pena trocar de aba. O numero diz.
 *
 * O canal em foco nao acumula — o jogador esta lendo aquilo. A EXCECAO e o
 * chat RECOLHIDO: sem abas na tela, ate a mensagem do canal ativo passa
 * despercebida, entao ali tudo conta e o badge somado do botao avisa.
 */
function marcarNaoLido(canal) {
	const root = _root();
	const escondido = estaFechado();

	if (escondido || canal !== ChatBox.activeTab) {
		somarNaoLido(canal);
		atualizarBadges(root);
	}
}

function getColorForType(colorType) {
	/*
	 * A FALA DE GM E AMARELA, e ela decide ANTES de tudo (07/09/2026, pedido
	 * do dono: a tag "GM" em amarelo).
	 *
	 * A ordem importa: `PUBLIC | SELF` (o eco da propria fala) devolveria
	 * verde e o administrador seria o unico a nao ver o proprio destaque. O
	 * `TYPE.ADMIN` so e posto por quem sabe que a entidade e GM
	 * (`Session.AdminList`), entao poe-lo no topo nao muda mais nada.
	 */
	if (colorType & ChatBox.TYPE.ADMIN) {
		return '#FFFF00';
	}
	if (colorType & ChatBox.TYPE.PUBLIC && colorType & ChatBox.TYPE.SELF) {
		return '#00FF00';
	} else if (colorType & ChatBox.TYPE.PARTY) {
		return colorType & ChatBox.TYPE.SELF ? 'rgb(200, 200, 100)' : 'rgb(230,215,200)';
	} else if (colorType & ChatBox.TYPE.GUILD) {
		return 'rgb(180, 255, 180)';
	} else if (colorType & ChatBox.TYPE.PRIVATE) {
		return '#FFFF00';
	} else if (colorType & ChatBox.TYPE.ERROR) {
		return '#FF0000';
	} else if (colorType & ChatBox.TYPE.INFO) {
		return '#FFFF63';
	} else if (colorType & ChatBox.TYPE.BLUE) {
		return '#00FFFF';
	} else if (colorType & ChatBox.TYPE.ADMIN) {
		return '#FFFF00';
	} else if (colorType & ChatBox.TYPE.MAIL) {
		return '#FFFFFF';
	}

	return '#FFFFFF';
}

/**
 * Etiqueta de canal no inicio da linha (gabarito, secao 4). Dentro do Farm o
 * rotulo vem do FILTRO — que e o que distingue item, experiencia, zeny e
 * nivel — e no resto vem do tipo de cor, como sempre veio. So um NOME visivel
 * para o que o JS ja decidiu; nao inventa cor nem muda o fluxo.
 */
function etiquetaDaLinha(colorType, filterType) {
	switch (filterType) {
		case ChatBox.FILTER.FARM_ITEM:
		case ChatBox.FILTER.PARTY_ITEM:
			return { rotulo: 'Item', variante: 'ouro' };
		case ChatBox.FILTER.FARM_EXP:
		case ChatBox.FILTER.EXP:
		case ChatBox.FILTER.PARTY_EXP:
			return { rotulo: 'Exp', variante: 'ouro' };
		case ChatBox.FILTER.FARM_ZENY:
			return { rotulo: 'Zeny', variante: 'ouro' };
		case ChatBox.FILTER.FARM_NIVEL:
			return { rotulo: 'Nível', variante: 'ouro' };
		case ChatBox.FILTER.FARM_LOG:
			return { rotulo: 'Caça', variante: 'ouro' };
		case ChatBox.FILTER.BATTLE:
		case ChatBox.FILTER.PARTY_BATTLE:
			return { rotulo: 'Combate', variante: 'cinza' };
		case ChatBox.FILTER.TRADE:
			return { rotulo: 'Trade', variante: 'ouro' };
		default:
			break;
	}

	if (colorType & ChatBox.TYPE.ERROR) return { rotulo: 'Erro', variante: 'ouro' };
	// "GM" e a palavra que o dono pediu, e a que o jogador reconhece de outros
	// servidores de RO. "Admin" era o nome interno do tipo, e nao um rotulo.
	if (colorType & ChatBox.TYPE.ADMIN) return { rotulo: 'GM', variante: 'ouro' };
	if (colorType & ChatBox.TYPE.MAIL) return { rotulo: 'Correio', variante: 'ouro' };
	if (colorType & ChatBox.TYPE.CLAN) return { rotulo: 'Clã', variante: 'ouro' };
	if (colorType & ChatBox.TYPE.GUILD) return { rotulo: 'Guilda', variante: 'ouro' };
	if (colorType & ChatBox.TYPE.PARTY) return { rotulo: 'Grupo', variante: 'ouro' };
	if (colorType & ChatBox.TYPE.PRIVATE) return { rotulo: 'Sussurro', variante: 'ouro' };
	if (colorType & ChatBox.TYPE.ANNOUNCE) return { rotulo: 'Anúncio', variante: 'ouro' };
	if (colorType & ChatBox.TYPE.INFO) return { rotulo: 'Sistema', variante: 'ouro' };
	if (colorType & ChatBox.TYPE.BLUE) return { rotulo: 'Aviso', variante: 'ouro' };

	return { rotulo: 'Global', variante: 'cinza' };
}

/**
 * Escapa o texto CRU (mensagem de outro jogador, nunca confiavel) antes de
 * highlightMessage() envolver pedacos dela em spans.
 */
function escapeChatHtml(text) {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Envolve (NUNCA decide) dois pedacos da mensagem em spans:
 *  - o prefixo "Nome : " que o proprio rAthena manda PRONTO dentro de pkt.msg
 *  - numeros (zeny, quantidade, nivel) em qualquer mensagem.
 */
function highlightMessage(rawText, colorType) {
	const escaped = escapeChatHtml(rawText);

	const isSpeech = !!(
		colorType &
		(ChatBox.TYPE.PUBLIC | ChatBox.TYPE.PARTY | ChatBox.TYPE.GUILD | ChatBox.TYPE.PRIVATE | ChatBox.TYPE.CLAN)
	);
	const withName = isSpeech
		? escaped.replace(/^(\s*[^\n:]{1,24}?)\s:\s/, '<span class="cb-name">$1</span> : ')
		: escaped;

	return withName.replace(/\b\d+(?:[.,]\d+)*\b/g, match => `<span class="cb-num">${match}</span>`);
}

function shouldScrollDownBeforeAdd(container, height) {
	const tolerance = 5;
	const atBottom = container.scrollTop + height >= container.scrollHeight - tolerance;

	if (height >= container.scrollHeight || atBottom) {
		return true;
	}

	return false;
}

/**
 * Determine if vertical arrow should scroll the contenteditable rather than navigate history
 */
function shouldLetChatInputHandleVerticalArrows(inputEl, direction) {
	if (!inputEl) {
		return false;
	}

	const sel = window.getSelection();
	if (!sel || sel.rangeCount < 1) {
		return false;
	}

	const range = sel.getRangeAt(0);
	if (!range) {
		return false;
	}

	const anchorNode = sel.anchorNode || range.startContainer;
	if (!anchorNode) {
		return false;
	}

	if (anchorNode !== inputEl && !(inputEl.contains && inputEl.contains(anchorNode))) {
		return false;
	}

	if (!sel.isCollapsed) {
		return true;
	}

	const text = extractChatMessage(inputEl);
	const hasNewline = text.indexOf('\n') > -1;
	const hasOverflow = inputEl.scrollHeight > inputEl.clientHeight + 1;
	if (!hasNewline && !hasOverflow) {
		return false;
	}

	let caretRect;
	try {
		caretRect =
			range.getClientRects && range.getClientRects().length
				? range.getClientRects()[0]
				: range.getBoundingClientRect();
	} catch (_e) {
		return true;
	}

	if (!caretRect) {
		return true;
	}

	const inputRect = inputEl.getBoundingClientRect ? inputEl.getBoundingClientRect() : null;
	if (!inputRect) {
		return true;
	}

	if (direction === 'up') {
		return caretRect.top > inputRect.top + 2;
	}

	if (direction === 'down') {
		return caretRect.bottom < inputRect.bottom - 2;
	}

	return false;
}

/**
 * Save user name to nick name history
 */
ChatBox.saveNickName = function saveNickName(pseudo) {
	_historyNickName.push(pseudo);
};

/**
 * Save chat from current tab into a file.
 */
ChatBox.saveCurrentTabChat = function saveCurrentTabChat() {
	const root = _root();
	let data;

	const tzoffset = new Date().getTimezoneOffset() * 60000;
	let localISOTime = new Date(Date.now() - tzoffset).toISOString().slice(0, -1);
	localISOTime = localISOTime.replace('T', ' ');
	const timezone = new Date().getTimezoneOffset() / 60;
	const date = `${localISOTime} (GMT ${timezone > 0 ? '-' : '+'}${Math.abs(timezone).toString()})`;

	const contentEl = root.querySelector(`.content[data-content="${ChatBox.activeTab}"]`);
	const nome = ChatBox.activeTab;

	data =
		'<html><head><title>Chat History</title><style> body { background-color: DarkSlateGray; } </style></head><body>';
	data += contentEl ? contentEl.outerHTML : '';
	data += '</body></html>';

	const url = window.URL.createObjectURL(new Blob([data], { type: 'text/plain' }));

	ChatBox.addText(
		`Chat History [${nome}] ${date} can be saved by <a style="color:#F88" download="ChatHistory [${nome}] (${date.replace('/', '-')}).html" href="${url}" target="_blank">clicking here</a>.`,
		ChatBox.TYPE.PUBLIC,
		ChatBox.FILTER.PUBLIC_LOG,
		null,
		true
	);
};

/**
 * Update scroll by block (14px)
 */
function onScroll(event) {
	let delta;

	if (event.wheelDelta) {
		delta = event.wheelDelta / 120;
		if (window.opera) {
			delta = -delta;
		}
	} else if (event.detail) {
		delta = -event.detail;
	} else if (event.deltaY) {
		delta = -event.deltaY / Math.abs(event.deltaY);
	}

	const lineHeight = getScrollLineHeightPx(this);
	this.scrollTop = Math.floor(this.scrollTop / lineHeight) * lineHeight - (delta || 0) * lineHeight;
	event.preventDefault();
}

/**
 * Validate the type of information being dropped into the text field
 */
function onDropText(event) {
	event.stopImmediatePropagation();
	event.preventDefault();
	let data;
	try {
		data = JSON.parse(event.dataTransfer.getData('Text'));
	} catch (_e) {
		return;
	}

	if (data.type == 'item') {
		return;
	}

	event.currentTarget.value = data;
}

/**
 * Stop event propagation
 */
function stopPropagation(event) {
	event.stopImmediatePropagation();
	event.preventDefault();
}

/**
 * Change target of global chat (party, guild)
 */
function onChangeTargetMessage(type) {
	return function onChangeTargetMessageClosure() {
		const root = _root();
		const $input = root.querySelector('.input-chatbox');

		if ($input) {
			$input.classList.remove('guild', 'party', 'clan');

			if (type & ChatBox.TYPE.PARTY) {
				$input.classList.add('party');
			} else if (type & ChatBox.TYPE.GUILD) {
				$input.classList.add('guild');
			} else if (type & ChatBox.TYPE.CLAN) {
				$input.classList.add('clan');
			}
		}

		ChatBox.sendTo = type;
		definirEtiquetaDeDestino();
	};
}

/**
 * Etiqueta de DESTINO da barra de digitacao (20/08/2026, rodada 2).
 *
 * O problema que ela resolve: a barra do Global se anunciava como SUSSURRO. O
 * unico rotulo visivel era o placeholder "Sussurrar para" do campo de nick, e
 * o destino de verdade (publico / grupo / guilda / cla) vivia escondido atras
 * do botao ".filter" — um seletor que, sem rotulo, parecia um quarto canal
 * dentro de um chat que o dono definiu como exatamente TRES.
 *
 * Aqui nada de mecanismo muda: "ChatBox.sendTo" continua sendo a unica verdade
 * sobre para onde a fala vai, e "onRequestTalk" continua lendo dela. Esta
 * funcao so DIZ, em cima da barra, o que o estado ja e — inclusive a regra que
 * ChatBox.submit() aplica em silencio: se ha nome no campo de sussurro, a
 * mensagem sai como sussurro, aconteca o que acontecer com o ".filter".
 */
function definirEtiquetaDeDestino() {
	const root = _root();
	const etiqueta = root.querySelector('.input .cb-destino');
	if (!etiqueta) {
		return;
	}

	const nick = root.querySelector('.input .username');
	if (nick && nick.value && nick.value.trim().length) {
		etiqueta.textContent = 'Sussurro';
		etiqueta.dataset.destino = 'sussurro';
		return;
	}

	let rotulo = 'Global';
	let chave = 'publico';
	if (ChatBox.sendTo & ChatBox.TYPE.PARTY) {
		rotulo = 'Grupo';
		chave = 'grupo';
	} else if (ChatBox.sendTo & ChatBox.TYPE.GUILD) {
		rotulo = 'Guilda';
		chave = 'guilda';
	} else if (ChatBox.sendTo & ChatBox.TYPE.CLAN) {
		rotulo = 'Clã';
		chave = 'cla';
	}

	etiqueta.textContent = rotulo;
	etiqueta.dataset.destino = chave;
}

/**
 * ===========================================================================
 * RECOLHER (spec §7) — sobra a BARRA DE DIGITACAO, e nao nada
 * ===========================================================================
 * Recolhido o painel guarda abas, log e modo batalha, e mantem a barra de
 * digitacao com o badge SOMADO de todos os canais nao lidos. A escolha e da
 * spec e a razao e de jogo: o jogador continua podendo falar sem reabrir, que
 * e o que se quer no meio de uma luta.
 *
 * A faixa de arrasto FICA: recolhido o painel continua movel, e tirar a unica
 * alca de mover junto com o corpo prenderia o chat onde ele estava.
 */
/**
 * OS TRES ESTADOS, e o chevron cicla entre eles:
 *
 *   aberto -> recolhido (so a barra de digitacao) -> minimizado (so o disco)
 *
 * Os dois pedidos do dono existem e nao competem. `recolhido` e a spec §7 e
 * serve a quem quer continuar falando sem o log na frente; `minimizado` e o
 * *"minimizasse full a ponto de nao ter"* e serve a quem quer a tela limpa.
 * Escolher um so teria negado metade do que foi pedido.
 */
const ESTADOS = ['aberto', 'recolhido', 'minimizado'];

/** Fechado = qualquer estado que esconda as abas. */
const estaFechado = () => _recolhido.estado !== 'aberto';

function proximoEstado() {
	const i = ESTADOS.indexOf(_recolhido.estado);
	return ESTADOS[(i < 0 ? 0 : i + 1) % ESTADOS.length];
}

function definirEstado(estado, porEscolhaDoJogador = true) {
	_recolhido.estado = ESTADOS.includes(estado) ? estado : 'aberto';
	/* D-930: a partir do primeiro gesto no chevron, a escolha e DO JOGADOR — e
	   o padrao por tamanho de tela (ver `ChatBox.onAppend`) para de opinar.
	   Ele fica AQUI, e nao no `definirRecolhido`, porque o chevron cicla pelos
	   tres estados por este caminho: marcar so no atalho de duas posicoes
	   deixaria o jogador que minimiza no celular sem freio nenhum.

	   D-946: e so do GESTO. Expandir o chat para caber um link de item e
	   consequencia de outro gesto (o "Linkar no chat" da ficha do item), e
	   marcar `escolhido` ali faria o chat do celular nascer ABERTO para sempre
	   por causa de um clique que nunca foi sobre o tamanho do chat. */
	if (porEscolhaDoJogador) {
		_recolhido.escolhido = true;
	}
	gravarPreferencia('Recolhido', _recolhido);
	aplicarRecolhido();
}

/** Mantido com o nome antigo: e API interna chamada de varios pontos. */
function definirRecolhido(fechar, porEscolhaDoJogador = true) {
	definirEstado(fechar ? 'recolhido' : 'aberto', porEscolhaDoJogador);
}

function aplicarRecolhido() {
	const root = _root();
	const chatboxEl = root.querySelector('#chatbox');
	const collapseBtn = root.querySelector('.cb-collapse');
	if (!chatboxEl || !collapseBtn) return;

	const estado = ESTADOS.includes(_recolhido.estado) ? _recolhido.estado : 'aberto';
	const recolhido = estado === 'recolhido';
	const minimizado = estado === 'minimizado';

	chatboxEl.classList.toggle('is-recolhido', recolhido);
	chatboxEl.classList.toggle('is-minimizado', minimizado);
	collapseBtn.classList.toggle('is-recolhido', recolhido);
	collapseBtn.setAttribute('aria-expanded', String(estado === 'aberto'));

	/*
	 * O rotulo diz PARA ONDE O CLIQUE LEVA, e nao onde se esta.
	 *
	 * Num botao que cicla tres estados, dizer o estado atual ("recolhido")
	 * deixaria o jogador adivinhando o que acontece se ele apertar. Aqui e o
	 * unico controle do chat em que a acao vence o estado — e a diferenca e que
	 * o estado ja esta VISIVEL na tela, e o proximo passo nao.
	 */
	const label =
		estado === 'aberto'
			? 'Recolher chat'
			: recolhido
				? 'Minimizar o chat por completo'
				: 'Abrir chat';
	collapseBtn.title = label;
	collapseBtn.setAttribute('aria-label', label);

	// Fechar leva o popover junto: ele e ancorado no topo do painel, que acabou
	// de sumir, e ficaria boiando solto sobre o mundo.
	if (estado !== 'aberto') fecharPopover(root);

	atualizarBadges(root);
	atualizarBotaoDeTamanho(root);
	rolarParaOFimSeColado(root);
}

/**
 * ===========================================================================
 * AS OPCOES (spec §8)
 * ===========================================================================
 * Tres interruptores e uma acao. "Travar" governa POSICAO E TAMANHO juntos —
 * a spec e explicita: com ele ligado a faixa de arrasto sai e as tres alcas
 * desativam. Travar so um dos dois faria o cadeado prometer o que nao cumpre.
 */
function definirOpcao(nome, valor) {
	// `tema` e uma STRING ('moderna' | 'classica'); os outros sao booleanos.
	// Coagir tudo com `!!` transformaria 'classica' em `true` e a classe nunca
	// entraria — um modo inteiro morto por um operador.
	_opcoes[nome] = nome === 'tema' ? String(valor) : !!valor;
	gravarPreferencia('Opcoes', _opcoes);
	aplicarOpcoes();
}

function aplicarOpcoes() {
	const root = _root();
	const chatboxEl = root.querySelector('#chatbox');
	if (!chatboxEl) return;

	chatboxEl.classList.toggle('is-travado', !!_opcoes.travado);
	chatboxEl.classList.toggle('mostra-hora', !!_opcoes.horario);
	chatboxEl.classList.toggle('is-classico', _opcoes.tema === 'classica');

	root.querySelectorAll('.cb-tema-op[data-tema]').forEach(botao => {
		const ativo = botao.dataset.tema === (_opcoes.tema || 'moderna');
		botao.classList.toggle('is-ativo', ativo);
		botao.setAttribute('aria-checked', String(ativo));
	});

	root.querySelectorAll('.cb-opcao[data-opcao]').forEach(botao => {
		const nome = botao.dataset.opcao;
		// `restaurar` e acao, nao estado; `tema` e escolha entre dois e mora no
		// proprio seletor acima. Nenhum dos dois e interruptor.
		if (nome === 'restaurar' || nome === 'tema') return;
		botao.setAttribute('aria-checked', String(!!_opcoes[nome]));
	});

	// O horario e um `display` no CSS, entao ligar/desligar nao repinta linha
	// nenhuma — as que ja estao no log obedecem na hora.
	atualizarBotaoDeTamanho(root);

	// Desligar "sumir parado" tem de ACORDAR o painel na hora, e nao no
	// proximo evento: quem desliga esta olhando para ele agora.
	if (!_opcoes.repouso) acordarDoRepouso(root);
	else agendarRepouso(root);
}

/** Restaurar padrao (spec §8): apaga o que este personagem gravou. */
function restaurarPadrao() {
	const root = _root();
	SUFIXOS.forEach(sufixo => {
		try {
			localStorage.removeItem(chaveDoPersonagem(sufixo));
		} catch (_e) {
			// Ver `gravarPreferencia`: nao apagar e aceitavel, quebrar nao e.
		}
	});
	_layout = Object.assign({}, PADRAO_LAYOUT);
	_opcoes = Object.assign({}, PADRAO_OPCOES);
	_envios = Object.assign({}, PADRAO_ENVIOS);
	_recolhido = { estado: 'aberto' };

	const painel = root.querySelector('#chatbox');
	if (painel) {
		// Tirar os inline devolve o painel ao que o CSS manda — que e o que
		// "padrao" quer dizer. Zerar para numeros escritos aqui criaria um
		// segundo dono do valor de fabrica.
		painel.style.removeProperty('width');
		painel.style.removeProperty('left');
		painel.style.removeProperty('bottom');
		painel.style.removeProperty('--cb-altura');
	}
	aplicarRecolhido();
	aplicarOpcoes();
	aplicarDicaDoTab(root);
	fecharPopover(root);
}

/* ─── O POPOVER ─────────────────────────────────────────────────────────── */
function abrirPopover(root) {
	const popover = root.querySelector('.cb-popover');
	const botao = root.querySelector('.cb-config');
	if (!popover || !botao) return;
	popover.hidden = false;
	botao.classList.add('is-aberto');
	botao.setAttribute('aria-expanded', 'true');
	acordarDoRepouso(root);
}

function fecharPopover(root) {
	const popover = root.querySelector('.cb-popover');
	const botao = root.querySelector('.cb-config');
	if (!popover || !botao) return;
	popover.hidden = true;
	botao.classList.remove('is-aberto');
	botao.setAttribute('aria-expanded', 'false');
}

function alternarPopover(root) {
	const popover = root.querySelector('.cb-popover');
	if (!popover) return;
	if (popover.hidden) abrirPopover(root);
	else fecharPopover(root);
}

/**
 * ===========================================================================
 * REPOUSO (spec §7)
 * ===========================================================================
 * 8 s sem mensagem nova e sem interacao, o painel cai para 28%. Volta a 100%
 * com hover, foco no campo, ou mensagem nova.
 *
 * SUSSURRO E ALERTA CRITICO IGNORAM O REPOUSO e trazem o painel de volta — sao
 * as duas coisas que o jogador nao pode perder por estar de olho noutro canto
 * da tela.
 */
const MS_DE_REPOUSO = 8_000;
let _relogioDoRepouso = null;

function agendarRepouso(root) {
	if (_relogioDoRepouso !== null) {
		clearTimeout(_relogioDoRepouso);
		_relogioDoRepouso = null;
	}
	if (!_opcoes.repouso) return;
	_relogioDoRepouso = setTimeout(() => {
		_relogioDoRepouso = null;
		const painel = root.querySelector('#chatbox');
		// Com o campo em foco o painel NAO dorme: quem esta digitando esta
		// usando, mesmo sem gerar evento nenhum por 8 s.
		if (!painel || painel.contains(root.activeElement)) return;
		painel.classList.add('is-repouso');
	}, MS_DE_REPOUSO);
}

function acordarDoRepouso(root) {
	const painel = root.querySelector('#chatbox');
	if (painel) painel.classList.remove('is-repouso');
	agendarRepouso(root);
}

/**
 * ===========================================================================
 * ROLAGEM ANCORADA (spec §7)
 * ===========================================================================
 * Quem rolou para cima nao perde o lugar quando chega mensagem nova. O botao
 * "novas mensagens" e o caminho de volta, e so aparece quando ha o que ler
 * abaixo.
 */
const FOLGA_DO_FIM = 8;

function estaColadoNoFim(elemento) {
	return elemento.scrollHeight - elemento.scrollTop - elemento.clientHeight <= FOLGA_DO_FIM;
}

function rolarParaOFimSeColado(root) {
	const ativo = root.querySelector('.content.active');
	if (ativo) ativo.scrollTop = ativo.scrollHeight;
	atualizarBotaoDeNovas(root);
}

function atualizarBotaoDeNovas(root, forcar) {
	const botao = root.querySelector('.cb-novas');
	const ativo = root.querySelector('.content.active');
	if (!botao || !ativo) return;
	botao.hidden = forcar === true ? false : estaColadoNoFim(ativo);
}

/**
 * ===========================================================================
 * OS BADGES DE NAO LIDO (spec §4)
 * ===========================================================================
 * Contagem por canal, ate "9+". Passar disso nao muda a decisao do jogador —
 * ele vai olhar de qualquer jeito — e estouraria a pilula.
 *
 * Antes era um pontinho sem numero: o jogador sabia que havia algo e nao sabia
 * se valia a pena trocar de aba.
 */
const _naoLidos = {};

function somarNaoLido(canal) {
	_naoLidos[canal] = (_naoLidos[canal] || 0) + 1;
}

function zerarNaoLido(canal) {
	_naoLidos[canal] = 0;
}

const textoDoBadge = n => (n > 9 ? '9+' : String(n));

function atualizarBadges(root) {
	let total = 0;
	CANAIS.forEach(canal => {
		const n = _naoLidos[canal] || 0;
		total += n;
		const pilula = root.querySelector(`.tab[data-canal="${canal}"] .cb-aba`);
		if (!pilula) return;
		pilula.classList.toggle('tem-nova', n > 0);
		const badge = pilula.querySelector('.cb-aba-badge');
		if (badge) badge.textContent = textoDoBadge(n);
	});

	// Recolhido nao ha aba na tela, e sem este badge somado o jogador nao teria
	// aviso nenhum — um chat que esconde novidade nao esta recolhido, esta mudo.
	const collapseBtn = root.querySelector('.cb-collapse');
	if (collapseBtn) {
		collapseBtn.classList.toggle('tem-nova', total > 0);
		const badge = collapseBtn.querySelector('.cb-collapse-badge');
		if (badge) badge.textContent = textoDoBadge(total);
	}
}

/**
 * A dica do Tab some depois de 20 envios (spec §6): ela ensina, e quem ja
 * aprendeu nao precisa de professor ocupando a barra.
 */
const ENVIOS_ATE_APRENDER = 20;

function aplicarDicaDoTab(root) {
	const dica = root.querySelector('.cb-dica-tab');
	if (dica) dica.hidden = (_envios.enviados || 0) >= ENVIOS_ATE_APRENDER;
}

function contarEnvio(root) {
	_envios.enviados = (_envios.enviados || 0) + 1;
	// Grava so ate o limite: depois dele o numero nao decide mais nada, e
	// escrever no `localStorage` a cada fala e desperdicio sincrono.
	if (_envios.enviados <= ENVIOS_ATE_APRENDER) gravarPreferencia('Envios', _envios);
	aplicarDicaDoTab(root);
}

function setChatFontScale(scale) {
	return function setChatFontScaleClosure() {
		_preferences.fontScale = clampChatFontScale(scale);
		_preferences.save();
		ChatBox.applyFontScale();
	};
}

function clampChatFontScale(scale) {
	const allowed = [1.0, 1.2, 1.4];
	let best = allowed[0];
	let bestDist = Infinity;

	scale = parseFloat(scale);
	if (!isFinite(scale) || scale <= 0) {
		return 1.0;
	}

	for (let i = 0; i < allowed.length; ++i) {
		const dist = Math.abs(allowed[i] - scale);
		if (dist < bestDist) {
			bestDist = dist;
			best = allowed[i];
		}
	}

	return best;
}

function getScrollLineHeightPx(element) {
	let style, lh;

	try {
		style = window.getComputedStyle(element);
		lh = parseFloat(style.lineHeight);
		if (isFinite(lh) && lh > 0) {
			return Math.round(lh);
		}
	} catch (_e) {
		// Ignore
	}

	return 14;
}

ChatBox.applyFontScale = function applyFontScale() {
	const root = _root();
	const scale = clampChatFontScale(_preferences.fontScale || 1.0);
	const baseFont = 12;
	const baseLineHeight = 14;
	const baseInputLineHeight = 18;

	const fontSize = Math.max(10, Math.round(baseFont * scale));
	const lineHeight = Math.max(12, Math.round(baseLineHeight * scale));
	const inputLineHeight = Math.max(14, Math.round(baseInputLineHeight * scale));

	_preferences.fontScale = scale;

	// Chat log
	root.querySelectorAll('.content').forEach(el => {
		el.style.fontSize = `${fontSize}px`;
		el.style.lineHeight = `${lineHeight}px`;
	});

	// Chat input
	root.querySelectorAll('.input input, .input .message').forEach(el => {
		el.style.fontSize = `${fontSize}px`;
	});

	const message = root.querySelector('.input .message');
	if (message) {
		message.style.lineHeight = `${inputLineHeight}px`;
	}
};

// CLICKABLE ITEM → OPEN ITEMINFO (handle inside shadow)
ChatBox._setupItemLinkHandler = function _setupItemLinkHandler() {
	const root = _root();
	if (!root) return;

	root.addEventListener('click', event => {
		const link = event.target.closest('.item-link');
		if (!link) return;

		// If the link is inside the chat input, keep focus there
		if (link.closest('.input-chatbox')) {
			event.stopImmediatePropagation();
			return;
		}

		const item = DB.parseItemLink(link.dataset.item || link.getAttribute('data-item'));
		if (!item) return;

		const ItemInfo = UIManager.getComponent('ItemInfo');
		ItemInfo.append();
		ItemInfo.setItem(item);
	});
};

// Also keep global handler for item links outside shadow (backwards compatibility)
document.addEventListener('click', event => {
	const link = event.target.closest('.item-link');
	if (!link) {
		return;
	}

	if (link.closest('#chatbox .input-chatbox')) {
		event.stopImmediatePropagation();
		event.preventDefault();
		return;
	}

	const item = DB.parseItemLink(link.dataset.item);
	if (!item) {
		return;
	}

	const ItemInfo = UIManager.getComponent('ItemInfo');
	ItemInfo.append();
	ItemInfo.setItem(item);
});

/**
 * LINKA UM ITEM NA BARRA DE DIGITACAO (D-946, 06/09/2026 — pedido do dono).
 *
 * A porta que faltava: o unico gesto que produzia link de item era SHIFT+clique
 * na mochila, e no celular — onde o jogo mora — nao ha SHIFT. Agora a ficha do
 * item tem o botao "Linkar no chat" (ItemInfo.js), e ele desagua aqui.
 *
 * O metodo mora no ChatBox, e nao na ficha, porque o que ele faz antes de
 * escrever e ESTADO DO CHAT: expandir o painel fechado, sair de um canal que
 * nao digita e abrir a barra que nasce escondida. Quem quiser linkar de outro
 * lugar chama isto e herda as tres — as tres razoes estao em
 * `linkDeItemNoChat.js`, que e a parte pura e testada da decisao.
 *
 * D-948 nao mudou nenhuma das tres, so o SUJEITO da primeira: "recolhido" era
 * um booleano e virou um de tres estados, entao quem responde e `estaFechado()`
 * — que e verdade tanto no recolhido quanto no minimizado, e nos dois o campo
 * de digitacao esta fora de alcance do jeito que importa aqui.
 *
 * @param {object} item item do inventario (ou o ja decodificado de um link)
 * @returns {boolean} `false` quando o link nao entrou, e o motivo ja foi dito
 */
ChatBox.inserirLinkDeItem = function inserirLinkDeItem(item) {
	const root = _root();
	if (!root || !item) {
		return false;
	}

	const campo = root.querySelector('.input-chatbox');
	if (!campo) {
		return false;
	}

	const link = DB.createItemLink(item);
	if (!link) {
		return false;
	}

	/*
	 * O TETO E COBRADO AQUI porque nao e cobrado em lugar nenhum: `MAX_LENGTH`
	 * vigia o `input` e o `paste`, e escrita por codigo passa por fora dos
	 * dois. Sem esta guarda o link entra, estoura os 100, e a barra trava para
	 * digitar — o jogador fica com um link que nao consegue mais acompanhar de
	 * texto nenhum, sem nada dizendo por que.
	 */
	if (!cabeNoLimite(extractChatMessage(campo), link, MAX_LENGTH)) {
		ChatBox.addText(
			'A linha de digitação está cheia — apague algo antes de linkar o item.',
			ChatBox.TYPE.ERROR,
			ChatBox.FILTER.SISTEMA
		);
		return false;
	}

	const barra = root.querySelector('.input');
	const modoBatalha = root.querySelector('.battlemode');
	const preparo = preparoParaLinkar({
		recolhido: estaFechado(),
		canal: ChatBox.activeTab,
		barraVisivel: !!barra && barra.style.display !== 'none'
	});

	if (preparo.trocarPara) {
		ChatBox.switchTab(preparo.trocarPara);
	}
	if (preparo.expandir) {
		// `false` no segundo: isto nao e o jogador escolhendo o tamanho do chat.
		definirRecolhido(false, false);
	}
	if (preparo.abrirBarra) {
		if (barra) barra.style.display = 'flex';
		if (modoBatalha) modoBatalha.style.display = 'none';
	}

	const nome = item.name || DB.getItemName(item);

	/*
	 * `insertAdjacentHTML` e nao `innerHTML +=`: reescrever o innerHTML inteiro
	 * recria os `<span>` dos links que ja estavam la e joga fora a posicao do
	 * cursor. E o espaco depois e NBSP de proposito — um espaco comum no fim de
	 * um contenteditable colapsa, e `extractChatMessage` ja devolve NBSP como
	 * espaco normal na hora de enviar.
	 */
	campo.insertAdjacentHTML('beforeend', markupDoLink(link, nome));
	campo.appendChild(document.createTextNode('\u00A0'));

	campo.focus();
	// Cursor no fim, senao ele volta para antes do link que acabou de entrar.
	const selection = window.getSelection();
	if (selection) {
		const range = document.createRange();
		range.selectNodeContents(campo);
		range.collapse(false);
		selection.removeAllRanges();
		selection.addRange(range);
	}

	return true;
};

ChatBox.insertText = function (text) {
	const root = _root();
	const input = root.querySelector('.input-chatbox');
	if (!input) return;

	input.appendChild(document.createTextNode(text));
	input.focus();
};

// Override mouseMode to CROSS since chatbox body is click-through
ChatBox.mouseMode = GUIComponent.MouseMode.CROSS;

/**
 * Create component and export it
 */
export default UIManager.addComponent(ChatBox);
