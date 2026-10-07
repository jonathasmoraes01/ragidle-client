// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
// A carga do mapa que nao fica presa para sempre (D-2055, 06/10/2026) e os
// achados A1/A3 que vieram junto.
// Uso: RAG_MUTANTE_CARGA=<nome> npx vitest run --config tests/mutantes/carga-do-mapa.config.mjs
// Cada mutante tem de REPROVAR ao menos um dos testes de `include`.
// As costuras que os testes leem do DISCO (Renderer, Mobile, MapEngine,
// MapControl, Client) nao se medem aqui: foram medidas com a mutacao no disco e
// restauro por copia (ver o relatorio da D-2055).
import base from '../../vite.config.js';

const VIGIA = 'src/Core/baixarComVigia.js';
const ARQUIVOS = 'src/Core/FileManager.js';
const CARGA = 'src/Loaders/MapLoader.js';
const MAPA = 'src/Renderer/MapRenderer.js';
const RELOGIOS = 'src/Renderer/vigiaDoCarregamento.js';
const RELATO = 'src/Renderer/relatoDoCarregamento.js';
const MEDIDA = 'src/Loaders/medidaDaCarga.js';
const EVENTOS = 'src/Core/Events.js';
const MEMORIA = 'src/Core/MemoryManager.js';
const TRANSFERE = 'src/Loaders/transferiveisDoMapa.js';
const MUNDO = 'src/Controls/guardaDoMundo.js';
const FIO = 'src/Core/Thread.js';
const SAIDA_UI = 'src/UI/saidaDoCarregamento.js';

const mutantes = {
	// --- o prazo por pedido (A4) ---
	'prazo-mil-vezes-maior': [VIGIA, '}, limiteMs);', '}, limiteMs * 1000);'],
	'pedaco-nao-rearma': [VIGIA, '\t\t\t\t\tarmar();\n\t\t\t\t\tpedacos.push(value);', '\t\t\t\t\tpedacos.push(value);'],
	'silencio-nao-aborta': [VIGIA, '\t\t\t\terro.silencio = true;\n\t\t\t\tfalhar(erro);\n\t\t\t\tabortar();', '\t\t\t\terro.silencio = true;\n\t\t\t\tfalhar(erro);'],
	'cancelado-vira-silencio': [VIGIA, 'erro.cancelado = true;', 'erro.silencio = true;'],
	// --- o FileManager ---
	'cancelado-tenta-de-novo': [ARQUIVOS, 'if (err && err.cancelado) {', 'if (false) {'],
	'silencio-nao-conta': [ARQUIVOS, '\t\t\t\t\t\t\tsilencios++;', ''],
	'guarda-do-cache-mil-vezes': [ARQUIVOS, '}, PRAZO_DO_CACHE_LOCAL_MS);', '}, PRAZO_DO_CACHE_LOCAL_MS * 1000);'],
	'cache-tarde-entrega-de-novo': [
		ARQUIVOS,
		'\t\t\t\tif (respondeu) return;\n\t\t\t\trespondeu = true;\n\t\t\t\tclearTimeout(guarda);\n\t\t\t\tconst reader',
		'\t\t\t\trespondeu = true;\n\t\t\t\tclearTimeout(guarda);\n\t\t\t\tconst reader'
	],
	'info-nao-chega-a-quem-pediu': [ARQUIVOS, '\t\t\tcallback(result, error, info);', '\t\t\tcallback(result, error);'],
	// --- o MapLoader ---
	'cancelada-continua-falando': [CARGA, '\t\t\t\tif (this.cancelada) {\n\t\t\t\t\treturn;\n\t\t\t\t}\n\t\t\t\tthis.medida.contarArquivo', '\t\t\t\tthis.medida.contarArquivo'],
	'montagem-sem-try': [
		CARGA,
		'\t\t\t\ttry {\n\t\t\t\t\tpronto(resultado, erro);\n\t\t\t\t} catch (excecao) {',
		'\t\t\t\t{\n\t\t\t\t\tpronto(resultado, erro);\n\t\t\t\t}\n\t\t\t\tif (false) {\n\t\t\t\t\tconst excecao = null;'
	],
	'cancelar-nao-aborta': [CARGA, '\t\t\tif (this.controlador) this.controlador.abort();', ''],
	'medida-nao-vai-junto': [CARGA, '\t\tthis.onload(sucesso, erro, this.medida.resumo());', '\t\tthis.onload(sucesso, erro);'],
	'fase-do-gnd-sem-fim': [CARGA, "\t\t\tloader.medida.terminar('gnd');", ''],
	// --- a medida ---
	'base-do-cache-sem-os-tres': [MEDIDA, 'if (conhecidos.length === ARQUIVOS_BASE.length) {', 'if (conhecidos.length > 0) {'],
	'cache-http-conta-como-rede': [MEDIDA, "origem === 'cache-local' || origem === 'cache-http' || origem === 'disco'", "origem === 'cache-local' || origem === 'disco'"],
	// --- o MapRenderer ---
	'carga-velha-fala': [MAPA, 'envelope.carga !== _carga) {', 'envelope.carga !== envelope.carga) {'],
	'carga-velha-monta': [MAPA, '\tif (carga !== _carga) {\n\t\treturn;\n\t}\n\tprotegido(', '\tprotegido('],
	'sem-vigia': [MAPA, "\t\t\t\tprotegido('a vigia da carga', () => _vigia.comecar());\n", ''],
	'falha-sem-zerar-o-nome': [MAPA, "\t\tthis.currentMap = '';\n\t\tprotegido('a saida da carga', () => {", "\t\tprotegido('a saida da carga', () => {"],
	'falha-com-caixa-de-erro': [
		MAPA,
		"\t\t\tmostrarSaidaDaCarga('O mapa não carregou (' + String(error || 'erro desconhecido') + ').');",
		"\t\t\tUIManager.showErrorBox(error);"
	],
	'progresso-nao-fecha-saida': [MAPA, '\t\tif (saidaVisivel()) esconderSaida();', ''],
	'refazer-sem-soltar-o-loading': [MAPA, "\t\tthis.mapaPendente = null;\n\t\tthis.loading = false;", '\t\tthis.mapaPendente = null;'],
	'messageerror-ignorado': [MAPA, "falha.tipo === 'messageerror'", "falha.tipo === 'nunca'"],
	'falha-sem-novo-numero': [MAPA, '\tconst carga = ++_carga;\n\ttry {', '\tconst carga = _carga;\n\ttry {'],
	'recarregar-sem-relato': [MAPA, "\t\t\trelatarDesistencia('recarregou');\n", ''],
	'verbo-sem-o-aparelho': [MAPA, 'mostrarSaidaDaCarga(textoDaCargaParada(ehDedo()))', 'mostrarSaidaDaCarga(textoDaCargaParada(true))'],
	'verbo-invertido': [SAIDA_UI, '\treturn dedo\n', '\treturn !dedo\n'],
	// --- os relogios da vigia ---
	'tentativa-segura-a-saida': [RELOGIOS, "if (!atividade || typeof atividade.tentativa !== 'number') {", 'if (true) {'],
	'bytes-nao-seguram-a-saida': [RELOGIOS, '\t\t\t\tarmarTravada();\n\t\t\t\tif (travou) {', '\t\t\t\tif (travou) {'],
	'progresso-nao-rearma-o-aviso': [RELOGIOS, '\t\t\tarmarTravada();\n\t\t\tarmarAviso();\n\t\t\tif (demorando) {', '\t\t\tarmarTravada();\n\t\t\tif (demorando) {'],
	// --- o relato ---
	'relato-na-mesma-volta': [RELATO, '\t\tagendar(() => enviar(relato), 0);', '\t\tenviar(relato);'],
	'dois-relatos': [RELATO, '\t\t_atual = null;\n\t\tagendar(', '\t\tagendar('],
	'sem-espera-do-servidor': [RELATO, 'veioDaEntrada ? Math.max(0, _entradaAceitaEm - _pedidoDeEntradaEm) : undefined', 'undefined'],
	'worker-sem-filtro': [RELATO, "if (typeof valor === 'number' || typeof valor === 'boolean') {", 'if (true) {'],
	'entrada-velha-vale': [RELATO, 'agora - _entradaAceitaEm <= JANELA_DA_ENTRADA_MS', 'true'],
	// --- A1, A3 ---
	'evento-sem-try': [
		EVENTOS,
		'\t\t\ttry {\n\t\t\t\tevento.callback();\n\t\t\t} catch (erro) {',
		'\t\t\t{\n\t\t\t\tevento.callback();\n\t\t\t}\n\t\t\tif (false) {\n\t\t\t\tconst erro = null;'
	],
	'falha-esquecida-cedo': [MEMORIA, 'if (!(agora - (item.errouEm || 0) >= PRAZO_PARA_REPETIR_FALHA_MS)) {', 'if (false) {'],
	'esquece-o-que-carrega': [MEMORIA, 'if (!item || !item.complete || !item._error || item._data) {', 'if (!item) {'],
	'transfere-vista-parcial': [TRANSFERE, '\t\t\tvista.byteLength === vista.buffer.byteLength &&\n', ''],
	'transfere-o-mesmo-duas-vezes': [TRANSFERE, ' &&\n\t\t\tlista.indexOf(vista.buffer) < 0', ''],
	'mundo-sempre-responde': [MUNDO, 'return !!(sessao && sessao.Entity);', 'return true;'],
	'falha-do-worker-muda': [FIO, '\t\tconst gancho = _hook.THREAD_FALHOU;', '\t\tconst gancho = null;']
};
const nome = process.env.RAG_MUTANTE_CARGA;
const mutante = mutantes[nome];
if (!mutante) throw new Error('Escolha RAG_MUTANTE_CARGA: ' + Object.keys(mutantes).join(', ') + '.');
const [alvo, de, para] = mutante;

export default {
	...base,
	plugins: [
		{
			name: 'carga-do-mapa-somente-em-memoria',
			enforce: 'pre',
			transform(codigo, id) {
				if (!id.replaceAll('\\', '/').endsWith(alvo)) return null;
				const normal = codigo.replace(/\r\n/g, '\n');
				if (normal.split(de).length !== 2) throw new Error('Mutante ' + nome + ' nao casa exatamente uma vez.');
				return normal.replace(de, para);
			}
		}
	],
	test: {
		...base.test,
		include: [
			'tests/core/baixarComVigia.test.js',
			'tests/core/tentativasDeArquivo.test.js',
			'tests/core/lacoNaoMorreNaExcecao.test.js',
			'tests/core/falhaDoWorkerNaoPrende.test.js',
			'tests/loaders/mapLoaderMedeECancela.test.js',
			'tests/renderer/cargaDoMapaNaoFicaPresa.test.js',
			'tests/renderer/relatoDoCarregamento.test.js'
		]
	}
};

export const NOMES = Object.keys(mutantes);
