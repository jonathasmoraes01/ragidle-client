/**
 * UI/Components/CombatCornerIdle/CombatCornerIdle.js
 *
 * "Combate" (canto inferior direito) do design system "Ragnarok Classico
 * Premium" (gauntlet 18/08/2026, ver redesign/extracao-da-referencia.md
 * secao 4.7). Dois botoes circulares acima do dock:
 *   - "Auto"    -> toggle de cacaAutomatica, MESMO caminho de estado que a
 *                  janela Config idle usa (IdleConfig.editConfig +
 *                  IdleConfig.aplicarConfig(), ver IdleConfig.js).
 *   - "Mochila" -> Inventory.getUI().toggle() (mesmo metodo que DockIdle.js
 *                  ja usa pro item "Inventario", DockIdle.js:166).
 * Regra dura do briefing: nada de botao de "Ataque" nem slots de skill - o
 * jogo de hoje nao tem acao manual de ataque por botao, entao nao existe
 * atalho equivalente pra criar aqui.
 *
 * O estado do "Auto":
 *   IdleConfig.editConfig / IdleConfig.serverConfig sao objetos plain-data
 *   que ja vivem na propria janela Config idle (IdleConfig.js:64-74) e sao
 *   lidos/gravados/enviados por duas funcoes internas la
 *   (requestConfig()/applyConfig(), IdleConfig.js:268-290 - pedem/mandam o
 *   MESMO pacote CZ_RAGIDLE_APLICAR_CONFIG que o botao "Aplicar" da janela
 *   ja usa). Essas duas funcoes nao eram exportadas, entao IdleConfig.js
 *   ganhou dois aliases publicos minimos no final do arquivo
 *   (IdleConfig.pedirConfig / IdleConfig.aplicarConfig) que apontam pras
 *   MESMAS funcoes - nenhuma logica nova, so tornar exportavel o que ja
 *   existia (e literalmente a instrucao do briefing: "mesma funcao se
 *   exportavel").
 *
 *   Ao clicar em "Auto":
 *     - se a config idle ainda nao foi carregada nesta sessao
 *       (IdleConfig.editConfig == null - o jogador nunca abriu a janela
 *       Config), o clique so dispara IdleConfig.pedirConfig() (mesma
 *       chamada que IdleConfig.toggle() faz ao abrir a janela pela primeira
 *       vez, IdleConfig.js:223-233) e fica esperando o proximo poll (abaixo)
 *       refletir quando a resposta do servidor chegar;
 *     - se ja esta carregada, inverte cacaAutomatica DENTRO do mesmo
 *       editConfig compartilhado com a janela e chama
 *       IdleConfig.aplicarConfig() - exatamente a mesma chamada que o botao
 *       "Aplicar" da janela dispara (IdleConfig.js:258-261/279-290).
 *   Consequencia aceita e documentada (nao e bug): como e o MESMO objeto de
 *   rascunho da janela, se o jogador tiver edicoes nao aplicadas em OUTRA
 *   aba da Config idle, elas viajam junto nesse envio - e o preco de nao
 *   duplicar um segundo estado paralelo pra so um campo.
 *
 *   O botao NUNCA guarda um bool local (regra explicita do briefing): a
 *   cada poll (mesma cadencia 250ms de BasicInfoIdle.js) ele releh
 *   IdleConfig.editConfig.cacaAutomatica e redesenha o aro - inclusive
 *   quando a resposta do servidor rejeita a config (ai o editConfig fica
 *   como foi enviado, ver IdleConfig.js:339-346) ou quando outra fonte muda
 *   esse mesmo campo (ex.: o jogador abriu a janela Config e mudou o switch
 *   de la).
 *
 * needFocus=false / :host pointer-events:none com filhos auto: mesmo
 * contrato de DockIdle.js/DockIdle.css - fica sempre abaixo de qualquer
 * janela (preso no z-index inicial 50, GUIComponent.js:159) e nunca
 * intercepta clique no mapa fora dos botoes.
 *
 * Rodada 2 (gauntlet 18/08/2026, ver redesign/extracao-da-referencia.md
 * secao 4.7): arco de ate 3 "medalhoes" acima dos botoes Auto/Mochila,
 * mostrando a ROTACAO DE SKILLS configurada. Fonte real: o mesmo
 * IdleConfig.editConfig ja lido acima pro botao Auto - o campo e
 * "editConfig.rotacao", um array de ate 3 { skillId, nivelDeUso } (ver
 * IdleConfig.js, funcao renderSkills() e bindSkillsExtra() - e o MESMO
 * array que a aba Skills da Config idle edita com os botoes up/down/x).
 * skillId e a string do constante de skill (ex.: "MG_FIREBOLT") - o icone
 * oficial fica em /ragidle/skills/<skillId>.png (mesmo caminho que
 * IdleSkills.js:560/637 ja usa pros cards de skill), com fallback de duas
 * letras quando o PNG nao existe em disco (skillInitials() abaixo, mesmo
 * criterio de IdleSkills.js:177-183 - duplicado aqui, nao importado, pelo
 * mesmo motivo que IdleSkills.js ja duplicou escapeHtml de IdleConfig.js:
 * a funcao de origem nao e exportada de la).
 *
 * So exibicao + 1 clique: qualquer medalhao chama IdleConfig.abrirNaAba
 * ('skills') - alias minimo acrescentado em IdleConfig.js que reusa
 * IdleConfig.toggle() (mesmo metodo do botao de engrenagem) e o MESMO
 * mecanismo de troca de aba que onClickTab() usa internamente ali dentro
 * (activeTab + renderTabs() + renderBody()). Nenhuma logica de jogo nova -
 * nenhum pacote sai daqui, e o array de rotacao so e lido, nunca escrito.
 *
 * Sem rotacao configurada (array vazio ou editConfig ainda nulo): nenhum
 * medalhao e desenhado - o container ".cc-rotacao" fica vazio e o CSS
 * (":empty") colapsa ele, sem sobrar respiro fantasma.
 *
 * @author RagIdle
 */

import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import IdleConfig from 'UI/Components/IdleConfig/IdleConfig.js';
import Inventory from 'UI/Components/Inventory/Inventory.js';
import RiIcones from 'UI/ri-icones.js';
import htmlText from './CombatCornerIdle.html?raw';
import cssText from './CombatCornerIdle.css?raw';

/**
 * Mesma cadencia de poll que BasicInfoIdle.js (POLL_INTERVAL_MS = 250) -
 * usada aqui so pra REFLETIR o estado real de IdleConfig.editConfig, nunca
 * pra gravar nada.
 */
const POLL_INTERVAL_MS = 250;

/**
 * Create Component
 */
const CombatCornerIdle = new GUIComponent('CombatCornerIdle', cssText);

/**
 * Troca cada marcador "<!--RI_ICONE:chave-->" do .html pela string SVG do
 * modulo de iconografia (UI/ri-icones.js) — mesmo padrao de DockIdle.js.
 * Os medalhoes de rotacao de skills (".cc-medalhao", montados por
 * syncRotacao() abaixo) NAO usam esse modulo — sao arte oficial do GRF
 * (icone de skill do proprio cliente), fora do escopo deste conserto.
 */
CombatCornerIdle.render = () => htmlText.replace(/<!--RI_ICONE:(\w+)-->/g, (_, chave) => RiIcones[chave] || '');

/**
 * Mesmo modo dos outros flutuantes RAGIDLE: scene click atravessa a UI
 * quando o mouse nao esta sobre um elemento clicavel de verdade.
 */
CombatCornerIdle.mouseMode = GUIComponent.MouseMode.CROSS;

/**
 * Fora do sistema de foco/z-index (mesmo motivo de DockIdle.js:76-90): os
 * dois botoes nunca precisam vir pra frente porque nao sao uma janela.
 */
CombatCornerIdle.needFocus = false;

/**
 * @var {number|null} setInterval handle do polling.
 */
let _pollTimer = null;

/**
 * Helper: query dentro do shadow root
 */
function _root() {
	return CombatCornerIdle._shadow || CombatCornerIdle._host;
}

/**
 * One-time setup (roda uma vez, durante GUIComponent#prepare()).
 */
CombatCornerIdle.init = function init() {
	const root = _root();
	root.querySelector('.cc-btn--auto').addEventListener('click', onClickAuto);
	root.querySelector('.cc-btn--bag').addEventListener('click', onClickBag);
};

/**
 * Carrega a config idle silenciosamente se ainda nao foi carregada nesta
 * sessao (o jogador pode nunca ter aberto a janela Config), sincroniza o
 * aro com o estado real e comeca o polling.
 */
CombatCornerIdle.onAppend = function onAppend() {
	if (!IdleConfig.editConfig) {
		IdleConfig.pedirConfig();
	}
	syncAll();
	startPolling();
};

/**
 * Para o polling quando o componente sai (troca de mapa - ver
 * UIManager.removeComponents(), Engine/MapEngine.js:902).
 */
CombatCornerIdle.onRemove = function onRemove() {
	stopPolling();
};

function startPolling() {
	stopPolling();
	_pollTimer = setInterval(syncAll, POLL_INTERVAL_MS);
}

function stopPolling() {
	if (_pollTimer != null) {
		clearInterval(_pollTimer);
		_pollTimer = null;
	}
}

/**
 * Um so tick de poll (cadencia POLL_INTERVAL_MS) pras duas pecas do canto -
 * o aro do "Auto" e o arco de medalhoes de rotacao. Nenhuma das duas guarda
 * estado local (regra do cabecalho): as duas releem IdleConfig.editConfig
 * do zero a cada chamada.
 */
function syncAll() {
	syncAutoState();
	syncRotacao();
}

/**
 * Releh IdleConfig.editConfig.cacaAutomatica (nunca um bool local, ver
 * cabecalho do arquivo) e aplica/remove ".is-on" no botao.
 */
function syncAutoState() {
	const root = _root();
	const btn = root.querySelector('.cc-btn--auto');
	if (!btn) {
		return;
	}
	const ligado = !!(IdleConfig.editConfig && IdleConfig.editConfig.cacaAutomatica);
	btn.classList.toggle('is-on', ligado);
}

/**
 * Escapa texto antes de injetar em innerHTML. Duplicado de IdleConfig.js
 * (funcao la nao e exportada) - mesmo motivo/mesmo padrao que IdleSkills.js
 * ja usou pra duplicar a dela.
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
 * "MF") pro fallback do medalhao quando o PNG da skill nao existe em disco.
 * Duplicado de IdleSkills.js (skillInitials(), tambem nao exportada de la -
 * mesmo criterio).
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
 * @var {string|null} JSON da ultima rotacao ja desenhada - evita reconstruir
 * o innerHTML (e reanexar listeners) a cada poll de 250ms quando nada mudou.
 */
let _lastRotacaoJson = null;

/**
 * Releh IdleConfig.editConfig.rotacao e redesenha o arco de medalhoes so
 * quando o array mudou desde o ultimo poll (aplicado pela propria janela
 * Config, ou por uma resposta do servidor que a rejeitou/confirmou - ver
 * cabecalho do arquivo). Sem rotacao (array vazio/ausente ou editConfig
 * ainda nulo): ".cc-rotacao" fica sem filhos e o CSS (":empty") colapsa o
 * espaco - nenhum medalhao inventado.
 */
function syncRotacao() {
	const root = _root();
	const container = root.querySelector('.cc-rotacao');
	if (!container) {
		return;
	}

	const rotacao = (IdleConfig.editConfig && IdleConfig.editConfig.rotacao) || [];
	const json = JSON.stringify(rotacao);
	if (json === _lastRotacaoJson) {
		return;
	}
	_lastRotacaoJson = json;

	container.innerHTML = rotacao
		.slice(0, 3)
		.map(
			(r, i) => `
			<button type="button" class="cc-medalhao" data-action="rotacao" title="${escapeHtml(r.skillId)} - prioridade ${i + 1}">
				<span class="cc-medalhao-ring ri-glass">
					<img class="cc-medalhao-icone" src="/ragidle/skills/${encodeURIComponent(r.skillId)}.png" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
					<span class="cc-medalhao-fallback">${escapeHtml(skillInitials(r.skillId))}</span>
				</span>
				<span class="cc-medalhao-prioridade">${i + 1}</span>
			</button>`
		)
		.join('');

	container.querySelectorAll('.cc-medalhao').forEach(btn => btn.addEventListener('click', onClickMedalhao));
}

/**
 * Qualquer medalhao abre a Config idle direto na aba Skills - so exibicao +
 * navegacao, nenhuma escrita no rascunho de rotacao daqui.
 */
function onClickMedalhao(e) {
	e.stopImmediatePropagation();
	IdleConfig.abrirNaAba('skills');
}

function onClickAuto(e) {
	e.stopImmediatePropagation();

	if (!IdleConfig.editConfig) {
		// Config ainda nao chegou do servidor - so garante que o pedido saiu
		// e espera o proximo poll refletir quando a resposta aparecer.
		IdleConfig.pedirConfig();
		return;
	}

	IdleConfig.editConfig.cacaAutomatica = !IdleConfig.editConfig.cacaAutomatica;
	IdleConfig.aplicarConfig();
	syncAutoState();
}

function onClickBag(e) {
	e.stopImmediatePropagation();
	Inventory.getUI().toggle();
}

/**
 * Create component and export it
 */
export default UIManager.addComponent(CombatCornerIdle);
