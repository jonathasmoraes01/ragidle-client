/**
 * O carregador de verdade da textura de um efeito (13/09/2026): o arquivo em
 * `data/texture/`, pelo `Client`, e o upload a GPU, pelo `WebGL`. Mora fora de
 * `texturaDeEfeito.js` para o teste do cache nao precisar do cliente inteiro.
 */
import Client from 'Core/Client.js';
import WebGL from 'Utils/WebGL.js';

/**
 * @param {WebGLRenderingContext} gl
 * @param {string} nome
 * @param {function(WebGLTexture): void} pronto
 */
export function carregarTexturaDeEfeito(gl, nome, pronto) {
	Client.loadFile(`data/texture/${nome}`, buffer => {
		WebGL.texture(gl, buffer, pronto);
	});
}
