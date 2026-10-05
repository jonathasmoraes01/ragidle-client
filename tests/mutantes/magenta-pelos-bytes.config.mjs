// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
// Uso: RAG_MUTANTE_MAGENTA=<nome> npx vitest run --config tests/mutantes/magenta-pelos-bytes.config.mjs
// Cada mutante tem de REPROVAR tests/util/bmpComChave.test.js ou tests/util/Texture.test.js (D-1988).
import base from '../../vite.config.js';

const BMP = 'src/Utils/bmpComChave.js';
const TEXTURA = 'src/Utils/Texture.js';
const mutantes = {
	// o limiar afrouxa no verde
	'limiar-do-verde': [BMP, 'g < 20', 'g <= 20'],
	// o magenta nao sai
	'sem-chave': [BMP, 'return r > 230 && g < 20 && b > 230;', 'return false;'],
	// o magenta sai opaco (preto)
	'alfa-opaco': [BMP, 'data[o] = data[o + 1] = data[o + 2] = data[o + 3] = 0;', 'data[o] = data[o + 1] = data[o + 2] = 0; data[o + 3] = 255;'],
	// a paleta e lida como RGB, e nao BGR
	'paleta-rgb': [BMP, 'paleta[i] = [bytes[p + 2], bytes[p + 1], bytes[p]];', 'paleta[i] = [bytes[p], bytes[p + 1], bytes[p + 2]];'],
	// o 24 bits troca vermelho e azul
	'24-rgb': [BMP, 'b = bytes[p];\n\t\t\t\tg = bytes[p + 1];\n\t\t\t\tr = bytes[p + 2];', 'r = bytes[p];\n\t\t\t\tg = bytes[p + 1];\n\t\t\t\tb = bytes[p + 2];'],
	// a imagem de baixo para cima nao e virada
	'sem-virar': [BMP, '(deBaixoParaCima ? altura - 1 - y : y)', 'y'],
	// a linha sem preenchimento ate 4 bytes
	'sem-preenchimento': [BMP, 'Math.floor((largura * bpp + 31) / 32) * 4', 'Math.ceil((largura * bpp) / 8)'],
	// o indice de 4/1 bit lido do lado errado do byte
	'bit-errado': [BMP, '(byte >> (8 - bpp - (bit & 7)))', '(byte >> (bit & 7))'],
	// BMP comprimido aceito como se nao fosse
	'aceita-comprimido': [BMP, 'if (compressao !== 0) return null;', ''],
	// arquivo truncado aceito
	'aceita-truncado': [BMP, 'if (inicioDosPixels + passo * altura > bytes.length) return null;', ''],
	// o funil nao e usado: todo BMP volta ao caminho da leitura do canvas
	'sem-funil': [TEXTURA, "data.startsWith('blob:')", "data.startsWith('blob-nunca:')"],
	// o funil decodifica mas entrega o caminho antigo
	'funil-ignorado': [TEXTURA, '\t\t\t\t\tif (!pronto) {\n\t\t\t\t\t\tcarregarPelaImagem', '\t\t\t\t\tif (true) {\n\t\t\t\t\t\tcarregarPelaImagem'],
	// o caminho antigo perde o criterio
	'remove-sem-criterio': [TEXTURA, 'if (ehMagenta(data[i], data[i + 1], data[i + 2])) {', 'if (false) {']
};
const mutante = mutantes[process.env.RAG_MUTANTE_MAGENTA];
if (!mutante) throw new Error('Escolha RAG_MUTANTE_MAGENTA: ' + Object.keys(mutantes).join(', ') + '.');
const [ALVO, de, para] = mutante;

export default {
	...base,
	plugins: [
		{
			name: 'magenta-pelos-bytes-somente-em-memoria',
			enforce: 'pre',
			transform(codigo, id) {
				if (!id.replaceAll('\\', '/').endsWith(ALVO)) return null;
				const normal = codigo.replace(/\r\n/g, '\n');
				if (normal.split(de).length !== 2) throw new Error('Mutante nao casa exatamente uma vez.');
				return normal.replace(de, para);
			}
		}
	],
	test: { ...base.test, include: ['tests/util/bmpComChave.test.js', 'tests/util/Texture.test.js'] }
};

export const NOMES = Object.keys(mutantes);
