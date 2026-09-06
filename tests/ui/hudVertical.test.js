/**
 * A HUD VERTICAL DO CELULAR EM PE (D-939, 05/09/2026) — o interruptor.
 *
 * O modulo `UI/hudVertical.js` e SO a decisao ("e um celular em pe?") e o
 * carimbo (`ri-vertical` no `<html>` e no root interno de cada shadow). Todo
 * o desenho mora em CSS atras da marca — entao o que se testa aqui e
 * exatamente o que pode quebrar em silencio: o criterio, a bandeira de
 * rollout, o carimbo nos dois mundos e a remocao limpa ao girar o aparelho.
 *
 * `matchMedia` e falsificado por teste: o jsdom nao tem ponteiro nem
 * orientacao, e o que interessa e a LOGICA em volta dele, nao o navegador.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HudVertical, { MARCA_VERTICAL, aplicar, ehCelularEmPe, ligar, reaplicar } from 'UI/hudVertical.js';

/** Um host de componente como o GUIComponent monta: shadow aberto + root interno. */
function hostFalso(nome) {
	const host = document.createElement('div');
	host.id = nome;
	host.dataset.guiComponent = nome;
	const shadow = host.attachShadow({ mode: 'open' });
	const raiz = document.createElement('div');
	raiz.className = 'ui-component-root';
	shadow.appendChild(raiz);
	document.body.appendChild(host);
	return { host, raiz };
}

function fingirCriterio(casa) {
	vi.stubGlobal('matchMedia', (consulta) => ({
		matches: casa,
		media: consulta,
		addEventListener() {},
		removeEventListener() {},
	}));
	window.matchMedia = globalThis.matchMedia;
}

beforeEach(() => {
	document.body.innerHTML = '';
	document.documentElement.className = '';
	delete window.ROConfig;
	HudVertical.desligarParaTeste();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('ehCelularEmPe', () => {
	it('e verdadeiro quando o criterio de media casa', () => {
		fingirCriterio(true);
		expect(ehCelularEmPe()).toBe(true);
	});

	it('e falso quando o criterio nao casa (desktop, deitado, tablet)', () => {
		fingirCriterio(false);
		expect(ehCelularEmPe()).toBe(false);
	});

	it('a bandeira de rollout DESLIGA a vertical mesmo com o criterio casando (D-937)', () => {
		fingirCriterio(true);
		window.ROConfig = { enableHudAdaptavel: false };
		expect(ehCelularEmPe()).toBe(false);
	});

	it('sem matchMedia nenhum (casca minima), falha para DESLIGADO', () => {
		vi.stubGlobal('matchMedia', undefined);
		window.matchMedia = undefined;
		expect(ehCelularEmPe()).toBe(false);
	});
});

describe('aplicar', () => {
	it('carimba o <html> E o root interno de cada shadow', () => {
		fingirCriterio(true);
		const { raiz } = hostFalso('BasicInfoIdle');
		aplicar(document, true);
		expect(document.documentElement.classList.contains(MARCA_VERTICAL)).toBe(true);
		expect(raiz.classList.contains(MARCA_VERTICAL)).toBe(true);
	});

	it('REMOVE o carimbo dos dois mundos quando o criterio deixa de casar (girou o aparelho)', () => {
		fingirCriterio(true);
		const { raiz } = hostFalso('ShortCut');
		aplicar(document, true);
		expect(raiz.classList.contains(MARCA_VERTICAL)).toBe(true);

		fingirCriterio(false);
		aplicar(document, true);
		expect(document.documentElement.classList.contains(MARCA_VERTICAL)).toBe(false);
		expect(raiz.classList.contains(MARCA_VERTICAL)).toBe(false);
	});

	it('um host criado DEPOIS ganha a marca no reaplicar (janela nova, troca de mapa)', () => {
		fingirCriterio(true);
		aplicar(document, true);
		const { raiz } = hostFalso('MochilaIdle');
		expect(raiz.classList.contains(MARCA_VERTICAL)).toBe(false);
		reaplicar(document);
		expect(raiz.classList.contains(MARCA_VERTICAL)).toBe(true);
	});

	it('e idempotente e sai cedo quando nada mudou (roda no caminho do resize)', () => {
		fingirCriterio(true);
		const { raiz } = hostFalso('ChatBox');
		aplicar(document, true);
		/* Sem `forcar`, o cache segura: um host novo NAO e varrido... */
		const { raiz: raizNova } = hostFalso('IdleSkills');
		aplicar(document);
		expect(raizNova.classList.contains(MARCA_VERTICAL)).toBe(false);
		/* ...e o que ja estava carimbado continua carimbado. */
		expect(raiz.classList.contains(MARCA_VERTICAL)).toBe(true);
	});

	it('host sem shadow (marcador de outra origem) nao derruba a varredura', () => {
		fingirCriterio(true);
		const solto = document.createElement('div');
		solto.dataset.guiComponent = 'SemShadow';
		document.body.appendChild(solto);
		const { raiz } = hostFalso('StatusIcons');
		expect(() => aplicar(document, true)).not.toThrow();
		expect(raiz.classList.contains(MARCA_VERTICAL)).toBe(true);
	});
});

describe('ligar', () => {
	it('aplica ja na ligada e responde ao resize', () => {
		fingirCriterio(true);
		const { raiz } = hostFalso('TopMenuIdle');
		ligar(document);
		expect(raiz.classList.contains(MARCA_VERTICAL)).toBe(true);

		fingirCriterio(false);
		window.dispatchEvent(new Event('resize'));
		expect(raiz.classList.contains(MARCA_VERTICAL)).toBe(false);
	});

	it('ligar duas vezes nao duplica ouvintes (o segundo e ignorado)', () => {
		fingirCriterio(true);
		const espiao = vi.spyOn(window, 'addEventListener');
		ligar(document);
		const chamadas = espiao.mock.calls.filter(([tipo]) => tipo === 'resize').length;
		ligar(document);
		const depois = espiao.mock.calls.filter(([tipo]) => tipo === 'resize').length;
		expect(depois).toBe(chamadas);
	});
});
