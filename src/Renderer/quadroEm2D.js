/**
 * CADA QUADRO DE SPRITE COM O PROPRIO CANVAS (13/09/2026, os sprites que
 * piscam na selecao de personagem no iPhone — tarefa 26).
 *
 * O desenho 2D do `SpriteRenderer` (selecao e criacao de personagem, o boneco
 * da mochila e do equipamento, emoticons, cursor: 24 componentes) montava
 * CADA camada do boneco num canvas de rascunho UNICO, compartilhado —
 * `putImageData` no rascunho e `drawImage` dele no destino — e reusava o mesmo
 * rascunho para a camada seguinte, no mesmo quadro.
 *
 * Pela especificacao cada `drawImage` usa o conteudo do instante da chamada.
 * O Safari desenha canvas 2D na GPU e ADIA a copia: as camadas anteriores
 * podem sair com o conteudo da ultima escrita no rascunho. E exatamente o
 * print do dono — o Ifrit com a cabeca desenhada duas vezes e o Ghostring
 * cortado ao meio —, e o WebKit tem historico registrado de defeito nessa
 * combinacao (`putImageData` num canvas + `drawImage` dele). Nao ha WebKit de
 * iPhone nesta maquina para reproduzir; o conserto tira o risco de qualquer
 * forma: nenhum canvas e reescrito depois de servir de origem.
 *
 * E ele PAGA A SI MESMO: o laco de pixels rodava para toda camada, todo
 * quadro — na selecao sao 15 vagas redesenhadas a 60 fps. Agora cada quadro
 * de sprite e montado UMA vez por (quadro, paleta, cor) e guardado.
 *
 * O cache e fraco (`WeakMap`) no quadro e na paleta: quando o `MemoryManager`
 * solta o sprite, os canvases vao junto. Cor modulada (fade, tinta de status)
 * entra por chave propria, com teto por quadro, para uma animacao de alfa nao
 * encher a memoria.
 * Teste: `tests/renderer/quadroEm2D.test.js`.
 */

/** Quantas cores moduladas um mesmo quadro guarda antes de descartar a mais velha. */
export const CORES_POR_QUADRO = 8;

/** A chave do quadro RGBA, que nao tem paleta. */
const SEM_PALETA = {};

/** quadro -> (paleta -> (cor -> canvas)) */
let _cache = new WeakMap();

/** Esvazia o cache inteiro (teste, ou perda de contexto). */
export function esquecerQuadros() {
	_cache = new WeakMap();
}

function criarCanvasDoDocumento(largura, altura) {
	const canvas = document.createElement('canvas');
	canvas.width = largura;
	canvas.height = altura;
	return canvas;
}

function chaveDaCor(cor) {
	if (cor[0] === 1 && cor[1] === 1 && cor[2] === 1 && cor[3] === 1) {
		return 'identidade';
	}
	return `${cor[0].toFixed(3)},${cor[1].toFixed(3)},${cor[2].toFixed(3)},${cor[3].toFixed(3)}`;
}

/** Monta os pixels de um quadro num canvas NOVO, do tamanho exato dele. */
function montar(quadro, paleta, cor, criarCanvas) {
	const largura = quadro.width;
	const altura = quadro.height;
	const canvas = criarCanvas(largura, altura);
	const ctx = canvas.getContext('2d');
	const imagem = ctx.createImageData(largura, altura);
	const saida = new Uint32Array(imagem.data.buffer);
	const [rM, gM, bM, aM] = cor;
	const identidade = rM === 1 && gM === 1 && bM === 1 && aM === 1;
	const total = largura * altura;

	if (quadro.type === 1) {
		// RGBA: um pixel de 32 bits por vez. Em little endian, 0xAABBGGRR.
		const entrada = new Uint32Array(quadro.data.buffer, quadro.data.byteOffset, total);
		for (let i = 0; i < total; i++) {
			const pixel = entrada[i];
			if (pixel === 0 || identidade) {
				saida[i] = pixel;
				continue;
			}
			const r = (pixel & 0xff) * rM;
			const g = ((pixel >> 8) & 0xff) * gM;
			const b = ((pixel >> 16) & 0xff) * bM;
			const a = ((pixel >>> 24) & 0xff) * aM;
			saida[i] = (a << 24) | (b << 16) | (g << 8) | r;
		}
	} else {
		// Paleta: a cor 0 e transparente; a tabela de 256 sai uma vez por quadro.
		const tabela = new Uint32Array(256);
		for (let i = 1; i < 256; i++) {
			const p = i * 4;
			const r = (paleta[p] * rM) | 0;
			const g = (paleta[p + 1] * gM) | 0;
			const b = (paleta[p + 2] * bM) | 0;
			const a = (255 * aM) | 0;
			tabela[i] = (a << 24) | (b << 16) | (g << 8) | r;
		}
		const entrada = quadro.data;
		for (let i = 0; i < total; i++) {
			saida[i] = tabela[entrada[i]];
		}
	}

	ctx.putImageData(imagem, 0, 0);
	return canvas;
}

/**
 * O canvas com os pixels deste quadro, nesta paleta e nesta cor.
 *
 * @param {{width: number, height: number, type: number, data: Uint8Array}} quadro
 * @param {Uint8Array|null} paleta - 256 cores RGBA; ignorada no quadro RGBA
 * @param {number[]} cor - [r, g, b, a] de 0 a 1
 * @param {function(number, number): HTMLCanvasElement} [criarCanvas]
 * @return {HTMLCanvasElement}
 */
export function canvasDoQuadro(quadro, paleta, cor, criarCanvas = criarCanvasDoDocumento) {
	let porPaleta = _cache.get(quadro);
	if (!porPaleta) {
		porPaleta = new WeakMap();
		_cache.set(quadro, porPaleta);
	}
	const chavePaleta = quadro.type === 1 || !paleta ? SEM_PALETA : paleta;
	let porCor = porPaleta.get(chavePaleta);
	if (!porCor) {
		porCor = new Map();
		porPaleta.set(chavePaleta, porCor);
	}
	const chave = chaveDaCor(cor);
	let canvas = porCor.get(chave);
	if (!canvas) {
		canvas = montar(quadro, paleta, cor, criarCanvas);
		if (porCor.size >= CORES_POR_QUADRO) {
			porCor.delete(porCor.keys().next().value);
		}
		porCor.set(chave, canvas);
	}
	return canvas;
}
