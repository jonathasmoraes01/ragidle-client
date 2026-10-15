/**
 * O TAMANHO DA HUD NAS CONFIGURACOES DE VIDEO (pedido do dono, 15/10/2026): *"uma opcao de video, onde a pessoa
 * consegue aumentar ou diminuir a hud toda"*.
 *
 * O que se prova:
 *   - o fator do jogador MULTIPLICA a escala de D-934 (no mouse) e e o zoom inteiro no celular com a HUD
 *     premium; no celular SEM ela (a HUD de D-939, a que esta no ar e so foi medida em 100%) ele nao vale;
 *   - aumentar para no que a tela comporta, e diminuir vale sempre;
 *   - a conversao de unidade (`emUnidadesDaHud`) acompanha o fator - e ela que mantem a geometria medida certa;
 *   - as faixas de tela da premium sao medidas em UNIDADES DA HUD (a tela dividida pela escala);
 *   - a janela de video escreve as opcoes da MESMA lista que a escala aceita, grava e reaplica na hora.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Escala, { OPCOES_DE_ESCALA, emUnidadesDaHud, escalaAtual, fatorDoJogador } from 'UI/escalaDaHud.js';
import GraphicsSettings from 'Preferences/Graphics.js';
import HudVertical, { faixasDaTela } from 'UI/hudVertical.js';

function fingirPonteiro(grosso) {
	window.matchMedia = consulta => ({
		matches: consulta.includes('coarse') ? grosso : consulta.includes('fine') ? !grosso : grosso,
		media: consulta,
		addEventListener() {},
		removeEventListener() {}
	});
}

function fingirJanela(w, h) {
	Object.defineProperty(window, 'innerWidth', { value: w, configurable: true });
	Object.defineProperty(window, 'innerHeight', { value: h, configurable: true });
}

const comPremium = () => document.documentElement.classList.add('ri-premium');

beforeEach(() => {
	document.documentElement.className = '';
	document.documentElement.removeAttribute('style');
	document.body.innerHTML = '';
	delete window.ROConfig;
	GraphicsSettings.escalaDaHud = 100;
	fingirPonteiro(false);
	fingirJanela(1920, 1080);
	HudVertical.desligarParaTeste();
});

afterEach(() => {
	GraphicsSettings.escalaDaHud = 100;
});

describe('o fator do jogador', () => {
	it('nasce em 100%, e o padrao das preferencias de video e 100', () => {
		expect(GraphicsSettings.defaults.escalaDaHud).toBe(100);
		expect(fatorDoJogador()).toBe(1);
	});

	it('as opcoes vao de 70% a 120%, de dez em dez', () => {
		expect(OPCOES_DE_ESCALA).toEqual([70, 80, 90, 100, 110, 120]);
	});

	it('valor fora da lista cai no mais perto; lixo e zero viram 100%', () => {
		GraphicsSettings.escalaDaHud = 83;
		expect(fatorDoJogador()).toBe(0.8);
		GraphicsSettings.escalaDaHud = 500;
		expect(fatorDoJogador()).toBe(1.2);
		GraphicsSettings.escalaDaHud = 10;
		expect(fatorDoJogador()).toBe(0.7);
		for (const lixo of ['abc', undefined, 0, -50]) {
			GraphicsSettings.escalaDaHud = lixo;
			expect(fatorDoJogador()).toBe(1);
		}
	});
});

describe('no mouse: o fator multiplica a escala da janela (D-934)', () => {
	it('tela grande: 80% e 0,8; 120% e 1,2 (cabe)', () => {
		GraphicsSettings.escalaDaHud = 80;
		expect(escalaAtual()).toBe(0.8);
		GraphicsSettings.escalaDaHud = 120;
		expect(escalaAtual()).toBe(1.2);
	});

	it('janela pequena: diminuir multiplica; aumentar para no que a janela comporta', () => {
		fingirJanela(800, 500);
		GraphicsSettings.escalaDaHud = 100;
		const base = escalaAtual();
		expect(base).toBeLessThan(1);
		GraphicsSettings.escalaDaHud = 80;
		expect(escalaAtual()).toBe(Math.round(base * 0.8 * 100) / 100);
		// 120% numa janela que ja nao comporta a HUD em 100%: fica onde estava, e nao abaixo.
		GraphicsSettings.escalaDaHud = 120;
		expect(escalaAtual()).toBe(base);
	});

	it('1366x768 ja e a altura de referencia: aumentar nao cabe e fica em 1', () => {
		fingirJanela(1366, 768);
		GraphicsSettings.escalaDaHud = 120;
		expect(escalaAtual()).toBe(1);
	});
});

describe('no dedo: so com a HUD premium', () => {
	beforeEach(() => fingirPonteiro(true));

	it('sem a premium (a HUD de D-939) o fator nao vale: a escala segue 1', () => {
		fingirJanela(393, 852);
		GraphicsSettings.escalaDaHud = 80;
		expect(escalaAtual()).toBe(1);
	});

	it('com a premium, o fator e o zoom inteiro', () => {
		comPremium();
		fingirJanela(393, 852);
		GraphicsSettings.escalaDaHud = 80;
		expect(escalaAtual()).toBe(0.8);
		GraphicsSettings.escalaDaHud = 120;
		expect(escalaAtual()).toBe(1.2);
	});

	it('aumentar para na menor tela da premium (320 x 553 em unidades da HUD)', () => {
		comPremium();
		GraphicsSettings.escalaDaHud = 120;
		fingirJanela(320, 568);
		expect(escalaAtual()).toBe(1);
		fingirJanela(375, 667);
		expect(escalaAtual()).toBe(1.17);
	});

	it('na tela larga e baixa quem limita o aumento e a altura', () => {
		comPremium();
		GraphicsSettings.escalaDaHud = 120;
		fingirJanela(430, 600);
		expect(escalaAtual()).toBe(1.08);
	});

	it('numa tela menor que a minima, pedir para aumentar nunca DIMINUI a HUD', () => {
		comPremium();
		GraphicsSettings.escalaDaHud = 120;
		fingirJanela(300, 500);
		expect(escalaAtual()).toBe(1);
	});

	it('diminuir vale em qualquer tela', () => {
		comPremium();
		fingirJanela(320, 568);
		GraphicsSettings.escalaDaHud = 70;
		expect(escalaAtual()).toBe(0.7);
	});

	it('o zoom vai em todo host e a geometria medida converte pelo fator', () => {
		comPremium();
		fingirJanela(393, 852);
		GraphicsSettings.escalaDaHud = 80;
		const host = document.createElement('div');
		host.dataset.guiComponent = 'Qualquer';
		document.body.appendChild(host);
		Escala.reaplicar(document);
		expect(host.style.zoom).toBe('0.8');
		expect(document.documentElement.style.getPropertyValue('--ui-escala')).toBe('0.8');
		expect(emUnidadesDaHud(80)).toBe(100);
	});
});

describe('as faixas de tela da premium, em unidades da HUD', () => {
	beforeEach(() => fingirPonteiro(true));

	it('fora da premium, nenhuma', () => {
		fingirJanela(320, 568);
		expect(faixasDaTela(false)).toEqual({ baixa: false, minima: false, estreita: false });
	});

	it('375x667 a 100%: so a baixa', () => {
		comPremium();
		fingirJanela(375, 667);
		expect(faixasDaTela(true)).toEqual({ baixa: true, minima: false, estreita: false });
	});

	it('375x667 a 120%: a tela da HUD encolhe, e entram a minima e a estreita', () => {
		comPremium();
		fingirJanela(375, 667);
		GraphicsSettings.escalaDaHud = 120;
		expect(faixasDaTela(true)).toEqual({ baixa: true, minima: true, estreita: true });
	});

	it('393x852 a 70%: a tela da HUD cresce, e nenhuma faixa vale', () => {
		comPremium();
		fingirJanela(393, 852);
		GraphicsSettings.escalaDaHud = 70;
		expect(faixasDaTela(true)).toEqual({ baixa: false, minima: false, estreita: false });
	});

	it('as faixas viram marcas no <html> e no root de cada componente, pela rota da HUD vertical', () => {
		window.ROConfig = { enableHudAdaptavel: true, enableHudMobilePremium: true };
		window.matchMedia = consulta => ({
			matches: true,
			media: consulta,
			addEventListener() {},
			removeEventListener() {}
		});
		fingirJanela(375, 667);
		const host = document.createElement('div');
		host.dataset.guiComponent = 'ChatBox';
		const raiz = document.createElement('div');
		raiz.className = 'ui-component-root';
		host.attachShadow({ mode: 'open' }).appendChild(raiz);
		document.body.appendChild(host);
		HudVertical.aplicar(document, true);
		expect(document.documentElement.classList.contains('ri-tela-baixa')).toBe(true);
		expect(raiz.classList.contains('ri-tela-baixa')).toBe(true);
		expect(raiz.classList.contains('ri-tela-minima')).toBe(false);
		// trocar o Tamanho da HUD e reaplicar (o que a janela de video faz) muda a faixa
		GraphicsSettings.escalaDaHud = 120;
		Escala.reaplicar(document);
		HudVertical.reaplicar(document);
		expect(raiz.classList.contains('ri-tela-minima')).toBe(true);
		expect(host.style.zoom).toBe('1.17');
	});

	it('o resize (sem forcar) tambem refaz as faixas, mesmo sem a vertical mudar', () => {
		window.ROConfig = { enableHudAdaptavel: true, enableHudMobilePremium: true };
		window.matchMedia = consulta => ({
			matches: true,
			media: consulta,
			addEventListener() {},
			removeEventListener() {}
		});
		fingirJanela(375, 667);
		HudVertical.aplicar(document, true);
		expect(document.documentElement.classList.contains('ri-tela-minima')).toBe(false);
		fingirJanela(375, 600);
		HudVertical.aplicar(document);
		expect(document.documentElement.classList.contains('ri-tela-minima')).toBe(true);
	});
});

describe('a janela de video', () => {
	const pasta = join(__dirname, '..', '..', 'src', 'UI', 'Components', 'GraphicsOption');
	const js = readFileSync(join(pasta, 'GraphicsOption.js'), 'utf8');
	const html = readFileSync(join(pasta, 'GraphicsOption.html'), 'utf8');
	const css = readFileSync(join(pasta, 'GraphicsOption.css'), 'utf8');

	it('tem a linha "Tamanho da HUD", com as opcoes da MESMA lista da escala', () => {
		expect(html).toContain('<tr class="tamanho-da-hud">');
		expect(html).toContain('<select class="escala-da-hud"');
		expect(js).toMatch(/for \(const valor of OPCOES_DE_ESCALA\)/);
		expect(js).toContain("bindChange('.escala-da-hud', onUpdateEscalaDaHud);");
	});

	it('trocar grava, reaplica a escala e as faixas na hora; o padrao de fabrica tambem', () => {
		const corpo = js.slice(js.indexOf('function onUpdateEscalaDaHud'), js.indexOf('function onToggleEconomiaAutomatica'));
		expect(corpo).toContain('GraphicsSettings.escalaDaHud = parseInt(this.value, 10);');
		expect(corpo).toContain('GraphicsSettings.save();');
		expect(corpo).toContain('EscalaDaHud.reaplicar(document);');
		expect(corpo).toContain('reaplicarHudVertical(document);');
		const reset = js.slice(js.indexOf('function onResetToDefaults'));
		expect(reset).toContain('EscalaDaHud.reaplicar(document);');
		expect(reset).toContain('reaplicarHudVertical(document);');
	});

	it('no dedo sem a premium a linha some (o fator nao vale ali)', () => {
		expect(css).toMatch(
			/@media \(pointer: coarse\) \{\s*\.ui-component-root:not\(\.ri-premium\) #GraphicsOption \.tamanho-da-hud \{\s*display: none;/
		);
	});
});
