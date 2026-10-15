/**
 * O BGM QUE O NAVEGADOR BARROU VOLTA NO PRIMEIRO GESTO (relato J12, 15/10/2026). A peca pura e a costura no `BGM`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ preferencias: { BGM: { play: true, volume: 0.5 }, save: () => {} } }));
vi.mock('Core/Client.js', () => ({ default: { loadFile: (_nome, pronto) => pronto('blob:bgm') } }));
vi.mock('Preferences/Audio.js', () => ({ default: mocks.preferencias }));

const { armarRetomadaNoGesto, ehBloqueioDeAutoplay, GESTOS_DO_JOGADOR } = await import('../../src/Audio/retomadaDoBGM.js');
const { default: BGM } = await import('../../src/Audio/BGM.js');

const barrado = () => Object.assign(new Error('play() failed because the user did not interact'), { name: 'NotAllowedError' });
const esperar = () => new Promise(r => setTimeout(r, 0));

describe('armarRetomadaNoGesto (J12)', () => {
	it('RB1 o primeiro gesto toca, uma vez so', () => {
		const alvo = new EventTarget();
		const tocar = vi.fn();
		armarRetomadaNoGesto(alvo, tocar);
		alvo.dispatchEvent(new Event('pointerdown'));
		alvo.dispatchEvent(new Event('keydown'));
		expect(tocar).toHaveBeenCalledTimes(1);
	});

	it('RB2 cada gesto do jogador serve (clique, tecla, toque)', () => {
		for (const gesto of GESTOS_DO_JOGADOR) {
			const alvo = new EventTarget();
			const tocar = vi.fn();
			armarRetomadaNoGesto(alvo, tocar);
			alvo.dispatchEvent(new Event(gesto));
			expect(tocar, gesto).toHaveBeenCalledTimes(1);
		}
		expect(GESTOS_DO_JOGADOR).toEqual(['pointerdown', 'keydown', 'touchend']);
	});

	it('RB3 desarmada antes do gesto, nao toca; movimento do mouse nao e gesto', () => {
		const alvo = new EventTarget();
		const tocar = vi.fn();
		const desarmar = armarRetomadaNoGesto(alvo, tocar);
		alvo.dispatchEvent(new Event('mousemove'));
		desarmar();
		alvo.dispatchEvent(new Event('pointerdown'));
		expect(tocar).not.toHaveBeenCalled();
	});

	it('RB4 so a politica de autoplay arma: arquivo ausente ou troca de faixa no meio nao', () => {
		expect(ehBloqueioDeAutoplay(barrado())).toBe(true);
		expect(ehBloqueioDeAutoplay(Object.assign(new Error('x'), { name: 'AbortError' }))).toBe(false);
		expect(ehBloqueioDeAutoplay(Object.assign(new Error('x'), { name: 'NotSupportedError' }))).toBe(false);
		expect(ehBloqueioDeAutoplay(null)).toBe(false);
	});
});

describe('o BGM barrado toca no primeiro gesto (J12)', () => {
	let chamadas;

	beforeEach(() => {
		mocks.preferencias.BGM.play = true;
		chamadas = 0;
		// A primeira chamada e barrada pela politica; as seguintes tocam.
		BGM.audio.play = vi.fn(() => {
			chamadas += 1;
			if (chamadas === 1) {
				return Promise.reject(barrado());
			}
			Object.defineProperty(BGM.audio, 'paused', { value: false, configurable: true });
			return Promise.resolve();
		});
		BGM.audio.pause = vi.fn(() => Object.defineProperty(BGM.audio, 'paused', { value: true, configurable: true }));
		Object.defineProperty(BGM.audio, 'paused', { value: true, configurable: true });
		BGM.filename = null;
	});

	afterEach(() => {
		BGM.stop();
	});

	it('RB5 a musica de Prontera entra sem gesto (a retomada D-997), e o primeiro clique a toca', async () => {
		BGM.play('210.mp3');
		await esperar();
		expect(BGM.audio.play).toHaveBeenCalledTimes(1);
		document.dispatchEvent(new Event('pointerdown'));
		await esperar();
		expect(BGM.audio.play).toHaveBeenCalledTimes(2);
		expect(BGM.audio.paused).toBe(false);
		// Um segundo clique nao chama de novo.
		document.dispatchEvent(new Event('pointerdown'));
		expect(BGM.audio.play).toHaveBeenCalledTimes(2);
	});

	it('RB6 parada de proposito (troca de mapa), o clique nao a traz de volta', async () => {
		BGM.play('210.mp3');
		await esperar();
		BGM.stop();
		document.dispatchEvent(new Event('pointerdown'));
		await esperar();
		expect(BGM.audio.play).toHaveBeenCalledTimes(1);
	});

	it('RB7 com o BGM desligado nas opcoes, o clique nao toca', async () => {
		BGM.play('210.mp3');
		await esperar();
		mocks.preferencias.BGM.play = false;
		document.dispatchEvent(new Event('keydown'));
		await esperar();
		expect(BGM.audio.play).toHaveBeenCalledTimes(1);
	});
});
