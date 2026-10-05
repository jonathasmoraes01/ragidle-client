// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
//
// OS ATALHOS DA COMPRA, "70%" e "Máx" (05/10/2026). Cada mutante e um jeito de
// o atalho mentir: passar do degrau em que a regeneracao para, deixar a compra
// estourar o teto do servidor, esquecer o resto da compra ou o zeny, ou
// aparecer onde nao serve. Dois alvos: a conta (`quantidadeDeCompra.js`) e a
// costura na janela (`NpcStoreV2.js`), ambos alcancados pelo jsdom.
//
//   RAG_MUTANTE_COMPRA=<nome> npx vitest run --config tests/mutantes/atalhos-da-compra.config.mjs
//
// Um mutante MORTO faz a corrida reprovar.
import base from '../../vite.config.js';

const CONTA = 'src/UI/Components/NpcStore/NpcStoreV2/quantidadeDeCompra.js';
const JANELA = 'src/UI/Components/NpcStore/NpcStoreV2/NpcStoreV2.js';

const mutantes = {
	// o degrau vira 90
	degrau90: [CONTA, 'export const PERCENTUAL_PARA_CACAR = 70;', 'export const PERCENTUAL_PARA_CACAR = 90;'],
	// exatamente 70% passa a valer (o >= da fonte vira >)
	setentaInclusivo: [CONTA, '\treturn Math.ceil(folga / (100 * pesoDoItem)) - 1;', '\treturn Math.floor(folga / (100 * pesoDoItem));'],
	// o que ja se carrega some da conta do 70%
	semPesoAtual70: [CONTA, '100 * (pesoAtual + pesoDoResto)', '100 * pesoDoResto'],
	// o resto da compra some da conta do 70%
	semResto70: [CONTA, '100 * (pesoAtual + pesoDoResto)', '100 * pesoAtual'],
	// a mochila no degrau devolve negativo em vez de zero
	semPisoNoDegrau: [CONTA, '\tif (folga <= 0) {\n\t\treturn 0;\n\t}\n', ''],
	// peso desconhecido vira zero (inventa)
	pesoDesconhecidoInventa: [CONTA, "\tif (typeof pesoDoItem !== 'number' || !(pesoMaximo > 0)) {\n\t\treturn null;", "\tif (!(pesoMaximo > 0)) {\n\t\treturn null;"],
	// o Máx esquece o resto da compra
	maxSemResto: [CONTA, 'const livre = pesoMaximo - pesoAtual - pesoDoResto;', 'const livre = pesoMaximo - pesoAtual;'],
	// o Máx para um abaixo do teto (o servidor aceita o igual)
	maxUmAbaixo: [CONTA, 'return Math.max(0, Math.floor(livre / pesoDoItem));', 'return Math.max(0, Math.ceil(livre / pesoDoItem) - 1);'],
	// o dinheiro esquece o resto da compra
	dinheiroSemResto: [CONTA, 'Math.floor((saldo - custoDoResto) / preco)', 'Math.floor(saldo / preco)'],
	// o 70% passa do Máx
	setentaSemTetoDoMax: [CONTA, 'ateParaCacar: ate === null ? null : Math.max(0, Math.min(maximo, ate))', 'ateParaCacar: ate'],
	// o Máx esquece o teto da linha (estoque)
	maxSemTetoDaLinha: [CONTA, 'Math.min(p.tetoDaLinha, peso, dinheiro)', 'Math.min(peso, dinheiro)'],
	// resto desconhecido vira zero
	restoDesconhecidoViraZero: [CONTA, "const resto = typeof p.pesoDoResto === 'number' ? p.pesoDoResto : null;", 'const resto = p.pesoDoResto || 0;'],
	// a janela da o 70% tambem na venda
	setentaNaVenda: [JANELA, '\treturn !eDeVenda() && !eEscambo();', '\treturn true;'],
	// o botao 70% nunca apaga
	setentaNuncaApaga: [JANELA, '\t\tbotao.disabled = !(ateParaCacar > 0);', '\t\tbotao.disabled = false;'],
	// o clique no 70% usa o Máx
	cliqueTrocado: [JANELA, 'definirQuantidade(index, atalhosDoItem(index).ateParaCacar || 0);', 'definirQuantidade(index, atalhosDoItem(index).maximo);'],
	// o Máx volta ao teto da linha (esquece o resto)
	maxDaLinha: [JANELA, 'definirQuantidade(index, atalhosDoItem(index).maximo);', 'definirQuantidade(index, tetoDoItem(item));'],
	// o resto da compra inclui a propria linha
	restoComALinha: [JANELA, "\t\tif (i === index || !o || !(o.count > 0)) {", '\t\tif (!o || !(o.count > 0)) {'],
	// o resto da compra esquece o custo
	restoSemCusto: [JANELA, '\t\tcusto += precoUnitario(o) * o.count;\n', ''],
	// o estado dos botoes nao e refeito no resumo
	semAtualizarAtalhos: [JANELA, '\tatualizarAtalhosDePeso();\n', '']
};
const mutante = mutantes[process.env.RAG_MUTANTE_COMPRA];
if (!mutante) throw new Error(`Escolha RAG_MUTANTE_COMPRA: ${Object.keys(mutantes).join(', ')}.`);

export default {
	...base,
	plugins: [
		{
			name: 'atalhos-da-compra-somente-em-memoria',
			enforce: 'pre',
			transform(codigo, id) {
				if (!id.replaceAll('\\', '/').endsWith(mutante[0])) return null;
				const normalizado = codigo.replaceAll('\r\n', '\n');
				if (normalizado.split(mutante[1]).length !== 2) throw new Error('Mutante nao casa exatamente uma vez.');
				return normalizado.replace(mutante[1], mutante[2]);
			}
		}
	],
	test: { ...base.test, include: ['tests/ui/atalhosDaCompra.test.js'] }
};

export const NOMES = Object.keys(mutantes);
