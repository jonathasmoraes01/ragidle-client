/**
 * Loaders/transferiveisDoMapa.js
 *
 * Fora do `ThreadEventHandler` para poder ser testado: aquele arquivo e o
 * corpo do worker e roda ao ser importado.
 */

/**
 * Os buffers que a mensagem de mapa pode TRANSFERIR em vez de copiar (D-2055,
 * achado A3). So os criados NA HORA pela montagem e que o worker nao toca
 * depois de mandar: a malha do chao e da agua (`Loaders/Ground.js`, `compile`)
 * e o buffer unico dos modelos (`MapLoader.mergeMeshes`). Nada que venha de um
 * arquivo baixado - aquele buffer ainda vai para o cache local depois.
 *
 * @param {string} tipo
 * @param {object} dado
 * @returns {ArrayBuffer[]}
 */
export function transferiveisDoMapa(tipo, dado) {
	const lista = [];
	const somar = vista => {
		if (
			vista &&
			ArrayBuffer.isView(vista) &&
			vista.buffer instanceof ArrayBuffer &&
			// O buffer INTEIRO e a vista (o que ja garante `byteOffset` zero): uma
			// vista parcial divide o buffer com outra coisa, e nao pode ir embora.
			vista.byteLength === vista.buffer.byteLength &&
			lista.indexOf(vista.buffer) < 0
		) {
			lista.push(vista.buffer);
		}
	};
	if (!dado) {
		return lista;
	}
	if (tipo === 'MAP_GROUND') {
		somar(dado.mesh);
		somar(dado.waterMesh);
	} else if (tipo === 'MAP_MODELS') {
		somar(dado.buffer);
	}
	return lista;
}
