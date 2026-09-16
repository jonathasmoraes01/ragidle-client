// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
// O placar ao vivo do MVP (D-1533).
// Uso: RAG_MUTANTE_PLACAR=<nome> npx vitest run --config tests/mutantes/placar-do-mvp.config.mjs
import base from '../../vite.config.js';

const ALVO = 'src/UI/Components/PlacarMvpIdle/placarDoMvp.js';
const mutantes = {
	semCorte: ['dados.top.slice(0, LINHAS_DO_PLACAR)', 'dados.top.slice(0)'],
	semSeparador: [".replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.')", ''],
	semEscape: [".replace(/</g, '&lt;')", ''],
	vidaSemTeto: ['Math.max(0, Math.min(100, Number(dados.hp) || 0))', 'Math.max(0, Number(dados.hp) || 0)'],
	inativoMostra: ['dados.ativo !== true ||', ''],
	euSempre: ['if (eu && Number(eu.dano) > 0) {', 'if (eu) {'],
	foraVira1: ["const lugar = eu.posicao ? `${eu.posicao}º` : 'fora do top 10';", 'const lugar = `${eu.posicao}º`;'],
	jsonLanca: ['\t} catch (erro) {\n\t\treturn null;', '\t} catch (erro) {\n\t\tthrow erro;']
};
const mutante = mutantes[process.env.RAG_MUTANTE_PLACAR];
if (!mutante) throw new Error(`Escolha RAG_MUTANTE_PLACAR: ${Object.keys(mutantes).join(', ')}.`);

export default {
	...base,
	plugins: [
		{
			name: 'placar-do-mvp-somente-em-memoria',
			enforce: 'pre',
			transform(codigo, id) {
				if (!id.replaceAll('\\', '/').endsWith(ALVO)) return null;
				const texto = codigo.replace(/\r\n/g, '\n');
				if (texto.split(mutante[0]).length !== 2) throw new Error('Mutante nao casa exatamente uma vez.');
				return texto.replace(mutante[0], mutante[1]);
			}
		}
	],
	test: { ...base.test, include: ['tests/ui/placarDoMvp.test.js'] }
};
