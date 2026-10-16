/**
 * Core/cacheDeArquivos.js
 *
 * AS DECISOES DO CACHE DE ARQUIVOS DO APARELHO (15/10/2026, D-2547..D-2549 -
 * Lote D, item 18 da varredura de rede de 15/10: "celular sem cache local de
 * arquivos: mapa repetido baixado de novo").
 *
 * Puro: nenhuma API do navegador entra aqui. Quem fala com o Cache Storage e
 * `Core/cacheDoAparelho.js`; quem decide QUANDO perguntar a ele e o
 * `FileManager`.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ELE EXISTE
 * ---------------------------------------------------------------------------
 * O unico cache de arquivos persistente do roBrowser e o `FileSystem`
 * (`webkitRequestFileSystemSync`), que nao existe no iOS nem no Firefox. Neles
 * o mapa repetido depende do cache HTTP do navegador, que o celular despeja
 * cedo (o `.gnd` tem 5 a 13 MB). Medido em producao (15/10): carregamento de
 * mapa no celular pela rede, mediana 4,0 s e p95 17,9 s; com cache, 3,4 s e
 * 7,9 s.
 *
 * ---------------------------------------------------------------------------
 * A REGRA QUE O FAZ EXATO: SO SE GUARDA E SO SE LE NA VERSAO DO GRF
 * ---------------------------------------------------------------------------
 * O jogador nao pode ver um arquivo que o servidor nao serviria. A unica
 * garantia disso e a VERSAO do GRF dita pelo proprio servidor de assets:
 *
 *  - o cache tem o nome da versao (`nomeDoCache`); a versao nova apaga os
 *    velhos (`cachesParaApagar`);
 *  - a versao da SESSAO so vem da rota sem cache (`ROTA_DA_VERSAO`,
 *    `no-store`), nunca de uma resposta que pode ter saido do cache HTTP;
 *  - um arquivo so e guardado se a resposta dele traz o cabecalho
 *    `CABECALHO_DA_VERSAO` IGUAL a versao da sessao (`podeGuardar`). O
 *    derivado (`no-cache`, tabelas montadas pelo servidor) e o arquivo solto
 *    nao trazem o cabecalho e nunca entram.
 *
 * O SERVIDOR DE HOJE NAO MANDA O CABECALHO (o `ETag` de 15/10 nao e legivel
 * entre origens: so o `X-Tamanho-Original` esta no `Expose-Headers`, e a
 * etiqueta e por arquivo, nao do GRF). Sem o cabecalho, nada aqui liga: nenhum
 * pedido novo, nenhuma leitura, nenhuma escrita - o caminho e o de antes.
 */

/** O prefixo de TODO cache deste modulo. NAO pode comecar com `ragidle-casca-` (o do `sw.js`). */
export const PREFIXO_DO_CACHE = 'ragidle-arquivos-';

/** O formato das entradas; trocar o numero apaga tudo o que o formato velho guardou. */
export const ESQUEMA_DO_CACHE = '1';

/** O cabecalho (minusculo, como o `Headers.get` compara) com a versao do GRF da resposta. */
export const CABECALHO_DA_VERSAO = 'x-versao-do-grf';

/** A rota do servidor de assets que diz a versao do GRF em uso, sem cache. */
export const ROTA_DA_VERSAO = '__versao-do-grf';

/**
 * O teto do cache inteiro, em bytes: 150 MiB. Um mapa (o `.rsw`, o `.gat`, o
 * `.gnd` de 5 a 13 MB, as texturas e os modelos) passa de 15 a 30 MB; 150 MiB
 * cabem a cidade e quatro a oito mapas de caca, que e o rodizio de um jogador.
 * Mais que isso disputaria a cota com o resto do aparelho para guardar mapa que
 * o jogador nao visita.
 */
export const TETO_FIXO_BYTES = 150 * 1024 * 1024;

/**
 * A fracao da cota da origem (`navigator.storage.estimate().quota`) que o cache
 * pode tomar: 20%. No celular com pouco espaco a cota e pequena e o teto desce
 * com ela, e o navegador nao chega a despejar a origem inteira por nossa causa.
 */
export const FRACAO_DA_COTA = 0.2;

/**
 * O maior arquivo guardavel: 32 MiB, o mesmo `TETO_DE_BYTES_DE_UM_ARQUIVO` do
 * servidor de assets (a maior entrada do `data.grf` tem 21.395.470 bytes).
 */
export const TETO_DE_UM_ARQUIVO_BYTES = 32 * 1024 * 1024;

/**
 * Quanto a leitura do cache pode levar antes de o arquivo ir a rede como se
 * nao estivesse guardado. A leitura e de disco, em milissegundos; a guarda
 * existe para que um Cache Storage travado nunca prenda o mapa (o "preso para
 * sempre" da D-2055, uma camada acima).
 */
export const PRAZO_DA_LEITURA_MS = 3000;

/** Quanto esperar, depois da ultima mudanca, para regravar o indice. */
export const ESPERA_DO_INDICE_MS = 2000;

/**
 * A versao que o servidor mandou, ou `null` se nao ha versao legivel. Aceita so
 * letras, digitos, ponto, hifen e sublinhado, ate 80 caracteres: ela vira nome
 * de cache, e um cabecalho estranho (ou um duble que responde o mesmo texto a
 * qualquer nome de cabecalho) nao pode virar versao.
 *
 * @param {unknown} texto
 * @returns {string|null}
 */
export function versaoValida(texto) {
	if (typeof texto !== 'string') return null;
	const versao = texto.trim();
	return /^[A-Za-z0-9._-]{1,80}$/.test(versao) ? versao : null;
}

/**
 * @param {string} versao - ja validada
 * @returns {string}
 */
export function nomeDoCache(versao) {
	return PREFIXO_DO_CACHE + ESQUEMA_DO_CACHE + '-' + versao;
}

/**
 * Os caches deste modulo que nao sao o da versao atual: a versao velha do GRF
 * e o esquema velho. Os de outros donos (a casca do `sw.js`) ficam.
 *
 * @param {string[]} nomes - `caches.keys()`
 * @param {string} atual - `nomeDoCache(versao)`
 * @returns {string[]}
 */
export function cachesParaApagar(nomes, atual) {
	return nomes.filter(nome => typeof nome === 'string' && nome.startsWith(PREFIXO_DO_CACHE) && nome !== atual);
}

/**
 * O arquivo passa pelo cache? Nao o que o `FileManager.getHTTP` nao baixa (o
 * som `.mp3`/`.wav`, que ele devolve como URL para o `<audio>`). A expressao e
 * a MESMA de la, com a mesma caixa.
 *
 * @param {string} nome
 * @returns {boolean}
 */
export function arquivoGuardavel(nome) {
	return typeof nome === 'string' && !nome.match(/\.(mp3|wav)$/);
}

/**
 * Esta resposta pode entrar no cache?
 *
 * @param {object} p
 * @param {string|null} p.versaoDaResposta - o cabecalho, ja validado
 * @param {string|null} p.versaoDaSessao - a da rota sem cache
 * @param {number} p.bytes
 * @param {number} p.teto - o teto total (um arquivo maior que ele nunca cabe)
 * @returns {boolean}
 */
export function podeGuardar(p) {
	return (
		p.versaoDaSessao !== null &&
		p.versaoDaResposta === p.versaoDaSessao &&
		p.bytes > 0 &&
		p.bytes <= TETO_DE_UM_ARQUIVO_BYTES &&
		p.bytes <= p.teto
	);
}

/**
 * O teto total para a cota da origem (0 ou desconhecida: o fixo).
 *
 * @param {number} cota
 * @returns {number}
 */
export function tetoTotal(cota) {
	if (!(cota > 0)) return TETO_FIXO_BYTES;
	return Math.min(TETO_FIXO_BYTES, Math.floor(cota * FRACAO_DA_COTA));
}

/** Um indice vazio. */
export function indiceVazio() {
	return { uso: 0, arquivos: {} };
}

/**
 * O indice lido do cache, conferido campo a campo. O que nao confere vira o
 * indice vazio (e a reconciliacao apaga as entradas sem indice).
 *
 * @param {unknown} dado
 * @returns {{uso: number, arquivos: Object<string, {bytes: number, uso: number}>}}
 */
export function indiceConferido(dado) {
	if (!dado || typeof dado !== 'object' || !dado.arquivos || typeof dado.arquivos !== 'object') {
		return indiceVazio();
	}
	const saida = indiceVazio();
	saida.uso = Number.isFinite(dado.uso) && dado.uso > 0 ? Math.floor(dado.uso) : 0;
	for (const url of Object.keys(dado.arquivos)) {
		const e = dado.arquivos[url];
		if (e && Number.isFinite(e.bytes) && e.bytes > 0 && Number.isFinite(e.uso)) {
			saida.arquivos[url] = { bytes: e.bytes, uso: e.uso };
			if (e.uso > saida.uso) saida.uso = e.uso;
		}
	}
	return saida;
}

/**
 * O indice so com o que o cache tem de verdade, e as entradas do cache que o
 * indice nao conhece (orfas: a escrita que morreu antes de o indice ser
 * gravado, ou a outra aba). As orfas sao APAGADAS: sem o tamanho delas o teto
 * nao seria teto.
 *
 * @param {{uso: number, arquivos: object}} indice
 * @param {string[]} chaves - as URLs guardadas (sem a do indice)
 * @returns {{indice: object, orfas: string[]}}
 */
export function reconciliar(indice, chaves) {
	const existe = new Set(chaves);
	const arquivos = {};
	for (const url of Object.keys(indice.arquivos)) {
		if (existe.has(url)) arquivos[url] = indice.arquivos[url];
	}
	const orfas = chaves.filter(url => !(url in arquivos));
	return { indice: { uso: indice.uso, arquivos }, orfas };
}

/**
 * @param {{arquivos: object}} indice
 * @returns {number}
 */
export function totalDoIndice(indice) {
	let total = 0;
	for (const url of Object.keys(indice.arquivos)) total += indice.arquivos[url].bytes;
	return total;
}

/**
 * O DESPEJO: quem sai, do menos usado ha mais tempo para o mais recente, para
 * que `entrando` bytes caibam no teto. A entrada da mesma URL (o arquivo que
 * esta sendo regravado) nao conta: ela sera substituida. `null` se nao cabe nem
 * com o cache vazio.
 *
 * @param {{arquivos: object}} indice
 * @param {number} teto
 * @param {string} url - quem entra
 * @param {number} entrando - os bytes dele
 * @returns {string[]|null}
 */
export function despejo(indice, teto, url, entrando) {
	if (entrando > teto) return null;
	const outros = Object.keys(indice.arquivos).filter(u => u !== url);
	let total = 0;
	for (const u of outros) total += indice.arquivos[u].bytes;
	outros.sort((a, b) => indice.arquivos[a].uso - indice.arquivos[b].uso);
	const sai = [];
	for (const u of outros) {
		if (total + entrando <= teto) break;
		total -= indice.arquivos[u].bytes;
		sai.push(u);
	}
	return sai;
}

/**
 * O erro e de cota (o navegador recusou a escrita por falta de espaco)?
 *
 * @param {unknown} erro
 * @returns {boolean}
 */
export function erroDeCota(erro) {
	return !!erro && (erro.name === 'QuotaExceededError' || erro.code === 22);
}
