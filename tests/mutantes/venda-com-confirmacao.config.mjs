// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
//
// A VENDA SEM ENGANO (16/10/2026, terceiro relato do dono). Cada mutante e um
// jeito de a janela voltar a vender a mochila sem o jogador querer: vender sem
// o modal, o Enter confirmar, o duplo clique vender duas vezes, o ESC fechar a
// loja em vez do modal, a flecha vestida entrar, o aviso de carta sumir.
//
//   RAG_MUTANTE_VENDA=<nome> npx vitest run --config tests/mutantes/venda-com-confirmacao.config.mjs
//
// Um mutante MORTO faz a corrida reprovar.
import base from '../../vite.config.js';

const JANELA = 'src/UI/Components/NpcStore/NpcStoreV2/NpcStoreV2.js';
const REGRA = 'src/UI/Components/NpcStore/NpcStoreV2/confirmacaoDaVenda.js';

const mutantes = {
	// "Vender" manda direto, sem o modal
	semModal: [JANELA, '\t\tif (!_confirmacao) {\n\t\t\tabrirConfirmacao(escolha);\n\t\t}\n\t\treturn;', '\t\tenviarEscolha(escolha);\n\t\treturn;'],
	// o duplo clique no botao vermelho vende duas vezes
	semTravaDoDuploClique: [JANELA, '\t// Fecha ANTES de mandar: e isto que faz o segundo toque nao achar nada.\n\tfecharConfirmacao();\n', ''],
	// o Enter segue para o botao (pode confirmar)
	enterPassa: [JANELA, "\t\tif (e.key === 'Enter' || e.which === 13) {\n\t\t\te.preventDefault();\n\t\t\te.stopPropagation();\n\t\t} else if", "\t\tif (false) {\n\t\t} else if"],
	// o foco nasce no botao vermelho
	focoNoVender: [JANELA, "\tconst cancelar = conf.querySelector('.ns-conf-cancelar');", "\tconst cancelar = conf.querySelector('.ns-conf-vender');"],
	// o ESC fecha a loja com o modal aberto
	escFechaALoja: [JANELA, '\t\tif (_confirmacao) {\n\t\t\tfecharConfirmacao();\n\t\t\treturn false;\n\t\t}\n', ''],
	// o modal nao entra na lista de baloes (o ESC da pilha fecharia a loja)
	semBalao: [JANELA, '\tabrirBalao(BALAO_DA_VENDA, () => fecharConfirmacao());\n', ''],
	// o "Vender" do modal manda o que esta marcado AGORA, e nao a copia
	semCopia: [JANELA, 'escolha: escolha.map(o => Object.assign({}, o))', 'escolha'],
	// a municao vestida volta a lista de venda
	vestidoEntra: [JANELA, 'const vestido = !!(it && it.WearState);', 'const vestido = false;'],
	// o "Desmarcar tudo" nunca aparece
	desmarcarSempreEscondido: [JANELA, "\troot.querySelector('.ns-desmarcar').hidden = !algoEscolhido();", "\troot.querySelector('.ns-desmarcar').hidden = true;"],
	// o "Desmarcar tudo" so zera a vista
	desmarcarSoAVista: [JANELA, '\tfor (const index of totalIndicesDoInput()) {\n\t\taplicarQuantidade(index, 0);', '\tfor (const index of _visiveis) {\n\t\taplicarQuantidade(index, 0);'],
	// fechar a loja deixa o modal aberto
	removerSemFechar: [JANELA, '\tfecharConfirmacao();\n\n\tconst root = NpcStore.getRoot();', '\n\tconst root = NpcStore.getRoot();'],
	// a carta deixa de contar no aviso
	cartaSemAviso: [REGRA, "\tif (linha.tipo === ItemType.CARD) {\n\t\tmotivos.push('carta');", "\tif (false) {\n\t\tmotivos.push('carta');"],
	// o refino deixa de destacar
	refinoSemEtiqueta: [REGRA, "\t\tif ((linha.refino || 0) > 0) {", '\t\tif (false) {'],
	// o rodape volta a dizer so "N itens (M tipos)" sem o valor
	rodapeSemValor: [REGRA, 'return `Vender ${r.unidades} itens (${r.tipos} tipos) por ${zeny(r.total)} z`;', 'return `${r.unidades} itens (${r.tipos} tipos)`;'],
	// o botao de massa volta a nao dizer quantos
	rotuloSemQuantos: [REGRA, 'comBusca ? `Marcar tudo da busca (${n})` : `Marcar tudo desta aba (${n})`', "comBusca ? 'Tudo à vista' : 'Tudo no máx'"]
};
const mutante = mutantes[process.env.RAG_MUTANTE_VENDA];
if (!mutante) throw new Error(`Escolha RAG_MUTANTE_VENDA: ${Object.keys(mutantes).join(', ')}.`);

export default {
	...base,
	plugins: [
		{
			name: 'venda-com-confirmacao-somente-em-memoria',
			enforce: 'pre',
			transform(codigo, id) {
				if (!id.replaceAll('\\', '/').endsWith(mutante[0])) return null;
				const normalizado = codigo.replaceAll('\r\n', '\n');
				if (normalizado.split(mutante[1]).length !== 2) throw new Error('Mutante nao casa exatamente uma vez.');
				return normalizado.replace(mutante[1], mutante[2]);
			}
		}
	],
	test: { ...base.test, include: ['tests/ui/vendaComConfirmacao.test.js', 'tests/ui/tudoNoMaxRespeitaAVista.test.js'] }
};

export const NOMES = Object.keys(mutantes);
