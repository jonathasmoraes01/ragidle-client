// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
// Uso: RAG_MUTANTE_REDE=<nome> npx vitest run --config tests/mutantes/rede-da-hud.config.mjs
// Cada mutante tem de REPROVAR tests/core/redeDaHud.test.js.
// A CHAMADA em Engine/MapEngine.js nao se mede aqui: o teste a le do DISCO. Foi
// medida com a mutacao no disco e restauro por copia (05/10/2026).
import base from '../../vite.config.js';

const ALVO = 'src/Engine/redeDaHud.js';
const mutantes = {
	// a rede anexa de novo quem ja esta ativo (duplica o onAppend de toda a HUD)
	'ignora-ativo': ['if (!componente || componente.__active) {', 'if (!componente) {'],
	// a rede nao anexa nada
	'nao-anexa': ['\t\t\tcomponente.append();\n', ''],
	// o erro de um componente derruba o resto
	'sem-try': ['\t\ttry {\n\t\t\tcomponente.append();\n\t\t} catch (erro) {', '\t\t{\n\t\t\tcomponente.append();\n\t\t}\n\t\tif (false) { const erro = null;'],
	// o relato do resgate some
	'sem-relato-do-resgate': ['if (resgatados.length > 0 && relatar) {', 'if (false) {'],
	// relata mesmo sem resgate
	'relata-sempre': ['if (resgatados.length > 0 && relatar) {', 'if (relatar) {'],
	// roda na hora, e nao depois da lista
	'roda-na-hora': ['agendar(() => garantirHud(componentes, opcoes.relatar));', 'garantirHud(componentes, opcoes.relatar);'],
	// o padrao deixa de agendar
	'sem-agendar-padrao': ['const agendar = opcoes.agendar || (fn => setTimeout(fn, 0));', 'const agendar = opcoes.agendar || (() => {});']
};
const mutante = mutantes[process.env.RAG_MUTANTE_REDE];
if (!mutante) throw new Error('Escolha RAG_MUTANTE_REDE: ' + Object.keys(mutantes).join(', ') + '.');

export default {
	...base,
	plugins: [
		{
			name: 'rede-da-hud-somente-em-memoria',
			enforce: 'pre',
			transform(codigo, id) {
				if (!id.replaceAll('\\', '/').endsWith(ALVO)) return null;
				const normal = codigo.replace(/\r\n/g, '\n');
				if (normal.split(mutante[0]).length !== 2) throw new Error('Mutante nao casa exatamente uma vez.');
				return normal.replace(mutante[0], mutante[1]);
			}
		}
	],
	test: { ...base.test, include: ['tests/core/redeDaHud.test.js'] }
};

export const NOMES = Object.keys(mutantes);
