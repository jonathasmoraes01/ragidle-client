import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * O RO SHOP SEMPRE VISIVEL (24/09/2026, pedido do dono).
 *
 * Ele morava so no LEQUE do menu, que so aparece com o Menu aberto, e os
 * jogadores nao o achavam. Agora ele tambem mora no CLUSTER de cima, na vaga
 * abaixo do "Votar" (coluna 5 da segunda fileira, ao lado do "Analise"), e no
 * TRILHO do celular em pe, que e o que fica na tela com o menu fechado.
 *
 * O que estes casos seguram e a REGRA de lugar (HTML + CSS). Que o botao cabe
 * e recebe o toque e medido na tela, pela `prove:hud-responsiva` e pela
 * `prove:hud-vertical` (regra 5: estar no DOM nao prova que da para ver).
 */
const raiz = resolve(import.meta.dirname, '../../src/UI/Components/TopMenuIdle');
const html = readFileSync(resolve(raiz, 'TopMenuIdle.html'), 'utf8');
const css = readFileSync(resolve(raiz, 'TopMenuIdle.css'), 'utf8').replace(/\r\n/g, '\n');

function documento() {
	const div = document.createElement('div');
	div.innerHTML = html;
	return div;
}

describe('o RO Shop fora da gaveta do menu', () => {
	it('mora no CLUSTER de cima, logo depois do Votar, com a mesma porta do leque', () => {
		const doc = documento();
		const noCluster = doc.querySelector('.tm-top .tm-item[data-action="roshop"]');
		expect(noCluster).not.toBeNull();
		expect(noCluster.classList.contains('tm-item--roshop')).toBe(true);
		expect(noCluster.previousElementSibling.dataset.action).toBe('voto');
		const noLeque = doc.querySelector('.tm-fan .tm-item[data-action="roshop"]');
		expect(noLeque).not.toBeNull();
		// Mesmo rotulo, mesmo titulo e mesmo icone: e a MESMA porta em dois lugares.
		expect(noCluster.querySelector('.tm-label').textContent).toBe(noLeque.querySelector('.tm-label').textContent);
		expect(noCluster.title).toBe(noLeque.title);
		expect(noCluster.querySelector('.tm-icon-wrap').innerHTML.trim()).toBe(
			noLeque.querySelector('.tm-icon-wrap').innerHTML.trim()
		);
	});

	it('o do cluster e o UNICO com a classe que o poe na vaga e no trilho', () => {
		expect(documento().querySelectorAll('.tm-item--roshop').length).toBe(1);
	});

	it('com cinco colunas ele desenha na coluna 5 da SEGUNDA fileira, abaixo do Votar', () => {
		const regra = /\.tm-top\[data-colunas='5'\] \.tm-item--roshop \{\s*grid-column: 5;\s*grid-row: 2;\s*\}/;
		expect(css).toMatch(regra);
		const voto = /\.tm-top\[data-colunas='5'\] \.tm-item--voto \{\s*grid-column: 5;\s*grid-row: 1;\s*\}/;
		expect(css).toMatch(voto);
	});

	it('no celular em pe ele entra no trilho (a lista que MOSTRA itens com o menu fechado)', () => {
		const inicio = css.indexOf(".ri-vertical .tm-top .tm-item[data-action='inventory'],");
		expect(inicio).toBeGreaterThan(-1);
		const seletor = css.slice(inicio, css.indexOf('{', inicio));
		expect(seletor).toContain('.ri-vertical .tm-top .tm-item--roshop');
		const corpo = css.slice(css.indexOf('{', inicio), css.indexOf('}', inicio));
		expect(corpo).toContain('display: flex !important');
	});
});
