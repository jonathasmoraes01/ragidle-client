/**
 * A SONDA DO PROGRAMA DO SPRITE (06/10/2026, D-2048; FIEL desde a D-2054).
 *
 * Compilar nao prova desenhar (regra 5 do contrato do servidor). A PRIMEIRA
 * sonda (D-2048) desenhava um quad branco de textura 1x1, sem mistura de cor,
 * num VAO proprio, e aprovava qualquer pixel aceso (alfa OU vermelho). No moto
 * g54 (PowerVR BXM-8-256) ela aprovou a `principal`, e os sprites seguiram
 * invisiveis: ela nao passava por nenhum dos caminhos que o jogo usa.
 *
 * Esta desenha pelo CAMINHO DO JOGO: quem desenha e o proprio
 * `SpriteRenderer.render` (`desenhar`, injetado por `SpriteRenderer.js`), com
 * o VAO padrao, a mistura `SRC_ALPHA, ONE_MINUS_SRC_ALPHA` ligada e a
 * profundidade do jogo, e com texturas montadas como `Core/Client.js` as monta:
 *
 *   mob-rgba        quadro RGBA (o `type` 1 do SPR), LINEAR, correcao ligada;
 *   jogador-paleta  quadro de INDICE em LUMINANCE (UNPACK_ALIGNMENT 1),
 *                   NEAREST, mais a paleta 256x1 RGBA: o ramo `uUsePal`, com a
 *                   `bilinearSample` que recebe `sampler2D`;
 *   dano            RGBA, LINEAR, sem profundidade e sem correcao (o
 *                   `runWithDepth(false, false, true)` do `Damage.js`).
 *
 * Cada caso so passa com pixels da COR ESPERADA (tolerancia por canal), lidos
 * de um framebuffer proprio 32x32 sobre um fundo conhecido. Pixel aceso com a
 * cor errada, ou transparente sob a mistura, reprova.
 *
 * Roda uma vez por variante, no `SpriteRenderer.init` (antes do aperto de
 * mao), devolve o estado GL que tocou e NUNCA lanca para fora: excecao vira
 * "nao sei" (`desenhou: null`), que aceita a variante.
 */
import glMatrix from 'Utils/gl-matrix.js';

const mat4 = glMatrix.mat4;

/** O lado do framebuffer da sonda, em pixels. */
export const LADO_DA_SONDA = 32;

/** O zoom padrao da camera (`Preferences/Camera.js`). */
const ZOOM_PADRAO = 125;

/** O angulo vertical padrao da camera (`Camera.range`). */
const ANGULO_PADRAO = 230;

/** A abertura vertical da perspectiva (`Renderer.vFov`). */
const ABERTURA = 15;

/** O fundo do framebuffer: um azul escuro que nenhum caso desenha. */
export const FUNDO = [0, 0, 64, 255];

/** Quanto cada canal pode errar (filtro, arredondamento da mistura). */
export const TOLERANCIA = 40;

/** Quantos pixels da cor certa bastam para o caso passar. */
export const PIXELS_MINIMOS = 4;

/** A cor de cada caso (RGBA 0..255), opaca. */
export const CORES_DOS_CASOS = {
	'mob-rgba': [220, 40, 40, 255],
	'jogador-paleta': [40, 200, 60, 255],
	dano: [240, 230, 40, 255]
};

/** O indice da paleta que o quadro do jogador usa (0 e o transparente). */
export const INDICE_DA_PALETA = 7;

/**
 * As tres matrizes da camera padrao, montadas como `Camera.update` monta, com
 * o alvo na origem.
 */
export function matrizesDaSonda() {
	const projecao = mat4.create();
	mat4.perspective(ABERTURA, 1, 1, 1000, projecao);

	const modelView = mat4.create();
	mat4.identity(modelView);
	mat4.translateZ(modelView, (0 - ZOOM_PADRAO) / 2);
	mat4.rotateX(modelView, modelView, (ANGULO_PADRAO / 180) * Math.PI);
	mat4.rotateY(modelView, modelView, (-360 / 180) * Math.PI);
	// alvo na origem: `_position` de `Camera.update` com position = 0
	mat4.translate(modelView, modelView, [-0.5, 0, -0.5]);

	const viewModel = mat4.create();
	mat4.invert(viewModel, modelView);

	return { projecao, modelView, viewModel };
}

/**
 * Conta, num retrato RGBA, os pixels que sairam do fundo e os da cor certa.
 * Funcao pura: e ela que decide "desenhou a cor esperada".
 *
 * @param {Uint8Array} pixels RGBA
 * @param {number[]} esperado RGBA 0..255
 * @param {number[]} [fundo]
 * @param {number} [tolerancia]
 * @return {{ cobertos: number, certos: number, passou: boolean }}
 */
export function avaliarPixels(pixels, esperado, fundo = FUNDO, tolerancia = TOLERANCIA) {
	let cobertos = 0;
	let certos = 0;
	for (let i = 0; i + 3 < pixels.length; i += 4) {
		const r = pixels[i];
		const g = pixels[i + 1];
		const b = pixels[i + 2];
		const a = pixels[i + 3];
		if (
			Math.abs(r - fundo[0]) > tolerancia ||
			Math.abs(g - fundo[1]) > tolerancia ||
			Math.abs(b - fundo[2]) > tolerancia ||
			Math.abs(a - fundo[3]) > tolerancia
		) {
			cobertos++;
		}
		if (
			Math.abs(r - esperado[0]) <= tolerancia &&
			Math.abs(g - esperado[1]) <= tolerancia &&
			Math.abs(b - esperado[2]) <= tolerancia &&
			Math.abs(a - esperado[3]) <= tolerancia
		) {
			certos++;
		}
	}
	return { cobertos, certos, passou: certos >= PIXELS_MINIMOS };
}

function textura(gl, formato, largura, altura, dados, filtro) {
	const t = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, t);
	gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
	gl.texImage2D(gl.TEXTURE_2D, 0, formato, largura, altura, 0, formato, gl.UNSIGNED_BYTE, dados);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filtro);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filtro);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	return t;
}

function cheio(n, valor) {
	const a = new Uint8Array(n * valor.length);
	for (let i = 0; i < n; i++) a.set(valor, i * valor.length);
	return a;
}

/**
 * @param {WebGL2RenderingContext} gl
 * @param {WebGLProgram} programa
 * @param {function} desenhar `(caso) => void`: desenha UM sprite pelo caminho
 *   do jogo com `caso = { nome, textura, paleta|null, tamanhoDaImagem, rgba,
 *   dano, matrizes }`. Quem injeta e `SpriteRenderer.js`.
 * @return {{ desenhou: boolean|null, casos?: object, motivo?: string }}
 */
export function sondarProgramaDoSprite(gl, programa, desenhar) {
	if (!gl || !programa || typeof desenhar !== 'function') {
		return { desenhou: null, motivo: 'sem contexto, programa ou desenhista' };
	}
	if (gl.isContextLost && gl.isContextLost()) {
		return { desenhou: null, motivo: 'contexto perdido' };
	}

	const antes = {
		framebuffer: gl.getParameter(gl.FRAMEBUFFER_BINDING),
		viewport: gl.getParameter(gl.VIEWPORT),
		programa: gl.getParameter(gl.CURRENT_PROGRAM),
		buffer: gl.getParameter(gl.ARRAY_BUFFER_BINDING),
		vao: gl.getParameter(gl.VERTEX_ARRAY_BINDING),
		texturaAtiva: gl.getParameter(gl.ACTIVE_TEXTURE),
		corDeLimpeza: gl.getParameter(gl.COLOR_CLEAR_VALUE),
		profundidade: gl.isEnabled(gl.DEPTH_TEST),
		mistura: gl.isEnabled(gl.BLEND),
		recorte: gl.isEnabled(gl.SCISSOR_TEST),
		descarte: gl.isEnabled(gl.CULL_FACE),
		mascaraDeProfundidade: gl.getParameter(gl.DEPTH_WRITEMASK),
		alinhamento: gl.getParameter(gl.UNPACK_ALIGNMENT)
	};
	gl.activeTexture(gl.TEXTURE1);
	const textura1 = gl.getParameter(gl.TEXTURE_BINDING_2D);
	gl.activeTexture(gl.TEXTURE0);
	const textura0 = gl.getParameter(gl.TEXTURE_BINDING_2D);

	const criados = { fb: null, cor: null, prof: null, texturas: [] };
	try {
		criados.cor = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, criados.cor);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, LADO_DA_SONDA, LADO_DA_SONDA, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

		criados.prof = gl.createRenderbuffer();
		gl.bindRenderbuffer(gl.RENDERBUFFER, criados.prof);
		gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, LADO_DA_SONDA, LADO_DA_SONDA);

		criados.fb = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, criados.fb);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, criados.cor, 0);
		gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, criados.prof);
		if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
			return { desenhou: null, motivo: 'framebuffer incompleto' };
		}

		// As texturas, como `Core/Client.js` as sobe (8x8, potencia de dois).
		const mob = textura(gl, gl.RGBA, 8, 8, cheio(64, CORES_DOS_CASOS['mob-rgba']), gl.LINEAR);
		const dano = textura(gl, gl.RGBA, 8, 8, cheio(64, CORES_DOS_CASOS.dano), gl.LINEAR);
		const indice = textura(gl, gl.LUMINANCE, 8, 8, cheio(64, [INDICE_DA_PALETA]), gl.NEAREST);
		const corDaPaleta = new Uint8Array(256 * 4);
		corDaPaleta.set(CORES_DOS_CASOS['jogador-paleta'], INDICE_DA_PALETA * 4);
		const paleta = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, paleta);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, corDaPaleta);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		criados.texturas.push(mob, dano, indice, paleta);

		// O estado do jogo (`Renderer.init`): VAO padrao, mistura, profundidade.
		gl.bindVertexArray(null);
		gl.viewport(0, 0, LADO_DA_SONDA, LADO_DA_SONDA);
		gl.disable(gl.SCISSOR_TEST);
		gl.disable(gl.CULL_FACE);
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
		gl.enable(gl.DEPTH_TEST);
		gl.depthFunc(gl.LEQUAL);
		gl.depthMask(true);
		gl.clearColor(FUNDO[0] / 255, FUNDO[1] / 255, FUNDO[2] / 255, FUNDO[3] / 255);

		const matrizes = matrizesDaSonda();
		const casos = [
			{ nome: 'mob-rgba', textura: mob, paleta: null, tamanhoDaImagem: [16, 16], rgba: true, dano: false },
			{ nome: 'jogador-paleta', textura: indice, paleta, tamanhoDaImagem: [16, 16], rgba: false, dano: false },
			{ nome: 'dano', textura: dano, paleta: null, tamanhoDaImagem: [16, 16], rgba: true, dano: true }
		];
		const resultado = {};
		let todos = true;
		for (const caso of casos) {
			gl.bindFramebuffer(gl.FRAMEBUFFER, criados.fb);
			gl.viewport(0, 0, LADO_DA_SONDA, LADO_DA_SONDA);
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
			desenhar({ ...caso, matrizes });
			const pixels = new Uint8Array(LADO_DA_SONDA * LADO_DA_SONDA * 4);
			gl.readPixels(0, 0, LADO_DA_SONDA, LADO_DA_SONDA, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
			resultado[caso.nome] = avaliarPixels(pixels, CORES_DOS_CASOS[caso.nome]);
			if (!resultado[caso.nome].passou) todos = false;
		}
		return { desenhou: todos, casos: resultado };
	} catch (erro) {
		return { desenhou: null, motivo: 'a sonda lancou: ' + (erro && erro.message) };
	} finally {
		devolverEstado(gl, antes, textura0, textura1, criados);
	}
}

function devolverEstado(gl, antes, textura0, textura1, criados) {
	const tentar = fn => {
		try {
			fn();
		} catch (_e) {
			/* devolver estado e melhor esforco; nunca lanca para fora */
		}
	};
	tentar(() => gl.bindVertexArray(antes.vao));
	tentar(() => gl.bindFramebuffer(gl.FRAMEBUFFER, antes.framebuffer));
	tentar(() => gl.viewport(antes.viewport[0], antes.viewport[1], antes.viewport[2], antes.viewport[3]));
	tentar(() => gl.useProgram(antes.programa));
	tentar(() => gl.bindBuffer(gl.ARRAY_BUFFER, antes.buffer));
	tentar(() => {
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, textura1);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, textura0);
		gl.activeTexture(antes.texturaAtiva);
	});
	tentar(() =>
		gl.clearColor(antes.corDeLimpeza[0], antes.corDeLimpeza[1], antes.corDeLimpeza[2], antes.corDeLimpeza[3])
	);
	tentar(() => (antes.profundidade ? gl.enable(gl.DEPTH_TEST) : gl.disable(gl.DEPTH_TEST)));
	tentar(() => (antes.mistura ? gl.enable(gl.BLEND) : gl.disable(gl.BLEND)));
	tentar(() => gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA));
	tentar(() => (antes.recorte ? gl.enable(gl.SCISSOR_TEST) : gl.disable(gl.SCISSOR_TEST)));
	tentar(() => (antes.descarte ? gl.enable(gl.CULL_FACE) : gl.disable(gl.CULL_FACE)));
	tentar(() => gl.depthMask(antes.mascaraDeProfundidade));
	tentar(() => gl.pixelStorei(gl.UNPACK_ALIGNMENT, antes.alinhamento));
	tentar(() => criados.fb && gl.deleteFramebuffer(criados.fb));
	tentar(() => criados.cor && gl.deleteTexture(criados.cor));
	tentar(() => criados.prof && gl.deleteRenderbuffer(criados.prof));
	for (const t of criados.texturas) tentar(() => gl.deleteTexture(t));
}
