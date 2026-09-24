// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
// Uso: RAG_MUTANTE_GM=<nome> npx vitest run --config tests/mutantes/fala-de-gm.config.mjs
// Cada mutante tem de REPROVAR tests/ui/falaDeGm.test.js.
import base from '../../vite.config.js';

const mutantes = {
	// o defeito do Urso de volta: sem entidade, nunca e GM
	'so-entidade': ['src/Engine/MapEngine/falaDeGm.js', 'return Array.isArray(listaDeAdmins) && listaDeAdmins.indexOf(gid) > -1;', 'return false;'],
	// a lista vence a entidade: o mob com GID de conta viraria GM
	'lista-vence': ['src/Engine/MapEngine/falaDeGm.js', 'if (entidade) {', 'if (false) {'],
	// a entidade diz sempre sim
	'entidade-sempre': ['src/Engine/MapEngine/falaDeGm.js', 'return Boolean(entidade.isAdmin);', 'return true;']
};
// O FIO (onEntityTalk chamando falaDeGm) nao entra aqui: o teste le o
// Entity.js do DISCO, e um mutante so em memoria nunca chegaria a ele.
const mutante = mutantes[process.env.RAG_MUTANTE_GM];
if (!mutante) throw new Error('Escolha RAG_MUTANTE_GM: ' + Object.keys(mutantes).join(', ') + '.');

export default {
	...base,
	plugins: [
		{
			name: 'fala-de-gm-somente-em-memoria',
			enforce: 'pre',
			transform(codigo, id) {
				if (!id.replaceAll('\\', '/').endsWith(mutante[0])) return null;
				if (codigo.split(mutante[1]).length !== 2) throw new Error('Mutante nao casa exatamente uma vez.');
				return codigo.replace(mutante[1], mutante[2]);
			}
		}
	],
	test: { ...base.test, include: ['tests/ui/falaDeGm.test.js'] }
};
