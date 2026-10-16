/**
 * A VOLTA QUENTE NA CENA (D-2576, 15/10/2026) — o `setMap` com o nome mantido.
 *
 * A reconexao do mesmo personagem com a cena inteira deixa
 * `MapRenderer.currentMap` como estava (`Engine/voltaQuente.js`), e o
 * `ZC_NPCACK_MAPMOVE` da volta chama `setMap` com o mapa de agora. Mesmo mapa:
 * o ramo do TELEPORTE LOCAL (o da Asa de Mosca) — sem arte de carregamento,
 * sem worker, sem liberar chao e modelos; so as entidades saem (o lote do
 * servidor repovoa) e o `onLoad` roda uma vez (o `CZ_NOTIFY_ACTORINIT`).
 *
 * O CONTROLE e a volta fria de antes: com o nome zerado (o que o `init` fazia
 * em toda reconexao), o mesmo mapa CARREGA inteiro.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	const estado = { aoTerminar: null, aoCarregar: null };
	return {
		estado,
		thread: {
			hook: vi.fn(),
			send: vi.fn((_tipo, _arquivo, cb) => {
				estado.aoTerminar = cb;
			})
		},
		background: {
			remove: vi.fn(cb => cb()),
			setLoading: vi.fn(cb => {
				estado.aoCarregar = cb;
			})
		},
		renderer: {
			stop: vi.fn(),
			getContext: vi.fn(() => ({})),
			render: vi.fn(),
			init: vi.fn(),
			remove: vi.fn(),
			show: vi.fn()
		},
		livre: { free: vi.fn(), init: vi.fn(), clearLifeCache: vi.fn(), register: vi.fn(), clean: vi.fn() },
		sky: { setUpCloudData: vi.fn(), init: vi.fn() },
		tela: { init: vi.fn(), startMapflagEffect: vi.fn() },
		ui: { removeComponents: vi.fn(), showErrorBox: vi.fn(() => ({ ui: { css: vi.fn() } })) }
	};
});

vi.mock('Core/Thread.js', () => ({ default: mocks.thread }));
vi.mock('Audio/SoundManager.js', () => ({ default: { stop: vi.fn() } }));
vi.mock('Audio/BGM.js', () => ({ default: { stop: vi.fn(), play: vi.fn() } }));
vi.mock('DB/DBManager.js', () => ({ default: { getMap: vi.fn(() => undefined) } }));
vi.mock('UI/UIManager.js', () => ({ default: mocks.ui }));
vi.mock('UI/Background.js', () => ({ default: mocks.background }));
vi.mock('UI/CursorManager.js', () => ({ default: { ACTION: { DEFAULT: 0 }, setType: vi.fn() } }));
vi.mock('Engine/SessionStorage.js', () => ({ default: {} }));
vi.mock('Core/MemoryManager.js', () => ({ default: {} }));
vi.mock('Controls/MouseEventHandler.js', () => ({ default: { intersect: true } }));
vi.mock('Renderer/Renderer.js', () => ({ default: mocks.renderer }));
vi.mock('Renderer/Camera.js', () => ({ default: {} }));
vi.mock('Renderer/EntityManager.js', () => ({ default: mocks.livre }));
vi.mock('Renderer/Map/GridSelector.js', () => ({ default: mocks.livre }));
vi.mock('Renderer/Map/Ground.js', () => ({ default: mocks.livre }));
vi.mock('Renderer/Map/Altitude.js', () => ({ default: {} }));
vi.mock('Renderer/Map/Water.js', () => ({ default: mocks.livre }));
vi.mock('Renderer/Map/Models.js', () => ({ default: mocks.livre }));
vi.mock('Renderer/Map/AnimatedModels.js', () => ({ default: mocks.livre }));
vi.mock('Renderer/GR2/GR2ModelRenderer.js', () => ({ default: mocks.livre }));
vi.mock('Renderer/Map/Sounds.js', () => ({ default: mocks.livre }));
vi.mock('Renderer/Map/Effects.js', () => ({ default: mocks.livre }));
vi.mock('Renderer/SpriteRenderer.js', () => ({ default: mocks.livre }));
vi.mock('Renderer/EffectManager.js', () => ({ default: mocks.livre }));
vi.mock('Renderer/SignboardManager.js', () => ({ default: mocks.livre }));
vi.mock('Renderer/ScreenEffectManager.js', () => ({ default: mocks.tela }));
vi.mock('Renderer/Effects/Sky.js', () => ({ default: mocks.sky }));
vi.mock('Renderer/Effects/Damage.js', () => ({ default: mocks.livre }));
vi.mock('Preferences/Graphics.js', () => ({ default: {} }));
vi.mock('Preferences/Map.js', () => ({ default: { useFog: true } }));
vi.mock('Utils/gl-matrix.js', () => ({ default: { mat4: {} } }));
vi.mock('Network/PacketVerManager.js', () => ({ default: {} }));
vi.mock('UI/Components/JoystickUI/JoystickUI.js', () => ({ default: { onRestore: vi.fn() } }));
vi.mock('Renderer/Effects/PostProcess.js', () => ({ default: mocks.livre }));
vi.mock('Renderer/Effects/Shaders/Bloom.js', () => ({ default: {} }));
vi.mock('Renderer/Effects/Shaders/VerticalFlip.js', () => ({ default: {} }));
vi.mock('Renderer/Effects/Shaders/GaussianBlur.js', () => ({ default: {} }));
vi.mock('Renderer/Effects/Shaders/CAS.js', () => ({ default: {} }));
vi.mock('Renderer/Effects/Shaders/FXAA.js', () => ({ default: {} }));
vi.mock('Renderer/Effects/Shaders/Vibrance.js', () => ({ default: {} }));
vi.mock('Renderer/Effects/Shaders/Cartoon.js', () => ({ default: {} }));
vi.mock('Renderer/Effects/Shaders/Blind.js', () => ({ default: {} }));
vi.mock('Renderer/Effects/Shaders/Upsampling.js', () => ({ default: {} }));
vi.mock('Utils/WebGL.js', () => ({ default: { detectBadWebGL: vi.fn(() => false) } }));

const { default: MapRenderer } = await import('Renderer/MapRenderer.js');


/** O fim da carga cheia (a arte, depois o worker). */
function terminarCarregamento() {
	const aoCarregar = mocks.estado.aoCarregar;
	mocks.estado.aoCarregar = null;
	aoCarregar();
	const aoTerminar = mocks.estado.aoTerminar;
	mocks.estado.aoTerminar = null;
	aoTerminar(true);
}

describe('a volta quente na cena (D-2576)', () => {
	let onLoadOriginal;

	beforeEach(() => {
		vi.clearAllMocks();
		onLoadOriginal = MapRenderer.onLoad;
		MapRenderer.loading = false;
		MapRenderer.mapaPendente = null;
		MapRenderer.onLoad = vi.fn();
		// A cena que estava na tela antes da queda: o mapa carregou e montou.
		MapRenderer.currentMap = '';
		MapRenderer.setMap('prt_fild08.gat');
		terminarCarregamento();
		vi.clearAllMocks();
		MapRenderer.onLoad = vi.fn();
	});

	afterEach(() => {
		MapRenderer.onLoad = onLoadOriginal;
	});

	it('o mesmo mapa com o nome mantido NAO carrega: sem arte, sem worker, sem liberar o chao', () => {
		MapRenderer.setMap('prt_fild08.gat');
		expect(mocks.background.setLoading, 'abriu a arte de carregamento').not.toHaveBeenCalled();
		expect(mocks.thread.send, 'mandou o worker carregar o mapa').not.toHaveBeenCalled();
		expect(mocks.renderer.remove, 'derrubou o canvas').not.toHaveBeenCalled();
		expect(MapRenderer.loading).toBe(false);
		expect(MapRenderer.currentMap).toBe('prt_fild08.gat');
	});

	it('as entidades saem (o lote do servidor repovoa) e a montagem roda UMA vez (um ACTORINIT)', () => {
		MapRenderer.setMap('prt_fild08.gat');
		expect(mocks.livre.free, 'as entidades velhas ficaram').toHaveBeenCalled();
		expect(MapRenderer.onLoad).toHaveBeenCalledOnce();
		expect(mocks.renderer.render, 'o laco de desenho nao voltou').toHaveBeenCalled();
	});

	it('a extensao diferente (.gat x .rsw) e o mesmo mapa', () => {
		MapRenderer.setMap('prt_fild08.rsw');
		expect(mocks.background.setLoading).not.toHaveBeenCalled();
		expect(MapRenderer.onLoad).toHaveBeenCalledOnce();
	});

	it('OUTRO mapa na volta (morreu no fundo e foi a Prontera) carrega, como sempre', () => {
		MapRenderer.setMap('prontera.gat');
		expect(mocks.background.setLoading).toHaveBeenCalledOnce();
		expect(MapRenderer.loading).toBe(true);
		terminarCarregamento();
		expect(MapRenderer.currentMap).toBe('prontera.gat');
		expect(MapRenderer.onLoad).toHaveBeenCalledOnce();
	});

	it('CONTROLE: com o nome zerado (a volta fria de antes), o MESMO mapa carrega inteiro', () => {
		MapRenderer.currentMap = '';
		MapRenderer.setMap('prt_fild08.gat');
		expect(mocks.background.setLoading).toHaveBeenCalledOnce();
		expect(MapRenderer.loading).toBe(true);
		terminarCarregamento();
		expect(MapRenderer.onLoad).toHaveBeenCalledOnce();
	});
});
