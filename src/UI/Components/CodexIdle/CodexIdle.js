/**
 * UI/Components/CodexIdle/CodexIdle.js
 *
 * A JANELA DO CODEX (D-851): o bestiario que vira ponto de atributo. Matar N
 * de uma especie cumpre uma missao, cada missao cumprida vale 1 ponto, e o
 * ponto se gasta num dos sete eixos (os seis atributos e a experiencia).
 *
 * Quatro escolhas de desenho, nenhuma estetica:
 *
 * 1. **A JANELA NUNCA CALCULA SALDO.** Pontos ganhos, pontos gastos, teto por
 *    eixo e bonus resultante chegam PRONTOS no retrato (ZC_RAGIDLE_CODEX,
 *    0x0fe3). Refazer a conta aqui daria a segunda copia da regra, e ela
 *    diria o numero velho no dia em que o dono mexesse no teto ou na tabela
 *    de missoes. E a mesma escolha de PasseIdle.js:9-13 e MissoesIdle.js:10-15.
 *
 * 2. **DOIS pacotes, e os dois verbos respondem com o retrato INTEIRO** —
 *    inclusive um `gastar` RECUSADO, que devolve o estado inalterado. Nao ha
 *    pacote de erro: a janela so redesenha o que chegou, e o jogador ve o
 *    saldo que nao mudou. Um ZC de recusa seria um segundo caminho a manter
 *    dizendo o que o primeiro ja diz.
 *
 * 3. **O botao "+" apaga em vez de sumir** quando falta ponto ou o eixo esta
 *    no teto — mesma escolha do botao de compra do PasseIdle. Sumir faria o
 *    jogador procurar o que fazer; apagado ele diz "existe, e falta alguma
 *    coisa". O SERVIDOR recusa de qualquer jeito (`gastarPonto` devolve null):
 *    o estado do botao e so para a janela nao mentir sobre o que o clique
 *    faria.
 *
 * 4. **A ORDEM dos eixos sai do RETRATO, e nao de uma lista escrita aqui.**
 *    A janela percorre as chaves de `gastos` — que e o objeto que o servidor
 *    montou a partir de `EIXOS_DO_CODEX`. Uma segunda lista aqui teria de ser
 *    editada junto com a de la, e o defeito mais comum deste projeto e
 *    exatamente esse: duas rotas para o mesmo dado, a segunda escrita a mao,
 *    acertando por coincidencia enquanto nada muda. Aqui so os ROTULOS sao
 *    locais, e um eixo desconhecido aparece com a sigla crua em vez de sumir
 *    da tela em silencio.
 *
 * Entrada na HUD: o botao "Codex" do leque (TopMenuIdle), que chama
 * CodexIdle.toggle().
 *
 * @author RagIdle
 */

import Renderer from 'Renderer/Renderer.js';
import Preferences from 'Core/Preferences.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import htmlText from './CodexIdle.html?raw';
import cssText from './CodexIdle.css?raw';

/** Manter em sincronia com o ":host"/".cx-window" do CSS (mesmo papel do
 * WINDOW_WIDTH/HEIGHT de PasseIdle.js:51-52). */
const WINDOW_WIDTH = 520;
const WINDOW_HEIGHT = 600;

/**
 * O rotulo de cada eixo. SO o rotulo — a ordem e a existencia de cada um vem
 * do retrato (escolha 4 do cabecalho). Chave que nao estiver aqui e desenhada
 * com a propria sigla, porque um eixo novo do servidor tem de APARECER,
 * mesmo feio, em vez de sumir sem sinal nenhum.
 */
const NOME_DO_EIXO = {
	str: 'Forca',
	agi: 'Agilidade',
	vit: 'Vitalidade',
	int: 'Inteligencia',
	dex: 'Destreza',
	luk: 'Sorte',
	exp: 'Experiencia'
};

/** O unico eixo cujo bonus e uma PORCENTAGEM, e nao pontos de atributo. */
const EIXO_DE_EXP = 'exp';

const CodexIdle = new GUIComponent('CodexIdle', cssText);

CodexIdle.render = () => htmlText;

/** Janela fechada nao pode engolir clique de cena — par do
 * ":host{pointer-events:none}" do CSS. */
CodexIdle.mouseMode = GUIComponent.MouseMode.CROSS;

/** O ultimo retrato que o servidor mandou (contrato v1 de ZC_RAGIDLE_CODEX). */
CodexIdle.estado = null;

const _preferences = Preferences.get(
	'CodexIdle',
	{
		x: null,
		y: null
	},
	1.0
);

function _root() {
	return CodexIdle._shadow || CodexIdle._host;
}

/** Mesmo helper privado de PasseIdle.js / MissoesIdle.js / IdleConfig.js. */
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
 * ESQUECE O PERSONAGEM ANTERIOR — ver a nota gemea em PasseIdle.js.
 * `cleanGameUI()` nao limpa componentes RAGIDLE por varredura, e a troca de
 * personagem nao recarrega a pagina: sem isto, o Codex de um personagem
 * apareceria na janela do outro ate o primeiro pedido voltar. O nome deste
 * componente TEM de estar na lista escrita a mao do `cleanGameUI` em
 * Engine/MapEngine.js — declarar a funcao sem entrar na lista deixa um metodo
 * que ninguem chama, que ja aconteceu.
 */
/*
 * ZERAR O DADO NAO BASTA — a janela tem de FECHAR e ESQUECER o desenho.
 *
 * `GUIComponent.remove()` apenas DESANEXA o host: o shadow DOM inteiro
 * sobrevive a troca de personagem, e `prepare()` e guardado por `__loaded`.
 * Zerando so `CodexIdle.estado`, o `.cx-body` continua com o HTML do
 * personagem ANTERIOR e o `.cx-window` continua com `is-open` — na volta ao
 * mapa a janela reaparece aberta, mostrando o Codex de outro personagem ate a
 * primeira resposta chegar.
 *
 * O Codex e POR PERSONAGEM (D-851): mostrar o retrato de um no outro e
 * exatamente a confusao que aquela decisao existe para evitar.
 *
 * (Achado da auditoria de 29/08/2026. As outras doze janelas RAGIDLE tem a
 * MESMA forma — so zeram o dado — e nenhuma foi tocada aqui: e conserto de
 * outra rodada, e esta nota fica como o registro de que o padrao e conhecido.)
 */
CodexIdle.limparEstadoDoPersonagem = function limparEstadoDoPersonagem() {
	CodexIdle.estado = null;
	const root = _root();
	if (!root) return;
	const win = root.querySelector('.cx-window');
	if (win) {
		win.classList.remove('is-open');
	}
	const corpo = root.querySelector('.cx-body');
	if (corpo) {
		// De volta ao estado de partida: quem abrir de novo ve "Carregando" ate
		// o retrato do personagem NOVO chegar, e nunca o do anterior.
		corpo.textContent = 'Carregando…';
	}
};

CodexIdle.init = function init() {
	const root = _root();
	// Guardas nos querySelector, pelo motivo registrado em
	// ClassChangeNotice.js:68-88 e repetido em PasseIdle.js:133-136: este init
	// roda dentro de MapEngine.init, e uma excecao aqui derruba o motor de
	// mapa inteiro. A janela e cosmetica; o que ela nao pode e custar o mundo.
	const fechar = root && root.querySelector('.cx-close');
	if (fechar) {
		fechar.addEventListener('click', onClickClose);
	}
	if (root) {
		const titulo = root.querySelector('.cx-titlebar');
		if (titulo) {
			this.draggable(titulo);
		}
		// Os botoes "+" sao redesenhados a cada retrato, entao o listener mora
		// no CORPO e olha o alvo — um listener por render vazaria sete a cada
		// resposta do servidor.
		const corpo = root.querySelector('.cx-body');
		if (corpo) {
			corpo.addEventListener('click', onClickCorpo);
		}
	}

	this._host.style.top = Math.max(0, (Renderer.height - WINDOW_HEIGHT) / 2) + 'px';
	this._host.style.left = Math.max(0, (Renderer.width - WINDOW_WIDTH) / 2) + 'px';

	render();
};

CodexIdle.onAppend = function onAppend() {
	if (_preferences.x != null && _preferences.y != null) {
		this._host.style.top = Math.min(Math.max(0, _preferences.y), Renderer.height - WINDOW_HEIGHT) + 'px';
		this._host.style.left = Math.min(Math.max(0, _preferences.x), Renderer.width - WINDOW_WIDTH) + 'px';
	}
};

CodexIdle.onRemove = function onRemove() {
	savePosition();
};

function savePosition() {
	_preferences.x = parseInt(CodexIdle._host.style.left, 10) || 0;
	_preferences.y = parseInt(CodexIdle._host.style.top, 10) || 0;
	_preferences.save();
}

/** Manda um verbo ao servidor. Os dois respondem com o retrato inteiro. */
function enviarAcao(corpo) {
	const pkt = new PACKET.CZ.RAGIDLE_CODEX_ACAO();
	pkt.json = JSON.stringify(corpo);
	Network.sendPacket(pkt);
}

/** Abre/fecha; ao abrir, pede o retrato ao servidor. */
CodexIdle.toggle = function toggle() {
	const root = _root();
	const win = root && root.querySelector('.cx-window');
	if (!win) {
		return;
	}
	if (win.classList.contains('is-open')) {
		closeWindow();
	} else {
		win.classList.add('is-open');
		CodexIdle.focus();
		enviarAcao({ acao: 'pedir' });
	}
};

function closeWindow() {
	const root = _root();
	const win = root && root.querySelector('.cx-window');
	if (win) {
		win.classList.remove('is-open');
	}
	savePosition();
}

function onClickClose(e) {
	e.stopImmediatePropagation();
	closeWindow();
}

/** Delegacao: o unico clique que o corpo trata e o "+" de um eixo. */
function onClickCorpo(e) {
	const botao = e.target && e.target.closest && e.target.closest('.cx-mais');
	if (!botao || botao.disabled) {
		return;
	}
	e.stopImmediatePropagation();
	const eixo = botao.dataset.eixo;
	if (!eixo) {
		return;
	}
	/*
	 * O BOTAO NAO TRAVA ATE A RESPOSTA, ao contrario do de compra do
	 * PasseIdle — e a diferenca e deliberada.
	 *
	 * La o clique gastava CASH, e dois cliques rapidos cobrariam duas vezes
	 * uma coisa que o jogador quis uma vez so. Aqui cada clique gasta
	 * exatamente 1 ponto: dois cliques QUEREM dizer dois pontos, e travar
	 * obrigaria a esperar a viagem de rede a cada ponto para distribuir cinco.
	 *
	 * O caso da borda tambem esta coberto: com 1 ponto e dois cliques, o
	 * segundo chega ao servidor sem saldo e cai na recusa — que devolve o
	 * retrato real. Nada e gasto a mais, e a tela se corrige sozinha.
	 */
	enviarAcao({ acao: 'gastar', eixo: eixo });
}

/* ------------------------------------------------------------------ */
/* O desenho                                                           */
/* ------------------------------------------------------------------ */

/** O placar: quanto sobrou, de quanto foi ganho. */
function placarHtml(estado) {
	const disponiveis = Number(estado.pontosDisponiveis) || 0;
	const ganhos = Number(estado.pontosGanhos) || 0;
	// `pontosGanhos - pontosDisponiveis` e a UNICA conta desta janela, e ela
	// nao inventa nada: e a soma de `gastos` que o servidor ja tem. Ela existe
	// porque o retrato manda os dois extremos e nao o meio — se um dia o
	// contrato ganhar `pontosGastos`, esta linha some.
	const gastos = Math.max(0, ganhos - disponiveis);

	const texto = disponiveis === 1 ? 'ponto para gastar' : 'pontos para gastar';

	return (
		'<div class="cx-placar">' +
		'<span class="cx-placar-numero">' +
		escapeHtml(disponiveis) +
		'</span>' +
		'<span><div class="cx-placar-texto">' +
		texto +
		'</div><div class="cx-placar-sub">' +
		escapeHtml(gastos) +
		' de ' +
		escapeHtml(ganhos) +
		' ja aplicados · cada missao cumprida vale 1 ponto' +
		'</div></span>' +
		'</div>'
	);
}

/** A lista de missoes: monstro, progresso e a marca de cumprida. */
function missoesHtml(estado) {
	const missoes = Array.isArray(estado.missoes) ? estado.missoes : [];
	if (missoes.length === 0) {
		return '<div class="cx-vazio">Nenhuma missao no catalogo.</div>';
	}

	return (
		'<div class="cx-missoes">' +
		missoes
			.map(m => {
				const alvo = Number(m.alvo) || 0;
				const abates = Number(m.abates) || 0;
				// O servidor ja limita `abates` ao alvo; o teto aqui e da
				// LARGURA, nao do dado — uma barra de 130% desenhada por cima
				// da moldura seria defeito visual de um retrato legitimo.
				const pct = alvo > 0 ? Math.min(100, Math.round((abates / alvo) * 100)) : 0;
				const marca = m.cumprida
					? '<span class="ri-badge ri-badge--verde">Cumprida</span>'
					: '';
				return (
					'<div class="cx-missao' +
					(m.cumprida ? ' is-cumprida' : '') +
					'">' +
					'<span class="cx-missao-nome">' +
					escapeHtml(m.monstro) +
					' ' +
					marca +
					'</span>' +
					'<span class="cx-missao-progresso">' +
					escapeHtml(abates) +
					' / ' +
					escapeHtml(alvo) +
					'</span>' +
					'<div class="ri-bar ri-bar--exp cx-missao-barra">' +
					'<div class="fill" style="width:' +
					pct +
					'%"></div></div>' +
					'</div>'
				);
			})
			.join('') +
		'</div>'
	);
}

/** O bonus que o eixo entrega HOJE, ja formatado (o `exp` e porcentagem). */
function bonusDoEixo(estado, eixo) {
	if (eixo === EIXO_DE_EXP) {
		const pct = Number(estado.bonusDeExpEmPorcento) || 0;
		return { valor: pct, texto: '+' + pct + '%' };
	}
	const atributo = (estado.bonusDeAtributo || {})[eixo];
	const valor = Number(atributo) || 0;
	return { valor: valor, texto: '+' + valor };
}

/** As linhas de eixo, na ordem em que o servidor mandou `gastos`. */
function eixosHtml(estado) {
	const gastos = estado.gastos || {};
	const teto = Number(estado.tetoPorEixo) || 0;
	const disponiveis = Number(estado.pontosDisponiveis) || 0;

	const linhas = Object.keys(gastos).map(eixo => {
		const gasto = Number(gastos[eixo]) || 0;
		const noTeto = gasto >= teto;
		// As DUAS condicoes que o servidor cobra em `podeGastar`, na mesma
		// ordem: eixo no teto e saldo zerado. Aqui elas so apagam o botao.
		const bloqueado = noTeto || disponiveis <= 0;
		const bonus = bonusDoEixo(estado, eixo);
		const titulo = noTeto
			? 'Este eixo ja esta no teto'
			: disponiveis <= 0
				? 'Voce nao tem ponto para gastar'
				: 'Gastar 1 ponto em ' + (NOME_DO_EIXO[eixo] || eixo);

		return (
			'<div class="cx-eixo' +
			(noTeto ? ' is-no-teto' : '') +
			'">' +
			'<span class="cx-eixo-sigla">' +
			escapeHtml(eixo) +
			'</span>' +
			'<span class="cx-eixo-nome">' +
			escapeHtml(NOME_DO_EIXO[eixo] || eixo) +
			'</span>' +
			'<span class="cx-eixo-bonus' +
			(bonus.valor === 0 ? ' is-zero' : '') +
			'">' +
			escapeHtml(bonus.texto) +
			'</span>' +
			'<span class="cx-eixo-teto">' +
			escapeHtml(gasto) +
			'/' +
			escapeHtml(teto) +
			'</span>' +
			'<button type="button" class="cx-mais ri-btn" data-eixo="' +
			escapeHtml(eixo) +
			'" title="' +
			escapeHtml(titulo) +
			'"' +
			(bloqueado ? ' disabled' : '') +
			'>+</button>' +
			'</div>'
		);
	});

	if (linhas.length === 0) {
		return '<div class="cx-vazio">O retrato do servidor nao trouxe eixo nenhum.</div>';
	}

	return '<div class="cx-eixos">' + linhas.join('') + '</div>';
}

function render() {
	const root = _root();
	if (!root) {
		return;
	}

	const estado = CodexIdle.estado;

	const saldo = root.querySelector('.cx-saldo-valor');
	if (saldo) {
		saldo.textContent = String((estado && estado.pontosDisponiveis) || 0);
	}

	const corpo = root.querySelector('.cx-body');
	if (!corpo) {
		return;
	}
	if (!estado) {
		corpo.innerHTML = '<div class="cx-carregando">Carregando…</div>';
		return;
	}

	corpo.innerHTML =
		placarHtml(estado) +
		'<div class="cx-secao"><div class="cx-secao-titulo">Onde os pontos nascem</div>' +
		missoesHtml(estado) +
		'</div>' +
		'<div class="ri-divisor"></div>' +
		'<div class="cx-secao"><div class="cx-secao-titulo">Onde gastar</div>' +
		eixosHtml(estado) +
		'</div>';
}

/* ------------------------------------------------------------------ */
/* O pacote                                                            */
/* ------------------------------------------------------------------ */

function onCodexRecebido(pkt) {
	let dados;
	try {
		dados = JSON.parse(pkt.json);
	} catch (err) {
		console.error('[CodexIdle] payload nao e JSON valido', err);
		return;
	}
	// Guarda de versao, como em PasseIdle/MissoesIdle: um retrato de contrato
	// futuro e IGNORADO em vez de desenhado meio errado.
	if (!dados || dados.v !== 1) {
		return;
	}
	CodexIdle.estado = dados;
	render();
}

Network.hookPacket(PACKET.ZC.RAGIDLE_CODEX, onCodexRecebido);

export default UIManager.addComponent(CodexIdle);
