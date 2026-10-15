/**
 * A TELA DE CRIAR PERSONAGEM RESPONDE AO CLIQUE (16/10/2026).
 *
 * Relato do dono, em producao: depois de "Criar personagem" nada visivel
 * acontecia; a tela parecia congelada por ~10 s e so entao voltava a lista,
 * com o personagem criado. O jogador novo clicava 10 vezes. O servidor pode,
 * legitimamente, levar segundos (espera a conta ser liberada por outro
 * processo, ate 8 s, e a gravacao confirmar).
 *
 * Aqui a janela de VERDADE (CharCreatev4 sobre a fabrica comum), com os
 * vizinhos pesados (WebGL, GRF, rede) falsos. O que se mede: o botao trava e
 * diz "Criando personagem..." no clique; o segundo clique nao manda outro
 * pedido; a resposta (aceite ou recusa) solta o formulario; sem resposta em
 * 20 s ele solta sozinho, avisa, e NAO reenvia.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ caixas: [] }));

vi.mock('UI/GUIComponent.js', () => {
	class GUIComponent {
		constructor(name) {
			this.name = name;
			this._host = document.createElement('div');
			this.__active = false;
		}
		getRoot() {
			return this._host;
		}
		draggable() {}
		focus() {}
	}
	GUIComponent.MouseMode = { CROSS: 0 };
	return { default: GUIComponent };
});
vi.mock('UI/UIManager.js', () => ({
	default: {
		addComponent: componente => componente,
		showMessageBox: texto => mocks.caixas.push(texto)
	}
}));
vi.mock('Renderer/Renderer.js', () => ({ default: { width: 1280, height: 720, render() {}, stop() {} } }));
vi.mock('DB/DBManager.js', () => ({ default: { INTERFACE_PATH: '', getMessage: id => `msg${id}` } }));
vi.mock('Core/Client.js', () => ({ default: { loadFile() {} } }));
vi.mock('Renderer/Entity/Entity.js', () => ({
	default: class Entity {
		set(dados) {
			Object.assign(this, dados);
		}
	}
}));
vi.mock('Renderer/SpriteRenderer.js', () => ({ default: {} }));
vi.mock('Renderer/Camera.js', () => ({ default: {} }));
vi.mock('UI/Elements/Elements.js', () => ({}));
vi.mock('Controls/KeyEventHandler.js', () => ({ default: { ESCAPE: 27, ENTER: 13 } }));

// jsdom nao tem canvas: a janela so guarda o contexto, e null basta.
HTMLCanvasElement.prototype.getContext = () => null;

const { default: CharCreate } = await import('UI/Components/CharCreate/CharCreatev4/CharCreatev4.js');
const { TEMPO_MAXIMO_DA_CRIACAO_MS, TEXTO_CRIANDO, criarEsperaDaCriacao, personagemCriadoNaLista } = await import(
	'UI/Components/CharCreate/esperaDaCriacao.js'
);

let pedidos;
let esgotou;
let saidas;

function montar() {
	CharCreate._host = document.createElement('div');
	CharCreate._host.innerHTML = CharCreate.render();
	document.body.appendChild(CharCreate._host);
	CharCreate.init();
	CharCreate.onAppend();
	CharCreate.__active = true;
	pedidos = [];
	esgotou = 0;
	saidas = 0;
	CharCreate.onCharCreationRequest = (...args) => pedidos.push(args);
	CharCreate.onCreationTimeout = () => {
		esgotou++;
	};
	CharCreate.onExitRequest = () => {
		saidas++;
	};
}

const raiz = () => CharCreate.getRoot();
const botao = () => raiz().querySelector('.make');

function digitarECriar(nome = 'Aventureiro') {
	raiz().querySelector('#char_name').value = nome;
	botao().click();
}

beforeEach(() => {
	vi.useFakeTimers();
	mocks.caixas.length = 0;
	montar();
});

afterEach(() => {
	CharCreate.onRemove();
	CharCreate._host.remove();
	vi.useRealTimers();
});

describe('o clique em "Criar personagem" responde na hora', () => {
	it('o botao trava, gira e diz "Criando personagem..."; Voltar e campos travam junto', () => {
		expect(botao().textContent).toBe('Criar personagem');
		digitarECriar();

		expect(pedidos).toHaveLength(1);
		expect(botao().disabled).toBe(true);
		expect(botao().getAttribute('aria-busy')).toBe('true');
		expect(botao().classList.contains('is-criando')).toBe(true);
		expect(botao().querySelector('.cc-giro')).not.toBeNull();
		expect(botao().textContent).toBe(TEXTO_CRIANDO);
		expect(raiz().querySelector('.return').disabled).toBe(true);
		expect(raiz().querySelector('.cancel').disabled).toBe(true);
		expect(raiz().querySelector('#char_name').disabled).toBe(true);
	});

	it('dez cliques mandam UM pedido (inclusive com o botao re-habilitado a forca)', () => {
		digitarECriar();
		for (let i = 0; i < 9; i++) {
			// o disabled ja barra o clique do navegador; aqui o clique passa a forca
			botao().disabled = false;
			botao().click();
		}
		expect(pedidos).toHaveLength(1);
	});

	it('Voltar e ESC nao saem com o pedido no ar; Enter e engolido', () => {
		digitarECriar();
		raiz().querySelector('.return').disabled = false;
		raiz().querySelector('.return').click();
		CharCreate.onKeyDown({ which: 27, key: 'Escape', stopImmediatePropagation() {} });
		expect(saidas).toBe(0);
		expect(CharCreate.onKeyDown({ which: 13, key: 'Enter', stopImmediatePropagation() {} })).toBe(false);
	});

	it('nome invalido nao trava nada (a caixa local diz o motivo)', () => {
		digitarECriar('Ana');
		expect(pedidos).toHaveLength(0);
		expect(botao().disabled).toBe(false);
		expect(mocks.caixas).toHaveLength(1);
	});
});

describe('a resposta do servidor solta o formulario', () => {
	it('recusa: o formulario volta, com o rotulo original, e aceita um novo pedido', () => {
		digitarECriar();
		CharCreate.criacaoRespondida(); // o que o CharEngine faz no HC_REFUSE_MAKECHAR
		expect(botao().disabled).toBe(false);
		expect(botao().getAttribute('aria-busy')).toBeNull();
		expect(botao().textContent).toBe('Criar personagem');
		expect(raiz().querySelector('.return').disabled).toBe(false);
		expect(raiz().querySelector('#char_name').disabled).toBe(false);

		digitarECriar('OutroNome');
		expect(pedidos).toHaveLength(2);
	});

	it('aceite: a tela fecha (onRemove) e reabre livre, sem o relogio vivo', () => {
		digitarECriar();
		CharCreate.criacaoRespondida();
		CharCreate.onRemove();
		vi.advanceTimersByTime(TEMPO_MAXIMO_DA_CRIACAO_MS * 2);
		expect(esgotou).toBe(0);
		expect(CharCreate.criacaoEmCurso()).toBe(false);
	});
});

describe('sem resposta, a espera acaba sozinha e NAO reenvia', () => {
	it('aos 20 s o formulario volta e o CharEngine e avisado; nenhum pedido novo', () => {
		digitarECriar();
		vi.advanceTimersByTime(TEMPO_MAXIMO_DA_CRIACAO_MS - 1);
		expect(botao().disabled).toBe(true);
		expect(esgotou).toBe(0);

		vi.advanceTimersByTime(1);
		expect(esgotou).toBe(1);
		expect(botao().disabled).toBe(false);
		expect(pedidos).toHaveLength(1);
	});

	it('a resposta que chega depois de esgotar nao quebra nada', () => {
		digitarECriar();
		vi.advanceTimersByTime(TEMPO_MAXIMO_DA_CRIACAO_MS);
		CharCreate.criacaoRespondida();
		expect(botao().disabled).toBe(false);
		expect(botao().textContent).toBe('Criar personagem');
	});
});

describe('a espera, pura', () => {
	it('um pedido por vez; terminar solta; o relogio de um pedido velho nao mata o novo', () => {
		const mudancas = [];
		const agendados = [];
		const espera = criarEsperaDaCriacao({
			aoMudar: c => mudancas.push(c),
			aoEsgotar: () => mudancas.push('esgotou'),
			agendar: fn => agendados.push(fn) - 1,
			desagendar: () => {}
		});
		expect(espera.comecar()).toBe(true);
		expect(espera.comecar()).toBe(false);
		espera.terminar();
		espera.terminar();
		expect(mudancas).toEqual([true, false]);
		expect(espera.comecar()).toBe(true);
		agendados[0](); // o relogio do primeiro pedido, que o desagendar falso nao matou
		expect(espera.emCurso()).toBe(true);
		agendados[1](); // o relogio do pedido da vez esgota
		expect(espera.emCurso()).toBe(false);
		expect(mudancas).toEqual([true, false, true, false, 'esgotou']);
	});

	it('a lista pos-espera acha o personagem pela vaga', () => {
		expect(personagemCriadoNaLista([{ CharNum: 0 }, { CharNum: 3, name: 'X' }], 3)).toEqual({ CharNum: 3, name: 'X' });
		expect(personagemCriadoNaLista([{ CharNum: 0 }], 3)).toBeNull();
		expect(personagemCriadoNaLista(undefined, 0)).toBeNull();
	});
});

describe('o CharEngine fecha o circuito', () => {
	const fonte = readFileSync(join(process.cwd(), 'src/Engine/CharEngine.js'), 'utf8')
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/\/\/[^\n]*/g, '');
	const corpo = nome => {
		const inicio = fonte.indexOf(`function ${nome}(`);
		return fonte.slice(inicio, fonte.indexOf('\n}', inicio));
	};

	it('aceite e recusa soltam o formulario; o aceite seleciona a vaga criada', () => {
		expect(corpo('onCreationFail')).toContain('criacaoRespondida()');
		expect(corpo('onCreationSuccess')).toContain('criacaoRespondida()');
		expect(corpo('onCreationSuccess')).toContain('selecionarVagaCriada(');
		expect(corpo('onCreateRequest')).toContain('ChCre.onCreationTimeout = onCreationTimeout');
	});

	it('a espera esgotada avisa e pede a LISTA — nunca outro MAKE_CHAR', () => {
		const esgotar = corpo('onCreationTimeout');
		expect(esgotar).toContain('TEXTO_SERVIDOR_DEMOROU');
		expect(esgotar).toContain('CHARLIST_REQ');
		expect(esgotar).not.toContain('MAKE_CHAR');
		expect(esgotar).not.toContain('onCharCreationRequest');
	});
});
