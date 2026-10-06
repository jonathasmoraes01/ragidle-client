// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
//
// DEVOLVER O CARRINHO (R110, D-2044, 06/10/2026). Cada mutante e um jeito de a
// metade do cliente mentir: o botao "sim" sem o rotulo do dono, o rotulo do
// servidor aceito vazio ou comprido demais, a caixa que nao cresce (o texto
// sobre os itens escondido) ou que passa da tela, e as costuras — o botao que
// nao pede, o pedido no pacote errado, o ZC_CARTOFF que nao fecha nem esvazia.
//
//   RAG_MUTANTE_DEVOLUCAO=<nome> npx vitest run --config tests/mutantes/devolucao-do-carrinho.config.mjs
//
// Um mutante MORTO faz a corrida reprovar.
//
// DUAS PORTAS, o mesmo mutante: a regra pura e IMPORTADA pelo teste (o
// `transform` do Vite a alcanca), e as costuras sao LIDAS do disco pelo teste
// (`readFileSync`), que o Vite nao ve — para elas o `setupFiles` embrulha o
// `readFileSync` do worker. Nos dois casos o arquivo em disco fica intacto.
import base from '../../vite.config.js';
import { MUTANTES_DA_DEVOLUCAO } from './devolucao-do-carrinho.mutantes.mjs';

const mutante = MUTANTES_DA_DEVOLUCAO[process.env.RAG_MUTANTE_DEVOLUCAO];
if (!mutante) throw new Error(`Escolha RAG_MUTANTE_DEVOLUCAO: ${Object.keys(MUTANTES_DA_DEVOLUCAO).join(', ')}.`);

export default {
	...base,
	plugins: [
		{
			name: 'devolucao-do-carrinho-somente-em-memoria',
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
		include: ['tests/ui/devolucaoDoCarrinho.test.js'],
		setupFiles: ['tests/mutantes/devolucao-do-carrinho.setup.mjs']
	}
};

export const NOMES = Object.keys(MUTANTES_DA_DEVOLUCAO);
