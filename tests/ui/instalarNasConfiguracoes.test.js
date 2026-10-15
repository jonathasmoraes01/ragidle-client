/**
 * "INSTALAR O JOGO" NAS CONFIGURACOES (16/10/2026).
 *
 * Relato de producao: *"PWA nao esta funcionando, nao tem mais a opcao para
 * instalar o aplicativo"*. A porta do D-933 (*"botao Instalar proprio dentro
 * de Configuracoes"*) morava na aba de Config da janela Idle e saiu junto com
 * ela no Bot novo (df1636c9, 07/10/2026). No computador, dentro do jogo, nao
 * sobrou lugar nenhum que oferecesse a instalacao.
 *
 * A porta volta para a janela `Escape` (as Configuracoes de hoje: ESC, o item
 * "Configuracoes" do menu e o "Config." do trilho da HUD premium). Os casos
 * montam o HTML e o CSS REAIS da janela, com o `.ri-btn` do `Common.css`, e
 * perguntam o que o jogador veria em cada aparelho. A decisao em si ja e
 * coberta em `ofertaDeInstalacao.test.js`; aqui mede-se a PORTA.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PASTA = join(process.cwd(), 'src/UI/Components/Escape');
const html = readFileSync(join(PASTA, 'Escape.html'), 'utf8');
const css = readFileSync(join(PASTA, 'Escape.css'), 'utf8');
const escapeJs = readFileSync(join(PASTA, 'Escape.js'), 'utf8');
const comum = readFileSync(join(process.cwd(), 'src/UI/Common.css'), 'utf8');

const UA_CHROME_DESKTOP =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const UA_CHROME_ANDROID =
	'Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

const uaOriginal = navigator.userAgent;
const matchMediaOriginal = window.matchMedia;

function fingirAparelho(ua, toque) {
	Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
	window.matchMedia = consulta => ({
		matches: consulta.includes('coarse') ? toque : consulta.includes('display-mode') ? false : !toque,
		media: consulta,
		addEventListener() {},
		removeEventListener() {},
	});
}

/** A janela montada como o GUIComponent monta (sem o shadow: a cascata do jsdom nao le folha de shadow). */
function montarJanela() {
	const host = document.createElement('div');
	for (const texto of [comum, css]) {
		const estilo = document.createElement('style');
		estilo.textContent = texto;
		host.appendChild(estilo);
	}
	const raiz = document.createElement('div');
	raiz.className = 'ui-component-root';
	raiz.innerHTML = html;
	host.appendChild(raiz);
	document.body.appendChild(host);
	return { host, raiz };
}

let modulo;
beforeEach(async () => {
	vi.resetModules();
	delete window.RagIdlePWA;
	modulo = await import('UI/Components/Escape/instalarNoSistema.js');
});

afterEach(() => {
	Object.defineProperty(navigator, 'userAgent', { value: uaOriginal, configurable: true });
	window.matchMedia = matchMediaOriginal;
	delete window.RagIdlePWA;
	document.body.innerHTML = '';
});

describe('a janela de Configuracoes tem a porta "Instalar o jogo"', () => {
	it('o botao existe na janela e o Escape.js o liga e o sincroniza ao abrir', () => {
		expect(html).toMatch(/<button[^>]*class="instalar ri-btn[^"]*"[^>]*hidden/);
		expect(escapeJs).toContain('ligarInstalarNoSistema(root)');
		// as duas portas de abrir (ESC e o menu) redesenham com o estado de agora
		expect(escapeJs.match(/sincronizarInstalarNoSistema\(this\.getRoot\(\)\)/g) || []).toHaveLength(2);
	});

	it('no COMPUTADOR com a oferta do navegador, aparece e o clique instala de verdade', async () => {
		fingirAparelho(UA_CHROME_DESKTOP, false);
		const instalar = vi.fn(() => Promise.resolve('instalado'));
		window.RagIdlePWA = { promptDeInstalacao: {}, estaInstalado: () => false, instalar };
		const { raiz } = montarJanela();
		modulo.ligarInstalarNoSistema(raiz);

		const botao = raiz.querySelector('.instalar');
		expect(getComputedStyle(botao).display, 'o computador nao tinha porta nenhuma (df1636c9)').not.toBe('none');
		expect(botao.textContent).toBe('Instalar o jogo');
		botao.click();
		expect(instalar).toHaveBeenCalledTimes(1);
		await Promise.resolve();
		await Promise.resolve();
		expect(raiz.querySelector('.instalar-dica').textContent).toMatch(/Instalado/);
	});

	it('no CELULAR sem a oferta, ensina o caminho em vez de sumir', () => {
		fingirAparelho(UA_CHROME_ANDROID, true);
		window.RagIdlePWA = { promptDeInstalacao: null, estaInstalado: () => false, instalar: vi.fn() };
		const { raiz } = montarJanela();
		modulo.ligarInstalarNoSistema(raiz);

		const botao = raiz.querySelector('.instalar');
		const dica = raiz.querySelector('.instalar-dica');
		expect(getComputedStyle(botao).display).not.toBe('none');
		expect(botao.textContent).toBe('Como instalar o jogo');
		expect(getComputedStyle(dica).display).toBe('none');
		botao.click();
		expect(getComputedStyle(dica).display).not.toBe('none');
		expect(dica.textContent).toMatch(/três pontinhos/);
		expect(window.RagIdlePWA.instalar).not.toHaveBeenCalled();
	});

	it('o CSS da janela devolve o `hidden` que o `display` do `.ri-btn` tiraria', () => {
		/*
		 * Lido no FONTE, de proposito: a cascata do jsdom deixa o `hidden` vencer
		 * o `.ri-btn` sozinho, e o caso abaixo passaria sem a regra. No Chromium
		 * o `inline-flex` do `.ri-btn` vence (medido em 16/10/2026: sem a regra o
		 * botao escondido sai `display: flex`) - o botao morto que o D-933 recusa.
		 */
		expect(css).toMatch(/#Escape \.instalar\[hidden\],\s*#Escape \.instalar-dica\[hidden\]\s*\{\s*display: none;/);
	});

	it('quem ja instalou nao ve botao nenhum', () => {
		fingirAparelho(UA_CHROME_ANDROID, true);
		window.RagIdlePWA = { promptDeInstalacao: {}, estaInstalado: () => true, instalar: vi.fn() };
		const { raiz } = montarJanela();
		modulo.ligarInstalarNoSistema(raiz);
		expect(getComputedStyle(raiz.querySelector('.instalar')).display).toBe('none');
	});

	it('o computador sem oferta tambem nao ve botao (nada de banner fixo, D-933)', () => {
		fingirAparelho(UA_CHROME_DESKTOP, false);
		window.RagIdlePWA = { promptDeInstalacao: null, estaInstalado: () => false, instalar: vi.fn() };
		const { raiz } = montarJanela();
		modulo.ligarInstalarNoSistema(raiz);
		expect(getComputedStyle(raiz.querySelector('.instalar')).display).toBe('none');
	});

	it('a oferta que chega DEPOIS acende o botao sozinha (evento da casca)', () => {
		fingirAparelho(UA_CHROME_DESKTOP, false);
		window.RagIdlePWA = { promptDeInstalacao: null, estaInstalado: () => false, instalar: vi.fn() };
		const { raiz } = montarJanela();
		modulo.ligarInstalarNoSistema(raiz);
		const botao = raiz.querySelector('.instalar');
		expect(getComputedStyle(botao).display).toBe('none');

		window.RagIdlePWA.promptDeInstalacao = {};
		window.dispatchEvent(new CustomEvent('ragidle:pode-instalar'));
		expect(getComputedStyle(botao).display).not.toBe('none');
	});
});
