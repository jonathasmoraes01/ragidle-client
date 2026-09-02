/**
 * UI/Components/DockIdle/DockIdle.js
 *
 * "Barra de acoes" — pivo de 19/08/2026 (pedido do dono, print do Ragnarok
 * Origin como referencia: barra inferior central com circulos de skill
 * numerados e um botao "Auto" a direita). SUBSTITUI a barra de atalhos de
 * janela que este componente tinha antes (Personagem/Skills/Inventario/
 * Equipamento/Caca/Config/Menu — ver historico deste arquivo antes desta
 * data se precisar da versao anterior) por uma barra que mostra a ROTACAO
 * DE SKILLS do modo idle e o botao "Auto".
 *
 * O QUE A BARRA MOSTRA (so dado real, nenhuma logica de jogo nova):
 *   - Rotacao: IdleConfig.editConfig.rotacao — array de ate 3
 *     { skillId, nivelDeUso }, o MESMO campo que a aba Skills da Config
 *     idle edita (ver IdleConfig.js renderSkills()/bindSkillsExtra()). SAO
 *     SEMPRE 3 SLOTS (o teto da rotacao — IdleConfig.js:729/887,
 *     "rotacao.length >= 3" trava a aba Skills de somar um 4o) — pivo de
 *     19/08/2026, pedido do dono: antes, sem rotacao configurada, nenhum
 *     orbe era desenhado (".dk-rotacao:empty{display:none}" colapsava o
 *     espaco); agora os 3 slots SEMPRE aparecem, do 1o ao ultimo, e vao
 *     sendo preenchidos um a um conforme o jogador equipa skill na aba
 *     Skills da Config idle. Slot preenchido: orbe de vidro (".ri-glass",
 *     Common.css) com o icone oficial da skill (/ragidle/skills/
 *     <skillId>.png, mesmo caminho que IdleSkills.js:560/637 ja usa),
 *     fallback de duas letras quando o PNG nao existe em disco
 *     (skillInitials() abaixo — duplicado de IdleSkills.js porque a funcao
 *     de origem nao e exportada de la, mesmo motivo/mesmo padrao que o
 *     extinto CombatCornerIdle.js ja usava), o numero de prioridade (1/2/3)
 *     e o nome curto da skill SE COUBER (ellipsis, nunca quebra linha — ver
 *     nomeDaSkill() abaixo, duplicado de IdleConfig.js:689-694 pelo mesmo
 *     motivo). Slot vazio (".dk-slot.is-empty", DockIdle.css): orbe
 *     discreto, sem icone, sem letra de fallback, sem numero de prioridade,
 *     SEM ROTULO (nenhum ".dk-slot-nome" desenhado — a ausencia de icone ja
 *     comunica) — so o aro fino sobre miolo claro translucido, no
 *     vocabulario do design system ("vazio quase nao existe", precedente
 *     ".ri-tile.is-empty" de Common.css, adaptado de ladrilho pra orbe).
 *     AJUSTADO apos julgamento (19/08/2026): a primeira versao usava o
 *     mesmo vidro ESCURO da capsula de rotulo (".dk-slot-nome") no miolo do
 *     orbe vazio, e o resultado lia como disco cinza opaco — "botao
 *     desabilitado" — o oposto de "espaco reservado" que o dono pediu. O
 *     miolo passou a usar "--surface-glass" (a mesma familia CLARA do orbe
 *     preenchido) com opacidade baixa via color-mix(), nunca o vidro escuro.
 *   - Clique num orbe — preenchido OU VAZIO — SO abre a Config idle na aba
 *     Skills (IdleConfig.abrirNaAba('skills'), alias publico ja existente no
 *     fim de IdleConfig.js) — nunca "lanca" a skill. O combate e automatico;
 *     um botao de lancar seria botao morto.
 *   - Auto: MESMO caminho de estado que o extinto CombatCornerIdle.js usava
 *     (IdleConfig.editConfig.cacaAutomatica + IdleConfig.pedirConfig()/
 *     .aplicarConfig(), aliases publicos no fim de IdleConfig.js) — logica
 *     de onClickAuto()/syncAutoState() abaixo copiada ao pe da letra de la,
 *     nenhum caminho de dado novo. Pivo de 19/08/2026: o BOTAO saiu da ponta
 *     direita da TELA e entrou no MESMO agrupamento visual da barra de
 *     skills (ver DockIdle.html/.css) — o estado que ele le/grava continua
 *     sendo exatamente este, sem mudanca nenhuma aqui.
 *
 * CombatCornerIdle (canto inferior direito, Auto + Mochila + o MESMO arco de
 * rotacao que este arquivo agora mostra na barra) fica REDUNDANTE com esta
 * barra e foi APOSENTADO: nao registra mais import()/prepare()/append() em
 * Engine/MapEngine.js (ver historico do arquivo la — decisao "nao registrar"
 * em vez de "esconder", pedida explicitamente no briefing como a opcao mais
 * limpa: o componente inteiro nunca entra no DOM, entao nao ha nada pra
 * esconder). O botao "Mochila" que ele tinha nao precisou de substituto
 * aqui: MochilaIdle.toggle() ja e alcancavel pela grade do painel do
 * personagem (BasicInfoIdle.html, data-action="inventory"/"equip" — ver
 * ATENCAO no rodape deste arquivo: esses dois botoes estao "em breve"
 * hoje, entao a perda e REAL, nao coberta — reportado ao dono, arquivo fora
 * do escopo deste conserto).
 *
 * ENCARGOS HERDADOS da barra de atalhos antiga (se ninguem os assumisse,
 * eles voltariam a aparecer na tela — ver briefing):
 *   1. Esconde ".hm-button"/".ic-button"/".is-button" — os 3 botoes
 *      flutuantes redundantes de HuntMap/IdleConfig/IdleSkills. Continuam
 *      redundantes porque a grade do painel do personagem (BasicInfoIdle)
 *      ja cobre os mesmos destinos (huntmap/idleconfig/skills) — a barra
 *      nova em si nao tem mais item de navegacao nenhum, mas os 3 botoes
 *      originais continuariam soltos na tela sem ESTE hide, entao a funcao
 *      migra pra ca ao pe da letra (mesma tecnica display:none reversivel).
 *   2. Esconde "#lvlup_job" — botao nativo encalhado (ver
 *      hideNativeLevelUpButton() abaixo, mesmo comentario/mesma tecnica de
 *      antes, so realocado pra este arquivo).
 *   3. Ponto de notificacao de ponto de skill disponivel (".ri-dot"): NAO
 *      precisou de novo lar. TopMenuIdle.js (a "constelacao") ja tem o
 *      MESMO ponto no proprio item "Skills" (TopMenuIdle.html:6-15) com o
 *      MESMO polling independente (TopMenuIdle.js:syncSkillDot(), ja
 *      existia antes deste pivo) — a copia que a barra de atalhos antiga
 *      mantinha (".dk-item[data-action='skills'] .ri-dot") so desapareceu
 *      junto com o item "Skills" que a hospedava, e a constelacao ja cobria
 *      o mesmo dado em paralelo. Nada fica sem dono.
 *
 * z-index / needFocus=false / pointer-events / mouseMode CROSS: MESMO
 * contrato de sempre (ver GUIComponent.js:159/317-360) — a barra nunca
 * precisa vir pra frente (nao e uma janela) e nunca intercepta clique no
 * mapa fora dos proprios botoes/orbes.
 *
 * ITEM 4 DO GAUNTLET (19/08/2026, pedido do dono): "quando o jogador
 * equipar/selecionar uma pocao pra uso, ela aparece na HUD com o icone e a
 * quantidade restante" — print do Ragnarok Origin como referencia de
 * ORGANIZACAO (fileira de consumiveis ao lado da barra de skills), nunca de
 * arte.
 *   - QUAL CAMPO: a "pocao selecionada" ja existe na Config idle, aba
 *     Recuperacao (NAO na aba Itens — essa e sobre buffs de item/ASPD, ver
 *     IdleConfig.js renderItens()). Sao dois campos, um por recurso:
 *     IdleConfig.editConfig.pocaoDeHp e .pocaoDeSp, cada um
 *     { ligado, itemId, usarCom } (ver IdleConfig.js renderRecuperacao()/
 *     renderPocao()). NAO existe modo "qualquer pocao" neste contrato — o
 *     jogador sempre escolhe um itemId especifico no <select> da aba, entao
 *     nao ha ambiguidade pra resolver aqui: um HUD por campo (HP e SP), cada
 *     um mostrando o item exato daquele campo.
 *   - QUANDO CONTA COMO "selecionada pra uso": so quando `ligado` E `itemId`
 *     estao presentes — ligado=false e a automacao de pocao DESLIGADA (o
 *     campo pode ter um itemId antigo guardado mas o automato nao vai
 *     beber), entao o slot correspondente fica no mesmo estado "vazio" que
 *     o slot de skill sem rotacao configurada.
 *   - QUANTIDADE: Inventory.getUI().getItemById(itemId).count (o MESMO
 *     inventario do cliente, InventoryCommon.js:549-557), relido a cada
 *     poll de 250ms que este arquivo ja tinha — sem hook de pacote novo (a
 *     armadilha conhecida do projeto: hookPacket sobrescreve em vez de
 *     encadear).
 *   - ICONE: Utils/ItemArt.js (o MESMO helper que Inventory/ItemInfo ja
 *     usam) — tenta a arte publicada (/ragidle/item/<id>.png) e cai no
 *     caminho antigo do GRF (Client.loadFile + DB.getItemInfo(...)
 *     .identifiedResourceName) quando o item ainda nao foi convertido.
 *   - ONDE: bloco proprio ".dk-consumiveis" dentro do MESMO ".dk-grupo" da
 *     rotacao de skills e do Auto (ver DockIdle.html/.css) — reusa ao pe da
 *     letra o tratamento de orbe/vazio da rotacao (".dk-slot",
 *     ".dk-slot.is-empty"), so a badge de quantidade (".dk-slot-qtd") e
 *     nova, em azul pra nao se confundir com o numerozinho DOURADO de
 *     prioridade de skill.
 *   - CLIQUE: abre a Config idle na aba "recuperacao" (IdleConfig.
 *     abrirNaAba('recuperacao')) — o mesmo alias publico que o slot de skill
 *     ja usa pra 'skills', so a aba muda.
 *
 * @author RagIdle
 */

import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import HuntMap from 'UI/Components/HuntMap/HuntMap.js';
import IdleConfig from 'UI/Components/IdleConfig/IdleConfig.js';
import IdleSkills from 'UI/Components/IdleSkills/IdleSkills.js';
import Inventory from 'UI/Components/Inventory/Inventory.js';
import DB from 'DB/DBManager.js';
import SK from 'DB/Skills/SkillConst.js';
import Client from 'Core/Client.js';
import { itemIconUrl, preferirArtePublicada } from 'Utils/ItemArt.js';
import RiIcones from 'UI/ri-icones.js';
import htmlText from './DockIdle.html?raw';
import cssText from './DockIdle.css?raw';

/**
 * Intervalo do polling leve (mesma cadencia de sempre, 250ms) usado pra
 * manter o #lvlup_job escondido, e pra reler IdleConfig.editConfig
 * (rotacao + cacaAutomatica) sem guardar estado local nenhum.
 */
const POLL_INTERVAL_MS = 250;

/**
 * @var {number|null} setInterval handle do polling leve descrito acima.
 */
let _pollTimer = null;

/**
 * Create Component
 */
const DockIdle = new GUIComponent('DockIdle', cssText);

/**
 * Troca cada marcador "<!--RI_ICONE:chave-->" do .html pela string SVG
 * correspondente do modulo de iconografia (UI/ri-icones.js).
 */
DockIdle.render = () => htmlText.replace(/<!--RI_ICONE:(\w+)-->/g, (_, chave) => RiIcones[chave] || '');

/**
 * Mesmo modo dos outros flutuantes RAGIDLE: scene click atravessa a UI
 * quando o mouse nao esta sobre um elemento clicavel de verdade (garantido
 * pelo pointer-events:none do ":host", ver DockIdle.css).
 */
DockIdle.mouseMode = GUIComponent.MouseMode.CROSS;

/**
 * Fora do sistema de foco/z-index dos componentes com janela — o dock nunca
 * precisa vir pra frente porque ele nao e uma janela.
 */
DockIdle.needFocus = false;

/**
 * Helper: query dentro do shadow root
 */
function _root() {
	return DockIdle._shadow || DockIdle._host;
}

/**
 * One-time setup (roda uma vez, durante GUIComponent#prepare()).
 */
DockIdle.init = function init() {
	const root = _root();
	root.querySelector('.dk-auto').addEventListener('click', onClickAuto);
};

/**
 * Esconde os 3 botoes flutuantes redundantes + o #lvlup_job encalhado,
 * carrega a config idle silenciosamente se a sessao ainda nao pediu
 * (o jogador pode nunca ter aberto a janela Config), sincroniza Auto/
 * rotacao com o estado real e liga o polling leve.
 */
DockIdle.onAppend = function onAppend() {
	hideRedundantFloatingButtons();
	hideNativeLevelUpButton();
	if (!IdleConfig.editConfig) {
		IdleConfig.pedirConfig();
	}
	syncAll();
	startPolling();
};

/**
 * Desliga o polling quando o dock sai de cena (troca de mapa).
 */
DockIdle.onRemove = function onRemove() {
	stopPolling();
};

function startPolling() {
	stopPolling();
	_pollTimer = setInterval(pollNativeState, POLL_INTERVAL_MS);
}

function stopPolling() {
	if (_pollTimer != null) {
		clearInterval(_pollTimer);
		_pollTimer = null;
	}
}

function pollNativeState() {
	hideNativeLevelUpButton();
	syncAll();
}

function syncAll() {
	syncAutoState();
	syncRotacao();
	syncConsumiveis();
}

/**
 * O botao nativo "#lvlup_job" fica encalhado no canto inferior direito da
 * tela (ver SkillListCommon.js:1060-1064, `document.body.appendChild`) —
 * perde a referencia visual porque a janela nativa BasicInfo que o ancorava
 * esta escondida (BasicInfoIdle.js:218-223). Escondido aqui de forma
 * REVERSIVEL (display:none via JS, nunca .remove()) — o proprio
 * SkillListCommon.js continua dono do elemento. Precisa rodar no polling
 * (nao so uma vez) porque o elemento so entra em document.body quando
 * SkillList.getUI().onLevelUp() roda pela primeira vez — se isso acontecer
 * DEPOIS do onAppend do DockIdle, um hide unico o perderia.
 */
function hideNativeLevelUpButton() {
	const btn = document.getElementById('lvlup_job');
	if (btn && btn.style.display !== 'none') {
		btn.style.display = 'none';
	}
}

/**
 * Esconde ".hm-button"/".ic-button"/".is-button" — display:none reversivel,
 * nenhum arquivo de HuntMap/IdleConfig/IdleSkills e alterado. Precisa rodar
 * DEPOIS de HuntMap.prepare()/IdleConfig.prepare()/IdleSkills.prepare() (a
 * shadow DOM deles so existe apos o prepare()) — em Engine/MapEngine.js o
 * DockIdle.prepare()/append() ficam depois desses tres, entao a ordem ja
 * esta garantida.
 */
function hideRedundantFloatingButtons() {
	hideButton(HuntMap, '.hm-button');
	hideButton(IdleConfig, '.ic-button');
	hideButton(IdleSkills, '.is-button');
	// AdminPanel (".ap-button") fica de fora de proposito: outro builder
	// esta removendo-o nesta mesma rodada (ver briefing), nao e encargo
	// deste componente.
}

function hideButton(component, selector) {
	const root = component.getRoot();
	const btn = root && root.querySelector(selector);
	if (btn && btn.style.display !== 'none') {
		btn.style.display = 'none';
	}
}

/**
 * Releh IdleConfig.serverConfig.cacaAutomatica (nunca um bool local, e nunca o
 * RASCUNHO) e aplica/remove ".is-on" no botao Auto.
 *
 * A fonte mudou de `editConfig` para `serverConfig` em 27/08/2026 (auditoria).
 * `editConfig` e o rascunho da janela de Config, e ele acende o botao por conta
 * propria: o jogador marca a caixa "Caca automatica" na janela, NAO aperta
 * "Aplicar", fecha a janela — e o botao da barra de acoes fica aceso com o
 * servidor desligado.
 *
 * O mesmo vale no caminho da recusa: quando o servidor recusa
 * transacionalmente, `onConfigReceived` DE PROPOSITO nao toca em `editConfig`
 * (o rascunho do jogador fica na tela para ele consertar), entao um botao que
 * le o rascunho continua aceso anunciando algo que nao aconteceu.
 *
 * O botao e um indicador de ESTADO DO SERVIDOR. So `serverConfig` sabe disso.
 */
function syncAutoState() {
	const root = _root();
	const btn = root.querySelector('.dk-auto');
	if (!btn) {
		return;
	}
	const ligado = !!(IdleConfig.serverConfig && IdleConfig.serverConfig.cacaAutomatica);
	btn.classList.toggle('is-on', ligado);
}

/**
 * O clique pede a TROCA e espera a resposta — nao antecipa o resultado.
 *
 * A versao anterior invertia `editConfig.cacaAutomatica`, mandava o rascunho
 * INTEIRO da janela de Config e ja repintava o botao. Tres coisas erradas de
 * uma vez: enviava edicoes que o jogador nunca aplicou, podia ser recusada por
 * causa delas, e acendia mesmo assim.
 *
 * `alternarCacaAutomatica` monta o pedido a partir do estado ACEITO pelo
 * servidor. O botao repinta quando a resposta chega, no `syncAutoState` do
 * ciclo seguinte — que e a unica hora em que ele sabe alguma coisa.
 */
function onClickAuto(e) {
	e.stopImmediatePropagation();
	IdleConfig.alternarCacaAutomatica();
}

/**
 * Escapa texto antes de injetar em innerHTML. Duplicado de IdleConfig.js
 * (funcao la nao e exportada) - mesmo padrao que IdleSkills.js e o extinto
 * CombatCornerIdle.js ja usavam pra duplicar a dela.
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
 * Duas letras placeholder a partir de um skillId (ex.: "MG_FIREBOLT" ->
 * "MF") pro fallback do orbe quando o PNG da skill nao existe em disco.
 * Duplicado de IdleSkills.js (skillInitials(), tambem nao exportada de la).
 */
function skillInitials(skillId) {
	const parts = String(skillId || '').split('_');
	if (parts.length >= 2 && parts[0] && parts[1]) {
		return (parts[0][0] + parts[1][0]).toUpperCase();
	}
	return String(skillId || '')
		.slice(0, 2)
		.toUpperCase();
}

/**
 * O nome de EXIBICAO de uma skill (PT do cliente instalado, o mesmo que a
 * aba Skills da Config idle mostra) — duplicado de
 * IdleConfig.js:689-694 (nomeDaSkill(), tambem nao exportada de la). Le
 * IdleConfig.contexto (publico), o mesmo pacote que alimenta a propria
 * janela Config; sem contexto ainda carregado (ou skill nao encontrada)
 * cai no id tecnico, mesmo fallback de origem.
 */
/**
 * O TIMER DE COOLDOWN NOS ORBES (D-694, pedido do dono em 01/09/2026).
 *
 * O servidor manda `ZC_SKILL_POSTDELAY` (0x043d) quando a skill que saiu tem
 * `Cooldown` no skill_db; o handler nativo (`Skill.js:onSetSkillDelay`) chama
 * `DockIdle.onSkillDelay` e este mapa guarda ate quando cada uma dorme. Um
 * relogio de 200 ms redesenha SO o overlay (nao o slot inteiro — o render dos
 * slots e cacheado por `_lastRotacaoJson` e nao pode rodar por tick).
 *
 * O id chega NUMERICO e a rotacao guarda NOME: `SK` (SkillConst) e a mesma
 * tabela nome->id do resto do cliente, invertida uma vez aqui.
 */
const _cooldownAte = {}; // skillId (nome) -> timestamp em que acorda
let _relogioDeCooldown = null;
let _nomePorIdNumerico = null;

function nomeDoIdNumerico(skid) {
	if (!_nomePorIdNumerico) {
		_nomePorIdNumerico = {};
		for (const nome in SK) {
			_nomePorIdNumerico[SK[nome]] = nome;
		}
	}
	return _nomePorIdNumerico[skid] || null;
}

DockIdle.onSkillDelay = function onSkillDelay(skid, delayMs) {
	const nome = nomeDoIdNumerico(skid);
	if (!nome || !(delayMs > 0)) {
		return;
	}
	_cooldownAte[nome] = Date.now() + delayMs;
	desenharCooldowns();
	if (!_relogioDeCooldown) {
		_relogioDeCooldown = setInterval(() => {
			const vivos = desenharCooldowns();
			if (vivos === 0) {
				clearInterval(_relogioDeCooldown);
				_relogioDeCooldown = null;
			}
		}, 200);
	}
};

/** Redesenha os overlays; devolve quantos cooldowns seguem vivos. */
function desenharCooldowns() {
	const container = DockIdle.ui && DockIdle.ui.find('.dk-rotacao')[0];
	if (!container) {
		return 0;
	}
	const agora = Date.now();
	let vivos = 0;
	container.querySelectorAll('.dk-slot').forEach(btn => {
		const nome = btn.getAttribute('data-skill');
		const ate = nome ? _cooldownAte[nome] : undefined;
		const restam = ate ? ate - agora : 0;
		let overlay = btn.querySelector('.dk-slot-cd');
		if (restam > 0) {
			vivos++;
			if (!overlay) {
				overlay = document.createElement('span');
				overlay.className = 'dk-slot-cd';
				const wrap = btn.querySelector('.dk-slot-ring-wrap');
				if (wrap) {
					wrap.appendChild(overlay);
				}
			}
			overlay.textContent = restam >= 10000 ? Math.ceil(restam / 1000) + 's' : (restam / 1000).toFixed(1);
		} else if (overlay) {
			overlay.remove();
			if (nome && _cooldownAte[nome]) {
				delete _cooldownAte[nome];
			}
		}
	});
	return vivos;
}

function nomeDaSkill(skillId) {
	const ctx = IdleConfig.contexto || {};
	const todas = [].concat(ctx.skillsAtivas || [], ctx.skillsPassivas || []);
	const achada = todas.find(s => s.skillId === skillId);
	return (achada && achada.nome) || skillId;
}

/**
 * @var {string|null} JSON da ultima rotacao ja desenhada - evita reconstruir
 * o innerHTML (e reanexar listeners) a cada poll de 250ms quando nada mudou.
 */
let _lastRotacaoJson = null;

/**
 * Quantos slots a barra sempre mostra — o mesmo teto que a aba Skills da
 * Config idle trava ao somar um item na rotacao (IdleConfig.js:729/887,
 * "rotacao.length >= 3"). Nao e um numero novo: e o mesmo limite, so
 * exposto aqui pra desenhar o slot ANTES de existir skill nele.
 */
const TOTAL_DE_SLOTS = 3;

/**
 * Releh IdleConfig.serverConfig.rotacao e redesenha os orbes so quando o
 * array mudou desde o ultimo poll (aplicado pela propria janela Config, ou
 * por uma resposta do servidor que a rejeitou/confirmou). Pivo de
 * 19/08/2026 (pedido do dono): SEMPRE desenha TOTAL_DE_SLOTS orbes — os que
 * a rotacao ja preencheu ganham icone/nome/prioridade, os que sobram vem
 * ".dk-slot.is-empty" (orbe discreto sem icone e SEM ROTULO, ver
 * DockIdle.css — julgamento de 19/08/2026 cortou o rotulo "Vazio" que a
 * primeira versao desenhava: nao existe na referencia, ficava ilegivel, e a
 * ausencia de icone ja basta pra comunicar "slot vazio"). Antes, sem
 * rotacao, ".dk-rotacao" ficava sem filhos e o CSS (":empty") colapsava o
 * espaco inteiro - essa saida morreu aqui.
 */
function syncRotacao() {
	const root = _root();
	const container = root.querySelector('.dk-rotacao');
	if (!container) {
		return;
	}

	const rotacao = (IdleConfig.serverConfig && IdleConfig.serverConfig.rotacao) || [];
	const json = JSON.stringify(rotacao);
	if (json === _lastRotacaoJson) {
		return;
	}
	_lastRotacaoJson = json;

	const slots = [];
	for (let i = 0; i < TOTAL_DE_SLOTS; i++) {
		slots.push(rotacao[i] || null);
	}

	container.innerHTML = slots
		.map((r, i) => {
			if (!r) {
				// Sem rotulo de proposito (ver comentario da funcao acima) —
				// ".dk-slot" tem min-height fixo (DockIdle.css) pra este orbe
				// mais curto nao desalinhar com os preenchidos ao lado.
				return `
				<button type="button" class="dk-slot is-empty" data-action="rotacao" title="Slot de skill vazio - clique para configurar">
					<span class="dk-slot-ring-wrap">
						<span class="dk-slot-ring ri-glass"></span>
					</span>
				</button>`;
			}
			const nome = nomeDaSkill(r.skillId);
			return `
			<button type="button" class="dk-slot" data-action="rotacao" data-skill="${escapeHtml(r.skillId)}" title="${escapeHtml(nome)} - prioridade ${i + 1}">
				<span class="dk-slot-ring-wrap">
					<span class="dk-slot-ring ri-glass">
						<img class="dk-slot-icone" src="/ragidle/skills/${encodeURIComponent(r.skillId)}.png" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
						<span class="dk-slot-fallback">${escapeHtml(skillInitials(r.skillId))}</span>
					</span>
					<span class="dk-slot-prioridade">${i + 1}</span>
				</span>
				<span class="dk-slot-nome">${escapeHtml(nome)}</span>
			</button>`;
		})
		.join('');

	container.querySelectorAll('.dk-slot').forEach(btn => btn.addEventListener('click', onClickSlot));
}

/**
 * Qualquer orbe abre a Config idle direto na aba Skills - so exibicao +
 * navegacao, nenhuma escrita no rascunho de rotacao daqui, e NUNCA lanca a
 * skill (o combate e automatico, ver cabecalho do arquivo).
 */
function onClickSlot(e) {
	e.stopImmediatePropagation();
	IdleConfig.abrirNaAba('ataque');
}

/**
 * Os 2 slots fixos de consumivel (nesta ordem) — HP e SP, os dois campos que
 * a aba Recuperacao da Config idle edita (ver cabecalho do arquivo pro
 * porque nao ha um 3o/4o slot "generico": o contrato so tem estes dois
 * recursos automatizados hoje).
 */
const SLOTS_DE_CONSUMO = [
	{ campo: 'pocaoDeHp', rotulo: 'HP' },
	{ campo: 'pocaoDeSp', rotulo: 'SP' }
];

/**
 * Quantidade restante de um item no inventario do cliente — mesma fonte que
 * a janela Inventario usa (InventoryCommon.js:549-557), relida a cada poll.
 * 0 quando o item nao esta no inventario (pocao selecionada mas em falta -
 * dado real, nao escondido).
 */
function quantidadeDoItem(itemId) {
	const inv = Inventory.getUI();
	const item = inv && typeof inv.getItemById === 'function' ? inv.getItemById(itemId) : null;
	return item ? item.count || 0 : 0;
}

/**
 * Nome de exibicao do item (DB.getItemInfo, o mesmo catalogo que Inventory/
 * ItemInfo ja usam) - cai no id numerico se o item nao existir no DB local.
 */
function nomeDoItem(itemId) {
	const it = DB.getItemInfo(itemId);
	return (it && it.identifiedDisplayName) || String(itemId);
}

/**
 * @var {string|null} JSON do ultimo par HP/SP ja desenhado - mesma tecnica
 * de _lastRotacaoJson (evita reconstruir innerHTML e reanexar listeners/
 * reiniciar o carregamento de icone a cada poll de 250ms quando nada mudou -
 * inclui a quantidade de proposito, pra redesenhar quando so o estoque
 * mudar).
 */
let _lastConsumoJson = null;

/**
 * Releh IdleConfig.serverConfig.pocaoDeHp/.pocaoDeSp + a quantidade atual no
 * inventario, e redesenha os 2 orbes de consumivel so quando algo mudou (ver
 * cabecalho do arquivo pro campo/formato/decisao completos). Slot
 * "preenchido" exige ligado=true E itemId presente - ligado=false cai no
 * mesmo tratamento ".dk-slot.is-empty" do slot de skill vazio.
 */
function syncConsumiveis() {
	const root = _root();
	const container = root.querySelector('.dk-consumiveis');
	if (!container) {
		return;
	}

	const cfg = IdleConfig.serverConfig;
	const estados = SLOTS_DE_CONSUMO.map(s => {
		const pocao = cfg && cfg[s.campo];
		const preenchido = !!(pocao && pocao.ligado && pocao.itemId);
		return {
			campo: s.campo,
			rotulo: s.rotulo,
			preenchido,
			itemId: preenchido ? pocao.itemId : null,
			quantidade: preenchido ? quantidadeDoItem(pocao.itemId) : null
		};
	});

	const json = JSON.stringify(estados);
	if (json === _lastConsumoJson) {
		return;
	}
	_lastConsumoJson = json;

	container.innerHTML = estados
		.map(e => {
			if (!e.preenchido) {
				// Mesmo criterio "vazio quase nao existe" do slot de skill (ver
				// syncRotacao acima) - sem rotulo de proposito.
				return `
				<button type="button" class="dk-slot dk-slot-consumo is-empty" data-action="consumo" data-campo="${e.campo}" title="Poção de ${e.rotulo} não configurada - clique para configurar">
					<span class="dk-slot-ring-wrap">
						<span class="dk-slot-ring ri-glass"></span>
					</span>
				</button>`;
			}
			const nome = nomeDoItem(e.itemId);
			return `
			<button type="button" class="dk-slot dk-slot-consumo" data-action="consumo" data-campo="${e.campo}" title="${escapeHtml(nome)} - ${e.quantidade} restante(s)">
				<span class="dk-slot-ring-wrap">
					<span class="dk-slot-ring ri-glass">
						<img class="dk-slot-icone" alt="" />
					</span>
					<span class="dk-slot-qtd">${e.quantidade}</span>
				</span>
				<span class="dk-slot-nome">${escapeHtml(nome)}</span>
			</button>`;
		})
		.join('');

	container.querySelectorAll('.dk-slot-consumo').forEach(btn => btn.addEventListener('click', onClickConsumo));

	// Carrega o icone de cada slot preenchido: arte publicada primeiro, recuo
	// pro caminho antigo do GRF (mesma sequencia que Inventory/ItemInfo ja
	// usam, ver Utils/ItemArt.js).
	estados.forEach(e => {
		if (!e.preenchido) {
			return;
		}
		const img = container.querySelector(`.dk-slot-consumo[data-campo="${e.campo}"] .dk-slot-icone`);
		if (!img) {
			return;
		}
		const aplicarIcone = url => {
			img.src = url;
		};
		preferirArtePublicada(itemIconUrl(e.itemId), aplicarIcone, () => {
			const it = DB.getItemInfo(e.itemId);
			Client.loadFile(DB.INTERFACE_PATH + 'item/' + it.identifiedResourceName + '.bmp', aplicarIcone);
		});
	});
}

/**
 * Qualquer orbe de consumivel abre a Config idle direto na aba Recuperacao -
 * so exibicao + navegacao, mesmo padrao de onClickSlot() acima (nunca "usa"
 * o item daqui, o consumo e automatico).
 */
function onClickConsumo(e) {
	e.stopImmediatePropagation();
	IdleConfig.abrirNaAba('sobrevivencia');
}

/**
 * A TROCA DE PERSONAGEM ESQUECE A BARRA DE ACOES (28/08/2026).
 *
 * Voltar ao menu de personagem NAO recarrega a pagina: `onRestartAnswer` chama
 * `cleanGameUI()` e `onRestart()`, sem `GameEngine.reload()` (o reload so
 * acontece no SAIR). Todo estado de MODULO atravessa a troca — e este arquivo
 * guarda as assinaturas do que ela ja desenhou.
 *
 * Sao caches de "o que eu ja pintei": enquanto a assinatura nao muda, a barra
 * NAO redesenha. Com a assinatura do personagem anterior na mao, a rotacao e
 * os consumiveis dele ficam na tela — e um clique ali agiria sobre o novo.
 *
 * Chamada por `cleanGameUI()` em Engine/MapEngine.js, junto com os outros
 * componentes RAGIDLE. Quem somar estado de personagem aqui soma a linha
 * correspondente ABAIXO, e o portao `limpeza-da-troca-de-personagem.test.ts`
 * (no repo do servidor) reprova se esquecer.
 */
DockIdle.limparEstadoDoPersonagem = function limparEstadoDoPersonagem() {
	_lastRotacaoJson = null;
	_lastConsumoJson = null;
};

/**
 * Create component and export it
 */
export default UIManager.addComponent(DockIdle);
