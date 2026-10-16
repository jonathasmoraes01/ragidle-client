// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
//
// O RESUMO DA VOLTA VEM ANTES DA "NOVIDADES" (D-2595, 16/10/2026): cada mutante e um jeito de o cartaz de
// boas-vindas voltar a cobrir o resumo do Dormir ou "Enquanto voce esteve fora", ou de a "Novidades" se perder.
//
//   RAG_MUTANTE_RESUMO=<nome> npx vitest run --config tests/mutantes/resumo-antes-das-novidades.config.mjs
//
// Sem `RAG_MUTANTE_RESUMO` roda o CONTROLE (tem de passar). Todos de uma vez, com as costuras no disco:
//   node scripts/mutantes-resumo-antes-das-novidades.mjs
import base from '../../vite.config.js';

const FILA = 'src/UI/resumoAntesDasNovidades.js';
const CARTAZ = 'src/UI/Components/BoasVindasIdle/BoasVindasIdle.js';
const UIM = 'src/UI/UIManager.js';
const AUSENCIA = 'src/UI/Components/AusenciaIdle/AusenciaIdle.js';
const TUTORIAL = 'src/UI/Components/TutorialIdle/TutorialIdle.js';

export const mutantes = {
	// a Novidades abre mesmo com o resumo na tela (o defeito original)
	pedeSemOlhar: [FILA, '\t\t\tif (abertos.size > 0) {\n\t\t\t\tnovidadesPendente = true;\n\t\t\t\treturn false;\n\t\t\t}\n', ''],
	// o resumo que chega depois nao tira o cartaz da frente
	naoEsconde: [FILA, '\t\t\t\tnovidades.esconder();\n', ''],
	// o cartaz sai da frente e nunca volta
	esconderSemPendente: [
		FILA,
		'\t\t\t\tnovidades.esconder();\n\t\t\t\tnovidadesPendente = true;\n',
		'\t\t\t\tnovidades.esconder();\n'
	],
	// a Novidades abre quando o PRIMEIRO resumo fecha, com outro ainda na tela
	fechaComOutroAberto: [FILA, 'if (abertos.size === 0 && novidadesPendente) {', 'if (novidadesPendente) {'],
	// fechar o resumo nao abre a Novidades que esperava
	fechaNaoMostra: [
		FILA,
		'\t\t\t\tnovidadesPendente = false;\n\t\t\t\tif (novidades) {\n\t\t\t\t\tnovidades.mostrar();\n\t\t\t\t}\n\t\t\t}\n\t\t},',
		'\t\t\t\tnovidadesPendente = false;\n\t\t\t}\n\t\t},'
	],
	// o pedido com o resumo na tela se perde (nao fica pendente)
	pedidoNaoFicaPendente: [FILA, '\t\t\t\tnovidadesPendente = true;\n\t\t\t\treturn false;', '\t\t\t\treturn false;'],
	// a troca de personagem nao esquece os resumos (o tutorial do proximo ficaria cedendo para sempre)
	esquecerNaoLimpa: [FILA, '\t\t\tabertos.clear();\n', ''],
	// a troca de personagem deixa a Novidades pendente (abriria na tela do proximo ao fechar um popup velho)
	esquecerMostra: [FILA, '\t\t\tabertos.clear();\n\t\t\tnovidadesPendente = false;\n', '\t\t\tabertos.clear();\n'],
	// a leitura do cartaz que lanca derruba quem abriu o resumo
	leituraLanca: [FILA, '\t\t} catch {\n\t\t\treturn false;\n\t\t}', '\t\t} finally {\n\t\t\t/* nada */\n\t\t}'],
	// o tutorial nunca sabe do resumo
	haResumoSempreFalso: [FILA, '\t\t\treturn abertos.size > 0;\n', '\t\t\treturn false;\n'],
	// o cartaz abre direto, sem a fila (a BASE)
	cartazSemFila: [CARTAZ, '\tfilaDaVolta.pedirNovidades();\n};', '\tBoasVindasIdle.mostrar();\n};'],
	// a troca de personagem no cartaz nao esquece a espera
	cartazNaoEsquece: [CARTAZ, '\tfilaDaVolta.esquecer(); // D-2595', '\t// D-2595']
};

/*
 * AS COSTURAS que o jsdom nao monta (o popup do sono, a janela da ausencia, o tutorial) sao lidas do DISCO pelo teste,
 * e a mutacao daqui e so na memoria: elas sao medidas no disco, com restauro por COPIA, pelo laco
 * `scripts/mutantes-resumo-antes-das-novidades.mjs` (que roda as duas listas).
 */
export const COSTURAS_NO_DISCO = {
	sonoNaoAbre: [UIM, "\t\tfilaDaVolta.resumoAbriu('sono');\n", ''],
	sonoNaoFecha: [UIM, "\t\t\tfilaDaVolta.resumoFechou('sono');\n", ''],
	sonoFechaDepoisDeVoltar: [
		UIM,
		"\t\t\tfilaDaVolta.resumoFechou('sono');\n\t\t\tonContinuar();\n",
		"\t\t\tonContinuar();\n\t\t\tfilaDaVolta.resumoFechou('sono');\n"
	],
	ausenciaNaoAbre: [AUSENCIA, "\t\tfilaDaVolta.resumoAbriu('ausencia');\n", ''],
	ausenciaNaoFecha: [AUSENCIA, "\tfilaDaVolta.resumoFechou('ausencia');\n", ''],
	ausenciaLimpaFechando: [AUSENCIA, '\tfilaDaVolta.esquecer(); // D-2595', "\tfilaDaVolta.resumoFechou('ausencia'); // D-2595"],
	tutorialNaoCede: [TUTORIAL, '\t\t!filaDaVolta.haResumoAberto() &&\n', ''],
	botaoSemPisoTatil: [UIM, "\t\t\tcontinuar.classList.add('ri-btn--dedo');\n", ''],
	pisoTatilForaDoDedo: [
		'src/UI/Common.css',
		'\t.ri-btn--dedo {\n\t\tmin-height: var(--hit-touch, 44px);\n\t}\n',
		''
	]
};

const nome = process.env.RAG_MUTANTE_RESUMO || '';
const mutante = nome ? mutantes[nome] : null;
if (nome && !mutante) throw new Error(`Escolha RAG_MUTANTE_RESUMO: ${Object.keys(mutantes).join(', ')}.`);

export default {
	...base,
	plugins: mutante
		? [
				{
					name: 'resumo-antes-das-novidades-somente-em-memoria',
					enforce: 'pre',
					transform(codigo, id) {
						if (!id.replaceAll('\\', '/').endsWith(mutante[0])) return null;
						const normalizado = codigo.replaceAll('\r\n', '\n');
						if (normalizado.split(mutante[1]).length !== 2) throw new Error('Mutante nao casa exatamente uma vez.');
						return normalizado.replace(mutante[1], () => mutante[2]);
					}
				}
			]
		: [],
	test: {
		...base.test,
		include: ['tests/ui/resumoAntesDasNovidades.test.js']
	}
};
