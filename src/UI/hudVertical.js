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

import { ehAdaptavel } from 'UI/escalaDaHud.js';
/*
 * D-1491: o celular DEITADO recusa desenhar e pede para girar. Ele entra por
 * aqui — e nao com ouvintes proprios — porque este modulo ja escuta `resize`,
 * `orientationchange` e o `visualViewport`, que sao exatamente os tres eventos
 * que mudam a resposta. Um segundo conjunto de ouvintes noutro arquivo seria a
 * "segunda rota escrita a mao" que este projeto ja pagou varias vezes.
 *
 * `giroDoCelular` nao importa nada, entao nao ha ciclo possivel.
 */
import { aplicarTelaDeGiro } from 'UI/giroDoCelular.js';

/** A marca que o CSS le — no `<html>` e no root interno de cada shadow. */
export const MARCA_VERTICAL = 'ri-vertical';

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
		aplicarTelaDeGiro(d);
	}

	const agora = ehCelularEmPe();
	if (!forcar && agora === _ultimo) {
		return agora;
	}
	_ultimo = agora;

	d.documentElement.classList.toggle(MARCA_VERTICAL, agora);

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
	aplicar,
	reaplicar,
	ligar,
	desligarParaTeste,
};
