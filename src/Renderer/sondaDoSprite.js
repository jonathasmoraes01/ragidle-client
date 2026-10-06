/**
 * A SONDA DO PROGRAMA DO SPRITE (06/10/2026, D-2048).
 *
 * Compilar nao prova desenhar (regra 5 do contrato do servidor): um driver que
 * aceita o shader e o executa errado poe o sprite fora do recorte, e nada
 * lanca. A sonda desenha UM quad branco com o programa recem-linkado num
 * framebuffer proprio de 32x32, com a camera padrao do jogo (zoom 125, angulo
 * 230, a perspectiva de 15 graus de `Renderer.js`), duas vezes — com a
 * correcao de profundidade ligada (o corpo das entidades) e desligada (o
 * dano) — e conta os pixels que sairam. Zero em qualquer das duas e "nao
 * desenhou".
 *
 * Ela roda UMA vez por pagina, no `SpriteRenderer.init` (antes do aperto de
 * mao), devolve o estado GL que tocou e NUNCA lanca para fora: o chamador
 * (`programaDoSprite.js`) trata excecao como "nao sei", que aceita a variante.
 * Framebuffer incompleto tambem e "nao sei" (`desenhou: null`).
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

/**
 * As tres matrizes da camera padrao, montadas como `Camera.update` monta, com
 * o alvo na origem. Exportada para o teste conferir que o centro do sprite cai
 * no meio da tela.
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

function contarPixels(gl) {
	const pixels = new Uint8Array(LADO_DA_SONDA * LADO_DA_SONDA * 4);
	gl.readPixels(0, 0, LADO_DA_SONDA, LADO_DA_SONDA, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
	let n = 0;
	for (let i = 3; i < pixels.length; i += 4) {
		if (pixels[i] > 0 || pixels[i - 3] > 0) n++;
	}
	return n;
}

/**
 * @param {WebGL2RenderingContext} gl
 * @param {WebGLProgram} programa com `.attribute` e `.uniform` (`WebGL.createShaderProgram`)
 * @return {{ desenhou: boolean|null, comCorrecao?: number, semCorrecao?: number, motivo?: string }}
 */
export function sondarProgramaDoSprite(gl, programa) {
	if (!gl || !programa || !programa.uniform || !programa.attribute) {
		return { desenhou: null, motivo: 'sem contexto ou programa' };
	}
	if (gl.isContextLost && gl.isContextLost()) {
		return { desenhou: null, motivo: 'contexto perdido' };
	}

	// O estado que a sonda toca, para devolver depois.
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
		mascaraDeProfundidade: gl.getParameter(gl.DEPTH_WRITEMASK)
	};
	gl.activeTexture(gl.TEXTURE0);
	const textura0 = gl.getParameter(gl.TEXTURE_BINDING_2D);

	const criados = { fb: null, cor: null, prof: null, branca: null, quad: null, vao: null };
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

		// Um texel branco opaco: o fragment nao descarta e a cor sai cheia.
		criados.branca = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, criados.branca);
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGBA,
			1,
			1,
			0,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			new Uint8Array([255, 255, 255, 255])
		);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

		// O mesmo quad do `SpriteRenderer.init`, num VAO proprio.
		criados.vao = gl.createVertexArray();
		gl.bindVertexArray(criados.vao);
		criados.quad = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, criados.quad);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array([-0.5, +0.5, 0.0, 0.0, +0.5, +0.5, 1.0, 0.0, -0.5, -0.5, 0.0, 1.0, +0.5, -0.5, 1.0, 1.0]),
			gl.STATIC_DRAW
		);

		const a = programa.attribute;
		const u = programa.uniform;
		gl.useProgram(programa);
		gl.enableVertexAttribArray(a.aPosition);
		gl.vertexAttribPointer(a.aPosition, 2, gl.FLOAT, false, 16, 0);
		gl.enableVertexAttribArray(a.aTextureCoord);
		gl.vertexAttribPointer(a.aTextureCoord, 2, gl.FLOAT, false, 16, 8);

		const { projecao, modelView, viewModel } = matrizesDaSonda();
		const identidade = mat4.create();
		mat4.identity(identidade);
		// Uniform que a variante nao tem chega como `undefined`: a chamada com
		// local nulo nao faz nada, igual ao `SpriteRenderer.bind3DContext`.
		gl.uniformMatrix4fv(u.uProjectionMat, false, projecao);
		gl.uniformMatrix4fv(u.uModelViewMat, false, modelView);
		gl.uniformMatrix4fv(u.uViewModelMat, false, viewModel);
		gl.uniformMatrix4fv(u.uSpriteRendererAngle, false, identidade);
		gl.uniform1f(u.uCameraZoom, ZOOM_PADRAO);
		gl.uniform1f(u.uCameraLatitude, ANGULO_PADRAO);
		gl.uniform1i(u.uFogUse, 0);
		gl.uniform1i(u.uDiffuse, 0);
		gl.uniform1i(u.uPalette, 1);
		gl.uniform1i(u.uUsePal, 0);
		gl.uniform1i(u.uIsRGBA, 1);
		gl.uniform1f(u.uShadow, 1);
		gl.uniform2fv(u.uTextSize, [1, 1]);
		gl.uniform4fv(u.uSpriteRendererColor, [1, 1, 1, 1]);
		gl.uniform3fv(u.uSpriteRendererPosition, [0, 0, 0]);
		// Um monstro de ~100 px: o `_size`/`_offset` de `RenderCanvas3D`.
		gl.uniform2fv(u.uSpriteRendererSize, [(100 / 175) * 5, (100 / 175) * 5]);
		gl.uniform2fv(u.uSpriteRendererOffset, [0, -0.5]);
		gl.uniform1f(u.uSpriteRendererDepth, 0);
		gl.uniform1f(u.uSpriteRendererZindex, 0);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, criados.branca);

		gl.viewport(0, 0, LADO_DA_SONDA, LADO_DA_SONDA);
		gl.disable(gl.BLEND);
		gl.disable(gl.SCISSOR_TEST);
		gl.disable(gl.CULL_FACE);
		gl.enable(gl.DEPTH_TEST);
		gl.depthMask(true);
		gl.clearColor(0, 0, 0, 0);

		const desenharE_contar = semCorrecao => {
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
			gl.uniform1i(u.uDisableDepthCorrection, semCorrecao ? 1 : 0);
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
			return contarPixels(gl);
		};
		const comCorrecao = desenharE_contar(false);
		const semCorrecao = desenharE_contar(true);

		gl.disableVertexAttribArray(a.aPosition);
		gl.disableVertexAttribArray(a.aTextureCoord);

		return { desenhou: comCorrecao > 0 && semCorrecao > 0, comCorrecao, semCorrecao };
	} catch (erro) {
		return { desenhou: null, motivo: 'a sonda lancou: ' + (erro && erro.message) };
	} finally {
		devolverEstado(gl, antes, textura0, criados);
	}
}

function devolverEstado(gl, antes, textura0, criados) {
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
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, textura0);
		gl.activeTexture(antes.texturaAtiva);
	});
	tentar(() =>
		gl.clearColor(antes.corDeLimpeza[0], antes.corDeLimpeza[1], antes.corDeLimpeza[2], antes.corDeLimpeza[3])
	);
	tentar(() => (antes.profundidade ? gl.enable(gl.DEPTH_TEST) : gl.disable(gl.DEPTH_TEST)));
	tentar(() => (antes.mistura ? gl.enable(gl.BLEND) : gl.disable(gl.BLEND)));
	tentar(() => (antes.recorte ? gl.enable(gl.SCISSOR_TEST) : gl.disable(gl.SCISSOR_TEST)));
	tentar(() => (antes.descarte ? gl.enable(gl.CULL_FACE) : gl.disable(gl.CULL_FACE)));
	tentar(() => gl.depthMask(antes.mascaraDeProfundidade));
	tentar(() => criados.fb && gl.deleteFramebuffer(criados.fb));
	tentar(() => criados.cor && gl.deleteTexture(criados.cor));
	tentar(() => criados.prof && gl.deleteRenderbuffer(criados.prof));
	tentar(() => criados.branca && gl.deleteTexture(criados.branca));
	tentar(() => criados.quad && gl.deleteBuffer(criados.quad));
	tentar(() => criados.vao && gl.deleteVertexArray(criados.vao));
}
