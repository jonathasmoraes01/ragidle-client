/**
 * UI/Components/ContextMenu/ContextMenu.js
 *
 * Manage ContextMenu (right click on a target)
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 */

import Renderer from 'Renderer/Renderer.js';
import Mouse from 'Controls/MouseEventHandler.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import { emUnidadesDaHud } from 'UI/escalaDaHud.js';
import cssText from './ContextMenu.css?raw';

/**
 * Create Component
 */
const ContextMenu = new GUIComponent('ContextMenu', cssText);

/**
 * Render HTML
 *
 * O markup nasce aqui (nao ha ContextMenu.html): o overlay de tela cheia que
 * fecha no clique fora, mais o container ".menu" onde addElement()/
 * nextGroup() penduram os itens dinamicamente. A classe "ri-card" (Fase 3,
 * 01/09/2026) da a pele de design system ao container — fundo, borda, raio,
 * sombra — sem mexer no que o JS consulta (".menu" continua o mesmo seletor).
 */
ContextMenu.render = () => '<div id="ContextMenu"><div class="menu ri-card"></div></div>';

/* NAO recebe riAnimaJanela: diferente das janelas (titulo + fechar, abrir/
   fechar deliberado do jogador), este e um menu de clique-direito -- nasce e
   morre em resposta imediata ao mouse, varias vezes por minuto, sem chrome
   proprio (sem .ri-header/.ri-title). Um fade de framework aqui teria dois
   efeitos ruins: o menu pareceria atrasado abrindo, e o overlay que fecha no
   mousedown ficaria ~150ms "fantasma" ainda pintado (mesma familia de defeito
   que o clique-vaza ja cicatrizou neste projeto). Instantaneo e o
   comportamento certo para este tipo de popup -- decisao registrada aqui, nao
   silenciosa. */

/**
 * @var {boolean} focus this UI
 */
ContextMenu.needFocus = true;

/**
 * Initialize event handler
 */
ContextMenu.init = function init() {
	const root = this.getRoot();
	const overlay = root.querySelector('#ContextMenu');
	const menu = root.querySelector('.menu');

	// Click anywhere on the overlay → close
	overlay.addEventListener('mousedown', () => {
		ContextMenu.remove();
	});

	/* SOMANDO um caminho de fechar, e nao trocando: o `mousedown` acima so
	   existe no toque porque o navegador SINTETIZA um a partir do toque, e
	   essa sintese so acontece se ninguem chamou `preventDefault` no
	   `touchstart` daquele gesto — o que `Core/Mobile.js` faz condicionalmente
	   (fora da UI). Depender so do sintetico e apostar num efeito colateral.
	   `touchstart` real no overlay fecha sem essa aposta; nao chama
	   `preventDefault`, entao o clique sintetico do item (abaixo) continua
	   nascendo normalmente. */
	overlay.addEventListener('touchstart', () => {
		ContextMenu.remove();
	}, { passive: true });

	// Prevent menu item clicks from closing via overlay
	menu.addEventListener('mousedown', event => {
		event.stopImmediatePropagation();
	});

	// O mesmo corte, para o toque: sem isto o touchstart do overlay (acima)
	// fecha o menu ANTES do dedo soltar em cima do item.
	menu.addEventListener('touchstart', event => {
		event.stopImmediatePropagation();
	}, { passive: true });
};

/**
 * Position menu at mouse cursor
 *
 * A CONTA DE UNIDADE (05/09/2026, toque na mochila passa a abrir este menu
 * tambem): desde D-934 o host deste componente ([data-gui-component]) pode ter
 * `zoom` — e `menu` (o alvo do style.left/top abaixo) e um DESCENDENTE desse
 * host, dentro do Shadow DOM. Isso separa esta conta em dois grupos:
 *
 *   - `Mouse.screen.x/y` (nasce de event.pageX no `window`, fora de qualquer
 *     host), `Renderer.width/height` (o tamanho real da janela) e
 *     `menu.getBoundingClientRect()` sao pixel de VIEWPORT.
 *
 *     `offsetWidth`/`offsetHeight` NAO SAO, e a diferenca foi MEDIDA em
 *     05/09/2026 num Chromium com `zoom: 0.5`: um elemento de 200px devolveu
 *     `offsetWidth: 200` e `getBoundingClientRect().width: 100`. `offset*` fala
 *     nas unidades LOCAIS do elemento (pre-zoom); so o retangulo e que ja vem
 *     com o zoom aplicado. Compara-los com `Renderer.width` superestimaria a
 *     largura em 1/escala e faria o menu virar para o lado errado do dedo cedo
 *     demais — a mesma familia de erro que este cabecalho existe para
 *     descrever.
 *   - `menu.style.left/top`, ao contrario, e ESCRITO dentro do host: o mesmo
 *     numero em px ali e interpretado nas unidades LOCAIS dele (pre-zoom) e
 *     desenha em (numero x escala) no viewport — a armadilha que o comentario
 *     de `emUnidadesDaHud` descreve.
 *
 * A conta de "cabe na tela?" roda INTEIRA em unidades de viewport (o primeiro
 * grupo); so na hora de escrever em `menu.style.*` e que o resultado passa por
 * `emUnidadesDaHud()`, uma unica vez. Em escala 1 (todo desktop em tamanho
 * normal) a funcao e identidade — o mouse nao muda em nada.
 */
function posicionar() {
	const root = ContextMenu.getRoot();
	const menu = root && root.querySelector('.menu');
	if (!menu) {
		return;
	}
	const caixa = menu.getBoundingClientRect();
	const width = caixa.width;
	const height = caixa.height;
	let x = Mouse.screen.x;
	let y = Mouse.screen.y;

	/* D-936: as bordas seguras do aparelho (entalhe, barra de gestos) tambem
	   sao pixel de viewport — env() nao e escalado pelo zoom de nenhum
	   ancestral, so o layout normal e. Sao ZERO em qualquer desktop (e em
	   qualquer tela sem entalhe), entao esta leitura nao muda nada no mouse.
	   Nenhum outro lugar do cliente le --safe-* pelo JS (so pelo CSS, ver
	   Common.css) — getComputedStyle e a forma de ler o MESMO token aqui,
	   sem duplicar a conta do env() em outro lugar. */
	const cs = getComputedStyle(menu);
	const safeEsq = parseFloat(cs.getPropertyValue('--safe-esq')) || 0;
	const safeDir = parseFloat(cs.getPropertyValue('--safe-dir')) || 0;
	const safeTopo = parseFloat(cs.getPropertyValue('--safe-topo')) || 0;
	const safeBaixo = parseFloat(cs.getPropertyValue('--safe-baixo')) || 0;

	if (x + width > Renderer.width - safeDir) {
		x = x - width;
	}
	if (x < safeEsq) {
		x = safeEsq;
	}

	if (y + height > Renderer.height - safeBaixo) {
		y = y - height;
	}
	if (y < safeTopo) {
		y = safeTopo;
	}

	menu.style.top = emUnidadesDaHud(y) + 'px';
	menu.style.left = emUnidadesDaHud(x) + 'px';
}

/**
 * O POSICIONAMENTO ACONTECE DUAS VEZES, E A SEGUNDA E A QUE VALE.
 *
 * `onAppend` roda quando o menu entra no documento — e todo chamador deste
 * componente faz `remove()` / `append()` **e so entao** `addElement(...)`.
 * Nesse instante o `.menu` esta VAZIO: a conta de "cabe na tela?" media uma
 * caixa do tamanho do recheio, entao ela nunca virava o menu para dentro, e um
 * menu aberto perto da borda direita simplesmente saia da tela.
 *
 * No desktop isso passava despercebido — sobra tela de todo lado. Num celular
 * de 375px a grade da mochila encosta na borda, e o menu do item nasceria
 * cortado. Por isso `addElement` reposiciona: a funcao recalcula tudo a partir
 * de `Mouse.screen`, entao chama-la de novo e barato e idempotente.
 */
ContextMenu.onAppend = posicionar;

/**
 * Clean up menu contents
 */
ContextMenu.onRemove = function onRemove() {
	const root = this.getRoot();
	root.querySelector('.menu').innerHTML = '';
};

/**
 * Add a clickable node to the context menu
 *
 * @param {string} text
 * @param {function} callback once clicked
 */
ContextMenu.addElement = function addElement(text, callback) {
	const root = this.getRoot();
	const item = document.createElement('div');
	item.textContent = text;
	item.addEventListener('click', () => {
		ContextMenu.remove();
		callback();
	});
	root.querySelector('.menu').appendChild(item);
	/* O menu acabou de mudar de tamanho — ver `posicionar()`. */
	posicionar();
};

/**
 * Add a delimiter to the links
 */
ContextMenu.nextGroup = function nextGroup() {
	const root = this.getRoot();
	root.querySelector('.menu').appendChild(document.createElement('hr'));
	posicionar();
};

/**
 * Create component and export it
 */
export default UIManager.addComponent(ContextMenu);
