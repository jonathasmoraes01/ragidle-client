// Mutacao somente na memoria do Vitest: nunca altera o builder de verdade.
// O worker sai com o MESMO carimbo do principal (07/10/2026, D-2075 do servidor).
// Uso: RAG_MUTANTE_CARIMBO=<nome> npx vitest run --config tests/mutantes/carimbo-dos-workers.config.mjs
// Cada mutante tem de REPROVAR ao menos um teste de `include`.
// O `sw.js` e lido do DISCO pelo teste dele (swRedePrimeiroRevalida): o mutante
// do `cache: 'no-cache'` se mede com a mutacao no disco e restauro por copia.
import base from '../../vite.config.js';

const CARIMBO = 'applications/tools/carimboDosWorkers.mjs';
const OPCOES = 'applications/tools/opcoesDoVite.mjs';

const mutantes = {
	// O builder sem o plugin: o worker volta a sair sem carimbo (o defeito de 07/10).
	'opcoes-sem-plugin': [OPCOES, 'plugins: [pluginDoCarimboDosWorkers(carimbo)],', 'plugins: [],'],
	// O plugin roda e nao escreve.
	'plugin-nao-escreve': [CARIMBO, 'saida.code = carimbarUrlsDeScript(saida.code, carimbo);', 'saida.code = saida.code;'],
	// O plugin so olha o primeiro chunk (o resto do bundle sai cru).
	'plugin-pula-chunk': [CARIMBO, "if (saida.type === 'chunk') {", "if (saida.type === 'asset') {"],
	// A busca nao enxerga a URL sem carimbo: a conferencia aprova de graca.
	'busca-cega': [CARIMBO, "\t\tif (!/[?&]v=[^&]+/.test(query)) {", '\t\tif (false) {'],
	// Qualquer query passa por carimbo.
	'qualquer-query-e-carimbo': [CARIMBO, "\t\tif (!/[?&]v=[^&]+/.test(query)) {", '\t\tif (!query) {'],
	// A conferencia ve e nao lanca.
	'conferencia-muda': [CARIMBO, '\tif (sem.length > 0) {', '\tif (false) {'],
	// A conferencia aceita o carimbo de OUTRO build.
	'aceita-outro-carimbo': [CARIMBO, "(a[3] || '').includes('v=' + carimbo)", "(a[3] || '').includes('v=')"],
	// Carimbo vazio vira `?v=` (a URL "carimbada" sem numero).
	'aceita-carimbo-vazio': [CARIMBO, '\tif (!carimbo || /[^\\w.-]/.test(carimbo)) {', '\tif (/[^\\w.-]/.test(carimbo)) {'],
	// A busca so acha aspas duplas (o terser e outros minificadores trocam).
	'so-aspas-duplas': [CARIMBO, '(["\'`])', '(["])']
};
const nome = process.env.RAG_MUTANTE_CARIMBO;
const mutante = mutantes[nome];
if (!mutante) throw new Error('Escolha RAG_MUTANTE_CARIMBO: ' + Object.keys(mutantes).join(', ') + '.');
const [alvo, de, para] = mutante;

export default {
	...base,
	plugins: [
		{
			name: 'carimbo-dos-workers-somente-em-memoria',
			enforce: 'pre',
			transform(codigo, id) {
				if (!id.replaceAll('\\', '/').endsWith(alvo)) return null;
				const normal = codigo.replace(/\r\n/g, '\n');
				if (normal.split(de).length !== 2) throw new Error('Mutante ' + nome + ' nao casa exatamente uma vez.');
				return normal.replace(de, para);
			}
		}
	],
	test: { ...base.test, include: ['tests/core/carimboDosWorkers.test.js'] }
};

export const NOMES = Object.keys(mutantes);
