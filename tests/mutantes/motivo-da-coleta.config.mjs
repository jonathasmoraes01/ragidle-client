// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
//
// O MOTIVO DA COLETA (24/09/2026). O "coletar todos" do correio dizia "no peso"
// para toda carta mantida, qualquer que fosse o motivo do servidor, e o dono
// leu "2 nao couberam no peso" com a mochila leve. Cada mutante e um jeito de a
// frase voltar a mentir sobre o motivo.
//
//   RAG_MUTANTE_COLETA=<nome> npx vitest run --config tests/mutantes/motivo-da-coleta.config.mjs
//
// Um mutante MORTO faz a corrida reprovar.
import base from '../../vite.config.js';

const ALVO = 'src/UI/Components/CorreioIdle/relatorioDoLote.js';

const mutantes = {
	// toda carta volta a cair no mesmo motivo (o defeito original)
	tudoPeso: [ALVO, "const motivo = Object.prototype.hasOwnProperty.call(MOTIVO_DA_COLETA, m.motivo) ? m.motivo : '';", "const motivo = 'peso';"],
	// motivo desconhecido deixa de ser filtrado: vira "nao coube undefined"
	semFiltro: [ALVO, "const motivo = Object.prototype.hasOwnProperty.call(MOTIVO_DA_COLETA, m.motivo) ? m.motivo : '';", "const motivo = m.motivo || '';"],
	// o zeny passa a ser chamado de peso
	zenyViraPeso: [ALVO, "\tzeny: 'no limite de zeny'", "\tzeny: 'no peso'"],
	// os grupos nao se separam: cada carta abre o proprio grupo
	semAgrupar: [ALVO, '\t\tlet grupo = grupos.find(g => g.motivo === motivo);', '\t\tlet grupo = undefined;'],
	// so o primeiro grupo aparece
	soOPrimeiro: [ALVO, "\t\t\t.join('; ') +", "\t\t\t.slice(0, 1)\n\t\t\t.join('; ') +"]
};
const mutante = mutantes[process.env.RAG_MUTANTE_COLETA];
if (!mutante) throw new Error(`Escolha RAG_MUTANTE_COLETA: ${Object.keys(mutantes).join(', ')}.`);

export default {
	...base,
	plugins: [{
		name: 'motivo-da-coleta-somente-em-memoria',
		enforce: 'pre',
		transform(codigo, id) {
			if (!id.replaceAll('\\', '/').endsWith(mutante[0])) return null;
			const normalizado = codigo.replaceAll('\r\n', '\n');
			if (normalizado.split(mutante[1]).length !== 2) throw new Error('Mutante nao casa exatamente uma vez.');
			return normalizado.replace(mutante[1], mutante[2]);
		}
	}],
	test: { ...base.test, include: ['tests/ui/coletarTodoOCorreio.test.js'] }
};
