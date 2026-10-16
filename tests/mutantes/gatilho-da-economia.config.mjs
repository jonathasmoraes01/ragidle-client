// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
//
// O GATILHO DA ECONOMIA DE ENERGIA / MODO DESCANSO (bug #10 de 13/10/2026): cada mutante e um jeito de o aviso
// `entrar` mentir: sair sem esperar o atraso de 14 s, empilhar atrasos, nao cancelar quando a aba volta, nao
// reconferir no disparo, ou `cancelar` que nao cancela. Desde D-2598 (16/10/2026), tambem os jeitos de a TELA e o
// AVISO voltarem a andar juntos: o `entrar` que depende da tela, a volta que nao manda `sair`, a tela para quem nao
// a escolheu. Alvo: `Engine/gatilhoDaEconomia.js`,
// alcancado pelo jsdom com relogio falso (`tests/ui/atrasoDaEconomia.test.js`).
//
//   RAG_MUTANTE_GATILHO=<nome> npx vitest run --config tests/mutantes/gatilho-da-economia.config.mjs
//
// Um mutante MORTO faz a corrida reprovar.
import base from '../../vite.config.js';

const ALVO = 'src/Engine/gatilhoDaEconomia.js';

const mutantes = {
	// o atraso deixa de ser 14 s (volta aos 3 s de D-1394)
	atraso3s: [ALVO, 'export const MS_DE_ATRASO_ANTES_DE_ENTRAR_NA_ECONOMIA = 14000;', 'export const MS_DE_ATRASO_ANTES_DE_ENTRAR_NA_ECONOMIA = 3000;'],
	// a aba escondida avisa na hora (sem atraso de confirmacao: fechar a aba tambem armaria)
	semAtraso: [ALVO, '\t\t}, atrasoMs);', '\t\t}, 0);'],
	// um segundo evento com a aba oculta empilha outro atraso
	empilha: [ALVO, '\t\t\tif (atraso !== null) {\n\t\t\t\treturn; // ja agendado: nao empilha um segundo\n\t\t\t}\n', ''],
	// voltar a aba antes do atraso nao cancela
	voltarNaoCancela: [ALVO, '\t\t} else {\n\t\t\tlimparTimer();\n', '\t\t} else {\n'],
	// o disparo nao reconfere a visibilidade
	semReconferirAba: [ALVO, '\t\t\tif (!deps.oculta()) {\n\t\t\t\treturn;\n\t\t\t}\n\t\t\tif (fase === \'armada\') {', '\t\t\tif (fase === \'armada\') {'],
	// `cancelar` esquece de desagendar
	cancelarNaoDesagenda: [ALVO, '\t\t\tdesagendar(atraso);\n', ''],
	// `cancelar` esquece de zerar o estado (o gatilho nunca mais agenda)
	cancelarNaoZera: [ALVO, '\t\t\tdesagendar(atraso);\n\t\t\tatraso = null;', '\t\t\tdesagendar(atraso);'],
	// o celular volta a esperar os 14 s para armar (o iPhone congela antes)
	celularEspera: [ALVO, '\t\t\tif (naHora()) {\n\t\t\t\tentrarCedo();\n\t\t\t}\n', ''],
	// a tela preta do celular abre na hora, sem esperar os 14 s
	telaSemEspera: [ALVO, "\t\tif (fase === 'armada') {\n\t\t\tpendente = decorridoMs;\n\t\t\treturn false;\n\t\t}", "\t\tif (fase === 'armada') {\n\t\t\treturn true;\n\t\t}"],
	// o pagehide nao arma
	semPagehide: [ALVO, "\t\tif (fase === 'livre') {\n\t\t\tentrarCedo();\n", "\t\tif (fase === 'livre') {\n"],
	// o ack tardio do sair apaga o entrar novo
	ackApagaOEntradaNova: [ALVO, "\t\tif (fase !== 'armada') {\n\t\t\tfase = 'livre';\n\t\t\tpendente = null;\n\t\t}\n\t}\n\n\treturn", "\t\tfase = 'livre';\n\t\tpendente = null;\n\t}\n\n\treturn"],
	// A1: esconder de novo com a tela liberada volta a armar cedo (e o `sair` fecha a tela sem o botao)
	telaLiberadaRearma: [ALVO, "\t\t\tif (fase === 'liberada') {\n\t\t\t\tif (naHora()) {\n\t\t\t\t\tdeps.pedirEntrar();\n\t\t\t\t} else {\n\t\t\t\t\tagendarAtraso();\n\t\t\t\t}\n\t\t\t\treturn;\n\t\t\t}\n", ''],
	// D-2578: a tela liberada volta a NAO rearmar (o servidor que desarmou calado deixa o cliente sem economia)
	liberadaNaoRearma: [ALVO, "\t\t\tif (fase === 'liberada') {\n\t\t\t\tif (naHora()) {\n\t\t\t\t\tdeps.pedirEntrar();\n\t\t\t\t} else {\n\t\t\t\t\tagendarAtraso();\n\t\t\t\t}\n\t\t\t\treturn;\n\t\t\t}\n", "\t\t\tif (fase === 'liberada') {\n\t\t\t\treturn;\n\t\t\t}\n"],
	// D-2578: o desktop rearma na hora (fechar a aba antes dos 14 s ja nao encerraria)
	liberadaDesktopNaHora: [ALVO, '\t\t\t\t} else {\n\t\t\t\t\tagendarAtraso();\n\t\t\t\t}\n\t\t\t\treturn;', '\t\t\t\t} else {\n\t\t\t\t\tdeps.pedirEntrar();\n\t\t\t\t}\n\t\t\t\treturn;'],
	// D-2578: o dedo espera os 14 s para rearmar (o iPhone congela antes)
	liberadaDedoEspera: [ALVO, '\t\t\t\tif (naHora()) {\n\t\t\t\t\tdeps.pedirEntrar();\n\t\t\t\t} else {', '\t\t\t\tif (naHora()) {\n\t\t\t\t\tagendarAtraso();\n\t\t\t\t} else {'],
	// D-2578: o rearme com a tela liberada derruba a fase para `livre`
	liberadaVoltaALivre: [ALVO, '\t\t\t\t\tagendarAtraso();\n\t\t\t\t}\n\t\t\t\treturn;', "\t\t\t\t\tagendarAtraso();\n\t\t\t\t}\n\t\t\t\tfase = 'livre';\n\t\t\t\treturn;"],
	// A2: o pagehide sozinho nao agenda a tela
	pagehideSemAgenda: [ALVO, '\t\t\tif (atraso === null) {\n\t\t\t\tagendarAtraso();\n\t\t\t}\n', ''],

	// D-2598: o `entrar` do desktop volta a depender da tela (o defeito: sem ela a queda tirava o personagem do mundo)
	entrarSoComTela: [ALVO, "\t\t\tdeps.pedirEntrar();\n\t\t\tfase = comTela() ? 'liberada' : 'armada';", "\t\t\tif (!comTela()) {\n\t\t\t\treturn;\n\t\t\t}\n\t\t\tdeps.pedirEntrar();\n\t\t\tfase = 'liberada';"],
	// D-2598: sem a tela escolhida, o desktop fica `liberada` (a volta nao manda `sair` e o personagem segue ausente)
	semTelaFicaLiberada: [ALVO, "\t\t\tfase = comTela() ? 'liberada' : 'armada';", "\t\t\tfase = 'liberada';"],
	// D-2598: a volta sem a tela na frente nao manda `sair`
	voltaSemSair: [ALVO, "\t\t\tif (fase === 'armada') {\n\t\t\t\tdesarmar();\n\t\t\t}\n\t\t}\n\t}", '\t\t}\n\t}'],
	// D-2598: a volta sai TAMBEM com a tela escolhida (fecharia a tela sem o botao, D-1392)
	voltaSaiComTela: [ALVO, "\t\t\tif (fase === 'armada') {\n\t\t\t\tdesarmar();\n\t\t\t}\n\t\t}\n\t}", "\t\t\tif (fase === 'armada' || fase === 'liberada') {\n\t\t\t\tdesarmar();\n\t\t\t}\n\t\t}\n\t}"],
	// D-2598: a tela abre para todo mundo (o interruptor ignorado)
	telaParaTodos: [ALVO, '\tconst comTela = () => deps.telaPretaEscolhida() === true;', '\tconst comTela = () => true;'],
	// D-2598: o dedo abre a tela guardada sem a tela ter sido escolhida
	dedoAbreSemEscolha: [ALVO, "\t\t\tif (fase === 'armada') {\n\t\t\t\tif (comTela()) {", "\t\t\tif (fase === 'armada') {\n\t\t\t\tif (true) {"],
	// D-2598: o pagehide volta a depender da tela (o celular que congela nao armaria)
	pagehideSoComTela: [ALVO, "\t\tif (!naHora()) {\n\t\t\treturn;\n\t\t}\n\t\tif (fase === 'livre') {", "\t\tif (!naHora() || !comTela()) {\n\t\t\treturn;\n\t\t}\n\t\tif (fase === 'livre') {"],
	// a resposta `ativa:true` em `livre` reabre a tela que o botao fechou (o `resumo` em voo)
	livreAbreTela: [ALVO, "\t\treturn fase === 'liberada';", "\t\treturn fase !== 'desarmando';"],
	// a resposta tardia do entrar reabre a tela depois do sair
	ignoraDesarmando: [ALVO, "\t\treturn fase === 'liberada';", "\t\treturn fase === 'liberada' || fase === 'desarmando';"]
};
const mutante = mutantes[process.env.RAG_MUTANTE_GATILHO];
if (!mutante) throw new Error(`Escolha RAG_MUTANTE_GATILHO: ${Object.keys(mutantes).join(', ')}.`);

export default {
	...base,
	plugins: [
		{
			name: 'gatilho-da-economia-somente-em-memoria',
			enforce: 'pre',
			transform(codigo, id) {
				if (!id.replaceAll('\\', '/').endsWith(mutante[0])) return null;
				const normalizado = codigo.replaceAll('\r\n', '\n');
				if (normalizado.split(mutante[1]).length !== 2) throw new Error('Mutante nao casa exatamente uma vez.');
				return normalizado.replace(mutante[1], mutante[2]);
			}
		}
	],
	test: { ...base.test, include: ['tests/ui/atrasoDaEconomia.test.js'] }
};
