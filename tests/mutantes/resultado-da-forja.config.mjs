// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
//
// O RESULTADO DA FORJA (D-2506, 16/10/2026): a linha do chat do
// `ZC_ACK_REQMAKINGITEM` e a animacao do `ZC_NOTIFY_EFFECT` (o martelo que
// brilha ou quebra), com as guardas que impedem o cosmetico de derrubar o laco.
//
//   RAG_MUTANTE_FORJA=<nome> npx vitest run --config tests/mutantes/resultado-da-forja.config.mjs
//
// Um mutante MORTO faz a corrida reprovar. Duas portas, como a da devolucao do
// carrinho: a regra pura pelo `transform`, as costuras pelo `readFileSync`.
import base from '../../vite.config.js';
import { MUTANTES_DA_FORJA } from './resultado-da-forja.mutantes.mjs';

const mutante = MUTANTES_DA_FORJA[process.env.RAG_MUTANTE_FORJA];
if (!mutante) throw new Error(`Escolha RAG_MUTANTE_FORJA: ${Object.keys(MUTANTES_DA_FORJA).join(', ')}.`);

export default {
	...base,
	plugins: [
		{
			name: 'resultado-da-forja-somente-em-memoria',
			enforce: 'pre',
			transform(codigo, id) {
				if (!id.replaceAll('\\', '/').endsWith(mutante[0])) return null;
				const normalizado = codigo.replaceAll('\r\n', '\n');
				if (normalizado.split(mutante[1]).length !== 2) throw new Error('Mutante nao casa exatamente uma vez.');
				return normalizado.replace(mutante[1], mutante[2]);
			}
		}
	],
	test: {
		...base.test,
		include: ['tests/ui/resultadoDaForja.test.js'],
		setupFiles: ['tests/mutantes/resultado-da-forja.setup.mjs']
	}
};

export const NOMES = Object.keys(MUTANTES_DA_FORJA);
