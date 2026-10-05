// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
// Uso: RAG_MUTANTE_LETREIRO=<nome> npx vitest run --config tests/mutantes/letreiro-do-descartado.config.mjs
// Cada mutante tem de REPROVAR tests/renderer/letreiroDoDescartado.test.js.
import base from '../../vite.config.js';

const ALVO = 'src/Renderer/EntityManager.js';
const mutantes = {
	// As duas CHAMADAS (nos descartes por tela e por distancia) nao se medem aqui: o
	// teste as le do DISCO. Foram medidas com a mutacao no disco e restauro por copia
	// (05/10/2026): cada uma reprova o teste de fonte.
	// a barra de HP fica
	'hp-fica': ['\ttirarDaCamada(entity.life);\n', ''],
	// o nome fica
	'nome-fica': ['\ttirarDaCamada(entity.display);\n', ''],
	// some o interruptor junto (quem volta a tela voltaria sem nome)
	'apaga-interruptor': ['\t\tcanvas.remove();\n\t}\n}', '\t\tcanvas.remove();\n\t\tpeca.display = false;\n\t}\n}'],
	// a guarda some: peca sem canvas lanca e derruba o quadro
	'sem-guarda': ['\tconst canvas = peca && peca.canvas;\n\tif (canvas && canvas.parentNode) {', '\tconst canvas = peca.canvas;\n\tif (canvas.parentNode) {']
};
const mutante = mutantes[process.env.RAG_MUTANTE_LETREIRO];
if (!mutante) throw new Error('Escolha RAG_MUTANTE_LETREIRO: ' + Object.keys(mutantes).join(', ') + '.');

export default {
	...base,
	plugins: [
		{
			name: 'letreiro-do-descartado-somente-em-memoria',
			enforce: 'pre',
			transform(codigo, id) {
				if (!id.replaceAll('\\', '/').endsWith(ALVO)) return null;
				const normal = codigo.replace(/\r\n/g, '\n');
				if (normal.split(mutante[0]).length !== 2) throw new Error('Mutante nao casa exatamente uma vez.');
				return normal.replace(mutante[0], mutante[1]);
			}
		}
	],
	test: { ...base.test, include: ['tests/renderer/letreiroDoDescartado.test.js'] }
};

export const NOMES = Object.keys(mutantes);
