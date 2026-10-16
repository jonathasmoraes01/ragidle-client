// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
//
// A RECONEXAO QUE NAO DESISTE E A VOLTA INVISIVEL (D-2575, 15/10/2026): cada mutante e um jeito de a volta do segundo
// plano aparecer ao jogador (o aviso, o "Reconectado", a espera de 10 s), de o teto voltar (o login sem recusa), ou de a
// tentativa reentrar no mapa velho. Alvo: `Network/reconexao.js`.
//
//   RAG_MUTANTE_VOLTA_DISCRETA=<nome> npx vitest run --config tests/mutantes/volta-discreta.config.mjs
//
// Todos de uma vez (bash), contando o mutante que NAO casa como invalido:
//   for m in tetoDeVolta escondidaNaoEVolta janelaZero semJanela prazoZero sempreDiscreto avisoNaoCala \
//            avisoComparaErrado reconectadoSempre voltaEsperaODegrau voltaNaoTentaJa voltaNaoCala avisoVelhoFica \
//            semVigiaDaAba enderecoGuardado semVolta infinitoNaoVira; do
//     RAG_MUTANTE_VOLTA_DISCRETA=$m npx vitest run --config tests/mutantes/volta-discreta.config.mjs > m.log 2>&1;
//     if grep -q "nao casa" m.log; then echo "$m INVALIDO"; elif grep -q "Tests .*failed" m.log; then echo "$m morto"; else echo "$m SOBREVIVEU"; fi; done
import base from '../../vite.config.js';

const ALVO = 'src/Network/reconexao.js';

const mutantes = {
	// o teto volta: 12 tentativas e o login, sem recusa nenhuma
	tetoDeVolta: [
		ALVO,
		'\t_tentativaEmAndamento = true;\n\t_geracao++;\n\tconst minhaGeracao = _geracao;\n',
		'\tif (_indice >= 12) {\n\t\tdesistirEIrParaOLogin();\n\t\treturn;\n\t}\n\t_tentativaEmAndamento = true;\n\t_geracao++;\n\tconst minhaGeracao = _geracao;\n'
	],
	// a queda com a aba escondida nao e volta
	escondidaNaoEVolta: [ALVO, '\tif (!c.visivel) return true;\n', ''],
	// a janela depois da volta some
	janelaZero: [ALVO, 'export const JANELA_DA_VOLTA_MS = 20000;', 'export const JANELA_DA_VOLTA_MS = 0;'],
	// visivel nunca e volta
	semJanela: [ALVO, "\treturn typeof c.voltouEm === 'number' && c.agora - c.voltouEm <= janela;", '\treturn false;'],
	// o prazo discreto some (o aviso aparece na hora)
	prazoZero: [ALVO, 'export const PRAZO_DISCRETO_MS = 10000;', 'export const PRAZO_DISCRETO_MS = 0;'],
	// toda queda e discreta (o servidor fora nunca aparece)
	sempreDiscreto: [ALVO, '\tif (!c || !c.voltaDoFundo) return 0;\n', '\tif (!c) return 0;\n'],
	// o aviso nunca cala
	avisoNaoCala: [ALVO, '\treturn !(agora < ate);', '\treturn true;'],
	// o aviso compara o prazo ao contrario
	avisoComparaErrado: [ALVO, '\treturn !(agora < ate);', '\treturn agora < ate;'],
	// o "Reconectado" sai mesmo na volta discreta
	reconectadoSempre: [ALVO, '\t\tif (estavaEmCiclo && !discreta) {', '\t\tif (estavaEmCiclo) {'],
	// a volta visivel espera o degrau de 10 s
	voltaEsperaODegrau: [ALVO, '\tif (c.voltaDoFundo && c.visivel) return 0;\n', ''],
	// a volta da aba durante o ciclo nao tenta na hora
	voltaNaoTentaJa: [ALVO, '\t_indice = 0;\n\tiniciarTentativa();\n\tesconderOAvisoSeCalado();', '\t_indice = 0;\n\tesconderOAvisoSeCalado();'],
	// a volta da aba durante o ciclo nao cala o aviso
	voltaNaoCala: [ALVO, '\t_discretoAte = Math.max(_discretoAte === Infinity ? 0 : _discretoAte, Date.now() + PRAZO_DISCRETO_MS);\n', ''],
	// o aviso velho fica na tela na volta
	avisoVelhoFica: [ALVO, '\t\tif (!avisoVisivel(Date.now(), _discretoAte)) ui.esconder();\n', ''],
	// sem a memoria da volta (a queda que a vigia descobre depois dela vira comum)
	semVigiaDaAba: [ALVO, '\tNetwork.onDisconnect = aoDesconectar;\n\tvigiarAba();\n', '\tNetwork.onDisconnect = aoDesconectar;\n'],
	// a tentativa reentra no mapa da entrada
	enderecoGuardado: [ALVO, '\t\treturn { ip: guardado.ip, port: guardado.port, mapName: atual.mapName };\n', '\t\treturn guardado;\n'],
	// a tentativa nao avisa o MapEngine que e a volta
	semVolta: [ALVO, '\t\t\t{ volta: true }\n\t\t);', '\t\t\t{ volta: false }\n\t\t);'],
	// o Infinity da aba escondida nao vira prazo na volta (a volta que falha nunca mostra o aviso)
	infinitoNaoVira: [
		ALVO,
		'_discretoAte = Math.max(_discretoAte === Infinity ? 0 : _discretoAte, Date.now() + PRAZO_DISCRETO_MS);',
		'_discretoAte = Math.max(_discretoAte, Date.now() + PRAZO_DISCRETO_MS);'
	]
};
const mutante = mutantes[process.env.RAG_MUTANTE_VOLTA_DISCRETA];
if (!mutante) throw new Error(`Escolha RAG_MUTANTE_VOLTA_DISCRETA: ${Object.keys(mutantes).join(', ')}.`);

export default {
	...base,
	plugins: [
		{
			name: 'volta-discreta-somente-em-memoria',
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
		include: [
			'tests/ui/voltaDiscretaDaReconexao.test.js',
			'tests/ui/reconexaoAutomatica.test.js',
			'tests/ui/reconexaoSemRedeOuEscondida.test.js'
		]
	}
};
