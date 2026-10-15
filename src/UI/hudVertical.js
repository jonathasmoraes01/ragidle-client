/**
 * UI/hudVertical.js — A HUD VERTICAL DO CELULAR EM PE (D-939, 05/09/2026).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * O PEDIDO
 * ═══════════════════════════════════════════════════════════════════════
 * Palavras do dono, com um print do jogo num Android em pe e depois um
 * MOCKUP desenhado: *"eu quero que voce desenvolva uma hud para mobile que
 * seja na vertical (...) o mobile nao precisa ter essa barra de skills do
 * Ragnarok original (...) a hud no jogo eu quero que seja exatamente assim,
 * unica diferenca que iremos tirar o mini mapa (...) lembrando so iremos
 * mexer na hud para mobile"*.
 *
 * O mockup e a especificacao: barra de personagem no TOPO (avatar, nome,
 * classe, barras de Base/Classe, zeny, cash, menu), cartao de missoes a
 * esquerda, trilho de botoes redondos a direita (Bolsa/Auto/Skills/Config),
 * botao grande de caca no canto inferior direito, chat em cartao, barra de
 * atalhos branca com paginas embaixo, e um rodape com nivel + EXP.
 * SEM minimapa — essa e a unica diferenca que ele pediu contra o desenho.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * O QUE ESTE MODULO E, E O QUE ELE NAO E
 * ═══════════════════════════════════════════════════════════════════════
 * Ele e SO o interruptor: decide se "celular em pe" vale agora e carimba a
 * marca `ri-vertical` (a) no `<html>` e (b) no `.ui-component-root` de cada
 * Shadow DOM de componente. TODO o desenho mora em CSS, atras dessa marca.
 *
 * POR QUE UMA CLASSE, E NAO `@media` espalhada pelos componentes:
 *
 *   1. **A bandeira de rollout funciona de verdade.** `@media` nao sabe da
 *      `enableHudAdaptavel` (D-937); a classe sabe, porque quem a poe e JS
 *      que consulta `ehAdaptavel()`. Com a bandeira desligada, NENHUMA regra
 *      da HUD vertical casa com nada — a volta e inteira, e nao metade.
 *   2. **Um criterio so, escrito num lugar so.** O criterio tem tres pernas
 *      (dedo + em pe + estreito) e ja vimos esta frente errar por repetir
 *      numero em dois lugares (a cicatriz de `--hud-acima-da-doca`, D-929).
 *   3. **`:host-context` nao existe de forma confiavel** e classe no `<html>`
 *      nao atravessa Shadow DOM — por isso o carimbo vai TAMBEM no root
 *      interno de cada shadow, do mesmo jeito que `escalaDaHud` poe `zoom`
 *      em todo host: varrendo `[data-gui-component]`, que e a marca que todo
 *      `GUIComponent` ja tem.
 *
 * O CRITERIO (as tres pernas, cada uma com motivo):
 *   - `pointer: coarse` — e um DEDO. Janela de desktop espremida em pe nao
 *     ganha a HUD de celular (la quem age e o `zoom` de D-934).
 *   - `orientation: portrait` — em pe. DEITADO continua com o arranjo de
 *     D-929/D-930, que e desta mesma frente e passa na matriz.
 *   - `max-width: 599px` — o corte de "celular" que a casa inteira ja usa
 *     (Common.css, faixa de 599). Tablet em pe (768px) fica FORA de
 *     proposito: o pedido foi "mobile", e o tablet esta servido pelo layout
 *     atual, medido.
 */

import { ehAdaptavel, escalaAtual, reaplicar as reaplicarEscala } from 'UI/escalaDaHud.js';
/*
 * D-1491: o celular DEITADO recusa desenhar e pede para girar. Ele entra por
 * aqui — e nao com ouvintes proprios — porque este modulo ja escuta `resize`,
 * `orientationchange` e o `visualViewport`, que sao exatamente os tres eventos
 * que mudam a resposta. Um segundo conjunto de ouvintes noutro arquivo seria a
 * "segunda rota escrita a mao" que este projeto ja pagou varias vezes.
 *
 * `giroDoCelular` nao importa nada, entao nao ha ciclo possivel.
 */
import { aplicarTelaDeGiro, ehCelularDeitado } from 'UI/giroDoCelular.js';
/*
 * A HUD MOBILE PREMIUM (15/10/2026) e uma camada POR CIMA desta: a marca dela
 * (`ri-premium`) so existe onde `ri-vertical` existe, e e carimbada aqui, no
 * mesmo laco, pelo mesmo motivo de a tela de giro entrar por aqui — um segundo
 * conjunto de ouvintes seria a "segunda rota escrita a mao".
 */
import {
	MARCA_COM_ATALHOS,
	MARCA_DEITADO,
	MARCA_MINIMAPA_RECOLHIDO,
	MARCA_PREMIUM,
	barraDeAtalhosLigada,
	ehHudPremium,
	ehPaisagemPremium,
	garantirCssDoDocumento,
	minimapaRecolhido
} from 'UI/HudPremium/hudPremium.js';

/** A marca que o CSS le — no `<html>` e no root interno de cada shadow. */
export const MARCA_VERTICAL = 'ri-vertical';

/**
 * AS FAIXAS DE TELA DA HUD PREMIUM (15/10/2026), medidas em UNIDADES DA HUD: a tela dividida pela escala.
 *
 * Elas eram `@media (max-height: ...)`, e a media query mede a tela em pixel do aparelho. Com o Tamanho da HUD
 * (Configuracoes de Video) isso mente: a 120% um 375x667 tem so 556 de altura para a HUD, mas a media query
 * ainda ve 667 e monta a coluna da direita para 667 - medido, o Cacar caia em cima do trilho. Quem sabe a
 * escala e o JS, entao as faixas viram marcas carimbadas aqui, na mesma rota de `ri-premium`. Os cortes sao os
 * mesmos das media queries de antes.
 */
export const MARCA_TELA_BAIXA = 'ri-tela-baixa';
export const MARCA_TELA_MINIMA = 'ri-tela-minima';
export const MARCA_TELA_ESTREITA = 'ri-tela-estreita';
const CORTE_BAIXA = 760;
const CORTE_MINIMA = 620;
const CORTE_ESTREITA = 359;

/*
 * AS FAIXAS DO CELULAR DEITADO (15/10/2026). Os cortes de em pe medem a COLUNA da direita (a altura que o
 * minimapa, o trilho e o grupo de acao empilham) e a largura do cartao; deitado a coluna da direita nao
 * empilha mais nada disso (o trilho vai para a linha de cima, `tokens.css`), entao os cortes sao outros:
 *   - estreita: o cartao do personagem e o que sobra da LARGURA depois da linha de cima (Menu, minimapa e o
 *     trilho em fileira, ~398). Em pe a faixa estreita vale com o cartao abaixo de ~291 (359 - 68); deitado,
 *     com a tela abaixo de 291 + 398 + 16 = 705 (o 667x375 entra, o 852x393 nao);
 *   - baixa e minima: so o deitado de 320 de altura (568x320) - o grupo de acao, o minimapa e o arco
 *     encolhem, e o trilho perde o rotulo.
 */
const CORTE_ESTREITA_DEITADO = 705;
const CORTE_MINIMA_DEITADO = 340;

/** As tres faixas para a tela de agora, em unidades da HUD (todas false fora da premium). */
export function faixasDaTela(premium, deitado = false) {
	if (!premium || typeof window === 'undefined') {
		return { baixa: false, minima: false, estreita: false };
	}
	const escala = escalaAtual() || 1;
	const altura = (window.innerHeight || 0) / escala;
	const largura = (window.innerWidth || 0) / escala;
	if (deitado) {
		const baixo = altura <= CORTE_MINIMA_DEITADO;
		return { baixa: baixo, minima: baixo, estreita: largura <= CORTE_ESTREITA_DEITADO };
	}
	return { baixa: altura <= CORTE_BAIXA, minima: altura <= CORTE_MINIMA, estreita: largura <= CORTE_ESTREITA };
}

/** O criterio, escrito UMA vez. */
const CRITERIO = '(pointer: coarse) and (orientation: portrait) and (max-width: 599px)';

let _ligado = false;
let _ultimo = null;

/** Este aparelho, agora, e um celular em pe? */
export function ehCelularEmPe() {
	if (typeof window === 'undefined' || !window.matchMedia) {
		return false;
	}
	try {
		return window.matchMedia(CRITERIO).matches && ehAdaptavel();
	} catch (erro) {
		return false;
	}
}

/**
 * O CELULAR DEITADO COM A HUD PREMIUM DEITADA (15/10/2026, `enableHudPaisagemPremium`): o criterio do deitado e
 * o da tela de giro (`giroDoCelular.js`), escrito la uma vez so, e a bandeira e a de `hudPremium.js`.
 */
export function ehCelularDeitadoNaHud() {
	try {
		return ehPaisagemPremium() && ehCelularDeitado();
	} catch (erro) {
		return false;
	}
}

/**
 * ESTE APARELHO, AGORA, USA A HUD DE CELULAR? (15/10/2026)
 *
 * Em pe sempre (D-939); deitado so com a premium deitada. E a pergunta que os COMPORTAMENTOS de celular fazem -
 * uma janela por vez (`pilhaDeJanelas.js`), o leque do Menu que fecha ao tocar fora, o cartao de missoes que
 * nasce recolhido, a folha de detalhe das skills -, e e por ela que a marca `ri-vertical` entra no documento.
 * `ehCelularEmPe` continua respondendo so "em pe", para quem precisa da orientacao de verdade (a telemetria
 * de `quadrosNoCampo.js`).
 */
export function ehHudDeCelular() {
	return ehCelularEmPe() || ehCelularDeitadoNaHud();
}

/**
 * Aplica (ou remove) a marca. Idempotente e barata — roda no caminho de
 * `resize`, como o `aplicar` do escalaDaHud, e sai cedo quando nada mudou.
 *
 * `forcar` existe para o mesmo caso do `reaplicar` de la: um host NOVO
 * (janela aberta pela primeira vez, troca de mapa que recria hosts) precisa
 * nascer com a marca vigente, e o cache de "nada mudou" esconderia isso.
 */
export function aplicar(doc, forcar) {
	const d = doc || (typeof document !== 'undefined' ? document : null);
	if (!d || !d.documentElement) {
		return false;
	}
	/*
	 * A tela de "gire o celular" e avaliada ANTES do cache de "nada mudou"
	 * (D-1491): girar um celular em pe para deitado deixa `ehCelularEmPe` em
	 * `false` nos DOIS estados seguintes (deitado e desktop nunca sao "em pe"),
	 * entao o `agora === _ultimo` abaixo sairia cedo e a tela nunca apareceria.
	 * Ela tem criterio proprio e e barata; quem decide se ela entra e ela.
	 *
	 * **SO DEPOIS DE `ligar()`, e isso e conserto de um defeito MEDIDO.** A
	 * primeira versao avaliava a tela em qualquer `aplicar`, inclusive no que
	 * roda quando um componente novo entra no documento — ou seja, na tela de
	 * LOGIN. A `prove:hud-responsiva` abortou por causa disso, com a mensagem
	 * que nomeia o culpado: *"<div id=ri-gire-o-celular> intercepts pointer
	 * events"*. A capa subia num celular EM PE e engolia o clique de entrar.
	 *
	 * A causa raiz e a caixa medida: o jogo roda num IFRAME, e o `matchMedia`
	 * daqui mede o iframe, e nao o aparelho. Durante o boot ele pode estar mais
	 * largo que alto, e "deitado" da verdadeiro num telefone em pe.
	 *
	 * `_ligado` so vira `true` em `ligar()`, que roda na ENTRADA NO MAPA — e ali
	 * o iframe ja ocupa a area de jogo, com a proporcao do aparelho. A tela
	 * tambem so faz sentido ali: recusar a desenhar o JOGO nao e recusar a
	 * desenhar a tela de login.
	 */
	if (_ligado) {
		/* com a premium deitada ligada, o deitado e jogado: a tela de giro nao entra */
		aplicarTelaDeGiro(d, ehPaisagemPremium());
	}

	/* A HUD de celular: em pe, ou deitado com a premium deitada (que carrega `ri-deitado` junto). Os dois
	   criterios de media se excluem (`portrait` x `landscape`), entao o deitado nao precisa perguntar o em pe. */
	const deitado = ehCelularDeitadoNaHud();
	const agora = deitado || ehCelularEmPe();
	/* A premium so vale na HUD de celular (em pe, ou deitado com a deitada); a bandeira e estatica no runtime. O
	   CSS de documento entra na primeira vez que ela vale, antes da marca, para o primeiro quadro ja sair
	   desenhado. */
	const premium = agora && ehHudPremium();
	/* As faixas mudam com o tamanho da janela E com a escala; a chave do cache leva as duas coisas, senao girar
	   o celular ou trocar o Tamanho da HUD sairia cedo com as faixas velhas. */
	const faixas = faixasDaTela(premium, deitado);
	const chave = `${agora}|${deitado}|${faixas.baixa}|${faixas.minima}|${faixas.estreita}`;
	if (!forcar && chave === _ultimo) {
		return agora;
	}
	const premiumMudou = premium !== d.documentElement.classList.contains(MARCA_PREMIUM);
	_ultimo = chave;
	if (premium) {
		garantirCssDoDocumento(d);
	}
	/* A barra de skills da premium (nasce desligada): a preferencia muda pela janela de Configuracoes, que
	   chama `reaplicar` - o cache acima nao a esconde. */
	const comAtalhos = premium && barraDeAtalhosLigada();
	/* O minimapa minimizado (so a pilula do nome): a preferencia muda pelo toque na pilula, que chama `reaplicar`. */
	const mapaRecolhido = premium && minimapaRecolhido();

	d.documentElement.classList.toggle(MARCA_VERTICAL, agora);
	d.documentElement.classList.toggle(MARCA_PREMIUM, premium);
	d.documentElement.classList.toggle(MARCA_COM_ATALHOS, comAtalhos);
	d.documentElement.classList.toggle(MARCA_MINIMAPA_RECOLHIDO, mapaRecolhido);
	d.documentElement.classList.toggle(MARCA_DEITADO, premium && deitado);
	/* O Tamanho da HUD so vale no celular COM a premium (`escalaDaHud.js`, `fatorValeAqui`), e ela le esta marca:
	   quando a premium entra ou sai, a escala e refeita e as faixas medidas de novo com ela. */
	if (premiumMudou) {
		reaplicarEscala(d);
	}
	const faixasAgora = premiumMudou ? faixasDaTela(premium, deitado) : faixas;
	const marcasDaTela = [
		[MARCA_TELA_BAIXA, faixasAgora.baixa],
		[MARCA_TELA_MINIMA, faixasAgora.minima],
		[MARCA_TELA_ESTREITA, faixasAgora.estreita]
	];
	for (const [marca, vale] of marcasDaTela) {
		d.documentElement.classList.toggle(marca, vale);
	}

	/*
	 * O carimbo dentro de cada shadow. `.ui-component-root` e o container que
	 * o GUIComponent cria em todo componente (GUIComponent.js:256) — carimbar
	 * ELE, e nao o host, e o que deixa o CSS de dentro do shadow escrever
	 * `.ri-vertical .tm-fab { ... }` sem conhecer o documento.
	 */
	const hosts = d.querySelectorAll('[data-gui-component]');
	for (let i = 0; i < hosts.length; i++) {
		const raiz = hosts[i].shadowRoot && hosts[i].shadowRoot.querySelector('.ui-component-root');
		if (raiz) {
			raiz.classList.toggle(MARCA_VERTICAL, agora);
			raiz.classList.toggle(MARCA_PREMIUM, premium);
			raiz.classList.toggle(MARCA_COM_ATALHOS, comAtalhos);
			raiz.classList.toggle(MARCA_MINIMAPA_RECOLHIDO, mapaRecolhido);
			raiz.classList.toggle(MARCA_DEITADO, premium && deitado);
			for (const [marca, vale] of marcasDaTela) {
				raiz.classList.toggle(marca, vale);
			}
		}
	}
	return agora;
}

/** Reaplica ignorando o cache — para quando um host novo entra no documento. */
export function reaplicar(doc) {
	return aplicar(doc, true);
}

/**
 * Liga os ouvintes. Mesmo desenho do `ligar` do escalaDaHud, e pelos mesmos
 * motivos: resposta imediata no resize/rotacao, e o `visualViewport` porque o
 * teclado virtual muda o tamanho sem disparar `resize` em todo navegador.
 */
export function ligar(doc) {
	if (_ligado || typeof window === 'undefined') {
		return;
	}
	_ligado = true;
	const alvo = doc || document;
	const responder = () => aplicar(alvo);
	window.addEventListener('resize', responder);
	window.addEventListener('orientationchange', responder);
	if (window.visualViewport) {
		window.visualViewport.addEventListener('resize', responder);
	}
	_ultimo = null;
	aplicar(alvo);
}

/** So para testes: volta o modulo ao estado de fabrica. */
export function desligarParaTeste() {
	_ligado = false;
	_ultimo = null;
}

export default {
	MARCA_VERTICAL,
	ehCelularEmPe,
	ehHudDeCelular,
	aplicar,
	reaplicar,
	ligar,
	desligarParaTeste,
};
