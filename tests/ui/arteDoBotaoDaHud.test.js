/**
 * A ARTE DOS BOTOES "CACAR" E "RETORNAR" NAO PODE SUMIR CALADA (14/10/2026,
 * relato J20 de TioGabs na Floresta de Payon; D-2454 no repositorio do servidor).
 *
 * O sintoma: os dois botoes sob o minimapa somem depois de um tempo e so o F5
 * os devolve. Reproduzido na tela por `scripts/diag-hud-caca-sessao-longa.ts
 * --arte-falha-na-entrada` (repositorio do servidor): no desktop cada botao ERA
 * a imagem de fundo do `<button>`, com o rotulo recortado. Quando o pedido da
 * arte falha, o botao fica na pagina, ativo, clicavel e INVISIVEL - e a rede da
 * HUD (`Engine/redeDaHud.js`), que confere se o componente esta anexado, nao ve
 * nada. A Asa de Mosca nao pede a arte de novo; so a carga de OUTRO mapa pede.
 *
 * O conserto, medido aqui:
 *   1. a arte e um `<img>` com estado observavel (`arteDoBotao.js`);
 *   2. enquanto ela nao carrega (falhou ou ainda nao veio), o botao tem a classe
 *      `hb-sem-arte` e o CSS do desktop desenha o `.ri-btn` com o rotulo;
 *   3. a falha agenda uma nova tentativa sozinha (URL nova, espera crescente);
 *   4. a primeira falha vai ao `/analytics/erro`.
 * O CSS e lido do disco porque o jsdom nao tem leiaute; quem prova a tela e a
 * sonda (o print).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const mocks = vi.hoisted(() => ({
	huntMap: { catalog: null, toggle: () => {}, travelToCity: () => {} },
	relatar: null,
	ingles: false
}));

vi.mock('UI/UIManager.js', () => ({ default: { addComponent: c => c } }));
vi.mock('UI/Components/HuntMap/HuntMap.js', () => ({ default: mocks.huntMap }));
vi.mock('UI/Components/AdminPanel/AdminPanel.js', () => ({ default: { getRoot: () => null } }));
vi.mock('UI/Components/ChatBox/ChatBox.js', () => ({
	default: { addText: () => {}, TYPE: { ERROR: 1 }, FILTER: { PUBLIC_LOG: 1 } }
}));
vi.mock('Controls/ProcessCommand.js', () => ({ default: { processCommand: () => {} } }));
vi.mock('Engine/SessionStorage.js', () => ({ default: {} }));
vi.mock('UI/escalaDaHud.js', () => ({ emUnidadesDaHud: x => x, ehDedo: () => false, default: {} }));
vi.mock('Core/Idioma.js', async importOriginal => ({ ...(await importOriginal()), emIngles: () => mocks.ingles }));
vi.mock('UI/relatoDeErro.js', () => ({ relatarErro: (...a) => mocks.relatar(...a) }));

const { default: htmlDoBotao } = await import('UI/Components/HuntButtonIdle/HuntButtonIdle.html?raw');
const { default: HuntButtonIdle } = await import('UI/Components/HuntButtonIdle/HuntButtonIdle.js');

const ler = rel => readFileSync(join(process.cwd(), 'src', rel), 'utf8').replace(/\r\n/g, '\n');
const semComentarios = css => css.replace(/\/\*[\s\S]*?\*\//g, '');

function montar() {
	HuntButtonIdle._host = document.createElement('div');
	HuntButtonIdle._host.innerHTML = htmlDoBotao;
	HuntButtonIdle._shadow = null;
	document.body.appendChild(HuntButtonIdle._host);
	HuntButtonIdle.init();
}

const botao = sel => HuntButtonIdle._host.querySelector(sel);

describe('HuntButtonIdle: a arte que falha nao deixa o botao invisivel', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		document.body.innerHTML = '';
		mocks.relatar = vi.fn();
		mocks.ingles = false;
		HuntButtonIdle.limparEstadoDoPersonagem();
		montar();
	});

	afterEach(() => {
		HuntButtonIdle.onRemove();
		vi.useRealTimers();
	});

	it('a arte de cada botao e um <img> observavel, e nao a imagem de fundo do <button>', () => {
		const cacar = botao('.hb-cacar .hb-arte');
		const voltar = botao('.hb-voltar .hb-arte');
		expect(cacar, 'a arte do "Caçar" nao e observavel: e background-image, e a falha some calada').not.toBeNull();
		expect(voltar).not.toBeNull();
		expect(cacar.getAttribute('src')).toBe('/ragidle/hud/botoes/hud-btn-cacar.png');
		expect(voltar.getAttribute('src')).toBe('/ragidle/hud/botoes/hud-btn-voltar.png');
		// alt vazio: a arte quebrada nao desenha o icone de imagem quebrada.
		expect(cacar.getAttribute('alt')).toBe('');
	});

	it('enquanto a arte nao carrega o botao esta na reserva; ao carregar, sai dela (cada um por si)', () => {
		const cacar = botao('.hb-cacar');
		const voltar = botao('.hb-voltar');
		expect(cacar.classList.contains('hb-sem-arte')).toBe(true);
		expect(voltar.classList.contains('hb-sem-arte')).toBe(true);
		cacar.querySelector('.hb-arte').dispatchEvent(new Event('load'));
		expect(cacar.classList.contains('hb-sem-arte')).toBe(false);
		expect(voltar.classList.contains('hb-sem-arte')).toBe(true);
	});

	it('a arte que falha devolve o botao a reserva, relata UMA vez e tenta de novo sozinha', () => {
		const cacar = botao('.hb-cacar');
		const img = cacar.querySelector('.hb-arte');
		img.dispatchEvent(new Event('load'));
		expect(cacar.classList.contains('hb-sem-arte')).toBe(false);

		img.dispatchEvent(new Event('error'));
		expect(cacar.classList.contains('hb-sem-arte')).toBe(true);
		expect(mocks.relatar).toHaveBeenCalledTimes(1);
		expect(mocks.relatar.mock.calls[0][0]).toMatch(/^\[hud\] a arte do botao cacar nao carregou/);

		// A nova tentativa sai sozinha, numa URL nova (o pedido que falhou nao volta da memoria).
		vi.advanceTimersByTime(2000);
		expect(img.getAttribute('src')).toBe('/ragidle/hud/botoes/hud-btn-cacar.png?tentativa=1');
		img.dispatchEvent(new Event('error'));
		expect(mocks.relatar).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(4999);
		expect(img.getAttribute('src')).toBe('/ragidle/hud/botoes/hud-btn-cacar.png?tentativa=1');
		vi.advanceTimersByTime(1);
		expect(img.getAttribute('src')).toBe('/ragidle/hud/botoes/hud-btn-cacar.png?tentativa=2');

		// A rede voltou: a arte volta sem F5.
		img.dispatchEvent(new Event('load'));
		expect(cacar.classList.contains('hb-sem-arte')).toBe(false);
	});

	it('a troca de mapa (onAppend) nao pede a arte de novo', () => {
		const img = botao('.hb-cacar .hb-arte');
		img.dispatchEvent(new Event('load'));
		const antes = img.getAttribute('src');
		HuntButtonIdle.onAppend();
		HuntButtonIdle.onRemove();
		HuntButtonIdle.onAppend();
		expect(img.getAttribute('src')).toBe(antes);
		expect(vi.getTimerCount()).toBe(1); // so o polling do proprio botao
	});

	it('em ingles a arte e a SEM texto (o rotulo do DOM e desenhado por cima)', () => {
		mocks.ingles = true;
		HuntButtonIdle.onAppend();
		expect(botao('.hb-cacar .hb-arte').getAttribute('src')).toBe('/ragidle/hud/botoes/hud-btn-cacar-sem-texto.png');
		expect(botao('.hb-voltar .hb-arte').getAttribute('src')).toBe('/ragidle/hud/botoes/hud-btn-voltar-sem-texto.png');
	});
});

describe('arteDoBotao: as tentativas', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	async function criar(relatar = null) {
		const { criarArteDoBotao, ESPERAS_DA_NOVA_TENTATIVA_MS } = await import('UI/Components/HuntButtonIdle/arteDoBotao.js');
		const b = document.createElement('button');
		const img = document.createElement('img');
		b.appendChild(img);
		const arte = criarArteDoBotao({ img, botao: b, nome: 'x', relatar });
		return { arte, img, b, ESPERAS: ESPERAS_DA_NOVA_TENTATIVA_MS };
	}

	it('a espera cresce e para na ultima', async () => {
		const { arte, img, ESPERAS } = await criar();
		arte.usar('/a.png');
		for (let i = 0; i < ESPERAS.length + 2; i++) {
			img.dispatchEvent(new Event('error'));
			const espera = ESPERAS[Math.min(i, ESPERAS.length - 1)];
			vi.advanceTimersByTime(espera - 1);
			expect(img.getAttribute('src')).toBe(i === 0 ? '/a.png' : `/a.png?tentativa=${i}`);
			vi.advanceTimersByTime(1);
			expect(img.getAttribute('src')).toBe(`/a.png?tentativa=${i + 1}`);
		}
	});

	it('trocar a arte cancela a tentativa pendente e recomeca a contagem', async () => {
		const { arte, img } = await criar();
		arte.usar('/a.png');
		img.dispatchEvent(new Event('error'));
		arte.usar('/b.png');
		expect(img.getAttribute('src')).toBe('/b.png');
		// A tentativa da arte antiga nao fica pendurada (ela pediria a nova de novo, a toa).
		expect(vi.getTimerCount()).toBe(0);
		vi.advanceTimersByTime(120_000);
		expect(img.getAttribute('src')).toBe('/b.png');
		img.dispatchEvent(new Event('error'));
		vi.advanceTimersByTime(2000);
		expect(img.getAttribute('src')).toBe('/b.png?tentativa=1');
	});

	it('a mesma arte de novo nao pede nada', async () => {
		const { arte, img } = await criar();
		arte.usar('/a.png');
		img.setAttribute('src', '/marcado.png');
		arte.usar('/a.png');
		expect(img.getAttribute('src')).toBe('/marcado.png');
	});

	it('um erro antes de haver arte nao agenda nada nem relata (nao ha o que pedir de novo)', async () => {
		const relatar = vi.fn();
		const { img, b } = await criar(relatar);
		img.dispatchEvent(new Event('error'));
		expect(vi.getTimerCount()).toBe(0);
		expect(relatar).not.toHaveBeenCalled();
		expect(b.classList.contains('hb-sem-arte')).toBe(false);
	});

	it('o relato e um so por botao, mesmo com o relato ausente', async () => {
		const relatar = vi.fn();
		const { arte, img } = await criar(relatar);
		arte.usar('/a.png');
		img.dispatchEvent(new Event('error'));
		vi.advanceTimersByTime(2000);
		img.dispatchEvent(new Event('error'));
		expect(relatar).toHaveBeenCalledTimes(1);
		const semRelato = await criar(null);
		semRelato.arte.usar('/a.png');
		expect(() => semRelato.img.dispatchEvent(new Event('error'))).not.toThrow();
	});
});

describe('HuntButtonIdle.css: a reserva desenha o botao no desktop e nao toca o celular em pe', () => {
	const css = semComentarios(ler('UI/Components/HuntButtonIdle/HuntButtonIdle.css'));

	it('a arte nao e mais a imagem de fundo do botao (a falha nao teria como ser vista)', () => {
		expect(css).not.toMatch(/background-image:\s*url\([^)]*hud-btn-/);
	});

	it('na reserva do desktop o rotulo sai do recorte e o botao ganha a moldura do .ri-btn', () => {
		const regra = sel => {
			const i = css.indexOf(sel + ' {');
			expect(i, `a regra "${sel}" sumiu`).toBeGreaterThan(-1);
			return css.slice(i, css.indexOf('}', i));
		};
		const moldura = regra('.ui-component-root:not(.ri-vertical) .hb-btn.hb-sem-arte');
		expect(moldura).toContain('background: var(--tab-active-fill)');
		expect(moldura).toContain('border: 1px solid var(--blue-600)');
		const rotulo = regra('.ui-component-root:not(.ri-vertical) #HuntButtonIdle .hb-btn.hb-sem-arte .hb-rotulo');
		expect(rotulo).toContain('clip: auto');
		expect(rotulo).toContain('position: static');
		expect(regra('.hb-btn.hb-sem-arte .hb-arte')).toContain('display: none');
	});

	it('no celular em pe a arte nao aparece (o disco e o rotulo de la ficam como estao)', () => {
		const i = css.indexOf('.ri-vertical .hb-arte {');
		expect(i).toBeGreaterThan(-1);
		expect(css.slice(i, css.indexOf('}', i))).toContain('display: none');
	});
});
