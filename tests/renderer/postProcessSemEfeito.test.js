/**
 * Sem efeito ligado, o pos-processamento nao aloca os dois FBOs do tamanho do
 * canvas (13/09/2026, auditoria do iPhone: ~36 MB de GPU em DPR 3).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('Preferences/Graphics.js', () => ({ default: { performanceMode: false } }));

/** Um contexto WebGL falso: toda chamada e contada, todo objeto e "valido". */
function glFalso() {
	const chamadas = {};
	const alvo = { canvas: { width: 1179, height: 2556 }, chamadas };
	return new Proxy(alvo, {
		get(t, prop) {
			if (prop in t) {
				return t[prop];
			}
			if (typeof prop === 'string' && /^[A-Z_0-9]+$/.test(prop)) {
				return 0;
			}
			return (...args) => {
				chamadas[prop] = (chamadas[prop] || 0) + 1;
				if (prop.startsWith('is')) {
					return true;
				}
				if (prop === 'checkFramebufferStatus') {
					return 0;
				}
				return { args };
			};
		}
	});
}

async function posProcessoNovo() {
	vi.resetModules();
	return (await import('Renderer/Effects/PostProcess.js')).default;
}

function efeito(ligado) {
	return {
		ligado,
		program: {},
		isActive() {
			return this.ligado;
		},
		init() {},
		render() {},
		clean() {}
	};
}

describe('PostProcess sem efeito ligado', () => {
	let gl;
	beforeEach(() => {
		gl = glFalso();
	});

	it('todo efeito desligado (o padrao): nenhum framebuffer e criado', async () => {
		const Pos = await posProcessoNovo();
		Pos.register(efeito(false), gl);
		for (let i = 0; i < 5; i++) {
			Pos.prepare(gl);
		}
		Pos.recreateFbo(gl, 1179, 2556);
		expect(gl.chamadas.createFramebuffer || 0).toBe(0);
	});

	it('com um efeito ligado os dois buffers existem', async () => {
		const Pos = await posProcessoNovo();
		Pos.register(efeito(true), gl);
		Pos.prepare(gl);
		expect(gl.chamadas.createFramebuffer).toBe(2);
	});

	it('desligar o ultimo efeito devolve os buffers a GPU', async () => {
		const Pos = await posProcessoNovo();
		const e = efeito(true);
		Pos.register(e, gl);
		Pos.prepare(gl);
		e.ligado = false;
		Pos.prepare(gl);
		expect(gl.chamadas.deleteFramebuffer).toBe(2);
		expect(gl.chamadas.deleteTexture).toBe(2);
	});
});
