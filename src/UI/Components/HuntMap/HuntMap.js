/**
 * UI/Components/HuntMap/HuntMap.js
 *
 * "Mapa de Caça" — custom RAGIDLE window. Lets the player browse the
 * hunting-map catalog (level range, monsters, drops, MVP) and travel
 * between maps by menu instead of the classic warp portals.
 *
 * Protocol (custom extension, not part of stock rAthena/roBrowser):
 *   CZ_RAGIDLE_PEDIR_CATALOGO 0x0ff0  (client -> server, fixed, opcode only)
 *   ZC_RAGIDLE_CATALOGO       0x0ff1  (server -> client, variable, JSON payload)
 *   CZ_RAGIDLE_VIAJAR         0x0ff2  (client -> server, fixed 18 bytes)
 *   CZ_RAGIDLE_PEDIR_MONSTROS 0x0fe1  (client -> server, fixed 18 bytes)
 *   ZC_RAGIDLE_MONSTROS       0x0fe0  (server -> client, variable, JSON payload)
 *
 * D-788: the catalogue is an INDEX (mobId, name, drop NAMES — everything the
 * grid and the search box need at once) and the per-map fiche (race, element,
 * drop ids and chances) is fetched when a map is selected. Until v1 the fiche
 * of every monster of every map travelled inline: 84.4% of the payload, and
 * three new maps pushed it 104 bytes past the protocol's u16 size field. The
 * server refused to send it and the window stopped opening.
 * Declared in Network/PacketStructure.js (search "RAGIDLE:") and registered
 * for receive-side framing in Network/PacketRegister.js and
 * Network/Packets/packets2021_len_main.js (see comments there).
 *
 * D-901 (01/09/2026): o ATLAS. A janela deixou de ser a cópia do Midgard Idle
 * (ver o cabeçalho de HuntMap.css para a composição nova: trilho de regiões,
 * linhas com medidor de encaixe, dossiê com banner e ladrilhos de drop). O que
 * NÃO mudou: os cinco pacotes acima, o contrato v2, a memória de aba/filtro, a
 * viagem sem janela (`travelToCity`) e os seletores que provas externas usam
 * (`.hm-window`, `.hm-close`, `.hm-card`, `.hm-card-thumb img`, `.hm-card-go`).
 * O que ENTROU: clicar num drop abre a ficha do item (ItemInfo, a mesma janela
 * que a Mochila e a loja de NPC abrem), e a busca diz por que trouxe cada mapa.
 * As regras sem DOM (encaixe, medidor, motivo da busca, ordem, formato de
 * chance) moram em `atlasDeCaca.js`, com teste que as executa.
 *
 * Pattern followed here (module self-registers its own packet hook, no
 * separate Engine/MapEngine/*.js file): same as
 * UI/Components/Enchant/Enchant.js:1986 (`Network.hookPacket(...)` at
 * module top-level, right before the default export) and
 * UI/Components/CashShopIcon/CashShopIcon.js (floating icon that toggles a
 * window and sends packets straight from the UI component).
 *
 * @author RagIdle
 */

import Renderer from 'Renderer/Renderer.js';
import Preferences from 'Core/Preferences.js';
import Client from 'Core/Client.js';
import DB from 'DB/DBManager.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import UIManager from 'UI/UIManager.js';
import ChatBox from 'UI/Components/ChatBox/ChatBox.js';
import ItemInfo from 'UI/Components/ItemInfo/ItemInfo.js';
import GUIComponent from 'UI/GUIComponent.js';
import RiIcones from 'UI/ri-icones.js';
import { dropsDoMapa } from './dropsDoMapa.js'; // RAGIDLE: a visao agregada (I6)
import {
	encaixeDeNivel,
	formatarChance,
	medidorDeEncaixe,
	motivoDaBusca,
	ordenarMapas,
	resumoDoMotivo
} from './atlasDeCaca.js';
import htmlText from './HuntMap.html?raw';
import cssText from './HuntMap.css?raw';
import { fecharEEsquecer } from '../limpezaDeJanelaIdle.js';
import { abaLembrada, lembrarAba } from '../memoriaDeAba.js';

/**
 * Keep in sync with the ":host" / ".hm-window" size in HuntMap.css — used
 * to clamp the saved window position to the current viewport.
 *
 * Builder de polimento (18/08/2026), responsividade 1366x768: media com
 * Playwright (getBoundingClientRect) mostrou esta janela centralizada
 * batendo no DockIdle no piso de resolucao — janela em y:74-696 (620 +
 * bordas) contra o dock em y:690-768, 6px de sobreposicao real. O CONSERTO
 * mora so em HuntMap.css (".hm-window"/":host" dentro de "@media
 * (max-height:800px)" encolhem pra 590 so em telas baixas) — este WINDOW_
 * HEIGHT continua 620 de propósito, e a matematica de centralizar/travar
 * (onAppend, onRemove abaixo) continua assumindo 620 em toda resolucao.
 * Isso e SEGURO, nao um desalinho esquecido: em telas baixas o retangulo
 * real fica MENOR que os 620 que o JS supoe, entao "top" calculado pra uma
 * caixa de 620 sobra folga embaixo (a caixa de 590 nunca alcanca onde uma
 * de 620 alcancaria) — nunca o contrario. Ver o mesmo raciocinio, por
 * extenso, no comentario do default de StatusIdle.js/.css.
 */
const WINDOW_WIDTH = 900;
const WINDOW_HEIGHT = 620;

/**
 * Largura da janela ItemInfo (ItemInfo.css, `.ItemInfo { width: 320px }`) —
 * usada só para escolher de que lado do atlas a ficha do item abre.
 */
const ITEM_INFO_WIDTH = 320;

/**
 * Cap on how many mob avatars are shown overlapped in a map row's
 * "avatar-stack" (HuntMap.css .hm-mob-stack) — the "N monstros" count text
 * next to it always reflects the REAL total, this only bounds the icons.
 */
const MOB_STACK_MAX = 5;

/**
 * A versao do contrato do catalogo, do servidor (`servidor/mapa/catalogo.ts`).
 *
 * 2 desde D-788: o catalogo virou INDICE e a ficha de cada mapa passou a vir
 * por pedido. Um cliente que lesse `mapa.monstros[].raca` de um servidor v2
 * acharia `undefined` — recusar pelo `v` e melhor que desenhar em branco.
 */
const CONTRATO_DO_CATALOGO = 2;

/**
 * Race translation (PT-BR), fixed dictionary as requested.
 */
const RACE_PT = {
	Formless: 'Amorfo',
	Undead: 'Morto-vivo',
	Brute: 'Bruto',
	Plant: 'Planta',
	Insect: 'Inseto',
	Fish: 'Peixe',
	Demon: 'Demônio',
	DemiHuman: 'Semi-humano',
	Angel: 'Anjo',
	Dragon: 'Dragão'
};

/**
 * Element translation (PT-BR), fixed dictionary as requested.
 */
const ELEMENT_PT = {
	Neutral: 'Neutro',
	Water: 'Água',
	Earth: 'Terra',
	Fire: 'Fogo',
	Wind: 'Vento',
	Poison: 'Veneno',
	Holy: 'Sagrado',
	Dark: 'Sombrio',
	Ghost: 'Fantasma',
	Undead: 'Morto-vivo'
};

/**
 * Create Component
 */
const HuntMap = new GUIComponent('HuntMap', cssText);

/**
 * Os glifos do chrome (lupa, cadeado, seta, mapa vazio, X) entram pelo
 * marcador "<!--RI_ICONE:chave-->" do .html — a mesma troca que o
 * TopMenuIdle faz. O glifo vem de UM arquivo (ri-icones.js), por regra.
 */
HuntMap.render = () => htmlText.replace(/<!--RI_ICONE:(\w+)-->/g, (_, chave) => RiIcones[chave] || '');

/**
 * Floating icon must not block scene clicks/hover — same choice as the
 * other always-on floating icon, CashShopIcon (see
 * UI/Components/CashShopIcon/CashShopIcon.js:60). Also sidesteps having to
 * reason about GUIComponent's MouseMode.STOP hover listeners
 * (GUIComponent.js:823-866) firing on a ":host" box that is mostly
 * transparent to the pointer (see HuntMap.css header comment).
 */
HuntMap.mouseMode = GUIComponent.MouseMode.CROSS;

/**
 * @var {object|null} last catalog received from the server (contract v2)
 */
HuntMap.catalog = null;

/**
 * @var {string} currently selected map (right-hand dossier)
 */
HuntMap.selectedMapa = null;

/**
 * @var {string} a aba de fabrica — a regiao "todas", que sempre existe porque e
 *      nossa e nao do catalogo.
 */
const ABA_PADRAO = 'Todas';

/**
 * @var {string} active region tab ("Todas" or one of catalog.regioes)
 *
 * NAO ha lista de abas validas para passar a `abaLembrada`: as abas desta
 * janela sao as REGIOES que o servidor manda, e escrever a lista aqui seria
 * duplicar o catalogo. Quem confere e onCatalogReceived(), que ja devolvia a
 * aba para "Todas" quando a regiao guardada nao existe no catalogo que chegou —
 * a mesma guarda cobre agora a regiao vinda do `localStorage`.
 */
HuntMap.activeTab = ABA_PADRAO;

/**
 * @var {string} current search term (matches map name, monster name AND
 *      drop name — see motivoDaBusca em atlasDeCaca.js)
 */
HuntMap.searchTerm = '';

/**
 * @var {boolean} o controle "Para mim / Todos" da barra (era a caixinha "só
 *      ideais para mim" do popover de filtros, até a v4).
 *
 * Lembrado junto com a aba (pedido do dono, 31/08/2026: "Sugestoes / Todos os
 * Mapas"): nesta janela o que faz as vezes de aba de verdade nao e a regiao, e
 * este interruptor — e quem caca sempre no que serve para o proprio nivel o
 * religava a cada F5.
 */
HuntMap.filterIdealOnly = false;

/**
 * @var {string} left-list sort key: 'nivel' | 'nivel-recomendado' | 'nome'
 */
HuntMap.sortKey = 'nivel';

/**
 * QUAL VISAO DE DROP o dossiê mostra (RAGIDLE, I6 — 31/08/2026).
 *
 * `'mob'` e a de sempre: escolhe um monstro na lista e ve o drop DELE.
 * `'mapa'` e a outra: todo o drop do mapa numa grade so, deduplicado.
 *
 * O dono pediu "ter as 2 opcoes" com todas as letras, entao a visao por
 * monstro continua sendo o padrao — quem abre a janela ve o que sempre viu.
 */
HuntMap.visaoDeDrop = 'mob';

/**
 * @var {number|string|null} mobId selected in the dossier's monster list
 *      (drives the drop grid below it). Reset to null whenever the selected
 *      map changes so the panel falls back to the first monster of the new
 *      map (see onClickCard/renderPanel).
 */
HuntMap.selectedMobId = null;

/**
 * @var {boolean} RAGIDLE: true when a catalog fetch was kicked off by
 * HuntMap.travelToCity() (see below) instead of the window opening — once
 * the catalog arrives, onCatalogReceived travels straight to the city and
 * leaves the window closed, instead of the usual render.
 */
let _pendingAutoTravel = false;

/**
 * ESQUECE O PERSONAGEM ANTERIOR — ver a nota gemea em IdleConfig.js
 * (27/08/2026, auditoria C).
 *
 * Aqui o catalogo depende do NIVEL (o filtro "ideal para mim"), entao o de A
 * mostrado para B nao e so estranho: e errado. E `_pendingAutoTravel` armada
 * atravessando a troca teleportaria o personagem novo.
 */
HuntMap.limparEstadoDoPersonagem = function limparEstadoDoPersonagem() {
	HuntMap.catalog = null;
	// A ficha e do CATALOGO daquele personagem: deixa-la atravessar mostraria
	// os monstros de um mapa como o outro personagem os via (D-788).
	HuntMap.fichas = {};
	HuntMap.selectedMapa = null;
	HuntMap.selectedMobId = null;
	_pendingAutoTravel = false;
	/*
	 * ZERAR O DADO NAO BASTA: `GUIComponent.remove()` so DESANEXA o host,
	 * entao o shadow DOM (com `is-open` e o HTML do personagem anterior)
	 * atravessa a troca. Ver `UI/Components/limpezaDeJanelaIdle.js`.
	 */
	fecharEEsquecer(_root(), '.hm-window');
};

/**
 * @var {Preferences} posicao da janela (x/y null ate o jogador mover), a REGIAO
 *      em que ele estava (`aba`) e o interruptor "so ideais para mim"
 *      (`soIdeais`). Versao continua 1.0: somar chave nova aos padroes nao
 *      exige subir versao, e subir apagaria a posicao ja salva — a conta esta
 *      no cabecalho de memoriaDeAba.js.
 */
const _preferences = Preferences.get(
	'HuntMap',
	{
		x: null,
		y: null,
		aba: null,
		soIdeais: null
	},
	1.0
);

/**
 * Helper: query inside shadow root
 */
function _root() {
	return HuntMap._shadow || HuntMap._host;
}

/**
 * Escape user/server supplied text before injecting into innerHTML.
 */
function escapeHtml(value) {
	return String(value == null ? '' : value).replace(/[&<>"']/g, ch => {
		switch (ch) {
			case '&':
				return '&amp;';
			case '<':
				return '&lt;';
			case '>':
				return '&gt;';
			case '"':
				return '&quot;';
			default:
				return '&#39;';
		}
	});
}

/**
 * One-time setup (runs once, during GUIComponent#prepare()).
 */
HuntMap.init = function init() {
	const root = _root();

	// A regiao e o filtro em que o jogador estava, antes do primeiro desenho.
	// A regiao pode nao existir mais no catalogo — quem confere e
	// onCatalogReceived(), quando o catalogo chegar.
	HuntMap.activeTab = abaLembrada(_preferences, ABA_PADRAO);
	HuntMap.filterIdealOnly = _preferences.soIdeais === true;

	root.querySelector('.hm-button').addEventListener('click', onClickButton);
	root.querySelector('.hm-close').addEventListener('click', onClickClose);
	root.querySelector('.hm-search').addEventListener('input', onSearchInput);
	root.querySelector('.hm-search-clear').addEventListener('click', onClickSearchClear);
	root.querySelectorAll('.hm-modo .hm-seg-btn').forEach(b => b.addEventListener('click', onClickModo));
	root.querySelector('.hm-sort').addEventListener('change', onChangeSort);

	this.draggable(root.querySelector('.hm-titlebar'));

	// O controle "Para mim / Todos" nasce sem selecao no HTML: sem isto ele
	// DIRIA "todos" enquanto a lista mostra so os ideais.
	renderModo();

	// Default centered position, may be overridden by saved preferences in onAppend()
	this._host.style.top = Math.max(0, (Renderer.height - WINDOW_HEIGHT) / 2) + 'px';
	this._host.style.left = Math.max(0, (Renderer.width - WINDOW_WIDTH) / 2) + 'px';

	renderTabs();
	renderList();
	renderPanel();
};

/**
 * Restore saved window position once appended to the DOM.
 */
HuntMap.onAppend = function onAppend() {
	if (_preferences.x != null && _preferences.y != null) {
		this._host.style.top = Math.min(Math.max(0, _preferences.y), Renderer.height - WINDOW_HEIGHT) + 'px';
		this._host.style.left = Math.min(Math.max(0, _preferences.x), Renderer.width - WINDOW_WIDTH) + 'px';
	}
};

/**
 * Save window position when the component is removed (defensive — in
 * practice this floating icon stays appended for the whole map session,
 * same as CashShopIcon/ChatBox/etc, see Engine/MapEngine.js).
 */
HuntMap.onRemove = function onRemove() {
	savePosition();
};

function savePosition() {
	_preferences.x = parseInt(HuntMap._host.style.left, 10) || 0;
	_preferences.y = parseInt(HuntMap._host.style.top, 10) || 0;
	_preferences.save();
}

/**
 * Show/hide the window (button stays visible either way).
 */
HuntMap.toggle = function toggle() {
	const root = _root();
	const win = root.querySelector('.hm-window');
	if (win.classList.contains('is-open')) {
		closeWindow();
	} else {
		win.classList.add('is-open');
		HuntMap.focus();
		requestCatalog();
	}
};

function closeWindow() {
	const root = _root();
	root.querySelector('.hm-window').classList.remove('is-open');
	savePosition();
}

function onClickButton(e) {
	e.stopImmediatePropagation();
	HuntMap.toggle();
}

function onClickClose(e) {
	e.stopImmediatePropagation();
	closeWindow();
}

function onSearchInput(e) {
	HuntMap.searchTerm = e.target.value;
	_root().querySelector('.hm-search-clear').hidden = !HuntMap.searchTerm;
	renderList();
}

function onClickSearchClear(e) {
	e.stopImmediatePropagation();
	const campo = _root().querySelector('.hm-search');
	campo.value = '';
	HuntMap.searchTerm = '';
	e.currentTarget.hidden = true;
	renderList();
	campo.focus();
}

function onClickModo(e) {
	e.stopImmediatePropagation();
	HuntMap.filterIdealOnly = e.currentTarget.dataset.modo === 'ideais';
	_preferences.soIdeais = HuntMap.filterIdealOnly;
	_preferences.save();
	renderModo();
	renderList();
}

function renderModo() {
	_root()
		.querySelectorAll('.hm-modo .hm-seg-btn')
		.forEach(b => {
			const ativo = (b.dataset.modo === 'ideais') === HuntMap.filterIdealOnly;
			b.classList.toggle('is-selected', ativo);
			b.setAttribute('aria-selected', ativo ? 'true' : 'false');
		});
}

function onChangeSort(e) {
	HuntMap.sortKey = e.target.value;
	renderList();
}

/**
 * Ask the server for the hunting-map catalog.
 * CZ_RAGIDLE_PEDIR_CATALOGO — opcode 0x0ff0, fixed 2 bytes (opcode only).
 */
function requestCatalog() {
	setStatus(HuntMap.catalog ? 'Atualizando catálogo...' : 'Carregando mapas de caça...');
	Network.sendPacket(new PACKET.CZ.RAGIDLE_PEDIR_CATALOGO());
}

/**
 * A ficha de cada mapa, por mapa, uma vez por sessao de janela (D-788).
 *
 * `null` guardado = pedido EM VOO. Sem essa marca, cada `renderPanel` do mesmo
 * mapa dispararia um pedido novo — e `renderPanel` roda a cada clique de chip,
 * a cada troca de visao e a cada re-render da lista.
 */
HuntMap.fichas = {};

/**
 * CZ_RAGIDLE_PEDIR_MONSTROS — opcode 0x0fe1, 18 bytes (opcode + mapa em 16).
 * Mesma forma de CZ_RAGIDLE_VIAJAR.
 */
function pedirFicha(mapName) {
	if (!mapName || Object.prototype.hasOwnProperty.call(HuntMap.fichas, mapName)) {
		return;
	}
	HuntMap.fichas[mapName] = null; // em voo
	const pkt = new PACKET.CZ.RAGIDLE_PEDIR_MONSTROS();
	pkt.mapName = mapName;
	Network.sendPacket(pkt);
}

/**
 * ZC_RAGIDLE_MONSTROS — a ficha de um mapa.
 *
 * O servidor responde com SILENCIO para mapa que nao e de caca (prontera), e
 * isso e o desenho: a marca de "em voo" fica, o painel segue mostrando os
 * chips do indice, e nao ha pedido repetido a cada render.
 */
function onMonstrosReceived(pkt) {
	let data;
	try {
		data = JSON.parse(pkt.json);
	} catch (e) {
		console.error('[HuntMap] Falha ao interpretar a ficha de monstros:', e, pkt.json);
		return;
	}
	if (!data || data.v !== CONTRATO_DO_CATALOGO || !data.mapa) {
		console.error('[HuntMap] Ficha com contrato incompativel (v=' + (data && data.v) + ').', data);
		return;
	}
	/*
	 * O NOME QUE O JOGADOR LÊ (D-901). O servidor manda o nome do rAthena, em
	 * inglês ("Tree Root"); a Mochila e a ficha do item mostram o do cliente
	 * ("Raiz de Árvore", nomesLocais.js). Um ladrilho em inglês abrindo uma
	 * ficha em português pareceria outro item. A tradução é feita UMA vez, na
	 * chegada da ficha, e fica em `nomeLocal` ao lado do `nome` do servidor —
	 * a busca aceita os dois (atlasDeCaca.motivoDaBusca).
	 */
	for (const m of (data.monstros || []).concat(data.mvp ? [data.mvp] : [])) {
		for (const d of m.drops || []) {
			d.nomeLocal = nomeLocalDoItem(d.itemId, d.nome);
		}
	}
	HuntMap.fichas[data.mapa] = data;
	// So re-desenha se o jogador ainda esta olhando este mapa: a ficha pode
	// chegar depois de ele ter clicado em outro.
	if (HuntMap.selectedMapa === data.mapa) {
		renderPanel();
	}
}

/**
 * O nome local de um item pelo id, com o do servidor de reserva: a tabela do
 * cliente devolve "Unknown Item" (ou nada) para id que o GRF não conhece, e
 * nesse caso o nome do rAthena é a única verdade disponível.
 */
function nomeLocalDoItem(itemId, nomeDoServidor) {
	const it = DB.getItemInfo(itemId);
	const local = it && it.identifiedDisplayName;
	if (!local || /^unknown item$/i.test(String(local).trim())) {
		return nomeDoServidor;
	}
	return local;
}

function setStatus(text) {
	const root = _root();
	const el = root.querySelector('.hm-status');
	if (el) {
		el.textContent = text || '';
	}
}

/**
 * Avisa NO CHAT quando a janela esta fechada (27/08/2026, auditoria C).
 *
 * `setStatus` escreve dentro da janela do Mapa de Caca. Quando o pedido veio
 * do botao contextual — que e o caminho do `travelToCity` — a janela esta
 * fechada, e a mensagem ia para um DOM que ninguem ve: o jogador clicava
 * "Retornar para Prontera", nao viajava, e nada aparecia na tela.
 *
 * Com a janela ABERTA nao se repete: ela ja mostra o status.
 */
function avisarSeAJanelaEstaFechada(texto) {
	const janela = _root().querySelector('.hm-window');
	if (janela && janela.classList.contains('is-open')) {
		return;
	}
	ChatBox.addText(texto, ChatBox.TYPE.ERROR, ChatBox.FILTER.PUBLIC_LOG);
}

/**
 * ZC_RAGIDLE_CATALOGO — opcode 0x0ff1, variable size, JSON UTF-8 payload
 * (see PACKET.ZC.RAGIDLE_CATALOGO in Network/PacketStructure.js, which
 * decodes the remainder of the packet into pkt.json).
 */
function onCatalogReceived(pkt) {
	/*
	 * A VIAGEM PENDENTE MORRE COM A RESPOSTA RUIM (27/08/2026, auditoria C).
	 *
	 * `travelToCity()` arma `_pendingAutoTravel` e pede o catalogo so para
	 * descobrir `catalog.cidade.mapa` — a janela fica fechada o tempo todo. Os
	 * dois `return` antecipados abaixo ficavam ANTES do consumo da flag, entao
	 * uma resposta ilegivel a deixava armada PARA SEMPRE (ela e de modulo e nao
	 * e zerada no `onRemove`).
	 *
	 * O estrago aparecia muito depois e sem relacao com a causa: o jogador abre
	 * a janela "Mapa de Caca" pela primeira vez, o catalogo bom chega, a flag
	 * ainda e `true` — e ele e TELEPORTADO para a cidade e a janela fecha na
	 * cara dele, sem ter pedido nada.
	 *
	 * Desarmar aqui, antes de qualquer `return`, e o conserto inteiro: a viagem
	 * que a resposta ruim nao pode cumprir nao fica pendurada esperando outra.
	 */
	const viagemPendente = _pendingAutoTravel;
	_pendingAutoTravel = false;

	let data;
	try {
		data = JSON.parse(pkt.json);
	} catch (e) {
		console.error('[HuntMap] Falha ao interpretar o catálogo recebido:', e, pkt.json);
		setStatus('Catálogo incompatível.');
		avisarSeAJanelaEstaFechada('Catálogo de mapas incompatível — a viagem não saiu.');
		return;
	}

	if (!data || data.v !== CONTRATO_DO_CATALOGO) {
		console.error('[HuntMap] Catálogo com contrato incompatível (v=' + (data && data.v) + ').', data);
		setStatus('Catálogo incompatível.');
		avisarSeAJanelaEstaFechada('Catálogo de mapas incompatível — a viagem não saiu.');
		return;
	}

	HuntMap.catalog = data;

	// RAGIDLE: HuntMap.travelToCity() asked for this catalog just to learn
	// catalog.cidade.mapa, not to open the window — finish that trip now and
	// skip the normal render (the window stays closed the whole time).
	if (viagemPendente) {
		sendTravel(data.cidade && data.cidade.mapa);
		return;
	}

	if (!HuntMap.selectedMapa || !data.mapas.some(m => m.mapa === HuntMap.selectedMapa)) {
		HuntMap.selectedMapa = data.mapaAtual;
	}
	/*
	 * NA CIDADE, O DOSSIÊ NÃO PODE ABRIR VAZIO (D-901). O mapa atual (Prontera)
	 * não é mapa de caça, então "selecionar o atual" deixava a coluna da
	 * direita dizendo "Selecione um mapa" — e o jogador que abre a janela na
	 * cidade é exatamente quem está escolhendo para onde ir. Pré-seleciona o
	 * primeiro mapa IDEAL para o nível dele (na ordem de nível), ou o primeiro
	 * do catálogo se não houver ideal. Custa um pedido de ficha, só.
	 */
	if (!data.mapas.some(m => m.mapa === HuntMap.selectedMapa)) {
		const porNivel = ordenarMapas(data.mapas, 'nivel', data.nivel);
		const ideal = porNivel.find(m => encaixeDeNivel(data.nivel, m).cls === 'ideal');
		HuntMap.selectedMapa = (ideal || porNivel[0] || {}).mapa || null;
	}
	if (HuntMap.activeTab !== ABA_PADRAO && !data.regioes.includes(HuntMap.activeTab)) {
		HuntMap.activeTab = ABA_PADRAO;
	}

	setStatus('');
	renderTabs();
	renderList();
	renderPanel();
}

/**
 * O trilho de regiões: "Todas" + cada região com ao menos um mapa, com a
 * contagem REAL de mapas dela. A contagem sai do catálogo INTEIRO (não do
 * filtro/busca) — o número de uma região é "quantos mapas há nela",
 * independente do que está digitado na busca.
 *
 * Embaixo, o card "Você está em": leva ao mapa atual (seleciona a linha e
 * abre o dossiê dele). Não aparece na cidade — a cidade não é mapa de caça.
 */
function renderTabs() {
	const root = _root();
	const tabsEl = root.querySelector('.hm-tabs');
	const voceEl = root.querySelector('.hm-voce');
	const catalog = HuntMap.catalog;
	const allMapas = (catalog && catalog.mapas) || [];
	const regions = [ABA_PADRAO].concat((catalog && catalog.regioes) || []);

	tabsEl.innerHTML = regions
		.map(region => {
			const count = region === ABA_PADRAO ? allMapas.length : allMapas.filter(m => m.regiao === region).length;
			return `<button type="button" class="hm-tab${region === HuntMap.activeTab ? ' is-active' : ''}" data-region="${escapeHtml(region)}"><span class="hm-tab-name">${escapeHtml(region)}</span><span class="hm-tab-count">${count}</span></button>`;
		})
		.join('');

	tabsEl.querySelectorAll('.hm-tab').forEach(btn => btn.addEventListener('click', onClickTab));

	const atual = catalog && allMapas.find(m => m.mapa === catalog.mapaAtual);
	if (!catalog) {
		voceEl.innerHTML = '';
	} else {
		const onde = atual ? atual.rotulo : catalog.cidade && catalog.cidade.rotulo;
		voceEl.innerHTML = `
			<button type="button" class="hm-voce-card" data-mapa="${escapeHtml(atual ? atual.mapa : '')}"${atual ? '' : ' disabled'}>
				<span class="hm-voce-label">Você está em</span>
				<span class="hm-voce-map">${escapeHtml(onde || catalog.mapaAtual)}</span>
				<span class="hm-voce-nivel">Nv. ${catalog.nivel}</span>
			</button>`;
		const card = voceEl.querySelector('.hm-voce-card');
		if (atual) {
			card.addEventListener('click', onClickVoce);
		}
	}
}

function onClickTab(e) {
	e.stopImmediatePropagation();
	HuntMap.activeTab = e.currentTarget.dataset.region;
	lembrarAba(_preferences, HuntMap.activeTab);
	renderTabs();
	renderList();
}

/**
 * "Você está em X": seleciona o mapa atual e o traz à vista na lista — se a
 * região ativa o esconde, volta para "Todas" (sem esquecer a aba lembrada:
 * o jogador pediu para VER o mapa, não para trocar de região).
 */
function onClickVoce(e) {
	e.stopImmediatePropagation();
	const mapa = e.currentTarget.dataset.mapa;
	if (!mapa) {
		return;
	}
	HuntMap.selectedMapa = mapa;
	HuntMap.selectedMobId = null;
	const alvo = HuntMap.catalog.mapas.find(m => m.mapa === mapa);
	if (alvo && HuntMap.activeTab !== ABA_PADRAO && alvo.regiao !== HuntMap.activeTab) {
		HuntMap.activeTab = ABA_PADRAO;
		renderTabs();
	}
	renderList();
	renderPanel();
	const linha = _root().querySelector(`.hm-card[data-mapa="${CSS.escape(mapa)}"]`);
	if (linha && linha.scrollIntoView) {
		linha.scrollIntoView({ block: 'nearest' });
	}
}

/**
 * All monsters of a map as one flat list, common population first, MVP
 * last (if any) — used everywhere a map's "every monster" set is needed
 * (row avatar-stack, dossier list, search-by-monster/drop).
 */
function allMonstersOf(mapa) {
	/*
	 * A FICHA QUANDO HOUVER, o indice sempre (D-788).
	 *
	 * As duas formas trazem `mobId` e `nome`, que e o que os chips e os
	 * avatares desenham — entao a grade e a busca funcionam sem a ficha. O que
	 * so a ficha tem e raca, elemento e a CHANCE de cada drop, e quem precisa
	 * disso (`renderMobDrops`, `renderDropsDoMapa`) pergunta por `raca`.
	 */
	const ficha = mapa && HuntMap.fichas[mapa.mapa];
	const fonte = ficha || mapa;
	return (fonte.monstros || []).concat(fonte.mvp ? [fonte.mvp] : []);
}

/**
 * A lista de mapas, filtrada por região + busca + "Para mim", e ordenada
 * pelo seletor "Ordem". Cada linha guarda o MOTIVO de a busca tê-la trazido
 * (`atlasDeCaca.motivoDaBusca`), para dizer "↳ Jellopy (Poring)".
 */
function renderList() {
	const root = _root();
	const listEl = root.querySelector('.hm-list');
	const countEl = root.querySelector('.hm-count');
	const catalog = HuntMap.catalog;

	if (!catalog) {
		listEl.innerHTML = '';
		if (countEl) {
			countEl.textContent = '';
		}
		return;
	}

	const term = HuntMap.searchTerm.trim().toLowerCase();
	const motivos = new Map();
	let mapas = catalog.mapas.filter(mapa => {
		if (HuntMap.activeTab !== ABA_PADRAO && mapa.regiao !== HuntMap.activeTab) {
			return false;
		}
		const motivo = motivoDaBusca(mapa, allMonstersOf(mapa), term);
		if (!motivo) {
			return false;
		}
		if (HuntMap.filterIdealOnly && encaixeDeNivel(catalog.nivel, mapa).cls !== 'ideal') {
			return false;
		}
		motivos.set(mapa.mapa, motivo);
		return true;
	});
	mapas = ordenarMapas(mapas, HuntMap.sortKey, catalog.nivel);

	if (countEl) {
		const ideais = mapas.filter(m => encaixeDeNivel(catalog.nivel, m).cls === 'ideal').length;
		const total = mapas.length === 1 ? '1 mapa' : `${mapas.length} mapas`;
		countEl.innerHTML =
			escapeHtml(total) +
			(ideais && !HuntMap.filterIdealOnly
				? ` · <span class="hm-count-ideal">${ideais} ${ideais === 1 ? 'ideal' : 'ideais'} para você</span>`
				: '');
	}

	if (!mapas.length) {
		listEl.innerHTML = `<div class="hm-list-empty">${
			HuntMap.filterIdealOnly && !term
				? 'Nenhum mapa ideal para o seu nível nesta região. Veja em "Todos".'
				: 'Nenhum mapa encontrado.'
		}</div>`;
		return;
	}

	listEl.innerHTML = mapas.map(mapa => renderCard(mapa, motivos.get(mapa.mapa))).join('');
	listEl.querySelectorAll('.hm-card').forEach(card => card.addEventListener('click', onClickCard));
	// O botão de viajar da linha: same travel handler as the dossier's
	// footer button (onClickTravel) — just a second trigger, no new logic.
	listEl.querySelectorAll('.hm-card-go').forEach(btn => btn.addEventListener('click', onClickTravel));
}

/**
 * O medidor de encaixe (linha e dossiê): trilho + faixa + marcador do nível.
 */
function renderMeter(mapa, nivel) {
	const { marcador } = medidorDeEncaixe(nivel, mapa);
	return `<span class="hm-meter-track"><span class="hm-meter-fill"></span><span class="hm-meter-you" style="left:${marcador}%" title="Seu nível: ${nivel}"></span></span>`;
}

function renderBadge(encaixe) {
	const cadeado = encaixe.cls === 'locked' ? RiIcones.cadeado : '';
	return `<span class="hm-badge">${cadeado}${escapeHtml(encaixe.curto)}</span>`;
}

function renderThumb(mapa) {
	return `<span class="hm-thumb-vazio">${RiIcones.mapaVazio}</span><img src="/ragidle/minimapas/${escapeHtml(mapa.mapa)}.webp" alt="" onerror="this.style.display='none'" />`;
}

/**
 * NOTE on the wrapper tag: the row contains an inner ".hm-card-go" <button>,
 * and HTML forbids nesting interactive controls inside a <button> (the
 * parser would silently close the outer button early and break the layout).
 * The wrapper is a <div role="button" tabindex="0">.
 */
function renderCard(mapa, motivo) {
	const catalog = HuntMap.catalog;
	const encaixe = encaixeDeNivel(catalog.nivel, mapa);
	const isCurrent = mapa.mapa === catalog.mapaAtual;
	const isSelected = mapa.mapa === HuntMap.selectedMapa;
	const monstros = allMonstersOf(mapa);
	const avatarsHtml = monstros
		.slice(0, MOB_STACK_MAX)
		.map(
			m =>
				`<img class="hm-mob-avatar" src="/ragidle/mobs/${m.mobId}.png" alt="" onerror="this.style.display='none'" />`
		)
		.join('');

	// Só pelo nome do mapa não precisa de explicação; por monstro/drop, sim.
	const motivoTexto = motivo && !motivo.peloNome ? resumoDoMotivo(motivo) : '';

	// Same trigger everywhere: only available (not current, not locked) maps
	// get the button, mirroring the dossier footer's own rule.
	let caudaHtml = '';
	if (isCurrent) {
		caudaHtml = '<span class="hm-card-here">Aqui</span>';
	} else if (encaixe.cls !== 'locked') {
		caudaHtml = `<button type="button" class="hm-card-go" data-mapa="${escapeHtml(mapa.mapa)}" title="Viajar para ${escapeHtml(mapa.rotulo)}" aria-label="Viajar para ${escapeHtml(mapa.rotulo)}">${RiIcones.irPara}</button>`;
	}

	return `
		<div class="hm-card fit-${encaixe.cls}${isCurrent ? ' is-current' : ''}${isSelected ? ' is-selected' : ''}" data-mapa="${escapeHtml(mapa.mapa)}" role="button" tabindex="0" aria-pressed="${isSelected ? 'true' : 'false'}">
			<div class="hm-card-thumb">${renderThumb(mapa)}</div>
			<div class="hm-card-body">
				<div class="hm-card-top">
					<span class="hm-card-name">${escapeHtml(mapa.rotulo)}</span>
					${renderBadge(encaixe)}
				</div>
				<div class="hm-meter">
					${renderMeter(mapa, catalog.nivel)}
					<span class="hm-meter-text">Nv. ${mapa.nivelMinimo}–${mapa.nivelMaximo}</span>
				</div>
				<div class="hm-card-foot">
					<span class="hm-mob-stack">${avatarsHtml}</span>
					<span class="hm-card-mob-count">${monstros.length} monstro${monstros.length === 1 ? '' : 's'}</span>
					${motivoTexto ? `<span class="hm-card-hit" title="${escapeHtml(motivoTexto)}">${escapeHtml(motivoTexto)}</span>` : ''}
				</div>
			</div>
			${caudaHtml}
		</div>`;
}

function onClickCard(e) {
	e.stopImmediatePropagation();
	HuntMap.selectedMapa = e.currentTarget.dataset.mapa;
	HuntMap.selectedMobId = null;
	renderList();
	renderPanel();
}

/**
 * O DOSSIÊ do mapa selecionado: banner, encaixe, monstros (clique num para
 * ver o drop dele), as duas visões de drop, e o rodapé fixo com a viagem.
 */
function renderPanel() {
	const root = _root();
	const scrollEl = root.querySelector('.hm-panel-scroll');
	const footerEl = root.querySelector('.hm-panel-footer');
	const catalog = HuntMap.catalog;

	if (!catalog) {
		scrollEl.innerHTML = '<div class="hm-panel-empty">Abra o mapa de caça para carregar o catálogo.</div>';
		footerEl.innerHTML = '';
		return;
	}

	const mapa = catalog.mapas.find(m => m.mapa === HuntMap.selectedMapa);
	if (!mapa) {
		scrollEl.innerHTML = '<div class="hm-panel-empty">Selecione um mapa para ver os monstros.</div>';
		footerEl.innerHTML = renderFooter(null);
		bindFooter(footerEl);
		return;
	}

	const encaixe = encaixeDeNivel(catalog.nivel, mapa);
	const monstros = allMonstersOf(mapa);

	if (!HuntMap.selectedMobId || !monstros.some(m => String(m.mobId) === String(HuntMap.selectedMobId))) {
		HuntMap.selectedMobId = monstros.length ? monstros[0].mobId : null;
	}

	/*
	 * O DETALHE PRECISA DA FICHA, e a lista de monstros nao (D-788).
	 *
	 * Raca, elemento e a CHANCE de cada drop sairam do catalogo — eram 84% do
	 * payload e estouravam o teto do pacote. Eles vem por mapa, quando o
	 * jogador seleciona um.
	 *
	 * Enquanto ela nao chega, o painel mostra os monstros (que so precisam de
	 * id e nome, e vem do indice) e um aviso no lugar do detalhe. Nao ha estado
	 * "vazio" mentindo: a janela nunca afirma "sem drops" por causa da espera.
	 */
	const ficha = HuntMap.fichas[mapa.mapa];
	if (!ficha) {
		pedirFicha(mapa.mapa);
	}

	const mobsHtml = monstros.length
		? monstros.map(m => renderMobRow(m, mapa, ficha)).join('')
		: '<div class="hm-panel-empty">Nenhum monstro conhecido.</div>';

	/*
	 * AS DUAS VISOES (RAGIDLE, I6 — 31/08/2026). O dono: "mostrar todo o drop do
	 * mapa, em vez de separado por mobs (ter as 2 opcoes)". O "ter as 2" e
	 * explicito, entao a de sempre continua e esta entra ao lado.
	 */
	const porMapa = HuntMap.visaoDeDrop === 'mapa';
	const selectedMonster = monstros.find(m => String(m.mobId) === String(HuntMap.selectedMobId));
	const tituloDrops = porMapa
		? 'Drops do mapa'
		: selectedMonster
			? `Drops de ${escapeHtml(selectedMonster.nome)}`
			: 'Drops';
	const alternadorHtml = `
		<div class="hm-seg hm-visao" role="tablist" aria-label="Visão dos drops">
			<button type="button" class="hm-seg-btn${porMapa ? '' : ' is-selected'}" data-visao="mob" role="tab" aria-selected="${porMapa ? 'false' : 'true'}">Do monstro</button>
			<button type="button" class="hm-seg-btn${porMapa ? ' is-selected' : ''}" data-visao="mapa" role="tab" aria-selected="${porMapa ? 'true' : 'false'}">Do mapa</button>
		</div>`;

	let dropsHtml;
	if (!ficha) {
		dropsHtml = '<div class="hm-drops-empty">Carregando os monstros deste mapa...</div>';
	} else if (porMapa) {
		dropsHtml = renderDropsDoMapa(ficha);
	} else {
		dropsHtml = selectedMonster ? renderMobDrops(selectedMonster, ficha) : '';
	}

	const { dentro } = medidorDeEncaixe(catalog.nivel, mapa);
	const veredito = encaixe.cls === 'ideal' ? 'Ideal para você' : dentro ? 'Na faixa' : encaixe.rotulo;

	scrollEl.innerHTML = `
		<div class="hm-hero fit-${encaixe.cls}">
			${renderThumb(mapa)}
			<div class="hm-hero-cap">
				<div class="hm-hero-text">
					<div class="hm-hero-region">${escapeHtml(mapa.regiao)}</div>
					<h3 class="hm-hero-title">${escapeHtml(mapa.rotulo)}</h3>
				</div>
				${renderBadge(encaixe)}
			</div>
		</div>
		<div class="hm-fit fit-${encaixe.cls}">
			<div class="hm-fit-you">
				<span class="hm-fit-you-label">Você</span>
				<span class="hm-fit-you-nivel">${catalog.nivel}</span>
			</div>
			<div class="hm-fit-body">
				<div class="hm-meter">${renderMeter(mapa, catalog.nivel)}</div>
				<div class="hm-fit-row">
					<span class="hm-fit-verdict">${escapeHtml(veredito)}</span>
					<span class="hm-fit-range">Mapa Nv. ${mapa.nivelMinimo}–${mapa.nivelMaximo}</span>
				</div>
			</div>
		</div>
		<div class="hm-section">
			<span class="hm-section-title">Monstros</span>
			<span class="hm-section-n">${monstros.length}${mapa.mvp ? ' · 1 MVP' : ''}</span>
		</div>
		<div class="hm-mobs">${mobsHtml}</div>
		<div class="hm-drops-head">
			<span class="hm-section-title">${tituloDrops}</span>
			${alternadorHtml}
		</div>
		${dropsHtml}`;

	footerEl.innerHTML = renderFooter(mapa, encaixe);

	scrollEl.querySelectorAll('[data-mob-id]').forEach(chip => chip.addEventListener('click', onClickChip));
	scrollEl.querySelectorAll('[data-visao]').forEach(b => b.addEventListener('click', onClickVisao));
	scrollEl.querySelectorAll('.hm-drop[data-item-id]').forEach(b => b.addEventListener('click', onClickDrop));
	scrollEl.querySelectorAll('.hm-drop-tile img[data-item-id]').forEach(img => setItemIcon(img, img.dataset.itemId));
	bindFooter(footerEl);
}

/**
 * O rodapé fixo: "Viajar para X" (ou o motivo de não poder) e "Retornar ao
 * ponto salvo". Recebe `null` quando não há mapa selecionado.
 */
function renderFooter(mapa, encaixe) {
	const catalog = HuntMap.catalog;
	let html = '';
	if (mapa) {
		const isCurrent = mapa.mapa === catalog.mapaAtual;
		if (isCurrent) {
			html += '<div class="hm-here-note">Você já está neste mapa.</div>';
		} else if (encaixe.cls === 'locked') {
			html += `<button type="button" class="hm-btn-go ri-btn" data-mapa="${escapeHtml(mapa.mapa)}" disabled>${RiIcones.cadeado} Abre no Nv. ${mapa.nivelQueAbre}</button>`;
		} else {
			html += `<button type="button" class="hm-btn-go ri-btn" data-mapa="${escapeHtml(mapa.mapa)}">Viajar para ${escapeHtml(mapa.rotulo)}</button>`;
		}
	}
	const atCity = catalog.mapaAtual === catalog.cidade.mapa;
	html += `<button type="button" class="hm-btn-city ri-btn ri-btn--sec" data-mapa="${escapeHtml(catalog.cidade.mapa)}"${atCity ? ' disabled' : ''}>Retornar ao ponto salvo</button>`;
	return html;
}

function bindFooter(footerEl) {
	const goBtn = footerEl.querySelector('.hm-btn-go');
	if (goBtn) {
		goBtn.addEventListener('click', onClickTravel);
	}
	const cityBtn = footerEl.querySelector('.hm-btn-city');
	if (cityBtn) {
		cityBtn.addEventListener('click', onClickTravel);
	}
}

/**
 * Uma linha de monstro no dossiê: avatar, nome (+MVP), e — quando a ficha já
 * chegou — nível, raça e elemento. Sem a ficha, só a contagem de drops do
 * índice, que já vem com o catálogo.
 */
function renderMobRow(m, mapa, ficha) {
	const isMvp = !!(mapa.mvp && m.mobId === mapa.mvp.mobId);
	const isSelected = String(m.mobId) === String(HuntMap.selectedMobId);
	const nDrops = (m.drops || []).length;
	let meta;
	if (ficha && m.raca) {
		const raca = RACE_PT[m.raca] || m.raca;
		const elemento = ELEMENT_PT[m.elemento] || m.elemento;
		meta = `<b>Nv. ${m.nivel}</b> · ${escapeHtml(raca)} · ${escapeHtml(elemento)} ${m.nivelDoElemento}`;
	} else {
		meta = `${nDrops} drop${nDrops === 1 ? '' : 's'}`;
	}
	return `
		<button type="button" class="hm-chip${isSelected ? ' is-selected' : ''}${isMvp ? ' is-mvp' : ''}" data-mob-id="${m.mobId}" aria-pressed="${isSelected ? 'true' : 'false'}">
			<span class="hm-chip-avatar"><img src="/ragidle/mobs/${m.mobId}.png" alt="" onerror="this.style.display='none'" /></span>
			<span class="hm-chip-text">
				<span class="hm-chip-name">${escapeHtml(m.nome)}${isMvp ? '<span class="hm-chip-mvp">MVP</span>' : ''}</span>
				<span class="hm-chip-meta">${meta}</span>
			</span>
			<span class="hm-chip-drops">${nDrops} ${nDrops === 1 ? 'drop' : 'drops'}</span>
		</button>`;
}

/**
 * Um LADRILHO de drop: o ícone real do item (24x24 do cliente), o nome, a
 * chance — e, na visão do mapa, de quantos monstros cai. É um botão: o
 * clique abre a ficha do item (onClickDrop).
 */
function renderDropTile(itemId, nome, chanceTexto, extraHtml, title) {
	const aberto = ItemInfo.uid === itemId;
	return `
		<button type="button" class="hm-drop${aberto ? ' is-open' : ''}" data-item-id="${itemId}" title="${escapeHtml(title || nome)}">
			<span class="hm-drop-tile ri-tile"><img data-item-id="${itemId}" alt="" /></span>
			<span class="hm-drop-name">${escapeHtml(nome)}</span>
			<span class="hm-drop-chance">${chanceTexto}</span>
			${extraHtml || ''}
		</button>`;
}

/**
 * Os drops do monstro selecionado, da maior chance para a menor (empate pelo
 * nome, para a grade não dançar).
 */
function renderMobDrops(monster) {
	const nomeDe = d => d.nomeLocal || d.nome;
	const drops = (monster.drops || [])
		.slice()
		.sort((a, b) => b.chance - a.chance || nomeDe(a).localeCompare(nomeDe(b), 'pt-BR'));
	if (!drops.length) {
		return '<div class="hm-drops-empty">Sem drops conhecidos.</div>';
	}
	return `<div class="hm-drops">${drops
		.map(d =>
			renderDropTile(
				d.itemId,
				nomeDe(d),
				formatarChance(d.chance),
				'',
				`${nomeDe(d)} — ${formatarChance(d.chance)}`
			)
		)
		.join('')}</div>`;
}

/**
 * TODO O DROP DO MAPA, numa grade so (RAGIDLE, I6 — 31/08/2026).
 *
 * A REGRA (deduplicar por `itemId`, escolher a MAIOR chance, ordenar de forma
 * estavel) mora em `dropsDoMapa.js`, num modulo sem imports — e tem teste que a
 * EXECUTA (`servidor/mapa/drops-do-mapa.test.ts`, 11 casos). Aqui so se desenha.
 *
 * A chance mostrada e a MELHOR, e nao "a chance": medido no catalogo, 25 dos
 * 33 mapas tem item que cai de mais de um monstro, e a chance de um item "no
 * mapa" nao existe no rAthena — ela e por monstro. Somar daria numero
 * inventado. Quando ha mais de uma origem, o ladrilho diz de quantas, e o
 * `title` nomeia cada monstro com a chance dele.
 */
function renderDropsDoMapa(ficha) {
	const linhas = dropsDoMapa(ficha);
	if (!linhas.length) {
		return '<div class="hm-drops-empty">Sem drops conhecidos neste mapa.</div>';
	}
	const grade = linhas
		.map(l => {
			// `dropsDoMapa` devolve o nome do servidor; o ladrilho mostra o local.
			const nome = nomeLocalDoItem(l.itemId, l.nome);
			const origem = l.monstros.map(m => `${m.nome} ${formatarChance(m.chance)}`).join(' · ');
			const extra = l.deQuantosMobs > 1 ? `<span class="hm-drop-origens">${l.deQuantosMobs} mobs</span>` : '';
			return renderDropTile(l.itemId, nome, formatarChance(l.melhorChance), extra, `${nome} — ${origem}`);
		})
		.join('');
	return `
		<div class="hm-drops-legenda">${linhas.length} ${linhas.length === 1 ? 'item' : 'itens'} · a chance é a melhor entre os monstros</div>
		<div class="hm-drops">${grade}</div>`;
}

/**
 * Ícone do item: /ragidle/item/<id>.png (a arte publicada pelo pipeline) com
 * reserva no bitmap do GRF — a mesma receita da Mochila e da loja de NPC V2.
 */
function setItemIcon(img, itemId) {
	const it = DB.getItemInfo(itemId);
	const resName = it && it.identifiedResourceName;
	img.onerror = () => {
		img.onerror = null;
		if (!resName) {
			img.style.display = 'none';
			return;
		}
		Client.loadFile(
			DB.INTERFACE_PATH + 'item/' + resName + '.bmp',
			dataURI => {
				img.src = dataURI;
			},
			() => {
				img.style.display = 'none';
			}
		);
	};
	img.src = `/ragidle/item/${itemId}.png`;
}

function onClickVisao(e) {
	e.stopImmediatePropagation();
	HuntMap.visaoDeDrop = e.currentTarget.dataset.visao;
	renderPanel();
}

function onClickChip(e) {
	e.stopImmediatePropagation();
	HuntMap.selectedMobId = e.currentTarget.dataset.mobId;
	renderPanel();
}

/**
 * CLICAR NUM DROP ABRE A FICHA DO ITEM (D-901, pedido do dono: "quando eu
 * clico em cima do item, ele abre o detalhamento do item").
 *
 * É a MESMA janela ItemInfo que a Mochila (MochilaIdle.js) e a loja de NPC
 * (NpcStoreV2.js) abrem, com o mesmo alternar: clicar de novo no item aberto
 * fecha a ficha. O objeto passado é o mínimo que `ItemInfo.setItem` precisa
 * para um item que o jogador NÃO tem em mãos: id e "identificado" (a ficha
 * de um drop é a do item limpo — sem runa, sem carta, sem refino).
 *
 * A posição: quando a ficha ainda não estava aberta, ela nasce COLADA ao
 * atlas (à direita se couber, senão à esquerda), para não cobrir a grade que
 * o jogador acabou de clicar. Se já estava aberta (trocou de item), fica
 * onde o jogador a deixou.
 */
function onClickDrop(e) {
	e.stopImmediatePropagation();
	const itemId = parseInt(e.currentTarget.dataset.itemId, 10);
	if (!itemId) {
		return;
	}
	if (ItemInfo.uid === itemId) {
		ItemInfo.remove();
		ItemInfo.uid = -1;
		marcarDropAberto();
		return;
	}
	const estavaAberta = ItemInfo.uid !== -1 && ItemInfo.uid != null;
	ItemInfo.append();
	ItemInfo.uid = itemId;
	ItemInfo.setItem({ ITID: itemId, IsIdentified: true });
	if (!estavaAberta) {
		encostarFichaDoItem();
	}
	marcarDropAberto();
}

/**
 * Marca na grade o ladrilho cuja ficha está aberta (sem re-desenhar o
 * dossiê inteiro — o clique não pode fazer a grade pular).
 */
function marcarDropAberto() {
	_root()
		.querySelectorAll('.hm-drop[data-item-id]')
		.forEach(b => b.classList.toggle('is-open', String(ItemInfo.uid) === b.dataset.itemId));
}

function encostarFichaDoItem() {
	const host = ItemInfo._host;
	if (!host) {
		return;
	}
	const esquerda = parseInt(HuntMap._host.style.left, 10) || 0;
	const topo = parseInt(HuntMap._host.style.top, 10) || 0;
	let x = esquerda + WINDOW_WIDTH + 8;
	if (x + ITEM_INFO_WIDTH > Renderer.width) {
		x = esquerda - ITEM_INFO_WIDTH - 8;
	}
	if (x < 0) {
		// Sem folga de nenhum lado (tela de 1366 com o atlas centrado): por
		// cima da LISTA, encostada no dossiê — a grade de drops que o jogador
		// acabou de clicar continua inteira à vista. 318 = --hm-panel (CSS).
		x = Math.max(0, esquerda + WINDOW_WIDTH - 318 - ITEM_INFO_WIDTH - 8);
	}
	host.style.left = x + 'px';
	host.style.top = Math.max(0, topo + 40) + 'px';
}

/**
 * "Viajar para [mapa]" / "Retornar ao ponto salvo" — both send the same
 * custom packet, only the target map name changes. Shared by onClickTravel
 * (the footer/row buttons) AND HuntMap.travelToCity (RAGIDLE, the
 * "Retornar para Prontera" contextual button — see HuntButtonIdle.js).
 * CZ_RAGIDLE_VIAJAR — opcode 0x0ff2, fixed 18 bytes (opcode + 16-byte name).
 */
function sendTravel(mapName) {
	if (!mapName) {
		return;
	}

	const pkt = new PACKET.CZ.RAGIDLE_VIAJAR();
	pkt.mapName = mapName;
	Network.sendPacket(pkt);

	// Server answers with the standard mapmove packet; the client reloads
	// the map on its own, so just close our window.
	closeWindow();
}

function onClickTravel(e) {
	e.stopImmediatePropagation();
	if (e.currentTarget.disabled) {
		return;
	}
	sendTravel(e.currentTarget.dataset.mapa);
}

/**
 * RAGIDLE: usado pelo botao de caca contextual (UI/Components/HuntButtonIdle
 * /HuntButtonIdle.js) para viajar direto de volta pra cidade SEM abrir esta
 * janela. Manda o MESMO pacote CZ_RAGIDLE_VIAJAR que o botao "Retornar ao
 * ponto salvo" do painel ja manda (sendTravel acima) — nenhum pacote novo,
 * so um segundo gatilho pro mesmo handler.
 *
 * Se o catalogo ja foi carregado nesta sessao (a janela foi aberta ao menos
 * uma vez), catalog.cidade.mapa ja e conhecido e a viagem sai na hora. Caso
 * contrario (jogador nunca abriu o Mapa de Caça), pede o catalogo — o MESMO
 * CZ_RAGIDLE_PEDIR_CATALOGO de sempre (requestCatalog) — e viaja assim que a
 * resposta chegar (ver o _pendingAutoTravel dentro de onCatalogReceived),
 * sem em nenhum momento abrir a janela.
 */
HuntMap.travelToCity = function travelToCity() {
	if (HuntMap.catalog && HuntMap.catalog.cidade) {
		sendTravel(HuntMap.catalog.cidade.mapa);
		return;
	}
	_pendingAutoTravel = true;
	requestCatalog();
};

Network.hookPacket(PACKET.ZC.RAGIDLE_CATALOGO, onCatalogReceived);
Network.hookPacket(PACKET.ZC.RAGIDLE_MONSTROS, onMonstrosReceived);

/**
 * Create component and export it
 */
export default UIManager.addComponent(HuntMap);
