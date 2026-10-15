// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
//
// O BGM QUE O NAVEGADOR BARROU VOLTA NO PRIMEIRO GESTO (J12, 15/10/2026). Cada mutante e um jeito de a musica ficar
// muda ou voltar sem ser chamada: a barrada nunca se arma, qualquer erro arma, o gesto toca toda vez, a parada de
// proposito volta com o clique, o BGM desligado nas opcoes toca. Dois alvos: a peca (`retomadaDoBGM.js`) e a costura
// (`BGM.js`).
//
//   RAG_MUTANTE_BGM=<nome> npx vitest run --config tests/mutantes/retomada-do-bgm.config.mjs
//
// Um mutante MORTO faz a corrida reprovar.
import base from '../../vite.config.js';

const PECA = 'src/Audio/retomadaDoBGM.js';
const BGM = 'src/Audio/BGM.js';

const mutantes = {
	// so o AbortError conta (a politica nunca arma)
	bloqueioNunca: [PECA, "\treturn !!erro && /** @type {{name?: string}} */ (erro).name === 'NotAllowedError';", '\treturn false;'],
	// qualquer erro arma (arquivo ausente tambem)
	bloqueioSempre: [PECA, "\treturn !!erro && /** @type {{name?: string}} */ (erro).name === 'NotAllowedError';", '\treturn !!erro;'],
	// o gesto toca toda vez (nao se desarma ao disparar)
	semDesarmarNoDisparo: [PECA, '\t\tdesarmar();\n\t\ttocar();', '\t\ttocar();'],
	// (Tirar o `armada = false` do desarme e EQUIVALENTE: os ouvintes saem do alvo de qualquer jeito, e o `disparar`
	// nao e mais chamado. Medido em 15/10/2026, fora da bateria.)
	// o teclado deixa de contar como gesto
	semTeclado: [PECA, "export const GESTOS_DO_JOGADOR = ['pointerdown', 'keydown', 'touchend'];", "export const GESTOS_DO_JOGADOR = ['pointerdown', 'touchend'];"],
	// a barrada nao se arma (volta o console.warn de antes)
	costuraSemArmar: [BGM, '\t\t\t\t\tBGM.retomarNoGesto();\n\t\t\t\t\treturn;', '\t\t\t\t\treturn;'],
	// a parada de proposito volta com o clique
	stopSemDesarmar: [BGM, '\t\t// A musica parada de proposito nao volta com um clique (J12).\n\t\tdesarmarRetomada();\n', ''],
	// o BGM desligado nas opcoes toca no clique
	semOlharAsOpcoes: [BGM, '\t\t\tif (!Preferences.BGM.play || !BGM.audio.paused || !BGM.audio.src) {', '\t\t\tif (!BGM.audio.paused || !BGM.audio.src) {']
};
const mutante = mutantes[process.env.RAG_MUTANTE_BGM];
if (!mutante) throw new Error(`Escolha RAG_MUTANTE_BGM: ${Object.keys(mutantes).join(', ')}.`);

export default {
	...base,
	plugins: [
		{
			name: 'retomada-do-bgm-somente-em-memoria',
			enforce: 'pre',
			transform(codigo, id) {
				if (!id.replaceAll('\\', '/').endsWith(mutante[0])) return null;
				const normalizado = codigo.replaceAll('\r\n', '\n');
				if (normalizado.split(mutante[1]).length !== 2) throw new Error('Mutante nao casa exatamente uma vez.');
				return normalizado.replace(mutante[1], mutante[2]);
			}
		}
	],
	test: { ...base.test, include: ['tests/ui/retomadaDoBGM.test.js'] }
};

export const NOMES = Object.keys(mutantes);
