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
	MARCA_COM_ATALHOS,
	MARCA_PREMIUM,
	barraDeAtalhosLigada,
	definirBarraDeAtalhos,
	esquecerPreferenciasParaTeste,
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
	localStorage.clear();
	esquecerPreferenciasParaTeste();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

/* Desde 15/10/2026 ela e a HUD PADRAO do celular e falha para LIGADO, como a `enableHudAdaptavel`: o navegador
   de quem ja jogava seguiu com a HUD antiga porque a chave `true` do Config.js nao chegava a ele (a janela
   anonima vinha com a nova). So `false` exato desliga - o desligar de emergencia do Config.local.js. */
describe('ehHudPremium — a bandeira falha para LIGADO (a HUD padrao)', () => {
	it('sem ROConfig nenhum (a casca antes do jogo), desligada', () => {
		expect(ehHudPremium()).toBe(false);
	});

	it('com a chave AUSENTE, ligada: um Config.js velho no navegador nao segura a HUD antiga', () => {
		window.ROConfig = { enableHudAdaptavel: true };
		expect(ehHudPremium()).toBe(true);
		window.ROConfig = {};
		expect(ehHudPremium()).toBe(true);
	});

	it('so `false` exato desliga: "false", 0 e null nao', () => {
		for (const valor of ['false', 0, null, undefined, true]) {
			ligarPremium(valor);
			expect(ehHudPremium()).toBe(true);
		}
		ligarPremium(false);
		expect(ehHudPremium()).toBe(false);
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
				'FPS',
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

describe('a barra de skills: nasce DESLIGADA e o jogador a liga nas Configuracoes', () => {
	it('sem nada guardado, desligada', () => {
		expect(barraDeAtalhosLigada()).toBe(false);
	});

	it('ligar guarda no aparelho: uma leitura nova (o proximo login) a acha ligada', () => {
		expect(definirBarraDeAtalhos(true)).toBe(true);
		esquecerPreferenciasParaTeste();
		expect(barraDeAtalhosLigada()).toBe(true);
		definirBarraDeAtalhos(false);
		esquecerPreferenciasParaTeste();
		expect(barraDeAtalhosLigada()).toBe(false);
	});

	it('so `true` liga, tambem no que veio guardado (um valor estranho no storage nao liga)', () => {
		definirBarraDeAtalhos('sim');
		expect(barraDeAtalhosLigada()).toBe(false);
		localStorage.setItem('HudPremium', JSON.stringify({ barraDeAtalhos: 'sim', _version: 1.0 }));
		esquecerPreferenciasParaTeste();
		expect(barraDeAtalhosLigada()).toBe(false);
	});

	it('o storage recusado (modo privado) nao derruba nada: desligada, e ligar vale ate o fim da sessao', () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('SecurityError');
		});
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('SecurityError');
		});
		expect(barraDeAtalhosLigada()).toBe(false);
		expect(definirBarraDeAtalhos(true)).toBe(true);
		expect(barraDeAtalhosLigada()).toBe(true);
		vi.restoreAllMocks();
	});

	it('a marca `ri-com-atalhos` so com a premium e a barra ligada, nos dois mundos', () => {
		fingirCriterio(true);
		ligarPremium();
		const { raiz } = hostFalso('ShortCut');
		aplicar(document, true);
		expect(document.documentElement.classList.contains(MARCA_COM_ATALHOS)).toBe(false);
		expect(raiz.classList.contains(MARCA_COM_ATALHOS)).toBe(false);
		definirBarraDeAtalhos(true);
		HudVertical.reaplicar(document);
		expect(document.documentElement.classList.contains(MARCA_COM_ATALHOS)).toBe(true);
		expect(raiz.classList.contains(MARCA_COM_ATALHOS)).toBe(true);
	});

	it('sem a premium a preferencia nao vale: a barra e a de sempre e nao ha marca', () => {
		fingirCriterio(true);
		ligarPremium(false);
		definirBarraDeAtalhos(true);
		aplicar(document, true);
		expect(document.documentElement.classList.contains(MARCA_COM_ATALHOS)).toBe(false);
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
