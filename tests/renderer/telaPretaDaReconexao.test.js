/**
 * A TELA PRETA DEPOIS DA ECONOMIA DE ENERGIA (16/09/2026).
 *
 * Relato do dono, com print: so o cursor sobre preto, depois de voltar do modo
 * de economia. Reproduzido no navegador por
 * `scripts/diag-tela-preta-da-economia.ts --quedas=2` (repositorio do
 * servidor): com a aba oculta o carregamento do mapa espera um quadro, a
 * SEGUNDA reconexao zerava `MapRenderer.currentMap` por cima dele, e na volta
 * o carregamento terminava com o nome vazio — o `Navigation` lancava dentro da
 * transicao e o veu preto do `Background` ficava opaco.
 *
 * Este arquivo prende as quatro pecas do conserto:
 *   1. o pedido que chega durante o carregamento e GUARDADO e atendido no fim;
 *   2. a montagem que lanca nao impede o jogo de aparecer (comportamento);
 *   3. a reconexao nao zera o nome com carregamento em curso (fonte);
 *   4. o veu sai mesmo que o callback da transicao lance (fonte).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

/** O quadro que a aba oculta segura: o fade termina e o worker devolve o mapa. */
function terminarCarregamento(sucesso = true) {
	const aoCarregar = mocks.estado.aoCarregar;
	mocks.estado.aoCarregar = null;
	aoCarregar();
	const aoTerminar = mocks.estado.aoTerminar;
	mocks.estado.aoTerminar = null;
	aoTerminar(sucesso, 'erro de teste');
}

describe('o pedido de mapa durante um carregamento (16/09/2026)', () => {
	let onLoadOriginal;

	beforeEach(() => {
		vi.clearAllMocks();
		onLoadOriginal = MapRenderer.onLoad;
		MapRenderer.loading = false;
		MapRenderer.mapaPendente = null;
		MapRenderer.currentMap = '';
		MapRenderer.onLoad = vi.fn();
	});

	afterEach(() => {
		MapRenderer.onLoad = onLoadOriginal;
	});

	it('o mesmo mapa pedido de novo nao recarrega nem perde o nome', () => {
		MapRenderer.setMap('prontera.gat');
		MapRenderer.setMap('prontera.gat');
		expect(mocks.background.setLoading).toHaveBeenCalledOnce();
		terminarCarregamento();
		expect(MapRenderer.currentMap).toBe('prontera.gat');
		expect(MapRenderer.loading).toBe(false);
		expect(MapRenderer.mapaPendente).toBeNull();
		expect(mocks.renderer.show).toHaveBeenCalledOnce();
		// Montar de novo reabriria a HUD e reenviaria o ACTORINIT ao servidor.
		expect(MapRenderer.onLoad).toHaveBeenCalledOnce();
		expect(mocks.ui.removeComponents).toHaveBeenCalledOnce();
	});

	it('OUTRO mapa pedido durante o carregamento carrega depois, e nao some', () => {
		MapRenderer.setMap('prontera.gat');
		MapRenderer.setMap('gef_fild10.gat');
		expect(MapRenderer.currentMap, 'o carregamento em curso segue com o nome dele').toBe('prontera.gat');
		terminarCarregamento();
		expect(mocks.background.setLoading).toHaveBeenCalledTimes(2);
		expect(MapRenderer.currentMap).toBe('gef_fild10.gat');
		expect(MapRenderer.loading).toBe(true);
	});

	it('o ultimo pedido vence', () => {
		MapRenderer.setMap('prontera.gat');
		MapRenderer.setMap('gef_fild10.gat');
		MapRenderer.setMap('pay_fild01.gat');
		terminarCarregamento();
		expect(MapRenderer.currentMap).toBe('pay_fild01.gat');
	});

	/*
	 * H08 (auditoria 2 de 22/09/2026). O `onLoad` pendurado no fim do
	 * carregamento ja e o do pacote MAIS NOVO (o `MapEngine` o troca a cada
	 * `onMapChange`), e ele manda o `CZ_NOTIFY_ACTORINIT`. Rodado sobre o mapa
	 * que vai ser descartado, o servidor desce o lote do mapa novo e zera o
	 * `carregandoMapa`; o `setMap` pendente apaga essas entidades, e o segundo
	 * ACTORINIT nao traz lote nenhum (fiel ao rAthena). O mapa ficava vazio.
	 */
	it('OUTRO mapa pendente: o mapa que vai ser descartado nao monta nem avisa o servidor (H08)', () => {
		MapRenderer.setMap('prontera.gat');
		MapRenderer.setMap('gef_fild10.gat');
		terminarCarregamento();
		expect(MapRenderer.onLoad, 'o estou-pronto saiu para um mapa que o cliente vai descartar').not.toHaveBeenCalled();
		expect(MapRenderer.currentMap).toBe('gef_fild10.gat');
		terminarCarregamento();
		expect(MapRenderer.onLoad, 'o mapa pendente monta uma vez, e so ele').toHaveBeenCalledOnce();
		expect(MapRenderer.loading).toBe(false);
		expect(mocks.renderer.show, 'o jogo aparece no mapa de verdade').toHaveBeenCalled();
	});

	it('varios pedidos durante um carregamento: um ACTORINIT so, o do ultimo mapa (H08)', () => {
		MapRenderer.setMap('prontera.gat');
		MapRenderer.setMap('gef_fild10.gat');
		MapRenderer.setMap('pay_fild01.gat');
		terminarCarregamento();
		terminarCarregamento();
		expect(MapRenderer.onLoad).toHaveBeenCalledOnce();
		expect(MapRenderer.currentMap).toBe('pay_fild01.gat');
	});

	it('o carregamento que FALHA tambem atende o pedido guardado', () => {
		MapRenderer.setMap('prontera.gat');
		MapRenderer.setMap('gef_fild10.gat');
		terminarCarregamento(false);
		expect(MapRenderer.currentMap).toBe('gef_fild10.gat');
	});

	it('a montagem que LANCA nao impede o jogo de aparecer', () => {
		const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
		MapRenderer.onLoad = vi.fn(() => {
			throw new TypeError("Cannot read properties of undefined (reading 'replace')");
		});
		MapRenderer.setMap('prontera.gat');
		expect(() => terminarCarregamento()).not.toThrow();
		expect(mocks.renderer.show).toHaveBeenCalledOnce();
		expect(mocks.renderer.render).toHaveBeenCalled();
		expect(MapRenderer.loading).toBe(false);
		expect(erro).toHaveBeenCalled();
		erro.mockRestore();
	});
});

describe('as duas costuras que so o fonte mostra (16/09/2026)', () => {
	const ler = caminho => readFileSync(join(process.cwd(), 'src', caminho), 'utf8');

	it('a reconexao so zera o nome do mapa sem carregamento em curso', () => {
		const fonte = ler('Engine/MapEngine.js');
		expect(fonte).toMatch(/if \(!MapRenderer\.loading\) \{\r?\n\t+MapRenderer\.currentMap = '';/);
		expect(fonte, 'o zero incondicional voltou').not.toMatch(/\/\/ Force reloading map\r?\n\t+MapRenderer\.currentMap = '';/);
	});

	it('o veu do Background sai num finally, depois do callback', () => {
		const fonte = ler('UI/Background.js');
		const i = fonte.indexOf('function transition(callback)');
		const corpo = fonte.slice(i, i + 1500);
		expect(corpo).toMatch(/try \{\r?\n\t+callback\(\);\r?\n\t+\} finally \{\r?\n\t+_overlayAnim = animateElement\(_overlay, \{ opacity: 0\.01 \}/);
	});

	it('o Navigation recusa mapa sem nome em vez de lancar', () => {
		const fonte = ler('UI/Components/Navigation/Navigation.js');
		const i = fonte.indexOf('Navigation.loadMap = function loadMap(');
		const corpo = fonte.slice(i, i + 600);
		expect(corpo.indexOf("if (typeof mapName !== 'string' || mapName === '')")).toBeGreaterThan(-1);
		expect(corpo.indexOf("if (typeof mapName !== 'string'")).toBeLessThan(corpo.indexOf('mapName.replace('));
	});
});
