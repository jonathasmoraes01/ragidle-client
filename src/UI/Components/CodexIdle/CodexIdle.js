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
 * 5. **A JORNADA DE MIDGARD E UMA ABA, E NAO UMA QUINTA SECAO** (08/09/2026).
 *    A escolha foi medida contra a alternativa, e sao quatro razoes:
 *    - a Jornada tem TRES telas proprias (o mapa-mundi com os capitulos, a
 *      lista de um capitulo e a jornada inteira). Empilhar isso abaixo dos
 *      sete eixos poria o botao "+" a uma rolagem de distancia do topo, e o
 *      "+" e a acao mais frequente desta janela;
 *    - as missoes de um capitulo pedem um PACOTE
 *      (`{acao:'capitulo'}`): como secao, toda abertura da janela cobraria
 *      essa viagem de rede de quem so queria gastar um ponto;
 *    - o retrato ja separa os dois assuntos (`missoes` do Codex contra
 *      `jornada`), e uma aba e o espelho disso na tela;
 *    - o projeto ja tem o padrao de aba LEMBRADA (`memoriaDeAba.js`, D-797),
 *      entao quem vive na Jornada reabre na Jornada, inclusive depois do F5 e
 *      da troca de personagem.
 *    O que a aba NAO faz e mexer no que ja existia: os sete eixos, o saldo, o
 *    botao "+", as frases de recusa e a ordem vinda do retrato continuam
 *    exatamente como estavam, na aba "Codex".
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
import Session from 'Engine/SessionStorage.js';
import MapRenderer from 'Renderer/MapRenderer.js';
import HuntMap from 'UI/Components/HuntMap/HuntMap.js';
import MissoesIdle from 'UI/Components/MissoesIdle/MissoesIdle.js';
import { jornadaHtml } from './jornadaHtml.js';
import htmlText from './CodexIdle.html?raw';
import cssText from './CodexIdle.css?raw';
import { fecharEEsquecer } from '../limpezaDeJanelaIdle.js';
import { abaLembrada, lembrarAba } from '../memoriaDeAba.js';

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

/**
 * A frase de cada codigo de recusa que o servidor manda em `recusaPorEixo`.
 *
 * O CODIGO e do servidor (`RecusaDeGasto`); a FRASE e daqui. Um codigo novo
 * que a janela nao conheca cai no titulo comum "Gastar 1 ponto em X" — o botao
 * continua apagado, porque quem decide isso e `recusa !== null`, e nao esta
 * tabela.
 */
const MOTIVO_DA_RECUSA = {
	'eixo-no-teto': 'Este eixo ja esta no teto',
	'sem-ponto': 'Voce nao tem ponto para gastar'
};

/** O unico eixo cujo bonus e uma PORCENTAGEM, e nao pontos de atributo. */
const EIXO_DE_EXP = 'exp';

/**
 * As tres abas da janela.
 *
 * `missoes` e `status` sao a antiga aba unica `codex` DIVIDIDA (08/09/2026,
 * ordem do dono): as missoes do bestiario (onde os pontos nascem) e os sete
 * eixos (onde eles se gastam) empilhavam na mesma rolagem, e viraram duas
 * abas. `jornada` e a Jornada de Midgard, sem equivalente no `codex` de
 * antes.
 */
const ABAS = ['missoes', 'status', 'jornada'];
const ABA_PADRAO = 'missoes';

/**
 * As telas da aba Jornada.
 *
 * `mapa` e a porta: o mapa-mundi com os capitulos como lugares, no papel do
 * "World Map" da referencia. `jornada` e a lista inteira, com o proximo passo
 * marcado. `capitulo` e o desenho do painel de missoes da referencia (avatar,
 * contador escrito, recompensa, uma acao). `especie` e a ponte que responde
 * "onde mais este bicho aparece".
 */
const VISTA_PADRAO = 'mapa';

const CodexIdle = new GUIComponent('CodexIdle', cssText);

CodexIdle.render = () => htmlText;

/** Janela fechada nao pode engolir clique de cena — par do
 * ":host{pointer-events:none}" do CSS. */
CodexIdle.mouseMode = GUIComponent.MouseMode.CROSS;

/** O ultimo retrato que o servidor mandou (contrato v1 de ZC_RAGIDLE_CODEX). */
CodexIdle.estado = null;

/** A aba em que o jogador esta. Preferencia da PESSOA, nao do personagem. */
CodexIdle.aba = ABA_PADRAO;

/** A tela da aba Jornada: 'mapa' | 'jornada' | 'capitulo' | 'especie'. */
CodexIdle.vista = VISTA_PADRAO;

/** O capitulo aberto na tela `capitulo`, e a especie aberta na tela `especie`. */
CodexIdle.capituloAberto = null;
CodexIdle.especieAberta = null;

/**
 * AS MISSOES QUE JA CHEGARAM, por capitulo.
 *
 * Elas NAO descem todas de uma vez: sao centenas, e o campo de tamanho do
 * protocolo e u16. O servidor manda as de UM capitulo por vez, a pedido
 * (`{acao:'capitulo'}`), e a janela acumula aqui. Acumular e o que faz a
 * ponte por especie existir sem um verbo novo: ela le deste indice.
 */
CodexIdle.missoesPorCapitulo = {};

/** O capitulo cujo pedido esta EM VOO - a resposta vazia nao diz de quem e. */
let _capituloEmVoo = null;

/** A fila da varredura por especie (os capitulos que faltam carregar). */
let _filaDaVarredura = [];

const _preferences = Preferences.get(
	'CodexIdle',
	{
		x: null,
		y: null,
		// A aba lembrada (08/09/2026), pelo contrato de memoriaDeAba.js: chave nova nos
		// padroes nao exige subir a versao.
		aba: null,
		// Ocultar as missoes concluidas (08/09/2026).
		ocultarConcluidas: false
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
 * (Achado da auditoria de 29/08/2026, FECHADO em 30/08. A nota que estava
 * aqui dizia que as outras janelas tinham a mesma forma e que consertar era
 * "de outra rodada" — e ela ficou um dia inteiro sendo pendencia vestida de
 * nota historica. As nove foram consertadas, o miolo virou `fecharEEsquecer`,
 * e ha portao cobrando a chamada.)
 */
CodexIdle.limparEstadoDoPersonagem = function limparEstadoDoPersonagem() {
	CodexIdle.estado = null;
	/*
	 * As missoes da Jornada e o `abates` de cada uma sao DO PERSONAGEM: deixar
	 * o indice de pe mostraria o progresso de um na tela do outro, que e a
	 * confusao inteira que esta funcao existe para evitar. A ABA nao entra
	 * aqui, pelo mesmo motivo escrito em MissoesIdle: aba e escolha da pessoa.
	 */
	CodexIdle.missoesPorCapitulo = {};
	CodexIdle.vista = VISTA_PADRAO;
	CodexIdle.capituloAberto = null;
	CodexIdle.especieAberta = null;
	_capituloEmVoo = null;
	_filaDaVarredura = [];
	CodexIdle.aba = abaLembrada(_preferences, ABA_PADRAO, ABAS);
	// A peca compartilhada (auditoria de 30/08/2026). O miolo que estava aqui
	// virou `fecharEEsquecer`, e as outras nove janelas — que a nota abaixo
	// registrava como conhecidas e nao consertadas — passaram a chama-la.
	fecharEEsquecer(_root(), '.cx-window', { corpo: '.cx-body', texto: 'Carregando…' });
};

CodexIdle.init = function init() {
	const root = _root();
	// A aba em que o jogador estava, ANTES do render() la embaixo.
	CodexIdle.aba = abaLembrada(_preferences, ABA_PADRAO, ABAS);
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
		// As duas abas sao FIXAS no HTML (nao renascem a cada retrato), entao
		// aqui o listener pode ser por botao.
		root.querySelectorAll('.cx-tab').forEach(btn => {
			btn.addEventListener('click', onClickAba);
		});
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
		aoEntrarNaAba();
	}
};

/**
 * O que cada aba precisa PEDIR ao entrar.
 *
 * O `pedir` acima ja traz o retrato inteiro, e com ele os capitulos - o mapa e
 * a jornada inteira desenham so com isso. O que a Jornada pede a mais e o
 * CATALOGO de mapas, e nao por causa do desenho: e para o botao de viagem
 * saber dizer "este mapa abre no Nv. X" em vez de nao fazer nada. Ver
 * `motivoDeNaoViajar`.
 */
function aoEntrarNaAba() {
	if (CodexIdle.aba !== 'jornada') {
		return;
	}
	if (typeof HuntMap.pedirCatalogoSeFaltar === 'function') {
		HuntMap.pedirCatalogoSeFaltar();
	}
	if (CodexIdle.vista === 'capitulo' && CodexIdle.capituloAberto) {
		pedirCapitulo(CodexIdle.capituloAberto);
	}
}

function onClickAba(e) {
	e.stopImmediatePropagation();
	const aba = e.currentTarget.dataset.aba;
	if (!aba || aba === CodexIdle.aba) {
		return;
	}
	CodexIdle.aba = aba;
	lembrarAba(_preferences, aba);
	aoEntrarNaAba();
	render();
}

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

/**
 * Delegacao no CORPO. O corpo inteiro renasce a cada retrato, entao um
 * listener por botao vazaria dezenas por resposta do servidor - o mesmo
 * motivo pelo qual o "+" ja era delegado.
 *
 * A ordem importa: o alvo mais especifico primeiro. Um `.cx-jor-alvo` mora
 * DENTRO de uma linha de missao que tambem e clicavel, e `closest` acharia a
 * linha se ela viesse antes. O RESGATE (D-1232) tambem vem cedo pelo mesmo
 * motivo: e um botao dentro do corpo, e um `closest('.cx-mais')` num clique
 * nele devolveria `null` - o `return` de baixo engoliria o clique em
 * silencio.
 */
function onClickCorpo(e) {
	const alvo = e.target && e.target.closest ? e.target : null;
	if (alvo && cliqueDaJornada(e, alvo)) {
		return;
	}
	const resgatar = e.target && e.target.closest && e.target.closest('.cx-resgatar');
	if (resgatar) {
		e.stopImmediatePropagation();
		const id = resgatar.dataset.resgatar;
		if (!id) {
			return;
		}
		/*
		 * AQUI O BOTAO TRAVA, ao contrario do "+" logo abaixo — e a diferenca
		 * e a mesma que o comentario dele explica: dois cliques no "+" QUEREM
		 * dizer dois pontos, e dois cliques em "Resgatar" querem dizer um
		 * resgate so. O servidor ja recusa o segundo (`ja-paga`), entao isto e
		 * conforto e nao seguranca: o botao para de responder ate o retrato
		 * novo chegar e redesenhar a lista sem ele.
		 */
		resgatar.disabled = true;
		enviarAcao({ acao: 'resgatar', id: id });
		return;
	}
	const ocultar = e.target && e.target.closest && e.target.closest('[data-action="cx-ocultar"]');
	if (ocultar) {
		e.stopImmediatePropagation();
		_preferences.ocultarConcluidas = !!ocultar.checked;
		_preferences.save();
		render();
		return;
	}
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
	/*
	 * `pontosGastos` VEM DO SERVIDOR desde 30/08 — a janela nao deriva mais.
	 *
	 * O comentario aqui dizia que `ganhos - disponiveis` "nao inventa nada" e
	 * prometia que a linha sumiria "se um dia o contrato ganhar pontosGastos".
	 * A auditoria mostrou que a identidade e FALSA exatamente no ramo que o
	 * piso-zero de `pontosDisponiveis` existe para cobrir: com o catalogo
	 * encolhido, ganhos pode ser 0 com gastos 3, e o placar imprimia "0 de 0 ja
	 * aplicados" ao lado de uma linha de STR com 3 pontos e +3 de bonus.
	 *
	 * O contrato ganhou o campo. A linha sumiu.
	 */
	const gastos = Number(estado.pontosGastos) || 0;

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

/**
 * A lista de missoes: monstro, progresso POR ESPECIE, e o que falta.
 *
 * ---------------------------------------------------------------------------
 * POR QUE A LINHA POR ESPECIE ENTROU (D-1231, 08/09/2026)
 * ---------------------------------------------------------------------------
 * Relato do alfa: *"a contagem de monstros nas missoes parece incorreta"*,
 * comparando o Hunt Analyzer com a entrada "Bichos Barulhentos" e concluindo
 * que seriam *"75 de cada especie para completar os 150"*.
 *
 * A regra cadastrada nao e nenhuma das duas: sao alvos DIFERENTES por especie —
 * na FONTE, 50 Muka e 100 PecoPeco, somando 150. Esta janela desenhava so a
 * soma, entao quem matasse 150 PecoPeco e nenhum Muka via `100 / 150` — o
 * contador de PecoPeco parou no alvo dele — enquanto o Hunt Analyzer, que conta
 * TODA morte, mostrava 150. Dois numeros verdadeiros sobre coisas diferentes, e
 * nada na tela dizendo qual era qual.
 *
 * **Os numeros da tela hoje sao outros** (colisao 21, 09/09/2026): D-1207/D-1210
 * escalaram o TOTAL da missao e o repartem na proporcao da fonte, entao esta
 * entrada pede 333 Muka e 667 PecoPeco. O conserto e o mesmo, e a assimetria
 * que ele mostra ficou maior.
 *
 * A barra somada FICA (ela e o progresso da entrada, e e o que o jogador
 * reconhece), e embaixo dela vai uma linha por especie com `n / alvo` e o que
 * falta. `falta` vem do servidor pronto — a janela nao subtrai nada.
 */

/**
 * RAGIDLE (08/09/2026, ordem do dono): a lista sai da MENOR quantidade para a
 * maior (o total da missao; empate pelo titulo), e as concluidas podem ser
 * ocultadas — o interruptor fica gravado nas preferencias.
 */
function ordenarMissoes(missoes) {
	return missoes.slice().sort((a, b) => (Number(a.alvo) || 0) - (Number(b.alvo) || 0) || String(a.titulo || '').localeCompare(String(b.titulo || ''), 'pt-BR'));
}

function missoesHtml(estado) {
	const todas = Array.isArray(estado.missoes) ? estado.missoes : [];
	if (todas.length === 0) {
		return '<div class="cx-vazio">Nenhuma missao no catalogo.</div>';
	}
	const ocultar = !!_preferences.ocultarConcluidas;
	const concluidas = todas.filter(m => m.cumprida).length;
	const missoes = ordenarMissoes(ocultar ? todas.filter(m => !m.cumprida) : todas);
	const barra =
		'<label class="cx-ocultar"><input type="checkbox" data-action="cx-ocultar"' +
		(ocultar ? ' checked' : '') +
		' /> Ocultar concluidas' +
		(concluidas ? ' <span class="cx-ocultar-n">(' + escapeHtml(concluidas) + ')</span>' : '') +
		'</label>';
	if (missoes.length === 0) {
		return barra + '<div class="cx-vazio">Todas as missoes estao concluidas.</div>';
	}
	return (
		barra +
		'<div class="cx-missoes">' +
		missoes
			.map(m => {
				const alvo = Number(m.alvo) || 0;
				const abates = Number(m.abates) || 0;
				// O servidor ja limita `abates` ao alvo; o teto aqui e da
				// LARGURA, nao do dado — uma barra de 130% desenhada por cima
				// da moldura seria defeito visual de um retrato legitimo.
				const pct = alvo > 0 ? Math.min(100, Math.round((abates / alvo) * 100)) : 0;
				const marca = m.cumprida ? '<span class="ri-badge ri-badge--verde">Cumprida</span>' : '';
				// O SELO DE NOVIDADE (D-1232): a mesma informacao que a bolinha
				// do menu, dentro da janela — sem ele o jogador abriria o Codex
				// por causa do ponto vermelho e teria de caçar qual entrada
				// mudou numa lista de 62.
				const selo = m.novidade ? '<span class="ri-badge ri-badge--ouro cx-selo-novo">Novo</span>' : '';
				// O NOME é o `titulo` da entrada (D-1110). Ele deixou de ser o
				// nome de um monstro: uma entrada pode pedir três espécies
				// ("Família Orc"), e mostrar só a primeira mentiria sobre o que
				// falta. As espécies vão nas linhas de baixo, com o progresso de
				// cada uma (D-1231) E como BOTAO — a ponte entrada -> missoes
				// daquela especie (08/09/2026): leva a lista de todos os mapas e
				// objetivos da Jornada daquele `mobId`. Uma especie que vive em
				// varios mapas tem UMA entrada aqui e varias missoes la, e este e
				// o unico caminho que liga as duas sem o jogador ter de adivinhar
				// em que capitulo procurar. As duas classes convivem no mesmo
				// elemento (`cx-especie` para o desenho, `cx-ponte-especie` para
				// o clique em `cliqueDaJornada`) em vez de duplicar a linha.
				const linhasDeEspecie =
					Array.isArray(m.alvos) && m.alvos.length > 0
						? m.alvos
								.map(a => {
									const feitos = Number(a.abates) || 0;
									const meta = Number(a.alvo) || 0;
									const falta = Number(a.falta) || 0;
									return (
										'<button type="button" class="cx-especie cx-ponte-especie' +
										(a.cumprida ? ' is-ok' : '') +
										'" data-mobid="' +
										escapeHtml(a.mobId == null ? '' : a.mobId) +
										'" title="Ver as missões da Jornada desta espécie">' +
										'<span class="cx-especie-nome">' +
										escapeHtml(a.monstro) +
										'</span>' +
										'<span class="cx-especie-conta">' +
										escapeHtml(feitos) +
										' / ' +
										escapeHtml(meta) +
										'</span>' +
										'<span class="cx-especie-falta">' +
										(a.cumprida ? 'completo' : 'faltam ' + escapeHtml(falta)) +
										'</span></button>'
									);
								})
								.join('')
						: '';
				// O que a entrada paga ALÉM do ponto — vazio nas oito de D-851.
				const premio = Array.isArray(m.recompensas)
					? m.recompensas
							.map(r =>
								r.tipo === 'zeny'
									? r.quantidade + ' zeny'
									: r.tipo === 'expBase'
										? r.quantidade + ' EXP de base'
										: r.tipo === 'expClasse'
											? r.quantidade + ' EXP de classe'
											: ''
							)
							.filter(Boolean)
							.join(' · ')
					: '';
				/*
				 * O BOTAO DE RESGATE (D-1232) só existe quando o servidor diz
				 * `aResgatar`. Ele NÃO é derivado de `cumprida && premio`: o
				 * servidor é quem sabe o que já foi pago (`pagas`), e uma janela
				 * que decidisse sozinha mostraria o botão de novo depois de um
				 * resgate que ela ainda não viu.
				 */
				const resgate = m.aResgatar
					? '<button type="button" class="cx-resgatar ri-btn ri-btn--primario" ' +
						'data-resgatar="' +
						escapeHtml(m.id) +
						'">Resgatar</button>'
					: '';
				return (
					'<div class="cx-missao' +
					(m.cumprida ? ' is-cumprida' : '') +
					(m.novidade ? ' is-novidade' : '') +
					'" data-entrada="' +
					escapeHtml(m.id || '') +
					'" data-mobids="' +
					escapeHtml((Array.isArray(m.alvos) ? m.alvos : []).map(a => a.mobId).join(',')) +
					'">' +
					'<span class="cx-missao-nome">' +
					escapeHtml(m.titulo || m.monstro || '') +
					' ' +
					marca +
					selo +
					'</span>' +
					(linhasDeEspecie
						? '<div class="cx-especies">' + linhasDeEspecie + '</div>'
						: '') +
					(premio ? '<span class="cx-missao-premio">+1 ponto · ' + escapeHtml(premio) + '</span>' : '') +
					'<span class="cx-missao-progresso">' +
					escapeHtml(abates) +
					' / ' +
					escapeHtml(alvo) +
					'</span>' +
					'<div class="ri-bar ri-bar--exp cx-missao-barra">' +
					'<div class="fill" style="width:' +
					pct +
					'%"></div></div>' +
					resgate +
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
	/*
	 * O retrato ANTIGO nao tem `recusaPorEixo`, e a resposta certa e BLOQUEAR.
	 *
	 * Sem esta guarda, um servidor sem o campo daria `{}` e TODOS os botoes
	 * apareceriam clicaveis. O servidor recusaria em silencio (item 2 do
	 * cabecalho: nao ha pacote de erro), e o jogador clicaria num "+" que nunca
	 * faz nada — o pior dos dois mundos, porque a janela estaria afirmando que
	 * da, com confianca.
	 *
	 * Recusar tudo com a frase explicita e a postura do projeto: recusa
	 * explicita em vez de aproximacao.
	 */
	const semVeredito = !estado.recusaPorEixo;
	const recusas = estado.recusaPorEixo || {};

	const linhas = Object.keys(gastos).map(eixo => {
		const gasto = Number(gastos[eixo]) || 0;
		/*
		 * O VEREDITO E DO SERVIDOR (achado da auditoria de 30/08/2026).
		 *
		 * Aqui estavam as duas condicoes reescritas a mao — `gasto >= teto ||
		 * disponiveis <= 0` — com um comentario declarando que estavam "na
		 * mesma ordem" da regra de la. Era a segunda rota escrita a mao que o
		 * item 4 do cabecalho deste arquivo proibe, acertando por coincidencia
		 * enquanto teto e saldo forem as unicas condicoes que existem.
		 *
		 * Hoje o retrato traz `recusaPorEixo`, que E o retorno de
		 * `motivoDaRecusa` — o mesmo que `gastarPonto` consulta. O que continua
		 * local e so o ROTULO: traduzir codigo em frase e trabalho de janela.
		 */
		const recusa = recusas[eixo] || null;
		const noTeto = recusa === 'eixo-no-teto';
		const bloqueado = semVeredito || recusa !== null;
		const bonus = bonusDoEixo(estado, eixo);
		const titulo = semVeredito
			? 'Este servidor nao diz se o gasto e possivel — atualize o cliente'
			: MOTIVO_DA_RECUSA[recusa] || 'Gastar 1 ponto em ' + (NOME_DO_EIXO[eixo] || eixo);

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

	root.querySelectorAll('.cx-tab').forEach(btn => {
		btn.classList.toggle('is-active', btn.dataset.aba === CodexIdle.aba);
	});

	const corpo = root.querySelector('.cx-body');
	if (!corpo) {
		return;
	}
	if (!estado) {
		corpo.innerHTML = '<div class="cx-carregando">Carregando…</div>';
		return;
	}

	if (CodexIdle.aba === 'jornada') {
		corpo.innerHTML = jornadaHtml(estado, contextoDaJornada());
		return;
	}

	// Uma aba por vez (08/09/2026): Missoes = onde os pontos nascem; Status =
	// onde gastar. A aba em si e a barra FIXA de `.cx-tab` do HTML (mesmo
	// padrao da Jornada), e nao `abasHtml()` gerado aqui — um so jeito de
	// desenhar aba nesta janela.
	corpo.innerHTML =
		placarHtml(estado) +
		(CodexIdle.aba === 'status'
			? '<div class="cx-secao"><div class="cx-secao-titulo">Onde gastar</div>' + eixosHtml(estado) + '</div>'
			: '<div class="cx-secao"><div class="cx-secao-titulo">Onde os pontos nascem</div>' + missoesHtml(estado) + '</div>');
}

/* ------------------------------------------------------------------ */
/* A JORNADA DE MIDGARD - o que so a janela sabe                       */
/* ------------------------------------------------------------------ */
/*
 * O DESENHO mora em `jornadaHtml.js`, e a razao esta escrita la: assim ele e
 * FOTOGRAFAVEL sem o cliente inteiro de pe, e a prova de tela mede o codigo
 * que roda no jogo em vez de uma copia feita para o arnes.
 *
 * O que fica aqui e o que so existe com o jogo rodando: a sessao (nivel,
 * morte, mapa atual), o catalogo do Mapa de Caca e o que ja chegou do
 * servidor. Eles entram la como ARGUMENTO.
 */

/** O que o cliente sabe hoje sobre o proprio personagem, para a viagem. */
function situacaoDoJogador() {
	const entidade = Session && Session.Entity;
	const vida = entidade && entidade.life;
	const mapa = MapRenderer && MapRenderer.currentMap ? String(MapRenderer.currentMap) : '';
	return {
		nivelDoJogador: (entidade && Number(entidade.clevel)) || 0,
		// A regra do `DeathWindow`: `hp_max > 0` e o que separa "cadaver" de
		// "os pacotes de vida ainda nao chegaram" (a entidade nasce com -1).
		morto: !!(vida && Number(vida.hp_max) > 0 && Number(vida.hp) <= 0),
		mapaAtual: mapa.replace(/\.gat$/i, '')
	};
}

/** O nivel em que um mapa abre, lido do catalogo do Mapa de Caca. */
function nivelQueAbre(mapa) {
	if (typeof HuntMap.mapaDoCatalogo !== 'function') {
		return null;
	}
	const doCatalogo = HuntMap.mapaDoCatalogo(mapa);
	return doCatalogo && Number.isFinite(Number(doCatalogo.nivelQueAbre)) ? Number(doCatalogo.nivelQueAbre) : null;
}

/** O contexto que `jornadaHtml.js` precisa, montado do estado vivo da janela. */
function contextoDaJornada() {
	return {
		estado: CodexIdle.estado,
		vista: CodexIdle.vista,
		capituloAberto: CodexIdle.capituloAberto,
		especieAberta: CodexIdle.especieAberta,
		missoesPorCapitulo: CodexIdle.missoesPorCapitulo,
		situacao: situacaoDoJogador(),
		nivelQueAbre: nivelQueAbre,
		faltamNaVarredura: _filaDaVarredura.length
	};
}

/* ------------------------------------------------------------------ */
/* Os cliques da Jornada                                               */
/* ------------------------------------------------------------------ */

/**
 * @returns {boolean} true quando o clique era da Jornada e ja foi tratado.
 */
function cliqueDaJornada(e, alvo) {
	const pino = alvo.closest('[data-capitulo]');
	if (pino && !pino.disabled) {
		e.stopImmediatePropagation();
		abrirCapitulo(pino.dataset.capitulo);
		return true;
	}

	const viagem = alvo.closest('[data-viajar]');
	if (viagem && !viagem.disabled) {
		e.stopImmediatePropagation();
		viajarPara(viagem.dataset.viajar);
		return true;
	}

	const paraOCodex = alvo.closest('[data-codex-mobid]');
	if (paraOCodex) {
		e.stopImmediatePropagation();
		abrirEntradaDoCodex(Number(paraOCodex.dataset.codexMobid));
		return true;
	}

	const paraAEspecie = alvo.closest('.cx-ponte-especie');
	if (paraAEspecie) {
		e.stopImmediatePropagation();
		abrirEspecie(Number(paraAEspecie.dataset.mobid));
		return true;
	}

	const troca = alvo.closest('[data-vista]');
	if (troca) {
		e.stopImmediatePropagation();
		CodexIdle.vista = troca.dataset.vista;
		CodexIdle.capituloAberto = null;
		CodexIdle.especieAberta = null;
		render();
		return true;
	}

	const missoes = alvo.closest('.cx-jor-abrir-missoes');
	if (missoes) {
		e.stopImmediatePropagation();
		MissoesIdle.toggle();
		return true;
	}

	return false;
}

/** Pede as missoes de um capitulo, uma vez por capitulo. */
function pedirCapitulo(id) {
	if (!id || Object.prototype.hasOwnProperty.call(CodexIdle.missoesPorCapitulo, id)) {
		return;
	}
	_capituloEmVoo = id;
	enviarAcao({ acao: 'capitulo', capitulo: id });
}

function abrirCapitulo(id) {
	if (!id) {
		return;
	}
	CodexIdle.vista = 'capitulo';
	CodexIdle.capituloAberto = id;
	CodexIdle.especieAberta = null;
	pedirCapitulo(id);
	render();
}

/**
 * A PONTE ENTRADA -> MISSOES DAQUELA ESPECIE.
 *
 * As missoes chegam por capitulo, entao a lista completa de uma especie so
 * existe depois que os capitulos chegaram. Em vez de esperar, a tela abre com
 * o que ja tem e VARRE o resto um a um, redesenhando a cada resposta - uma
 * rajada de N pacotes de uma vez seria pior para o servidor e para o jogador,
 * que veria a tela parada do mesmo jeito.
 */
function abrirEspecie(mobId) {
	if (!Number.isFinite(mobId)) {
		return;
	}
	CodexIdle.aba = 'jornada';
	lembrarAba(_preferences, 'jornada');
	CodexIdle.vista = 'especie';
	CodexIdle.especieAberta = mobId;
	CodexIdle.capituloAberto = null;

	const jor = (CodexIdle.estado && CodexIdle.estado.jornada) || {};
	_filaDaVarredura = (jor.capitulos || [])
		.map(c => c && c.id)
		.filter(id => id && !Object.prototype.hasOwnProperty.call(CodexIdle.missoesPorCapitulo, id));
	render();
	seguirVarredura();
}

function seguirVarredura() {
	if (_capituloEmVoo || _filaDaVarredura.length === 0) {
		return;
	}
	pedirCapitulo(_filaDaVarredura[0]);
}

/**
 * A PONTE MISSAO -> ENTRADA DE ESPECIE DO CODEX.
 *
 * Troca de aba, desenha e ACENDE a entrada que cita aquele `mobId`. Sem o
 * realce, cair numa lista de 38 entradas seria o mesmo que nao ter ponte.
 */
function abrirEntradaDoCodex(mobId) {
	if (!Number.isFinite(mobId)) {
		return;
	}
	CodexIdle.aba = 'missoes';
	lembrarAba(_preferences, 'missoes');
	render();

	const root = _root();
	const corpo = root && root.querySelector('.cx-body');
	if (!corpo) {
		return;
	}
	const linha = Array.prototype.find.call(corpo.querySelectorAll('.cx-missao[data-mobids]'), el =>
		String(el.dataset.mobids || '')
			.split(',')
			.includes(String(mobId))
	);
	if (!linha) {
		return;
	}
	linha.classList.add('is-realce');
	if (typeof linha.scrollIntoView === 'function') {
		linha.scrollIntoView({ block: 'center' });
	}
}

/**
 * A viagem. MESMO pacote que o Mapa de Caca e a janela de Missoes mandam
 * (`CZ_RAGIDLE_VIAJAR`, 0x0ff2) - nenhum caminho novo, so um segundo gatilho.
 * A janela FECHA porque o servidor responde com o mapmove e o cliente recarrega
 * o mapa por baixo dela, como o botao do atlas ja faz.
 */
function viajarPara(mapa) {
	if (!mapa) {
		return;
	}
	const pkt = new PACKET.CZ.RAGIDLE_VIAJAR();
	pkt.mapName = mapa;
	Network.sendPacket(pkt);
	closeWindow();
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
	acumularMissoesDaJornada(dados);
	render();
	seguirVarredura();
}

/**
 * AS MISSOES DE UM CAPITULO CHEGARAM - guarde-as.
 *
 * O retrato vem inteiro em toda resposta, e `jornada.missoes` so aparece na
 * resposta do verbo `capitulo`. Duas armadilhas tratadas aqui:
 *
 * 1. **capitulo VAZIO nao diz de quem e.** Uma lista sem elementos nao carrega
 *    o `capitulo` de ninguem, e sem marcar o capitulo como carregado a janela
 *    ficaria pedindo o mesmo para sempre. Por isso o `_capituloEmVoo`.
 * 2. **a resposta pode trazer missoes de mais de um capitulo** se um dia o
 *    servidor agrupar - agrupar por `m.capitulo` cobre os dois casos sem
 *    supor nada.
 */
function acumularMissoesDaJornada(dados) {
	const jornada = dados.jornada;
	const pedido = _capituloEmVoo;
	if (!jornada || !Array.isArray(jornada.missoes)) {
		return;
	}
	_capituloEmVoo = null;

	const porCapitulo = {};
	for (const m of jornada.missoes) {
		const id = (m && m.capitulo) || pedido;
		if (!id) {
			continue;
		}
		(porCapitulo[id] = porCapitulo[id] || []).push(m);
	}
	if (pedido && !porCapitulo[pedido]) {
		porCapitulo[pedido] = [];
	}
	for (const id of Object.keys(porCapitulo)) {
		porCapitulo[id].sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0));
		CodexIdle.missoesPorCapitulo[id] = porCapitulo[id];
	}
	_filaDaVarredura = _filaDaVarredura.filter(
		id => !Object.prototype.hasOwnProperty.call(CodexIdle.missoesPorCapitulo, id)
	);
}

Network.hookPacket(PACKET.ZC.RAGIDLE_CODEX, onCodexRecebido);

/*
 * O CATALOGO NAO E DESTA JANELA - ele e do Mapa de Caca, e `hookPacket` e
 * atribuicao simples: enganchar `ZC_RAGIDLE_CATALOGO` aqui SUBSTITUIRIA o
 * gancho de la em silencio, e o atlas pararia de funcionar sem nada acusar.
 * Entao a Jornada pede por emprestimo e so avisa quando o dado chegar, para o
 * botao de viagem trocar "Ir para X" pelo motivo de a viagem nao sair.
 */
if (typeof HuntMap.aoChegarCatalogo === 'function') {
	HuntMap.aoChegarCatalogo(() => {
		if (CodexIdle.aba === 'jornada' && CodexIdle.estado) {
			render();
		}
	});
}

export default UIManager.addComponent(CodexIdle);
