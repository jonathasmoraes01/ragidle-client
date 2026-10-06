/**
 * O NOME DO ESCONDIDO NAO FICA NO CHAO (D-2024).
 *
 * O Gatuno escondido (`OPTION_HIDE`) sumia para os outros, mas o `renderGUI`
 * (`EntityRender.js`) desenhava o nome, a barra de HP e o emblema sem olhar o
 * efeito — e o nome no chao entregava onde ele estava.
 *
 * Este teste roda o `render` de verdade com o setter de verdade do
 * `effectState` (`EntityState.js`): liga o bit do Hide e conta quem o
 * `renderGUI` mandou desenhar E quem ficou na camada do DOM (os letreiros sao
 * canvas: so pular o desenho os deixava pregados no ultimo pixel, e foi isso
 * que a sonda `diag-esconderijo-na-tela` fotografou). Dependencias de GL e de assets sao trocadas por
 * vazios; a decisao (o setter, a cor do encoberto e o portao dos letreiros) e
 * a do jogo.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sessao = { Entity: null };

vi.mock('Engine/SessionStorage.js', () => ({ default: sessao }));
vi.mock('Audio/SoundManager.js', () => ({ default: { play() {} } }));
vi.mock('DB/Emotions.js', () => ({ default: {} }));
vi.mock('DB/Jobs/MountTable.js', () => ({ default: {} }));
vi.mock('DB/Jobs/AllMountTable.js', () => ({ default: {} }));
vi.mock('Renderer/Camera.js', () => ({ default: { direction: 0 } }));
vi.mock('Core/Client.js', () => ({ default: {} }));
vi.mock('Renderer/SpriteRenderer.js', () => ({ default: {} }));
vi.mock('Renderer/Map/Ground.js', () => ({ default: {} }));
vi.mock('Renderer/Map/Altitude.js', () => ({ default: {} }));
vi.mock('DB/Jobs/JobConst.js', () => ({ default: {} }));
vi.mock('DB/DBManager.js', () => ({ default: {} }));
vi.mock('Preferences/Graphics.js', () => ({ default: {} }));
vi.mock('Renderer/GR2/GR2ModelRenderer.js', () => ({ default: { isMissing: () => false } }));

const { default: StatusConst } = await import('DB/Status/StatusState.js');
const { default: iniciarEstado } = await import('Renderer/Entity/EntityState.js');
const { default: iniciarRender } = await import('Renderer/Entity/EntityRender.js');
const { default: glMatrix } = await import('Utils/gl-matrix.js');

const HIDE = StatusConst.EffectState.HIDE;
const LETREIROS = ['life', 'emblem', 'display'];

/** Um letreiro com canvas de verdade: o `render` o poe na camada, como o jogo. */
function letreiro() {
	const canvas = document.createElement('canvas');
	return { display: true, canvas, render: vi.fn(() => camada.appendChild(canvas)) };
}

const camada = document.createElement('div');
document.body.appendChild(camada);

/** Os letreiros cujo canvas esta na camada — o que o jogador ve. */
function naCamada(e) {
	return LETREIROS.filter(nome => e[nome].canvas.parentNode === camada);
}

/** Uma entidade minima com o estado e o render de verdade. */
function nascer() {
	const e = {
		constructor: { TYPE_ITEM: 3 },
		objecttype: 0,
		position: [10, 10, 0],
		xSize: 5,
		ySize: 5,
		boundingRect: { x1: 0, y1: 0, x2: 0, y2: 0 },
		animations: { process() {} },
		attachments: { render() {} },
		walkProcess() {},
		entitiesWalkProcess() {},
		_job: 0
	};
	for (const nome of [...LETREIROS, 'dialog', 'cast', 'room']) e[nome] = letreiro();
	iniciarEstado.call(e);
	iniciarRender.call(e);
	// O corpo nao e o assunto: o sprite precisa de GL.
	e.renderEntity = () => {};
	return e;
}

function desenhar(e) {
	for (const nome of [...LETREIROS, 'dialog', 'cast', 'room']) e[nome].render.mockClear();
	e.render(glMatrix.mat4.create(), glMatrix.mat4.create());
	return Object.fromEntries(LETREIROS.map(nome => [nome, e[nome].render.mock.calls.length]));
}

const TODOS = { life: 1, emblem: 1, display: 1 };
const NENHUM = { life: 0, emblem: 0, display: 0 };

describe('o nome de quem esta escondido (D-2024)', () => {
	beforeEach(() => {
		sessao.Entity = { GID: 1, intravision: false };
	});

	it('CONTROLE: fora do esconderijo, nome, barra de HP e emblema sao desenhados', () => {
		expect(desenhar(nascer())).toEqual(TODOS);
	});

	it('o OUTRO escondido nao tem nome, barra de HP nem emblema na tela de quem olha', () => {
		const gatuno = nascer();
		// Primeiro a vista: os canvas entram na camada, como entram no jogo.
		desenhar(gatuno);
		expect(naCamada(gatuno)).toEqual(LETREIROS);
		gatuno.effectState = HIDE;
		expect(gatuno.effectColor[3], 'o corpo dele tem de estar apagado').toBe(0);
		expect(desenhar(gatuno)).toEqual(NENHUM);
		// O canvas e DOM: sem render ele fica pregado no ultimo pixel. Tem de sair.
		expect(naCamada(gatuno), 'o nome ficou na tela').toEqual([]);
		// Os interruptores nao mudam: quem decide reaparecer e o efeito.
		expect(LETREIROS.map(nome => gatuno[nome].display)).toEqual([true, true, true]);
	});

	it('saindo do esconderijo, os letreiros voltam', () => {
		const gatuno = nascer();
		gatuno.effectState = HIDE;
		desenhar(gatuno);
		gatuno.effectState = 0;
		expect(desenhar(gatuno)).toEqual(TODOS);
		expect(naCamada(gatuno)).toEqual(LETREIROS);
	});

	it('o PROPRIO escondido continua com o nome (ele se ve meio transparente)', () => {
		const eu = nascer();
		sessao.Entity = eu;
		eu.effectState = HIDE;
		expect(eu.effectColor[3]).toBeGreaterThan(0);
		expect(desenhar(eu)).toEqual(TODOS);
		expect(naCamada(eu)).toEqual(LETREIROS);
	});

	it('com a INTRAVISAO quem olha ve a silhueta, e o nome junto', () => {
		sessao.Entity = { GID: 1, intravision: true };
		const gatuno = nascer();
		gatuno.effectState = HIDE;
		expect(desenhar(gatuno)).toEqual(TODOS);
	});

	it('o pisca-pisca que zera o alfa composto NAO apaga os letreiros de quem esta a vista', () => {
		// O portao le o alfa do EFEITO, e nao o composto: um quadro apagado pelo
		// `_flashColor` nao e esconderijo.
		const e = nascer();
		e._flashColor[3] = 0;
		e.effectState = 0;
		expect(e.effectColor[3]).toBe(0);
		expect(desenhar(e)).toEqual(TODOS);
	});
});
