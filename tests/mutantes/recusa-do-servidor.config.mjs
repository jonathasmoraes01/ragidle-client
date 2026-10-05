// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
// Uso: RAG_MUTANTE_RECUSA=<nome> npx vitest run --config tests/mutantes/recusa-do-servidor.config.mjs
// Cada mutante tem de REPROVAR tests/ui/recusaDoServidor.test.js.
import base from '../../vite.config.js';

const ALVO = 'src/UI/Components/MochilaIdle/recusaDoServidor.js';
const mutantes = {
	// a recusa velha volta a explicar o pedido de agora
	'sem-janela': ['|| agora - u.em > JANELA_DA_RECUSA_MS', ''],
	// o motivo nao e consumido (o segundo pedido herda o do primeiro)
	'nao-consome': ['\t_ultima = null;\n\tif (!u', '\tif (!u'],
	// o prefixo deixa de aceitar o acento
	'sem-acento': ['N[aã]o deu', 'Nao deu'],
	// qualquer fala do sistema vira motivo
	'qualquer-fala': ['\tif (!m) {\n\t\treturn;\n\t}\n\t_ultima = { motivo: m[1].trim(), em: agora };', '\t_ultima = { motivo: m ? m[1].trim() : msg, em: agora };']
};
const mutante = mutantes[process.env.RAG_MUTANTE_RECUSA];
if (!mutante) throw new Error('Escolha RAG_MUTANTE_RECUSA: ' + Object.keys(mutantes).join(', ') + '.');

export default {
	...base,
	plugins: [
		{
			name: 'recusa-do-servidor-somente-em-memoria',
			enforce: 'pre',
			transform(codigo, id) {
				if (!id.replaceAll('\\', '/').endsWith(ALVO)) return null;
				const normal = codigo.replace(/\r\n/g, '\n');
				if (normal.split(mutante[0]).length !== 2) throw new Error('Mutante nao casa exatamente uma vez.');
				return normal.replace(mutante[0], mutante[1]);
			}
		}
	],
	test: { ...base.test, include: ['tests/ui/recusaDoServidor.test.js'] }
};

export const NOMES = Object.keys(mutantes);
