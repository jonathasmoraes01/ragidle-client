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
	// A peca compartilhada (auditoria de 30/08/2026). O miolo que estava aqui
	// virou `fecharEEsquecer`, e as outras nove janelas — que a nota abaixo
	// registrava como conhecidas e nao consertadas — passaram a chama-la.
	fecharEEsquecer(_root(), '.cx-window', { corpo: '.cx-body', texto: 'Carregando…' });
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
/**
 * RAGIDLE (08/09/2026, ordem do dono): a janela tem DUAS abas — "Missoes"
 * (onde os pontos nascem) e "Status" (onde os pontos sao gastos). Antes as
 * duas secoes vinham empilhadas na mesma rolagem.
 */
const ABA_PADRAO = 'missoes';
const ABAS = ['missoes', 'status'];
// Restaurada do localStorage e gravada a cada troca (memoriaDeAba.js).
let _aba = abaLembrada(_preferences, ABA_PADRAO, ABAS);

function abasHtml() {
	const aba = (id, rotulo) =>
		'<button type="button" class="cx-aba ri-tab' +
		(_aba === id ? ' is-active' : '') +
		'" data-tab="' +
		id +
		'" role="tab" aria-selected="' +
		(_aba === id ? 'true' : 'false') +
		'">' +
		rotulo +
		'</button>';
	return '<div class="cx-abas" role="tablist">' + aba('missoes', 'Missões') + aba('status', 'Status') + '</div>';
}

/** Delegacao: o "+" de um eixo, as abas, o filtro e o "Resgatar" (D-1232). */
function onClickCorpo(e) {
	/*
	 * O RESGATE vem PRIMEIRO porque os dois alvos sao botoes dentro do mesmo
	 * corpo, e um `closest('.cx-mais')` num clique de resgate devolveria
	 * `null` — o `return` de baixo engoliria o clique em silencio.
	 */
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
	const aba = e.target && e.target.closest && e.target.closest('.cx-aba');
	if (aba && aba.dataset.tab && aba.dataset.tab !== _aba) {
		e.stopImmediatePropagation();
		_aba = aba.dataset.tab;
		lembrarAba(_preferences, _aba);
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
				const marca = m.cumprida
					? '<span class="ri-badge ri-badge--verde">Cumprida</span>'
					: '';
				// O SELO DE NOVIDADE (D-1232): a mesma informacao que a bolinha
				// do menu, dentro da janela — sem ele o jogador abriria o Codex
				// por causa do ponto vermelho e teria de caçar qual entrada
				// mudou numa lista de 62.
				const selo = m.novidade
					? '<span class="ri-badge ri-badge--ouro cx-selo-novo">Novo</span>'
					: '';
				// O NOME é o `titulo` da entrada (D-1110). Ele deixou de ser o
				// nome de um monstro: uma entrada pode pedir três espécies
				// ("Família Orc"), e mostrar só a primeira mentiria sobre o que
				// falta. As espécies vão nas linhas de baixo, com o progresso
				// de cada uma (D-1231).
				//
				// AS DUAS FRENTES CONSERTARAM ISTO NO MESMO DIA (colisao 21,
				// 09/09/2026), e sobrou UMA rota: o master ja desenhava
				// `Muka 12/333 · PecoPeco 40/667` em linha, e esta versao diz
				// tambem QUANTO FALTA, que e o que o pedido cobrava com todas as
				// letras (*"tornando explicito o que esta faltando"*). Duas rotas
				// para o mesmo dado e o defeito que este projeto mais repete.
				//
				// A GUARDA `length > 1` E DO MASTER, e ela e certa: numa entrada de
				// uma especie so a linha repetiria a barra somada logo acima.
				const linhasDeEspecie =
					Array.isArray(m.alvos) && m.alvos.length > 1
						? m.alvos
								.map(a => {
									const feitos = Number(a.abates) || 0;
									const meta = Number(a.alvo) || 0;
									const falta = Number(a.falta) || 0;
									return (
										'<span class="cx-especie' +
										(a.cumprida ? ' is-ok' : '') +
										'">' +
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
										'</span></span>'
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
			: MOTIVO_DA_RECUSA[recusa] ||
				'Gastar 1 ponto em ' + (NOME_DO_EIXO[eixo] || eixo);

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

	// Uma aba por vez (08/09/2026): Missoes = onde os pontos nascem; Status = onde gastar.
	const secao =
		_aba === 'status'
			? '<div class="cx-secao"><div class="cx-secao-titulo">Onde gastar</div>' + eixosHtml(estado) + '</div>'
			: '<div class="cx-secao"><div class="cx-secao-titulo">Onde os pontos nascem</div>' + missoesHtml(estado) + '</div>';
	corpo.innerHTML = placarHtml(estado) + abasHtml() + secao;
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
