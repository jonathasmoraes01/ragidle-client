/**
 * Loaders/medidaDaCarga.js
 *
 * A MEDIDA POR FASE DO CARREGAMENTO DO MAPA, do lado do worker (D-2055,
 * 06/10/2026 — "medir antes de mexer", ordem do dono).
 *
 * O relato de producao era "travou em 2%", e nada dizia QUAL arquivo, quanto
 * cada fase levou, nem se o arquivo veio do cache. Este acumulador e
 * alimentado pelo `MapLoader` a cada arquivo e a cada fase, e o resumo viaja
 * com o fim da carga ao fio principal (`Renderer/relatoDoCarregamento.js`), que
 * o junta com o que so ele sabe (a espera pelo servidor, a montagem, o
 * aparelho) e manda UM relato por carregamento ao `/analytics`.
 *
 * Puro: o relogio e injetado. Nenhum dado do jogador entra aqui.
 */

/** As fases do worker, na ordem em que acontecem. */
export const FASES_DO_WORKER = ['rsw', 'gat', 'gnd', 'texturasDoChao', 'modelos', 'texturasDosModelos'];

/** Os tres arquivos-base: sem eles nada aparece, e o `.gnd` e o maior. */
const ARQUIVOS_BASE = ['rsw', 'gat', 'gnd'];

/** Origem que NAO passou pela rede. */
function doCache(origem) {
	return origem === 'cache-local' || origem === 'cache-http' || origem === 'disco';
}

/**
 * @param {function(): number} agora
 */
export function criarMedidaDaCarga(agora) {
	const inicioDe = {};
	const duracao = {};
	const base = {};
	let arquivos = 0;
	let arquivosDoCache = 0;
	let tentativas = 0;
	let silencios = 0;
	let bytes = 0;
	let falhas = 0;

	return {
		/** @param {string} fase */
		comecar(fase) {
			inicioDe[fase] = agora();
		},
		/** @param {string} fase */
		terminar(fase) {
			if (typeof inicioDe[fase] === 'number' && typeof duracao[fase] !== 'number') {
				duracao[fase] = Math.max(0, agora() - inicioDe[fase]);
			}
		},
		/**
		 * Um arquivo terminou (chegou ou desistiu). `info` e o terceiro argumento
		 * do `FileManager.load` - ausente num GRF local, que conta como cache.
		 *
		 * @param {object|undefined} info
		 * @param {string} [qualBase] - 'rsw' | 'gat' | 'gnd' quando e um dos tres
		 */
		contarArquivo(info, qualBase) {
			const i = info || { origem: 'grf' };
			arquivos++;
			const veioDoCache = doCache(i.origem) || i.origem === 'grf';
			if (veioDoCache) arquivosDoCache++;
			tentativas += i.tentativas || 0;
			silencios += i.silencios || 0;
			bytes += i.bytes || 0;
			if (i.falhou) falhas++;
			if (qualBase) base[qualBase] = veioDoCache;
		},
		/** O resumo que viaja ao fio principal (so numeros e booleanos). */
		resumo() {
			const saida = { arquivos, arquivosDoCache, tentativas, silencios, bytes, falhas };
			for (const fase of FASES_DO_WORKER) {
				if (typeof duracao[fase] === 'number') {
					saida['fase' + fase.charAt(0).toUpperCase() + fase.slice(1) + 'Ms'] = Math.round(duracao[fase]);
				}
			}
			// "Veio do cache" e a pergunta do cache de mapas (D-2055, item 4):
			// so vale sim quando os TRES arquivos-base vieram sem rede.
			const conhecidos = ARQUIVOS_BASE.filter(b => typeof base[b] === 'boolean');
			if (conhecidos.length === ARQUIVOS_BASE.length) {
				saida.baseDoCache = conhecidos.every(b => base[b]);
			}
			return saida;
		}
	};
}
