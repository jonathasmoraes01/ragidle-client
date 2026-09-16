// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
// A tela preta depois da economia (16/09/2026) — o pedido de mapa guardado
// durante um carregamento e o jogo que aparece mesmo com a montagem lancando.
// Uso: RAG_MUTANTE_TELA_PRETA=<nome> npx vitest run --config tests/mutantes/tela-preta.config.mjs
import base from '../../vite.config.js';

const ALVO = 'src/Renderer/MapRenderer.js';
const mutantes = {
	descarta: ['\t\t\tthis.mapaPendente = mapname;\r\n', ''],
	semAtenderNoFim: ['\t\tMouse.intersect = true;\r\n\r\n\t\tatenderMapaPendente();', '\t\tMouse.intersect = true;'],
	semAtenderNaFalha: [
		"\t\tUIManager.showErrorBox(error).ui.css('zIndex', 1000);\r\n\t\tatenderMapaPendente();",
		"\t\tUIManager.showErrorBox(error).ui.css('zIndex', 1000);"
	],
	naoEsvazia: ['\tMapRenderer.mapaPendente = null;\r\n\tif (pendente', '\tif (pendente'],
	semtry: ['\t\t} catch (erro) {\r\n\t\t\tconsole.error', '\t\t} finally {\r\n\t\t\tconsole.error'],
	recarregaOMesmo: [
		'if (pendente && stripMapExtension(pendente) !== stripMapExtension(MapRenderer.currentMap)) {',
		'if (pendente) {'
	]
};
const mutante = mutantes[process.env.RAG_MUTANTE_TELA_PRETA];
if (!mutante) throw new Error(`Escolha RAG_MUTANTE_TELA_PRETA: ${Object.keys(mutantes).join(', ')}.`);

export default {
	...base,
	plugins: [
		{
			name: 'tela-preta-somente-em-memoria',
			enforce: 'pre',
			transform(codigo, id) {
				if (!id.replaceAll('\\', '/').endsWith(ALVO)) return null;
				if (codigo.split(mutante[0]).length !== 2) throw new Error('Mutante nao casa exatamente uma vez.');
				return codigo.replace(mutante[0], mutante[1]);
			}
		}
	],
	test: { ...base.test, include: ['tests/renderer/telaPretaDaReconexao.test.js'] }
};
