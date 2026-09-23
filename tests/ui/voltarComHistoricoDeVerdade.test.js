/**
 * O BOTAO VOLTAR COM UM HISTORICO DE VERDADE (H10, auditoria 2 de 22/09/2026).
 *
 * Os casos de voltar em `pilhaDeJanelas.test.js` disparam um `popstate`
 * SINTETICO, sem mexer no historico. No navegador o `popstate` so chega quando
 * o voltar atravessa uma entrada do MESMO documento: na entrada-base (a
 * `start_url` do PWA instalado) o voltar sai do jogo, e nenhum `popstate` nasce.
 * Por isso a suite estava verde com os dois defeitos vivos:
 *
 *   (a) sem entrada nenhuma empilhada (o jogador entrou e nao abriu janela, ou
 *       ja fechou tudo pelo voltar), o voltar SAIA DO JOGO SEM PERGUNTAR;
 *   (b) cada janela empilhava uma entrada e so o voltar a consumia: fechar pelo
 *       X deixava entradas orfas, e o "OK" de "Sair do jogo?" consumia uma e o
 *       jogo continuava.
 *
 * Aqui o historico e um modelo do navegador: uma pilha de entradas com um
 * cursor. O voltar do aparelho recua o cursor e dispara o `popstate`; na base,
 * ele SAI. `history.back()` chamado pelo codigo faz o mesmo, depois de uma
 * volta do laco de eventos, como no navegador.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Pilha from 'UI/pilhaDeJanelas.js';

/** O navegador: entradas, cursor, e o que aconteceu quando o voltar passou da base. */
function historicoDoNavegador() {
	const entradas = [{ state: null }];
	let cursor = 0;
	const registro = { saiu: 0 };

	function recuar() {
		if (cursor === 0) {
			// Na entrada-base o voltar deixa o documento: o PWA fecha, a aba
			// vai para o site anterior. Nenhum `popstate` chega ao jogo.
			registro.saiu++;
			return;
		}
		cursor--;
		window.dispatchEvent(new window.PopStateEvent('popstate', { state: entradas[cursor].state }));
	}

	const history = {
		get state() {
			return entradas[cursor].state;
		},
		get length() {
			return entradas.length;
		},
		pushState(state) {
			entradas.splice(cursor + 1);
			entradas.push({ state });
			cursor++;
		},
		replaceState(state) {
			entradas[cursor] = { state };
		},
		back() {
			setTimeout(recuar, 0);
		},
		go(n) {
			if (n === -1) setTimeout(recuar, 0);
		}
	};

	return {
		history,
		registro,
		/** O botao voltar do aparelho (o gesto de borda do Android). */
		voltar: recuar,
		/** O avancar do navegador de mesa. */
		avancar() {
			if (cursor === entradas.length - 1) return;
			cursor++;
			window.dispatchEvent(new window.PopStateEvent('popstate', { state: entradas[cursor].state }));
		},
		entradasAcima: () => cursor,
		totalDeEntradas: () => entradas.length
	};
}

/** Uma janela com a forma das de verdade: `is-open` e um `toggle()` publico. */
function janelaFalsa(prefixo) {
	const host = document.createElement('div');
	const win = document.createElement('div');
	win.className = `${prefixo}-window`;
	host.appendChild(win);
	document.body.appendChild(host);
	const componente = {
		_host: host,
		_shadow: host,
		toggle() {
			win.classList.toggle('is-open');
		}
	};
	return { componente, win, seletor: `.${prefixo}-window` };
}

describe('o voltar do Android com um historico de verdade (H10)', () => {
	let nav;
	let mochila;
	let confirmar;

	beforeEach(() => {
		vi.useFakeTimers();
		Pilha._zerar();
		document.body.innerHTML = '';
		nav = historicoDoNavegador();
		vi.stubGlobal('history', nav.history);
		confirmar = vi.spyOn(window, 'confirm');
		mochila = janelaFalsa('mo');
		Pilha.registrar({ nome: 'mochila', componente: mochila.componente, seletor: mochila.seletor });
		// A entrada no mundo (`MapEngine`) liga a pilha.
		Pilha.ligar();
	});

	afterEach(() => {
		Pilha._zerar();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it('(a) sem janela aberta, o voltar PERGUNTA — e o Cancelar fica no jogo', () => {
		confirmar.mockReturnValue(false);
		nav.voltar();
		expect(nav.registro.saiu, 'saiu do jogo sem perguntar').toBe(0);
		expect(confirmar).toHaveBeenCalledTimes(1);
		// E continua protegido: o proximo voltar pergunta de novo.
		nav.voltar();
		expect(nav.registro.saiu).toBe(0);
		expect(confirmar).toHaveBeenCalledTimes(2);
	});

	it('(a) o OK sai de verdade', () => {
		confirmar.mockReturnValue(true);
		nav.voltar();
		vi.runAllTimers();
		expect(confirmar).toHaveBeenCalledTimes(1);
		expect(nav.registro.saiu, 'o OK de "Sair do jogo?" nao saiu').toBe(1);
	});

	it('(b) abrir e fechar a Mochila pelo X nao deixa entradas orfas: um voltar, uma pergunta, o OK sai', () => {
		for (let i = 0; i < 5; i++) {
			mochila.componente.toggle();
			mochila.componente.toggle();
		}
		confirmar.mockReturnValue(true);
		nav.voltar();
		vi.runAllTimers();
		expect(confirmar).toHaveBeenCalledTimes(1);
		expect(nav.registro.saiu, 'o OK consumiu uma entrada orfa e o jogo continuou').toBe(1);
	});

	it('com janela aberta, o voltar FECHA a janela, e o seguinte PERGUNTA', () => {
		mochila.componente.toggle();
		confirmar.mockReturnValue(false);
		nav.voltar();
		expect(mochila.win.classList.contains('is-open')).toBe(false);
		expect(confirmar).not.toHaveBeenCalled();
		nav.voltar();
		expect(nav.registro.saiu, 'fechou a janela e o voltar seguinte saiu sem perguntar').toBe(0);
		expect(confirmar).toHaveBeenCalledTimes(1);
	});

	it('varias janelas fechadas num voltar so nao deixam N-1 orfas', () => {
		const skills = janelaFalsa('is');
		Pilha.registrar({ nome: 'skills', componente: skills.componente, seletor: skills.seletor });
		mochila.componente.toggle();
		skills.componente.toggle();
		nav.voltar();
		expect(Pilha.abertas()).toEqual([]);
		confirmar.mockReturnValue(true);
		nav.voltar();
		vi.runAllTimers();
		expect(confirmar).toHaveBeenCalledTimes(1);
		expect(nav.registro.saiu).toBe(1);
	});

	it('o historico nao cresce com as janelas: uma entrada do jogo, e so', () => {
		for (let i = 0; i < 5; i++) {
			mochila.componente.toggle();
			mochila.componente.toggle();
		}
		expect(nav.entradasAcima()).toBe(1);
	});

	it('religar a pilha (o F5 cai na propria entrada do jogo) nao empilha uma segunda', () => {
		Pilha.desligar();
		Pilha.ligar();
		expect(nav.entradasAcima()).toBe(1);
	});

	it('o AVANCAR de volta para a entrada do jogo nao e um voltar: nao pergunta nem empilha', () => {
		// A aba sem pagina anterior: o OK desce ate a base e nao tem para onde ir.
		confirmar.mockReturnValue(true);
		nav.voltar();
		vi.runAllTimers();
		nav.avancar();
		expect(confirmar).toHaveBeenCalledTimes(1);
		expect(nav.totalDeEntradas()).toBe(2);
	});

	it('o OK nao pede a confirmacao do navegador por cima da nossa', () => {
		const aviso = () => 'Are you sure to exit roBrowser ?';
		window.onbeforeunload = aviso;
		let avisoNaHoraDeSair = 'nao saiu';
		const recuarOriginal = nav.history.back;
		nav.history.back = () => {
			avisoNaHoraDeSair = window.onbeforeunload;
			recuarOriginal();
		};
		confirmar.mockReturnValue(true);
		nav.voltar();
		expect(avisoNaHoraDeSair, 'o jogador ja confirmou; o aviso do navegador seria a segunda pergunta').toBeNull();
		// Se a saida nao aconteceu (o PWA na entrada-base), o aviso volta.
		vi.runAllTimers();
		expect(window.onbeforeunload).toBe(aviso);
		window.onbeforeunload = null;
	});
});
