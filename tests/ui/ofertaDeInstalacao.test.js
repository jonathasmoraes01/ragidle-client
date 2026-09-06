/**
 * A OFERTA DE INSTALAÇÃO (D-945) — a decisão, e a linha na tela de entrada.
 *
 * As duas perguntas que valem daqui a um mês:
 *
 * 1. **Por que a webview de app vem ANTES do iPhone.** Um Instagram de iPhone
 *    casa com as duas regras. Se a ordem invertesse, o jogador leria "toque em
 *    Compartilhar e adicione à Tela de Início" dentro de um navegador que não
 *    tem esse item — instrução que não funciona é pior do que nenhuma, porque
 *    ela gasta a boa vontade de quem tentou.
 *
 * 2. **Por que o computador sem oferta não mostra nada.** É a regra que herda
 *    o pedido do dono contra banner intrusivo (D-933): quem joga no
 *    computador não precisa do ícone, e um botão que só sabe dizer "vá no
 *    menu do navegador" seria decoração permanente. No CELULAR a conta vira,
 *    porque lá o ícone é a diferença entre voltar ao jogo e esquecê-lo.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	decidirOferta,
	ofertaAtual,
	pontePWA,
	retratarAmbiente,
	textoDoResultado,
} from 'UI/ofertaDeInstalacao.js';
import { montarOfertaNaEntrada, sincronizar } from 'UI/Components/WinLogin/ofertaNaEntrada.js';

/** O ambiente de um aparelho, com os campos que a decisão lê. */
function ambiente(mudancas = {}) {
	return {
		jaInstalado: false,
		temPrompt: false,
		ehApple: false,
		ehSafari: false,
		ehWebviewDeApp: false,
		ehToque: false,
		...mudancas,
	};
}

/** Finge o `navigator.userAgent` e o ponteiro que o `matchMedia` reporta. */
function fingirAparelho(ua, toque) {
	Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
	window.matchMedia = (consulta) => ({
		matches: consulta.includes('coarse') ? toque : !toque,
		media: consulta,
		addEventListener() {},
		removeEventListener() {},
	});
}

const UA_CHROME_ANDROID =
	'Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const UA_INSTAGRAM_ANDROID = UA_CHROME_ANDROID + ' Instagram 302.0.0.23.113 Android';
const UA_SAFARI_IPHONE =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const UA_CHROME_IPHONE =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1';
const UA_CHROME_DESKTOP =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

describe('a decisão da oferta', () => {
	it('some para quem já instalou — inclusive quando o navegador ainda tem o evento guardado', () => {
		const oferta = decidirOferta(ambiente({ jaInstalado: true, temPrompt: true, ehToque: true }));
		expect(oferta.mostrar).toBe(false);
		expect(oferta.motivo).toBe('ja-instalado');
	});

	it('com o evento na mão, o clique instala de verdade', () => {
		const oferta = decidirOferta(ambiente({ temPrompt: true, ehToque: true }));
		expect(oferta.mostrar).toBe(true);
		expect(oferta.modo).toBe('prompt');
		expect(oferta.rotulo).toBe('Instalar o app');
	});

	it('no navegador de dentro de um app, manda ABRIR NO CHROME — e não fala em Compartilhar', () => {
		const oferta = decidirOferta(ambiente({ ehWebviewDeApp: true, ehToque: true }));
		expect(oferta.mostrar).toBe(true);
		expect(oferta.modo).toBe('instrucao');
		expect(oferta.motivo).toBe('webview-de-app');
		expect(oferta.dica).toMatch(/Chrome|Safari/);
		expect(oferta.dica).not.toMatch(/Tela de Início/);
	});

	it('a webview vence o iPhone: dentro do Instagram de iPhone o Compartilhar não resolve', () => {
		const oferta = decidirOferta(ambiente({ ehWebviewDeApp: true, ehApple: true, ehSafari: false, ehToque: true }));
		expect(oferta.motivo).toBe('webview-de-app');
	});

	it('no iPhone dá o caminho do Compartilhar', () => {
		const oferta = decidirOferta(ambiente({ ehApple: true, ehSafari: true, ehToque: true }));
		expect(oferta.mostrar).toBe(true);
		expect(oferta.modo).toBe('instrucao');
		expect(oferta.dica).toMatch(/Compartilhar/);
		expect(oferta.dica).toMatch(/Tela de Início/);
	});

	it('no iPhone fora do Safari, ainda manda abrir no Safari se o menu não tiver o item', () => {
		const oferta = decidirOferta(ambiente({ ehApple: true, ehSafari: false, ehToque: true }));
		expect(oferta.dica).toMatch(/Safari/);
	});

	it('no Android sem evento, aponta o menu do navegador — o buraco que deixava o jogador no silêncio', () => {
		const oferta = decidirOferta(ambiente({ ehToque: true }));
		expect(oferta.mostrar).toBe(true);
		expect(oferta.modo).toBe('instrucao');
		expect(oferta.motivo).toBe('toque-sem-prompt');
	});

	it('no computador sem oferta não nasce linha nenhuma', () => {
		const oferta = decidirOferta(ambiente({ ehToque: false }));
		expect(oferta.mostrar).toBe(false);
		expect(oferta.motivo).toBe('sem-oferta');
	});
});

describe('o retrato do ambiente', () => {
	afterEach(() => {
		delete window.RagIdlePWA;
	});

	it('reconhece o Instagram de Android como webview de app, e não como Chrome', () => {
		fingirAparelho(UA_INSTAGRAM_ANDROID, true);
		const amb = retratarAmbiente(null);
		expect(amb.ehWebviewDeApp).toBe(true);
		expect(amb.ehToque).toBe(true);
		expect(decidirOferta(amb).motivo).toBe('webview-de-app');
	});

	it('reconhece o Chrome de Android como aparelho de dedo sem oferta', () => {
		fingirAparelho(UA_CHROME_ANDROID, true);
		const amb = retratarAmbiente(null);
		expect(amb.ehWebviewDeApp).toBe(false);
		expect(amb.ehApple).toBe(false);
		expect(decidirOferta(amb).motivo).toBe('toque-sem-prompt');
	});

	it('reconhece o Safari de iPhone', () => {
		fingirAparelho(UA_SAFARI_IPHONE, true);
		const amb = retratarAmbiente(null);
		expect(amb.ehApple).toBe(true);
		expect(amb.ehSafari).toBe(true);
	});

	it('reconhece o Chrome de iPhone como Apple que não é Safari', () => {
		fingirAparelho(UA_CHROME_IPHONE, true);
		const amb = retratarAmbiente(null);
		expect(amb.ehApple).toBe(true);
		expect(amb.ehSafari).toBe(false);
	});

	it('lê a ponte da casca: prompt guardado e jogo já instalado', () => {
		fingirAparelho(UA_CHROME_ANDROID, true);
		window.RagIdlePWA = { promptDeInstalacao: {}, estaInstalado: () => false };
		expect(retratarAmbiente(pontePWA()).temPrompt).toBe(true);
		window.RagIdlePWA = { promptDeInstalacao: null, estaInstalado: () => true };
		expect(retratarAmbiente(pontePWA()).jaInstalado).toBe(true);
	});

	it('sem ponte nenhuma o retrato não explode', () => {
		fingirAparelho(UA_CHROME_DESKTOP, false);
		expect(() => retratarAmbiente(null)).not.toThrow();
		expect(ofertaAtual(null).mostrar).toBe(false);
	});
});

describe('a linha na tela de entrada', () => {
	/** Uma tela de login de mentira, com o mesmo contrato que o componente dá. */
	function telaDeLogin() {
		document.body.innerHTML = `
			<div id="WinLogin">
				<div class="wl-body">
					<input class="user" />
					<input class="pass" type="password" />
					<button class="connect">Entrar em Midgard</button>
					<button class="replay">Assistir a um replay</button>
				</div>
			</div>`;
		const root = document.querySelector('#WinLogin');
		return { getRoot: () => root, _shadow: null, root };
	}

	beforeEach(() => {
		fingirAparelho(UA_CHROME_ANDROID, true);
		delete window.RagIdlePWA;
	});

	afterEach(() => {
		document.body.innerHTML = '';
		delete window.RagIdlePWA;
	});

	it('nasce dentro da caixa do botão de entrar, e não solta no documento', () => {
		const tela = telaDeLogin();
		montarOfertaNaEntrada(tela);
		const linha = tela.root.querySelector('.wl-instalar');
		expect(linha).not.toBeNull();
		expect(linha.parentElement.classList.contains('wl-body')).toBe(true);
	});

	it('montar duas vezes não cria duas linhas', () => {
		const tela = telaDeLogin();
		montarOfertaNaEntrada(tela);
		montarOfertaNaEntrada(tela);
		expect(tela.root.querySelectorAll('.wl-instalar').length).toBe(1);
	});

	it('no Android sem evento aparece a instrução, e ela abre no toque', () => {
		const tela = telaDeLogin();
		montarOfertaNaEntrada(tela);
		const linha = tela.root.querySelector('.wl-instalar');
		const botao = linha.querySelector('.wl-instalar-btn');
		const dica = linha.querySelector('.wl-instalar-dica');

		expect(linha.hidden).toBe(false);
		expect(botao.textContent).toContain('Como instalar');
		/* O passo a passo não é despejado na tela de quem só quer digitar a
		   senha: ele abre no toque, e fecha de novo. */
		expect(dica.hidden).toBe(true);
		botao.click();
		expect(dica.hidden).toBe(false);
		expect(dica.textContent).toMatch(/menu do navegador/);
		botao.click();
		expect(dica.hidden).toBe(true);
	});

	it('com o evento guardado, o clique dispara a instalação de verdade', async () => {
		const instalar = vi.fn().mockResolvedValue('instalado');
		window.RagIdlePWA = { promptDeInstalacao: {}, estaInstalado: () => false, instalar };

		const tela = telaDeLogin();
		montarOfertaNaEntrada(tela);
		const linha = tela.root.querySelector('.wl-instalar');
		expect(linha.querySelector('.wl-instalar-rotulo').textContent).toBe('Instalar o app');
		/* No modo prompt a frase curta já está à vista: ela responde o que a
		   instalação muda antes de o jogador decidir. */
		expect(linha.querySelector('.wl-instalar-dica').hidden).toBe(false);

		linha.querySelector('.wl-instalar-btn').click();
		await vi.waitFor(() => {
			expect(instalar).toHaveBeenCalled();
			expect(linha.querySelector('.wl-instalar-dica').textContent).toBe(textoDoResultado('instalado'));
		});
	});

	it('depois de instalar, o aviso da casca NÃO reescreve por cima com "como instalar"', async () => {
		/* O defeito que esta prova trava: a casca dispara `ragidle:instalado`
		   logo depois do `appinstalled`, e a sincronização não acha prompt
		   nenhum (ele foi consumido). Sem a trava, ela concluiria "Android sem
		   evento" e mandaria o jogador ao menu do navegador — para instalar o
		   que ele acabou de instalar. */
		const instalar = vi.fn().mockResolvedValue('instalado');
		window.RagIdlePWA = { promptDeInstalacao: {}, estaInstalado: () => false, instalar };

		const tela = telaDeLogin();
		montarOfertaNaEntrada(tela);
		const linha = tela.root.querySelector('.wl-instalar');
		linha.querySelector('.wl-instalar-btn').click();
		await vi.waitFor(() => expect(instalar).toHaveBeenCalled());

		window.RagIdlePWA.promptDeInstalacao = null;
		window.dispatchEvent(new CustomEvent('ragidle:instalado'));
		sincronizar(tela.root);

		expect(linha.querySelector('.wl-instalar-dica').textContent).toBe(textoDoResultado('instalado'));
		expect(linha.classList.contains('is-feito')).toBe(true);
		expect(linha.hidden).toBe(false);
	});

	it('quem já instalou não vê a linha', () => {
		window.RagIdlePWA = { promptDeInstalacao: null, estaInstalado: () => true };
		const tela = telaDeLogin();
		montarOfertaNaEntrada(tela);
		expect(tela.root.querySelector('.wl-instalar').hidden).toBe(true);
	});

	it('no computador sem oferta a linha fica escondida', () => {
		fingirAparelho(UA_CHROME_DESKTOP, false);
		const tela = telaDeLogin();
		montarOfertaNaEntrada(tela);
		expect(tela.root.querySelector('.wl-instalar').hidden).toBe(true);
	});

	it('a oferta que chega DEPOIS troca a instrução pelo botão que instala', () => {
		const tela = telaDeLogin();
		montarOfertaNaEntrada(tela);
		const linha = tela.root.querySelector('.wl-instalar');
		expect(linha.querySelector('.wl-instalar-rotulo').textContent).toBe('Como instalar');

		/* É o que acontece de verdade: o `beforeinstallprompt` depende de
		   heurística de engajamento e chega com a tela já aberta. */
		window.RagIdlePWA = { promptDeInstalacao: {}, estaInstalado: () => false, instalar: () => {} };
		window.dispatchEvent(new CustomEvent('ragidle:pode-instalar'));

		expect(linha.querySelector('.wl-instalar-rotulo').textContent).toBe('Instalar o app');
	});

	it('sem botão de entrar (tela de outro formato) não quebra nada', () => {
		document.body.innerHTML = '<div id="WinLogin"><div class="wl-body"></div></div>';
		const root = document.querySelector('#WinLogin');
		expect(() => montarOfertaNaEntrada({ getRoot: () => root, _shadow: null })).not.toThrow();
		expect(root.querySelector('.wl-instalar')).toBeNull();
	});

	it('sincronizar sem linha montada é inofensivo', () => {
		document.body.innerHTML = '<div id="WinLogin"></div>';
		expect(() => sincronizar(document.querySelector('#WinLogin'))).not.toThrow();
		expect(() => sincronizar(null)).not.toThrow();
	});
});
