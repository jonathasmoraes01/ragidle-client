/**
 * UI/Components/HuntAnalyzer/HuntAnalyzer.js
 *
 * "Hunt Analyzer" -- a leitura da cacada EM CURSO. Responde a UMA pergunta:
 * este spot presta? Por isso tudo aqui e RITMO (por hora) e nao total bruto.
 *
 * ── DE ONDE VEM O DADO ───────────────────────────────────────────────────
 * Esta janela nao fisga pacote nenhum. Quem acumula e
 * `registroDaCaca.js`, alimentado pelos handlers que JA recebem os pacotes:
 *   - abate  -> Engine/MapEngine/Entity.js, onEntityVanish (VT.DEAD, TYPE_MOB)
 *   - exp    -> Engine/MapEngine/Entity.js, onNotifyExp (0x07f6)
 *   - item   -> Engine/MapEngine/Item.js, onItemPickup
 *
 * O motivo de ser assim e duro: `Network.hookPacket()` guarda UM callback por
 * pacote (Network/NetworkManager.js:210). Fisgar qualquer um dos tres aqui
 * substituiria em silencio o handler nativo e apagaria o feed do canal Farm
 * -- sem erro, sem aviso, so a funcionalidade sumindo.
 *
 * ── POR QUE POLLING ──────────────────────────────────────────────────────
 * Pelo mesmo motivo de toda janela RAGIDLE (Correio, Mochila, Status): tique
 * de 250 ms lendo estado. O registro e barato de ler -- ele deriva tudo na
 * hora, sem guardar um segundo contador que pudesse divergir.
 *
 * ── O QUE ELA SE RECUSA A MOSTRAR ────────────────────────────────────────
 *   - **Zeny.** O servidor manda o mesmo ZC_PAR_CHANGE para o zeny do mob_db
 *     e para uma venda em loja (a ambiguidade esta registrada em
 *     Engine/MapEngine/Main.js:423-427). "Zeny/hora da caca" seria falso, e a
 *     nota no rodape da janela diz isso ao jogador em vez de esconder.
 *   - **Taxa de drop por monstro.** O pacote do item que cai nao diz de qual
 *     mob veio, e no spot do dono morrem ate 4 juntos (D-325). A taxa e
 *     global, por 100 abates, e o rotulo fala.
 *   - **Qualquer ritmo antes de haver janela medida.** Ver
 *     MS_MINIMOS_PARA_RITMO em registroDaCaca.js: ate la sai "--".
 */

import Renderer from 'Renderer/Renderer.js';
import Preferences from 'Core/Preferences.js';
import Session from 'Engine/SessionStorage.js';
import GUIComponent from 'UI/GUIComponent.js';
import BasicInfo from 'UI/Components/BasicInfo/BasicInfo.js';
import { estimarMsAteONivel, ler, zerar } from './registroDaCaca.js';
import htmlText from './HuntAnalyzer.html?raw';
import cssText from './HuntAnalyzer.css?raw';
import { fecharEEsquecer } from '../limpezaDeJanelaIdle.js';

/*
 * Estes DOIS numeros repetem os de HuntAnalyzer.css (":host" e ".ha-window").
 * A duplicacao e conhecida e esta anotada nas duas pontas -- cicatriz D-341.
 * Quem mudar um muda o outro.
 */
const WINDOW_WIDTH = 420;
const WINDOW_HEIGHT = 480;

/** Mesma cadencia das outras janelas RAGIDLE. */
const POLL_INTERVAL_MS = 250;

/**
 * Abaixo disto o "parado ha X" nao aparece.
 *
 * Num idle o intervalo entre dois abates e de segundos, entao um aviso que
 * acendesse a cada respiro seria ruido piscando. Ele existe para o caso que
 * importa: a caca PAROU (morreu, travou, saiu do spot) e o ritmo na tela
 * ainda descreve um passado que nao volta.
 */
const OCIOSO_VISIVEL_MS = 15_000;

const HuntAnalyzer = new GUIComponent('HuntAnalyzer', cssText);

HuntAnalyzer.render = () => htmlText;

/* CROSS: mesmo modo das demais janelas RAGIDLE flutuantes. */
HuntAnalyzer.mouseMode = GUIComponent.MouseMode.CROSS;

const _preferences = Preferences.get(
	'HuntAnalyzer',
	{
		x: null,
		y: null
	},
	1
);

let _pollTimer = null;
/** Assinaturas das listas, para nao reconstruir DOM a cada tique. */
let _sigRanking = null;
let _sigItens = null;

/*
 * A raiz e a SHADOW ROOT, com o host como reserva -- mesmo `_root()` de
 * CorreioIdle.js e StatusIdle.js, e o mesmo que GUIComponent.getRoot() faz.
 * Buscar por `.ui` devolve null aqui e todo querySelector abaixo falha.
 */
function _root() {
	return HuntAnalyzer._shadow || HuntAnalyzer._host;
}

/* ─── Formatacao ───────────────────────────────────────────────────────── */

const TRACO = '—';

/** Inteiro em pt-BR. `null` vira travessao -- nunca zero de consolo. */
function numero(valor) {
	if (valor === null || valor === undefined || !isFinite(valor)) {
		return TRACO;
	}
	return Math.round(valor).toLocaleString('pt-BR');
}

/**
 * Duracao legivel. Duas casas de grandeza no maximo ("1h 12min", "12min 5s"),
 * porque a terceira nao muda decisao nenhuma.
 */
function duracao(ms) {
	if (ms === null || ms === undefined || !isFinite(ms) || ms < 0) {
		return TRACO;
	}
	const total = Math.round(ms / 1000);
	const h = Math.floor(total / 3600);
	const min = Math.floor((total % 3600) / 60);
	const s = total % 60;

	if (h > 0) {
		return min > 0 ? `${h}h ${min}min` : `${h}h`;
	}
	if (min > 0) {
		return s > 0 ? `${min}min ${s}s` : `${min}min`;
	}
	return `${s}s`;
}

/* ─── Desenho ──────────────────────────────────────────────────────────── */

function texto(root, seletor, valor) {
	const el = root.querySelector(seletor);
	if (el) {
		el.textContent = valor;
	}
}

/**
 * A projecao de nivel: QUANTO falta, e quanto tempo isso da no ritmo medido.
 *
 * Os dois numeros respondem coisas diferentes e por isso aparecem juntos
 * (pedido do dono, 25/08/2026): o tempo depende do ritmo e muda a cada onda,
 * a exp que falta e um fato do personagem e nao se mexe com a sorte do spot.
 *
 * Sem saber o quanto falta nao ha o que dizer -- travessao. Sabendo o quanto
 * falta mas ainda sem ritmo, o numero aparece e o tempo fica em travessao
 * DENTRO do parenteses: "511 (--)" e mais honesto que esconder os 511.
 */
function projecao(restante, porHoraDaExp) {
	const falta = Number(restante) || 0;
	if (falta <= 0) {
		return TRACO;
	}
	return `${numero(falta)} (${duracao(estimarMsAteONivel(falta, porHoraDaExp))})`;
}

/**
 * Reconstroi uma lista SO quando o conteudo mudou.
 *
 * A assinatura inclui o valor, e nao so os nomes: sem isso a lista congelaria
 * no primeiro desenho e os numeros parariam de subir com o ranking estavel --
 * que e o caso comum, e portanto o que passaria despercebido.
 *
 * `mostrarParte` liga a coluna de participacao (%). Ela vale no RANKING, onde
 * "metade dos abates foi Poring" e uma leitura util, e NAO nos itens, onde o
 * dono pediu so a quantidade -- ali a porcentagem compara Jellopy com Carta e
 * nao responde pergunta nenhuma.
 */
function desenharLista(root, seletorLista, seletorVazio, linhas, sigAnterior, mostrarParte) {
	const sig = linhas.map(l => `${l.nome}:${l.valor}`).join('|');
	const lista = root.querySelector(seletorLista);
	const vazio = root.querySelector(seletorVazio);

	if (vazio) {
		vazio.hidden = linhas.length > 0;
	}
	if (sig === sigAnterior || !lista) {
		return sig;
	}

	const total = linhas.reduce((soma, l) => soma + l.valor, 0);
	lista.textContent = '';

	for (const linha of linhas) {
		const li = document.createElement('li');
		li.className = mostrarParte ? 'ha-linha' : 'ha-linha ha-linha--sem-parte';

		const nome = document.createElement('span');
		nome.className = 'ha-linha-nome';
		nome.textContent = linha.nome;
		/* O nome completo no title: a coluna corta com ellipsis. */
		nome.title = linha.nome;

		const valor = document.createElement('span');
		valor.className = 'ha-linha-valor';
		valor.textContent = numero(linha.valor);

		li.append(nome, valor);

		if (mostrarParte) {
			const parte = document.createElement('span');
			parte.className = 'ha-linha-parte';
			parte.textContent = total > 0 ? `${Math.round((linha.valor * 100) / total)}%` : TRACO;
			li.appendChild(parte);
		}

		lista.appendChild(li);
	}

	return sig;
}

function tique() {
	const root = _root();
	const gid = Session.Entity ? Session.Entity.GID : null;
	const r = ler(gid);

	texto(root, '.ha-decorrido', r.decorridoMs > 0 ? duracao(r.decorridoMs) : TRACO);

	const ocioso = root.querySelector('.ha-ocioso');
	if (ocioso) {
		const mostrar = r.decorridoMs > 0 && r.ociosoMs >= OCIOSO_VISIVEL_MS;
		ocioso.hidden = !mostrar;
		if (mostrar) {
			ocioso.textContent = `· parado há ${duracao(r.ociosoMs)}`;
		}
	}

	texto(root, '.ha-exp-base-hora', numero(r.expBasePorHora));
	texto(root, '.ha-exp-classe-hora', numero(r.expClassePorHora));
	texto(root, '.ha-exp-base', numero(r.expBase));
	texto(root, '.ha-exp-classe', numero(r.expClasse));

	/*
	 * O QUE FALTA vem da BasicInfo NATIVA, que e onde o cliente ja guarda
	 * base_exp/base_exp_next (ela recebe ZC_PAR_CHANGE normalmente). Ler dela
	 * e o mesmo que BasicInfoIdle faz -- nao ha segunda copia deste estado.
	 */
	const nativa = BasicInfo.getUI ? BasicInfo.getUI() : null;
	const restanteBase = nativa ? (nativa.base_exp_next || 0) - (nativa.base_exp || 0) : 0;
	const restanteClasse = nativa ? (nativa.job_exp_next || 0) - (nativa.job_exp || 0) : 0;

	texto(root, '.ha-falta-base', projecao(restanteBase, r.expBasePorHora));
	texto(root, '.ha-falta-classe', projecao(restanteClasse, r.expClassePorHora));

	texto(root, '.ha-abates', numero(r.abatesTotal));
	texto(root, '.ha-abates-hora', numero(r.abatesPorHora));
	texto(root, '.ha-itens-total', numero(r.itensTotal));

	_sigRanking = desenharLista(
		root,
		'.ha-ranking',
		'.ha-ranking-vazio',
		r.ranking.map(m => ({ nome: m.nome, valor: m.abates })),
		_sigRanking,
		true
	);
	_sigItens = desenharLista(
		root,
		'.ha-itens',
		'.ha-itens-vazio',
		r.itens.map(i => ({ nome: i.nome, valor: i.quantidade })),
		_sigItens,
		false
	);
}

/* ─── Ciclo de vida ────────────────────────────────────────────────────── */

HuntAnalyzer.init = function init() {
	const root = _root();

	this.draggable(root.querySelector('.ha-header'));

	root.querySelector('.ha-close').addEventListener('click', () => {
		HuntAnalyzer.toggle();
	});

	root.querySelector('.ha-zerar').addEventListener('click', () => {
		zerar();
		/* As assinaturas tambem: senao a lista velha ficaria na tela por nao
		   "ter mudado" em relacao ao ultimo desenho. */
		_sigRanking = null;
		_sigItens = null;
		tique();
	});

	this._host.style.top = Math.max(0, (Renderer.height - WINDOW_HEIGHT) / 2) + 'px';
	this._host.style.left = Math.max(0, (Renderer.width - WINDOW_WIDTH) / 2) + 'px';
};

HuntAnalyzer.onAppend = function onAppend() {
	if (_preferences.x != null && _preferences.y != null) {
		this._host.style.top = Math.min(Math.max(0, _preferences.y), Renderer.height - WINDOW_HEIGHT) + 'px';
		this._host.style.left = Math.min(Math.max(0, _preferences.x), Renderer.width - WINDOW_WIDTH) + 'px';
	}

	tique();
	iniciarPolling();
};

HuntAnalyzer.onRemove = function onRemove() {
	pararPolling();
	salvarPosicao();
};

function salvarPosicao() {
	_preferences.x = parseInt(HuntAnalyzer._host.style.left, 10) || 0;
	_preferences.y = parseInt(HuntAnalyzer._host.style.top, 10) || 0;
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

/**
 * Mantem a janela dentro da tela -- o mesmo cuidado das demais: uma posicao
 * salva com a janela maior pode cair fora depois de um resize.
 */
function manterNaTela() {
	const host = HuntAnalyzer._host;
	const topo = parseInt(host.style.top, 10) || 0;
	const esq = parseInt(host.style.left, 10) || 0;
	host.style.top = Math.min(Math.max(0, topo), Math.max(0, Renderer.height - WINDOW_HEIGHT)) + 'px';
	host.style.left = Math.min(Math.max(0, esq), Math.max(0, Renderer.width - WINDOW_WIDTH)) + 'px';
}

HuntAnalyzer.toggle = function toggle() {
	const root = _root();
	const win = root.querySelector('.ha-window');
	if (win.classList.contains('is-open')) {
		win.classList.remove('is-open');
		salvarPosicao();
	} else {
		win.classList.add('is-open');
		HuntAnalyzer.focus();
		manterNaTela();
		tique();
	}
};

/**
 * A TROCA DE PERSONAGEM ESQUECE A LEITURA DA CACADA (28/08/2026).
 *
 * Voltar ao menu de personagem NAO recarrega a pagina: `onRestartAnswer` chama
 * `cleanGameUI()` e `onRestart()`, sem `GameEngine.reload()` (o reload so
 * acontece no SAIR). Todo estado de MODULO atravessa a troca — e este arquivo
 * guarda as assinaturas do ranking e dos itens.
 *
 * O relatorio de caca e por personagem. Com a assinatura velha, o painel segue
 * mostrando o que o anterior matou e juntou.
 *
 * Chamada por `cleanGameUI()` em Engine/MapEngine.js, junto com os outros
 * componentes RAGIDLE. Quem somar estado de personagem aqui soma a linha
 * correspondente ABAIXO, e o portao `limpeza-da-troca-de-personagem.test.ts`
 * (no repo do servidor) reprova se esquecer.
 */
HuntAnalyzer.limparEstadoDoPersonagem = function limparEstadoDoPersonagem() {
	_sigRanking = null;
	_sigItens = null;
	/*
	 * ZERAR O DADO NAO BASTA: `GUIComponent.remove()` so DESANEXA o host,
	 * entao o shadow DOM (com `is-open` e o HTML do personagem anterior)
	 * atravessa a troca. Ver `UI/Components/limpezaDeJanelaIdle.js`.
	 */
	fecharEEsquecer(_root(), '.ha-window');
};

export default HuntAnalyzer;
