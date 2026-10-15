/**
 * A BARRA DE SKILLS NAS CONFIGURACOES (pedido do dono, 15/10/2026, HUD mobile premium): *"o player pudesse
 * depois habilitar pelas configuracoes a barra de skills tambem, mas por padrao que ela viesse desativada"*.
 *
 * A janela de Configuracoes (`Escape`) ganha o interruptor "Barra de skills". Prova-se, com a janela real:
 *   - o rotulo diz o estado (nasce "Desligada") e o `aria-pressed` acompanha;
 *   - o toque troca a preferencia E a marca `ri-com-atalhos` na hora (a barra aparece, o arco some), sem
 *     esperar o proximo resize;
 *   - a morte o esconde junto com os outros ajustes, e a volta o devolve;
 *   - fora da premium o CSS o esconde (a barra e a de sempre ali, e o botao nao teria o que fazer).
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* O Escape importa janelas que desenham em canvas (as opcoes de video): o jsdom nao tem `getContext`. */
const contexto = new Proxy(
	{},
	{
		get: (alvo, chave) => {
			if (chave in alvo) return alvo[chave];
			if (chave === 'measureText') return () => ({ width: 10 });
			if (chave === 'getImageData' || chave === 'createImageData') return () => ({ data: new Uint8ClampedArray(4) });
			return () => {};
		},
		set: (alvo, chave, valor) => {
			alvo[chave] = valor;
			return true;
		}
	}
);
HTMLCanvasElement.prototype.getContext = function getContext() {
	return contexto;
};

let Escape, HudVertical, HudPremium;

function fingirCelularEmPe() {
	window.matchMedia = consulta => ({ matches: true, media: consulta, addEventListener() {}, removeEventListener() {} });
}

beforeAll(async () => {
	localStorage.clear();
	window.ROConfig = { enableHudAdaptavel: true, enableHudMobilePremium: true };
	fingirCelularEmPe();
	HudPremium = await import('UI/HudPremium/hudPremium.js');
	HudVertical = await import('UI/hudVertical.js');
	Escape = (await import('UI/Components/Escape/Escape.js')).default;
	Escape.append();
}, 60_000);

beforeEach(() => {
	localStorage.clear();
	HudPremium.esquecerPreferenciasParaTeste();
	fingirCelularEmPe();
	HudVertical.reaplicar(document);
});

afterEach(() => {
	Escape._host.style.display = 'none';
});

const botao = () => Escape.getRoot().querySelector('.barra-skills');
const comAtalhos = () => document.documentElement.classList.contains('ri-com-atalhos');

describe('o interruptor "Barra de skills" das Configuracoes', () => {
	it('existe e nasce dizendo "Desligada"', () => {
		expect(botao()).not.toBeNull();
		expect(botao().textContent).toBe('Barra de skills: Desligada');
		expect(botao().getAttribute('aria-pressed')).toBe('false');
		expect(comAtalhos()).toBe(false);
	});

	it('o toque liga a barra na hora: a preferencia, o rotulo e a marca', () => {
		botao().click();
		expect(HudPremium.barraDeAtalhosLigada()).toBe(true);
		expect(botao().textContent).toBe('Barra de skills: Ligada');
		expect(botao().getAttribute('aria-pressed')).toBe('true');
		expect(comAtalhos()).toBe(true);
		// e a marca chega tambem dentro do shadow das pecas (a barra e o arco leem de la), a deste inclusive
		const raiz = Escape._host.shadowRoot.querySelector('.ui-component-root');
		expect(raiz.classList.contains('ri-com-atalhos')).toBe(true);
	});

	it('o segundo toque desliga de novo', () => {
		botao().click();
		botao().click();
		expect(HudPremium.barraDeAtalhosLigada()).toBe(false);
		expect(botao().textContent).toBe('Barra de skills: Desligada');
		expect(comAtalhos()).toBe(false);
	});

	it('a morte o esconde com os outros ajustes, e a volta o devolve', () => {
		Escape.showDeathMenu(false);
		expect(botao().style.display).toBe('none');
		Escape.resetMenu();
		expect(botao().style.display).toBe('');
	});

	it('fora da premium o CSS o esconde', () => {
		const css = readFileSync(join(__dirname, '..', '..', 'src', 'UI', 'Components', 'Escape', 'Escape.css'), 'utf8');
		expect(css).toMatch(/\.ui-component-root:not\(\.ri-premium\) #Escape \.barra-skills \{\s*display: none;/);
	});
});

describe('a barra e o arco leem a marca', () => {
	const premium = nome =>
		readFileSync(join(__dirname, '..', '..', 'src', 'UI', 'HudPremium', ...nome.split('/')), 'utf8');

	it('sem a marca (o padrao) a barra some e o arco aparece; com ela, o contrario', () => {
		expect(premium('documento.css')).toMatch(
			/html\.ri-vertical\.ri-premium:not\(\.ri-com-atalhos\) #ShortCut \{\s*display: none !important;/
		);
		expect(premium('componentes/CombatCornerIdle.css')).toMatch(
			/\.ri-premium:not\(\.ri-com-atalhos\) \.cc-rodizio \{\s*display: block;/
		);
		// e o arco nasce escondido fora da camada (o desktop e a HUD vertical de D-939 nao mudam)
		const base = readFileSync(
			join(__dirname, '..', '..', 'src', 'UI', 'Components', 'CombatCornerIdle', 'CombatCornerIdle.css'),
			'utf8'
		);
		expect(base).toMatch(/\.cc-rodizio \{\s*display: none;/);
	});

	it('sem a barra o rodape perde a altura dela, e o chat e os buffs terminam antes do arco', () => {
		const tokens = premium('tokens.css');
		expect(tokens).toMatch(
			/html\.ri-premium:not\(\.ri-com-atalhos\) \{\s*--m-atalhos-altura: 0px;\s*--m-coluna-de-caca: var\(--m-arco-largura\);/
		);
	});
});
