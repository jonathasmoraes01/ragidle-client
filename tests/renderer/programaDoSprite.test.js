/**
 * O PROGRAMA DO SPRITE TEM RESERVA (06/10/2026, D-2048).
 *
 * Os sprites sumiam no PowerVR BXM-8-256 (moto g54, Poco M7 Pro). Sem o
 * aparelho nao se prova a causa exata, entao o conserto e uma cascata: a
 * primeira variante que compila, linka e desenha na sonda fica valendo, e
 * NADA lanca. Ver `src/Renderer/programaDoSprite.js`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import glMatrix from 'Utils/gl-matrix.js';
import {
	escolherProgramaDoSprite,
	lerChaveDeReserva,
	ordemDasVariantes,
	caiNaRegraDoPowerVR,
	resumoDaSonda,
	CHAVES_DE_RESERVA,
	CHAVE_DE_ARMAZENAMENTO,
	precisaRelatar,
	mensagemDoRelato,
	detalheDoRelato,
	descreverGpu,
	guardarEscolhaDoSprite,
	relatarEscolhaDoSprite
} from 'Renderer/programaDoSprite.js';
import { compileShader } from 'Utils/WebGL.js';
import { matrizesDaSonda, avaliarPixels, CORES_DOS_CASOS, FUNDO, PIXELS_MINIMOS } from 'Renderer/sondaDoSprite.js';

const mat4 = glMatrix.mat4;

const VARIANTES = [
	{ nome: 'principal', vs: 'VS-P', fs: 'FS' },
	{ nome: 'sem-correcao', vs: 'VS-S', fs: 'FS' },
	{ nome: 'minima', vs: 'VS-M', fs: 'FS-M' }
];

/** O erro como o `WebGL.compileShader` o lanca no aparelho do defeito. */
function erroDoPowerVR() {
	const e = new Error('WebGL::CompileShader() - Fail to compile Vertex shader: null');
	e.etapaDoShader = 'compilar-vertex';
	e.logDoShader = null;
	e.contextoPerdido = false;
	return e;
}

/** Cria programas falsos; `quebrados` diz quais VS lancam. */
function fabrica(quebrados = []) {
	const criados = [];
	const criarPrograma = vi.fn((gl, vs) => {
		if (quebrados.includes(vs)) throw erroDoPowerVR();
		const p = { vs };
		criados.push(p);
		return p;
	});
	return { criarPrograma, criados };
}

describe('a cascata do programa do sprite', () => {
	it('o principal que compila e desenha fica valendo, sem falha registrada', () => {
		const { criarPrograma } = fabrica();
		const r = escolherProgramaDoSprite({}, { variantes: VARIANTES, criarPrograma, sondar: () => ({ desenhou: true }) });
		expect(r.variante).toBe('principal');
		expect(r.programa.vs).toBe('VS-P');
		expect(r.falhas).toEqual([]);
		expect(criarPrograma).toHaveBeenCalledTimes(1);
	});

	it('o principal que nao compila cai na sem-correcao, e o log null fica CRU', () => {
		const { criarPrograma } = fabrica(['VS-P']);
		let r;
		expect(() => {
			r = escolherProgramaDoSprite({}, { variantes: VARIANTES, criarPrograma, sondar: () => ({ desenhou: true }) });
		}).not.toThrow();
		expect(r.variante).toBe('sem-correcao');
		expect(r.programa.vs).toBe('VS-S');
		expect(r.falhas).toEqual([{ variante: 'principal', etapa: 'compilar-vertex', log: null, contextoPerdido: false }]);
	});

	it('principal e sem-correcao quebrados: a minima', () => {
		const { criarPrograma } = fabrica(['VS-P', 'VS-S']);
		const r = escolherProgramaDoSprite({}, { variantes: VARIANTES, criarPrograma });
		expect(r.variante).toBe('minima');
		expect(r.falhas.map(f => f.variante)).toEqual(['principal', 'sem-correcao']);
	});

	it('nenhuma compila: programa null, tres falhas, e nada lanca', () => {
		const { criarPrograma } = fabrica(['VS-P', 'VS-S', 'VS-M']);
		const r = escolherProgramaDoSprite({}, { variantes: VARIANTES, criarPrograma });
		expect(r.programa).toBeNull();
		expect(r.variante).toBeNull();
		expect(r.falhas).toHaveLength(3);
	});

	it('o principal que compila mas NAO desenha cede a vez, e e apagado', () => {
		const { criarPrograma } = fabrica();
		const apagarPrograma = vi.fn();
		const sondar = (gl, p) => ({ desenhou: p.vs !== 'VS-P' });
		const r = escolherProgramaDoSprite({}, { variantes: VARIANTES, criarPrograma, sondar, apagarPrograma });
		expect(r.variante).toBe('sem-correcao');
		expect(r.falhas).toEqual([{ variante: 'principal', etapa: 'sonda', log: 'reprovou()', contextoPerdido: null }]);
		expect(apagarPrograma).toHaveBeenCalledTimes(1);
		expect(apagarPrograma.mock.calls[0][1].vs).toBe('VS-P');
	});

	it('se NENHUMA desenha na sonda, fica a primeira que compilou (a sonda nao rebaixa sozinha)', () => {
		const { criarPrograma } = fabrica();
		const apagarPrograma = vi.fn();
		const r = escolherProgramaDoSprite({}, {
			variantes: VARIANTES,
			criarPrograma,
			sondar: () => ({ desenhou: false }),
			apagarPrograma
		});
		expect(r.variante).toBe('principal');
		expect(r.programa.vs).toBe('VS-P');
		expect(apagarPrograma.mock.calls.map(c => c[1].vs)).toEqual(['VS-S', 'VS-M']);
	});

	it('sonda que lanca ou nao sabe ACEITA a variante', () => {
		const { criarPrograma } = fabrica();
		const lancando = escolherProgramaDoSprite({}, {
			variantes: VARIANTES,
			criarPrograma,
			// so a sonda do principal lanca; as reservas desenhariam. Se "lancou"
			// virasse "nao desenhou", a sem-correcao tomaria o lugar.
			sondar: (gl, p) => {
				if (p.vs === 'VS-P') throw new Error('readPixels');
				return { desenhou: true };
			}
		});
		expect(lancando.variante).toBe('principal');
		expect(lancando.falhas).toEqual([]);
		const semSaber = escolherProgramaDoSprite({}, { variantes: VARIANTES, criarPrograma, sondar: () => ({ desenhou: null }) });
		expect(semSaber.variante).toBe('principal');
	});

	it('a chave CONFIA na primeira: fica com ela mesmo se a sonda reprovar (o jogador testa o que ela desenha)', () => {
		const { criarPrograma } = fabrica();
		const r = escolherProgramaDoSprite({}, {
			variantes: VARIANTES,
			criarPrograma,
			// so a primeira reprova: sem a confianca, a sem-correcao tomaria o lugar
			sondar: (gl, p) => ({ desenhou: p.vs !== 'VS-P' }),
			confiarNaPrimeira: true
		});
		expect(r.variante).toBe('principal');
		expect(r.sondas.principal).toEqual({ desenhou: false });
	});

	it('a chave cuja variante nao compila cai na proxima, pela sonda', () => {
		const { criarPrograma } = fabrica(['VS-P']);
		const sondar = (gl, p) => ({ desenhou: p.vs === 'VS-M' });
		const r = escolherProgramaDoSprite({}, { variantes: VARIANTES, criarPrograma, sondar, confiarNaPrimeira: true });
		expect(r.variante).toBe('minima');
	});
});

describe('a chave ?forcarSpriteReserva e GUARDADA (D-2054)', () => {
	function armazenamentoFalso(inicial = {}) {
		const dados = { ...inicial };
		return {
			dados,
			getItem: k => (k in dados ? dados[k] : null),
			setItem: (k, v) => {
				dados[k] = String(v);
			},
			removeItem: k => {
				delete dados[k];
			}
		};
	}

	it.each([
		['', 0, null],
		['?x=1', 0, null],
		['?forcarSpriteReserva=1', 1, 'chave-url'],
		['?forcarSpriteReserva=2', 2, 'chave-url'],
		['?a=b&forcarSpriteReserva=5', 5, 'chave-url'],
		['?forcarSpriteReserva=sim', 1, 'chave-url'],
		['?forcarSpriteReserva=9', 9, 'chave-url'],
		['?forcarSpriteReserva=7', 0, null],
		['?forcarSpriteReserva=-4', 0, null]
	])('%s -> chave %i (%s)', (busca, chave, origem) => {
		const r = lerChaveDeReserva(busca, armazenamentoFalso());
		expect(r.chave).toBe(chave);
		expect(r.origem).toBe(origem);
	});

	it('a chave da URL fica guardada e vale na proxima abertura sem a chave', () => {
		const a = armazenamentoFalso();
		expect(lerChaveDeReserva('?forcarSpriteReserva=2', a)).toEqual({ chave: 2, origem: 'chave-url', limpou: false });
		expect(a.dados[CHAVE_DE_ARMAZENAMENTO]).toBe('2');
		expect(lerChaveDeReserva('', a)).toEqual({ chave: 2, origem: 'chave-guardada', limpou: false });
		expect(lerChaveDeReserva('?forcarSpriteReserva=4', a).chave).toBe(4);
		expect(lerChaveDeReserva('', a).chave).toBe(4);
	});

	it('=0 limpa, e a abertura seguinte volta a escolha automatica', () => {
		const a = armazenamentoFalso({ [CHAVE_DE_ARMAZENAMENTO]: '2' });
		expect(lerChaveDeReserva('?forcarSpriteReserva=0', a)).toEqual({ chave: 0, origem: null, limpou: true });
		expect(CHAVE_DE_ARMAZENAMENTO in a.dados).toBe(false);
		expect(lerChaveDeReserva('', a).chave).toBe(0);
	});

	it('=9 (sem programa) vale so nesta abertura: nunca e guardada', () => {
		const a = armazenamentoFalso({ [CHAVE_DE_ARMAZENAMENTO]: '2' });
		expect(lerChaveDeReserva('?forcarSpriteReserva=9', a).chave).toBe(9);
		expect(a.dados[CHAVE_DE_ARMAZENAMENTO]).toBe('2');
		expect(lerChaveDeReserva('', armazenamentoFalso({ [CHAVE_DE_ARMAZENAMENTO]: '9' })).chave).toBe(0);
	});

	it('sem armazenamento, ou com um que lanca, a chave da URL ainda vale e nada sobe', () => {
		const lanca = {
			getItem: () => {
				throw new Error('SecurityError');
			},
			setItem: () => {
				throw new Error('QuotaExceeded');
			},
			removeItem: () => {
				throw new Error('SecurityError');
			}
		};
		expect(lerChaveDeReserva('?forcarSpriteReserva=2', lanca).chave).toBe(2);
		expect(lerChaveDeReserva('', lanca).chave).toBe(0);
		expect(lerChaveDeReserva('?forcarSpriteReserva=0', lanca).limpou).toBe(true);
		expect(lerChaveDeReserva('?forcarSpriteReserva=3', null).chave).toBe(3);
		expect(lerChaveDeReserva('', null).chave).toBe(0);
	});
});

describe('a ordem: chave, regra do PowerVR B-Series ou sonda (D-2054)', () => {
	const TODAS = ['principal', 'sem-correcao', 'minima', 'sem-funcao', 'sem-bool', 'fs-minimo', 'vs-minimo'].map(nome => ({ nome }));
	const nomes = plano => plano.ordem.map(v => v.nome);
	const BXM = 'ANGLE (Imagination Technologies, PowerVR B-Series BXM-8-256, OpenGL ES 3.2)';

	it.each([
		[BXM, true],
		['PowerVR B-Series BXE-4-32', true],
		['ANGLE (Imagination Technologies, PowerVR B-Series BXS-4-64, Vulkan 1.3)', true],
		['powervr b-series bxm-8-256', true],
		['ANGLE (Imagination Technologies, PowerVR Rogue GE8320, OpenGL ES 3.2)', false],
		['PowerVR Rogue GM9446', false],
		['ANGLE (ARM, Mali-G57 MC2, OpenGL ES 3.2)', false],
		['ANGLE (Qualcomm, Adreno (TM) 610, OpenGL ES 3.2)', false],
		['', false]
	])('%s -> regra %s', (renderizador, cai) => {
		expect(caiNaRegraDoPowerVR(renderizador)).toBe(cai);
	});

	it('sem chave e fora da regra: principal, sem-correcao, minima, pela sonda', () => {
		const p = ordemDasVariantes(TODAS, { chave: 0, renderizador: 'Mali-G57' });
		expect(nomes(p)).toEqual(['principal', 'sem-correcao', 'minima']);
		expect(p.origem).toBe('sonda');
		expect(p.confiarNaPrimeira).toBe(false);
	});

	it('no PowerVR B-Series: a minima primeiro, pela sonda', () => {
		const p = ordemDasVariantes(TODAS, { chave: 0, renderizador: BXM });
		expect(nomes(p)).toEqual(['minima', 'sem-correcao', 'principal']);
		expect(p.origem).toBe('regra-powervr');
		expect(p.confiarNaPrimeira).toBe(false);
	});

	it('a chave vence a regra: a variante dela primeiro, CONFIADA, depois a minima', () => {
		const p = ordemDasVariantes(TODAS, { chave: 5, origemDaChave: 'chave-guardada', renderizador: BXM });
		expect(nomes(p)).toEqual(['fs-minimo', 'minima', 'principal', 'sem-correcao']);
		expect(p.origem).toBe('chave-guardada');
		expect(p.confiarNaPrimeira).toBe(true);
		expect(nomes(ordemDasVariantes(TODAS, { chave: 2, origemDaChave: 'chave-url' }))).toEqual(['minima', 'principal', 'sem-correcao']);
	});

	it('=9 nao tenta nada', () => {
		expect(nomes(ordemDasVariantes(TODAS, { chave: 9, origemDaChave: 'chave-url' }))).toEqual([]);
	});
});

describe('o relato ao /analytics', () => {
	const powervr = { renderizador: 'ANGLE (Imagination Technologies, PowerVR B-Series BXM-8-256, OpenGL ES 3.2)', versao: 'WebGL 2.0', glsl: '' };
	const nvidia = { renderizador: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)', versao: '', glsl: '' };
	const ok = { variante: 'principal', falhas: [], sondas: { principal: { desenhou: true, comCorrecao: 40, semCorrecao: 40 } } };
	const caiu = {
		variante: 'sem-correcao',
		falhas: [{ variante: 'principal', etapa: 'compilar-vertex', log: null, contextoPerdido: false }],
		sondas: {}
	};

	it('principal ok numa GPU comum: silencio', () => {
		expect(precisaRelatar(ok, nvidia)).toBe(false);
	});

	it('o principal que ficou por falta de opcao (nenhuma desenhou na sonda) tambem relata', () => {
		const semOpcao = { ...ok, falhas: [{ variante: 'principal', etapa: 'sonda', log: 'nao desenhou', contextoPerdido: null }] };
		expect(precisaRelatar(semOpcao, nvidia)).toBe(true);
	});

	it('a regra do PowerVR diz QUEM decidiu, o que a sonda achou da escolhida e do principal', () => {
		const regra = {
			variante: 'minima',
			origem: 'regra-powervr',
			falhas: [],
			sondas: { minima: { desenhou: true, casos: {} } },
			sondaDoPrincipal: { desenhou: false, casos: { 'mob-rgba': { passou: true }, dano: { passou: false } } }
		};
		expect(precisaRelatar(regra, nvidia)).toBe(true);
		expect(mensagemDoRelato(regra, powervr)).toBe(
			'[sprite] valendo=minima origem=regra-powervr | sonda=ok | principal-na-sonda=reprovou(dano) | gpu=ANGLE (Imagination Technologies, PowerVR B-Series BXM-8-256, OpenGL ES 3.2)'
		);
		const guardada = { ...regra, variante: 'fs-minimo', origem: 'chave-guardada', sondas: { 'fs-minimo': { desenhou: null } } };
		expect(mensagemDoRelato(guardada, powervr)).toContain('valendo=fs-minimo origem=chave-guardada | sonda=?');
		expect(JSON.parse(detalheDoRelato(guardada, powervr)).origem).toBe('chave-guardada');
	});

	it('principal ok no PowerVR: relata o diagnostico (e o que diz se o conserto pegou la)', () => {
		expect(precisaRelatar(ok, powervr)).toBe(true);
		expect(mensagemDoRelato(ok, powervr)).toBe(
			'[sprite] diagnostico: principal ok | gpu=ANGLE (Imagination Technologies, PowerVR B-Series BXM-8-256, OpenGL ES 3.2)'
		);
	});

	it('a falha diz qual variante ficou, qual shader falhou, o log e a GPU', () => {
		expect(precisaRelatar(caiu, nvidia)).toBe(true);
		const m = mensagemDoRelato(caiu, powervr);
		expect(m).toContain('[sprite] valendo=sem-correcao');
		expect(m).toContain('principal: compilar-vertex log=null');
		expect(m).toContain('gpu=ANGLE (Imagination Technologies, PowerVR B-Series BXM-8-256');
		expect(m.length).toBeLessThanOrEqual(300);
	});

	it('log vazio e log null sao coisas diferentes no texto', () => {
		const vazio = { ...caiu, falhas: [{ ...caiu.falhas[0], log: '' }] };
		expect(mensagemDoRelato(vazio, nvidia)).toContain('log=""');
	});

	it('o detalhe e JSON com a GPU e as falhas, ate 1000 caracteres', () => {
		const d = JSON.parse(detalheDoRelato(caiu, powervr));
		expect(d.variante).toBe('sem-correcao');
		expect(d.falhas[0].log).toBeNull();
		expect(d.gpu.renderizador).toContain('PowerVR');
	});

	it('sai UMA vez por pagina, e um relator que lanca nao sobe', () => {
		guardarEscolhaDoSprite(caiu, powervr);
		const relatar = vi.fn();
		expect(relatarEscolhaDoSprite(relatar)).toBe(true);
		expect(relatarEscolhaDoSprite(relatar)).toBe(false);
		expect(relatar).toHaveBeenCalledTimes(1);

		guardarEscolhaDoSprite(caiu, powervr);
		expect(() =>
			relatarEscolhaDoSprite(() => {
				throw new Error('rede');
			})
		).not.toThrow();
	});

	it('nada a dizer: nao chama o relator', () => {
		guardarEscolhaDoSprite(ok, nvidia);
		const relatar = vi.fn();
		expect(relatarEscolhaDoSprite(relatar)).toBe(false);
		expect(relatar).not.toHaveBeenCalled();
	});

	it('a GPU vem do UNMASKED_RENDERER_WEBGL quando a extensao existe', () => {
		const ext = { UNMASKED_RENDERER_WEBGL: 0x9246 };
		const gl = {
			RENDERER: 0x1f01,
			VERSION: 0x1f02,
			SHADING_LANGUAGE_VERSION: 0x8b8c,
			getExtension: n => (n === 'WEBGL_debug_renderer_info' ? ext : null),
			getParameter: p => ({ 0x9246: 'PowerVR B-Series BXM-8-256', 0x1f01: 'WebKit WebGL', 0x1f02: 'WebGL 2.0' })[p] ?? null
		};
		expect(descreverGpu(gl).renderizador).toBe('PowerVR B-Series BXM-8-256');
		expect(descreverGpu({ ...gl, getExtension: () => null }).renderizador).toBe('WebKit WebGL');
		expect(() => descreverGpu({ getParameter: () => { throw new Error('x'); } })).not.toThrow();
	});
});

describe('o compileShader conta qual shader falhou e o log cru', () => {
	function glQueFalha(log, perdido) {
		return {
			VERTEX_SHADER: 1,
			FRAGMENT_SHADER: 2,
			COMPILE_STATUS: 3,
			createShader: () => ({}),
			shaderSource() {},
			compileShader() {},
			getShaderParameter: () => (perdido ? null : false),
			getShaderInfoLog: () => log,
			deleteShader() {},
			isContextLost: () => perdido
		};
	}

	it('log null com o contexto perdido: a mensagem de sempre, e os campos novos', () => {
		const gl = glQueFalha(null, true);
		let erro;
		try {
			compileShader(gl, '#version 300 es\nvoid main(){}', gl.VERTEX_SHADER);
		} catch (e) {
			erro = e;
		}
		expect(erro.message).toBe('WebGL::CompileShader() - Fail to compile Vertex shader: null');
		expect(erro.etapaDoShader).toBe('compilar-vertex');
		expect(erro.logDoShader).toBeNull();
		expect(erro.contextoPerdido).toBe(true);
	});

	it('fragment com log de texto', () => {
		const gl = glQueFalha('ERROR: 0:1: x', false);
		let erro;
		try {
			compileShader(gl, 'x', gl.FRAGMENT_SHADER);
		} catch (e) {
			erro = e;
		}
		expect(erro.etapaDoShader).toBe('compilar-fragment');
		expect(erro.logDoShader).toBe('ERROR: 0:1: x');
		expect(erro.contextoPerdido).toBe(false);
	});
});

/*
 * A CONTA DOS SHADERS, em JavaScript. Nao ha compilador GLSL no Node; o que
 * se prova aqui e que as reservas desenham o MESMO billboard que o principal
 * (sem a correcao de z), e que a camera da sonda poe o sprite no meio da tela.
 */
function vezes(m, v) {
	return [0, 1, 2, 3].map(r => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r] * v[3]);
}

/** `Project` + `modelView * position` do `SpriteRenderer.vs`/`SemCorrecao.vs`. */
function vistaPeloProject(mv, pos, position) {
	const m = Float32Array.from(mv);
	const x = pos[0] + 0.5;
	const y = -pos[2];
	const z = pos[1] + 0.5;
	for (let r = 0; r < 4; r++) m[12 + r] += m[r] * x + m[4 + r] * y + m[8 + r] * z;
	m.set([1, 0, 0], 0);
	m.set([0, 1, 0], 4);
	m.set([0, 0, 1], 8);
	return vezes(m, position);
}

/** A forma do `SpriteRendererMinimo.vs`. */
function vistaPelaMinima(mv, pos, position) {
	const centro = vezes(mv, [pos[0] + 0.5, -pos[2], pos[1] + 0.5, 1]);
	return [centro[0] + position[0], centro[1] + position[1], centro[2] + position[2], centro[3]];
}

describe('as reservas desenham o mesmo billboard', () => {
	it('a minima da a mesma posicao na vista que o Project, em 200 cameras', () => {
		let semente = 7;
		const aleatorio = () => ((semente = (semente * 16807) % 2147483647) / 2147483647) * 2 - 1;
		for (let i = 0; i < 200; i++) {
			const mv = mat4.create();
			mat4.identity(mv);
			mat4.translateZ(mv, -10 - 60 * Math.abs(aleatorio()));
			mat4.rotateX(mv, mv, aleatorio() * Math.PI);
			mat4.rotateY(mv, mv, aleatorio() * Math.PI);
			mat4.translate(mv, mv, [aleatorio() * 200, aleatorio() * 5, aleatorio() * 200]);
			const pos = [aleatorio() * 200, aleatorio() * 200, aleatorio() * 5];
			const position = [aleatorio() * 3, aleatorio() * 3, 0, 1];
			const a = vistaPeloProject(mv, pos, position);
			const b = vistaPelaMinima(mv, pos, position);
			for (let k = 0; k < 4; k++) expect(b[k]).toBeCloseTo(a[k], 3);
		}
	});

	it('a camera da sonda poe o centro do sprite no meio da tela, dentro do recorte', () => {
		const { projecao, modelView, viewModel } = matrizesDaSonda();
		const clip = vezes(projecao, vistaPeloProject(modelView, [0, 0, 0], [0, 0, 0, 1]));
		expect(Math.abs(clip[0] / clip[3])).toBeLessThan(0.05);
		expect(Math.abs(clip[1] / clip[3])).toBeLessThan(0.05);
		expect(clip[2] / clip[3]).toBeGreaterThan(-1);
		expect(clip[2] / clip[3]).toBeLessThan(1);
		// a inversa e a inversa (o shader nunca chama inverse(): ela vem da CPU)
		const id = mat4.create();
		mat4.multiply(id, viewModel, modelView);
		for (let k = 0; k < 16; k++) expect(id[k]).toBeCloseTo(k % 5 === 0 ? 1 : 0, 5);
	});
});

describe('os fontes dos shaders', () => {
	const ler = nome => readFileSync(resolve(__dirname, '../../src/Renderer/' + nome), 'utf8');
	const semComentario = t => t.replace(/\/\/.*$/gm, '');

	it('o principal escreve gl_Position UMA vez e nunca o le', () => {
		const vs = semComentario(ler('SpriteRenderer.vs'));
		expect(vs.match(/gl_Position/g)).toHaveLength(1);
		expect(vs).toMatch(/gl_Position\s*=\s*clip;/);
		expect(vs).not.toMatch(/inverse\s*\(/);
	});

	it('os cinco fontes do sprite sao ASCII puro (nenhum compilador de celular tropeca em comentario)', () => {
		for (const nome of [
			'SpriteRenderer.vs',
			'SpriteRenderer.fs',
			'SpriteRendererSemCorrecao.vs',
			'SpriteRendererMinimo.vs',
			'SpriteRendererMinimo.fs',
			'SpriteRendererSemFuncao.vs',
			'SpriteRendererSemBool.vs'
		]) {
			expect(/[^\x00-\x7f]/.test(ler(nome)), nome).toBe(false);
		}
	});

	it('o principal mantem a correcao de profundidade', () => {
		const vs = semComentario(ler('SpriteRenderer.vs'));
		expect(vs).toContain('if (!uDisableDepthCorrection)');
		expect(vs).toContain('clip.z = min(clip.z, correctedZBase);');
	});

	it('as reservas nao tem o bloco de correcao', () => {
		for (const nome of ['SpriteRendererSemCorrecao.vs', 'SpriteRendererMinimo.vs']) {
			const vs = semComentario(ler(nome));
			expect(vs).not.toContain('uViewModelMat');
			expect(vs).not.toContain('uDisableDepthCorrection');
			expect(vs.match(/gl_Position/g)).toHaveLength(1);
		}
		expect(semComentario(ler('SpriteRendererMinimo.vs'))).not.toMatch(/\bProject\s*\(/);
		expect(semComentario(ler('SpriteRendererMinimo.fs'))).not.toContain('bilinearSample');
	});
});

describe('as variantes de diagnostico tiram UMA peca cada (D-2054)', () => {
	const ler = nome => readFileSync(resolve(__dirname, '../../src/Renderer/' + nome), 'utf8');
	const corpo = t => t.replace(/\/\/.*$/gm, '').replace(/\s+/g, ' ').trim();
	const principal = corpo(ler('SpriteRenderer.vs'));

	it('sem-funcao: sem o Project, com a correcao e o bool', () => {
		const vs = corpo(ler('SpriteRendererSemFuncao.vs'));
		expect(vs).not.toMatch(/\bProject\s*\(/);
		expect(principal).toMatch(/\bProject\s*\(/);
		expect(vs).toContain('uniform bool uDisableDepthCorrection;');
		expect(vs).toContain('clip.z = min(clip.z, correctedZBase);');
	});

	it('sem-bool: o principal com uniform int, e nada mais muda', () => {
		const vs = corpo(ler('SpriteRendererSemBool.vs'));
		const volta = vs
			.replace('uniform int uDisableDepthCorrection;', 'uniform bool uDisableDepthCorrection;')
			.replace('if (uDisableDepthCorrection == 0) {', 'if (!uDisableDepthCorrection) {');
		expect(volta).toBe(principal);
	});

	it('a tabela da chave cobre as seis variantes que existem', () => {
		expect(CHAVES_DE_RESERVA).toEqual({
			1: 'sem-correcao',
			2: 'minima',
			3: 'sem-funcao',
			4: 'sem-bool',
			5: 'fs-minimo',
			6: 'vs-minimo'
		});
	});
});

describe('a sonda fiel so aprova a COR esperada (D-2054)', () => {
	const retrato = (pixels, n = 1024) => {
		const a = new Uint8Array(n * 4);
		for (let i = 0; i < n; i++) a.set(FUNDO, i * 4);
		for (const [i, cor] of pixels) a.set(cor, i * 4);
		return a;
	};

	it('so fundo: nada coberto, reprova', () => {
		expect(avaliarPixels(retrato([]), CORES_DOS_CASOS['mob-rgba'])).toEqual({ cobertos: 0, certos: 0, passou: false });
	});

	it('a cor certa em pixels bastantes passa', () => {
		const certos = Array.from({ length: PIXELS_MINIMOS }, (_v, i) => [i, CORES_DOS_CASOS['jogador-paleta']]);
		expect(avaliarPixels(retrato(certos), CORES_DOS_CASOS['jogador-paleta']).passou).toBe(true);
	});

	it('pixel ACESO com a cor errada reprova (a sonda antiga, que so contava aceso, aprovaria)', () => {
		const errados = Array.from({ length: 40 }, (_v, i) => [i, [255, 0, 255, 255]]);
		const r = avaliarPixels(retrato(errados), CORES_DOS_CASOS['jogador-paleta']);
		expect(r.cobertos).toBe(40);
		expect(r.certos).toBe(0);
		expect(r.passou).toBe(false);
	});

	it('a cor certa com alfa zero (o que a mistura apaga) reprova', () => {
		const [r, g, b] = CORES_DOS_CASOS.dano;
		const semAlfa = Array.from({ length: 40 }, (_v, i) => [i, [r, g, b, 0]]);
		expect(avaliarPixels(retrato(semAlfa), CORES_DOS_CASOS.dano).passou).toBe(false);
	});

	it('o resumo diz quais casos reprovaram', () => {
		expect(resumoDaSonda({ desenhou: true })).toBe('ok');
		expect(resumoDaSonda({ desenhou: null })).toBe('?');
		expect(resumoDaSonda({ desenhou: false, casos: { 'mob-rgba': { passou: true }, 'jogador-paleta': { passou: false } } })).toBe(
			'reprovou(jogador-paleta)'
		);
	});
});

describe('o relato sai depois do aperto de mao (D-993)', () => {
	const fonte = readFileSync(resolve(__dirname, '../../src/Renderer/MapRenderer.js'), 'utf8');

	it('o MapRenderer chama o relato DEPOIS do onLoad, num relogio, dentro de try', () => {
		const onLoad = fonte.indexOf('MapRenderer.onLoad();');
		const relato = fonte.indexOf('relatarEscolhaDoSprite(relatarErro)');
		expect(onLoad).toBeGreaterThan(0);
		expect(relato).toBeGreaterThan(onLoad);
		const trecho = fonte.slice(onLoad, relato);
		expect(trecho).toContain('setTimeout(');
		expect(fonte.slice(relato - 40, relato)).toContain('try {');
	});
});

describe('o SpriteRenderer de verdade, com o WebGL falso', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	const BXM = 'ANGLE (Imagination Technologies, PowerVR B-Series BXM-8-256, OpenGL ES 3.2)';

	async function subir({ quebrados = [], renderizador = 'gpu falsa', sonda = null } = {}) {
		vi.doMock('Renderer/Camera.js', () => ({ default: { zoom: 125, getLatitude: () => 230 } }));
		vi.doMock('Renderer/sondaDoSprite.js', () => ({
			sondarProgramaDoSprite: sonda || (() => ({ desenhou: true }))
		}));
		const criados = [];
		const tentativas = { n: 0, fontes: [] };
		vi.doMock('Utils/WebGL.js', () => ({
			default: {
				createShaderProgram: (gl, vs, fs) => {
					tentativas.n++;
					tentativas.fontes.push([vs, fs]);
					if (quebrados.some(q => vs.includes(q))) throw erroDoPowerVR();
					const p = { vs, fs, attribute: { aPosition: 0, aTextureCoord: 1 }, uniform: {} };
					criados.push(p);
					return p;
				}
			}
		}));
		const { default: SpriteRenderer, VARIANTES_DO_SPRITE } = await import('Renderer/SpriteRenderer.js');
		const programa = await import('Renderer/programaDoSprite.js');
		const usados = [];
		const gl = new Proxy(
			{
				getParameter: () => renderizador,
				getExtension: () => null,
				deleteProgram: vi.fn(),
				useProgram: p => usados.push(p)
			},
			{
				get: (alvo, k) => {
					if (!(k in alvo)) alvo[k] = typeof k === 'string' && /^[A-Z_0-9]+$/.test(k) ? 1 : vi.fn();
					return alvo[k];
				}
			}
		);
		return { SpriteRenderer, VARIANTES_DO_SPRITE, programa, gl, criados, tentativas, usados };
	}

	it('o principal quebrado no init: nada lanca e a sem-correcao desenha', async () => {
		const { SpriteRenderer, programa, gl } = await subir({ quebrados: ['clip.z = min('] });
		expect(() => SpriteRenderer.init(gl)).not.toThrow();
		expect(programa.escolhaDoSprite().variante).toBe('sem-correcao');
		SpriteRenderer.bind3DContext(gl, mat4.create(), mat4.create(), { use: false, exist: false, near: 0, far: 1, color: [0, 0, 0] });
		expect(SpriteRenderer.render.name).toBe('RenderCanvas3D');
		expect(globalThis.__ragidleProgramaDoSprite.variante).toBe('sem-correcao');
	});

	it('nenhuma variante: o init, o bind, o render e o unbind nao lancam', async () => {
		const { SpriteRenderer, programa, gl, tentativas } = await subir({ quebrados: ['#version'] });
		expect(() => SpriteRenderer.init(gl)).not.toThrow();
		expect(programa.escolhaDoSprite().programa).toBeNull();
		expect(tentativas.n).toBe(3);
		expect(() => SpriteRenderer.bind3DContext(gl, mat4.create(), mat4.create(), {})).not.toThrow();
		expect(() => SpriteRenderer.render()).not.toThrow();
		expect(() => SpriteRenderer.unbind(gl)).not.toThrow();
		// a cascata nao repete a cada mapa
		expect(() => SpriteRenderer.init(gl)).not.toThrow();
		expect(tentativas.n).toBe(3);
	});

	it('o renderer PowerVR B-Series escolhe a minima SOZINHO, e a sonda do principal vai ao relato', async () => {
		const { SpriteRenderer, VARIANTES_DO_SPRITE, programa, gl, tentativas } = await subir({ renderizador: BXM });
		SpriteRenderer.escolherPrograma(gl, '', null);
		const e = programa.escolhaDoSprite();
		expect(e.variante).toBe('minima');
		expect(e.origem).toBe('regra-powervr');
		const minima = VARIANTES_DO_SPRITE.find(v => v.nome === 'minima');
		expect(tentativas.fontes[0]).toEqual([minima.vs, minima.fs]);
		expect(e.sondaDoPrincipal).toEqual({ desenhou: true });
	});

	it('a chave da URL fica guardada e escolhe na abertura seguinte, ate no PowerVR', async () => {
		const guardado = {};
		const armazenamento = {
			getItem: k => guardado[k] ?? null,
			setItem: (k, v) => (guardado[k] = v),
			removeItem: k => delete guardado[k]
		};
		let s = await subir({ renderizador: BXM });
		s.SpriteRenderer.escolherPrograma(s.gl, '?forcarSpriteReserva=5', armazenamento);
		expect(s.programa.escolhaDoSprite().variante).toBe('fs-minimo');
		expect(s.programa.escolhaDoSprite().origem).toBe('chave-url');
		vi.resetModules();
		s = await subir({ renderizador: BXM });
		s.SpriteRenderer.escolherPrograma(s.gl, '', armazenamento);
		expect(s.programa.escolhaDoSprite().variante).toBe('fs-minimo');
		expect(s.programa.escolhaDoSprite().origem).toBe('chave-guardada');
	});

	it('a sonda desenha pelo render do jogo, com o programa CANDIDATO, e devolve o estado', async () => {
		let candidatoNoRender = null;
		const sonda = (gl, programa, desenhar) => {
			desenhar({
				nome: 'jogador-paleta',
				textura: 'tex',
				paleta: 'pal',
				tamanhoDaImagem: [16, 16],
				rgba: false,
				dano: false,
				matrizes: { modelView: mat4.create(), projecao: mat4.create() }
			});
			candidatoNoRender = programa;
			return { desenhou: true };
		};
		const { SpriteRenderer, gl, usados } = await subir({ sonda });
		SpriteRenderer.image.texture = 'do-jogo';
		SpriteRenderer.color.set([0.5, 0.5, 0.5, 0.5]);
		SpriteRenderer.init(gl);
		expect(usados).toContain(candidatoNoRender);
		expect(gl.drawArrays).toHaveBeenCalled();
		expect(SpriteRenderer.image.texture).toBe('do-jogo');
		expect(Array.from(SpriteRenderer.color)).toEqual([0.5, 0.5, 0.5, 0.5]);
	});

	it('sem nada quebrado, o principal', async () => {
		const { SpriteRenderer, programa, gl } = await subir();
		SpriteRenderer.init(gl);
		expect(programa.escolhaDoSprite().variante).toBe('principal');
		expect(programa.escolhaDoSprite().origem).toBe('sonda');
	});
});
