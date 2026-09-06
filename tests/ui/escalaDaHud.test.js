/**
 * A HUD DIMINUI JUNTO COM A JANELA (D-934), E A BANDEIRA DE ROLLOUT (D-937).
 *
 * Correção do dono, com um print junto: *"a HUD não pode ficar assim, um em
 * cima do outro, ela deve diminuir junto com a janela."*
 *
 * As duas perguntas que valem daqui a um mês:
 *
 * 1. **Dedo não encolhe.** Encolher num aparelho de toque levaria os alvos
 *    abaixo dos 44px que a frente inteira acabou de garantir — seria desfazer
 *    o conserto com o conserto. É a regra mais fácil de quebrar sem querer, e
 *    a que ninguém veria quebrada até alguém abrir o jogo num celular.
 *
 * 2. **A conversão de unidade.** `getBoundingClientRect()` devolve a caixa já
 *    com o `zoom` aplicado, mas `style.top` é lido nas unidades do host: ler e
 *    escrever o mesmo número NÃO devolve o elemento ao mesmo lugar. Foi assim
 *    que o rastreador de missões foi parar 58px por cima do painel de
 *    personagem.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Escala, { MARCA_CLASSICA } from 'UI/escalaDaHud.js';

/** Finge o tipo de ponteiro que o `matchMedia` reporta. */
function fingirPonteiro(grosso) {
	window.matchMedia = (consulta) => ({
		matches: consulta.includes('coarse') ? grosso : !grosso,
		media: consulta,
		addEventListener() {},
		removeEventListener() {},
	});
}

function fingirJanela(w, h) {
	Object.defineProperty(window, 'innerWidth', { value: w, configurable: true });
	Object.defineProperty(window, 'innerHeight', { value: h, configurable: true });
}

describe('a escala da HUD', () => {
	beforeEach(() => {
		document.documentElement.className = '';
		document.documentElement.removeAttribute('style');
		document.body.innerHTML = '';
		delete window.ROConfig;
		fingirPonteiro(false);
		fingirJanela(1920, 1080);
		Escala.reaplicar();
	});

	afterEach(() => {
		Escala.desligar?.();
	});

	it('em tela grande a escala e 1 — o desktop nao muda', () => {
		fingirJanela(1920, 1080);
		expect(Escala.escalaAtual()).toBe(1);
		fingirJanela(1366, 768);
		expect(Escala.escalaAtual()).toBe(1);
		/* 1024x768 é o tamanho de referência: é a menor tela da matriz em que a
		   HUD cabe inteira sem sobreposição, e por isso é onde a escala ainda é
		   cheia. Um pixel abaixo dela já encolhe. */
		fingirJanela(1024, 768);
		expect(Escala.escalaAtual()).toBe(1);
	});

	it('a janela encolhe e a HUD encolhe junto', () => {
		fingirJanela(800, 500);
		const menor = Escala.escalaAtual();
		expect(menor).toBeLessThan(1);
		fingirJanela(700, 400);
		expect(Escala.escalaAtual()).toBeLessThan(menor);
	});

	it('a escala tem PISO: abaixo dele quem age e o rearranjo', () => {
		/* O print do dono era 580x250. Sem piso a conta daria 0,33 e a letra
		   ficaria ilegível — o pedido era "diminuir", não "sumir". */
		fingirJanela(580, 250);
		expect(Escala.escalaAtual()).toBe(0.5);
		fingirJanela(200, 100);
		expect(Escala.escalaAtual()).toBe(0.5);
	});

	it('DEDO NAO ENCOLHE — num aparelho de toque a escala e 1, sempre', () => {
		fingirPonteiro(true);
		fingirJanela(393, 852);
		expect(Escala.escalaAtual()).toBe(1);
		fingirJanela(360, 640);
		expect(Escala.escalaAtual()).toBe(1);
		/* Até no celular deitado, que é a tela mais apertada da matriz. */
		fingirJanela(667, 375);
		expect(Escala.escalaAtual()).toBe(1);
	});

	it('o `zoom` vai em TODO host de componente, e some quando a escala e 1', () => {
		const host = document.createElement('div');
		host.dataset.guiComponent = 'Qualquer';
		document.body.appendChild(host);

		fingirJanela(800, 500);
		Escala.reaplicar();
		expect(host.style.zoom).toBe(String(Escala.escalaAtual()));

		fingirJanela(1920, 1080);
		Escala.reaplicar();
		/* String vazia, e não "1": deixar `zoom: 1` cravado criaria um contexto
		   de zoom permanente em cima de toda a HUD, num tamanho em que ela não
		   precisa de nenhum. */
		expect(host.style.zoom).toBe('');
	});

	it('a conversao de unidade divide pela escala — a armadilha do zoom', () => {
		fingirJanela(1920, 1080);
		expect(Escala.emUnidadesDaHud(189)).toBe(189);

		fingirJanela(800, 500);
		const e = Escala.escalaAtual();
		expect(e).toBeLessThan(1);
		/* Sem esta divisão, escrever de volta o número lido põe o elemento em
		   `valor × escala` — foi o que pôs o rastreador 58px fora do lugar. */
		expect(Escala.emUnidadesDaHud(189)).toBeCloseTo(189 / e, 6);
	});
});

describe('a bandeira de rollout', () => {
	beforeEach(() => {
		document.documentElement.className = '';
		document.body.innerHTML = '';
		delete window.ROConfig;
		fingirPonteiro(false);
		fingirJanela(800, 500);
	});

	afterEach(() => {
		Escala.desligar?.();
		delete window.ROConfig;
		document.documentElement.className = '';
	});

	it('sem config nenhuma, a camada nova esta LIGADA', () => {
		/* Falha para ligado de propósito: uma bandeira que falhasse para
		   desligado transformaria qualquer erro de carregamento numa volta
		   silenciosa ao layout velho, e ninguém descobriria pelo sintoma. */
		expect(Escala.ehAdaptavel()).toBe(true);
	});

	it('`enableHudAdaptavel: false` desliga', () => {
		window.ROConfig = { enableHudAdaptavel: false };
		expect(Escala.ehAdaptavel()).toBe(false);
	});

	it('qualquer outro valor NAO desliga — so o `false` explicito', () => {
		/* `undefined` é o caso de um `Config.local.js` antigo, que não conhece a
		   chave. Ele não pode desligar nada. */
		window.ROConfig = {};
		expect(Escala.ehAdaptavel()).toBe(true);
		window.ROConfig = { enableHudAdaptavel: true };
		expect(Escala.ehAdaptavel()).toBe(true);
	});

	it('desligada, ela marca o `<html>` e NAO aplica zoom nenhum', () => {
		const host = document.createElement('div');
		host.dataset.guiComponent = 'Qualquer';
		document.body.appendChild(host);
		window.ROConfig = { enableHudAdaptavel: false };

		Escala.ligar();

		expect(document.documentElement.classList.contains(MARCA_CLASSICA)).toBe(true);
		expect(host.style.zoom).toBe('');
	});

	it('ligada, ela NAO marca o `<html>`', () => {
		Escala.ligar();
		expect(document.documentElement.classList.contains(MARCA_CLASSICA)).toBe(false);
	});
});
