// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
// O cache de arquivos do aparelho (15/10/2026, D-2547..D-2549).
// Uso: RAG_MUTANTE_CACHE=<nome> npx vitest run --config tests/mutantes/cache-do-aparelho.config.mjs
// Sem `RAG_MUTANTE_CACHE` roda o CONTROLE (nenhuma mutacao: tem de passar).
// Cada mutante tem de REPROVAR ao menos um dos testes de `include`. O laco que
// conta mortos e sobreviventes, e recusa o mutante que nao casa, e
// `scripts/mutantes-cache-do-aparelho.mjs`.
import base from '../../vite.config.js';

const PURO = 'src/Core/cacheDeArquivos.js';
const APARELHO = 'src/Core/cacheDoAparelho.js';
const ARQUIVOS = 'src/Core/FileManager.js';
const VIGIA = 'src/Core/baixarComVigia.js';
const MEDIDA = 'src/Loaders/medidaDaCarga.js';
const WORKER = 'src/Core/ThreadEventHandler.js';

export const mutantes = {
	// --- a versao (o duble que responde o mesmo texto a qualquer cabecalho nao pode virar versao) ---
	'versao-aceita-barra': [PURO, '/^[A-Za-z0-9._-]{1,80}$/', '/^[A-Za-z0-9._/-]{1,80}$/'],
	'versao-sem-aparar': [PURO, 'const versao = texto.trim();', 'const versao = texto;'],
	'versao-sem-teto': [PURO, '{1,80}', '{1,}'],
	// --- o nome do cache e quem sai ---
	'nome-sem-versao': [PURO, "return PREFIXO_DO_CACHE + ESQUEMA_DO_CACHE + '-' + versao;", 'return PREFIXO_DO_CACHE + ESQUEMA_DO_CACHE;'],
	'apaga-a-casca-do-pwa': [PURO, " && nome.startsWith(PREFIXO_DO_CACHE) && nome !== atual", ' && nome !== atual'],
	'apaga-o-atual': [PURO, ' && nome !== atual);', ');'],
	// --- o que entra ---
	'som-entra': [PURO, "return typeof nome === 'string' && !nome.match(/\\.(mp3|wav)$/);", "return typeof nome === 'string';"],
	'guarda-outra-versao': [PURO, 'p.versaoDaResposta === p.versaoDaSessao &&', 'p.versaoDaResposta !== null &&'],
	'guarda-vazio': [PURO, '\t\tp.bytes > 0 &&\n', ''],
	'sem-teto-de-um-arquivo': [PURO, '\t\tp.bytes <= TETO_DE_UM_ARQUIVO_BYTES &&\n', ''],
	'sem-teto-total-por-arquivo': [PURO, ' &&\n\t\tp.bytes <= p.teto\n', '\n'],
	// --- o teto ---
	'teto-ignora-a-cota': [PURO, 'return Math.min(TETO_FIXO_BYTES, Math.floor(cota * FRACAO_DA_COTA));', 'return TETO_FIXO_BYTES;'],
	'teto-de-200': [PURO, 'TETO_FIXO_BYTES = 150 * 1024 * 1024', 'TETO_FIXO_BYTES = 200 * 1024 * 1024'],
	'fracao-da-metade': [PURO, 'FRACAO_DA_COTA = 0.2', 'FRACAO_DA_COTA = 0.5'],
	// --- o despejo ---
	'despeja-o-mais-usado': [PURO, 'indice.arquivos[a].uso - indice.arquivos[b].uso', 'indice.arquivos[b].uso - indice.arquivos[a].uso'],
	'regravado-conta-contra-si': [PURO, 'Object.keys(indice.arquivos).filter(u => u !== url);', 'Object.keys(indice.arquivos);'],
	'maior-que-o-teto-entra': [PURO, '\tif (entrando > teto) return null;\n', ''],
	'despeja-demais': [PURO, 'if (total + entrando <= teto) break;', 'if (total <= 0) break;'],
	'orfas-ficam-no-indice': [PURO, 'const orfas = chaves.filter(url => !(url in arquivos));', 'const orfas = [];'],
	'indice-aceita-zero': [PURO, 'Number.isFinite(e.bytes) && e.bytes > 0 &&', 'Number.isFinite(e.bytes) &&'],
	'cota-so-pelo-codigo': [PURO, "erro.name === 'QuotaExceededError' || ", ''],
	// --- o aparelho ---
	'outra-versao-nao-pergunta': [APARELHO, 'if (daResposta !== versao) {', 'if (versao === null) {'],
	'desmentida-pergunta-sempre': [APARELHO, 'if (!desmentidas.has(daResposta)) verificar(daResposta);', 'verificar(daResposta);'],
	'rota-pelo-cache-http': [APARELHO, "{ cache: 'no-store' }", '{}'],
	'rota-404-pergunta-sempre': [APARELHO, 'if (resposta && resposta.status === 404) semRota = true;', ''],
	'velhos-ficam': [APARELHO, 'await todos.delete(velho);', ''],
	'orfas-ficam-no-cache': [APARELHO, 'await aberto.delete(orfa);', ''],
	'leitura-sem-prazo': [APARELHO, 'const guarda = agendar(() => responder(null), PRAZO_DA_LEITURA_MS);', 'const guarda = null;'],
	'leitura-sem-conferir-tamanho': [APARELHO, ' || buffer.byteLength !== entrada.bytes', ''],
	'leitura-nao-renova-o-uso': [APARELHO, '\t\t\t\t\t\tentrada.uso = indice.uso;\n', ''],
	'copia-depois-da-entrega': [APARELHO, 'const corpo = new Blob([buffer]);', 'const corpo = buffer;'],
	'cota-nao-bloqueia': [APARELHO, 'if (erroDeCota(erro)) escritaBloqueada = true;', ''],
	'bloqueio-ainda-copia': [APARELHO, 'if (doCache === null || escritaBloqueada || ', 'if (doCache === null || '],
	'fila-ignora-o-bloqueio': [APARELHO, 'if (doCache !== cache || escritaBloqueada) return;', 'if (doCache !== cache) return;'],
	'indice-nao-e-gravado': [APARELHO, 'indice.arquivos[url] = { bytes, uso: indice.uso };\n\t\t\t\t\tsalvarIndiceDepois();', 'indice.arquivos[url] = { bytes, uso: indice.uso };'],
	'consulta-sem-ativo': [APARELHO, 'return cache !== null && ativo();', 'return cache !== null;'],
	'reverifica-sem-o-servidor-dizer': [APARELHO, '\t\t\tif (!servidorInforma) return Promise.resolve();\n', ''],
	// --- a costura no FileManager ---
	'fora-do-grf-direto-a-rede': [ARQUIVOS, 'FileManager.getForaDoGrf(filename, callback, opcoes, inicio);', 'FileManager.getHTTP(filename, callback, opcoes);'],
	'rede-nao-avisa-o-cache': [ARQUIVOS, '\t\t\t\t\t\tFileManager.cacheDoAparelho.aoResponder(url, filename, resposta.buffer, resposta.versaoDoGrf);\n', ''],
	'som-espera-o-cache': [ARQUIVOS, 'consultar = arquivoGuardavel(filename) && cache.consultavel();', 'consultar = cache.consultavel();'],
	'cache-ignora-o-cancelamento': [ARQUIVOS, 'if (opcoes && opcoes.sinal && opcoes.sinal.aborted) {', 'if (false) {'],
	'origem-diz-rede': [ARQUIVOS, "origem: 'cache-aparelho',", "origem: 'rede',"],
	'copia-que-nao-abre-fica': [ARQUIVOS, '\t\t\t\tFileManager.cacheDoAparelho.esquecer(FileManager.urlDoArquivo(filename));\n', ''],
	'cache-ignora-o-filesystem': [ARQUIVOS, 'ativo: () => !FileSystem.disponivel()', 'ativo: () => true'],
	'rota-fora-do-host': [ARQUIVOS, "return FileManager.remoteClient ? FileManager.remoteClient + url : '/client/' + url;", "return '/client/' + url;"],
	'url-sem-barra-normal': [ARQUIVOS, "const url = filename.replace(/\\\\/g, '/').replace(", 'const url = filename.replace('],
	// --- o vigia, a medida e o worker ---
	'vigia-inteiro-sem-versao': [VIGIA, 'bytes: buffer.byteLength,\n\t\t\t\t\t\tdoCacheHttp: veioDoCacheHttp(url),\n\t\t\t\t\t\tversaoDoGrf', 'bytes: buffer.byteLength,\n\t\t\t\t\t\tdoCacheHttp: veioDoCacheHttp(url)'],
	'vigia-pedacos-sem-versao': [VIGIA, 'bytes: recebidos,\n\t\t\t\t\t\t\tdoCacheHttp: veioDoCacheHttp(url),\n\t\t\t\t\t\t\tversaoDoGrf', 'bytes: recebidos,\n\t\t\t\t\t\t\tdoCacheHttp: veioDoCacheHttp(url)'],
	'medida-nao-conta-o-aparelho': [MEDIDA, "origem === 'cache-aparelho' || ", '']
	// A costura do worker (`ThreadEventHandler.js`, a reconferencia a cada
	// LOAD_MAP) e lida do DISCO pelo teste, e a mutacao daqui e so na memoria:
	// ela foi medida com a linha apagada no disco e restauro por copia (17/10:
	// morta, 1 teste reprovado). Ver `WORKER` abaixo, para quem quiser repetir.
};

/** O alvo da costura medida no disco (nao entra no laco em memoria). */
export const COSTURA_NO_DISCO = [WORKER, '\t\t\t\tFileManager.cacheDoAparelho.reverificar();\n'];

export const NOMES = Object.keys(mutantes);

const nome = process.env.RAG_MUTANTE_CACHE || '';
const mutante = nome ? mutantes[nome] : null;
if (nome && !mutante) throw new Error('Escolha RAG_MUTANTE_CACHE: ' + NOMES.join(', ') + '.');

export default {
	...base,
	plugins: mutante
		? [
				{
					name: 'cache-do-aparelho-somente-em-memoria',
					enforce: 'pre',
					transform(codigo, id) {
						const [alvo, de, para] = mutante;
						if (!id.replaceAll('\\', '/').endsWith(alvo)) return null;
						const normal = codigo.replace(/\r\n/g, '\n');
						if (normal.split(de).length !== 2) throw new Error('Mutante ' + nome + ' nao casa exatamente uma vez.');
						return normal.replace(de, () => para);
					}
				}
			]
		: [],
	test: {
		...base.test,
		include: [
			'tests/core/cacheDeArquivos.test.js',
			'tests/core/cacheDoAparelho.test.js',
			'tests/core/baixarComVigia.test.js',
			'tests/core/tentativasDeArquivo.test.js',
			'tests/loaders/mapLoaderMedeECancela.test.js'
		]
	}
};
