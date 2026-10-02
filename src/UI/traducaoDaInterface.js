/**
 * UI/traducaoDaInterface.js
 *
 * A TRADUCAO DAS JANELAS (D-1929, 01/10/2026 — o jogo em ingles).
 *
 * Toda janela do jogo e um `GUIComponent` com raiz de sombra propria, e o
 * texto dela nasce de tres jeitos: o modelo HTML, o `innerHTML`/`textContent`
 * que o componente escreve depois, e o texto que o servidor manda. Em vez de
 * tocar as ~2.000 frases do cliente uma a uma, um `MutationObserver` em cada
 * raiz traduz o no de texto e os atributos visiveis (`title`, `placeholder`,
 * `aria-label`, `alt`, e o `value` de botao) ao nascer e ao mudar, pelo
 * tradutor de `Core/Traducao.js`.
 *
 * O QUE NAO SE TRADUZ: o que o JOGADOR escreveu — chat, nome de personagem,
 * nome de grupo — mora dentro de `[translate="no"]` (o atributo padrao do
 * HTML para isto), e o observador pula a subarvore inteira. Tambem ficam de
 * fora `<script>`, `<style>`, `<textarea>` e campo de texto.
 *
 * Em portugues (o padrao) nada aqui liga: `observarRaiz` volta sem observar.
 *
 * @author RagIdle
 */

import { traduzir, traducaoLigada } from 'Core/Traducao.js';

/**
 * Os atributos que o jogador LE. Os `data-*` viram tooltip ou `content: attr(...)`
 * (a extracao os traz, docs/PLANO-IDIOMA-INGLES.md secao 3.2); quem os le no
 * codigo so os mostra — o `data-title` numerico do Equipment nao tem letra e
 * passa intocado.
 */
const ATRIBUTOS_VISIVEIS = [
	'title',
	'placeholder',
	'aria-label',
	'alt',
	'data-tooltip',
	'data-dica',
	'data-rotulo',
	'data-placeholder',
	'data-title'
];

/** Elementos cujo texto nunca e nosso para traduzir. */
const ELEMENTOS_PULADOS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE']);

/** @type {WeakMap<Node, string>} o ultimo texto que NOS escrevemos em cada no (para nao traduzir a propria traducao) */
const _escrito = new WeakMap();

/** @type {Set<Node>} as raizes observadas, para a retraducao quando o catalogo chega */
const _raizes = new Set();

/** @type {WeakMap<Node, MutationObserver>} */
const _observadores = new WeakMap();

/**
 * Este elemento (ou um ancestral DENTRO da mesma arvore) pede para nao
 * traduzir? `closest` nao atravessa a sombra, e e isso que queremos: o
 * componente decide pela propria arvore.
 */
function dentroDeNaoTraduzir(elemento) {
	if (!elemento || typeof elemento.closest !== 'function') {
		return false;
	}
	return elemento.closest('[translate="no"]') !== null;
}

function pulavel(elemento) {
	if (!elemento) {
		return true;
	}
	for (let e = elemento; e; e = e.parentElement) {
		if (ELEMENTOS_PULADOS.has(e.tagName)) {
			return true;
		}
	}
	return dentroDeNaoTraduzir(elemento);
}

function traduzirNoDeTexto(no) {
	const atual = no.nodeValue;
	if (!atual || _escrito.get(no) === atual) {
		return;
	}
	if (pulavel(no.parentElement)) {
		return;
	}
	const traduzido = traduzir(atual);
	if (traduzido !== atual) {
		_escrito.set(no, traduzido);
		no.nodeValue = traduzido;
	}
}

function traduzirAtributos(elemento) {
	if (pulavel(elemento)) {
		return;
	}
	for (const nome of ATRIBUTOS_VISIVEIS) {
		const valor = elemento.getAttribute(nome);
		if (valor) {
			const traduzido = traduzir(valor);
			if (traduzido !== valor) {
				elemento.setAttribute(nome, traduzido);
			}
		}
	}
	if (elemento.tagName === 'INPUT') {
		const tipo = (elemento.getAttribute('type') || '').toLowerCase();
		if (tipo === 'button' || tipo === 'submit' || tipo === 'reset') {
			const valor = elemento.getAttribute('value');
			if (valor) {
				const traduzido = traduzir(valor);
				if (traduzido !== valor) {
					elemento.setAttribute('value', traduzido);
					elemento.value = traduzido;
				}
			}
		}
	}
}

/**
 * Traduz uma subarvore inteira (o que ja esta la).
 *
 * @param {Node} raiz - elemento, raiz de sombra ou documento
 */
export function traduzirArvore(raiz) {
	if (!traducaoLigada() || !raiz) {
		return;
	}
	if (raiz.nodeType === 3) {
		traduzirNoDeTexto(raiz);
		return;
	}
	if (raiz.nodeType === 1) {
		if (pulavel(raiz)) {
			return;
		}
		traduzirAtributos(raiz);
	}
	const doc = raiz.ownerDocument || raiz;
	const caminhante = doc.createTreeWalker(raiz, 1 | 4, {
		acceptNode(no) {
			if (no.nodeType === 1) {
				// Subarvore que nao se traduz: rejeita inteira.
				if (ELEMENTOS_PULADOS.has(no.tagName) || no.getAttribute('translate') === 'no') {
					return 2; // FILTER_REJECT
				}
			}
			return 1; // FILTER_ACCEPT
		}
	});
	for (let no = caminhante.nextNode(); no; no = caminhante.nextNode()) {
		if (no.nodeType === 3) {
			traduzirNoDeTexto(no);
		} else {
			traduzirAtributos(no);
		}
	}
}

function aoMudar(mutacoes) {
	for (const m of mutacoes) {
		if (m.type === 'characterData') {
			traduzirNoDeTexto(m.target);
		} else if (m.type === 'attributes') {
			if (m.target.nodeType === 1) {
				traduzirAtributos(m.target);
			}
		} else {
			for (const no of m.addedNodes) {
				traduzirArvore(no);
			}
		}
	}
}

/**
 * Passa a traduzir uma raiz (a de sombra de uma janela, ou o `document.body`)
 * e traduz o que ela ja tem. Chamar de novo na mesma raiz nao duplica.
 *
 * @param {Node} raiz
 */
export function observarRaiz(raiz) {
	if (!raiz || _observadores.has(raiz)) {
		return;
	}
	_raizes.add(raiz);
	if (!traducaoLigada()) {
		// O catalogo ainda nao chegou (ou o idioma e portugues): a raiz fica
		// registrada e `retraduzirTudo` liga o observador quando ele chegar.
		return;
	}
	ligarObservador(raiz);
}

/**
 * O TEXTO QUE MORA NO CSS: `content: "Nenhuma mensagem"` num pseudo-elemento
 * nao esta no DOM, e o observador nao o ve. O estilo da janela e texto dentro
 * de `<style>` na propria raiz, entao a traducao reescreve a string do
 * `content` ali (uma vez por estilo).
 *
 * @param {Node} raiz
 */
export function traduzirEstilos(raiz) {
	if (!traducaoLigada() || !raiz || typeof raiz.querySelectorAll !== 'function') {
		return;
	}
	for (const estilo of raiz.querySelectorAll('style')) {
		const css = estilo.textContent || '';
		if (!css.includes('content') || _escrito.get(estilo) === css) {
			continue;
		}
		const traduzido = css.replace(/(content\s*:\s*)(['"])((?:\\.|(?!\2)[^\\])*)\2/g, (tudo, antes, aspa, miolo) => {
			const texto = miolo.replace(/\\(.)/g, '$1');
			const emIngles = traduzir(texto);
			if (emIngles === texto) {
				return tudo;
			}
			const escapado = emIngles.replace(/\\/g, '\\\\').split(aspa).join('\\' + aspa);
			return antes + aspa + escapado + aspa;
		});
		if (traduzido !== css) {
			estilo.textContent = traduzido;
		}
		_escrito.set(estilo, estilo.textContent);
	}
}

function ligarObservador(raiz) {
	if (_observadores.has(raiz)) {
		return;
	}
	traduzirEstilos(raiz);
	const observador = new MutationObserver(aoMudar);
	observador.observe(raiz, {
		subtree: true,
		childList: true,
		characterData: true,
		attributes: true,
		attributeFilter: [...ATRIBUTOS_VISIVEIS, 'value']
	});
	_observadores.set(raiz, observador);
	traduzirArvore(raiz);
}

/**
 * O catalogo chegou depois de as janelas nascerem: liga os observadores das
 * raizes registradas e traduz o que ja esta na tela.
 */
export function retraduzirTudo() {
	if (!traducaoLigada()) {
		return;
	}
	for (const raiz of _raizes) {
		ligarObservador(raiz);
	}
}

/** So para os testes. */
export function esquecerRaizes() {
	for (const raiz of _raizes) {
		const o = _observadores.get(raiz);
		if (o) {
			o.disconnect();
		}
		_observadores.delete(raiz);
	}
	_raizes.clear();
}
