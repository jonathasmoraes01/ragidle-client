/**
 * A HUD PREMIUM NO CELULAR DEITADO (15/10/2026) — a bandeira, as marcas e a tela de giro.
 *
 * Desde D-1491 o celular deitado nao desenhava o jogo: a tela "Gire o celular" cobria tudo. Com
 * `enableHudPaisagemPremium` ligada, a HUD premium desenha o deitado (`ri-deitado` junto de `ri-vertical` e
 * `ri-premium`). O que se testa aqui e o que pode quebrar em silencio:
 *   - a bandeira FALHA PARA DESLIGADA (so `true` exato liga) e depende da premium;
 *   - sem ela o deitado continua na tela de giro, e com ela a tela some e as marcas entram;
 *   - girar para em pe tira `ri-deitado` e deixa a HUD de celular;
 *   - o publicado nasce DESLIGADO (o modelo do builder) e o dev ligado;
 *   - a folha do Menu para acima da altura MEDIDA dos buffs (`alturaDosBuffs.js`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import HudVertical, { aplicar, ehCelularEmPe, ehHudDeCelular, faixasDaTela, ligar } from 'UI/hudVertical.js';
import { MARCA_DEITADO, MARCA_PREMIUM, ehPaisagemPremium } from 'UI/HudPremium/hudPremium.js';
import { aplicarTelaDeGiro } from 'UI/giroDoCelular.js';
import {
	VARIAVEL_DA_ALTURA,
	observarAlturaDosBuffs,
	pararDeObservarOsBuffs,
	publicarAlturaDosBuffs
} from 'UI/Components/StatusIcons/alturaDosBuffs.js';

const raizDoRepo = join(__dirname, '..', '..');
const ler = (...partes) => readFileSync(join(raizDoRepo, ...partes), 'utf8');
const ID_DA_TELA = 'ri-gire-o-celular';

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

/** Um celular (dedo), em pe ou deitado: cada consulta de media responde pela orientacao. */
function fingirCelular({ deitado }) {
	vi.stubGlobal('matchMedia', consulta => ({
		matches: consulta.includes('landscape') ? deitado : consulta.includes('portrait') ? !deitado : true,
		media: consulta,
		addEventListener() {},
		removeEventListener() {}
	}));
	window.matchMedia = globalThis.matchMedia;
}

function config(extra = {}) {
	window.ROConfig = { enableHudAdaptavel: true, enableHudMobilePremium: true, ...extra };
}

const temMarca = marca => document.documentElement.classList.contains(marca);
const telaDeGiro = () => document.getElementById(ID_DA_TELA);

beforeEach(() => {
	document.head.innerHTML = '';
	document.body.innerHTML = '';
	document.documentElement.className = '';
	document.documentElement.removeAttribute('style');
	delete window.ROConfig;
	HudVertical.desligarParaTeste();
	localStorage.clear();
});

afterEach(() => {
	pararDeObservarOsBuffs();
	vi.unstubAllGlobals();
});

describe('a bandeira falha para DESLIGADA', () => {
	it('sem a chave, desligada', () => {
		fingirCelular({ deitado: true });
		config();
		expect(ehPaisagemPremium()).toBe(false);
	});

	it.each([['true'], [1], [{}]])('so `true` exato liga (%j nao liga)', valor => {
		fingirCelular({ deitado: true });
		config({ enableHudPaisagemPremium: valor });
		expect(ehPaisagemPremium()).toBe(false);
	});

	it('com `true`, ligada', () => {
		fingirCelular({ deitado: true });
		config({ enableHudPaisagemPremium: true });
		expect(ehPaisagemPremium()).toBe(true);
	});

	it('depende da premium: com a premium desligada, nao liga', () => {
		fingirCelular({ deitado: true });
		config({ enableHudPaisagemPremium: true, enableHudMobilePremium: false });
		expect(ehPaisagemPremium()).toBe(false);
	});

	it('depende da adaptavel: com ela desligada, nao liga', () => {
		fingirCelular({ deitado: true });
		config({ enableHudPaisagemPremium: true, enableHudAdaptavel: false });
		expect(ehPaisagemPremium()).toBe(false);
	});

	it('sem ROConfig, desligada', () => {
		fingirCelular({ deitado: true });
		expect(ehPaisagemPremium()).toBe(false);
	});
});

describe('o celular deitado', () => {
	it('SEM a bandeira: a tela de giro cobre o jogo e nenhuma marca de celular entra', () => {
		fingirCelular({ deitado: true });
		config();
		const { raiz } = hostFalso('BasicInfoIdle');
		ligar(document);
		expect(telaDeGiro()).not.toBeNull();
		expect(temMarca('ri-vertical')).toBe(false);
		expect(temMarca(MARCA_DEITADO)).toBe(false);
		expect(raiz.classList.contains(MARCA_DEITADO)).toBe(false);
		expect(ehHudDeCelular()).toBe(false);
	});

	it('COM a bandeira: sem tela de giro, e as tres marcas nos dois mundos', () => {
		fingirCelular({ deitado: true });
		config({ enableHudPaisagemPremium: true });
		const { raiz } = hostFalso('BasicInfoIdle');
		ligar(document);
		expect(telaDeGiro()).toBeNull();
		for (const marca of ['ri-vertical', MARCA_PREMIUM, MARCA_DEITADO]) {
			expect(temMarca(marca)).toBe(true);
			expect(raiz.classList.contains(marca)).toBe(true);
		}
		expect(ehHudDeCelular()).toBe(true);
		/* `ehCelularEmPe` segue respondendo so "em pe" (a telemetria de quadrosNoCampo.js) */
		expect(ehCelularEmPe()).toBe(false);
	});

	it('girar para EM PE tira so a marca deitada; voltar a deitar a devolve', () => {
		fingirCelular({ deitado: true });
		config({ enableHudPaisagemPremium: true });
		const { raiz } = hostFalso('ChatBox');
		ligar(document);
		expect(raiz.classList.contains(MARCA_DEITADO)).toBe(true);

		fingirCelular({ deitado: false });
		window.dispatchEvent(new Event('resize'));
		expect(temMarca('ri-vertical')).toBe(true);
		expect(temMarca(MARCA_PREMIUM)).toBe(true);
		expect(temMarca(MARCA_DEITADO)).toBe(false);
		expect(raiz.classList.contains(MARCA_DEITADO)).toBe(false);

		fingirCelular({ deitado: true });
		window.dispatchEvent(new Event('resize'));
		expect(raiz.classList.contains(MARCA_DEITADO)).toBe(true);
	});

	it('a tela de giro que ja estava na frente SAI quando a bandeira vale', () => {
		fingirCelular({ deitado: true });
		config();
		ligar(document);
		expect(telaDeGiro()).not.toBeNull();

		HudVertical.desligarParaTeste();
		config({ enableHudPaisagemPremium: true });
		ligar(document);
		expect(telaDeGiro()).toBeNull();
	});

	it('com a premium desligada a bandeira deitada nao vale: a tela de giro continua', () => {
		fingirCelular({ deitado: true });
		config({ enableHudPaisagemPremium: true, enableHudMobilePremium: false });
		ligar(document);
		expect(telaDeGiro()).not.toBeNull();
		expect(temMarca(MARCA_DEITADO)).toBe(false);
	});

	it('em pe com a bandeira, nada de marca deitada nem de tela de giro', () => {
		fingirCelular({ deitado: false });
		config({ enableHudPaisagemPremium: true });
		ligar(document);
		expect(telaDeGiro()).toBeNull();
		expect(temMarca('ri-vertical')).toBe(true);
		expect(temMarca(MARCA_DEITADO)).toBe(false);
	});
});

describe('aplicarTelaDeGiro(doc, jogaDeitado)', () => {
	it('deitado e sem jogar deitado: monta a tela', () => {
		fingirCelular({ deitado: true });
		expect(aplicarTelaDeGiro(document)).toBe(true);
		expect(telaDeGiro()).not.toBeNull();
	});

	it('deitado e jogando deitado: nao monta, e tira a que havia', () => {
		fingirCelular({ deitado: true });
		aplicarTelaDeGiro(document);
		expect(aplicarTelaDeGiro(document, true)).toBe(false);
		expect(telaDeGiro()).toBeNull();
	});
});

describe('as faixas do deitado', () => {
	function tela(largura, altura) {
		vi.stubGlobal('innerWidth', largura);
		vi.stubGlobal('innerHeight', altura);
		window.innerWidth = largura;
		window.innerHeight = altura;
	}

	it.each([
		[568, 320, { baixa: true, minima: true, estreita: true }],
		[667, 375, { baixa: false, minima: false, estreita: true }],
		[852, 393, { baixa: false, minima: false, estreita: false }],
		[932, 430, { baixa: false, minima: false, estreita: false }]
	])('%ix%i', (largura, altura, esperado) => {
		fingirCelular({ deitado: true });
		config({ enableHudPaisagemPremium: true });
		tela(largura, altura);
		expect(faixasDaTela(true, true)).toEqual(esperado);
	});

	it('o 393 de altura deitado NAO cai nas faixas de em pe (que o poriam como baixa e minima)', () => {
		fingirCelular({ deitado: true });
		tela(852, 393);
		expect(faixasDaTela(true, false).minima).toBe(true);
		expect(faixasDaTela(true, true).minima).toBe(false);
	});

	it('as marcas da tela entram com o deitado', () => {
		fingirCelular({ deitado: true });
		config({ enableHudPaisagemPremium: true });
		tela(568, 320);
		aplicar(document, true);
		expect(temMarca('ri-tela-minima')).toBe(true);
		tela(852, 393);
		aplicar(document);
		expect(temMarca('ri-tela-minima')).toBe(false);
	});
});

describe('o publicado nasce desligado, o dev ligado', () => {
	it('o modelo do Config.js publicado leva a chave DESLIGADA', () => {
		const builder = ler('applications', 'tools', 'builder-web.mjs');
		expect(builder).toMatch(/\n {4}enableHudPaisagemPremium: false,/);
		expect(builder).not.toMatch(/\n\s*enableHudPaisagemPremium: true,/);
	});

	it('o Config.js do dev a leva ligada (para o dono ver)', () => {
		expect(ler('applications', 'pwa', 'Config.js')).toMatch(/\n\tenableHudPaisagemPremium: true,/);
	});
});

describe('a altura dos buffs, medida', () => {
	function caixaFalsa(altura) {
		const el = document.createElement('div');
		document.body.appendChild(el);
		el.getBoundingClientRect = () => ({ height: altura, width: 100, top: 0, left: 0, right: 100, bottom: altura });
		return el;
	}

	const publicada = () => document.documentElement.style.getPropertyValue(VARIAVEL_DA_ALTURA);

	it('publica a altura arredondada, e tira a variavel quando a caixa some (sem buffs)', () => {
		fingirCelular({ deitado: false });
		publicarAlturaDosBuffs(caixaFalsa(98.4));
		expect(publicada()).toBe('98px');
		publicarAlturaDosBuffs(caixaFalsa(0));
		expect(publicada()).toBe('');
	});

	it('so escreve quando muda (roda no caminho do ResizeObserver)', () => {
		fingirCelular({ deitado: false });
		const el = caixaFalsa(47);
		publicarAlturaDosBuffs(el);
		const escrita = vi.spyOn(document.documentElement.style, 'setProperty');
		publicarAlturaDosBuffs(el);
		expect(escrita).not.toHaveBeenCalled();
		escrita.mockRestore();
	});

	it('observar publica ja, e para de vigiar no parar', () => {
		fingirCelular({ deitado: false });
		const vigiadas = [];
		let desligado = 0;
		vi.stubGlobal(
			'ResizeObserver',
			class {
				constructor(cb) {
					this.cb = cb;
				}
				observe(el) {
					vigiadas.push(el);
				}
				disconnect() {
					desligado++;
				}
			}
		);
		const el = caixaFalsa(150);
		observarAlturaDosBuffs(el);
		expect(vigiadas).toEqual([el]);
		expect(publicada()).toBe('150px');
		pararDeObservarOsBuffs();
		expect(desligado).toBe(1);
	});

	it('o chao da folha do Menu le a altura medida, com a reserva de uma fileira', () => {
		const tokens = ler('src', 'UI', 'HudPremium', 'tokens.css');
		const regras = tokens.match(/--m-folha-fundo:[^;]+;/g) || [];
		expect(regras.length).toBe(2);
		for (const regra of regras) {
			expect(regra).toContain('var(--m-buffs-altura, var(--m-buff))');
		}
		const menu = ler('src', 'UI', 'HudPremium', 'componentes', 'TopMenuIdle.css');
		expect(menu).toMatch(/\.ri-premium \.tm-fan\.is-mounted \{[^}]*box-sizing: border-box;[^}]*--m-folha-fundo/);
	});

	it('o componente de verdade liga e desliga o observador', () => {
		const js = ler('src', 'UI', 'Components', 'StatusIcons', 'StatusIcons.js');
		expect(js).toMatch(/onAppend = function onAppend\(\) \{[^}]*observarAlturaDosBuffs\(/);
		expect(js).toMatch(/onRemove = function onRemove\(\) \{[^}]*pararDeObservarOsBuffs\(\)/);
	});
});
