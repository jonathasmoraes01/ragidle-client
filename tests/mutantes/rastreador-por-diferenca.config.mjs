// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
//
// A DIFERENCA DO RASTREADOR DO CODEX (`v: 5`, D-2543). Cada mutante e um jeito de o cartao da HUD
// mostrar outro contador que o do servidor, ou de o fio voltar a carregar o rastreador inteiro: o
// modulo puro (`rastreadorDoCodex.js`: anotar com a revisao, aplicar so sobre `de`, declarar) e a
// costura em `MissoesIdle.js` (o ramo do `v: 5`, o pedido da lista que nao cai, a declaracao).
//
//   RAG_MUTANTE_RASTREADOR=<nome> npx vitest run --config tests/mutantes/rastreador-por-diferenca.config.mjs
//   node scripts/mutantes-rastreador-por-diferenca.mjs     # o laco: todos, contando mortos
//
// Um mutante MORTO faz a corrida reprovar. Mutante que NAO CASA exatamente uma vez lanca no
// `transform` com "nao casa", e o laco o conta a parte (nunca como morto).
import base from '../../vite.config.js';

const MODULO = 'src/UI/Components/rastreadorDoCodex.js';
const JANELA = 'src/UI/Components/MissoesIdle/MissoesIdle.js';

export const mutantes = {
	// ---- o modulo puro ----
	// a diferenca reconhecida so pela versao (outro `parcial` com v 5 seria aplicado)
	versaoSemMarcador: [MODULO, "return !!dados && dados.v === 5 && dados.parcial === 'codexRastreadoDif';", 'return !!dados && dados.v === 5;'],
	// a diferenca cai sem conferir `de` (aplica sobre uma lista que nao e a do servidor)
	semConferirDe: [MODULO, ' || rev === null || dados.de !== rev || ', ' || rev === null || '],
	// a diferenca que nao cai mantem a revisao (a seguinte cai sobre a lista velha)
	recusaMantemRev: [MODULO, "!Array.isArray(dados.trocas)) {\n\t\trev = null;\n\t\treturn false;", "!Array.isArray(dados.trocas)) {\n\t\treturn false;"],
	// trocas que montam outra coisa que uma lista passam
	podreAceita: [MODULO, '\tif (!Array.isArray(montada)) {', '\tif (!montada) {'],
	// a revisao nao anda com a diferenca
	revNaoAnda: [MODULO, "\trev = typeof dados.rev === 'number' ? dados.rev : null;\n\treturn true;", '\trev = dados.de;\n\treturn true;'],
	// o inteiro anotado sem a revisao
	anotaSemRev: [MODULO, "\trev = typeof revisao === 'number' ? revisao : null;", '\trev = null;'],
	// declara a cada inteiro
	declaraSempre: [MODULO, 'if (rev === null || (revDeclarada !== null && rev > revDeclarada)) {', 'if (rev === null) {'],
	// nunca redeclara (a conexao nova fica sem a diferenca)
	nuncaRedeclara: [MODULO, 'if (rev === null || (revDeclarada !== null && rev > revDeclarada)) {', 'if (rev === null || revDeclarada !== null) {'],
	// declara ao servidor que nao numera
	declaraSemRev: [MODULO, 'if (rev === null || (revDeclarada !== null && rev > revDeclarada)) {', 'if (revDeclarada !== null && rev > revDeclarada) {'],
	// a declaracao nao e lembrada
	naoLembra: [MODULO, '\trevDeclarada = rev;\n\treturn {', '\treturn {'],
	// a declaracao sem a revisao na mao
	baseErrada: [MODULO, 'return { acao: ACAO_QUE_DECLARA_O_RASTREADOR, base: rev };', 'return { acao: ACAO_QUE_DECLARA_O_RASTREADOR, base: null };'],
	// o verbo errado (o servidor nao ouve)
	verboErrado: [MODULO, "export const ACAO_QUE_DECLARA_O_RASTREADOR = 'declarar-rastreador';", "export const ACAO_QUE_DECLARA_O_RASTREADOR = 'declarar';"],
	// a troca de personagem guarda a revisao
	limparSemRev: [MODULO, '\tlista = [];\n\trev = null;\n\trevDeclarada = null;', '\tlista = [];\n\trevDeclarada = null;'],
	// a troca de personagem guarda a declaracao
	limparSemDeclarada: [MODULO, '\tlista = [];\n\trev = null;\n\trevDeclarada = null;', '\tlista = [];\n\trev = null;'],

	// ---- a costura em MissoesIdle.js ----
	// ninguem trata o `v: 5` (o contador para)
	semRamo: [JANELA, '\tif (ehCorpoDiferencaDoRastreador(dados)) {', '\tif (false) {'],
	// a diferenca que nao cai nao pede a lista (o contador fica parado ate o proximo inteiro)
	naoPede: [JANELA, "\t\t\tpedirAListaInteiraUmaVez('a diferenca do rastreador do Codex nao cai sobre a revisao que esta aqui');\n", ''],
	// pede a lista a cada diferenca que nao cai (a lista inteira por abate)
	pedeSempre: [JANELA, '\tif (_pediuAListaInteira) {\n\t\treturn;\n\t}\n\t_pediuAListaInteira = true;', '\t_pediuAListaInteira = true;'],
	// o `v: 2` sem a revisao
	v2SemRev: [JANELA, '\t\tanotarRastreadorDoCodex(dados.codexRastreado, dados.codexRastreadoRev);\n\t\treturn;', '\t\tanotarRastreadorDoCodex(dados.codexRastreado);\n\t\treturn;'],
	// o inteiro sem a revisao
	inteiroSemRev: [JANELA, '\tanotarRastreadorDoCodex(dados.codexRastreado, dados.codexRastreadoRev);\n\tdeclararORastreador();', '\tanotarRastreadorDoCodex(dados.codexRastreado);\n\tdeclararORastreador();'],
	// o inteiro nao declara
	naoDeclara: [JANELA, '\tanotarRastreadorDoCodex(dados.codexRastreado, dados.codexRastreadoRev);\n\tdeclararORastreador();', '\tanotarRastreadorDoCodex(dados.codexRastreado, dados.codexRastreadoRev);'],
	// a declaracao sai no pacote errado
	pacoteErrado: [JANELA, '\t\tconst pkt = new PACKET.CZ.RAGIDLE_MISSAO_ACAO();\n\t\tpkt.json = JSON.stringify(corpo);', '\t\tconst pkt = new PACKET.CZ.RAGIDLE_PEDIR_MISSOES();\n\t\tpkt.json = JSON.stringify(corpo);'],
	// a declaracao sem guarda (um erro derruba o recebimento da lista)
	declaraSemGuarda: [JANELA, "\t} catch (err) {\n\t\tconsole.error('[MissoesIdle] a declaracao do rastreador falhou', err);\n\t}", '\t} finally {\n\t}']
};

export const NOMES = Object.keys(mutantes);

const nome = process.env.RAG_MUTANTE_RASTREADOR;
const mutante = mutantes[nome];
if (nome && !mutante) throw new Error(`Escolha RAG_MUTANTE_RASTREADOR: ${NOMES.join(', ')}.`);

export default {
	...base,
	plugins: [
		...(base.plugins || []),
		...(mutante
			? [
					{
						name: 'rastreador-por-diferenca-somente-em-memoria',
						enforce: 'pre',
						transform(codigo, id) {
							if (!id.replaceAll(String.fromCharCode(92), '/').split('?')[0].endsWith(mutante[0])) return null;
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
		include: ['tests/ui/rastreadorPorDiferenca.test.js']
	}
};
