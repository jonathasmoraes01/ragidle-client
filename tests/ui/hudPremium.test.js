/**
 * A HUD MOBILE PREMIUM (15/10/2026) — a bandeira, a marca e a injecao.
 *
 * O desenho mora em CSS atras da marca `ri-premium`; o que se testa aqui e o
 * que pode quebrar em silencio:
 *   - a bandeira so liga com `true` exato, e depende da camada adaptavel;
 *   - com ela desligada NENHUM byte da camada chega ao documento ou a shadow
 *     nenhum (a volta e inteira);
 *   - a marca so existe onde a vertical existe, nos dois mundos;
 *   - o minimapa volta a desenhar no celular em pe so com a premium.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HudVertical, { MARCA_VERTICAL, aplicar } from 'UI/hudVertical.js';
import HudPremium, {
	MARCA_PREMIUM,
	cssDoComponente,
	componentesComCss,
	ehHudPremium,
	garantirCssDoDocumento,
	injetarNoShadow
} from 'UI/HudPremium/hudPremium.js';
import { minimapaVisivel } from 'UI/Components/MiniMap/minimapaNoQuadro.js';

function hostFalso(nome) {
	const host = document.createElement('div');
	host.id = nome;
	host.dataset.guiComponent = nome;
	const shadow = host.attachShadow({ mode: 'open' });
	const raiz = document.createElement('div');
	raiz.className = 'ui-component-root';
	shadow.appendChild(raiz);
	document.body.appendChild(host);
	return { host, shadow, raiz };
}

function fingirCriterio(casa) {
	vi.stubGlobal('matchMedia', consulta => ({
		matches: casa,
		media: consulta,
		addEventListener() {},
		removeEventListener() {}
	}));
	window.matchMedia = globalThis.matchMedia;
}

function ligarPremium(valor = true) {
	window.ROConfig = { enableHudAdaptavel: true, enableHudMobilePremium: valor };
}

beforeEach(() => {
	document.head.innerHTML = '';
	document.body.innerHTML = '';
	document.documentElement.className = '';
	delete window.ROConfig;
	HudVertical.desligarParaTeste();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('ehHudPremium — a bandeira falha para DESLIGADO', () => {
	it('sem ROConfig, desligada', () => {
		expect(ehHudPremium()).toBe(false);
	});

	it('com a chave ausente ou false, desligada', () => {
		window.ROConfig = { enableHudAdaptavel: true };
		expect(ehHudPremium()).toBe(false);
		ligarPremium(false);
		expect(ehHudPremium()).toBe(false);
	});

	it('so `true` exato liga: "true", 1 e "sim" nao', () => {
		for (const valor of ['true', 1, 'sim']) {
			ligarPremium(valor);
			expect(ehHudPremium()).toBe(false);
		}
		ligarPremium(true);
		expect(ehHudPremium()).toBe(true);
	});

	it('com a camada adaptavel desligada, a premium nao existe', () => {
		window.ROConfig = { enableHudAdaptavel: false, enableHudMobilePremium: true };
		expect(ehHudPremium()).toBe(false);
	});
});

describe('cssDoComponente e injetarNoShadow', () => {
	it('desligada, nao devolve nem injeta nada', () => {
		const { shadow } = hostFalso('BasicInfoIdle');
		expect(cssDoComponente('BasicInfoIdle')).toBe('');
		expect(injetarNoShadow(shadow, 'BasicInfoIdle')).toBe(false);
		expect(shadow.querySelector('style')).toBeNull();
	});

	it('a camada cobre as pecas da HUD, e as janelas ficam de fora', () => {
		ligarPremium();
		expect(componentesComCss().sort()).toEqual(
			[
				'BasicInfoIdle',
				'ChatBox',
				'CombatCornerIdle',
				'HuntButtonIdle',
				'MiniMapV2',
				'MissoesTrackerIdle',
				'ShortCut',
				'StatusIcons',
				'TopMenuIdle'
			].sort()
		);
		const { shadow } = hostFalso('MochilaIdle');
		expect(injetarNoShadow(shadow, 'MochilaIdle')).toBe(false);
		expect(cssDoComponente('MochilaIdle')).toBe('');
	});

	it('o estilo entra DEPOIS dos que ja existem (vence por ordem) e uma vez so', () => {
		ligarPremium();
		const { shadow } = hostFalso('BasicInfoIdle');
		const doComponente = document.createElement('style');
		doComponente.setAttribute('data-component', 'BasicInfoIdle');
		shadow.insertBefore(doComponente, shadow.firstChild);
		expect(injetarNoShadow(shadow, 'BasicInfoIdle')).toBe(true);
		expect(injetarNoShadow(shadow, 'BasicInfoIdle')).toBe(true);
		const estilos = shadow.querySelectorAll('style');
		expect(estilos.length).toBe(2);
		expect(estilos[1].getAttribute('data-hud-premium')).toBe('BasicInfoIdle');
	});

	it('o CSS de documento entra uma vez, e so com a bandeira', () => {
		expect(garantirCssDoDocumento(document)).toBe(false);
		expect(document.head.querySelector('style[data-hud-premium]')).toBeNull();
		ligarPremium();
		expect(garantirCssDoDocumento(document)).toBe(true);
		expect(garantirCssDoDocumento(document)).toBe(true);
		expect(document.head.querySelectorAll('style[data-hud-premium]').length).toBe(1);
	});
});

describe('a marca, pela rota de hudVertical.aplicar', () => {
	it('celular em pe + bandeira: as duas marcas nos dois mundos', () => {
		fingirCriterio(true);
		ligarPremium();
		const { raiz } = hostFalso('TopMenuIdle');
		aplicar(document, true);
		expect(document.documentElement.classList.contains(MARCA_VERTICAL)).toBe(true);
		expect(document.documentElement.classList.contains(MARCA_PREMIUM)).toBe(true);
		expect(raiz.classList.contains(MARCA_PREMIUM)).toBe(true);
		expect(document.head.querySelector('style[data-hud-premium]')).not.toBeNull();
	});

	it('celular em pe sem a bandeira: so a vertical, e nenhum CSS da camada', () => {
		fingirCriterio(true);
		ligarPremium(false);
		const { raiz } = hostFalso('TopMenuIdle');
		aplicar(document, true);
		expect(document.documentElement.classList.contains(MARCA_VERTICAL)).toBe(true);
		expect(document.documentElement.classList.contains(MARCA_PREMIUM)).toBe(false);
		expect(raiz.classList.contains(MARCA_PREMIUM)).toBe(false);
		expect(document.head.querySelector('style[data-hud-premium]')).toBeNull();
	});

	it('fora do celular em pe a bandeira nao basta: nenhuma marca', () => {
		fingirCriterio(false);
		ligarPremium();
		aplicar(document, true);
		expect(document.documentElement.classList.contains(MARCA_PREMIUM)).toBe(false);
	});

	it('girar para fora do em pe tira a premium junto com a vertical', () => {
		fingirCriterio(true);
		ligarPremium();
		const { raiz } = hostFalso('TopMenuIdle');
		aplicar(document, true);
		fingirCriterio(false);
		aplicar(document);
		expect(document.documentElement.classList.contains(MARCA_PREMIUM)).toBe(false);
		expect(raiz.classList.contains(MARCA_PREMIUM)).toBe(false);
	});
});

describe('o minimapa no celular em pe', () => {
	it('sem a premium continua escondido (D-939)', () => {
		document.documentElement.classList.add(MARCA_VERTICAL);
		expect(minimapaVisivel(document, 'MiniMapV2')).toBe(false);
	});

	it('com a premium ele volta a desenhar', () => {
		document.documentElement.classList.add(MARCA_VERTICAL, MARCA_PREMIUM);
		expect(minimapaVisivel(document, 'MiniMapV2')).toBe(true);
	});

	it('fora do em pe ele desenha, com ou sem premium', () => {
		expect(minimapaVisivel(document, 'MiniMapV2')).toBe(true);
	});
});

describe('o modulo padrao', () => {
	it('exporta as mesmas funcoes', () => {
		expect(HudPremium.ehHudPremium).toBe(ehHudPremium);
		expect(HudPremium.MARCA_PREMIUM).toBe('ri-premium');
	});
});
