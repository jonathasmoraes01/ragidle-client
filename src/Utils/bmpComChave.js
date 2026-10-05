/**
 * O MAGENTA SAI PELOS BYTES DO ARQUIVO, E NAO PELA LEITURA DO CANVAS (05/10/2026, D-1988).
 *
 * ---------------------------------------------------------------------------
 * O RELATO
 * ---------------------------------------------------------------------------
 * Um jogador (Poco M7 Pro, Android, GPU Mali) viu as copas das arvores de
 * `mosk_dun02` como PLANOS MAGENTA SOLIDOS. As 32 texturas do mapa sao BMP
 * com o magenta EXATO (255,0,255) e, no SwiftShader, saem verdes (D-1978).
 *
 * O caminho antigo decide o que e transparente DEPOIS de o navegador decodificar
 * e de o canvas devolver os pixels (`Texture.removeMagenta`, `getImageData`).
 * Qualquer coisa entre o arquivo e essa leitura que mexa na cor — gestao de cor
 * para outro espaco (num canvas `display-p3` o magenta volta como 234,51,247:
 * MEDIDO no Chromium, e o limiar `G < 20` recusa), ruido anti-impressao-digital
 * de navegador, um decodificador diferente — deixa o magenta passar INTEIRO, e
 * a GPU desenha o plano rosa. Isso depende do aparelho e nao se reproduz aqui.
 *
 * Este modulo decide pela FONTE: le a paleta (ou o pixel de 24 bits) do proprio
 * BMP, aplica o MESMO criterio de `ehMagenta`, e devolve RGBA pronto para
 * `putImageData`. Nada e lido de volta do canvas, entao nada no aparelho tem
 * como deslocar a cor antes da decisao.
 *
 * Formatos: BI_RGB (sem compressao) de 1, 4, 8 e 24 bits, de baixo para cima
 * ou de cima para baixo. O resto (RLE, 16/32 bits, cabecalhos estranhos,
 * indice fora da paleta) devolve `null`, e quem chama cai no caminho antigo —
 * recusa em vez de aproximacao.
 */

/**
 * O criterio UNICO de "isto e magenta de transparencia". `Texture.removeMagenta`
 * usa o mesmo, entao num aparelho sRGB os dois caminhos dao o mesmo pixel.
 *
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @return {boolean}
 */
export function ehMagenta(r, g, b) {
	return r > 230 && g < 20 && b > 230;
}

/**
 * @param {ArrayBuffer|Uint8Array} entrada
 * @return {{ width: number, height: number, data: Uint8ClampedArray } | null}
 */
export function decodificarBmpComChave(entrada) {
	const bytes = entrada instanceof Uint8Array ? entrada : new Uint8Array(entrada);
	if (bytes.length < 54 || bytes[0] !== 0x42 || bytes[1] !== 0x4d) return null;
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

	const inicioDosPixels = view.getUint32(10, true);
	const tamanhoDoCabecalho = view.getUint32(14, true);
	// So o BITMAPINFOHEADER e os maiores (V4/V5); o de 12 bytes (OS/2) tem outra forma.
	if (tamanhoDoCabecalho < 40) return null;
	const largura = view.getInt32(18, true);
	const alturaCrua = view.getInt32(22, true);
	const bpp = view.getUint16(28, true);
	const compressao = view.getUint32(30, true);
	if (compressao !== 0) return null;
	if (bpp !== 1 && bpp !== 4 && bpp !== 8 && bpp !== 24) return null;
	if (largura <= 0 || alturaCrua === 0) return null;
	const altura = Math.abs(alturaCrua);
	const deBaixoParaCima = alturaCrua > 0;
	if (largura > 8192 || altura > 8192) return null;

	let paleta = null;
	if (bpp <= 8) {
		const usadas = view.getUint32(46, true);
		const cores = usadas === 0 ? 1 << bpp : usadas;
		if (cores > 1 << bpp) return null;
		const inicioDaPaleta = 14 + tamanhoDoCabecalho;
		if (inicioDaPaleta + cores * 4 > inicioDosPixels) return null;
		paleta = new Array(cores);
		for (let i = 0; i < cores; i++) {
			const p = inicioDaPaleta + i * 4;
			paleta[i] = [bytes[p + 2], bytes[p + 1], bytes[p]];
		}
	}

	const passo = Math.floor((largura * bpp + 31) / 32) * 4;
	if (inicioDosPixels + passo * altura > bytes.length) return null;

	const data = new Uint8ClampedArray(largura * altura * 4);
	for (let y = 0; y < altura; y++) {
		const linha = inicioDosPixels + (deBaixoParaCima ? altura - 1 - y : y) * passo;
		for (let x = 0; x < largura; x++) {
			let r, g, b;
			if (bpp === 24) {
				const p = linha + x * 3;
				b = bytes[p];
				g = bytes[p + 1];
				r = bytes[p + 2];
			} else {
				const bit = x * bpp;
				const byte = bytes[linha + (bit >> 3)];
				const indice = (byte >> (8 - bpp - (bit & 7))) & ((1 << bpp) - 1);
				const cor = paleta[indice];
				if (cor === undefined) return null;
				r = cor[0];
				g = cor[1];
				b = cor[2];
			}
			const o = (y * largura + x) * 4;
			if (ehMagenta(r, g, b)) {
				data[o] = data[o + 1] = data[o + 2] = data[o + 3] = 0;
			} else {
				data[o] = r;
				data[o + 1] = g;
				data[o + 2] = b;
				data[o + 3] = 255;
			}
		}
	}
	return { width: largura, height: altura, data };
}
