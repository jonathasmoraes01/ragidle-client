// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
// O limitador de quadros com folga (D-1537).
// Uso: RAG_MUTANTE_LIMITE=<nome> npx vitest run --config tests/mutantes/limite-de-quadros.config.mjs
import base from '../../vite.config.js';

const ALVO = 'src/Renderer/limiteDeQuadros.js';
const mutantes = {
	// O criterio de antes do conserto: o defeito medido.
	semFolga: ['if (passou < intervalo - intervalo * FOLGA_DO_INTERVALO) {', 'if (passou < intervalo) {'],
	marcoEmAgora: ['return { desenhar: true, ultimo: ultimo + intervalo };', 'return { desenhar: true, ultimo: agora };'],
	semRealinhar: ['if (passou < 2 * intervalo) {', 'if (true) {'],
	realinhaParaAgora: ['return { desenhar: true, ultimo: agora - (passou % intervalo) };', 'return { desenhar: true, ultimo: agora - intervalo };'],
	semLimiteQuebrado: ['if (!(limite > 0)) {', 'if (limite < 0) {'],
	folgaDemais: ['export const FOLGA_DO_INTERVALO = 0.25;', 'export const FOLGA_DO_INTERVALO = 0.6;']
};
const mutante = mutantes[process.env.RAG_MUTANTE_LIMITE];
if (!mutante) throw new Error(`Escolha RAG_MUTANTE_LIMITE: ${Object.keys(mutantes).join(', ')}.`);

export default {
	...base,
	plugins: [
		{
			name: 'limite-de-quadros-somente-em-memoria',
			enforce: 'pre',
			transform(codigo, id) {
				if (!id.replaceAll('\\', '/').endsWith(ALVO)) return null;
				if (codigo.split(mutante[0]).length !== 2) throw new Error('Mutante nao casa exatamente uma vez.');
				return codigo.replace(mutante[0], mutante[1]);
			}
		}
	],
	test: { ...base.test, include: ['tests/renderer/limiteDeQuadros.test.js'] }
};
