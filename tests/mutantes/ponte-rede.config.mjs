// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
//
// O PING DA REDE NA PONTE (achados 19 e 20 da varredura de rede, 15/10/2026, D-2540 no servidor).
// Cada mutante e um jeito de a medida mentir: o tempo errado, o pong alheio contado, o percentil
// deslocado, a fila alta mal contada, a janela que nao zera ou o teto que some.
//
//   RAG_MUTANTE_REDE=<nome> npx vitest run --config tests/mutantes/ponte-rede.config.mjs
import base from '../../vite.config.js';

const ALVO = 'wsproxyRede.js';

export const mutantes = {
	tempoAoContrario: [ALVO, 'return agora - saiu;', 'return saiu - agora;'],
	pongAlheioConta: [ALVO, 'if (!/^\\d{1,16}$/.test(texto)) return null;', ''],
	relogioQueVolta: [ALVO, 'if (!Number.isSafeInteger(saiu) || agora < saiu) return null;', 'if (!Number.isSafeInteger(saiu)) return null;'],
	percentilDeslocado: [ALVO, 'Math.ceil((p / 100) * ordenadas.length) - 1', 'Math.ceil((p / 100) * ordenadas.length)'],
	filaAltaComMaior: [ALVO, 'if (bytes >= FILA_ALTA_BYTES) this.filasAltas++;', 'if (bytes > FILA_ALTA_BYTES) this.filasAltas++;'],
	janelaNaoZera: [ALVO, '\t\tconst maiorFila = this.maiorFila;\n\t\tthis.medidas = [];', '\t\tconst maiorFila = this.maiorFila;'],
	semTeto: [ALVO, 'if (this.medidas.length < this.teto) this.medidas.push(ms);', 'this.medidas.push(ms);'],
	invalidoEntra: [ALVO, '\t\tif (!Number.isFinite(ms) || ms < 0) return;\n\t\tif (this.medidas', '\t\tif (this.medidas'],
	semOrdenar: [ALVO, 'const ordenadas = medidas.slice().sort((a, b) => a - b);', 'const ordenadas = medidas.slice();']
};

const nome = process.env.RAG_MUTANTE_REDE;
const mutante = mutantes[nome];
if (nome && !mutante) throw new Error(`Escolha RAG_MUTANTE_REDE: ${Object.keys(mutantes).join(', ')}.`);

export default {
	...base,
	plugins: [
		...(mutante
			? [
					{
						name: 'ponte-rede-somente-em-memoria',
						enforce: 'pre',
						transform(codigo, id) {
							if (!id.replaceAll(String.fromCharCode(92), '/').endsWith(mutante[0])) return null;
							const normalizado = codigo.replaceAll('\r\n', '\n');
							if (normalizado.split(mutante[1]).length !== 2) throw new Error(`Mutante ${nome} nao casa exatamente uma vez.`);
							return normalizado.replace(mutante[1], mutante[2]);
						}
					}
				]
			: [])
	],
	test: {
		...base.test,
		include: ['tests/wsproxy-rede.test.js']
	}
};
