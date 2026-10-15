/**
 * UI/Components/StatusIcons/alturaDosBuffs.js
 *
 * A ALTURA DOS BUFFS, MEDIDA E PUBLICADA (15/10/2026).
 *
 * Com a folha do Menu aberta na HUD premium, os buffs descem para uma fileira
 * no rodape (`documento.css`), e o leque da folha para ACIMA dela
 * (`--m-folha-fundo`, tokens.css). A fileira quebra para cima quando enche: em
 * 375x667, com seis buffs, sao duas fileiras - e a folha, que contava uma,
 * cobria a de cima (medido pelo arnes de fotos, `premium-menu`).
 *
 * Quantas fileiras cabem depende da largura que sobra ate o grupo de acao, do
 * Tamanho da HUD e de quantos buffs estao acesos: contar no JS seria refazer a
 * grade do CSS. Entao a caixa e MEDIDA, como a altura do cluster do Menu
 * (`publicarAlturaDoCluster`, TopMenuIdle.js): mesmo `ResizeObserver`, mesma
 * guarda de "so publica quando muda", mesma unidade da HUD.
 *
 * Sem buffs a caixa tem altura zero, e a variavel SAI: quem a le cai na reserva
 * de uma fileira (`var(--m-buffs-altura, var(--m-buff))`).
 */

import { emUnidadesDaHud } from 'UI/escalaDaHud.js';

export const VARIAVEL_DA_ALTURA = '--m-buffs-altura';

let _publicada = null;
let _observador = null;

/** Publica a altura de agora da caixa dos buffs no documento (so se mudou). */
export function publicarAlturaDosBuffs(el) {
	const raiz = el && el.ownerDocument ? el.ownerDocument.documentElement : null;
	if (!raiz) {
		return;
	}
	const altura = el.getBoundingClientRect().height;
	const valor = altura > 0 ? `${Math.round(emUnidadesDaHud(altura))}px` : null;
	if (valor === _publicada) {
		return;
	}
	_publicada = valor;
	if (valor) {
		raiz.style.setProperty(VARIAVEL_DA_ALTURA, valor);
	} else {
		raiz.style.removeProperty(VARIAVEL_DA_ALTURA);
	}
}

/** Passa a vigiar a caixa (troca a vigiada, se ja havia uma). */
export function observarAlturaDosBuffs(el) {
	pararDeObservarOsBuffs();
	if (!el) {
		return;
	}
	if (typeof ResizeObserver !== 'undefined') {
		_observador = new ResizeObserver(() => publicarAlturaDosBuffs(el));
		_observador.observe(el);
	}
	publicarAlturaDosBuffs(el);
}

export function pararDeObservarOsBuffs() {
	if (_observador) {
		_observador.disconnect();
		_observador = null;
	}
}

export default { VARIAVEL_DA_ALTURA, publicarAlturaDosBuffs, observarAlturaDosBuffs, pararDeObservarOsBuffs };
