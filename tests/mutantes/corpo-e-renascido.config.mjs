// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
// Uso: RAG_MUTANTE_CORPO=<nome> npx vitest run --config tests/mutantes/corpo-e-renascido.config.mjs
// Cada mutante tem de REPROVAR tests/renderer/corpoNaoApagaORenascido.test.js.
import base from '../../vite.config.js';

const ALVO = 'src/Renderer/EntityManager.js';
const mutantes = {
	// a faxina volta a apagar o GID sem perguntar de quem ele e (o defeito de 03/10)
	'gid-sem-identidade': ['\tif (_gidMap.get(entity.GID) !== entity) {\n\t\treturn false;\n\t}\n', ''],
	// a faxina nunca solta o GID (o corpo sem renascido ficaria achavel)
	'nunca-solta': ['\t_gidMap.delete(entity.GID);\n\treturn true;', '\treturn true;'],
	// o foco volta a ser comparado pelo NUMERO
	'foco-por-numero': ['if (entityFocus === _list[i]) {', 'if (entityFocus && entityFocus.GID === _list[i].GID) {'],
	// a faxina deixa de chamar a soltura
	'sem-soltura': ['\t\t\t\tsoltarOGidSeForDela(_list[i]);\n', '']
};
const mutante = mutantes[process.env.RAG_MUTANTE_CORPO];
if (!mutante) throw new Error('Escolha RAG_MUTANTE_CORPO: ' + Object.keys(mutantes).join(', ') + '.');

export default {
	...base,
	plugins: [
		{
			name: 'corpo-e-renascido-somente-em-memoria',
			enforce: 'pre',
			transform(codigo, id) {
				if (!id.replaceAll('\\', '/').endsWith(ALVO)) return null;
				const normal = codigo.replace(/\r\n/g, '\n');
				if (normal.split(mutante[0]).length !== 2) throw new Error('Mutante nao casa exatamente uma vez.');
				return normal.replace(mutante[0], mutante[1]);
			}
		}
	],
	test: { ...base.test, include: ['tests/renderer/corpoNaoApagaORenascido.test.js'] }
};

export const NOMES = Object.keys(mutantes);
