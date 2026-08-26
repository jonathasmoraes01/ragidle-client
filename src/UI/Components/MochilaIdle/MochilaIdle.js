/**
 * UI/Components/MochilaIdle/MochilaIdle.js
 *
 * "Mochila" -- janela UNICA de inventario + equipamento (gauntlet 19/08/2026,
 * redesign/extracao-inventario-origin.md). Substitui visualmente as duas
 * janelas nativas separadas de hoje (Inventory/Equipment) por UMA janela com
 * dois paineis: esquerda "Personagem" (retrato + 10 slots de equipamento em
 * duas colunas), direita "Mochila" (grade de itens em 3 abas + rodape de
 * peso). Mesmo padrao "esconde o host nativo e fala com ele por fora, zero
 * edicao de logica" que BasicInfoIdle.js ja usa pra BasicInfo -- ver a nota
 * la (hideNativeBasicInfo/syncFromNativeState) pro mesmo raciocinio aplicado
 * aqui a DUAS janelas nativas em vez de uma.
 *
 * ── De onde vem cada dado (contrato tecnico, secao 5b do briefing) ───────
 *   - itens da mochila: Inventory.getUI().list (array publico,
 *     InventoryCommon.js:108) -- objetos {index, ITID, count, type,
 *     IsIdentified, IsDamaged, location, ...} ja prontos, sem pacote novo.
 *   - aba de cada item: getItemTab() abaixo e a MESMA regra de
 *     InventoryCommon.js:580-601 (nao exportada de la, por isso duplicada
 *     aqui -- mesmo criterio que CombatCornerIdle.js/IdleSkills.js ja usaram
 *     pra outras funcoes privadas de arquivos irmaos).
 *   - equipar: Inventory.getUI().onEquipItem esta ligado (por
 *     Engine/MapEngine.js:503) ao MESMO handler que Equipment usa -- entao
 *     chamar Inventory.getUI().useItem(item) (a funcao publica que decide
 *     "usar" vs "equipar" pelo item.type, InventoryCommon.js:910-951) e o
 *     caminho real de duplo-clique, identico ao que o dblclick nativo chama.
 *   - tirar: Equipment.getUI().onUnEquip(index) -- injetado em
 *     Engine/MapEngine.js:498, manda CZ_REQ_TAKEOFF_EQUIP de verdade.
 *   - o que esta vestido: NAO da pra ler via Equipment.getUI().checkEquipLoc()
 *     sozinho -- ele so devolve um numero de sprite (wItemSpriteNumber) pra
 *     alimentar o boneco 3D, nao o item inteiro (nome/icone/refino). O
 *     contrato oferece a alternativa: ler o DOM do host nativo ESCONDIDO
 *     (Equipment.equip()/unEquip() continuam escrevendo nesse DOM
 *     normalmente -- esconder o host so tira ele da TELA, o shadow root
 *     continua vivo e atualizado a cada equipar/tirar real). E o que
 *     lerEquipSlot() faz abaixo: acha a <td class="weapon"> etc (mesmas
 *     classes que EquipmentCommon.js:60-84 usa, duplicadas aqui pela mesma
 *     razao de getItemTab), le o icone (background-image do <button>) e o
 *     nome (que ja vem com "+N " de refino, DB.getItemName default) do
 *     ".item"/".itemName" que a propria Equipment ja montou.
 *   - icone da mochila: tenta PRIMEIRO /ragidle/item/<ITID>.png (outro
 *     builder publica esses PNGs em paralelo -- se a pasta nao existir ainda
 *     quando este arquivo carrega, o <img onerror> cai pro caminho antigo,
 *     Client.loadFile(DB.INTERFACE_PATH + 'item/' + resName + '.bmp'), o
 *     MESMO que InventoryCommon.js:761-772 ja usa).
 *   - peso: Session.Entity.weight / Session.Entity.max_weight (Engine/
 *     MapEngine/Main.js:406-417 grava os dois ali, em decimos -- por isso a
 *     divisao por 10 abaixo, mesma conta de BasicInfoIdle.js).
 *   - descricao: ItemInfo.append(); ItemInfo.uid = item.ITID;
 *     ItemInfo.setItem(item) -- a janela de descricao nativa, ja existente,
 *     so aberta por fora (nao e um "menu novo", e a descricao que o proprio
 *     contrato pede pra reusar).
 *
 * ── RODADA 4 (19/08/2026) -- interacao (pedido literal do dono) ──────────
 *   - Arrastar da grade ate um slot equipa (onGradeDragStart/
 *     onPainelEsqDrop abaixo); arrastar de volta (slot -> grade) tira
 *     (onSlotDragStart/onGradeDrop). Contrato global reusado, sem inventar
 *     outro: dragstart escreve window._OBJ_DRAG_ = {type:'item',
 *     from:'Inventory', data:item} e o mesmo JSON em dataTransfer 'Text' --
 *     mesmo molde de InventoryCommon.js:1214-1241 / EquipmentCommon.js:
 *     819-884 (so lidos, nao editados). Isso da interoperar de graca com
 *     Armazem/Carrinho/Correio/Atalhos, que ja leem esse contrato.
 *   - Botao direito abre o ContextMenu generico (ContextMenu.js -- so
 *     lido, nao editado): grade equipavel = Equipar+Detalhes, consumivel =
 *     Usar+Detalhes, sem acao = so Detalhes; slot vestido = Tirar+Detalhes.
 *   - A recusa do servidor (fase 1, peca com refino ou carta nao pode
 *     trocar/tirar -- servidor-mapa.ts ~5789-5860) NAO tem caminho limpo de
 *     observacao pelo cliente: Network.hookPacket() (NetworkManager.js:200-
 *     210) so guarda UM callback por pacote (Packets.list[id].callback = fn,
 *     sobrescreve, nao empilha) -- hookar de novo os ACKs de vestir/tirar
 *     substituiria o handler nativo de Engine/MapEngine/Item.js, que e
 *     exatamente o que a missao pede pra NAO fazer. Duas defesas em vez
 *     disso, nenhuma delas hook: (1) PREDICAO -- o selo "+N" de refino que
 *     esta janela ja desenha em cada slot (syncEquipSlots) espelha a mesma
 *     condicao que o servidor testa (refino>0), entao dá pra avisar ANTES
 *     mesmo da resposta chegar, sem inventar dado novo; (2) FALLBACK por
 *     AUSENCIA DE MUDANCA (a saida que a missao autoriza quando nao ha
 *     observacao limpa) -- depois de um pedido, confere se o indice ainda
 *     esta no mesmo lugar passado um tempo; se sim, avisa de forma honesta
 *     (nao afirma "e refino" quando pode ser carta ou requisito de
 *     classe/nivel). Ver tentarEquipar/tentarTirar/verificarRecusa abaixo.
 *   - RODADA 3 (19/08/2026): a boneca central deixou de ser o retrato de
 *     classe estatico e virou o render AO VIVO do personagem (renderBoneco()
 *     abaixo) -- pedido literal do dono: "deve ficar o personagem real da
 *     pessoa, com os efeitos, com as skins, com o que ela estiver equipada".
 *     Receita copiada dos dois lugares que o motor ja usa pra isso (canvas +
 *     SpriteRenderer, MESMOS numeros de bind2DContext), sem editar nenhum
 *     dos dois:
 *       - EquipmentCommon.js:765-808 (renderEntity())
 *       - PlayerViewEquipCommon.js:502-557 (renderCharacter())
 *     NAO reaproveita o canvas da Equipment nativa: ele nunca e pintado
 *     enquanto ela fica escondida (Renderer.render(renderCharacter) so liga
 *     quando ela fica visivel), e ligar aquele canvas teria efeito colateral
 *     (embute WinStats, mexe em z-index). O laço proprio le Session.Entity a
 *     cada quadro (job/sex/head/paletas/accessory-1-2-3/robe) e liga/desliga
 *     com Renderer.render()/stop() no toggle() da janela, pra nao rodar com
 *     ela fechada. PEDIDO EXTRA do dono (arma tambem, a boneca nativa do RO
 *     so mostra chapeu/capa) foi TENTADO e NAO entrou -- investigado a
 *     fundo (ver o comentario grande em cima de renderBoneco() abaixo): o
 *     motor nao desenha a camada de arma nem na entidade REAL do jogador no
 *     mundo hoje, entao nao e defeito desta janela.
 *   - Raridade/tarja de cor na celula da grade: sem dado real (contrato
 *     confirma), entao nenhuma cor foi inventada.
 *   - "Organizar"/"+"/"Atalho"/Favoritos/Pet/Estatua/Verus/Premium: nao
 *     existem no jogo (servidor manda favorito sempre 0; nao ha cap de
 *     slots) -- nao viraram botao morto, ver secao 5 do briefing.
 *
 * ── FANTASIA (26/08/2026) -- os slots de costume ─────────────────────────
 * Pedido do dono: "ja coloque a opcao de costume no nosso inventario
 * tambem, tanto para equipar como na mochila". O que entrou:
 *   - fileira ".mo-fantasia" com os 4 slots de costume (lista, mascara e a
 *     armadilha do robe em slotsDeFantasia.js), SEMPRE a vista embaixo da
 *     boneca -- a decisao "fileira, nao aba" esta em MochilaIdle.css;
 *   - os ladrilhos sao os MESMOS ".mo-slot" das colunas, dentro do mesmo
 *     ".mo-painel-esq": equipar por arrasto, "x", menu de contexto e tirar
 *     por arrasto valem pra fantasia pelos handlers delegados ja existentes
 *     (o bitmask de data-location faz o resto);
 *   - na grade, item de costume ganha selo de brilho + " — Fantasia" na
 *     dica (eDeFantasia sobre a mascara de vestir do proprio item);
 *   - equipar/tirar NAO precisou de caminho novo: useItem() nativo ja chama
 *     onEquipItem(index, item.location) pra ARMOR, o servidor veste pela
 *     mascara do item, e o ACK (Engine/MapEngine/Item.js:238-291) ja
 *     escreve a celula de costume do host escondido E a aparencia da
 *     entidade (costume por cima do normal) -- a boneca herda de graca.
 *
 * @author RagIdle
 */

import Renderer from 'Renderer/Renderer.js';
import Camera from 'Renderer/Camera.js';
import SpriteRenderer from 'Renderer/SpriteRenderer.js';
import Entity from 'Renderer/Entity/Entity.js';
import Preferences from 'Core/Preferences.js';
import Session from 'Engine/SessionStorage.js';
import DB from 'DB/DBManager.js';
import Client from 'Core/Client.js';
import ItemType from 'DB/Items/ItemType.js';
import EquipLocation from 'DB/Items/EquipmentLocation.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import Inventory from 'UI/Components/Inventory/Inventory.js';
import { posicaoDaDica } from './posicaoDaDica.js';
import { FANTASIA_SLOTS, eDeFantasia } from './slotsDeFantasia.js';
import Equipment from 'UI/Components/Equipment/Equipment.js';
import ItemInfo from 'UI/Components/ItemInfo/ItemInfo.js';
import ContextMenu from 'UI/Components/ContextMenu/ContextMenu.js';
import RiIcones from 'UI/ri-icones.js';
import htmlText from './MochilaIdle.html?raw';
import cssText from './MochilaIdle.css?raw';

/**
 * Mantido em sincronia com ":host"/".mo-window"/".mo-frame" em
 * MochilaIdle.css (mesma cicatriz D-341 documentada la e em StatusIdle.css).
 * RODADA 2 (19/08/2026): altura reduzida de 434 -> 344 -- a grade agora
 * renderiza um numero FIXO de celulas (GRADE_CAPACIDADE abaixo) em vez de so
 * as ocupadas, entao o "ar" que sobrava embaixo da lista curta virou grade de
 * verdade; a janela nao precisa mais da altura extra pra disfarcar isso.
 * FANTASIA (26/08/2026): 344 -> 396 -- a fileira de slots de costume entrou
 * embaixo da boneca; a conta inteira da altura nova esta no cabecalho de
 * MochilaIdle.css.
 */
const WINDOW_WIDTH = 578;
const WINDOW_HEIGHT = 396;

/**
 * Reticulo SEMPRE visivel da grade (secao 1 do briefing: "a grade e um
 * reticulo sempre visivel de 5 colunas... o total pode vir do que faz
 * sentido pra area visivel, com rolagem quando passar disso"). 5x6 = 30
 * celulas fecham EXATO em ".mo-grade-host" sem cortar a ultima fileira
 * (306px de miolo = 6x46 + 5x6, ver a conta da altura em MochilaIdle.css --
 * eram 5 linhas ate a janela crescer pra fileira de fantasia); alem disso,
 * ".ri-scroll" rola.
 */
const GRADE_COLS = 5;
const GRADE_LINHAS_VISIVEIS = 6;
const GRADE_CAPACIDADE = GRADE_COLS * GRADE_LINHAS_VISIVEIS;

/**
 * Mesma cadencia de polling que BasicInfoIdle.js/DockIdle.js.
 */
const POLL_INTERVAL_MS = 250;

/**
 * Os 10 slots de equipamento REAIS deste jogo (DB/Items/EquipmentLocation.js)
 * -- AMMO e SHADOW_* ficam de fora (municao nao tem janela aqui e shadow gear
 * nao existe neste jogo). Os COSTUME_* SAIRAM desta lista de exclusao em
 * 26/08/2026 (pedido do dono): eles moram em FANTASIA_SLOTS
 * (slotsDeFantasia.js) e desenham na fileira ".mo-fantasia-slots", abaixo da
 * boneca. Coluna esquerda/direita e a MESMA divisao que a Equipment nativa ja
 * usa (col1/col3, ver EquipmentV4.html) -- nao inventada, so espelhada.
 */
const EQUIP_SLOTS = [
	{ location: EquipLocation.HEAD_TOP, cls: 'head_top', label: 'Chapéu', glifo: 'slotChapeu', col: 'esq' },
	{ location: EquipLocation.HEAD_BOTTOM, cls: 'head_bottom', label: 'Boca', glifo: 'slotBoca', col: 'esq' },
	{ location: EquipLocation.WEAPON, cls: 'weapon', label: 'Arma', glifo: 'slotArma', col: 'esq' },
	{ location: EquipLocation.GARMENT, cls: 'garment', label: 'Capa', glifo: 'slotCapa', col: 'esq' },
	{ location: EquipLocation.ACCESSORY1, cls: 'accessory1', label: 'Acessório', glifo: 'slotAcessorio', col: 'esq' },
	{ location: EquipLocation.HEAD_MID, cls: 'head_mid', label: 'Óculos', glifo: 'slotOculos', col: 'dir' },
	{ location: EquipLocation.ARMOR, cls: 'armor', label: 'Armadura', glifo: 'slotArmadura', col: 'dir' },
	{ location: EquipLocation.SHIELD, cls: 'shield', label: 'Escudo', glifo: 'slotEscudo', col: 'dir' },
	{ location: EquipLocation.SHOES, cls: 'shoes', label: 'Sapato', glifo: 'slotSapato', col: 'dir' },
	{ location: EquipLocation.ACCESSORY2, cls: 'accessory2', label: 'Acessório', glifo: 'slotAcessorio', col: 'dir' }
];

/**
 * Create Component
 */
const MochilaIdle = new GUIComponent('MochilaIdle', cssText);

MochilaIdle.render = () => htmlText;

/**
 * Mesmo modo dos outros flutuantes/janelas RAGIDLE -- ver StatusIdle.js.
 */
MochilaIdle.mouseMode = GUIComponent.MouseMode.CROSS;

/**
 * @var {Preferences} posicao da janela -- centralizada por padrao, igual
 * StatusIdle.js.
 */
const _preferences = Preferences.get(
	'MochilaIdle',
	{
		x: null,
		y: null
	},
	1.0
);

/**
 * @var {number|null} handle do polling.
 */
let _pollTimer = null;

/**
 * @var {number} aba ativa (Inventory.getUI().TAB.*) -- estado PROPRIO desta
 * janela, nunca escrito na janela nativa (ela fica intocada, so escondida).
 * Comeca em USABLE, o mesmo padrao default da Inventory nativa
 * (InventoryCommon.js prefDefaults.tab).
 */
let _abaAtiva = null;

/**
 * @var {string|null} assinatura da ultima grade desenhada -- evita
 * reconstruir <img> a cada tick de 250ms (reconstruir sempre reiniciaria o
 * onerror/Client.loadFile de cada icone, um flicker real).
 */
let _lastGradeSig = null;

/**
 * @var {string|null} assinatura dos ultimos slots desenhados -- mesmo motivo.
 */
let _lastSlotsSig = null;

/**
 * @var {CanvasRenderingContext2D|null} contexto 2D da boneca ao vivo
 * (".mo-avatar-canvas") -- capturado uma vez em init(), igual ao array _ctx
 * de EquipmentCommon.js.
 */
let _bonecoCtx = null;

/**
 * @var {number|null} indice do item sendo arrastado de um slot DE VOLTA pra
 * grade (tirar por arrastar) -- estado local, nao usa o _OBJ_DRAG_ global
 * porque essa direcao (slot -> nossa propria grade) nao precisa interoperar
 * com Armazem/Carrinho/Correio, so com esta janela.
 */
let _dragUnequipIndex = null;

/**
 * @var {number|null} handle do timeout que esconde o aviso de recusa.
 */
let _avisoTimer = null;

/**
 * Tempo de espera antes de checar se um pedido de equipar/tirar foi
 * recusado pelo servidor, pela FALTA de mudanca (ver cabecalho do arquivo,
 * secao RODADA 4). Maior que POLL_INTERVAL_MS * 2 pra garantir que o
 * proximo tick de sync ja rodou se o pedido tiver sido aceito.
 */
const RECUSA_DELAY_MS = 900;

function _root() {
	return MochilaIdle._shadow || MochilaIdle._host;
}

/**
 * One-time setup.
 */
MochilaIdle.init = function init() {
	const root = _root();

	this.draggable(root.querySelector('.mo-topo'));

	root.querySelector('.mo-close').addEventListener('click', onClickClose);

	// Boneca ao vivo -- contexto capturado uma vez, o laço em si so liga/
	// desliga no toggle() (ver renderBoneco()/onClickClose/toggle abaixo).
	const bonecoCanvas = root.querySelector('.mo-avatar-canvas');
	if (bonecoCanvas) {
		_bonecoCtx = bonecoCanvas.getContext('2d');
	}

	// Delegacao: os slots/celulas sao reconstruidos por sync*() abaixo, entao
	// os listeners moram no CONTAINER (que nunca e recriado), nao nos
	// elementos filhos (que sao).
	const painelEsq = root.querySelector('.mo-painel-esq');
	painelEsq.addEventListener('click', onClickPainelEsq);
	painelEsq.addEventListener('contextmenu', onContextMenuSlot);
	// Arrastar da grade ATE um slot (equipar) -- alvo e o painel esquerdo.
	painelEsq.addEventListener('dragover', onPainelEsqDragOver);
	painelEsq.addEventListener('dragleave', onPainelEsqDragLeave);
	painelEsq.addEventListener('drop', onPainelEsqDrop);
	// Arrastar um slot OCUPADO pra fora (tirar) -- fonte e o painel esquerdo.
	painelEsq.addEventListener('dragstart', onSlotDragStart);
	painelEsq.addEventListener('dragend', onSlotDragEnd);

	/*
	 * A DICA DE HOVER (pedido do dono, 25/08/2026): passar o mouse num item
	 * mostra o NOME.
	 *
	 * Delegada nos dois containers pelo mesmo motivo dos listeners acima — as
	 * celulas e os slots sao reconstruidos, os containers nao — e por um
	 * segundo, que e o motivo de a dica ser custom em vez do `title` nativo:
	 * `syncGrade` apaga a grade inteira sempre que a mochila muda, e num idle
	 * a mochila muda a cada drop. O tooltip do navegador precisa de ~1 s de
	 * mouse parado SOBRE O MESMO ELEMENTO, e o elemento sob o cursor era
	 * trocado antes disso — durante uma cacada ele praticamente nunca
	 * aparecia. (Nos slots de equipamento, que quase nunca sao reconstruidos,
	 * ele aparecia — e essa e a assimetria que o dono viu.)
	 */
	painelEsq.addEventListener('mouseover', onHoverEntra);
	painelEsq.addEventListener('mouseout', onHoverSai);

	const grade = root.querySelector('.mo-grade');
	grade.addEventListener('mouseover', onHoverEntra);
	grade.addEventListener('mouseout', onHoverSai);
	grade.addEventListener('dblclick', onDblClickItem);
	grade.addEventListener('contextmenu', onContextMenuItem);
	// Arrastar um item da grade (fonte, contrato global _OBJ_DRAG_).
	grade.addEventListener('dragstart', onGradeDragStart);
	grade.addEventListener('dragend', onGradeDragEnd);
	// Alvo de um slot arrastado de volta (tirar por arrastar).
	grade.addEventListener('dragover', onGradeDragOver);
	grade.addEventListener('drop', onGradeDrop);

	_abaAtiva = Inventory.getUI().TAB.USABLE;
	renderAbas(root);

	this._host.style.top = Math.max(0, (Renderer.height - WINDOW_HEIGHT) / 2) + 'px';
	this._host.style.left = Math.max(0, (Renderer.width - WINDOW_WIDTH) / 2) + 'px';
};

/**
 * Monta as 3 abas reais (Consumíveis/Equipar/Diversos -- FAV fica de fora,
 * o servidor manda o campo favorito sempre 0, ver cabecalho do arquivo).
 * Estatica: montada uma vez, nunca reconstruida (so ".is-active" muda).
 */
function renderAbas(root) {
	const TAB = Inventory.getUI().TAB;
	const abas = [
		{ tab: TAB.USABLE, label: 'Consumíveis' },
		{ tab: TAB.EQUIP, label: 'Equipar' },
		{ tab: TAB.ETC, label: 'Diversos' }
	];
	const container = root.querySelector('.mo-abas');
	container.innerHTML = abas
		.map(a => `<button type="button" class="mo-aba" data-tab="${a.tab}">${a.label}</button>`)
		.join('');
	container.addEventListener('click', onClickAba);
	syncAbasAtivas(root);
}

function onClickAba(e) {
	const btn = e.target.closest('.mo-aba');
	if (!btn) {
		return;
	}
	e.stopImmediatePropagation();
	_abaAtiva = parseInt(btn.dataset.tab, 10);
	_lastGradeSig = null; // forca redesenho imediato da grade na troca de aba
	syncAbasAtivas(_root());
	syncGrade();
}

function syncAbasAtivas(root) {
	root.querySelectorAll('.mo-aba').forEach(btn => {
		btn.classList.toggle('is-active', parseInt(btn.dataset.tab, 10) === _abaAtiva);
	});
}

/**
 * Restaura posicao salva, esconde os DOIS hosts nativos e comeca o polling.
 */
MochilaIdle.onAppend = function onAppend() {
	if (_preferences.x != null && _preferences.y != null) {
		this._host.style.top = Math.min(Math.max(0, _preferences.y), Renderer.height - WINDOW_HEIGHT) + 'px';
		this._host.style.left = Math.min(Math.max(0, _preferences.x), Renderer.width - WINDOW_WIDTH) + 'px';
	}

	hideNativeHosts();
	syncAll();
	startPolling();
};

MochilaIdle.onRemove = function onRemove() {
	stopPolling();
	savePosition();
	// Defensivo: se o componente for removido com a janela ainda "is-open"
	// (nao deveria acontecer no fluxo normal, so toggle() liga/desliga), a
	// boneca nao pode continuar rodando sem canvas nenhum vivo.
	Renderer.stop(renderBoneco);
};

function savePosition() {
	_preferences.x = parseInt(MochilaIdle._host.style.left, 10) || 0;
	_preferences.y = parseInt(MochilaIdle._host.style.top, 10) || 0;
	_preferences.save();
}

/**
 * Esconde Inventory/Equipment nativos de forma REVERSIVEL (display:none no
 * _host, nunca .remove()) -- MESMA tecnica de BasicInfoIdle.js pra BasicInfo.
 * Chamado no onAppend E em todo tick do polling (defensivo: qualquer clique
 * que ainda chame o toggle() nativo -- ver CombatCornerIdle.js/DockIdle.js,
 * ja redirecionados pra esta janela -- fica revertido em ate 250ms).
 */
function hideNativeHosts() {
	const invUI = Inventory.getUI();
	if (invUI && invUI._host && invUI._host.style.display !== 'none') {
		invUI._host.style.display = 'none';
	}
	const eqUI = Equipment.getUI();
	if (eqUI && eqUI._host && eqUI._host.style.display !== 'none') {
		eqUI._host.style.display = 'none';
	}
}

function startPolling() {
	stopPolling();
	_pollTimer = setInterval(pollTick, POLL_INTERVAL_MS);
}

function stopPolling() {
	if (_pollTimer != null) {
		clearInterval(_pollTimer);
		_pollTimer = null;
	}
}

function pollTick() {
	hideNativeHosts();
	if (isOpen()) {
		syncAll();
	}
}

function syncAll() {
	syncBoneco();
	syncEquipSlots();
	syncGrade();
	syncRodape();
}

function isOpen() {
	const root = _root();
	const win = root && root.querySelector('.mo-window');
	return !!(win && win.classList.contains('is-open'));
}

/**
 * Show/hide -- mesmo mecanismo de janela das outras RAGIDLE (StatusIdle.js:
 * so ".mo-window" troca de classe, o HOST fica sempre no DOM).
 */
MochilaIdle.toggle = function toggle() {
	const root = _root();
	const win = root.querySelector('.mo-window');
	if (win.classList.contains('is-open')) {
		win.classList.remove('is-open');
		savePosition();
		// Desliga o laço da boneca -- nao fica rodando com a janela fechada
		// (Renderer.stop(fn) so tira ESTE callback da lista, nao para o
		// mundo -- ver a nota em Renderer.js).
		Renderer.stop(renderBoneco);
	} else {
		win.classList.add('is-open');
		MochilaIdle.focus();
		syncAll();
		Renderer.render(renderBoneco);
	}
};

function onClickClose(e) {
	e.stopImmediatePropagation();
	MochilaIdle.toggle();
}

/**
 * Boneca ao vivo -- fecho no mesmo molde de EquipmentCommon.js:765-808 /
 * PlayerViewEquipCommon.js:502-557 (a receita ja pesquisada, ver cabecalho
 * do arquivo): uma Entity propria (nunca a de Session.Entity direto -- ela e
 * a entidade REAL do jogador, mexer nela vazaria pro mundo), atualizada a
 * cada quadro com os campos visuais de Session.Entity, desenhada de frente
 * parada (Camera.direction/direction/headDir = 0, ACTION.IDLE).
 *
 * Ligado/desligado por Renderer.render(renderBoneco)/Renderer.stop(
 * renderBoneco) no toggle() da janela (abrir liga, fechar desliga) -- nao
 * fica rodando com a janela fechada.
 *
 * PEDIDO A MAIS do dono (alem do que a boneca nativa do RO mostra): arma e
 * escudo tambem, nao so chapeu/capa/acessorio. TENTADO e INVESTIGADO -- NAO
 * entrou. entity.weapon/entity.shield sincronizam de graca (Engine/
 * MapEngine/Item.js:136-227 ja escreve os dois em Session.Entity a cada
 * vestir/tirar real) e o pipeline de carga funciona (arquivo .spr/.act
 * confirmado carregado, sem erro), mas a camada "weapon" nao desenha NENHUM
 * pixel -- nem nesta boneca, nem na entidade REAL do jogador no mundo 3D
 * (testado direto em Session.Entity.weapon fora desta janela, Novato E
 * Espadachim, pose parada de frente E de costas: os dois ficam de maos
 * vazias). Como o proprio mundo do jogo nao desenha arma na mao do
 * personagem hoje, isso e limite do motor (fora do escopo desta janela —
 * mexer no pipeline de sprite de arma seria "logica nova" e um trabalho bem
 * maior), nao um erro desta boneca. Regra do briefing: "se causar defeito,
 * deixe sem arma em vez de entregar quebrado" -- aqui nem chega a ser
 * defeito visual (nada aparece nem some errado), so nao ha o que mostrar.
 */
const renderBoneco = (function renderBonecoClosure() {
	const _character = new Entity();
	// Cor limpa (sem tingimento de status -- veneno/congelado/etc) -- MESMA
	// tecnica que os dois exemplos usam (_cleanColor), pra boneca de vestir
	// nao herdar o tingimento de combate do personagem real.
	const _cleanColor = new Float32Array([1.0, 1.0, 1.0, 1.0]);
	const _animation = {
		tick: 0,
		frame: 0,
		repeat: true,
		play: true,
		next: false,
		delay: 0,
		save: false
	};

	/* Nome proprio (nao "renderBoneco") so para nao sombrear a const externa
	   de mesmo nome — o lint do fork reprova "no-shadow". */
	return function desenharQuadroDoBoneco() {
		const entity = Session.Entity;
		if (!_bonecoCtx || !entity || !isOpen()) {
			return;
		}

		_character.set({
			GID: (entity.GID != null ? entity.GID : 'mochila') + '_BONECO',
			objecttype: _character.constructor.TYPE_PC,
			job: entity.job,
			sex: entity.sex,
			name: '',
			hideShadow: true,
			head: entity.head,
			headpalette: entity.headpalette,
			bodypalette: entity.bodypalette
		});

		// Os campos visuais da entidade REAL -- e desde 26/08/2026 eles ja
		// INCLUEM a fantasia de graca: Engine/MapEngine/Item.js:246-283
		// escreve accessory/accessory2/accessory3/robe com o viewid de
		// costume por cima do equipamento normal ("costume override regular
		// equips") a cada vestir/tirar, entao copiar os mesmos campos poe a
		// asa/chapeu de fantasia na boneca sem uma linha nova. Arma/escudo
		// NAO entram aqui -- ver o comentario grande acima desta closure
		// (investigado, motor nao desenha a camada de arma nem no mundo real
		// hoje).
		_character.accessory = entity.accessory;
		_character.accessory2 = entity.accessory2;
		_character.accessory3 = entity.accessory3;
		_character.robe = entity.robe;

		_character.effectColor.set(_cleanColor);

		Camera.direction = 0;
		_character.direction = 0;
		_character.headDir = 0;
		_character.action = _character.ACTION.IDLE;
		_character.animation = _animation;

		SpriteRenderer.bind2DContext(_bonecoCtx, 30, 130);
		_bonecoCtx.clearRect(0, 0, _bonecoCtx.canvas.width, _bonecoCtx.canvas.height);
		_character.renderEntity(_bonecoCtx);
	};
})();

/**
 * Nome do personagem (a letra-fallback so aparece atras do canvas enquanto
 * Session.Entity ainda nao tem job valido -- ver ".mo-avatar-fallback" em
 * MochilaIdle.css).
 */
function syncBoneco() {
	const root = _root();
	const entity = Session.Entity;
	if (!entity) {
		return;
	}

	const fallback = root.querySelector('.mo-avatar-fallback');
	const name = (entity.display && entity.display.name) || '';
	if (fallback) {
		fallback.textContent = name ? name.trim().charAt(0).toUpperCase() : '?';
	}
	const nomeEl = root.querySelector('.mo-boneco-nome');
	if (nomeEl) {
		nomeEl.textContent = name || '—';
	}
}

/**
 * Le o que esta vestido direto do DOM ja renderizado do host nativo Equipment
 * (escondido, mas vivo -- ver cabecalho do arquivo) e redesenha as duas
 * colunas de slots MAIS a fileira de fantasia. So reconstroi quando a
 * assinatura (indice de cada item equipado, slot a slot) muda -- ver
 * _lastSlotsSig.
 *
 * FANTASIA (26/08/2026): as celulas de costume moram na tabela #costume do
 * host nativo (EquipmentV3.html:73-100) -- ela e outra ABA la, mas as abas
 * daquela janela so trocam display, o DOM inteiro existe sempre; e
 * Equipment.equip() escreve pela location (getSelectorFromLocation), sem
 * olhar aba ativa. Entao a MESMA leitura por classe funciona -- inclusive a
 * celula do robe, que la se chama '.shadow_garment' (a armadilha inteira
 * esta em slotsDeFantasia.js).
 */
function syncEquipSlots() {
	const equipRoot = Equipment.getUI().getRoot();
	if (!equipRoot) {
		return;
	}

	const estados = [...EQUIP_SLOTS, ...FANTASIA_SLOTS].map(slot => {
		const cell = equipRoot.querySelector('.' + slot.cls);
		const itemDiv = cell ? cell.querySelector('.item') : null;
		return { slot, itemDiv };
	});

	const sig = estados.map(e => (e.itemDiv ? e.itemDiv.getAttribute('data-index') : '')).join(',');
	if (sig === _lastSlotsSig) {
		return;
	}
	_lastSlotsSig = sig;

	// Mesma razao da grade: os ladrilhos abaixo sao recriados.
	esconderDica();

	const root = _root();
	const colEsq = root.querySelector('.mo-coluna-esq');
	const colDir = root.querySelector('.mo-coluna-dir');
	const linhaFantasia = root.querySelector('.mo-fantasia-slots');
	colEsq.innerHTML = '';
	colDir.innerHTML = '';
	linhaFantasia.innerHTML = '';

	estados.forEach(({ slot, itemDiv }) => {
		const tile = document.createElement('div');
		tile.className = 'ri-tile mo-slot';
		tile.dataset.location = String(slot.location);

		if (itemDiv) {
			tile.classList.add('is-ocupado');
			// Arrastavel (tirar arrastando pra grade) -- so pecas ocupadas,
			// slot vazio nao tem o que tirar.
			tile.draggable = true;
			tile.dataset.index = itemDiv.getAttribute('data-index') || '';
			const btn = itemDiv.querySelector('button');
			const nameSpan = itemDiv.querySelector('.itemName');
			const nome = nameSpan ? nameSpan.textContent : '';
			const iconUrl = extractUrl(btn && btn.style.backgroundImage);
			const refino = nome.match(/^\+(\d+)\s/);

			tile.dataset.dica = nome || slot.label;
			tile.innerHTML =
				`<img class="mo-slot-icone" alt="" src="${iconUrl || ''}" />` +
				(refino ? `<span class="mo-slot-refino">+${refino[1]}</span>` : '') +
				`<button type="button" class="mo-slot-remover" data-index="${itemDiv.getAttribute('data-index')}" data-dica="Tirar">&times;</button>`;
		} else {
			tile.classList.add('is-empty');
			tile.dataset.dica = slot.label + ' (vazio)';
			tile.innerHTML = `<span class="mo-slot-glifo">${RiIcones[slot.glifo] || ''}</span>`;
		}

		// Slot sem "col" e da fileira de fantasia (FANTASIA_SLOTS) -- os
		// ladrilhos sao IDENTICOS e ficam dentro de ".mo-painel-esq", entao
		// todos os gestos delegados la (equipar por arrasto, "x", menu de
		// contexto, tirar por arrasto) valem pra fantasia sem uma linha nova.
		const destino = slot.col === 'esq' ? colEsq : slot.col === 'dir' ? colDir : linhaFantasia;
		destino.appendChild(tile);
	});
}

function extractUrl(backgroundImage) {
	if (!backgroundImage) {
		return '';
	}
	const match = backgroundImage.match(/^url\((['"]?)(.*?)\1\)$/);
	return match ? match[2] : '';
}

/**
 * "x" de tirar -- delegado no container ".mo-painel-esq" (ver init()).
 */
function onClickPainelEsq(e) {
	const btn = e.target.closest('.mo-slot-remover');
	if (!btn) {
		return;
	}
	e.stopImmediatePropagation();
	const index = parseInt(btn.dataset.index, 10);
	if (!isNaN(index)) {
		tentarTirar(index, btn.closest('.mo-slot'));
	}
}

/**
 * Mesma regra de InventoryCommon.js:580-601 (getItemTab, nao exportada de
 * la) -- ver cabecalho do arquivo.
 */
function getItemTab(item) {
	switch (item.type) {
		case ItemType.HEALING:
		case ItemType.USABLE:
		case ItemType.DELAYCONSUME:
		case ItemType.CASH:
			return Inventory.getUI().TAB.USABLE;

		case ItemType.WEAPON:
		case ItemType.ARMOR:
		case ItemType.SHADOWGEAR:
		case ItemType.PETEGG:
		case ItemType.PETARMOR:
			return Inventory.getUI().TAB.EQUIP;

		default:
		case ItemType.ETC:
		case ItemType.CARD:
		case ItemType.AMMO:
			return Inventory.getUI().TAB.ETC;
	}
}

/**
 * Grade da aba ativa -- fonte real: Inventory.getUI().list (itens equipados
 * NAO aparecem ali, ja saem pra dentro de Equipment quando vestidos, ver
 * InventoryCommon.js:729-732 -- entao a grade nunca duplica um slot).
 *
 * RODADA 2 (19/08/2026, lacuna 1 do briefing): a grade e um RETICULO sempre
 * visivel -- celulas vazias sao desenhadas ate GRADE_CAPACIDADE (ou ate
 * completar a ultima fileira, se a mochila tiver mais itens que isso), nao
 * so as ocupadas. Antes disso a janela so desenhava os itens existentes
 * soltos numa area branca -- lia como lista, nao como mochila.
 */
function syncGrade() {
	const root = _root();
	const lista = Inventory.getUI().list.filter(item => getItemTab(item) === _abaAtiva);

	const sig = _abaAtiva + '|' + lista.map(it => it.index + ':' + (it.count || 1) + ':' + (it.IsIdentified ? 1 : 0)).join(',');
	if (sig === _lastGradeSig) {
		return;
	}
	_lastGradeSig = sig;

	// A celula sob o cursor esta prestes a deixar de existir: a dica ancorada
	// nela sai junto. O `mouseover` da celula NOVA a traz de volta no mesmo
	// quadro, sem o jogador mexer o mouse.
	esconderDica();

	const grade = root.querySelector('.mo-grade');
	grade.innerHTML = '';

	// Fecha sempre numa fileira cheia -- se a lista passar da capacidade
	// visivel, a grade cresce em multiplos de GRADE_COLS (nunca corta a
	// ultima fileira no meio) e ".mo-grade-host" (.ri-scroll) rola.
	const totalCelulas = Math.max(GRADE_CAPACIDADE, Math.ceil(lista.length / GRADE_COLS) * GRADE_COLS);

	for (let i = 0; i < totalCelulas; i++) {
		const item = lista[i];
		const cell = document.createElement('div');

		if (!item) {
			cell.className = 'ri-tile mo-item is-empty';
			grade.appendChild(cell);
			continue;
		}

		const it = DB.getItemInfo(item.ITID);

		cell.className = 'ri-tile mo-item';
		cell.dataset.index = String(item.index);
		// SEM `title` aqui de proposito (25/08/2026): o nome vem pela dica de
		// hover, e manter os dois faria o tooltip do navegador aparecer por
		// cima da dica um segundo depois, dizendo a mesma coisa duas vezes.
		// Arrastavel (equipar arrastando ate um slot) -- contrato global
		// _OBJ_DRAG_, ver onGradeDragStart.
		cell.draggable = true;

		// FANTASIA (26/08/2026): item de costume ganha o selo de brilho no
		// canto -- um chapeu de fantasia usa o MESMO icone do chapeu comum, e
		// sem selo o jogador equipa e nao entende por que o atributo nao veio
		// (a peca e so-visual). O criterio e a mascara de vestir do proprio
		// item (eDeFantasia, slotsDeFantasia.js), o mesmo dado que decide em
		// qual slot ela cai -- nada inventado.
		const locationDoItem = 'location' in item ? item.location : item.WearState;
		const eFantasia = eDeFantasia(locationDoItem);
		if (eFantasia) {
			cell.classList.add('is-fantasia');
		}

		const count = item.count || 1;
		cell.innerHTML =
			'<img class="mo-item-icone" alt="" />' +
			(count > 1 ? `<span class="mo-item-qtd">${count}</span>` : '') +
			(eFantasia ? `<span class="mo-item-fantasia" aria-hidden="true">${RiIcones.fantasia || ''}</span>` : '');

		const img = cell.querySelector('.mo-item-icone');
		setItemIcon(img, item, it);

		grade.appendChild(cell);
	}
}

/**
 * Icone do item: tenta /ragidle/item/<ITID>.png (outro builder publicando em
 * paralelo, ver cabecalho do arquivo); se faltar, cai pro caminho antigo do
 * cliente (mesmo que InventoryCommon.js ja usa).
 */
function setItemIcon(imgEl, item, it) {
	const resName = item.IsIdentified ? it.identifiedResourceName : it.unidentifiedResourceName;
	imgEl.onerror = () => {
		imgEl.onerror = null;
		Client.loadFile(DB.INTERFACE_PATH + 'item/' + resName + '.bmp', dataURI => {
			imgEl.src = dataURI;
		});
	};
	imgEl.src = `/ragidle/item/${item.ITID}.png`;
}

/**
 * Duplo-clique = usar/equipar, o MESMO Inventory.getUI().useItem(item) que o
 * dblclick nativo chama (InventoryCommon.js:249-254/910-951) -- decide
 * sozinho "usar" (consumivel) vs "pedir pra equipar" (arma/armadura
 * identificada e sem dano) pelo item.type, nenhuma logica nova aqui.
 */
function onDblClickItem(e) {
	const cell = e.target.closest('.mo-item');
	if (!cell) {
		return;
	}
	e.stopImmediatePropagation();
	const index = parseInt(cell.dataset.index, 10);
	const item = Inventory.getUI().getItemByIndex(index);
	if (item) {
		Inventory.getUI().useItem(item);
	}
}

/**
 * Botao direito na grade = MENU (ContextMenu.js generico, so lido, nao
 * editado -- ver cabecalho do arquivo, RODADA 4). Antes o botao direito
 * abria a descricao DIRETO; agora abre o menu, e "Detalhes" e quem abre a
 * descricao (mesma janela ItemInfo de sempre, contrato tecnico secao 5b).
 * Rotulo por aba: equipavel = Equipar, consumivel = Usar, sem acao real
 * (Diversos) = so Detalhes -- getItemTab() acima ja classifica certo.
 */
function onContextMenuItem(e) {
	const cell = e.target.closest('.mo-item');
	if (!cell || cell.classList.contains('is-empty')) {
		return;
	}
	e.preventDefault();
	e.stopImmediatePropagation();
	const index = parseInt(cell.dataset.index, 10);
	const item = Inventory.getUI().getItemByIndex(index);
	if (!item) {
		return;
	}

	const TAB = Inventory.getUI().TAB;
	const tab = getItemTab(item);

	ContextMenu.remove();
	ContextMenu.append();

	if (tab === TAB.EQUIP) {
		ContextMenu.addElement('Equipar', () => {
			const location = 'location' in item ? item.location : item.WearState;
			tentarEquipar(item, location);
		});
		ContextMenu.nextGroup();
	} else if (tab === TAB.USABLE) {
		ContextMenu.addElement('Usar', () => {
			Inventory.getUI().useItem(item);
		});
		ContextMenu.nextGroup();
	}

	ContextMenu.addElement('Detalhes', () => {
		abrirDetalhes(item);
	});
}

/**
 * Botao direito numa peca VESTIDA = Tirar + Detalhes (secao 2 do pedido).
 * "Detalhes" aqui NAO tem o item completo a mao (so o DOM do host Equipment
 * escondido tem nome/icone, sem ITID -- mesma limitacao documentada no
 * cabecalho do arquivo pra syncEquipSlots) -- entao dispara um contextmenu
 * SINTETICO no proprio <div class="item"> do host nativo escondido, que
 * ainda tem o listener REAL (onEquipmentInfo, EquipmentCommon.js:238-241)
 * escutando -- o mesmo caminho que abriria se a janela nativa estivesse
 * visivel, sem duplicar a logica de achar o item por indice (fica presa no
 * closure _list de la, nunca foi exposta).
 */
function onContextMenuSlot(e) {
	const tile = e.target.closest('.mo-slot');
	if (!tile || !tile.classList.contains('is-ocupado')) {
		return;
	}
	e.preventDefault();
	e.stopImmediatePropagation();
	const index = parseInt(tile.dataset.index, 10);
	if (isNaN(index)) {
		return;
	}

	ContextMenu.remove();
	ContextMenu.append();
	ContextMenu.addElement('Tirar', () => {
		tentarTirar(index, tile);
	});
	ContextMenu.nextGroup();
	ContextMenu.addElement('Detalhes', () => {
		abrirDetalhesEquipado(index);
	});
}

/**
 * Descricao de um item da mochila -- ItemInfo, contrato tecnico secao 5b.
 */
function abrirDetalhes(item) {
	if (ItemInfo.uid === item.ITID) {
		ItemInfo.remove();
		return;
	}
	ItemInfo.append();
	ItemInfo.uid = item.ITID;
	ItemInfo.setItem(item);
}

/**
 * Descricao de uma peca VESTIDA -- ver onContextMenuSlot acima pro motivo do
 * evento sintetico (nao ha ITID disponivel por fora do host escondido).
 */
function abrirDetalhesEquipado(index) {
	const equipRoot = Equipment.getUI().getRoot();
	if (!equipRoot) {
		return;
	}
	const itemDiv = equipRoot.querySelector(`.item[data-index="${index}"]`);
	if (!itemDiv) {
		return;
	}
	const evt = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
	itemDiv.dispatchEvent(evt);
}

/**
 * ── Arrastar: grade -> slot (equipar) ─────────────────────────────────────
 * Fonte: dragstart na celula da grade. Escreve o contrato global
 * window._OBJ_DRAG_ = {type:'item', from:'Inventory', data:item} + o mesmo
 * JSON em dataTransfer 'Text' -- MOLDE EXATO de InventoryCommon.js:1214-1241
 * (so lido, nao editado), pra interoperar de graca com Armazem/Carrinho/
 * Correio/Atalhos.
 */
function onGradeDragStart(e) {
	const cell = e.target.closest('.mo-item');
	if (!cell || cell.classList.contains('is-empty')) {
		return;
	}
	const index = parseInt(cell.dataset.index, 10);
	const item = Inventory.getUI().getItemByIndex(index);
	if (!item) {
		return;
	}

	const img = new Image();
	const iconEl = cell.querySelector('.mo-item-icone');
	img.decoding = 'async';
	img.src = (iconEl && iconEl.src) || '';
	e.dataTransfer.setDragImage(img, 12, 12);
	e.dataTransfer.setData(
		'Text',
		JSON.stringify(
			(window._OBJ_DRAG_ = {
				type: 'item',
				from: 'Inventory',
				data: item
			})
		)
	);
}

function onGradeDragEnd() {
	delete window._OBJ_DRAG_;
	limparRealceSlots();
}

/**
 * Alvo: dragover/drop no painel esquerdo. So aceita (preventDefault) no
 * slot cujo bitmask casa com item.location -- nada nos incompativeis (a
 * ausencia do preventDefault ja impede o drop ali, sem precisar de mais
 * nada). Realce visual (".is-drop-alvo") SO no slot valido.
 */
function onPainelEsqDragOver(e) {
	const tile = e.target.closest('.mo-slot');
	const data = window._OBJ_DRAG_;
	if (!tile || !data || data.type !== 'item') {
		return;
	}
	const item = data.data;
	const location = 'location' in item ? item.location : item.WearState;
	const slotLoc = parseInt(tile.dataset.location, 10);
	if (!location || (location & slotLoc) === 0) {
		return;
	}
	e.preventDefault();
	e.stopImmediatePropagation();
	if (!tile.classList.contains('is-drop-alvo')) {
		limparRealceSlots();
		tile.classList.add('is-drop-alvo');
	}
}

function onPainelEsqDragLeave(e) {
	const tile = e.target.closest('.mo-slot');
	if (tile && !tile.contains(e.relatedTarget)) {
		tile.classList.remove('is-drop-alvo');
	}
}

function onPainelEsqDrop(e) {
	const tile = e.target.closest('.mo-slot');
	if (!tile) {
		return;
	}
	e.preventDefault();
	e.stopImmediatePropagation();
	tile.classList.remove('is-drop-alvo');

	let data;
	try {
		data = JSON.parse(e.dataTransfer.getData('Text'));
	} catch (_e) {
		return;
	}
	if (!data || data.type !== 'item') {
		return;
	}
	const item = data.data;
	const location = 'location' in item ? item.location : item.WearState;
	const slotLoc = parseInt(tile.dataset.location, 10);
	if (!location || (location & slotLoc) === 0) {
		return;
	}
	tentarEquipar(item, location);
}

/**
 * ── Arrastar: slot -> grade (tirar) ───────────────────────────────────────
 * Fonte: dragstart num slot OCUPADO. Nao usa o _OBJ_DRAG_ global (essa
 * direcao nao precisa interoperar com outras janelas, so com esta grade) --
 * so guarda o indice localmente.
 */
function onSlotDragStart(e) {
	const tile = e.target.closest('.mo-slot');
	if (!tile || !tile.classList.contains('is-ocupado')) {
		return;
	}
	const index = parseInt(tile.dataset.index, 10);
	if (isNaN(index)) {
		return;
	}
	_dragUnequipIndex = index;
	e.dataTransfer.setData('Text', JSON.stringify({ type: 'mochila-tirar', index }));
}

function onSlotDragEnd() {
	_dragUnequipIndex = null;
	limparRealceSlots();
}

function onGradeDragOver(e) {
	if (_dragUnequipIndex == null) {
		return;
	}
	e.preventDefault();
	e.stopImmediatePropagation();
}

function onGradeDrop(e) {
	if (_dragUnequipIndex == null) {
		return;
	}
	e.preventDefault();
	e.stopImmediatePropagation();
	const index = _dragUnequipIndex;
	_dragUnequipIndex = null;

	const tile = _root().querySelector(`.mo-slot[data-index="${index}"]`);
	tentarTirar(index, tile);
}

function limparRealceSlots() {
	const root = _root();
	root.querySelectorAll('.mo-slot.is-drop-alvo').forEach(el => el.classList.remove('is-drop-alvo'));
}

/**
 * ── Recusa do servidor (fase 1: peca com refino ou carta nao troca nem
 * tira, servidor-mapa.ts ~5789-5860) -- ver a nota grande no cabecalho do
 * arquivo pro raciocinio completo de por que isso NAO hooka o handler
 * nativo. Duas camadas:
 *   1) PREDICAO: se o selo de refino ("+N", ja desenhado por syncEquipSlots)
 *      aparece na peca que a acao afeta, o servidor SEMPRE recusa -- avisa
 *      na hora, sem esperar rede.
 *   2) FALLBACK por ausencia de mudanca: se nao tinha selo (entao nao dava
 *      pra prever), confere depois de RECUSA_DELAY_MS se o indice mudou de
 *      lugar. Se nao mudou, avisa de forma honesta (pode ser carta, nivel
 *      ou classe -- nao so refino).
 */
/**
 * A DICA DE HOVER: o nome do que esta sob o cursor.
 *
 * O TEXTO nao e inventado aqui em nenhum dos dois casos. Na grade ele sai de
 * `DB.getItemName(item)`, o mesmo que o chat usa ao pegar um item; nos slots
 * de equipamento sai do `.itemName` que a Equipment nativa ja renderiza
 * (a MESMA leitura que `syncEquipSlots` faz para o rotulo), com o rotulo do
 * slot como sobra quando ele esta vazio.
 */
function textoDaDica(el) {
	if (el.classList.contains('mo-item')) {
		if (el.classList.contains('is-empty')) {
			return '';
		}
		const item = Inventory.getUI().getItemByIndex(parseInt(el.dataset.index, 10));
		if (!item) {
			return '';
		}
		// A palavra por extenso ao lado do selo (26/08/2026): o selo diz "e
		// especial", a dica diz O QUE e -- criterio identico ao da celula
		// (eDeFantasia sobre a mascara de vestir do item).
		const nome = DB.getItemName(item);
		const location = 'location' in item ? item.location : item.WearState;
		return eDeFantasia(location) ? nome + ' — Fantasia' : nome;
	}
	if (el.classList.contains('mo-slot') || el.classList.contains('mo-slot-remover')) {
		// O `data-dica` cobre os tres casos do painel esquerdo: slot ocupado
		// (o nome da peca), slot vazio (o rotulo) e o botao de tirar.
		return el.dataset.dica || '';
	}
	return '';
}

function onHoverEntra(e) {
	const el = e.target.closest('.mo-slot-remover, .mo-item, .mo-slot');
	if (!el) {
		return;
	}
	const texto = textoDaDica(el);
	if (!texto) {
		esconderDica();
		return;
	}
	mostrarDica(el, texto);
}

function onHoverSai(e) {
	const el = e.target.closest('.mo-slot-remover, .mo-item, .mo-slot');
	if (!el) {
		return;
	}
	// `relatedTarget` dentro da MESMA celula (o icone, o contador, o botao
	// de tirar) nao e saida: sem esta guarda a dica pisca ao atravessar os
	// filhos, que e o defeito classico do hover delegado.
	const indo = e.relatedTarget;
	if (indo && el.contains(indo)) {
		return;
	}
	esconderDica();
}

/**
 * Mostra a dica ancorada na celula. A CONTA da posicao mora em
 * `posicaoDaDica.js`, separada para poder ser medida sem DOM.
 */
function mostrarDica(alvoEl, texto) {
	const root = _root();
	const dica = root.querySelector('.mo-dica');
	const janela = root.querySelector('.mo-window');
	if (!dica || !janela) {
		return;
	}
	dica.textContent = texto;
	// Visivel ANTES de medir: `hidden` e `display:none`, e um elemento
	// escondido mede 0x0 — a dica nasceria no canto e so acertaria a posicao
	// no hover seguinte.
	dica.hidden = false;
	const pos = posicaoDaDica(
		alvoEl.getBoundingClientRect(),
		dica.getBoundingClientRect(),
		janela.getBoundingClientRect()
	);
	dica.style.left = pos.left + 'px';
	dica.style.top = pos.top + 'px';
}

function esconderDica() {
	const dica = _root().querySelector('.mo-dica');
	if (dica) {
		dica.hidden = true;
	}
}

function mostrarAviso(msg) {
	const root = _root();
	const el = root.querySelector('.mo-aviso');
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
	}, 3200);
}

const MSG_REFINO = 'Esta peça está refinada e não pode ser trocada.';
const MSG_FALHA_EQUIPAR = 'Não foi possível equipar essa peça agora.';
const MSG_FALHA_TIRAR = 'Não foi possível tirar essa peça agora.';

/**
 * Equipar: index/location do item de origem (arrastado OU escolhido no
 * menu). Reusa o contrato tecnico -- Equipment.getUI().onEquipItem(index,
 * location), a MESMA chamada que o drop nativo da Equipment ja faz
 * (EquipmentCommon.js:879).
 */
function tentarEquipar(item, location) {
	const root = _root();
	const conflitantes = Array.from(root.querySelectorAll('.mo-slot.is-ocupado')).filter(tile => {
		const loc = parseInt(tile.dataset.location, 10);
		return (loc & location) !== 0;
	});
	const temRefinoNoConflito = conflitantes.some(tile => tile.querySelector('.mo-slot-refino'));

	Equipment.getUI().onEquipItem(item.index, location);

	if (temRefinoNoConflito) {
		mostrarAviso(MSG_REFINO);
		return;
	}
	agendarChecagemDeRecusa({ tipo: 'equipar', indice: item.index });
}

/**
 * Tirar: index do slot equipado. Reusa Equipment.getUI().onUnEquip(index) --
 * o mesmo caminho do "x" do slot e do dblclick nativo (EquipmentCommon.js:
 * 904-906).
 */
function tentarTirar(index, tileEl) {
	const temRefino = !!(tileEl && tileEl.querySelector('.mo-slot-refino'));

	Equipment.getUI().onUnEquip(index);

	if (temRefino) {
		mostrarAviso(MSG_REFINO);
		return;
	}
	agendarChecagemDeRecusa({ tipo: 'tirar', indice: index });
}

function agendarChecagemDeRecusa(ctx) {
	setTimeout(() => verificarRecusa(ctx), RECUSA_DELAY_MS);
}

function verificarRecusa(ctx) {
	if (ctx.tipo === 'equipar') {
		// Se o item AINDA esta na mochila com o mesmo indice, o pedido nao
		// mudou nada -- provavel recusa (nao so refino/carta: nivel/classe
		// tambem passam por aqui, por isso a mensagem generica).
		if (Inventory.getUI().getItemByIndex(ctx.indice)) {
			mostrarAviso(MSG_FALHA_EQUIPAR);
		}
	} else if (ctx.tipo === 'tirar') {
		const equipRoot = Equipment.getUI().getRoot();
		if (!equipRoot) {
			return;
		}
		const aindaVestido = !!equipRoot.querySelector(`.item[data-index="${ctx.indice}"]`);
		if (aindaVestido) {
			mostrarAviso(MSG_FALHA_TIRAR);
		}
	}
}

/**
 * Rodape: SO o peso real (Session.Entity.weight/.max_weight, em decimos --
 * ver cabecalho do arquivo). Sem "Organizar"/"+"/"Atalho": nenhum dado real
 * sustenta esses tres (secao 5 do briefing).
 */
function syncRodape() {
	const root = _root();
	const entity = Session.Entity;
	if (!entity) {
		return;
	}
	const peso = Math.floor((entity.weight || 0) / 10);
	const pesoMax = Math.floor((entity.max_weight || 0) / 10);
	const el = root.querySelector('.mo-peso-valor');
	if (!el) {
		return;
	}
	el.textContent = `${peso} / ${pesoMax}`;

	const fracao = pesoMax > 0 ? peso / pesoMax : 0;
	el.classList.toggle('is-critico', fracao >= 1);
	el.classList.toggle('is-aviso', fracao >= 0.8 && fracao < 1);
}

/**
 * Create component and export it
 */
export default UIManager.addComponent(MochilaIdle);
