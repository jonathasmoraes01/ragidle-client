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
import { ehDaLinhaDoArqueiro } from './linhaDoArqueiro.js';
import { rolagemAoRedesenhar } from './rolagemDaSecao.js';
import Session from 'Engine/SessionStorage.js';
import { aplicarIconeDoItem, nomeLocalDoItem } from 'UI/itemNaTela.js';
import {
	ABAS_ACEITAS,
	ABA_PADRAO,
	TETO_DA_ORDEM,
	TETO_DE_BUFFS,
	abaCanonica,
	alternarColeta,
	alternarCura,
	alvoDoBuff,
	contarAlteracoes,
	curaNaRotacao,
	duracaoCurta,
	resumoDaSecao,
	curaLigadaPara
} from './secoesDaConfig.js';
import { aplicarPassoDeNivel, duracaoDaEntrada, lembrarSpDoContexto, nivelEscolhidoServido, seletorDaCura, seletorDaEntrada } from './nivelNaConfig.js';
import { curaComAtaqueAlterado, htmlDaCuraNaAbaAtaque, htmlDoAtaqueDaCura, nomesDasCurasNoIdioma } from './curaComoAtaque.js';
import { htmlDoPerfilDoMonge } from './perfilDoMonge.js';
import {
	chaveDoEstado,
	escutarRelogioDoDesejo,
	esperaAteORelogioMudar,
	esquecerRelogioDoDesejo,
	htmlDoDesejoArcano,
	htmlDoEstadoDoDesejo,
	restanteDoDesejoAgora,
	sincronizarRelogioDoDesejo
} from './desejoArcano.js';
import { traducaoLigada, traduzir } from 'Core/Traducao.js';
import { lerPassoDoSeletor } from 'UI/nivelDeUso.js';
import htmlText from './IdleConfig.html?raw';
import cssText from './IdleConfig.css?raw';
import { fecharEEsquecer } from '../limpezaDeJanelaIdle.js';
import { abaLembrada, lembrarAba } from '../memoriaDeAba.js';
import { escutarACasca, ofertaAtual, pontePWA, textoDoResultado } from 'UI/ofertaDeInstalacao.js';
import { CAMPOS_DO_ENVIO_DA_CONFIG, criarReceptorDeJanela } from 'UI/janelaPorDiferenca.js';
import { declararBaseNula } from 'Engine/declaracaoDasBases.js';
import { podarRascunhoPeloContexto } from './rascunhoContraOContexto.js';

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
/**
 * A FAIXA DA ASA (11/09/2026) - os MESMOS numeros de `servidor/idle/teleporte.ts`
 * (`SEGUNDOS_DE_OCIOSIDADE_MIN/MAX`). Divergir faria a barrinha oferecer um
 * valor que o Aplicar recusa, que e exatamente o defeito que D-1060 registrou
 * quando o teto de buffs morava em dois lugares.
 */
const ASA_MIN_S = 3;
const ASA_MAX_S = 20;

/**
 * `setPath` nao cria objeto no meio do caminho, entao o bloco precisa existir
 * antes de a barrinha escrever nele. O servidor ja desce com `asa` resolvida;
 * isto cobre a config antiga que ficou no rascunho.
 */
function garantirAsa(cfg) {
	if (!cfg.asa || typeof cfg.asa !== 'object') {
		cfg.asa = { ligada: true, teleportarApos: 10 };
	}
	return cfg.asa;
}

function garantirCura(cfg, ctx) {
	if (!cfg.cura || typeof cfg.cura !== 'object') {
		cfg.cura = { alvo: 'grupo', curarAbaixoDe: 50 };
	}
	// 08/09/2026: por habilidade. `setPath` nao cria objeto no meio do caminho,
	// entao a entrada de cada cura aprendida nasce AQUI, herdando o interruptor e
	// o alvo gerais — e a escolha unica da manha (`skillId`) sai do contrato.
	const curas = (ctx && ctx.skillsDeCura) || [];
	if (curas.length) {
		if (!cfg.cura.habilidades || typeof cfg.cura.habilidades !== 'object') cfg.cura.habilidades = {};
		for (const c of curas) {
			if (!cfg.cura.habilidades[c.skillId]) {
				// `curaLigadaPara` e nao o interruptor geral: os Primeiros Socorros
				// nascem DESLIGADOS (23/09/2026), e materializar a entrada com o
				// geral os religaria no primeiro "Aplicar".
				cfg.cura.habilidades[c.skillId] = {
					ligada: curaLigadaPara(cfg.cura, c.skillId),
					alvo: cfg.cura.alvo || 'grupo'
				};
			}
		}
		if ('skillId' in cfg.cura) delete cfg.cura.skillId;
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
/**
 * ═══════════════════════════════════════════════════════════════════════
 * O BOTÃO "INSTALAR" (D-933, 05/09/2026)
 * ═══════════════════════════════════════════════════════════════════════
 * Pedido do dono, palavra por palavra: *"Botão Instalar próprio dentro de
 * Configurações: capture beforeinstallprompt e dispare a partir dele, sem
 * banner intrusivo no meio do jogo."*
 *
 * ─── ONDE O EVENTO MORA, E POR QUE ISSO IMPORTA ─────────────────────────
 * `beforeinstallprompt` é disparado na janela de TOPO, e este componente nem
 * sempre roda nela: em desenvolvimento o jogo vive dentro de um `<iframe>`
 * (`ROBrowser.TYPE.FRAME`) e em produção ele é embutido no mesmo documento.
 * Por isso a ponte (`window.RagIdlePWA`, de `applications/pwa/registrar-sw.js`)
 * é procurada na janela E no `parent` — sem isso o botão funcionaria em
 * produção e ficaria mudo em desenvolvimento, que é o pior jeito de descobrir
 * um defeito. Essa busca mora em `UI/ofertaDeInstalacao.js` desde D-945,
 * porque a tela de entrada precisa dela pelo mesmo motivo.
 *
 * ─── A LINHA NASCE ESCONDIDA ────────────────────────────────────────────
 * Ela só aparece quando há algo a fazer: o navegador ofereceu a instalação,
 * ou existe um caminho manual honesto para contar (iPhone, navegador de
 * dentro de um app, Android que ainda não ofereceu). Quem já jogou instalado
 * não vê nada, e num computador sem oferta a linha não nasce — um botão que
 * não faz nada é a versão permanente do banner intrusivo que o dono recusou.
 */
/* A DECISAO E A MESMA DA TELA DE ENTRADA (D-945, 06/09/2026).
 *
 * Ate aqui esta funcao tinha regra propria, e ela escondia a linha sempre que
 * nao havia evento e nao era iPhone. Esse "sempre que" engolia o caso mais
 * comum do celular: o navegador de DENTRO de um app (Instagram, Facebook),
 * onde `beforeinstallprompt` nunca dispara. O jogador nao via nem botao nem
 * explicacao -- so o silencio, que ele le como "esse jogo nao instala".
 *
 * Agora as duas telas leem `UI/ofertaDeInstalacao.js`. Elas so DESENHAM
 * diferente: aqui, num painel onde sobra espaco, a explicacao fica sempre a
 * vista; na tela de entrada, onde o celular conta cada linha, ela abre no
 * toque. */
function sincronizarInstalar() {
	const root = _root();
	const linha = root && root.querySelector('.ic-instalar');
	if (!linha) return;

	const oferta = ofertaAtual();
	linha.hidden = !oferta.mostrar;
	if (!oferta.mostrar) return;

	/* No modo `instrucao` nao ha o que disparar, e o botao sai de cena em vez
	   de mentir que funciona -- o texto e que carrega o caminho. */
	linha.classList.toggle('is-instrucao', oferta.modo === 'instrucao');

	const sub = linha.querySelector('.ic-instalar-sub');
	if (sub) sub.textContent = oferta.dica;
}

function ligarInstalar() {
	const root = _root();
	const botao = root && root.querySelector('.ic-instalar-btn');
	if (botao && !botao.__ligado) {
		botao.__ligado = true;
		botao.addEventListener('click', e => {
			e.stopImmediatePropagation();
			const ponte = pontePWA();
			if (!ponte) return;
			Promise.resolve(ponte.instalar()).then(resultado => {
				const sub = _root().querySelector('.ic-instalar-sub');
				/* Diz o que aconteceu, inclusive quando não deu — recusar a
				   instalação é uma escolha legítima e o jogo não vai insistir. */
				if (sub) sub.textContent = textoDoResultado(resultado);
				sincronizarInstalar();
			});
		});
	}

	/* A oferta do navegador pode chegar DEPOIS de a janela abrir — ela depende
	   de heurística de engajamento. Por isso a linha também escuta. */
	if (!ligarInstalar.__escutando) {
		ligarInstalar.__escutando = escutarACasca(sincronizarInstalar);
	}
}

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
/* A linha de instalar é resincronizada a cada abertura: o estado dela muda
   por fora (o navegador oferece, o jogador instala noutra aba). */
IdleConfig.toggle = function toggle() {
	const root = _root();
	const win = root.querySelector('.ic-window');
	if (win.classList.contains('is-open')) {
		closeWindow();
	} else {
		win.classList.add('is-open');
		// A janela que reabre comeca do topo (`rolagemDaSecao.js`).
		_secaoDoUltimoDesenho = null;
		ligarInstalar();
		sincronizarInstalar();
		ligarRetomarTutorial();
		sincronizarRetomarTutorial();
		IdleConfig.focus();
		requestConfig();
	}
};

/**
 * O componente do tutorial, SE ele existir.
 *
 * Por REGISTRO e nao por `import`, e a razao e medida: `TutorialIdle` puxa o
 * `CursorManager` e o `MapRenderer` (ele precisa da mao do jogo e do nome do
 * mapa), e esses dois puxam o `SpriteRenderer`, que pede um contexto 2D de
 * canvas na hora do import. Um `import` aqui derrubou TRES arquivos de teste
 * desta janela (24 casos) em jsdom, sem que nada nesta janela tivesse mudado.
 *
 * Devolve `null` quando o tutorial nao esta carregado (fora do mapa, ou num
 * teste que so monta a Configuracao). A linha simplesmente nao aparece.
 */
function tutorialIdle() {
	try {
		return UIManager.getComponent('TutorialIdle');
	} catch (_erro) {
		return null;
	}
}

/*
 * ─── RETOMAR O TUTORIAL PELA AJUDA ────────────────────────────────────
 *
 * O tutorial guiado (frente D da Jornada de Midgard) pode ser pulado a
 * qualquer etapa, e um jogador que pulou sem querer nao pode ficar sem
 * caminho de volta. A porta e esta linha, e ela mora aqui pelo mesmo
 * criterio que trouxe o Idle para o cluster do menu: e o painel que se abre
 * ENTRE uma coisa e outra, e nao um destino ocasional.
 *
 * O estado vem do SERVIDOR (`TutorialIdle.estado`), como todo o resto do
 * tutorial. A linha nao inventa nada: se o retrato ainda nao chegou, ela
 * simplesmente nao aparece.
 */
function sincronizarRetomarTutorial() {
	const root = _root();
	const linha = root && root.querySelector('.ic-tutorial');
	if (!linha) return;

	const tutorial = tutorialIdle();
	const estado = tutorial && tutorial.estado;
	/* Sem retrato, nao ha o que dizer. E com o tutorial JA na tela, a linha
	   sairia oferecendo o que o jogador esta fazendo neste instante. */
	const mostrar = !!estado && estado.estado !== 'em-andamento' && estado.estado !== 'nao-iniciado';
	linha.hidden = !mostrar;
	if (!mostrar) return;

	const sub = linha.querySelector('.ic-tutorial-sub');
	if (sub) {
		sub.textContent =
			estado.estado === 'pulado'
				? 'Você pulou a apresentação. Dá para vê-la de novo quando quiser.'
				: 'Você já terminou. Dá para rever os passos quando quiser.';
	}
}

function ligarRetomarTutorial() {
	const root = _root();
	const botao = root && root.querySelector('.ic-tutorial-btn');
	if (!botao || botao.__ligado) return;
	botao.__ligado = true;
	botao.addEventListener('click', e => {
		e.stopImmediatePropagation();
		/* Quem retoma e o SERVIDOR: o cliente pede e o proximo retrato traz a
		   etapa. Fechar o painel aqui e o que tira a janela de cima do primeiro
		   controle que o tutorial vai apontar. */
		const tutorial = tutorialIdle();
		if (!tutorial) return;
		tutorial.retomar();
		closeWindow();
	});
}

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
		? 'Você está na cidade: dá para editar a configuração, e a caça começa quando você viajar.'
		: 'Configuração idle';
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
/**
 * A CONFIG POR DIFERENCA (D-2077, `UI/janelaPorDiferenca.js`): o servidor que
 * numera manda, a quem declarou (`Engine/declaracaoDasBases.js`), so as trocas
 * sobre o ultimo envio. O receptor monta o corpo no formato do inteiro, e dai
 * em diante o caminho e o de sempre. Parcial que nao cai: declara `null` e
 * pede de novo.
 */
const _receptorDaConfig = criarReceptorDeJanela(CAMPOS_DO_ENVIO_DA_CONFIG, function () {
	declararBaseNula('config', { Network, PACKET });
	Network.sendPacket(new PACKET.CZ.RAGIDLE_PEDIR_CONFIG());
});

/** A revisao da config que esta memoria tem, para a declaracao da entrada (D-2077). */
IdleConfig.revisaoDaConfig = function revisaoDaConfig() {
	return _receptorDaConfig.revisao();
};

function onConfigReceived(pkt) {
	let data;
	try {
		data = JSON.parse(pkt.json);
	} catch (e) {
		console.error('[IdleConfig] Falha ao interpretar a configuração recebida:', e, pkt.json);
		setStatus('Configuração incompatível.');
		return;
	}
	const recebido = _receptorDaConfig.receber(data);
	if (recebido.ignorado) {
		return;
	}
	data = recebido.dados;

	if (!data || data.v !== 1 || !data.config || !data.contexto) {
		console.error('[IdleConfig] Configuração com contrato incompatível (v=' + (data && data.v) + ').', data);
		setStatus('Configuração incompatível.');
		return;
	}

	const isApplyResponse = Object.prototype.hasOwnProperty.call(data, 'aplicado');
	const rejected = isApplyResponse && Array.isArray(data.problemas) && data.problemas.length > 0;

	IdleConfig.contexto = data.contexto;
	IdleConfig.contextoObsoleto = false;
	// D-2046: o restante do Desejo, contado daqui pelo relogio local.
	sincronizarRelogioDoDesejo(data.contexto, Date.now());
	// D-1906: o SP por nivel fica lembrado para a dica da barra de atalhos.
	lembrarSpDoContexto(data.contexto);
	aplicarEstadoDeCidade();
	IdleConfig.problemas = rejected ? data.problemas : [];

	if (!rejected) {
		/*
		 * A BASE anda sempre; o RASCUNHO so quando nao ha rascunho (07/09/2026).
		 *
		 * Desde esta data o servidor EMPURRA a config a cada gravacao — aprender
		 * skill, promocao, vestir equipamento, o clique na lista de skills. O
		 * empurrao existe para o `serverConfig` nunca ficar velho: o botao de
		 * Cacar (`alternarCacaAutomatica`) monta o pedido a partir dele, e uma
		 * copia velha reenviava a rotacao de antes — foi assim que "Primeiros
		 * Socorros voltava sozinha" depois de o jogador a tirar pela janela de
		 * habilidades.
		 *
		 * O preco de adotar o pacote inteiro seria APAGAR o rascunho do jogador
		 * no meio de uma edicao, e agora isso aconteceria varias vezes por
		 * sessao. Entao: a base adota sempre (e ela que o botao de Cacar usa), e
		 * o rascunho so e substituido quando nao ha rascunho a perder.
		 */
		IdleConfig.serverConfig = data.config;
		const temRascunho = IdleConfig.dirty && !isApplyResponse;
		if (!temRascunho) {
			IdleConfig.editConfig = cloneConfig(data.config);
			garantirCura(IdleConfig.editConfig);
			garantirAsa(IdleConfig.editConfig);
			IdleConfig.dirty = false;
		}
		// Em cidade o aviso mora AQUI (D-359): a janela edita normalmente e o
		// rodape lembra que a caca so comeca fora da cidade.
		setStatus(
			isApplyResponse
				? 'Aplicado.'
				: data.contexto.ehCidade
					? 'Você está na cidade. A caça começa quando você viajar.'
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

	/*
	 * O RASCUNHO NAO GUARDA O QUE O PERSONAGEM NAO TEM MAIS (D-2085, 07/10/2026).
	 * Nos dois ramos acima o rascunho pode sobreviver (alteracao pendente no
	 * empurrao, ou a recusa), e com ele a habilidade que um reset levou: o
	 * servidor recusa a config inteira por ela, e com o reset TOTAL a lista de
	 * golpes nem e desenhada, entao o jogador nao a via nem tinha como tira-la.
	 * O contexto que acabou de chegar e o retrato de hoje; a regra mora em
	 * `rascunhoContraOContexto.js`, a mesma purga do servidor (D-2084).
	 */
	const podado = podarRascunhoPeloContexto(IdleConfig.editConfig, data.contexto);
	if (podado) {
		IdleConfig.editConfig = podado;
		IdleConfig.dirty = JSON.stringify(IdleConfig.editConfig) !== JSON.stringify(IdleConfig.serverConfig);
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
						: 'Parada: o personagem só se defende até você ligar.'
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
/**
 * A secao do ultimo desenho do painel: o redesenho da MESMA secao mantem a
 * rolagem, e a troca de secao (ou a janela que reabre, que zera isto) volta ao
 * topo. Ver `rolagemDaSecao.js`.
 */
let _secaoDoUltimoDesenho = null;

function renderBody() {
	const root = _root();
	const pane = root.querySelector('.ic-pane');
	if (!pane) {
		return;
	}

	if (!IdleConfig.editConfig || !IdleConfig.contexto) {
		pane.innerHTML = '<div class="ic-empty">Abra a configuração idle para carregar.</div>';
		_secaoDoUltimoDesenho = null;
		return;
	}
	const rolagem = rolagemAoRedesenhar(_secaoDoUltimoDesenho, IdleConfig.activeTab, pane.scrollTop);
	garantirCura(IdleConfig.editConfig);

	switch (IdleConfig.activeTab) {
		case 'ataque':
			pane.innerHTML = renderAtaque();
			garantirTiqueDoDesejo();
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
	pane.scrollTop = rolagem;
	_secaoDoUltimoDesenho = IdleConfig.activeTab;
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

	/*
	 * R16/C2-5 (14/09/2026): o modo da poção automática — outro booleano de
	 * UI mapeado para um ENUM (`modo: 'item_especifico' | 'qualquer'`,
	 * contrato v1 do jr-C1), pela mesma razão de `data-modo-basico` logo
	 * abaixo. Desligar (voltar a "item_especifico") reaproveita a MESMA
	 * escolha de default do toggle geral — sem isso o `<select>` reapareceria
	 * ainda apontando pro itemId antigo, que pode nem ser mais valido.
	 */
	el.querySelectorAll('[data-modo-pocao]').forEach(input => {
		input.addEventListener('change', () => {
			const campo = input.dataset.modoPocao;
			const pocao = IdleConfig.editConfig[campo];
			pocao.modo = input.checked ? 'qualquer' : 'item_especifico';
			if (pocao.modo === 'item_especifico') {
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
			const sufixo = range.dataset.rangeSufixo || '%';
			el.querySelectorAll(`[data-range-display="${path}"]`).forEach(disp => {
				disp.textContent = range.value + sufixo;
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

/**
 * @param {string} attrName - R16/C2-5 (14/09/2026): o interruptor de MODO da
 *   poção automática nao escreve um booleano solto por `data-bool` (o campo
 *   real é um enum, `modo: 'item_especifico'|'qualquer'`) — precisa do
 *   proprio handler (`data-modo-pocao`, ver bindGenericControls). Omitido,
 *   o comportamento é o de sempre.
 */
function switchRow(path, checked, label, sub, disabled, attrName = 'data-bool') {
	return `
		<label class="ic-switch-row">
			<span class="ic-switch">
				<input type="checkbox" ${attrName}="${path}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} />
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
			'<div class="ic-empty">Você está na cidade. As presas se escolhem num mapa de caça: viaje e volte aqui.</div>';
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
			<div class="ic-note">Só as presas marcadas são caçadas. A desmarcada é evitada: se ela atacar, o personagem não revida e segue para as marcadas (ou se afasta). Para lutar com ela, clique nela.</div>
			${presas}
		</div>
		<div class="ic-card">
			<h3>Durante a caça</h3>
			<label class="ic-checkbox-row">
				<input type="checkbox" data-bool="coletarItens" ${cfg.coletarItens ? 'checked' : ''} />
				<span>Recolher o que cai no chão</span>
			</label>
			<div class="ic-note">Experiência e zeny entram sempre; só os itens dependem disto.</div>
			${renderFiltroDeColeta()}
			${renderAsa()}
			${renderFlechaQueFere()}
			${renderAsaContraEvitado()}
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

/**
 * O FILTRO DE COLETA (D-1348 — a D-1165 do dono: *"fica o filtro de coleta
 * (lista negativa)"*). Mora em Caçada, logo abaixo da chave que ele refina: a
 * chave decide SE recolhe; o filtro, O QUE fica de fora. Com a chave desligada
 * ele aparece desabilitado — não haveria o que filtrar.
 *
 * Os chips são os drops DESTE mapa e o que já está na lista (o servidor manda os
 * dois em `itensDoFiltro`); o nome é o do cliente instalado quando ele o tem,
 * como no Mapa de Caça. O desenho é o das presas, de propósito: o jogador já
 * aprendeu que o chip marcado é o que entra.
 */
function renderFiltroDeColeta() {
	const cfg = IdleConfig.editConfig;
	const ctx = IdleConfig.contexto || {};
	const itens = ctx.itensDoFiltro || [];
	if (!itens.length) {
		return '';
	}
	const fora = new Set(cfg.itensNaoColetados || []);
	const ativo = cfg.coletarItens !== false;
	const chips = itens
		.map(it => {
			const nome = nomeLocalDoItem(it.itemId, it.nome);
			const desligado = fora.has(it.itemId);
			const dica = it.caiAqui ? nome : `${nome} (não cai neste mapa)`;
			return `
			<label class="ic-presa ic-presa--item${desligado ? ' is-off' : ''}" title="${escapeHtml(dica)}">
				<input type="checkbox" data-item-toggle="${it.itemId}" ${desligado ? '' : 'checked'} ${ativo ? '' : 'disabled'} />
				<span class="ic-presa-avatar"><img data-item-icon="${it.itemId}" alt="" /></span>
				<span class="ic-presa-nome">${escapeHtml(nome)}</span>
				<span class="ic-presa-check">${RiIcones.confere}</span>
			</label>`;
		})
		.join('');
	return `
		<div class="ri-divisor"></div>
		<div class="ic-subsection${ativo ? '' : ' ic-subsection-disabled'}">
			<div class="ic-field-row">
				<span>Itens que ele recolhe</span>
				<span class="ic-card-meta">${fora.size ? `${fora.size} de fora` : 'todos'}</span>
			</div>
			<div class="ic-note">Desmarque o que não quer na mochila. O que ninguém desmarcou, inclusive o drop novo, continua entrando.</div>
			<div class="ic-presas ic-presas--itens">${chips}</div>
		</div>`;
}

/**
 * A ASA DE MOSCA AUTOMATICA (11/09/2026 - ordem do dono: *"preciso que essa asa
 * de mosca fique visivel no menu, seja possivel ativar e seja possivel
 * configurar"*).
 *
 * Ela mora em **Caçada**, e nao em Consumiveis, porque o que ela decide e PARA
 * ONDE ir quando o mapa seca - e a pergunta da cacada. O desenho e o mesmo da
 * cura (interruptor + barrinha) de proposito: o jogador ja aprendeu esse par.
 *
 * O gatilho e do passe VIP. Sem passe o controle aparece DESABILITADO em vez de
 * sumir: esconder faria o jogador comum procurar no menu uma coisa que o post
 * de patch anunciou - que foi literalmente a primeira pergunta do dono.
 */
function renderAsa() {
	const cfg = IdleConfig.editConfig;
	const ctx = IdleConfig.contexto;
	const asa = garantirAsa(cfg);
	const ehVip = !!(ctx && ctx.ehVip);
	const asas = (ctx && ctx.asasNaMochila) || 0;
	const ligada = asa.ligada !== false;

	return `
		<div class="ri-divisor"></div>
		${switchRow(
			'asa.ligada',
			// Travada sem VIP, ela aparece DESLIGADA (30/09/2026), como a troca de
			// flecha logo abaixo: mostrar "ligada" num controle que nao age mentia.
			// O valor gravado nao muda: o controle desabilitado nao escreve nada.
			ehVip && ligada,
			'Usar Asa de Mosca sozinho',
			'Durante a caça, se passar o tempo escolhido sem atacar nenhum monstro, o personagem gasta uma Asa e reaparece noutro canto. Cada ataque zera a contagem.',
			!ehVip
		)}
		<div class="ic-subsection${ehVip && ligada ? '' : ' ic-subsection-disabled'}">
			<div class="ic-field-row">
				<span>Teleportar após <span class="ic-inline-value" data-range-display="asa.teleportarApos">${asa.teleportarApos}s</span> sem atacar</span>
			</div>
			<input type="range" class="ic-slider" min="${ASA_MIN_S}" max="${ASA_MAX_S}" step="1" value="${asa.teleportarApos}" data-range="asa.teleportarApos" data-range-sufixo="s" ${ehVip && ligada ? '' : 'disabled'} />
		</div>
		${
			ehVip
				? `<div class="ic-note${asas ? '' : ' ic-note-warn'}">${asas ? `${asas} Asa${asas === 1 ? '' : 's'} de Mosca na mochila. Cada viagem gasta uma.` : 'Nenhuma Asa de Mosca na mochila: compre no NPC de itens para o gatilho ter o que usar.'}</div>`
				: '<div class="ic-note ic-note-warn">O uso automático é do passe VIP. Sem ele a Asa continua sua: use pela mochila, com 4 s de espera entre uma e outra.</div>'
		}`;
}

/**
 * A TROCA INTELIGENTE DE FLECHA (D-1866, 30/09/2026) - ordem do dono: *"Trocar
 * flecha automatico = VIP"* e *"coloca la no menu idle tbm"*.
 *
 * Quando as flechas acabam no meio da luta, o VIP com este interruptor ligado
 * veste a flecha simples (ate 4z) que FERE o monstro; desligado, ou sem VIP, a
 * mais barata da mochila (a troca de sempre, que continua para todos). Quem
 * decide e o servidor (`trocaInteligenteDeFlecha`); aqui so o desenho. Mesmo
 * molde da Asa: sem VIP o controle aparece DESABILITADO, com a explicacao, em
 * vez de sumir. Ausente na config = ligado.
 */
function renderFlechaQueFere() {
	// So a linha do Arqueiro e a do Arruaceiro veem o interruptor (30/09/2026,
	// ordem do dono: as classes que usam arco); ver `linhaDoArqueiro.js`.
	if (!ehDaLinhaDoArqueiro(Session.Entity && Session.Entity._job)) return '';
	const cfg = IdleConfig.editConfig;
	const ctx = IdleConfig.contexto;
	const ehVip = !!(ctx && ctx.ehVip);
	const ligada = cfg.trocaDeFlechaQueFere !== false;
	return `
		<div class="ri-divisor"></div>
		${switchRow(
			'trocaDeFlechaQueFere',
			ehVip && ligada,
			'Trocar para a flecha que fere',
			'Quando as flechas acabam no meio da luta, o personagem veste uma flecha simples (até 4z) que fere o monstro, em vez da mais barata. As especiais continuam sendo escolha sua.',
			!ehVip
		)}
		${ehVip ? '' : '<div class="ic-note ic-note-warn">A troca inteligente é do passe VIP. Sem ele, quando as flechas acabam, o jogo veste a mais barata da mochila.</div>'}`;
}

/**
 * A ASA CONTRA O MONSTRO EVITADO (D-1983, R103, 05/10/2026) - sugestao de
 * jogador que o dono mandou fazer: *"seja possivel passar reto e/ou programar
 * uma asa de mosca"* contra o monstro agressivo que ele desmarcou em Presas.
 *
 * Passar reto e de todos (o servidor evita a presa desmarcada com a caca
 * ligada). A Asa e um gatilho AUTOMATICO, e o gatilho automatico da Asa e do
 * passe VIP (R20): sem VIP o controle aparece DESABILITADO com a explicacao, no
 * molde da Asa e da troca de flecha. Quem decide e o servidor
 * (`decidirAsaContraEvitado`); aqui so o desenho. Ausente na config = desligado.
 */
function renderAsaContraEvitado() {
	const cfg = IdleConfig.editConfig;
	const ctx = IdleConfig.contexto;
	const ehVip = !!(ctx && ctx.ehVip);
	const ligada = cfg.asaAoSerAtacadoPorEvitado === true;
	return `
		<div class="ri-divisor"></div>
		${switchRow(
			'asaAoSerAtacadoPorEvitado',
			ehVip && ligada,
			'Asa de Mosca ao ser atacado por presa desmarcada',
			'Se um monstro que você desmarcou em Presas atacar o personagem durante a caça, ele gasta uma Asa e reaparece noutro canto do mapa.',
			!ehVip
		)}
		${ehVip ? '' : '<div class="ic-note ic-note-warn">O uso automático da Asa é do passe VIP. Sem ele, o personagem continua sem revidar a presa desmarcada e segue para as marcadas.</div>'}`;
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

	pane.querySelectorAll('[data-item-icon]').forEach(img => aplicarIconeDoItem(img, Number(img.dataset.itemIcon)));

	pane.querySelectorAll('[data-item-toggle]').forEach(input => {
		input.addEventListener('change', () => {
			const cfg = IdleConfig.editConfig;
			const nova = alternarColeta(cfg.itensNaoColetados, Number(input.dataset.itemToggle), input.checked);
			// Lista vazia num servidor que nunca teve o campo e "nada mudou": sem
			// isto, desmarcar e remarcar o mesmo item contaria uma alteracao.
			const servidorTem = !!(IdleConfig.serverConfig && 'itensNaoColetados' in IdleConfig.serverConfig);
			if (nova.length === 0 && !servidorTem) {
				delete cfg.itensNaoColetados;
			} else {
				cfg.itensNaoColetados = nova;
			}
			markDirty();
			renderBody();
		});
	});

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
		ajuda: 'Ela vale só de estar aprendida: muda número na ficha.'
	},
	'sem-efeito-de-combate': {
		classe: 'ri-badge--cinza',
		texto: 'fora da luta',
		ajuda: 'O motor executa, mas o efeito é fora da luta (deslocamento, carga, pré-requisito).'
	},
	'nao-portada': {
		classe: 'ri-badge--ouro',
		texto: 'ainda não implementada',
		ajuda: 'O motor de combate ainda não executa esta habilidade.'
	}
};

function renderAtaque() {
	const cfg = IdleConfig.editConfig;
	const ctx = IdleConfig.contexto;
	const ativas = ctx.skillsAtivas || [];
	const passivas = ctx.skillsPassivas || [];
	const rotacao = cfg.rotacao || [];
	const curas = new Set((ctx.skillsDeCura || []).map(s => s.skillId));
	// A SUBSECAO DEBUFF (16/09/2026, ESPECIFICACAO_MENU_IDLE_INTELIGENTE.md
	// §1/§4): MESMA lista de ataque, MESMA ordem de golpes — so a etiqueta que
	// diz "isto aplica algo no inimigo, e nao e dano direto" (o servidor ja
	// separa por efeito real em `ehDebuff`, e nao por nome/alvo da skill).
	const debuffs = new Set(ativas.filter(s => s.ehDebuff).map(s => s.skillId));

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
						${seletorDaEntrada({ chave: `rotacao.${i}`, entrada: r, info: ativas.find(s => s.skillId === r.skillId), capaz: nivelEscolhidoServido(ctx), nome: nomeDaSkill(r.skillId) })}
						${curas.has(r.skillId) ? '<span class="ri-badge ri-badge--verde" title="O limiar e o alvo desta cura se ajustam na seção Suporte">cura · ajuste em Suporte</span>' : ''}
						${debuffs.has(r.skillId) ? '<span class="ri-badge ri-badge--vermelho" title="Aplica algo negativo no inimigo (não é dano direto)">Debuff</span>' : ''}
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
			: '<div class="ic-empty">Nenhum golpe na ordem: o personagem só dá o golpe básico.</div>';

		const usados = new Set(rotacao.map(r => r.skillId));
		const livres = ativas.filter(s => !usados.has(s.skillId));

		let adicionar;
		if (rotacao.length >= TETO_DA_ORDEM) {
			adicionar = '<div class="ic-note">As três vagas estão ocupadas. Tire uma habilidade para pôr outra.</div>';
		} else if (!livres.length) {
			adicionar = '<div class="ic-note">Todas as habilidades disponíveis já estão na ordem.</div>';
		} else {
			// Agrupado por Ataques/Debuffs (D-1481, 16/09/2026) para achar mais
			// rápido — a ORDEM continua sendo uma lista só (as duas disputam as
			// mesmas 3 vagas no motor), o agrupamento é só para escolher.
			const opcao = s =>
				`<option value="${escapeHtml(s.skillId)}">${escapeHtml(s.nome || s.skillId)} (Nv ${s.aprendido})${
					curas.has(s.skillId) ? ' (cura)' : ''
				}</option>`;
			const livresAtaque = livres.filter(s => !debuffs.has(s.skillId));
			const livresDebuff = livres.filter(s => debuffs.has(s.skillId));
			adicionar = `
				<select class="ic-add-skill" data-action="skill-add">
					<option value="">+ Pôr uma habilidade na ordem</option>
					${livresAtaque.length ? `<optgroup label="Ataques">${livresAtaque.map(opcao).join('')}</optgroup>` : ''}
					${livresDebuff.length ? `<optgroup label="Debuffs">${livresDebuff.map(opcao).join('')}</optgroup>` : ''}
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

	/*
	 * B3 (06/09/2026) — A CURA MORA AQUI, E A TELA PRECISA DIZER ISSO.
	 *
	 * Reporte do playtest: *"ainda ta confuso isso aqui, quando se trata de
	 * classe de suporte... a skill 'curar' tambem consegue estar em 'ataque'"*.
	 *
	 * Nao e defeito: e o desenho. `baldeDaHabilidade` (D-1060) manda `cura`,
	 * `curaFixa` e `removerStatusDoAlvo` para a ORDEM DE USO — sao as tres que
	 * o MOTOR conjura contra o relogio da luta, e por isso disputam as mesmas
	 * tres vagas dos golpes. A `recomporRotacaoAutomatica` chega a instala-las
	 * PRIMEIRO (D-1132), porque quem se cura antes de pensar em dano sobrevive.
	 *
	 * O que faltava era a tela DIZER isso. A etiqueta por linha ja existia; o
	 * que ela nao dava era a regra — quem le "Ordem de golpes" e ve a Cura ali
	 * conclui que a janela esta errada, e nao que as duas coisas dividem a
	 * lista de proposito.
	 */
	const curasAprendidas = (ctx.skillsDeCura || []).length;
	const curasNaOrdem = rotacao.filter(r => curas.has(r.skillId)).length;
	// 08/09/2026 (ordem do dono): a cura NAO divide mais estas vagas — ela e
	// suporte. A nota aponta para onde ela mora, pelo nome da habilidade.
	// Cada nome traduzido sozinho, e o "e" no idioma (05/10/2026): o composto nao casa no catalogo.
	const nomesDasCuras = escapeHtml(nomesDasCurasNoIdioma(ctx.skillsDeCura, traduzir, traducaoLigada()));
	const notaDeCura = curasAprendidas
		? `<div class="ic-note">${nomesDasCuras} ${curasAprendidas === 1 ? 'é habilidade de suporte e não ocupa' : 'são habilidades de suporte e não ocupam'} vaga aqui: ${curasAprendidas === 1 ? 'ela é usada sozinha' : 'elas são usadas sozinhas'} quando a vida cai abaixo do limiar. O interruptor, o limiar e o alvo (você ou o grupo) ficam na seção <strong>Suporte</strong>.</div>`
		: '';

	// Os perfis do Monge (06/10/2026): o cartao so existe quando o servidor
	// manda `contexto.monge` (a linha do Monge); o seletor e o segmentado generico.
	// O Desejo Arcano (06/10/2026), mesmo molde: so com `contexto.desejoArcano`.
	return `
		${htmlDoPerfilDoMonge({ cfg, ctx, escapar: escapeHtml })}
		${htmlDoDesejoArcano({ cfg, ctx, escapar: escapeHtml, nomeDaSkill, restanteMs: restanteDoDesejoAgora(Date.now()) })}
		<div class="ic-card">
			<div class="ic-card-head">
				<h3>Ordem de uso</h3>
				<span class="ic-card-meta">${rotacao.length}/${TETO_DA_ORDEM} vagas</span>
			</div>
			<div class="ic-note">O personagem tenta a primeira que puder usar e vai rodando a lista; sem nenhuma, dá o golpe básico.</div>
			${notaDeCura}
			${ordem}
		</div>
		${htmlDaCuraNaAbaAtaque({ curas: ctx.skillsDeCura, cura: garantirCura(cfg, ctx), ctx, escapar: escapeHtml })}
		<div class="ic-card">
			<h3>Golpe básico</h3>
			<label class="ic-checkbox-row">
				<input type="checkbox" data-modo-basico ${cfg.modoDeAtaque === 'apenas-skills' ? 'checked' : ''} ${!podeDesligarBasico || semGolpe ? 'disabled' : ''} />
				<span>Nunca dar o golpe básico, só habilidades</span>
			</label>
			<div class="ic-note">Marcado, o personagem conjura à distância e espera o SP voltar em vez de bater. Desmarcado, bate quando nenhuma habilidade estiver disponível.</div>
			${!podeDesligarBasico ? '<div class="ic-note ic-note-warn">Este servidor não sabe lutar sem o golpe básico.</div>' : ''}
			${podeDesligarBasico && semGolpe ? '<div class="ic-note ic-note-warn">Ponha ao menos um golpe na ordem para poder desligar o básico: sem ele, o personagem ficaria sem ataque nenhum, e o servidor recusa.</div>' : ''}
		</div>
		<div class="ic-card">
			<h3>Passivas</h3>
			<div class="ic-note">Valem só de estarem aprendidas e não entram em ordem nenhuma.</div>
			<div class="ic-passivas">${passivasHtml}</div>
		</div>`;
}

/**
 * O "−"/"+" do NIVEL DE USO (D-1906), nas tres listas. Um ouvinte por
 * seletor desenhado (o painel e redesenhado inteiro a cada mudanca, entao um
 * ouvinte no painel se acumularia); quem decide o que o passo muda e
 * `aplicarPassoDeNivel` (`nivelNaConfig.js`).
 */
function bindNiveis(pane) {
	pane.querySelectorAll('[data-nivel-chave]').forEach(seletor => {
		seletor.addEventListener('click', e => {
			const passo = lerPassoDoSeletor(e.target);
			if (!passo) {
				return;
			}
			if (aplicarPassoDeNivel(IdleConfig.editConfig, IdleConfig.contexto, passo.chave, passo.passo)) {
				markDirty();
				renderBody();
			}
		});
	});
}

function bindAtaqueExtra(pane) {
	bindNiveis(pane);
	bindAtaqueDaCura(pane);
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
		: `<div class="ic-grupo">${RiIcones.usuarios}<span><strong>Você não está em grupo.</strong> O que marcar "Grupo" passa a valer quando entrar num. Até lá, vale só em você.</span></div>`;

	return `
		${!serve ? '<div class="ic-note ic-note-warn">Este servidor ainda não cruza cura e buffs para o grupo. As escolhas abaixo ficam guardadas para quando cruzar.</div>' : ''}
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
					// D-1906: com o seletor, o SP mora nele (o do nivel ESCOLHIDO); o relogio e a duracao do mesmo nivel (D-1929).
					const comSeletor = nivelEscolhidoServido(ctx) && !!info;
					return `
			<div class="ic-buff-row">
				<span class="ic-rot-num">${i + 1}</span>
				<span class="ic-rot-main">
					<span class="ic-rot-name" title="${escapeHtml(b.skillId)}">${escapeHtml(nomeDaSkill(b.skillId))}</span>
					<span class="ic-rot-tags">
						${seletorDaEntrada({ chave: `rotacaoDeBuffs.${i}`, entrada: b, info, capaz: nivelEscolhidoServido(ctx), nome: nomeDaSkill(b.skillId) })}
						${info ? `<span class="ri-badge ri-badge--cinza ic-badge-relogio" title="Renovado assim que cair">${RiIcones.relogio}${duracaoCurta(duracaoDaEntrada(b, info))}</span>` : ''}
						${info && !comSeletor ? `<span class="ri-badge ri-badge--cinza">${info.custoSp} SP</span>` : ''}
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
			<div class="ic-note">Conjurados antes do primeiro golpe e renovados assim que caem: em você e, no que estiver marcado "Grupo", em cada membro que ficar sem.</div>
			<div class="ic-rot-list">${linhas}</div>
			${adicionar}
			${notaPontual}
		</div>`;
}

function renderCura() {
	const cfg = IdleConfig.editConfig;
	const ctx = IdleConfig.contexto;
	const curas = ctx.skillsDeCura || [];
	const cura = garantirCura(cfg, ctx);

	if (!curas.length) {
		return `
		<div class="ic-card">
			<h3>Cura</h3>
			<div class="ic-empty">Este personagem não aprendeu habilidade de cura (Curar do Acólito, Primeiros Socorros do Aprendiz).</div>
		</div>`;
	}

	// 08/09/2026 (ordem do dono): a configuracao e POR HABILIDADE — cada cura
	// aprendida tem o proprio "Curar automaticamente" e o proprio "Quem curar"
	// ("nao quero mais usar Primeiros Socorros, mas quero que Curar funcione").
	// O limiar e UM so, porque o motor tem um portao de HP unico. A cura nao
	// mora na ordem de golpes (D-1201): o servidor a antepoe sozinho.
	const ordenadas = curas
		.slice()
		.sort((a, b) => (b.custoSp || 0) - (a.custoSp || 0) || (b.aprendido || 0) - (a.aprendido || 0));
	const ligadas = ordenadas.filter(c => curaLigadaPara(cura, c.skillId));
	const algumaLigada = ligadas.length > 0;
	const cartoes = ordenadas
		.map(c => {
			const ligada = curaLigadaPara(cura, c.skillId);
			const alcanca = !!c.alcancaGrupo;
			const ajuste = (cura.habilidades && cura.habilidades[c.skillId]) || {};
			const alvo = ajuste.alvo || cura.alvo || 'grupo';
			// A Aid Potion (D-1641) gasta uma pocao da mochila a cada uso: a linha
			// diz o custo, e o que ela faz sozinha. No clique ela funciona sempre.
			const custo = c.gastaPocao ? `${c.custoSp} SP + 1 poção` : `${c.custoSp} SP`;
			const explicacao = c.gastaPocao
				? ligada
					? 'Joga sozinha a poção de HP mais forte da mochila (até o nível aprendido) quando a barra cair abaixo do limite. Gasta a poção e 1 SP a cada uso.'
					: 'Desligada: o personagem não joga poção sozinho. No clique ela funciona sempre.'
				: ligada
					? 'Usada sozinha quando a barra cair abaixo do limite, sem ocupar vaga na ordem de golpes.'
					: 'Desligada: o personagem não usa esta habilidade sozinho.';
			// D-1906: o nivel em que ESTA cura sai (Curar no 5 gasta menos SP que
			// no 10). Com o seletor, o nivel e o SP moram nele; sem ele (a Aid
			// Potion, a de um nivel so, servidor antigo), a meta de sempre.
			const seletor = seletorDaCura({
				cura: c,
				ajuste,
				capaz: nivelEscolhidoServido(ctx),
				nome: c.nome || c.skillId
			});
			return `
			<div class="ic-cura-item">
				<label class="ic-switch-row">
					<span class="ic-switch">
						<input type="checkbox" data-action="cura-toggle" data-skill="${escapeHtml(c.skillId)}" ${ligada ? 'checked' : ''} />
						<span class="ic-switch-track"></span>
					</span>
					<span class="ic-switch-text">
						<span class="ic-switch-label">${escapeHtml(c.nome || c.skillId)}${seletor ? '' : ` <span class="ic-card-meta">Nv ${c.aprendido} · ${custo}</span>`}</span>
						<span class="ic-switch-sub">${explicacao}</span>
					</span>
				</label>
				${seletor ? `<div class="ic-nivel-cura${ligada ? '' : ' is-desligada'}">${seletor}</div>` : ''}
				<div class="ic-field-row ic-field-row--seg${ligada ? '' : ' ic-subsection-disabled'}">
					<span>Quem curar</span>
					${segmentadoDeAlvo(`cura.habilidades.${c.skillId}.alvo`, alvo, alcanca, 'Quem curar')}
				</div>
				${htmlDoAtaqueDaCura({ cura: c, ajuste, ligada, ctx, escapar: escapeHtml })}
			</div>`;
		})
		.join('');

	return `
		<div class="ic-card">
			<div class="ic-card-head">
				<h3>Cura</h3>
				<span class="ic-card-meta">${ligadas.length} de ${ordenadas.length} ligada${ordenadas.length === 1 ? '' : 's'}</span>
			</div>
			${cartoes}
			<div class="ic-subsection${algumaLigada ? '' : ' ic-subsection-disabled'}">
				<div class="ic-field-row">
					<span>Curar quem estiver abaixo de <span class="ic-inline-value" data-range-display="cura.curarAbaixoDe">${cura.curarAbaixoDe}%</span> de HP</span>
				</div>
				<input type="range" class="ic-slider" min="1" max="99" step="1" value="${cura.curarAbaixoDe}" data-range="cura.curarAbaixoDe" ${algumaLigada ? '' : 'disabled'} />
				<div class="ic-note">O limite vale para todas as curas ligadas. No grupo, a habilidade cura o mais ferido que estiver no alcance dela, mesmo com a sua barra cheia. Fora do grupo, cura você.</div>
			</div>
		</div>`;
}

/**
 * D-1963: "Usar como ataque contra morto-vivo", por habilidade. Desligar apaga
 * a marca (`comAtaqueDaCura`): ausente e o desligado do servidor. D-1990: o
 * interruptor aparece nas abas Suporte E Ataque, e as duas chamam ESTE
 * handler, que grava em `cfg.cura` — nao ha estado por aba, entao mudar numa
 * aparece na outra no proximo desenho.
 */
function bindAtaqueDaCura(pane) {
	pane.querySelectorAll('[data-action="cura-ataque-toggle"]').forEach(ataqueToggle => {
		ataqueToggle.addEventListener('change', () => {
			const cfg = IdleConfig.editConfig;
			cfg.cura = curaComAtaqueAlterado(garantirCura(cfg, IdleConfig.contexto), ataqueToggle.dataset.skill, !!ataqueToggle.checked);
			markDirty();
			renderBody();
		});
	});
}

function bindSuporteExtra(pane) {
	bindNiveis(pane);
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

	bindAtaqueDaCura(pane);

	pane.querySelectorAll('[data-action="cura-toggle"]').forEach(curaToggle => {
		curaToggle.addEventListener('change', () => {
			const cfg = IdleConfig.editConfig;
			const cura = garantirCura(cfg, IdleConfig.contexto);
			const skillId = curaToggle.dataset.skill;
			const atual = cura.habilidades[skillId] || { alvo: cura.alvo || 'grupo' };
			const habilidades = { ...cura.habilidades, [skillId]: { ...atual, ligada: !!curaToggle.checked } };
			// O interruptor geral acompanha as individuais (ligado se alguma estiver):
			// e ele que uma habilidade SEM entrada propria herda no servidor.
			cfg.cura = { ...cura, habilidades, ligada: Object.values(habilidades).some(h => h.ligada !== false) };
			// Migracao: a cura que estava na ordem de golpes (o desenho de D-1132)
			// sai dela — o servidor nao a aceita mais como golpe.
			cfg.rotacao = alternarCura(cfg, IdleConfig.contexto, false);
			markDirty();
			renderBody();
		});
	});
}

/* ─── Seção: Sobrevivência ───────────────────────────────────────── */

function renderSobrevivencia() {
	const cfg = IdleConfig.editConfig;
	const ctx = IdleConfig.contexto;
	const d = cfg.descanso;
	const canSentar = !!(ctx.capacidades && ctx.capacidades.sentarParaRecuperar);
	const canSp = !!(ctx.capacidades && ctx.capacidades.pocaoDeSp);
	// R16/C2-5 (14/09/2026): o modo "qualquer poção elegível" so' existe
	// quando o servidor desta build declara a capacidade — sem ela o
	// controle NAO APARECE (nada de botao que mente), mesmo padrao ja usado
	// por `pocaoDeSp`/`suporteAoGrupo` no contrato v1.
	const canAuto = !!(ctx.capacidades && ctx.capacidades.pocaoAutomatica);

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
						<div class="ic-note">Levantar sempre acima de sentar; senão ele senta e levanta no mesmo instante.</div>
					</div>
				</div>
			</div>
		</div>

		<div class="ic-card">
			<h3>Poções</h3>
			<div class="ic-note">Bebidas entre as lutas, do inventário. Escolha o frasco e com quanto de barra beber.</div>
			<div class="ic-duas">
				${renderPocao('pocaoDeHp', cfg.pocaoDeHp, ctx.consumiveisDeCura, true, 'HP', canAuto)}
				${renderPocao('pocaoDeSp', cfg.pocaoDeSp, ctx.consumiveisDeCura, canSp, 'SP', canAuto)}
			</div>
			${!canSp ? '<div class="ic-note ic-note-warn">Recuperação automática de SP não está disponível.</div>' : ''}
		</div>`;
}

/**
 * R16/C2-5 (14/09/2026): o eixo agora tem DOIS modos — "item_especifico"
 * (o de sempre: escolhe UM frasco) e "qualquer" (o servidor troca sozinho
 * quando o escolhido acabar; contrato v1 do jr-C1, `PocaoDoContrato`). O
 * modo automático so' aparece com a capacidade `pocaoAutomatica` (parâmetro
 * `canAuto`) — sem ela esta função desenha exatamente como antes.
 */
function renderPocao(fieldName, pocao, itens, enabled, label, canAuto) {
	const campoDoEixo = fieldName === 'pocaoDeSp' ? 'curaSp' : 'curaHp';
	const disponiveis = pocoesDoEixo(itens, campoDoEixo);
	const temPocao = disponiveis.length > 0;
	// O interruptor só liga se houver o que beber — e a escolha mostrada é a
	// mesma que vai no payload (escolherPocaoPadrao roda no toggle).
	const ligavel = enabled && temPocao;
	const automatico = canAuto && pocao.modo === 'qualquer';
	const selecionado = escolherPocaoPadrao(disponiveis, pocao.itemId);

	const options = disponiveis
		.map(
			it =>
				`<option value="${it.itemId}" ${selecionado === it.itemId ? 'selected' : ''}>${escapeHtml(it.nome)} (${it.estoque} no inventário)</option>`
		)
		.join('');

	return `
		<div class="ic-eixo ic-pocao${ligavel ? '' : ' ic-subsection-disabled'}">
			${switchRow(`${fieldName}.ligado`, pocao.ligado, `Poção de ${label}`, '', !ligavel)}
			${
				canAuto
					? switchRow(
							fieldName,
							automatico,
							'Automático (qualquer frasco elegível)',
							'Troca sozinho quando o escolhido acabar, em vez de travar num só.',
							!(ligavel && pocao.ligado),
							'data-modo-pocao'
						)
					: ''
			}
			<select class="ic-select" data-select="${fieldName}.itemId" data-select-number="1" ${ligavel && pocao.ligado && !automatico ? '' : 'disabled'} ${automatico ? 'hidden' : ''}>
				${options}
			</select>
			${!temPocao && enabled ? `<div class="ic-note ic-note-warn">Nenhum frasco que restaure ${label} no inventário${automatico ? ': o automático não tem o que escolher' : ''}.</div>` : ''}
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
					<span class="ic-switch-label">Beber as poções de ASPD do inventário</span>
					<span class="ic-switch-sub">Concentração, Despertar e Fúria Selvagem: bebe sozinho e repete quando o efeito acaba. Manuais e Bênção da Fortuna só são usados quando você clica.</span>
				</span>
			</label>
			${
				// A nota de desenvolvimento ("Servidos hoje (D-360)...") saiu em
				// 23/09/2026, pedido do dono: nota interna nao vai para o jogador.
				enabled
					? ''
					: '<div class="ic-note ic-note-warn">Nenhum consumível de buff existe no jogo ainda. O interruptor guarda sua escolha para quando existir.</div>'
			}
		</div>
		<div class="ic-card ic-card--tip">
			<h3>Em breve</h3>
			<div class="ic-note">Escolher quais frascos beber e em que ordem.</div>
		</div>`;
}

Network.hookPacket(PACKET.ZC.RAGIDLE_CONFIG, onConfigReceived);

/**
 * O RELOGIO DO DESEJO NA TELA (D-2046): so a LINHA de estado do cartao muda,
 * e so quando o texto muda (a chave em `data-desejo-estado`) — redesenhar a
 * aba inteira a cada segundo apagaria o rascunho em edicao e a rolagem. O
 * tique roda so com a janela aberta na aba Ataque e o cartao na tela; sem
 * eles, ele se desliga sozinho e volta no proximo desenho do cartao.
 */
let _tiqueDoDesejo = null;
function atualizarEstadoDoDesejo() {
	const root = _root();
	const win = root && root.querySelector('.ic-window');
	const linha = root && root.querySelector('.ic-card--desejo-arcano .ic-desejo-estado');
	const d = IdleConfig.contexto && IdleConfig.contexto.desejoArcano;
	if (!win || !win.classList.contains('is-open') || !linha || !d) {
		pararTiqueDoDesejo();
		return;
	}
	const restante = restanteDoDesejoAgora(Date.now());
	const chave = chaveDoEstado(d, restante);
	if (linha.getAttribute('data-desejo-estado') !== chave) {
		linha.setAttribute('data-desejo-estado', chave);
		linha.innerHTML = htmlDoEstadoDoDesejo(d, restante, escapeHtml);
	}
}
/*
 * D-2083: o relogio mostra os SEGUNDOS ("Ativo: 5:12 restantes"), entao o
 * tique acorda quando o segundo vira (`esperaAteORelogioMudar`), e nao num
 * intervalo fixo — com a fase qualquer do `setInterval` e o atraso do laco, o
 * relogio pulava um segundo e repetia o seguinte. A folga poe o despertar
 * DEPOIS da virada (o timer pode disparar um tico antes). Cada tique se
 * reagenda pelo relogio de agora, entao uma fase errada (a resposta da config
 * acertou o relogio no meio de um segundo) se corrige no tique seguinte.
 */
const FOLGA_DO_TIQUE_MS = 15;
function tiqueDoDesejo() {
	_tiqueDoDesejo = null;
	atualizarEstadoDoDesejo();
	garantirTiqueDoDesejo();
}
function garantirTiqueDoDesejo() {
	if (_tiqueDoDesejo === null && _root().querySelector('.ic-card--desejo-arcano .ic-desejo-estado')) {
		_tiqueDoDesejo = setTimeout(tiqueDoDesejo, esperaAteORelogioMudar(restanteDoDesejoAgora(Date.now())) + FOLGA_DO_TIQUE_MS);
	}
}
function pararTiqueDoDesejo() {
	if (_tiqueDoDesejo !== null) {
		clearTimeout(_tiqueDoDesejo);
		_tiqueDoDesejo = null;
	}
}
// O icone do Desejo entrou, venceu ou foi reconjurado (`Entity.js`): acerta a
// linha ja, e o tique na fase do relogio novo.
escutarRelogioDoDesejo(() => {
	pararTiqueDoDesejo();
	atualizarEstadoDoDesejo();
	garantirTiqueDoDesejo();
});

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
	// D-2077: a base da config e do personagem que saiu.
	_receptorDaConfig.esquecer();
	IdleConfig.editConfig = null;
	IdleConfig.contexto = null;
	IdleConfig.contextoObsoleto = false;
	IdleConfig.dirty = false;
	IdleConfig.problemas = [];
	// D-2046: o relogio do Desejo e do personagem que saiu.
	esquecerRelogioDoDesejo();
	pararTiqueDoDesejo();
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
