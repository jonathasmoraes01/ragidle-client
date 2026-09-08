/**
 * UI/Components/BoasVindasIdle/BoasVindasIdle.js
 *
 * A CAIXA DE BOAS-VINDAS (D-968) — o cartaz que abre sozinho ao entrar no jogo.
 *
 * Pedido do dono, 07/09/2026: *"toda vez que a pessoa entrar no jogo, irá
 * aparecer essa janela na tela dele e ele clicando na imagem, é redirecionado
 * para o discord em uma nova aba. E a primeira imagem será essa"*.
 *
 * Quatro escolhas de desenho, nenhuma estética:
 *
 * 1. **Os cartazes são uma LISTA, e não uma imagem chumbada.** O dono disse "a
 *    PRIMEIRA imagem", e uma caixa que só sabe mostrar uma peça teria de ser
 *    reescrita para receber a segunda. Com um cartaz a caixa é só a arte e o
 *    "X"; com dois ou mais ela ganha contador, pontinhos e "Próximo" sozinha.
 *    Publicar um cartaz novo é somar um objeto em `CARTAZES`, abaixo.
 *
 * 2. **UMA VEZ POR ENTRADA, e não uma vez por mapa.** `append()` roda a cada
 *    troca de mapa (é `MapRenderer.onLoad`, dentro de `onMapChange`), então
 *    mostrar no `onAppend` sem guarda faria o cartaz voltar a cada viagem — e
 *    o jogador idle viaja o tempo todo. A trava é o `_jaMostrouNestaEntrada`,
 *    e ela é derrubada exatamente onde "entrar de novo" acontece:
 *    `limparEstadoDoPersonagem()` (a volta ao menu de personagem, chamada pelo
 *    `cleanGameUI`) e a recarga da página (que zera o módulo inteiro).
 *
 * 3. **QUEM abre a aba é o `window.open`, e o `<a target="_blank">` é a rede de
 *    segurança** — nesta ordem, e a ordem foi CORRIGIDA pelo dono: com só o
 *    `target`, ele mediu o Discord abrindo *"na mesma aba (saindo do jogo)"*. O
 *    cliente vive num `<iframe>` e, na casca instalada, quem decide o destino
 *    de `_blank` é o navegador — e reusar a janela do app custa a SESSÃO de
 *    quem clicou. Ver `abrirEmAbaNova`, mais abaixo, para as duas escolhas que
 *    fazem isso funcionar (abrir pela casca, e cortar o `opener` depois em vez
 *    de pedir `noopener`).
 *
 * 5. **O adiamento de 24 h é do NAVEGADOR, não do personagem** (pedido do dono,
 *    07/09/2026). Ele mora em `Preferences` (localStorage) e por isso NÃO entra
 *    em `limparEstadoDoPersonagem`: trocar de personagem não desfaz um "não
 *    quero ver isto hoje", e dispensar no computador não dispensa no celular.
 *
 * 4. **Ela NÃO se registra na pilha de janelas** (`pilhaDeJanelas.js`). O
 *    registro marca o host com `.ri-janela`, e abaixo de 600px isso vira
 *    painel de tela cheia (D-932) — o que desfiguraria um cartaz ilustrado. O
 *    ESC é tratado aqui, no `onKeyDown`, com `stopImmediatePropagation` para o
 *    `Escape` nativo não abrir as Configurações por cima; é o mesmo arranjo do
 *    aviso de entrada do `VotoIdle`.
 *
 * @author RagIdle
 */

import Preferences from 'Core/Preferences.js';
import GUIComponent from 'UI/GUIComponent.js';
import htmlText from './BoasVindasIdle.html?raw';
import cssText from './BoasVindasIdle.css?raw';
import { fecharEEsquecer } from '../limpezaDeJanelaIdle.js';

/**
 * OS CARTAZES, na ordem em que o jogador os vê.
 *
 * `largura`/`altura` são as da arte em pixels: elas viram a proporção do
 * cartaz no CSS, e é o que permite a caixa caber numa tela baixa sem deixar
 * faixa de fundo vazio nas laterais. Medir aqui em vez de esperar o `onload`
 * da imagem evita o pulo de layout na primeira abertura.
 */
const CARTAZES = [
	{
		id: 'discord',
		imagem: '/ragidle/boas-vindas/discord.webp',
		largura: 1448,
		altura: 1086,
		url: 'https://discord.gg/BJGgQK2mQK',
		alt: 'Obrigado por ajudar no alfa! Entre no nosso Discord para enviar feedback e acompanhar as novidades.'
	}
];

/** Quanto o rodapé come da altura do cartaz. Ele é permanente. */
const ALTURA_DO_RODAPE = '64px';

/** O adiamento que o dono pediu: um dia inteiro, contado do clique. */
const UM_DIA_MS = 24 * 60 * 60 * 1000;

/**
 * O adiamento vive em `Preferences` (localStorage), e não no servidor.
 *
 * É uma preferência de QUEM ESTÁ OLHANDO, não do personagem: quem dispensou o
 * cartaz no computador do trabalho não pediu para dispensá-lo no celular. Pelo
 * mesmo motivo ela NÃO entra em `limparEstadoDoPersonagem` — trocar de
 * personagem não desfaz o "não quero ver isto hoje".
 */
const _preferencias = Preferences.get('BoasVindasIdle', { adiadoAte: 0 }, 1.0);

const BoasVindasIdle = new GUIComponent('BoasVindasIdle', cssText);

BoasVindasIdle.render = () => htmlText;

/** Fechada, ela não pode engolir clique da cena — par do `:host` do CSS. */
BoasVindasIdle.mouseMode = GUIComponent.MouseMode.CROSS;

/**
 * O ESC É OUVIDO NA FASE DE CAPTURA, e isso foi MEDIDO — não é precaução.
 *
 * `Escape.append()` roda no começo do boot do mapa e registra o `onKeyDown`
 * dele em `window` na fase de BUBBLE, primeiro da fila. Esta caixa é anexada
 * no fim do mesmo bloco, então em bubble ela viria DEPOIS: a prova de tela
 * mediu o ESC fechando a caixa **e** abrindo as Configurações por baixo, que é
 * literalmente o defeito que D-931 existe para matar.
 *
 * Captura roda antes de todo bubble, e daí o `stopImmediatePropagation` do
 * `onKeyDown` chega a tempo. A `pilhaDeJanelas` também ouve em captura; quando
 * ela decide agir, ela mesma para o evento e esta caixa não é consultada — o
 * que é a ordem certa, porque quem tem uma janela aberta por cima está
 * fechando aquela janela, e não este cartaz.
 */
BoasVindasIdle.captureKeyEvents = true;

/** Já apareceu nesta entrada no jogo? Ver a escolha 2 do cabeçalho. */
let _jaMostrouNestaEntrada = false;

/** Qual cartaz está na tela. */
let _indice = 0;

function _root() {
	return BoasVindasIdle._shadow || BoasVindasIdle._host;
}

BoasVindasIdle.init = function init() {
	/*
	 * Guarda em todo `querySelector`, pelo motivo registrado em
	 * `ClassChangeNotice.js`: este `init` roda dentro de `MapEngine.init`, e
	 * `GUIComponent.prepare` não engole exceção — ela sobe e o mundo 3D nunca
	 * é montado. Um cartaz é cosmético; o que ele não pode é custar o jogo.
	 */
	const root = _root();
	if (!root) {
		return;
	}

	const fechar = root.querySelector('.bv-x');
	if (fechar) {
		fechar.addEventListener('click', aoFechar);
	}

	const proximo = root.querySelector('.bv-proximo');
	if (proximo) {
		proximo.addEventListener('click', aoProximo);
	}

	const link = root.querySelector('.bv-link');
	if (link) {
		link.addEventListener('click', aoClicarNaArte);
	}

	/*
	 * O interruptor grava NO MOMENTO em que muda, e não ao fechar a caixa.
	 *
	 * Fechar tem três caminhos (o "X", o ESC, o clique fora) mais o clique na
	 * arte, que também fecha. Guardar a decisão em cada um deles seria a mesma
	 * regra escrita quatro vezes — e a quinta saída, quando alguém a
	 * acrescentar, nasceria esquecendo de gravar.
	 */
	const hoje = root.querySelector('.bv-hoje-caixa');
	if (hoje) {
		hoje.addEventListener('change', () => adiarPorUmDia(hoje.checked));
	}

	/*
	 * Clicar FORA do cartaz fecha — o gesto que todo modal tem. O ouvinte mora
	 * no véu e compara o alvo com ele mesmo: um clique dentro do cartaz sobe
	 * até aqui por bubbling, e sem essa comparação fechar a caixa seria
	 * impossível sem fechá-la também ao clicar na arte.
	 */
	const modal = root.querySelector('.bv-modal');
	if (modal) {
		modal.addEventListener('click', evento => {
			if (evento.target === modal) {
				aoFechar();
			}
		});
	}
};

/**
 * O gatilho. `append()` roda a cada troca de mapa; a trava é o que faz o
 * cartaz ser da ENTRADA e não da viagem (escolha 2 do cabeçalho).
 */
BoasVindasIdle.onAppend = function onAppend() {
	if (_jaMostrouNestaEntrada) {
		return;
	}
	_jaMostrouNestaEntrada = true;
	if (estaAdiada()) {
		return;
	}
	BoasVindasIdle.mostrar();
};

/**
 * O jogador pediu para não ver o cartaz hoje, e o dia ainda não passou?
 *
 * A guarda do TETO existe porque o prazo é comparado com o relógio DA MÁQUINA
 * do jogador, e esse relógio pode andar. Se alguém marcar a opção com a data
 * do computador adiantada em um ano, o adiamento duraria um ano — então um
 * prazo que está mais de 24 h no futuro é tratado como relógio torto, e não
 * como vontade de quem clicou.
 */
function estaAdiada() {
	const ate = Number(_preferencias.adiadoAte) || 0;
	const agora = Date.now();
	return ate > agora && ate - agora <= UM_DIA_MS;
}

/** Liga/desliga o adiamento de 24 h. Grava na hora — marcar já é a decisão. */
function adiarPorUmDia(ligado) {
	_preferencias.adiadoAte = ligado ? Date.now() + UM_DIA_MS : 0;
	_preferencias.save();
}

/** Abre a caixa no primeiro cartaz. */
BoasVindasIdle.mostrar = function mostrar() {
	const root = _root();
	const modal = root && root.querySelector('.bv-modal');
	if (!modal || CARTAZES.length === 0) {
		return;
	}
	_indice = 0;
	render();
	modal.classList.add('is-open');
	BoasVindasIdle.focus();
};

BoasVindasIdle.fechar = function fechar() {
	const root = _root();
	const modal = root && root.querySelector('.bv-modal');
	if (modal) {
		modal.classList.remove('is-open');
	}
};

BoasVindasIdle.estaAberta = function estaAberta() {
	const root = _root();
	const modal = root && root.querySelector('.bv-modal');
	return !!(modal && modal.classList.contains('is-open'));
};

/**
 * O ESC fecha a caixa e PARA aí.
 *
 * `stopImmediatePropagation` e não `stopPropagation`: os tratadores de ESC
 * deste fork moram todos em `window`, e `stopPropagation` não impede outros
 * listeners do MESMO alvo de rodar — era essa a diferença entre "o ESC fechou"
 * e "o ESC fechou E abriu as Configurações por cima" (ver `pilhaDeJanelas.js`).
 */
BoasVindasIdle.onKeyDown = function onKeyDown(event) {
	if (event.which !== 27 && event.key !== 'Escape') {
		return;
	}
	if (!BoasVindasIdle.estaAberta()) {
		return;
	}
	BoasVindasIdle.fechar();
	event.stopImmediatePropagation();
	event.preventDefault();
};

/**
 * A TROCA DE PERSONAGEM (o portão `janela-idle-esquece-o-desenho`).
 *
 * Voltar ao menu de personagem não recarrega a página, e `GUIComponent.remove`
 * só desanexa o host — o shadow DOM atravessa a troca inteiro. Aqui isso tem
 * duas consequências, e as duas são tratadas: o cartaz voltaria ABERTO na
 * tela do próximo personagem, e a trava continuaria armada, o que faria a
 * caixa NÃO aparecer para quem acabou de entrar. Entrar com outro personagem é
 * entrar no jogo.
 */
BoasVindasIdle.limparEstadoDoPersonagem = function limparEstadoDoPersonagem() {
	fecharEEsquecer(_root(), '.bv-modal');
	_jaMostrouNestaEntrada = false;
	_indice = 0;
};

/* ═══════════════════════════════════════════════════════════════════════
   OS BOTÕES
   ═══════════════════════════════════════════════════════════════════════ */

function aoFechar() {
	BoasVindasIdle.fechar();
}

function aoProximo() {
	avancar();
}

/**
 * O CLIQUE NA ARTE — e por que o `target="_blank"` não bastou.
 *
 * O dono reportou, no navegador dele: *"ele está abrindo o link do discord na
 * mesma aba (saindo do jogo)"*. O `<a target="_blank">` estava lá e a prova de
 * tela via a aba nova abrir no Chromium do Playwright — mas o cliente vive
 * dentro de um `<iframe>` e, na casca instalada (PWA em `standalone`), o
 * `target` é decidido pelo navegador, não por nós: ele pode reusar a janela do
 * app. E reusar a janela do app é o pior desfecho possível aqui — o jogador
 * perde a SESSÃO por ter clicado num convite.
 *
 * Então quem abre a aba passa a ser o JS, e o `<a>` fica de rede de segurança:
 * se `window.open` for barrado, o clique NÃO é impedido e o link ainda tenta.
 */
function aoClicarNaArte(evento) {
	const cartaz = CARTAZES[_indice];
	if (cartaz && abrirEmAbaNova(cartaz.url)) {
		evento.preventDefault();
	}
	avancar();
}

/**
 * Abre `url` numa aba/janela separada. Devolve se conseguiu.
 *
 * Duas escolhas que parecem detalhe e não são:
 *
 * 1. **`window.top` primeiro.** O componente roda dentro do `<iframe>` do
 *    cliente; abrir a partir da CASCA é o que dá uma aba irmã da do jogo em vez
 *    de algo pendurado no quadro de dentro. O `try` cobre o dia em que a casca
 *    for de outra origem — hoje ela não é (mesmo host do `vite`).
 *
 * 2. **Sem `noopener` na string de opções, e `opener = null` depois.** Por
 *    especificação, `window.open(..., 'noopener')` devolve `null` SEMPRE — e aí
 *    não há como distinguir "abriu" de "o navegador barrou", que é justamente o
 *    que decide se o `<a>` deve ou não continuar. Cortar o `opener` logo em
 *    seguida dá a mesma proteção (a página aberta não navega a aba do jogo) e
 *    mantém a resposta.
 */
function abrirEmAbaNova(url) {
	for (const dona of [janelaDaCasca(), window]) {
		if (!dona) {
			continue;
		}
		try {
			const nova = dona.open(url, '_blank');
			if (nova) {
				try {
					nova.opener = null;
				} catch {
					/* já é de outra origem — o navegador cortou por nós. */
				}
				return true;
			}
		} catch {
			/* janela inacessível: tenta a próxima da lista. */
		}
	}
	return false;
}

/** A janela da casca, quando o jogo está num iframe de mesma origem. */
function janelaDaCasca() {
	try {
		return window.top && window.top !== window ? window.top : null;
	} catch {
		return null;
	}
}

/** Vai para o próximo cartaz; no último, fecha. */
function avancar() {
	if (_indice + 1 < CARTAZES.length) {
		_indice += 1;
		render();
		return;
	}
	BoasVindasIdle.fechar();
}

/* ═══════════════════════════════════════════════════════════════════════
   O DESENHO
   ═══════════════════════════════════════════════════════════════════════ */

function render() {
	const root = _root();
	const cartaz = CARTAZES[_indice];
	if (!root || !cartaz) {
		return;
	}

	const link = root.querySelector('.bv-link');
	const arte = root.querySelector('.bv-arte');
	if (link) {
		link.href = cartaz.url;
	}
	if (arte) {
		arte.src = cartaz.imagem;
		arte.alt = cartaz.alt || '';
	}

	const varios = CARTAZES.length > 1;

	/* A proporção da arte e a altura do rodapé viram os dois tetos do tamanho
	   do cartaz (ver o `min()` de `.bv-card` no CSS). O host é quem carrega as
	   variáveis porque é ele que existe antes de qualquer desenho. */
	const host = BoasVindasIdle._host;
	if (host && cartaz.largura && cartaz.altura) {
		host.style.setProperty('--bv-proporcao', String(cartaz.largura / cartaz.altura));
		host.style.setProperty('--bv-rodape-altura', ALTURA_DO_RODAPE);
	}

	const contador = root.querySelector('.bv-contador');
	if (contador) {
		contador.hidden = !varios;
		contador.textContent = `${_indice + 1}/${CARTAZES.length}`;
	}

	/* O rodapé é permanente desde que o adiamento de 24 h entrou: ele é a casa
	   do interruptor, e uma opção que só existe com dois cartazes não é uma
	   opção. Quem some com um cartaz só são os pontinhos, abaixo. */
	const proximo = root.querySelector('.bv-proximo');
	if (proximo) {
		proximo.textContent = _indice + 1 < CARTAZES.length ? 'Próximo' : 'Fechar';
	}

	/* O interruptor reflete o que está GRAVADO, e não o que ele mostrava antes:
	   a caixa reabre em sessões diferentes, e um estado desenhado por memória
	   diria "não mostrar hoje" desmarcado num dia em que o adiamento vale. */
	const hoje = root.querySelector('.bv-hoje-caixa');
	if (hoje) {
		hoje.checked = estaAdiada();
	}

	const pontos = root.querySelector('.bv-pontos');
	if (pontos) {
		/* `textContent = ''` + `createElement` em vez de `innerHTML`: são
		   pontinhos gerados por contagem, e não há texto de ninguém aqui para
		   ser interpretado como marcação. */
		pontos.textContent = '';
		if (varios) {
			for (let i = 0; i < CARTAZES.length; i++) {
				const ponto = document.createElement('span');
				ponto.className = i === _indice ? 'bv-ponto is-atual' : 'bv-ponto';
				pontos.appendChild(ponto);
			}
		}
	}
}

export default BoasVindasIdle;
