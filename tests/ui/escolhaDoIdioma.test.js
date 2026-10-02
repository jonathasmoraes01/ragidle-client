/**
 * A ESCOLHA DO IDIOMA (D-1929): o passo zero do tutorial so pergunta a quem
 * nunca escolheu; escolher o MESMO idioma fecha e devolve o tutorial;
 * escolher OUTRO recarrega (mantendo a sessao no jogo, a pagina no login);
 * fechar sem escolher conta como escolher o atual.
 *
 * O GUIComponent e trocado por um minimo que monta o HTML numa raiz de
 * sombra de verdade — o que interessa aqui e o comportamento da janela.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('UI/GUIComponent.js', () => ({
	default: class {
		static MouseMode = { CROSS: 0, STOP: 1, FREEZE: 2 };
		constructor(nome) {
			this.name = nome;
			this.__loaded = false;
			this.__active = false;
		}
		prepare() {
			this._host = document.createElement('div');
			this._shadow = this._host.attachShadow({ mode: 'open' });
			this._shadow.innerHTML = this.render();
			this.__loaded = true;
			if (this.init) {
				this.init();
			}
		}
		append() {
			document.body.appendChild(this._host);
			this.__active = true;
		}
		focus() {}
	}
}));
vi.mock('UI/UIManager.js', () => ({ default: { addComponent: c => c } }));
vi.mock('UI/recargaMantendoASessao.js', () => ({ recarregarMantendoASessao: () => {} }));
vi.mock('UI/ofertaDeInstalacao.js', () => ({ janelaDaCasca: () => window }));

const { default: IdiomaIdle } = await import('UI/Components/IdiomaIdle/IdiomaIdle.js');
const Idioma = await import('Core/Idioma.js');

let recargas;

function botao(codigo) {
	return IdiomaIdle._shadow.querySelector(`.ii-opcao[data-idioma="${codigo}"]`);
}

beforeEach(() => {
	localStorage.clear();
	Idioma.esquecerIdiomaLido();
	recargas = [];
	IdiomaIdle._trocarRecargas(
		() => recargas.push('jogo'),
		() => recargas.push('login')
	);
	if (IdiomaIdle.__loaded) {
		IdiomaIdle.fechar();
	}
});

describe('o passo zero do tutorial', () => {
	it('abre para quem NUNCA escolheu, com um botao por idioma (bandeira + nome)', () => {
		expect(IdiomaIdle.passoZero(() => {})).toBe(true);
		expect(IdiomaIdle.estaAberta()).toBe(true);
		const nomes = [...IdiomaIdle._shadow.querySelectorAll('.ii-opcao .ii-nome')].map(n => n.textContent);
		expect(nomes).toEqual(['Português (BR)', 'English']);
		expect(botao('en').querySelector('.ii-bandeira').getAttribute('src')).toBe('/ragidle/idioma/us.svg');
		expect(botao('pt-BR').classList.contains('is-atual')).toBe(true);
	});

	it('nao abre para quem ja escolheu (por qualquer porta)', () => {
		Idioma.definirIdioma('pt-BR');
		expect(IdiomaIdle.passoZero(() => {})).toBe(false);
		expect(IdiomaIdle.estaAberta()).toBe(false);
	});

	it('escolher o MESMO idioma fecha, grava a escolha e devolve a vez ao tutorial (sem recarregar)', () => {
		let devolveu = 0;
		IdiomaIdle.passoZero(() => devolveu++);
		botao('pt-BR').click();
		expect(IdiomaIdle.estaAberta()).toBe(false);
		expect(devolveu).toBe(1);
		expect(recargas).toEqual([]);
		expect(Idioma.idiomaFoiEscolhido()).toBe(true);
	});

	it('escolher OUTRO idioma grava e recarrega MANTENDO A SESSAO', () => {
		IdiomaIdle.passoZero(() => {});
		botao('en').click();
		expect(Idioma.idiomaAtual()).toBe('en');
		expect(recargas).toEqual(['jogo']);
	});

	it('fechar no X sem escolher conta como escolher o atual: o passo zero nao volta', () => {
		let devolveu = 0;
		IdiomaIdle.passoZero(() => devolveu++);
		IdiomaIdle._shadow.querySelector('.ii-x').click();
		expect(devolveu).toBe(1);
		expect(Idioma.idiomaFoiEscolhido()).toBe(true);
		expect(Idioma.idiomaAtual()).toBe('pt-BR');
		expect(IdiomaIdle.passoZero(() => {})).toBe(false);
	});

	it('o ESC tambem fecha sem escolher', () => {
		IdiomaIdle.passoZero(() => {});
		const evento = { which: 27, key: 'Escape', stopImmediatePropagation() {}, preventDefault() {} };
		IdiomaIdle.onKeyDown(evento);
		expect(IdiomaIdle.estaAberta()).toBe(false);
		expect(Idioma.idiomaFoiEscolhido()).toBe(true);
	});
});

describe('as outras portas', () => {
	it('no LOGIN, escolher outro idioma recarrega so a pagina (nao ha sessao)', () => {
		IdiomaIdle.mostrar({ contexto: 'login' });
		botao('en').click();
		expect(recargas).toEqual(['login']);
	});

	it('pelas Configuracoes abre mesmo para quem ja escolheu, e marca o idioma atual', () => {
		Idioma.definirIdioma('en');
		IdiomaIdle.mostrar({ contexto: 'jogo' });
		expect(IdiomaIdle.estaAberta()).toBe(true);
		expect(botao('en').classList.contains('is-atual')).toBe(true);
		expect(botao('en').querySelector('.ii-marca').textContent).toBe('current');
	});

	it('o ATALHO do login aparece e some (WinLoginCommon o liga ao abrir o login), e abre a janela no contexto do login', () => {
		IdiomaIdle.mostrarAtalho();
		const atalho = IdiomaIdle._shadow.querySelector('.ii-atalho');
		expect(atalho.classList.contains('is-visivel')).toBe(true);
		atalho.click();
		expect(IdiomaIdle.estaAberta()).toBe(true);
		botao('en').click();
		expect(recargas).toEqual(['login']);
		IdiomaIdle.esconderAtalho();
		expect(atalho.classList.contains('is-visivel')).toBe(false);
	});

	it('a janela inteira e translate="no" (ela e bilingue de proposito)', () => {
		IdiomaIdle.mostrar();
		expect(IdiomaIdle._shadow.querySelector('#IdiomaIdle').getAttribute('translate')).toBe('no');
	});
});
