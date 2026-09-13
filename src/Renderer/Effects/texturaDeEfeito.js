/**
 * A TEXTURA DE UM EFEITO E CARREGADA UMA VEZ POR NOME (13/09/2026).
 *
 * `ThreeDEffect.init` e `TwoDEffect.init` chamavam `WebGL.texture` a CADA efeito
 * criado — uma textura NOVA na GPU por golpe ou habilidade — e o `free()` dos
 * dois so fazia `this.ready = false`: nunca apagava a textura. Medido com a
 * pilha de cada `createTexture` (`Rag Idle 2.0/scripts/diag-origem-das-texturas.ts`):
 * em 4 min de caca, 480 texturas nasceram em `ThreeDEffect.js:399` e nenhuma
 * morreu; a sonda de 20 min viu as texturas vivas irem de 531 a 2.031. Num
 * telefone, com a memoria curta, e o que deixa o jogo mais lento com o tempo.
 *
 * Aqui a textura de cada NOME e carregada uma vez e dividida entre todos os
 * efeitos que a usam: o total passa a ser o de nomes distintos, e nao o de
 * golpes. E o reenvio da mesma imagem a GPU a cada golpe — um engasgo por si —
 * some junto. Quem pede enquanto ela carrega recebe a mesma quando ela chega.
 *
 * O carregador vem de fora (`carregadorDeTexturaDeEfeito.js`): o de verdade
 * passa pelo `Client.loadFile` e pelo `WebGL.texture`, e o teste nao os tem.
 * Teste: `tests/renderer/texturaDeEfeito.test.js`.
 */

/** nome -> { textura, esperando } */
let _porNome = new Map();

/** Esquece todas (a perda de contexto invalida as texturas; o teste tambem usa). */
export function esquecerTexturasDeEfeito() {
	_porNome = new Map();
}

/**
 * @param {WebGLRenderingContext} gl
 * @param {string} nome - o arquivo em `data/texture/`
 * @param {function(WebGLTexture): void} pronto
 * @param {function(WebGLRenderingContext, string, function(WebGLTexture): void): void} carregar
 */
export function texturaDeEfeito(gl, nome, pronto, carregar) {
	let entrada = _porNome.get(nome);
	if (entrada) {
		if (entrada.textura !== null) {
			pronto(entrada.textura);
			return;
		}
		entrada.esperando.push(pronto);
		return;
	}
	entrada = { textura: null, esperando: [pronto] };
	_porNome.set(nome, entrada);
	carregar(gl, nome, textura => {
		entrada.textura = textura;
		const esperando = entrada.esperando;
		entrada.esperando = [];
		for (const aguardando of esperando) {
			aguardando(textura);
		}
	});
}
