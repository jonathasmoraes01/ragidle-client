// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
// O teto de 60 quadros no celular (06/10/2026, decisao do dono).
// Uso: RAG_MUTANTE_TETO=<nome> npx vitest run --config tests/mutantes/teto-de-quadros.config.mjs
// As costuras no Renderer e na janela de opcoes sao lidas do DISCO pelo teste:
// medidas com a mutacao no disco e restauro por copia.
import base from '../../vite.config.js';

const ALVO = 'src/Renderer/tetoDeQuadrosNoCelular.js';
const mutantes = {
	'sem-teto': ['\treturn TETO_DE_QUADROS_NO_CELULAR;\n}', '\treturn escolhido;\n}'],
	'escolha-ignorada': ['if (preferencias.fpslimitEscolhido === true || !dedo) {', 'if (!dedo) {'],
	'teto-no-desktop': ['if (preferencias.fpslimitEscolhido === true || !dedo) {', 'if (preferencias.fpslimitEscolhido === true) {'],
	'teto-de-30': ['export const TETO_DE_QUADROS_NO_CELULAR = 60;', 'export const TETO_DE_QUADROS_NO_CELULAR = 30;']
};
const mutante = mutantes[process.env.RAG_MUTANTE_TETO];
if (!mutante) throw new Error('Escolha RAG_MUTANTE_TETO: ' + Object.keys(mutantes).join(', ') + '.');

export default {
	...base,
	plugins: [
		{
			name: 'teto-de-quadros-somente-em-memoria',
			enforce: 'pre',
			transform(codigo, id) {
				if (!id.replaceAll('\\', '/').endsWith(ALVO)) return null;
				const normal = codigo.replace(/\r\n/g, '\n');
				if (normal.split(mutante[0]).length !== 2) throw new Error('Mutante nao casa exatamente uma vez.');
				return normal.replace(mutante[0], mutante[1]);
			}
		}
	],
	test: { ...base.test, include: ['tests/renderer/tetoDeQuadrosNoCelular.test.js'] }
};

export const NOMES = Object.keys(mutantes);
