/**
 * UI/Components/TutorialIdle/TutorialIdle.js
 *
 * A CAMADA GUIADA DO TUTORIAL (frente D do CONTRATO-JORNADA.md, secao 7).
 *
 * Uma camada de tela cheia com quatro pecas: a mascara escura com UM furo
 * exatamente no controle-alvo, o anel de realce na boca do furo, a mao do
 * proprio Ragnarok encostada no controle, e o balao com quem fala, a frase
 * curta e o "Pular tutorial".
 *
 * A gramatica e a da gravacao do AFK Arena (`docs/referencia-tutorial/`):
 * uma acao por vez, uma frase curta no imperativo citando o ROTULO do
 * controle entre aspas, um personagem falando em primeira pessoa, o alvo
 * destacado e o resto escurecido, e NENHUM botao "Proximo" que substitua a
 * acao. A pele e a do Ragnarok.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * QUEM MANDA E O SERVIDOR
 * ═══════════════════════════════════════════════════════════════════════
 * A etapa vigente mora no personagem (`servidor/tutorial.ts`, secao 6 do
 * contrato) e desce em ZC_RAGIDLE_TUTORIAL (0x0fdf). Este componente nao
 * guarda progresso: ele PEDE (`{acao:'pedir'}`) ao entrar no mapa e redesenha
 * o que chegar. Por isso reconexao, morte, troca de mapa e fechar a janela
 * nao perdem nada - e o retrato do servidor, e nao um contador local, que
 * decide o que a tela mostra.
 *
 * Quando o cliente ve a condicao REAL de uma etapa cumprida (a janela abriu,
 * o pacote chegou, o mapa mudou), ele manda `{acao:'avancar', etapa: N}` com
 * **N = etapa vigente + 1**, isto e, a etapa para a qual ele quer ir. O
 * servidor so aceita se N for exatamente `atual + 1`, entao pacote repetido e
 * reconexao nao pulam etapa. Esta e a leitura literal da guarda escrita na
 * secao 6 do contrato, e ela e o contrato do lado de ca: se a frente C
 * implementar a guarda com outro sentido de `etapa`, os dois lados param de
 * se entender em silencio.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * POR QUE POLLING, E NAO `hookPacket` NOS PACOTES DOS OUTROS
 * ═══════════════════════════════════════════════════════════════════════
 * `Network.hookPacket()` SOBRESCREVE o handler em vez de encadear
 * (NetworkManager.js:200-210). Enganchar ZC_RAGIDLE_MISSOES aqui roubaria o
 * pacote da janela de Missoes e do rastreador, que e exatamente o defeito que
 * o cabecalho de MissoesTrackerIdle.js documenta. Entao este componente
 * engancha SO o pacote que e dele (0x0fdf) e LE por polling de 250ms o estado
 * que os donos ja mantem: `MissoesIdle.missoes`/`.execucao`,
 * `Session.Entity.weapon`, `MapRenderer.currentMap` e o registro da cacada. E
 * o mesmo idioma do DeathWindow (que sonda `Session.Entity.life`) e do
 * rastreador.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * AS CINCO ARMADILHAS DO CONTRATO, E ONDE CADA UMA E TRATADA
 * ═══════════════════════════════════════════════════════════════════════
 *   1. `zoom` -> `zoom: 1 !important` no `:host` (TutorialIdle.css, com a
 *      conta inteira no cabecalho de la). Ler e escrever passam a ser a mesma
 *      unidade, e nao ha conversao a esquecer.
 *   2. Shadow DOM -> `acharAlvo()` resolve `document.getElementById(host)
 *      .shadowRoot.querySelector(seletor)`, nunca `document.querySelector`.
 *   3. Leque fechado nao tem caixa -> `recorteDoAlvo()` devolve `null` para
 *      uma caixa 0x0, e a etapa cai no `quandoSumir`, que aponta a porta de
 *      volta em vez do vazio.
 *   4. Celular -> a etapa 1 ("abra o Menu") e obrigatoria para todo mundo, e
 *      e ela que faz "Missoes" e "Codex" existirem no celular
 *      (`.ri-vertical` esconde os `.tm-item` do cluster). O verbo da frase
 *      troca com o ponteiro.
 *   5. Redimensionar/rolar/janela arrastada -> `onResize` (chamado pelo
 *      `UIManager.fixResizeOverflow`) MAIS um `ResizeObserver` no elemento
 *      alvo, porque o alvo muda de caixa sem a viewport mudar.
 *
 * @author RagIdle
 */

import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import Session from 'Engine/SessionStorage.js';
import MapRenderer from 'Renderer/MapRenderer.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import Cursor from 'UI/CursorManager.js';
import RiIcones from 'UI/ri-icones.js';
import MissoesIdle from 'UI/Components/MissoesIdle/MissoesIdle.js';
import { ler as lerRegistroDaCaca } from 'UI/Components/HuntAnalyzer/registroDaCaca.js';
import htmlText from './TutorialIdle.html?raw';
import cssText from './TutorialIdle.css?raw';
import {
	ETAPAS,
	QUEM_GUIA,
	TOTAL_DE_ETAPAS,
	casaDoBalao,
	etapaDe,
	fraseDaEtapa,
	posicaoDaMao,
	recorteDoAlvo,
	retangulosDaMascara
} from './etapasDoTutorial.js';

/** O ritmo do polling. O mesmo do DeathWindow e do rastreador de missoes. */
const MS_DO_TIQUE = 250;

/**
 * A MAO: acao CLICK (`Cursor.ACTION.CLICK = 2`, CursorManager.js:84-95),
 * QUADRO 0.
 *
 * Os tres quadros da acao 2 foram renderizados do `data/sprite/cursors.spr`
 * deste cliente e OLHADOS (contato em `docs/provas-tutorial/`): o quadro 0 e a
 * luva com o indicador ESTICADO, apontando para cima e para a esquerda; os
 * quadros 1 e 2 sao a animacao de aperto, com o dedo ja recolhido. Uma mao de
 * dedo recolhido nao aponta nada, entao a camada usa o quadro 0 parado, e nao
 * a animacao.
 */
const ACAO_DA_MAO = 2;
const QUADRO_DA_MAO = 0;

/** O quadro compilado do cursor e 50x50; a camada o desenha a 2x (D-326:
 *  arte do cliente amplia por numero INTEIRO). */
const ESCALA_DA_MAO = 2;
const LADO_DA_MAO = 50 * ESCALA_DA_MAO;

/** Onde a ponta do dedo cai quando a varredura do alfa nao foi possivel.
 *  E o canto superior esquerdo com uma folga: a arte aponta para la. */
const PONTA_DE_RESERVA = { x: 8, y: 8 };

/** Tamanho estimado da faixa do balao, para escolher a casa dele. O numero
 *  e recalculado com a altura MEDIDA assim que o balao existe na tela. */
const BALAO_PADRAO = { altura: 120, margem: 96 };

const TutorialIdle = new GUIComponent('TutorialIdle', cssText);

TutorialIdle.render = () => htmlText.replace(/<!--RI_ICONE:(\w+)-->/g, (_, chave) => RiIcones[chave] || '');

/**
 * A camada nunca engole clique por si: fechada ela e transparente, e aberta
 * quem bloqueia sao os quatro retangulos da mascara. CROSS e o mesmo modo do
 * DeathWindow e das janelas Idle.
 */
TutorialIdle.mouseMode = GUIComponent.MouseMode.CROSS;
TutorialIdle.needFocus = false;

/** O ultimo retrato do servidor (contrato v1 de ZC_RAGIDLE_TUTORIAL). */
TutorialIdle.estado = null;

let _timer = null;
let _observador = null;
let _alvoObservado = null;
/** Assinatura da ultima geometria desenhada, para nao reescrever estilo a 4Hz. */
let _assinatura = '';
/** Etapa cuja `avancar` ja foi mandada (o servidor pode demorar a responder). */
let _avancoMandado = 0;
/** O que a etapa vigente viu quando comecou (mapa, arma, abates, contador). */
let _marco = null;
/** Ja pedi ao servidor para COMECAR? Sem esta guarda, um retrato repetido de
 *  'nao-iniciado' viraria um laco de `retomar`. */
let _comecoPedido = false;
/** A ponta do dedo dentro da imagem da mao, medida uma vez. */
let _pontaDaMao = null;
let _urlDaMao = null;

function _root() {
	return TutorialIdle._shadow || TutorialIdle._host;
}

/* ------------------------------------------------------------------ */
/* O fio com o servidor                                                */
/* ------------------------------------------------------------------ */

function mandar(acao, etapa) {
	if (!PACKET.CZ.RAGIDLE_TUTORIAL_ACAO) {
		return;
	}
	const pkt = new PACKET.CZ.RAGIDLE_TUTORIAL_ACAO();
	const corpo = { acao };
	if (typeof etapa === 'number') {
		corpo.etapa = etapa;
	}
	pkt.json = JSON.stringify(corpo);
	Network.sendPacket(pkt);
}

/** Pede o retrato. Chamado ao entrar no mapa e por quem quiser ressincronizar. */
TutorialIdle.pedirAoServidor = function pedirAoServidor() {
	mandar('pedir');
};

/**
 * "Retomar pela ajuda": reabre o tutorial de onde ele parou (ou do comeco,
 * para quem pulou). Quem chama e a linha "Rever o tutorial" da Configuracao
 * idle (IdleConfig).
 */
TutorialIdle.retomar = function retomar() {
	mandar('retomar');
};

/** O tutorial esta desenhando alguma etapa agora? Leitura para quem precisa
 *  saber (a linha da ajuda, e uma prova de tela). */
TutorialIdle.estaNaTela = function estaNaTela() {
	const root = _root();
	const camada = root && root.querySelector('.tu-camada');
	return !!(camada && camada.classList.contains('is-open'));
};

/** Limpeza da troca de personagem (a lista de `cleanGameUI`). O retrato e do
 *  personagem que saiu; herda-lo desenharia a etapa do outro. */
TutorialIdle.limparEstadoDoPersonagem = function limparEstadoDoPersonagem() {
	TutorialIdle.estado = null;
	_assinatura = '';
	_avancoMandado = 0;
	_marco = null;
	_comecoPedido = false;
	desobservar();
	const root = _root();
	const camada = root && root.querySelector('.tu-camada');
	if (camada) {
		camada.classList.remove('is-open');
	}
};

/* ------------------------------------------------------------------ */
/* Achar o alvo (armadilha 2: tudo mora em Shadow DOM)                 */
/* ------------------------------------------------------------------ */

/**
 * @param {{host:string, seletor:string}|null} descricao
 * @returns {Element|null}
 */
function acharAlvo(descricao) {
	if (!descricao) {
		return null;
	}
	const host = document.getElementById(descricao.host);
	if (!host || !host.shadowRoot) {
		return null;
	}
	return host.shadowRoot.querySelector(descricao.seletor);
}

/** A janela RAGIDLE de nome `<id>` esta aberta? Mesma leitura que o TopMenuIdle
 *  faz: as janelas Idle marcam `.xx-window.is-open`. */
function janelaAberta(hostId, seletor) {
	const el = acharAlvo({ host: hostId, seletor });
	return !!(el && el.classList.contains('is-open'));
}

/* ------------------------------------------------------------------ */
/* A condicao REAL de cada etapa                                       */
/* ------------------------------------------------------------------ */

/** O que a etapa precisa lembrar de "antes" para saber que algo andou. */
function marcoDaEtapa(numero) {
	const execucao = MissoesIdle.execucao || null;
	return {
		numero,
		mapa: MapRenderer.currentMap || '',
		arma: (Session.Entity && Session.Entity.weapon) || 0,
		abates: abatesAgora(),
		progresso: execucao && execucao.passo ? execucao.passo.progresso || 0 : 0
	};
}

function abatesAgora() {
	const gid = Session.Entity && Session.Entity.GID;
	if (!gid) {
		return 0;
	}
	try {
		const r = lerRegistroDaCaca(gid);
		return (r && r.abatesTotal) || 0;
	} catch (_erro) {
		return 0;
	}
}

/**
 * A etapa `numero` foi cumprida DE VERDADE?
 *
 * Nenhum ramo aqui olha para um clique: todos olham para o RESULTADO (a
 * janela abriu, o servidor confirmou, o mapa mudou, o contador andou). E o que
 * a regra 6 da gravacao exige, e o que impede um "Proximo" disfarcado.
 */
function etapaCumprida(numero) {
	const execucao = MissoesIdle.execucao || null;
	switch (numero) {
		case 1: {
			/* O leque abriu: o `.tm-fan` ganha `is-open` (TopMenuIdle.js:750). */
			return janelaAberta('TopMenuIdle', '.tm-fan');
		}
		case 2:
			return janelaAberta('MissoesIdle', '.mi-window');
		case 3:
			/* O SERVIDOR marcou a missao ativa. `execucao` vem do
			   ZC_RAGIDLE_MISSOES, que a janela de Missoes recebe e guarda. */
			return !!(execucao && execucao.ativaId);
		case 4: {
			/* A peca vestida CONFIRMADA: `Session.Entity.weapon` so muda quando
			   o servidor manda o ZC_SPRITE_CHANGE (Engine/MapEngine/Entity.js).
			   Comparar com o marco cobre tanto "estava sem arma" quanto "trocou
			   de arma". */
			const arma = (Session.Entity && Session.Entity.weapon) || 0;
			return arma !== 0 && (!_marco || arma !== _marco.arma);
		}
		case 5:
			/* Chegou: o mapa carregado nao e mais o de quando a etapa comecou. */
			return !!(_marco && MapRenderer.currentMap && MapRenderer.currentMap !== _marco.mapa);
		case 6:
			/* O primeiro abate depois que a etapa comecou. */
			return abatesAgora() > (_marco ? _marco.abates : 0);
		case 7: {
			/* O contador do objetivo andou. */
			const agora = execucao && execucao.passo ? execucao.passo.progresso || 0 : 0;
			return agora > (_marco ? _marco.progresso : 0);
		}
		case 8:
			return janelaAberta('CodexIdle', '.cx-window');
		default:
			return false;
	}
}

/* ------------------------------------------------------------------ */
/* A mao                                                               */
/* ------------------------------------------------------------------ */

/**
 * Onde esta a ponta do dedo dentro do quadro compilado.
 *
 * O quadro e um PNG de 50x50 desenhado pelo CursorManager, e o offset do
 * desenho dentro dele depende do `ActionInformations` do cliente. Em vez de
 * copiar aquele numero para ca (e envelhecer junto com ele), a ponta e MEDIDA:
 * varre-se o alfa uma vez e toma-se o pixel opaco mais alto, e nele o mais a
 * esquerda. E o pixel para onde o dedo aponta.
 *
 * Falhar aqui nao pode derrubar a camada: sem medida, cai em PONTA_DE_RESERVA.
 */
function medirPontaDaMao(img) {
	try {
		const canvas = document.createElement('canvas');
		canvas.width = img.naturalWidth || 50;
		canvas.height = img.naturalHeight || 50;
		const ctx = canvas.getContext('2d');
		ctx.drawImage(img, 0, 0);
		const dados = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
		for (let y = 0; y < canvas.height; y++) {
			for (let x = 0; x < canvas.width; x++) {
				if (dados[(y * canvas.width + x) * 4 + 3] > 40) {
					return { x: x * ESCALA_DA_MAO, y: y * ESCALA_DA_MAO };
				}
			}
		}
	} catch (_erro) {
		/* Canvas indisponivel ou contaminado: a reserva serve. */
	}
	return { x: PONTA_DE_RESERVA.x, y: PONTA_DE_RESERVA.y };
}

/** Liga (ou religa) a imagem da mao. Devolve `true` se a arte do jogo entrou. */
function ligarAMao() {
	const root = _root();
	const caixa = root && root.querySelector('.tu-mao');
	const img = root && root.querySelector('.tu-mao-img');
	if (!caixa || !img) {
		return false;
	}
	if (_urlDaMao) {
		return true;
	}
	const url = typeof Cursor.getCompiledFrameURL === 'function'
		? Cursor.getCompiledFrameURL(ACAO_DA_MAO, QUADRO_DA_MAO)
		: null;
	if (!url) {
		/* O cursor ainda nao foi rasterizado (ou o jogador desligou o cursor
		   customizado). A camada segue com o glifo de reserva e tenta de novo
		   no proximo tique - `Cursor.init` acontece uma vez, no boot. */
		caixa.classList.add('sem-cursor');
		return false;
	}
	_urlDaMao = url;
	caixa.classList.remove('sem-cursor');
	img.addEventListener(
		'load',
		() => {
			_pontaDaMao = medirPontaDaMao(img);
			_assinatura = '';
			desenhar();
		},
		{ once: true }
	);
	img.src = url;
	return true;
}

/* ------------------------------------------------------------------ */
/* Desenhar                                                            */
/* ------------------------------------------------------------------ */

/** O ponteiro deste aparelho e um dedo? Decide o verbo da frase. */
function temDedo() {
	try {
		return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
	} catch (_erro) {
		return false;
	}
}

function desobservar() {
	if (_observador) {
		_observador.disconnect();
		_observador = null;
	}
	_alvoObservado = null;
}

/**
 * ARMADILHA 5, a metade que a viewport nao cobre: o alvo muda de caixa sem a
 * tela mudar de tamanho (a janela foi arrastada, a lista rolou, o leque
 * distribuiu as colunas de novo). O `ResizeObserver` no PROPRIO alvo e o que
 * pega isso; o `onResize` la embaixo pega a outra metade.
 */
function observar(alvo) {
	if (alvo === _alvoObservado) {
		return;
	}
	desobservar();
	if (!alvo || typeof ResizeObserver === 'undefined') {
		return;
	}
	_alvoObservado = alvo;
	_observador = new ResizeObserver(() => {
		_assinatura = '';
		desenhar();
	});
	_observador.observe(alvo);
}

function posicionar(el, r) {
	el.style.left = `${r.x}px`;
	el.style.top = `${r.y}px`;
	el.style.width = `${r.w}px`;
	el.style.height = `${r.h}px`;
}

/**
 * O FURO, EM PIXEL INTEIRO.
 *
 * `getBoundingClientRect()` devolve fracao (um `.tm-item` mede 66,6875px de
 * altura), e a mascara e derivada do furo por SUBTRACAO. Arredondar cada peca
 * na hora de escrever o estilo, e nao o furo, faz o retangulo de baixo comecar
 * meio pixel ACIMA de onde o furo acaba - e ai a mascara encosta no alvo, que e
 * o unico defeito que esta camada nao pode ter. A prova de tela pegou isso como
 * "1 retangulo cruza o furo".
 *
 * Arredondando o FURO uma vez, para fora (piso na origem, teto no fim), toda a
 * aritmetica seguinte e inteira e fecha exatamente na borda da tela.
 */
function medirRecorte(alvo, tela) {
	if (!alvo) {
		return null;
	}
	const r = recorteDoAlvo(alvo.getBoundingClientRect(), tela);
	if (!r) {
		return null;
	}
	const x = Math.floor(r.x);
	const y = Math.floor(r.y);
	return {
		x,
		y,
		w: Math.min(Math.ceil(r.x + r.w), tela.largura) - x,
		h: Math.min(Math.ceil(r.y + r.h), tela.altura) - y
	};
}

function desenhar() {
	const root = _root();
	const camada = root && root.querySelector('.tu-camada');
	if (!camada) {
		return;
	}

	const estado = TutorialIdle.estado;
	const numero = estado ? estado.etapa : 0;
	const etapa = estado && estado.estado === 'em-andamento' ? etapaDe(numero) : null;

	if (!etapa) {
		camada.classList.remove('is-open');
		desobservar();
		_assinatura = '';
		return;
	}

	ligarAMao();

	/* O alvo da etapa. Sem caixa (leque fechado, janela fechada), cai no
	   caminho de volta - e nunca aponta para o vazio. */
	let descricao = etapa.alvo;
	let frasePersonalizada = null;
	let alvo = acharAlvo(descricao);
	const tela = { largura: window.innerWidth, altura: window.innerHeight };
	let recorte = medirRecorte(alvo, tela);

	if (!recorte && etapa.quandoSumir) {
		descricao = etapa.quandoSumir;
		frasePersonalizada = etapa.quandoSumir.frase;
		alvo = acharAlvo(descricao);
		recorte = medirRecorte(alvo, tela);
	}

	/* Etapa sem alvo por desenho (a 6) OU alvo que sumiu e nao tem volta:
	   a camada fica sem mascara e so o balao fala. Escurecer a tela sem um
	   furo seria trancar o jogador atras de um vidro preto. */
	const semMascara = !recorte;
	camada.classList.toggle('sem-mascara', semMascara);

	const balaoEl = camada.querySelector('.tu-balao');
	const alturaDoBalao = balaoEl && balaoEl.offsetHeight ? balaoEl.offsetHeight : BALAO_PADRAO.altura;
	const casa = casaDoBalao(recorte, tela, { altura: alturaDoBalao, margem: BALAO_PADRAO.margem });

	const mao = {
		largura: LADO_DA_MAO,
		altura: LADO_DA_MAO,
		pontaX: (_pontaDaMao || PONTA_DE_RESERVA).x,
		pontaY: (_pontaDaMao || PONTA_DE_RESERVA).y
	};
	const posMao = recorte ? posicaoDaMao(recorte, tela, mao) : null;

	const assinatura = JSON.stringify([
		numero,
		estado.total,
		recorte,
		posMao,
		casa,
		frasePersonalizada,
		tela,
		!!_urlDaMao
	]);
	if (assinatura === _assinatura) {
		camada.classList.add('is-open');
		observar(alvo);
		return;
	}
	_assinatura = assinatura;

	/*
	 * 1. A mascara: quatro retangulos em volta do furo.
	 *
	 * SEM FURO, NENHUM RETANGULO. A prova de tela pegou isto: o CSS ja tinha
	 * `.sem-mascara .tu-veu { display: none }`, mas o `style.display` que este
	 * laco escreve e INLINE e vence a folha, entao a etapa 6 (a de OLHAR)
	 * saia com a tela inteira escurecida e engolindo o clique da cena. Quem
	 * manda no `display` e este laco, e nao a folha: um estado escrito em dois
	 * lugares e um estado que discorda de si mesmo.
	 */
	const veus = camada.querySelectorAll('.tu-veu');
	const rects = semMascara ? [] : retangulosDaMascara(recorte, tela);
	for (let i = 0; i < veus.length; i++) {
		const r = rects[i];
		if (r && r.w > 0 && r.h > 0) {
			veus[i].style.display = 'block';
			posicionar(veus[i], r);
		} else {
			veus[i].style.display = 'none';
		}
	}

	/* 2. O anel, exatamente na boca do furo. */
	const anel = camada.querySelector('.tu-anel');
	if (anel && recorte) {
		posicionar(anel, recorte);
	}

	/* 3. A mao. */
	const caixaDaMao = camada.querySelector('.tu-mao');
	if (caixaDaMao && posMao) {
		caixaDaMao.style.left = `${Math.round(posMao.x)}px`;
		caixaDaMao.style.top = `${Math.round(posMao.y)}px`;
		caixaDaMao.classList.toggle('espelha-x', posMao.espelharX);
		caixaDaMao.classList.toggle('espelha-y', posMao.espelharY);
	}

	/* 4. O balao. */
	const quem = camada.querySelector('.tu-quem');
	const passo = camada.querySelector('.tu-passo');
	const frase = camada.querySelector('.tu-frase');
	if (quem) {
		quem.textContent = QUEM_GUIA;
	}
	if (passo) {
		passo.textContent = `Passo ${numero} de ${estado.total || TOTAL_DE_ETAPAS}`;
	}
	if (frase) {
		frase.textContent = fraseDaEtapa(etapa, temDedo(), frasePersonalizada);
	}
	if (balaoEl) {
		balaoEl.classList.toggle('is-baixo', casa === 'baixo');
		balaoEl.classList.toggle('is-cima', casa === 'cima');
	}

	camada.classList.add('is-open');
	observar(alvo);
}

/* ------------------------------------------------------------------ */
/* O tique                                                             */
/* ------------------------------------------------------------------ */

function tique() {
	const estado = TutorialIdle.estado;
	if (!estado) {
		return;
	}

	/*
	 * QUEM DECIDE SE O TUTORIAL COMECA E O SERVIDOR. O cliente nao adivinha:
	 * ele so age quando o retrato diz 'nao-iniciado', e uma vez so por sessao
	 * de mapa (a guarda evita um laco caso o servidor demore a responder).
	 */
	if (estado.estado === 'nao-iniciado') {
		if (!_comecoPedido) {
			_comecoPedido = true;
			TutorialIdle.retomar();
		}
		return;
	}

	if (estado.estado !== 'em-andamento') {
		desenhar();
		return;
	}

	const numero = estado.etapa;
	if (!_marco || _marco.numero !== numero) {
		_marco = marcoDaEtapa(numero);
	}

	if (_avancoMandado !== numero && etapaCumprida(numero)) {
		_avancoMandado = numero;
		mandar('avancar', numero + 1);
	}

	desenhar();
}

/* ------------------------------------------------------------------ */
/* Ciclo de vida                                                       */
/* ------------------------------------------------------------------ */

TutorialIdle.init = function init() {
	const root = _root();
	const pular = root.querySelector('.tu-pular');
	if (pular) {
		pular.addEventListener('click', evento => {
			evento.preventDefault();
			evento.stopPropagation();
			mandar('pular');
			/* A camada some na hora, sem esperar o retrato: o jogador pediu para
			   sair e nao pode ficar olhando um tutorial que "ainda esta ali". Se
			   o servidor recusar, o proximo retrato traz a etapa de volta. */
			const camada = root.querySelector('.tu-camada');
			if (camada) {
				camada.classList.remove('is-open');
			}
			_assinatura = '';
		});
	}
};

TutorialIdle.onAppend = function onAppend() {
	if (_timer) {
		clearInterval(_timer);
	}
	_timer = setInterval(tique, MS_DO_TIQUE);
	window.addEventListener('scroll', aoRolar, true);
	_comecoPedido = false;
};

/**
 * O GANCHO DE "INTERFACE PRONTA".
 *
 * Chamado no fim do `MapRenderer.onLoad`, depois de `HudVertical.ligar()`
 * (MapEngine.js) - o ponto em que todo componente ja esta anexado, a escala da
 * HUD ja foi aplicada e a marca do celular em pe ja esta carimbada. Antes
 * disso os alvos existem mas nao estao na caixa final, e a primeira etapa
 * apontaria para o lugar errado por um quadro.
 *
 * Ele roda em TODA troca de mapa, e isso e a RECUPERACAO, nao um defeito: a
 * etapa mora no servidor, entao perguntar de novo e barato e e o que devolve o
 * tutorial depois de morte, viagem ou reconexao. Quem decide se ha tutorial e
 * o retrato que vier de volta.
 */
TutorialIdle.interfacePronta = function interfacePronta() {
	_comecoPedido = false;
	TutorialIdle.pedirAoServidor();
};

TutorialIdle.onRemove = function onRemove() {
	if (_timer) {
		clearInterval(_timer);
		_timer = null;
	}
	window.removeEventListener('scroll', aoRolar, true);
	desobservar();
	_assinatura = '';
};

/**
 * ARMADILHA 5, a metade da viewport. `UIManager.fixResizeOverflow`
 * (UIManager.js:252) chama isto em todo `resize`, depois de reaplicar a escala
 * da HUD e a marca vertical - entao aqui os alvos ja estao na caixa nova.
 */
TutorialIdle.onResize = function onResize() {
	_assinatura = '';
	desenhar();
};

/** Rolagem move o alvo sem mudar o tamanho de nada. Captura no documento
 *  inteiro porque a lista que rola vive dentro de outro Shadow DOM. */
function aoRolar() {
	_assinatura = '';
	desenhar();
}

/* ------------------------------------------------------------------ */
/* O pacote                                                            */
/* ------------------------------------------------------------------ */

function onTutorialRecebido(pkt) {
	let dados;
	try {
		dados = JSON.parse(pkt.json);
	} catch (err) {
		console.error('[TutorialIdle] payload nao e JSON valido', err);
		return;
	}
	/* Guarda de versao, como em CodexIdle/PasseIdle/MissoesIdle: um retrato de
	   contrato futuro e IGNORADO em vez de desenhado meio errado. */
	if (!dados || dados.v !== 1) {
		return;
	}
	const mudouDeEtapa = !TutorialIdle.estado || TutorialIdle.estado.etapa !== dados.etapa;
	TutorialIdle.estado = dados;
	if (mudouDeEtapa) {
		/* Etapa nova: o marco de "antes" e o avanco pendente valem para a
		   anterior, e carregar qualquer um deles adiantaria a proxima. */
		_marco = null;
		_avancoMandado = 0;
	}
	_assinatura = '';
	desenhar();
}

Network.hookPacket(PACKET.ZC.RAGIDLE_TUTORIAL, onTutorialRecebido);

/** Exportado para o teste e para a prova de tela conseguirem falar da tabela
 *  sem reabrir o modulo puro. */
TutorialIdle.ETAPAS = ETAPAS;

export default UIManager.addComponent(TutorialIdle);
