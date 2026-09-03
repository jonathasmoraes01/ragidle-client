/**
 * UI/Components/IdleConfig/IdleConfig.js
 *
 * "Configuração idle" — a janela em que o jogador ajusta o autômato.
 *
 * ---------------------------------------------------------------------------
 * v6 — o REDESENHO (D-915, 01/09/2026)
 * ---------------------------------------------------------------------------
 * Até a v5 esta janela era, por escolha (D-328: "a referência é a janela do
 * Midgard Idle"), uma cópia estrutural da deles: cinco abas horizontais com
 * os mesmos nomes (Geral / Alvos / Skills / Recuperação / Itens), os mesmos
 * cards na mesma ordem e até as mesmas frases. O dono pediu que ela deixasse
 * de parecer cópia — e, no mesmo pedido, o suporte ao GRUPO que a deles
 * ganhou: cura e buffs com a opção "só em você / no grupo", renovados em cada
 * membro quando caem.
 *
 * O que mudou de COMPOSIÇÃO (não só a pele):
 *
 *   - a faixa do INTERRUPTOR-MESTRE no alto: "Caça automática" sempre à
 *     vista, com o mapa em que você está — antes ele era um switch perdido
 *     na aba Geral;
 *   - as abas viraram um TRILHO vertical de seções, organizado pelo que o
 *     autômato FAZ (Caçada · Ataque · Suporte · Sobrevivência · Consumíveis),
 *     e cada seção mostra um RESUMO de uma linha embaixo do nome ("2/3
 *     presas", "1 buff · cura", "senta · poção HP") — o estado inteiro sem
 *     trocar de seção;
 *   - as presas do mapa viraram uma GRADE de chips com o avatar do monstro,
 *     em vez de uma lista vertical de checkboxes;
 *   - a seção SUPORTE é nova: os buffs mantidos ganharam o segmentado
 *     "Só eu / Grupo" (só nos que alcançam o grupo — Bênção sim, Vigor não),
 *     e a cura ganhou um card próprio com o limiar ("curar abaixo de N%") e o
 *     alvo. A cura continua morando na ordem de golpes (D-673): o card só a
 *     liga/desliga e a ajusta;
 *   - o rodapé diz quantas alterações estão pendentes antes de Aplicar.
 *
 * O que NÃO mudou — e é o que faz isto ser reforma e não reescrita: os três
 * pacotes e o contrato v1 (só ganhou campos aditivos: `alvo` por buff, `cura`),
 * o rascunho × estado aceito (`editConfig` × `serverConfig`), o Aplicar
 * transacional, o botão Auto que só manda o próprio campo, a memória de aba
 * (com os ids antigos traduzidos — `secoesDaConfig.js`), a limpeza na troca
 * de personagem e a sondagem de mapa. Os seletores que provas e testes usam
 * continuam existindo: `.ic-window`, `.ic-close`, `.ic-button`, `.ic-tab
 * [data-tab]`, `.ic-apply`, `data-bool="..."`.
 *
 * Protocol (custom extension, not part of stock rAthena/roBrowser):
 *   CZ_RAGIDLE_PEDIR_CONFIG    0x0ff3  (client -> server, fixed, opcode only)
 *   ZC_RAGIDLE_CONFIG          0x0ff4  (server -> client, variable, JSON;
 *                                       answers BOTH pedir and aplicar)
 *   CZ_RAGIDLE_APLICAR_CONFIG  0x0ff5  (client -> server, variable, JSON —
 *                                       just the "config" object, applied
 *                                       transactionally server-side)
 * Declared in Network/PacketStructure.js (search "RAGIDLE:") and registered
 * for receive-side framing in Network/PacketRegister.js and
 * Network/Packets/packets2021_len_main.js.
 *
 * @author RagIdle
 */

import Renderer from 'Renderer/Renderer.js';
import Preferences from 'Core/Preferences.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import UIManager from 'UI/UIManager.js';
import ChatBox from 'UI/Components/ChatBox/ChatBox.js';
import GUIComponent from 'UI/GUIComponent.js';
import RiIcones from 'UI/ri-icones.js';
import { pocoesDoEixo, escolherPocaoPadrao } from './escolhaDePocao.js';
import {
	ABAS_ACEITAS,
	ABA_PADRAO,
	TETO_DA_ORDEM,
	TETO_DE_BUFFS,
	abaCanonica,
	alternarCura,
	alvoDoBuff,
	contarAlteracoes,
	curaNaRotacao,
	duracaoCurta,
	resumoDaSecao
} from './secoesDaConfig.js';
import htmlText from './IdleConfig.html?raw';
import cssText from './IdleConfig.css?raw';
import { fecharEEsquecer } from '../limpezaDeJanelaIdle.js';
import { abaLembrada, lembrarAba } from '../memoriaDeAba.js';

/**
 * Keep in sync with the ":host" / ".ic-window" size in IdleConfig.css and
 * with --w-idleconfig/--h-idleconfig in UI/Common.css — used to clamp the
 * saved window position to the current viewport.
 */
const WINDOW_WIDTH = 760;
const WINDOW_HEIGHT = 580;

/**
 * Create Component
 */
const IdleConfig = new GUIComponent('IdleConfig', cssText);

/**
 * O HTML traz marcadores "<!--RI_ICONE:chave-->" no lugar dos glifos — a
 * mesma troca que o Mapa de Caça e o TopMenuIdle fazem. O glifo vem de UM
 * arquivo (ri-icones.js), por regra do design system.
 */
IdleConfig.render = () => htmlText.replace(/<!--RI_ICONE:(\w+)-->/g, (_, chave) => RiIcones[chave] || '');

/**
 * Floating icon must not block scene clicks/hover — same reasoning and same
 * choice as HuntMap (HuntMap.js) and CashShopIcon.
 */
IdleConfig.mouseMode = GUIComponent.MouseMode.CROSS;

/**
 * @var {object|null} last config confirmed by the server (contract v1's
 *      "config" object) — the baseline that IdleConfig.dirty compares
 *      IdleConfig.editConfig against.
 */
IdleConfig.serverConfig = null;

/**
 * @var {object|null} draft config being edited in the window. Only sent to
 *      the server when the player clicks "Aplicar".
 */
IdleConfig.editConfig = null;

/**
 * @var {object|null} last "contexto" received (current map, its monsters,
 *      the player's skills, healing consumables, capabilities, group).
 */
IdleConfig.contexto = null;

/**
 * O contexto que esta na mao descreve o mapa ANTERIOR? (27/08/2026, auditoria C)
 *
 * `contexto` so e `null` no boot do modulo e nunca mais volta a ser — a unica
 * outra escrita e a da resposta do servidor. Entao toda guarda escrita como
 * `if (!IdleConfig.contexto) return` funciona UMA vez por sessao e depois vira
 * decoracao, enquanto o problema real e contexto OBSOLETO, e nao ausente.
 *
 * Na troca de mapa, `IdleConfig.sondarMapa()` e `HuntButtonIdle.append()` saem
 * no MESMO bloco sincrono (Engine/MapEngine.js): a resposta nao pode ter
 * chegado, e quem ler `contexto` ali le o mapa de onde o jogador saiu.
 *
 * Esta marca e ADITIVA de proposito: `contexto` tem consumidores em seis
 * arquivos (drop de caca, registro da caca, dock, pocao...), e anula-lo para
 * fazer a guarda funcionar mudaria o comportamento de todos eles.
 */
IdleConfig.contextoObsoleto = false;

/**
 * @var {string} a secao ativa (uma das `SECOES` de secoesDaConfig.js): 'caca' | 'ataque' | 'suporte' | 'sobrevivencia' | 'consumiveis'
 *
 * Nasce no padrao e e trocada pela secao LEMBRADA no init() — a leitura mora
 * la porque depende de `_preferences`, declarada mais abaixo neste arquivo.
 */
IdleConfig.activeTab = ABA_PADRAO;

/**
 * @var {boolean} true when editConfig differs from serverConfig (drives the
 *      "Aplicar" button's disabled state).
 */
IdleConfig.dirty = false;

/**
 * @var {string[]} problems returned by a rejected "aplicar" (contract's
 *      non-empty "problemas" — transactional refusal, nothing changed
 *      server-side).
 */
IdleConfig.problemas = [];

/**
 * @var {Preferences} posicao da janela (x/y sao null ate o jogador mover) E a
 *      secao em que ele estava (`aba`, null ate ele trocar a primeira vez).
 *      A versao continua 1.0 DE PROPOSITO: somar chave nova aos padroes nao
 *      exige subir versao, e subir apagaria a posicao ja salva — a conta esta
 *      no cabecalho de memoriaDeAba.js. Os ids ANTIGOS gravados ('alvos',
 *      'skills'...) sao traduzidos por `abaCanonica` na leitura.
 */
const _preferences = Preferences.get(
	'IdleConfig',
	{
		x: null,
		y: null,
		aba: null
	},
	1.0
);

/**
 * Helper: query inside shadow root
 */
function _root() {
	return IdleConfig._shadow || IdleConfig._host;
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
 * Deep-clone a JSON-shaped config object (everything in the contract is
 * plain data: booleans, numbers, strings, arrays, nested objects).
 */
function cloneConfig(config) {
	return JSON.parse(JSON.stringify(config));
}

/**
 * Dot-path set helper so the renderers below can bind a single generic
 * handler (bindGenericControls) to nested fields like "descanso.hpAbaixo",
 * "pocaoDeHp.itemId" or "rotacaoDeBuffs.0.alvo" via a `data-bool` /
 * `data-select` / `data-range` / `data-set` attribute instead of one bespoke
 * listener per field.
 */
function setPath(obj, path, value) {
	const keys = path.split('.');
	let cur = obj;
	for (let i = 0; i < keys.length - 1; i++) {
		cur = cur[keys[i]];
	}
	cur[keys[keys.length - 1]] = value;
}

/**
 * A cura do contrato SEMPRE existe no rascunho: o servidor a ecoa resolvida
 * desde D-1000, e uma resposta de servidor mais antigo (sem o campo) cai no
 * mesmo padrao que ele usaria — metade da barra, grupo.
 */
function garantirCura(cfg) {
	if (!cfg.cura || typeof cfg.cura !== 'object') {
		cfg.cura = { alvo: 'grupo', curarAbaixoDe: 50 };
	}
	return cfg.cura;
}

/**
 * One-time setup (runs once, during GUIComponent#prepare()).
 */
IdleConfig.init = function init() {
	const root = _root();

	// A secao em que o jogador estava da ultima vez, antes do primeiro
	// desenho — com o id antigo ('alvos', 'skills') traduzido para a secao
	// que herdou o conteudo dele.
	IdleConfig.activeTab = abaCanonica(abaLembrada(_preferences, ABA_PADRAO, ABAS_ACEITAS));

	root.querySelector('.ic-button').addEventListener('click', onClickButton);
	root.querySelector('.ic-close').addEventListener('click', onClickClose);
	root.querySelectorAll('.ic-tab').forEach(btn => btn.addEventListener('click', onClickTab));
	root.querySelector('.ic-apply').addEventListener('click', onClickApply);

	// GUIComponent#draggable() moves ":host" via left/top, using the titlebar
	// as the drag handle.
	this.draggable(root.querySelector('.ic-titlebar'));

	// Default centered position, may be overridden by saved preferences in
	// onAppend() below.
	this._host.style.top = Math.max(0, (Renderer.height - WINDOW_HEIGHT) / 2) + 'px';
	this._host.style.left = Math.max(0, (Renderer.width - WINDOW_WIDTH) / 2) + 'px';

	renderAll();
};

/**
 * Restore saved window position once appended to the DOM.
 */
IdleConfig.onAppend = function onAppend() {
	if (_preferences.x != null && _preferences.y != null) {
		this._host.style.top = Math.min(Math.max(0, _preferences.y), Renderer.height - WINDOW_HEIGHT) + 'px';
		this._host.style.left = Math.min(Math.max(0, _preferences.x), Renderer.width - WINDOW_WIDTH) + 'px';
	}
};

/**
 * Save window position when the component is removed (defensive — in
 * practice this floating icon stays appended for the whole map session).
 */
IdleConfig.onRemove = function onRemove() {
	savePosition();
};

function savePosition() {
	_preferences.x = parseInt(IdleConfig._host.style.left, 10) || 0;
	_preferences.y = parseInt(IdleConfig._host.style.top, 10) || 0;
	_preferences.save();
}

/**
 * Show/hide the window (button stays visible either way).
 */
IdleConfig.toggle = function toggle() {
	const root = _root();
	const win = root.querySelector('.ic-window');
	if (win.classList.contains('is-open')) {
		closeWindow();
	} else {
		win.classList.add('is-open');
		IdleConfig.focus();
		requestConfig();
	}
};

function closeWindow() {
	const root = _root();
	root.querySelector('.ic-window').classList.remove('is-open');
	savePosition();
}

function onClickButton(e) {
	e.stopImmediatePropagation();
	IdleConfig.toggle();
}

function onClickClose(e) {
	e.stopImmediatePropagation();
	closeWindow();
}

function onClickTab(e) {
	e.stopImmediatePropagation();
	IdleConfig.activeTab = abaCanonica(e.currentTarget.dataset.tab);
	lembrarAba(_preferences, IdleConfig.activeTab);
	renderTabs();
	renderBody();
}

function onClickApply(e) {
	e.stopImmediatePropagation();
	applyConfig();
}

/**
 * RAGIDLE: em CIDADE nao ha caca (D-246) e o botao AVISA isso (D-355). Mas
 * a cidade NAO tranca a janela (D-359, ordem do dono em 18/08 a noite): a
 * config e exatamente o que se ajusta NA cidade, antes de viajar. Fica o
 * aviso (classe + hover + nota), sai a trava. O sinal vem de
 * contexto.ehCidade (mapa sem populacao de mobs).
 */
function aplicarEstadoDeCidade() {
	const ehCidade = !!(IdleConfig.contexto && IdleConfig.contexto.ehCidade);
	const btn = _root().querySelector('.ic-button');
	if (!btn) {
		return;
	}
	btn.disabled = false;
	btn.classList.toggle('ic-button-cidade', ehCidade);
	btn.title = ehCidade
		? 'Voce esta na cidade — de para editar a configuracao; a caca comeca quando viajar.'
		: 'Configuracao idle';
}

/**
 * RAGIDLE: pergunta o contexto SEM abrir a janela, so para saber se este
 * mapa e cidade e ajustar o botao. Chamado ao entrar no mapa.
 */
IdleConfig.sondarMapa = function sondarMapa() {
	// A sondagem so acontece na TROCA DE MAPA, entao o contexto na mao passa a
	// descrever o mapa anterior a partir daqui — ate a resposta chegar.
	IdleConfig.contextoObsoleto = true;
	Network.sendPacket(new PACKET.CZ.RAGIDLE_PEDIR_CONFIG());
};

function requestConfig() {
	setStatus(IdleConfig.serverConfig ? 'Atualizando configuração...' : 'Carregando configuração...');
	Network.sendPacket(new PACKET.CZ.RAGIDLE_PEDIR_CONFIG());
}

/**
 * Send the edited draft to the server for transactional validation.
 * CZ_RAGIDLE_APLICAR_CONFIG — opcode 0x0ff5, variable, JSON UTF-8 payload
 * (just the "config" object, per contract).
 */
function enviarConfig(config) {
	setStatus('Aplicando...');
	IdleConfig.problemas = [];
	renderProblemas();

	const pkt = new PACKET.CZ.RAGIDLE_APLICAR_CONFIG();
	pkt.json = JSON.stringify(config);
	Network.sendPacket(pkt);
}

function applyConfig() {
	if (!IdleConfig.editConfig) {
		return;
	}
	enviarConfig(IdleConfig.editConfig);
}

/**
 * O BOTAO "Auto" DA BARRA DE ACOES — e ele manda SO o campo dele.
 *
 * O rascunho sobrevive ao fechar da janela, entao um clique num botao da
 * barra de acoes que serializasse o rascunho inteiro enviaria edicoes que o
 * jogador nunca apertou "Aplicar" para enviar — e, se qualquer uma fosse
 * invalida, o servidor recusaria TRANSACIONALMENTE: nada muda, nem o
 * `cacaAutomatica` que o jogador acabou de pedir (o caso medido: apenas-skills
 * com rotacao vazia deixava o Auto morto, com a causa numa janela fechada).
 *
 * O pedido sai do `serverConfig` — o ultimo estado que o servidor ACEITOU —,
 * com um campo trocado. E `editConfig` nao e tocado: o rascunho e do jogador.
 */
function alternarCacaAutomatica() {
	if (!IdleConfig.serverConfig) {
		// Config ainda nao chegou: nao ha estado conhecido para inverter.
		requestConfig();
		return;
	}
	enviarConfig(
		Object.assign(cloneConfig(IdleConfig.serverConfig), {
			cacaAutomatica: !IdleConfig.serverConfig.cacaAutomatica
		})
	);
}

function setStatus(text) {
	const root = _root();
	const el = root.querySelector('.ic-status');
	if (el) {
		el.textContent = text || '';
	}
}

/**
 * ZC_RAGIDLE_CONFIG — opcode 0x0ff4, variable size, JSON UTF-8 payload.
 *
 * This single opcode answers both CZ_RAGIDLE_PEDIR_CONFIG and
 * CZ_RAGIDLE_APLICAR_CONFIG. The contract tells them apart with "aplicado":
 * present (true) only on an apply response, absent on a pedir response.
 */
function onConfigReceived(pkt) {
	let data;
	try {
		data = JSON.parse(pkt.json);
	} catch (e) {
		console.error('[IdleConfig] Falha ao interpretar a configuração recebida:', e, pkt.json);
		setStatus('Configuração incompatível.');
		return;
	}

	if (!data || data.v !== 1 || !data.config || !data.contexto) {
		console.error('[IdleConfig] Configuração com contrato incompatível (v=' + (data && data.v) + ').', data);
		setStatus('Configuração incompatível.');
		return;
	}

	const isApplyResponse = Object.prototype.hasOwnProperty.call(data, 'aplicado');
	const rejected = isApplyResponse && Array.isArray(data.problemas) && data.problemas.length > 0;

	IdleConfig.contexto = data.contexto;
	IdleConfig.contextoObsoleto = false;
	aplicarEstadoDeCidade();
	IdleConfig.problemas = rejected ? data.problemas : [];

	if (!rejected) {
		// Either the initial "pedir" answer, or a successful "aplicar":
		// adopt the server's config as the new baseline AND the new draft.
		IdleConfig.serverConfig = data.config;
		IdleConfig.editConfig = cloneConfig(data.config);
		garantirCura(IdleConfig.editConfig);
		IdleConfig.dirty = false;
		// Em cidade o aviso mora AQUI (D-359): a janela edita normalmente e o
		// rodape lembra que a caca so comeca fora da cidade.
		setStatus(
			isApplyResponse
				? 'Aplicado.'
				: data.contexto.ehCidade
					? 'Voce esta na cidade — a caca comeca quando voce viajar.'
					: ''
		);
	} else {
		// Transactional refusal (contract: "NÃO-vazio = recusado
		// transacionalmente (nada mudou)"). Deliberately do NOT touch
		// serverConfig/editConfig — the player's draft stays on screen so
		// they can see what they tried and fix it; IdleConfig.dirty is left
		// as-is so "Aplicar" stays enabled for a retry.
		setStatus('');

		/*
		 * COM A JANELA FECHADA, A RECUSA ERA MUDA (27/08/2026, auditoria).
		 * `renderProblemas()` escreve dentro da janela; fechada, o texto vai
		 * para um DOM que ninguem ve — o botao "Auto" da barra de acoes ficava
		 * "sem fazer nada". Aqui a recusa vai para o chat.
		 */
		const janela = _root().querySelector('.ic-window');
		if (!janela || !janela.classList.contains('is-open')) {
			ChatBox.addText(
				'Config idle recusada: ' + IdleConfig.problemas.join('; '),
				ChatBox.TYPE.ERROR,
				ChatBox.FILTER.PUBLIC_LOG
			);
		}
	}

	renderAll();
}

/**
 * Tudo que depende do estado: trilho (ativa + resumos), faixa-mestre, secao,
 * problemas e rodape.
 */
function renderAll() {
	renderTabs();
	renderMaster();
	renderBody();
	renderProblemas();
	updateFooter();
}

/**
 * O trilho: os 5 botoes ja existem no HTML; aqui se acende o ativo e se
 * escreve o RESUMO de cada secao (o estado inteiro do automato, sem trocar de
 * secao).
 */
function renderTabs() {
	const root = _root();
	root.querySelectorAll('.ic-tab').forEach(btn => {
		btn.classList.toggle('is-active', btn.dataset.tab === IdleConfig.activeTab);
	});
	root.querySelectorAll('[data-resumo]').forEach(el => {
		el.textContent = resumoDaSecao(el.dataset.resumo, IdleConfig.editConfig, IdleConfig.contexto);
	});
}

/**
 * A FAIXA DO INTERRUPTOR-MESTRE: "Caca automatica" sempre a vista, com o mapa.
 * Renderizada do JS (e nao do HTML estatico) de proposito — o portao
 * servidor/idle/controle-na-tela.test.ts le ESTE arquivo procurando um
 * `data-bool` por campo booleano do topo da config.
 */
function renderMaster() {
	const root = _root();
	const el = root.querySelector('.ic-master');
	if (!el) {
		return;
	}
	const cfg = IdleConfig.editConfig;
	const ctx = IdleConfig.contexto;
	if (!cfg || !ctx) {
		el.innerHTML = '';
		return;
	}
	const ligada = !!cfg.cacaAutomatica;
	el.innerHTML = `
		<label class="ic-master-switch ic-switch-row">
			<span class="ic-switch ic-switch-lg">
				<input type="checkbox" data-bool="cacaAutomatica" ${ligada ? 'checked' : ''} />
				<span class="ic-switch-track"></span>
			</span>
			<span class="ic-switch-text">
				<span class="ic-master-label">Caça automática</span>
				<span class="ic-master-sub">${
					ligada
						? 'O personagem caça sozinho neste mapa.'
						: 'Parada — o personagem só se defende até você ligar.'
				}</span>
			</span>
		</label>
		<div class="ic-master-mapa" title="${escapeHtml(ctx.mapa || '')}">
			<span class="ic-master-mapa-label">${ctx.ehCidade ? 'Você está na cidade' : 'Você está em'}</span>
			<span class="ic-master-mapa-nome">${escapeHtml(ctx.rotuloDoMapa || ctx.mapa || '')}</span>
		</div>`;
	bindGenericControls(el);
}

/**
 * Enable/disable the "Aplicar" footer button based on IdleConfig.dirty, and
 * say how many fields changed.
 */
function updateFooter() {
	const root = _root();
	const btn = root.querySelector('.ic-apply');
	if (btn) {
		btn.disabled = !(IdleConfig.editConfig && IdleConfig.dirty);
	}
	const pendentes = root.querySelector('.ic-pendentes');
	if (pendentes) {
		const n = IdleConfig.dirty ? contarAlteracoes(IdleConfig.serverConfig, IdleConfig.editConfig) : 0;
		pendentes.textContent = n ? `${n} ${n === 1 ? 'alteração' : 'alterações'} sem aplicar` : '';
	}
}

/**
 * Recompute IdleConfig.dirty by comparing the draft to the last confirmed
 * server config, then refresh the trilho and footer.
 */
function markDirty() {
	IdleConfig.dirty = JSON.stringify(IdleConfig.editConfig) !== JSON.stringify(IdleConfig.serverConfig);
	renderTabs();
	updateFooter();
}

/**
 * Render the "problemas" list in the footer (red bullet list) — only
 * populated after a rejected "aplicar" (see onConfigReceived above).
 */
function renderProblemas() {
	const root = _root();
	const el = root.querySelector('.ic-problemas');
	if (!el) {
		return;
	}
	if (!IdleConfig.problemas || !IdleConfig.problemas.length) {
		el.innerHTML = '';
		return;
	}
	el.innerHTML =
		'<ul class="ic-problemas-list">' +
		IdleConfig.problemas.map(p => `<li>${escapeHtml(p)}</li>`).join('') +
		'</ul>';
}

/**
 * Render the active section into .ic-pane, then wire up its controls.
 */
function renderBody() {
	const root = _root();
	const pane = root.querySelector('.ic-pane');
	if (!pane) {
		return;
	}

	if (!IdleConfig.editConfig || !IdleConfig.contexto) {
		pane.innerHTML = '<div class="ic-empty">Abra a configuração idle para carregar.</div>';
		return;
	}
	garantirCura(IdleConfig.editConfig);

	switch (IdleConfig.activeTab) {
		case 'ataque':
			pane.innerHTML = renderAtaque();
			break;
		case 'suporte':
			pane.innerHTML = renderSuporte();
			break;
		case 'sobrevivencia':
			pane.innerHTML = renderSobrevivencia();
			break;
		case 'consumiveis':
			pane.innerHTML = renderConsumiveis();
			break;
		case 'caca':
		default:
			pane.innerHTML = renderCaca();
			break;
	}

	bindGenericControls(pane);
	if (IdleConfig.activeTab === 'caca') {
		bindCacaExtra(pane);
	}
	if (IdleConfig.activeTab === 'ataque') {
		bindAtaqueExtra(pane);
	}
	if (IdleConfig.activeTab === 'suporte') {
		bindSuporteExtra(pane);
	}
	pane.scrollTop = 0;
}

/**
 * Wires the generic field kinds used across the sections:
 *   data-bool="path"    checkbox <-> boolean field, full re-render on
 *                        change (several fields gate other controls)
 *   data-select="path"  <select> <-> string/number field (numeric fields
 *                        also carry data-select-number)
 *   data-range="path"   <input type=range> <-> number field; 'input' only
 *                        patches the paired [data-range-display] text;
 *                        'change' runs onSliderSettled() then re-renders
 *   data-set="path" + data-valor="x"   um botao de controle SEGMENTADO
 *                        (So eu / Grupo): escreve o valor e re-renderiza
 */
function bindGenericControls(el) {
	el.querySelectorAll('[data-bool]').forEach(input => {
		input.addEventListener('change', () => {
			setPath(IdleConfig.editConfig, input.dataset.bool, input.checked);
			// D-536: ligar a poção automática tem que ESCOLHER a poção — o
			// <select> já mostrava a primeira da lista, mas o itemId no payload
			// continuava 0 e o servidor recusava.
			if (
				input.checked &&
				(input.dataset.bool === 'pocaoDeHp.ligado' || input.dataset.bool === 'pocaoDeSp.ligado')
			) {
				const campo = input.dataset.bool.split('.')[0];
				const pocao = IdleConfig.editConfig[campo];
				const disponiveis = pocoesDoEixo(
					IdleConfig.contexto && IdleConfig.contexto.consumiveisDeCura,
					campo === 'pocaoDeSp' ? 'curaSp' : 'curaHp'
				);
				pocao.itemId = escolherPocaoPadrao(disponiveis, pocao.itemId);
			}
			markDirty();
			renderMaster();
			renderBody();
		});
	});

	// D-342: 'Desligar o golpe básico' mapeia um booleano de UI para o ENUM
	// modoDeAtaque — por isso não cabe no data-bool genérico. MARCADO =
	// 'apenas-skills' (D-361).
	el.querySelectorAll('[data-modo-basico]').forEach(input => {
		input.addEventListener('change', () => {
			IdleConfig.editConfig.modoDeAtaque = input.checked ? 'apenas-skills' : 'skills-e-basico';
			markDirty();
		});
	});

	el.querySelectorAll('[data-select]').forEach(select => {
		select.addEventListener('change', () => {
			const value = select.dataset.selectNumber ? Number(select.value) : select.value;
			setPath(IdleConfig.editConfig, select.dataset.select, value);
			markDirty();
		});
	});

	el.querySelectorAll('input[type=range][data-range]').forEach(range => {
		const path = range.dataset.range;
		range.addEventListener('input', () => {
			setPath(IdleConfig.editConfig, path, Number(range.value));
			el.querySelectorAll(`[data-range-display="${path}"]`).forEach(disp => {
				disp.textContent = range.value + '%';
			});
			markDirty();
		});
		range.addEventListener('change', () => {
			onSliderSettled(path);
		});
	});

	el.querySelectorAll('[data-set]').forEach(btn => {
		btn.addEventListener('click', e => {
			e.stopImmediatePropagation();
			if (btn.disabled) {
				return;
			}
			setPath(IdleConfig.editConfig, btn.dataset.set, btn.dataset.valor);
			markDirty();
			renderBody();
		});
	});
}

/**
 * Cross-field slider validation (UI-side only — the server is the real
 * judge per contract). Keeps "levantar" thresholds strictly above the
 * matching "abaixo" threshold by nudging the levantar value.
 */
function onSliderSettled(path) {
	const cfg = IdleConfig.editConfig;
	const d = cfg.descanso;

	if (path === 'descanso.hpAbaixo' || path === 'descanso.levantarHp') {
		if (d.levantarHp <= d.hpAbaixo) {
			d.levantarHp = Math.min(100, d.hpAbaixo + 1);
		}
	}
	if (path === 'descanso.spAbaixo' || path === 'descanso.levantarSp') {
		if (d.levantarSp <= d.spAbaixo) {
			d.levantarSp = Math.min(100, d.spAbaixo + 1);
		}
	}

	markDirty();
	renderBody();
}

/* ─── Peças de markup compartilhadas ─────────────────────────────── */

function switchRow(path, checked, label, sub, disabled) {
	return `
		<label class="ic-switch-row">
			<span class="ic-switch">
				<input type="checkbox" data-bool="${path}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} />
				<span class="ic-switch-track"></span>
			</span>
			<span class="ic-switch-text">
				<span class="ic-switch-label">${label}</span>
				${sub ? `<span class="ic-switch-sub">${sub}</span>` : ''}
			</span>
		</label>`;
}

/**
 * O controle SEGMENTADO "Só eu / Grupo" (D-915). `path` é o campo do rascunho;
 * `podeGrupo` desliga o lado "Grupo" quando o buff é só de quem conjura.
 */
function segmentadoDeAlvo(path, atual, podeGrupo, titulo) {
	const eu = atual === 'eu';
	return `
		<div class="ic-seg" role="group" aria-label="${escapeHtml(titulo || 'Alvo')}">
			<button type="button" class="ic-seg-btn${eu ? ' is-selected' : ''}" data-set="${path}" data-valor="eu" title="Só em você">
				${RiIcones.usuario}<span>Só eu</span>
			</button>
			<button type="button" class="ic-seg-btn${!eu ? ' is-selected' : ''}" data-set="${path}" data-valor="grupo" ${podeGrupo ? '' : 'disabled'} title="${podeGrupo ? 'Em você e em cada membro do grupo no alcance' : 'Este efeito é só de quem conjura'}">
				${RiIcones.usuarios}<span>Grupo</span>
			</button>
		</div>`;
}

/**
 * O nome de EXIBIÇÃO de uma skill (D-359): o servidor manda `nome` (o PT do
 * cliente instalado) em cada lista; contrato antigo sem o campo cai no id.
 */
function nomeDaSkill(skillId) {
	const ctx = IdleConfig.contexto || {};
	const todas = [].concat(
		ctx.skillsAtivas || [],
		ctx.skillsPassivas || [],
		ctx.skillsDeBuff || [],
		ctx.skillsDeCura || []
	);
	const achada = todas.find(s => s.skillId === skillId);
	return (achada && achada.nome) || skillId;
}

/* ─── Seção: Caçada ──────────────────────────────────────────────── */

/*
 * Os tres interruptores do topo da config moram aqui e na faixa-mestre:
 * `cacaAutomatica` (faixa), `coletarItens` e `atacarTodosNaMissao` (D-691 —
 * este ultimo nasceu completo no servidor e sem controle na janela; o portao
 * servidor/idle/controle-na-tela.test.ts le este arquivo por `data-bool` para
 * isso nao acontecer de novo).
 */
function renderCaca() {
	const cfg = IdleConfig.editConfig;
	const ctx = IdleConfig.contexto;
	const mobs = ctx.mobsDoMapa || [];
	const fora = new Set(cfg.alvosDesabilitados || []);
	const marcadas = mobs.filter(m => !fora.has(m.mobId)).length;

	let presas;
	if (ctx.ehCidade) {
		presas =
			'<div class="ic-empty">Você está na cidade. As presas se escolhem num mapa de caça — viaje e volte aqui.</div>';
	} else if (!mobs.length) {
		presas = '<div class="ic-empty">Nenhum monstro conhecido neste mapa.</div>';
	} else {
		presas = `<div class="ic-presas">${mobs
			.map(
				m => `
			<label class="ic-presa${fora.has(m.mobId) ? ' is-off' : ''}" title="${escapeHtml(m.nome)}">
				<input type="checkbox" data-mob-toggle="${m.mobId}" ${fora.has(m.mobId) ? '' : 'checked'} />
				<span class="ic-presa-avatar"><img src="/ragidle/mobs/${m.mobId}.png" alt="" onerror="this.style.display='none'" /></span>
				<span class="ic-presa-nome">${escapeHtml(m.nome)}</span>
				<span class="ic-presa-check">${RiIcones.confere}</span>
			</label>`
			)
			.join('')}</div>`;
	}

	return `
		<div class="ic-card">
			<div class="ic-card-head">
				<h3>Presas neste mapa</h3>
				<span class="ic-card-meta">${mobs.length ? `${marcadas}/${mobs.length} marcadas` : ''}</span>
				<span class="ic-card-actions">
					<button type="button" class="ic-btn-mini" data-action="alvos-todos" ${mobs.length ? '' : 'disabled'}>Todas</button>
					<button type="button" class="ic-btn-mini" data-action="alvos-limpar" ${mobs.length ? '' : 'disabled'}>Nenhuma</button>
				</span>
			</div>
			<div class="ic-note">Só as presas marcadas são caçadas. A desmarcada continua agressiva: o personagem se defende dela, mas não vai atrás.</div>
			${presas}
		</div>
		<div class="ic-card">
			<h3>Durante a caça</h3>
			<label class="ic-checkbox-row">
				<input type="checkbox" data-bool="coletarItens" ${cfg.coletarItens ? 'checked' : ''} />
				<span>Recolher o que cai no chão</span>
			</label>
			<div class="ic-note">Experiência e zeny entram sempre; só os itens dependem disto.</div>
			<div class="ri-divisor"></div>
			<label class="ic-switch-row">
				<span class="ic-switch">
					<input type="checkbox" data-bool="atacarTodosNaMissao" ${cfg.atacarTodosNaMissao ? 'checked' : ''} />
					<span class="ic-switch-track"></span>
				</span>
				<span class="ic-switch-text">
					<span class="ic-switch-label">Atacar qualquer monstro durante missões</span>
					<span class="ic-switch-sub">Desligado, uma missão de caça foca só no alvo dela. Ligado, ataca o que aparecer enquanto a missão roda.</span>
				</span>
			</label>
		</div>`;
}

function bindCacaExtra(pane) {
	const ctx = IdleConfig.contexto;
	const mobIds = (ctx.mobsDoMapa || []).map(m => m.mobId);

	const todos = pane.querySelector('[data-action="alvos-todos"]');
	if (todos) {
		// "Todas" — clear this map's mobs from the negative list (leaves
		// entries for OTHER maps untouched).
		todos.addEventListener('click', () => {
			const cfg = IdleConfig.editConfig;
			cfg.alvosDesabilitados = (cfg.alvosDesabilitados || []).filter(id => !mobIds.includes(id));
			markDirty();
			renderBody();
		});
	}

	const limpar = pane.querySelector('[data-action="alvos-limpar"]');
	if (limpar) {
		// "Nenhuma" — disable every mob on this map (add to the negative
		// list, deduped via Set).
		limpar.addEventListener('click', () => {
			const cfg = IdleConfig.editConfig;
			const set = new Set(cfg.alvosDesabilitados || []);
			mobIds.forEach(id => set.add(id));
			cfg.alvosDesabilitados = Array.from(set);
			markDirty();
			renderBody();
		});
	}

	pane.querySelectorAll('[data-mob-toggle]').forEach(input => {
		input.addEventListener('change', () => {
			const mobId = Number(input.dataset.mobToggle);
			const cfg = IdleConfig.editConfig;
			const set = new Set(cfg.alvosDesabilitados || []);
			if (input.checked) {
				set.delete(mobId);
			} else {
				set.add(mobId);
			}
			cfg.alvosDesabilitados = Array.from(set);
			markDirty();
			renderBody();
		});
	});
}

/* ─── Seção: Ataque ──────────────────────────────────────────────── */

/**
 * Os TRES selos de passiva (D-399/D-405). Quem decide e o SERVIDOR: ele manda
 * `motivo` em `skillsPassivas`. A janela nao recalcula nada.
 */
const SELO_DE_PASSIVA = {
	'passiva-que-vale': {
		classe: 'ri-badge--verde',
		texto: 'vale sozinha',
		ajuda: 'Ela vale so de estar aprendida — muda numero na ficha.'
	},
	'sem-efeito-de-combate': {
		classe: 'ri-badge--cinza',
		texto: 'fora da luta',
		ajuda: 'O motor executa, mas o efeito e fora da luta (deslocamento, carga, pre-requisito).'
	},
	'nao-portada': {
		classe: 'ri-badge--ouro',
		texto: 'ainda não implementada',
		ajuda: 'O motor de combate ainda nao executa esta habilidade.'
	}
};

function renderAtaque() {
	const cfg = IdleConfig.editConfig;
	const ctx = IdleConfig.contexto;
	const ativas = ctx.skillsAtivas || [];
	const passivas = ctx.skillsPassivas || [];
	const rotacao = cfg.rotacao || [];
	const curas = new Set((ctx.skillsDeCura || []).map(s => s.skillId));

	let ordem;
	if (!ativas.length) {
		ordem = '<div class="ic-empty">Este personagem ainda não aprendeu nenhum golpe que o motor execute.</div>';
	} else {
		const linhas = rotacao.length
			? rotacao
					.map(
						(r, i) => `
			<div class="ic-rot-row">
				<span class="ic-rot-num">${i + 1}</span>
				<span class="ic-rot-main">
					<span class="ic-rot-name" title="${escapeHtml(r.skillId)}">${escapeHtml(nomeDaSkill(r.skillId))}</span>
					<span class="ic-rot-tags">
						<span class="ri-badge ri-badge--azul">Nv ${r.nivelDeUso}</span>
						${curas.has(r.skillId) ? '<span class="ri-badge ri-badge--verde" title="O limiar e o alvo desta cura se ajustam na seção Suporte">cura · ajuste em Suporte</span>' : ''}
					</span>
				</span>
				<span class="ic-rot-actions">
					<button type="button" class="ic-icon-btn" data-rot-action="up" data-rot-index="${i}" ${i === 0 ? 'disabled' : ''} title="Mover para cima">${RiIcones.setaCima}</button>
					<button type="button" class="ic-icon-btn" data-rot-action="down" data-rot-index="${i}" ${i === rotacao.length - 1 ? 'disabled' : ''} title="Mover para baixo">${RiIcones.setaBaixo}</button>
					<button type="button" class="ic-icon-btn ic-icon-btn--remover" data-rot-action="remove" data-rot-index="${i}" title="Tirar da ordem">${RiIcones.fechar}</button>
				</span>
			</div>`
					)
					.join('')
			: '<div class="ic-empty">Nenhum golpe na ordem — o personagem só dá o golpe básico.</div>';

		const usados = new Set(rotacao.map(r => r.skillId));
		const livres = ativas.filter(s => !usados.has(s.skillId));

		let adicionar;
		if (rotacao.length >= TETO_DA_ORDEM) {
			adicionar = '<div class="ic-note">As três vagas estão ocupadas. Tire um golpe para pôr outro.</div>';
		} else if (!livres.length) {
			adicionar = '<div class="ic-note">Todos os golpes disponíveis já estão na ordem.</div>';
		} else {
			adicionar = `
				<select class="ic-add-skill" data-action="skill-add">
					<option value="">+ Pôr um golpe na ordem</option>
					${livres
						.map(
							s =>
								`<option value="${escapeHtml(s.skillId)}">${escapeHtml(s.nome || s.skillId)} (Nv ${s.aprendido})</option>`
						)
						.join('')}
				</select>`;
		}

		ordem = `<div class="ic-rot-list">${linhas}</div>${adicionar}`;
	}

	const passivasHtml = passivas.length
		? passivas
				.map(s => {
					const selo = SELO_DE_PASSIVA[s.motivo] || SELO_DE_PASSIVA['passiva-que-vale'];
					const ajuda = s.motivo === 'nao-portada' && s.explicacao ? s.explicacao : selo.ajuda;
					return `
			<div class="ic-passiva-row">
				<span title="${escapeHtml(s.skillId)}">${escapeHtml(s.nome || s.skillId)} <span class="ic-passiva-nv">Nv ${s.aprendido}</span></span>
				<span class="ri-badge ${selo.classe}" title="${escapeHtml(ajuda)}">${selo.texto}</span>
			</div>`;
				})
				.join('')
		: '<div class="ic-empty">Nenhuma passiva aprendida.</div>';

	const podeDesligarBasico = !!(ctx.capacidades && ctx.capacidades.suprimirAtaqueBasico);
	const semGolpe = cfg.modoDeAtaque !== 'apenas-skills' && !rotacao.length;

	return `
		<div class="ic-card">
			<div class="ic-card-head">
				<h3>Ordem de golpes</h3>
				<span class="ic-card-meta">${rotacao.length}/${TETO_DA_ORDEM} vagas</span>
			</div>
			<div class="ic-note">O personagem tenta o primeiro que puder usar e vai rodando a lista; sem nenhum, dá o golpe básico.</div>
			${ordem}
		</div>
		<div class="ic-card">
			<h3>Golpe básico</h3>
			<label class="ic-checkbox-row">
				<input type="checkbox" data-modo-basico ${cfg.modoDeAtaque === 'apenas-skills' ? 'checked' : ''} ${!podeDesligarBasico || semGolpe ? 'disabled' : ''} />
				<span>Nunca dar o golpe básico — só habilidades</span>
			</label>
			<div class="ic-note">Marcado, o personagem conjura à distância e espera o SP voltar em vez de bater. Desmarcado, bate quando nenhuma habilidade estiver disponível.</div>
			${!podeDesligarBasico ? '<div class="ic-note ic-note-warn">Este servidor não sabe lutar sem o golpe básico.</div>' : ''}
			${podeDesligarBasico && semGolpe ? '<div class="ic-note ic-note-warn">Ponha ao menos um golpe na ordem para poder desligar o básico — sem ele o personagem ficaria sem ataque nenhum, e o servidor recusa.</div>' : ''}
		</div>
		<div class="ic-card">
			<h3>Passivas</h3>
			<div class="ic-note">Valem só de estarem aprendidas — não entram em ordem nenhuma.</div>
			<div class="ic-passivas">${passivasHtml}</div>
		</div>`;
}

function bindAtaqueExtra(pane) {
	pane.querySelectorAll('[data-rot-action]').forEach(btn => {
		btn.addEventListener('click', () => {
			const idx = Number(btn.dataset.rotIndex);
			const action = btn.dataset.rotAction;
			const rot = IdleConfig.editConfig.rotacao;

			if (action === 'remove') {
				rot.splice(idx, 1);
			} else if (action === 'up' && idx > 0) {
				[rot[idx - 1], rot[idx]] = [rot[idx], rot[idx - 1]];
			} else if (action === 'down' && idx < rot.length - 1) {
				[rot[idx + 1], rot[idx]] = [rot[idx], rot[idx + 1]];
			}
			markDirty();
			renderBody();
		});
	});

	const addSelect = pane.querySelector('[data-action="skill-add"]');
	if (addSelect) {
		addSelect.addEventListener('change', () => {
			const skillId = addSelect.value;
			if (!skillId) {
				return;
			}
			const cfg = IdleConfig.editConfig;
			const skill = (IdleConfig.contexto.skillsAtivas || []).find(s => s.skillId === skillId);
			if (skill && cfg.rotacao.length < 3) {
				cfg.rotacao.push({ skillId: skill.skillId, nivelDeUso: skill.aprendido });
				markDirty();
				renderBody();
			}
		});
	}
}

/* ─── Seção: Suporte ─────────────────────────────────────────────── */

/**
 * A secao NOVA (D-915): os buffs mantidos, cada um com o alvo ("So eu" /
 * "Grupo"), e a cura com limiar e alvo. Quem diz se um buff ALCANCA o grupo e
 * o servidor (`alcancaGrupo` em `skillsDeBuff`): Bencao e Agilidade sim,
 * Vigor e Concentracao nao — e para esses o segmentado nem aparece.
 */
function renderSuporte() {
	const ctx = IdleConfig.contexto;
	const serve = !(ctx.capacidades && ctx.capacidades.suporteAoGrupo === false);
	const grupo = ctx.grupo || { emGrupo: false, membros: 0 };

	const banner = grupo.emGrupo
		? `<div class="ic-grupo is-on">${RiIcones.usuarios}<span><strong>Você está num grupo de ${grupo.membros}.</strong> O que estiver marcado "Grupo" vale para cada membro que estiver no alcance e lutando.</span></div>`
		: `<div class="ic-grupo">${RiIcones.usuarios}<span><strong>Você não está em grupo.</strong> O que marcar "Grupo" passa a valer quando entrar num — até lá, só em você.</span></div>`;

	return `
		${!serve ? '<div class="ic-note ic-note-warn">Este servidor ainda não cruza cura e buffs para o grupo — as escolhas abaixo ficam guardadas para quando cruzar.</div>' : ''}
		${banner}
		${renderBuffsMantidos()}
		${renderCura()}`;
}

function renderBuffsMantidos() {
	const cfg = IdleConfig.editConfig;
	const ctx = IdleConfig.contexto;
	const todas = ctx.skillsDeBuff || [];
	// D-363: só o MANTÍVEL entra. Suporte pontual (Desintoxicar) só aparece na nota.
	const disponiveis = todas.filter(s => s.mantivel !== false);
	const pontuais = todas.filter(s => s.mantivel === false);
	// D-917: o MOTIVO vem do servidor. Os conjuntos do Bardo e da Odalisca
	// (Ode a Siegfried, Rufar dos Tambores, Banquete de Njord) são buffs de
	// verdade, mas exigem o parceiro no GRUPO e a uma célula (D-1004). Sem o
	// par no grupo o servidor os manda como não mantíveis, com este motivo;
	// com o par, eles entram na lista como qualquer buff. Listar e dizer por
	// quê é o que evita o jogador procurá-los na ordem de golpes.
	const semParceiro = pontuais.filter(s => s.motivo === 'precisa-de-parceiro');
	const outrosPontuais = pontuais.filter(s => s.motivo !== 'precisa-de-parceiro');
	const nomesDe = lista => lista.map(s => escapeHtml(s.nome || s.skillId)).join(', ');
	const notaPontual =
		(semParceiro.length
			? `<div class="ic-note ic-note--parceiro">Precisam de um parceiro Bardo ou Odalisca no seu grupo, ao seu lado na luta, que saiba a mesma habilidade: ${nomesDe(semParceiro)}.</div>`
			: '') +
		(outrosPontuais.length
			? `<div class="ic-note">Suporte pontual (não se mantém de pé): ${nomesDe(outrosPontuais)}.</div>`
			: '');

	if (!disponiveis.length) {
		return `
		<div class="ic-card">
			<h3>Buffs mantidos</h3>
			<div class="ic-empty">Nenhum buff que dê para manter de pé. Têm: Espadachim (Vigor), Arqueiro (Concentração), Noviço (Bênção, Agilidade, Angelus, Pneuma), Mago (Barreira Mágica), Sacerdote (Kyrie, Magnificat, Glória, Santuário), Sábio (Vulcão, Dilúvio, Furacão), Bardo (as canções)...</div>
			${notaPontual}
		</div>`;
	}

	const lista = cfg.rotacaoDeBuffs || (cfg.rotacaoDeBuffs = []);
	const infoDe = id => disponiveis.find(s => s.skillId === id);

	const linhas = lista.length
		? lista
				.map((b, i) => {
					const info = infoDe(b.skillId);
					const alcanca = !!(info && info.alcancaGrupo);
					const alvo = alvoDoBuff(b);
					return `
			<div class="ic-buff-row">
				<span class="ic-rot-num">${i + 1}</span>
				<span class="ic-rot-main">
					<span class="ic-rot-name" title="${escapeHtml(b.skillId)}">${escapeHtml(nomeDaSkill(b.skillId))}</span>
					<span class="ic-rot-tags">
						<span class="ri-badge ri-badge--azul">Nv ${b.nivelDeUso}</span>
						${info ? `<span class="ri-badge ri-badge--cinza ic-badge-relogio" title="Renovado assim que cair">${RiIcones.relogio}${duracaoCurta(info.duracaoMs)}</span>` : ''}
						${info ? `<span class="ri-badge ri-badge--cinza">${info.custoSp} SP</span>` : ''}
					</span>
				</span>
				${
					alcanca
						? segmentadoDeAlvo(`rotacaoDeBuffs.${i}.alvo`, alvo, true, `Alvo de ${nomeDaSkill(b.skillId)}`)
						: '<span class="ic-so-eu" title="Este buff é só de quem conjura">só em você</span>'
				}
				<span class="ic-rot-actions">
					<button type="button" class="ic-icon-btn ic-icon-btn--remover" data-buff-action="remove" data-buff-index="${i}" title="Deixar de manter">${RiIcones.fechar}</button>
				</span>
			</div>`;
				})
				.join('')
		: '<div class="ic-empty">Nenhum buff sendo mantido.</div>';

	const usados = new Set(lista.map(b => b.skillId));
	const livres = disponiveis.filter(s => !usados.has(s.skillId));
	let adicionar = '';
	if (lista.length >= TETO_DE_BUFFS) {
		adicionar = '<div class="ic-note">As seis vagas de buff estão ocupadas.</div>';
	} else if (livres.length) {
		adicionar = `
			<select class="ic-add-skill" data-action="buff-add">
				<option value="">+ Manter um buff de pé</option>
				${livres
					.map(
						s =>
							`<option value="${escapeHtml(s.skillId)}">${escapeHtml(s.nome || s.skillId)} (Nv ${s.aprendido} · ${duracaoCurta(s.duracaoMs)} · ${s.custoSp} SP${s.alcancaGrupo ? ' · alcança o grupo' : ''})</option>`
					)
					.join('')}
			</select>`;
	}

	return `
		<div class="ic-card">
			<div class="ic-card-head">
				<h3>Buffs mantidos</h3>
				<span class="ic-card-meta">${lista.length}/${TETO_DE_BUFFS} vagas</span>
			</div>
			<div class="ic-note">Conjurados antes do primeiro golpe e renovados assim que caem — em você e, no que estiver marcado "Grupo", em cada membro que ficar sem.</div>
			<div class="ic-rot-list">${linhas}</div>
			${adicionar}
			${notaPontual}
		</div>`;
}

function renderCura() {
	const cfg = IdleConfig.editConfig;
	const ctx = IdleConfig.contexto;
	const curas = ctx.skillsDeCura || [];
	const cura = garantirCura(cfg);

	if (!curas.length) {
		return `
		<div class="ic-card">
			<h3>Cura</h3>
			<div class="ic-empty">Este personagem não aprendeu habilidade de cura (Curar do Acólito, Primeiros Socorros do Aprendiz).</div>
		</div>`;
	}

	const naRotacao = curaNaRotacao(cfg, ctx);
	const ligada = !!naRotacao;
	const habilidade = naRotacao ? curas.find(c => c.skillId === naRotacao.skillId) || curas[0] : curas[0];
	const semVaga = !ligada && (cfg.rotacao || []).length >= TETO_DA_ORDEM;
	const alcanca = !!(habilidade && habilidade.alcancaGrupo);

	return `
		<div class="ic-card">
			<div class="ic-card-head">
				<h3>Cura</h3>
				<span class="ic-card-meta">${escapeHtml(habilidade.nome || habilidade.skillId)} · Nv ${habilidade.aprendido} · ${habilidade.custoSp} SP</span>
			</div>
			<label class="ic-switch-row">
				<span class="ic-switch">
					<input type="checkbox" data-action="cura-toggle" ${ligada ? 'checked' : ''} ${semVaga ? 'disabled' : ''} />
					<span class="ic-switch-track"></span>
				</span>
				<span class="ic-switch-text">
					<span class="ic-switch-label">Curar automaticamente</span>
					<span class="ic-switch-sub">${ligada ? 'Ocupa a primeira vaga da ordem de golpes.' : 'Entra na primeira vaga da ordem de golpes.'}</span>
				</span>
			</label>
			${semVaga ? '<div class="ic-note ic-note-warn">As três vagas da ordem de golpes estão ocupadas — tire um golpe na seção Ataque para ligar a cura.</div>' : ''}
			<div class="ic-subsection${ligada ? '' : ' ic-subsection-disabled'}">
				<div class="ic-field-row ic-field-row--seg">
					<span>Quem curar</span>
					${segmentadoDeAlvo('cura.alvo', cura.alvo, alcanca, 'Quem curar')}
				</div>
				<div class="ic-field-row">
					<span>Curar quem estiver abaixo de <span class="ic-inline-value" data-range-display="cura.curarAbaixoDe">${cura.curarAbaixoDe}%</span> de HP</span>
				</div>
				<input type="range" class="ic-slider" min="1" max="99" step="1" value="${cura.curarAbaixoDe}" data-range="cura.curarAbaixoDe" ${ligada ? '' : 'disabled'} />
				<div class="ic-note">${
					cura.alvo === 'grupo' && alcanca
						? 'No grupo, cura o mais ferido que estiver no alcance da habilidade — mesmo com a sua barra cheia. Fora do grupo, cura você.'
						: 'Cura você quando a barra cair abaixo do limiar.'
				}</div>
			</div>
		</div>`;
}

function bindSuporteExtra(pane) {
	pane.querySelectorAll('[data-buff-action]').forEach(btn => {
		btn.addEventListener('click', () => {
			const idx = Number(btn.dataset.buffIndex);
			const lista = IdleConfig.editConfig.rotacaoDeBuffs || [];
			if (btn.dataset.buffAction === 'remove') {
				lista.splice(idx, 1);
			}
			markDirty();
			renderBody();
		});
	});

	const addBuff = pane.querySelector('[data-action="buff-add"]');
	if (addBuff) {
		addBuff.addEventListener('change', () => {
			const skillId = addBuff.value;
			if (!skillId) {
				return;
			}
			const cfg = IdleConfig.editConfig;
			if (!cfg.rotacaoDeBuffs) {
				cfg.rotacaoDeBuffs = [];
			}
			const buff = (IdleConfig.contexto.skillsDeBuff || []).find(s => s.skillId === skillId);
			if (buff && cfg.rotacaoDeBuffs.length < TETO_DE_BUFFS) {
				// O alvo nasce EXPLÍCITO: grupo quando alcança (o padrão de P2),
				// eu quando é só de quem conjura — assim o payload diz o que a
				// tela mostra, sem depender do padrão do servidor.
				cfg.rotacaoDeBuffs.push({
					skillId: buff.skillId,
					nivelDeUso: buff.aprendido,
					alvo: buff.alcancaGrupo ? 'grupo' : 'eu'
				});
				markDirty();
				renderBody();
			}
		});
	}

	const curaToggle = pane.querySelector('[data-action="cura-toggle"]');
	if (curaToggle) {
		curaToggle.addEventListener('change', () => {
			const cfg = IdleConfig.editConfig;
			const nova = alternarCura(cfg, IdleConfig.contexto, curaToggle.checked);
			if (nova === null) {
				// Sem vaga ou sem habilidade: a tela já explica; o rascunho não muda.
				renderBody();
				return;
			}
			cfg.rotacao = nova;
			markDirty();
			renderBody();
		});
	}
}

/* ─── Seção: Sobrevivência ───────────────────────────────────────── */

function renderSobrevivencia() {
	const cfg = IdleConfig.editConfig;
	const ctx = IdleConfig.contexto;
	const d = cfg.descanso;
	const canSentar = !!(ctx.capacidades && ctx.capacidades.sentarParaRecuperar);
	const canSp = !!(ctx.capacidades && ctx.capacidades.pocaoDeSp);

	return `
		<div class="ic-card">
			<div class="ic-card-head">
				<h3>Descanso</h3>
			</div>
			${!canSentar ? '<div class="ic-note ic-note-warn">Sentar para recuperar não está disponível neste personagem/mapa.</div>' : ''}
			${switchRow('descanso.ligado', d.ligado, 'Sentar para recuperar', 'A caça pausa depois da luta em curso; um monstro agressivo interrompe o descanso para a autodefesa.', !canSentar)}

			<div class="ic-subsection${d.ligado ? '' : ' ic-subsection-disabled'}">
				<div class="ic-duas">
					<div class="ic-eixo">
						<div class="ic-subtitle">Sentar quando</div>
						<label class="ic-checkbox-row">
							<input type="checkbox" data-bool="descanso.hpLigado" ${d.hpLigado ? 'checked' : ''} ${d.ligado ? '' : 'disabled'} />
							<span>HP abaixo de <span class="ic-inline-value" data-range-display="descanso.hpAbaixo">${d.hpAbaixo}%</span></span>
						</label>
						<input type="range" class="ic-slider ic-slider--hp" min="1" max="99" step="1" value="${d.hpAbaixo}" data-range="descanso.hpAbaixo" ${d.ligado && d.hpLigado ? '' : 'disabled'} />
						<label class="ic-checkbox-row">
							<input type="checkbox" data-bool="descanso.spLigado" ${d.spLigado ? 'checked' : ''} ${d.ligado ? '' : 'disabled'} />
							<span>SP abaixo de <span class="ic-inline-value" data-range-display="descanso.spAbaixo">${d.spAbaixo}%</span></span>
						</label>
						<input type="range" class="ic-slider ic-slider--sp" min="1" max="99" step="1" value="${d.spAbaixo}" data-range="descanso.spAbaixo" ${d.ligado && d.spLigado ? '' : 'disabled'} />
						<div class="ic-field-row"><span>Com os dois marcados</span></div>
						<select class="ic-select" data-select="descanso.condicao" ${d.ligado && d.hpLigado && d.spLigado ? '' : 'disabled'}>
							<option value="qualquer" ${d.condicao === 'qualquer' ? 'selected' : ''}>basta um deles cair</option>
							<option value="ambas" ${d.condicao === 'ambas' ? 'selected' : ''}>só quando os dois caírem</option>
						</select>
					</div>
					<div class="ic-eixo">
						<div class="ic-subtitle">Levantar quando</div>
						<div class="ic-field-row"><span>HP em <span class="ic-inline-value" data-range-display="descanso.levantarHp">${d.levantarHp}%</span></span></div>
						<input type="range" class="ic-slider ic-slider--hp" min="1" max="100" step="1" value="${d.levantarHp}" data-range="descanso.levantarHp" ${d.ligado ? '' : 'disabled'} />
						<div class="ic-field-row"><span>SP em <span class="ic-inline-value" data-range-display="descanso.levantarSp">${d.levantarSp}%</span></span></div>
						<input type="range" class="ic-slider ic-slider--sp" min="1" max="100" step="1" value="${d.levantarSp}" data-range="descanso.levantarSp" ${d.ligado ? '' : 'disabled'} />
						<div class="ic-note">Levantar sempre acima de sentar — senão ele senta e levanta no mesmo instante.</div>
					</div>
				</div>
			</div>
		</div>

		<div class="ic-card">
			<h3>Poções</h3>
			<div class="ic-note">Bebidas entre as lutas, do inventário. Escolha o frasco e com quanto de barra beber.</div>
			<div class="ic-duas">
				${renderPocao('pocaoDeHp', cfg.pocaoDeHp, ctx.consumiveisDeCura, true, 'HP')}
				${renderPocao('pocaoDeSp', cfg.pocaoDeSp, ctx.consumiveisDeCura, canSp, 'SP')}
			</div>
			${!canSp ? '<div class="ic-note ic-note-warn">Recuperação automática de SP não está disponível.</div>' : ''}
		</div>`;
}

function renderPocao(fieldName, pocao, itens, enabled, label) {
	const campoDoEixo = fieldName === 'pocaoDeSp' ? 'curaSp' : 'curaHp';
	const disponiveis = pocoesDoEixo(itens, campoDoEixo);
	const temPocao = disponiveis.length > 0;
	// O interruptor só liga se houver o que beber — e a escolha mostrada é a
	// mesma que vai no payload (escolherPocaoPadrao roda no toggle).
	const ligavel = enabled && temPocao;
	const selecionado = escolherPocaoPadrao(disponiveis, pocao.itemId);

	const options = disponiveis
		.map(
			it =>
				`<option value="${it.itemId}" ${selecionado === it.itemId ? 'selected' : ''}>${escapeHtml(it.nome)} — ${it.estoque} no inventário</option>`
		)
		.join('');

	return `
		<div class="ic-eixo ic-pocao${ligavel ? '' : ' ic-subsection-disabled'}">
			${switchRow(`${fieldName}.ligado`, pocao.ligado, `Poção de ${label}`, '', !ligavel)}
			<select class="ic-select" data-select="${fieldName}.itemId" data-select-number="1" ${ligavel && pocao.ligado ? '' : 'disabled'}>
				${options}
			</select>
			${!temPocao && enabled ? `<div class="ic-note ic-note-warn">Nenhum frasco que restaure ${label} no inventário.</div>` : ''}
			<div class="ic-field-row">
				<span>Beber com <span class="ic-inline-value" data-range-display="${fieldName}.usarCom">${pocao.usarCom}%</span> ou menos</span>
			</div>
			<input type="range" class="ic-slider ic-slider--${label.toLowerCase()}" min="1" max="99" step="1" value="${pocao.usarCom}" data-range="${fieldName}.usarCom" ${ligavel && pocao.ligado ? '' : 'disabled'} />
		</div>`;
}

/* ─── Seção: Consumíveis ─────────────────────────────────────────── */

function renderConsumiveis() {
	const cfg = IdleConfig.editConfig;
	const ctx = IdleConfig.contexto;
	const enabled = !!(ctx.capacidades && ctx.capacidades.buffsAutomaticos);

	return `
		<div class="ic-card">
			<h3>Buffs de item</h3>
			<label class="ic-switch-row">
				<span class="ic-switch">
					<input type="checkbox" data-bool="usarBuffsDeItem" ${cfg.usarBuffsDeItem ? 'checked' : ''} ${enabled ? '' : 'disabled'} />
					<span class="ic-switch-track"></span>
				</span>
				<span class="ic-switch-text">
					<span class="ic-switch-label">Beber os consumíveis de buff do inventário</span>
					<span class="ic-switch-sub">O personagem bebe sozinho o que houver, e só bebe de novo quando o efeito expira.</span>
				</span>
			</label>
			${
				enabled
					? '<div class="ic-note">Servidos hoje (D-360): as poções de ASPD — Concentração (645) e Despertar (656, nível 40+), à venda no Tool Dealer. O bônus entra na próxima luta e dura 30 min.</div>'
					: '<div class="ic-note ic-note-warn">Nenhum consumível de buff existe no jogo ainda — o interruptor guarda sua escolha para quando existir.</div>'
			}
		</div>
		<div class="ic-card ic-card--tip">
			<h3>Em breve</h3>
			<div class="ic-note">Escolher quais frascos beber e em que ordem.</div>
		</div>`;
}

Network.hookPacket(PACKET.ZC.RAGIDLE_CONFIG, onConfigReceived);

/**
 * Aliases publicos minimos pra outro componente RAGIDLE que so precisa
 * ler/gravar um campo pontual do config (ex.: o botao "Auto" do canto de
 * combate) sem duplicar o pedido/envio do pacote.
 */
IdleConfig.pedirConfig = requestConfig;
IdleConfig.aplicarConfig = applyConfig;

/**
 * ESQUECE O PERSONAGEM ANTERIOR (27/08/2026, auditoria C).
 *
 * Voltar ao menu de personagem NAO recarrega a pagina, entao todo estado de
 * MODULO atravessa a troca — e um clique no "Auto" mandaria a config de A
 * logado como B. Cada modulo sabe qual e o seu estado; a limpeza mora aqui.
 */
IdleConfig.limparEstadoDoPersonagem = function limparEstadoDoPersonagem() {
	IdleConfig.serverConfig = null;
	IdleConfig.editConfig = null;
	IdleConfig.contexto = null;
	IdleConfig.contextoObsoleto = false;
	IdleConfig.dirty = false;
	IdleConfig.problemas = [];
	/*
	 * ZERAR O DADO NAO BASTA: `GUIComponent.remove()` so DESANEXA o host,
	 * entao o shadow DOM (com `is-open` e o HTML do personagem anterior)
	 * atravessa a troca. Ver `UI/Components/limpezaDeJanelaIdle.js`.
	 */
	fecharEEsquecer(_root(), '.ic-window');
	const master = _root().querySelector('.ic-master');
	if (master) {
		master.innerHTML = '';
	}
	renderTabs();
	updateFooter();
};
IdleConfig.alternarCacaAutomatica = alternarCacaAutomatica;

/**
 * Abre a janela (reusando IdleConfig.toggle()) ja na secao pedida — pelo id
 * novo ('ataque') ou pelo antigo ('skills'), que `abaCanonica` traduz. E a
 * porta do medalhao de rotacao do canto de combate e dos slots do dock. Se a
 * janela ja estava aberta, so troca a secao e traz pra frente.
 */
IdleConfig.abrirNaAba = function abrirNaAba(tab) {
	const root = _root();
	const win = root.querySelector('.ic-window');
	const jaAberta = win.classList.contains('is-open');

	if (!jaAberta) {
		IdleConfig.toggle();
	}
	IdleConfig.focus();

	IdleConfig.activeTab = abaCanonica(tab);
	// Entrar pela porta do medalhao conta como estar na secao: o jogador vai
	// fechar a janela daqui, e "a ultima secao em que eu estava" e esta.
	lembrarAba(_preferences, IdleConfig.activeTab);
	renderTabs();
	renderBody();
};

/**
 * Create component and export it
 */
export default UIManager.addComponent(IdleConfig);
