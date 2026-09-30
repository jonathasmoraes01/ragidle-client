/**
 * A BOLINHA DO "MENU" E A DA "TEMPORADA" (29/09/2026, pedido do dono: a
 * bolinha vermelha tem de aparecer onde o jogador olha).
 */
import { describe, expect, it } from 'vitest';
import { pontoDoMenuAceso } from '../../src/UI/Components/TopMenuIdle/pontoDoMenu.js';
import { temRecompensaParaResgatar } from '../../src/UI/Components/TemporadaIdle/formatoDaTemporada.js';

function menu({ codex = false, correio = false, correioEscondido = false } = {}) {
	const root = document.createElement('div');
	root.innerHTML =
		'<div class="tm-top">' +
		`<button class="tm-item" data-action="correio" style="${correioEscondido ? 'display: none' : ''}">` +
		`<span class="ri-dot" style="${correio ? '' : 'display: none'}"></span></button>` +
		'</div>' +
		'<div class="tm-fan"><button class="tm-item" data-action="codex">' +
		`<span class="ri-dot" style="${codex ? '' : 'display: none'}"></span></button></div>`;
	document.body.appendChild(root);
	return root;
}

describe('a bolinha do botao Menu', () => {
	it('acende com ponto aceso dentro do leque (o Codex)', () => {
		expect(pontoDoMenuAceso(menu({ codex: true }), false)).toBe(true);
	});

	it('acende com ponto aceso num item do cluster que o layout escondeu (celular em pe)', () => {
		expect(pontoDoMenuAceso(menu({ correio: true, correioEscondido: true }), false)).toBe(true);
	});

	it('NAO acende quando o item com ponto esta a vista, nem sem ponto nenhum (controles)', () => {
		expect(pontoDoMenuAceso(menu({ correio: true }), false)).toBe(false);
		expect(pontoDoMenuAceso(menu(), false)).toBe(false);
	});

	it('com o cluster recolhido quem avisa e a alca, mas o leque continua valendo', () => {
		expect(pontoDoMenuAceso(menu({ correio: true, correioEscondido: true }), true)).toBe(false);
		expect(pontoDoMenuAceso(menu({ codex: true }), true)).toBe(true);
	});
});

describe('a bolinha da Temporada', () => {
	it('premio da trilha AVAILABLE acende; CLAIMED e LOCKED nao', () => {
		const com = s => ({ passe: { premios: [{ nivel: 1, trilha: 'free', situacao: s }] } });
		expect(temRecompensaParaResgatar(com('AVAILABLE'))).toBe(true);
		expect(temRecompensaParaResgatar(com('CLAIMED'))).toBe(false);
		expect(temRecompensaParaResgatar(com('LOCKED'))).toBe(false);
	});

	it('o visual do VIP que pode e nao foi resgatado acende', () => {
		expect(temRecompensaParaResgatar({ vip: { visual: { pode: true, resgatado: false } } })).toBe(true);
		expect(temRecompensaParaResgatar({ vip: { visual: { pode: true, resgatado: true } } })).toBe(false);
		expect(temRecompensaParaResgatar({ vip: { visual: { pode: false, resgatado: false } } })).toBe(false);
	});

	it('sem estado (a janela nunca pediu) nao acende', () => {
		expect(temRecompensaParaResgatar(null)).toBe(false);
	});
});
