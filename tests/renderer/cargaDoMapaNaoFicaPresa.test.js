/**
 * A CARGA DO MAPA NAO FICA PRESA PARA SEMPRE (D-2055, 06/10/2026 — relatos de
 * producao: "a barra parou em 2% e nunca termina", sobretudo no celular).
 *
 * Antes desta entrega uma carga sem resposta do worker deixava a arte de
 * carregamento na tela para sempre (nenhuma saida), e a carga que FALHAVA abria
 * uma caixa de erro por cima da arte e deixava `currentMap` com o mapa que
 * falhou - o proximo pedido do mesmo mapa caia no ramo do teleporte no mesmo
 * mapa e mandava o estou-pronto sem mapa. Os casos abaixo reprovavam todos.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	const estado = { hooks: {}, envios: [], aoCarregar: null };
	return {
		estado,
		thread: {
			hook: vi.fn((tipo, fn) => {
				estado.hooks[tipo] = fn;
			}),
			send: vi.fn((tipo, dado, cb) => {
				estado.envios.push({ tipo, dado, cb });
			})
		},
		background: {
			remove: vi.fn(cb => cb()),
			setLoading: vi.fn(cb => cb()),
			setPercent: vi.fn()
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
		ui: { removeComponents: vi.fn(), showErrorBox: vi.fn(() => ({ ui: { css: vi.fn() } })) },
		recarga: { recarregarMantendoASessao: vi.fn() }
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
vi.mock('UI/recargaMantendoASessao.js', () => mocks.recarga);

const { default: MapRenderer } = await import('Renderer/MapRenderer.js');
const { SEM_SINAL_MAXIMO_MS, AVISO_DE_LENTIDAO_MS } = await import('UI/saidaDoCarregamento.js');
const relato = await import('Renderer/relatoDoCarregamento.js');

const saida = () => document.querySelector('.rag-carga-saida');
const aviso = () => document.querySelector('.rag-carga-aviso');
const botao = acao => saida().querySelector(`[data-acao="${acao}"]`);
const ultimoEnvio = () => mocks.estado.envios[mocks.estado.envios.length - 1];

/** Uma mensagem do worker, como o `Thread.receive` a entrega ao gancho. */
function doWorker(tipo, dado, carga) {
	mocks.estado.hooks[tipo](dado, { type: tipo, data: dado, carga });
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.clearAllMocks();
	mocks.estado.hooks = {};
	mocks.estado.envios = [];
	MapRenderer.loading = false;
	MapRenderer.mapaPendente = null;
	MapRenderer.currentMap = '';
	MapRenderer.onLoad = vi.fn();
	relato.zerarParaTeste();
	vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true })));
});

afterEach(() => {
	// Fecha qualquer carga aberta e tira as pecas do DOM entre um caso e outro.
	const envio = ultimoEnvio();
	if (MapRenderer.loading && envio) envio.cb(true, null, envio.dado, {});
	document.querySelectorAll('.rag-carga-saida, .rag-carga-aviso').forEach(n => n.remove());
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('a carga do mapa que nao anda (D-2055)', () => {
	it('o pedido ao worker leva o numero da carga', () => {
		MapRenderer.setMap('glast_01.gat');
		expect(ultimoEnvio().tipo).toBe('LOAD_MAP');
		expect(ultimoEnvio().dado).toEqual({ filename: 'glast_01.rsw', carga: expect.any(Number) });
	});

	it('sem nada do worker, a saida aparece no prazo - e nao antes', async () => {
		MapRenderer.setMap('glast_01.gat');
		await vi.advanceTimersByTimeAsync(SEM_SINAL_MAXIMO_MS - 1);
		expect(saida()).toBeNull();
		await vi.advanceTimersByTimeAsync(1);
		expect(saida()).not.toBeNull();
		expect(botao('tentar').textContent).toBe('Tentar de novo');
		expect(botao('recarregar').textContent).toBe('Recarregar o jogo');
	});

	it('a barra em 2% com bytes chegando NAO oferece a saida, e o aviso diz quanto ja chegou', async () => {
		MapRenderer.setMap('glast_01.gat');
		const { carga } = ultimoEnvio().dado;
		doWorker('MAP_PROGRESS', 2, carga);
		for (let i = 1; i <= 9; i++) {
			await vi.advanceTimersByTimeAsync(10000);
			doWorker('MAP_ATIVIDADE', { arquivo: 'data\\glast_01.gnd', recebidos: i * 600000, total: 5372510 }, carga);
		}
		expect(saida(), '90 s de bytes chegando nao e carga parada').toBeNull();
		expect(aviso()).not.toBeNull();
		expect(aviso().textContent).toBe('Baixando o mapa: 5,1 de 5,1 MB');
	});

	it('a nova tentativa sozinha NAO segura a saida (ela e o sistema tentando, e nao o mapa andando)', async () => {
		MapRenderer.setMap('glast_01.gat');
		const { carga } = ultimoEnvio().dado;
		await vi.advanceTimersByTimeAsync(16000);
		doWorker('MAP_ATIVIDADE', { arquivo: 'data\\glast_01.gnd', tentativa: 1 }, carga);
		expect(aviso().textContent).toBe('A conexão falhou; tentando de novo (1 de 3)');
		await vi.advanceTimersByTimeAsync(SEM_SINAL_MAXIMO_MS - 16000);
		expect(saida()).not.toBeNull();
	});

	it('o aviso so aparece com a barra parada', async () => {
		MapRenderer.setMap('prontera.gat');
		const { carga } = ultimoEnvio().dado;
		for (let p = 1; p <= 10; p++) {
			await vi.advanceTimersByTimeAsync(AVISO_DE_LENTIDAO_MS - 1);
			expect(aviso(), 'o aviso apareceu com a barra andando').toBeNull();
			doWorker('MAP_PROGRESS', p, carga);
		}
		expect(aviso()).toBeNull();
	});

	it('"Tentar de novo" refaz a carga com outro numero, e a carga velha nao fala mais', async () => {
		MapRenderer.setMap('glast_01.gat');
		const velha = ultimoEnvio();
		await vi.advanceTimersByTimeAsync(SEM_SINAL_MAXIMO_MS);
		botao('tentar').click();
		expect(saida()).toBeNull();
		const nova = ultimoEnvio();
		expect(nova).not.toBe(velha);
		expect(nova.dado.filename).toBe('glast_01.rsw');
		expect(nova.dado.carga).toBeGreaterThan(velha.dado.carga);
		expect(MapRenderer.loading).toBe(true);
		expect(MapRenderer.currentMap).toBe('glast_01.gat');
		// A carga velha termina tarde: descartada, sem montar nada.
		mocks.background.setPercent.mockClear();
		doWorker('MAP_PROGRESS', 50, velha.dado.carga);
		expect(mocks.background.setPercent).not.toHaveBeenCalled();
		velha.cb(true, null, velha.dado, {});
		expect(MapRenderer.onLoad).not.toHaveBeenCalled();
		expect(MapRenderer.loading).toBe(true);
		// A nova termina e monta uma vez.
		nova.cb(true, null, nova.dado, {});
		expect(MapRenderer.onLoad).toHaveBeenCalledOnce();
		expect(MapRenderer.loading).toBe(false);
	});

	it('a carga que se recupera sozinha depois da saida aberta fecha a saida', async () => {
		MapRenderer.setMap('glast_01.gat');
		const { carga } = ultimoEnvio().dado;
		await vi.advanceTimersByTimeAsync(SEM_SINAL_MAXIMO_MS);
		expect(saida()).not.toBeNull();
		doWorker('MAP_PROGRESS', 3, carga);
		expect(saida()).toBeNull();
	});

	it('o mapa que carrega tira o aviso e a saida', async () => {
		MapRenderer.setMap('glast_01.gat');
		const envio = ultimoEnvio();
		await vi.advanceTimersByTimeAsync(SEM_SINAL_MAXIMO_MS);
		envio.cb(true, null, envio.dado, {});
		expect(saida()).toBeNull();
		expect(aviso()).toBeNull();
	});
});

describe('a carga que FALHA (D-2055)', () => {
	it('abre a saida com o erro, sem a caixa de erro presa por cima da arte', () => {
		MapRenderer.setMap('glast_01.gat');
		const envio = ultimoEnvio();
		envio.cb(false, 'Can\'t find file "glast_01.gnd" !', envio.dado, {});
		expect(mocks.ui.showErrorBox).not.toHaveBeenCalled();
		expect(saida()).not.toBeNull();
		expect(saida().textContent).toContain('glast_01.gnd');
		expect(MapRenderer.loading).toBe(false);
	});

	it('"Tentar de novo" depois da falha CARREGA o mapa (e nao finge um teleporte no mesmo mapa)', () => {
		MapRenderer.setMap('glast_01.gat');
		const envio = ultimoEnvio();
		envio.cb(false, 'erro', envio.dado, {});
		expect(MapRenderer.currentMap).toBe('');
		botao('tentar').click();
		expect(mocks.background.setLoading).toHaveBeenCalledTimes(2);
		expect(ultimoEnvio()).not.toBe(envio);
		expect(MapRenderer.onLoad, 'o estou-pronto sem mapa').not.toHaveBeenCalled();
	});

	it('o servidor pedindo o MESMO mapa depois da falha tambem carrega', () => {
		MapRenderer.setMap('glast_01.gat');
		const envio = ultimoEnvio();
		envio.cb(false, 'erro', envio.dado, {});
		MapRenderer.setMap('glast_01.gat');
		expect(mocks.background.setLoading).toHaveBeenCalledTimes(2);
		expect(MapRenderer.onLoad).not.toHaveBeenCalled();
	});

	it('"Recarregar o jogo" recarrega pela retomada e relata a desistencia', async () => {
		MapRenderer.setMap('glast_01.gat');
		await vi.advanceTimersByTimeAsync(SEM_SINAL_MAXIMO_MS);
		botao('recarregar').click();
		await vi.advanceTimersByTimeAsync(0);
		expect(mocks.recarga.recarregarMantendoASessao).toHaveBeenCalledOnce();
		const corpos = fetch.mock.calls.map(c => JSON.parse(c[1].body));
		expect(corpos).toHaveLength(1);
		expect(corpos[0]).toMatchObject({ mapa: 'glast_01', desfecho: 'recarregou', travou: true });
		expect(botao('tentar').disabled).toBe(true);
	});

	it('a mensagem ilegivel do worker (messageerror) derruba a carga NA HORA, e a carga velha nao monta depois (A3)', () => {
		MapRenderer.setMap('glast_01.gat');
		const envio = ultimoEnvio();
		mocks.estado.hooks.THREAD_FALHOU({ tipo: 'messageerror', mensagem: '' });
		expect(saida()).not.toBeNull();
		expect(MapRenderer.loading).toBe(false);
		expect(mocks.estado.envios.some(e => e.tipo === 'CANCEL_MAP')).toBe(true);
		envio.cb(true, null, envio.dado, {});
		expect(MapRenderer.onLoad, 'a carga abandonada montou depois').not.toHaveBeenCalled();
	});

	it('o erro solto no worker so e relatado: a carga segue (a vigia cuida dela)', () => {
		MapRenderer.setMap('glast_01.gat');
		mocks.estado.hooks.THREAD_FALHOU({ tipo: 'error', mensagem: 'x' });
		expect(saida()).toBeNull();
		expect(MapRenderer.loading).toBe(true);
	});
});

