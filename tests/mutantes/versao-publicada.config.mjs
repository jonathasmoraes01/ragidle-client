// Mutacao somente na memoria do Vitest: nunca altera o builder de verdade.
// A versao publicada so sai com o jogo (29/09/2026, D-1822 do servidor).
// Uso: RAG_MUTANTE_VERSAO=<nome> npx vitest run --config tests/mutantes/versao-publicada.config.mjs
import base from '../../vite.config.js';

const ALVO = 'applications/tools/versaoPublicada.mjs';
const mutantes = {
	// O publicador escreve sem conferir o jogo gerado (o achado #13 de volta).
	semConferirOJogo: ['\tif (!jogo.includes(versaoDoBuild)) {', '\tif (false) {'],
	// A versao sem carimbo passa (o login mandaria zero).
	semCarimbo: ['\tif (login === 0) {', '\tif (false) {'],
	// Apagar nao apaga: a versao de antes fica ao lado de um jogo que nao compilou.
	apagarNaoApaga: ["\tfs.rmSync(destino + '/' + ARQUIVO_DA_VERSAO, { force: true });", ''],
	// O numero do login sai da versao errada.
	loginErrado: ['\tconst conteudo = { versao: versaoDoBuild, login };', '\tconst conteudo = { versao: versaoDoBuild, login: login + 1 };']
};
const mutante = mutantes[process.env.RAG_MUTANTE_VERSAO];
if (!mutante) throw new Error(`Escolha RAG_MUTANTE_VERSAO: ${Object.keys(mutantes).join(', ')}.`);

export default {
	...base,
	plugins: [
		{
			name: 'versao-publicada-somente-em-memoria',
			enforce: 'pre',
			transform(codigo, id) {
				if (!id.replaceAll('\\', '/').endsWith(ALVO)) return null;
				const texto = codigo.replace(/\r\n/g, '\n');
				if (texto.split(mutante[0]).length !== 2) throw new Error('Mutante nao casa exatamente uma vez.');
				return texto.replace(mutante[0], mutante[1]);
			}
		}
	],
	test: { ...base.test, include: ['tests/ui/versaoPublicadaSoComOJogo.test.js'] }
};
