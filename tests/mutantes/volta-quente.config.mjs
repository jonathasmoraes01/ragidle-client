// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
//
// A VOLTA QUENTE (D-2576, 15/10/2026): cada mutante e um jeito de a reconexao manter uma cena que nao serve (o login
// que herda a cena, a carga em curso atropelada, o contexto WebGL perdido), de nunca manter (a carga de sempre), ou de
// a espera pelo MAPMOVE da volta montar duas vezes, nunca montar, ou esperar demais. Alvo: `Engine/voltaQuente.js`.
//
//   RAG_MUTANTE_VOLTA_QUENTE=<nome> npx vitest run --config tests/mutantes/volta-quente.config.mjs
//
// Todos de uma vez (bash), contando o mutante que NAO casa como invalido:
//   for m in semVolta nuncaMantem semNome ignoraCarga ignoraContexto prazoLongo mapaNaoCancela aceiteNaoMonta \
//            esperaNaoSubstitui cancelarNaoDesagenda montaDuasVezes; do
//     RAG_MUTANTE_VOLTA_QUENTE=$m npx vitest run --config tests/mutantes/volta-quente.config.mjs > m.log 2>&1;
//     if grep -q "nao casa" m.log; then echo "$m INVALIDO"; elif grep -q "Tests .*failed" m.log; then echo "$m morto"; else echo "$m SOBREVIVEU"; fi; done
//
// A COSTURA no `Engine/MapEngine.js` nao se mede aqui: o teste a le do DISCO.
import base from '../../vite.config.js';

const ALVO = 'src/Engine/voltaQuente.js';

const mutantes = {
	// o login e a troca de servidor tambem mantem a cena
	semVolta: [ALVO, '\tif (!c || c.volta !== true) return false;\n', '\tif (!c) return false;\n'],
	// nunca mantem (a carga de sempre)
	nuncaMantem: [ALVO, '\treturn c.contextoPerdido !== true;\n}', '\treturn false;\n}'],
	// mantem sem mapa desenhado
	semNome: [ALVO, "\tif (typeof c.mapaNaCena !== 'string' || c.mapaNaCena === '') return false;\n", ''],
	// mantem com uma carga em curso
	ignoraCarga: [ALVO, '\tif (c.carregando === true) return false;\n', ''],
	// mantem com o contexto perdido
	ignoraContexto: [ALVO, '\treturn c.contextoPerdido !== true;\n}', '\treturn true;\n}'],
	// a entrada sem MAPMOVE espera 10 s
	prazoLongo: [ALVO, 'export const PRAZO_DO_MAPA_DA_VOLTA_MS = 1500;', 'export const PRAZO_DO_MAPA_DA_VOLTA_MS = 10000;'],
	// o MAPMOVE nao cancela a montagem pelo aceite (a cena monta duas vezes)
	mapaNaoCancela: [ALVO, '\t\tconst havia = timer !== null;\n\t\tcancelar();\n\t\treturn havia;', '\t\treturn timer !== null;'],
	// sem MAPMOVE o aceite nunca monta (a entrada trava)
	aceiteNaoMonta: [ALVO, '\t\t\ttimer = null;\n\t\t\tmontarPeloAceite();\n', '\t\t\ttimer = null;\n'],
	// o aceite novo nao substitui o velho (os dois montam)
	esperaNaoSubstitui: [ALVO, '\tfunction esperar(montarPeloAceite) {\n\t\tcancelar();\n', '\tfunction esperar(montarPeloAceite) {\n'],
	// `cancelar` nao desagenda
	cancelarNaoDesagenda: [ALVO, '\t\t\tdesagendar(timer);\n\t\t\ttimer = null;\n\t\t}\n\t}\n\n\treturn', '\t\t\ttimer = null;\n\t\t}\n\t}\n\n\treturn'],
	// a montagem pelo aceite nao zera o relogio (o MAPMOVE de depois acha que cancelou algo)
	montaDuasVezes: [ALVO, '\t\t\ttimer = null;\n\t\t\tmontarPeloAceite();\n', '\t\t\tmontarPeloAceite();\n']
};
const mutante = mutantes[process.env.RAG_MUTANTE_VOLTA_QUENTE];
if (!mutante) throw new Error(`Escolha RAG_MUTANTE_VOLTA_QUENTE: ${Object.keys(mutantes).join(', ')}.`);

export default {
	...base,
	plugins: [
		{
			name: 'volta-quente-somente-em-memoria',
			enforce: 'pre',
			transform(codigo, id) {
				if (!id.replaceAll('\\', '/').endsWith(mutante[0])) return null;
				const normalizado = codigo.replaceAll('\r\n', '\n');
				if (normalizado.split(mutante[1]).length !== 2) throw new Error('Mutante nao casa exatamente uma vez.');
				return normalizado.replace(mutante[1], mutante[2]);
			}
		}
	],
	test: { ...base.test, include: ['tests/ui/voltaQuente.test.js'] }
};
