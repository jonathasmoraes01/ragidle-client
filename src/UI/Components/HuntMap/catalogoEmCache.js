/**
 * OS MAPAS DO CATALOGO GUARDADOS NO CLIENTE (D-1850, 30/09/2026 - pedido do
 * dono: *"Em relacao ao Mapa de Caca, podemos otimiza-lo tambem? Tanto em
 * rede/cpu?"*).
 *
 * ===========================================================================
 * O QUE A MEDICAO MOSTROU
 * ===========================================================================
 * Cada abertura do Mapa de Caca descia o catalogo INTEIRO: ~88 KB em duas
 * partes, e ~87 KB disso sao os `mapas`, iguais para todo jogador enquanto o
 * servidor estiver de pe. O servidor passou a mandar a IMPRESSAO deles
 * (`fixo`, 12 hex) em toda resposta cheia; este modulo guarda os mapas com a
 * impressao, e a abertura seguinte pergunta `{acao:'catalogo', fixo}`. Se a
 * impressao bate, o servidor responde so o cabecalho (~1 KB, SEM a chave
 * `mapas`), e os mapas saem daqui (`servidor/mapa/catalogo-leve.ts`).
 *
 * ===========================================================================
 * AS DUAS CAMADAS
 * ===========================================================================
 * 1. MEMORIA: os objetos `mapas` da ultima resposta cheia, os MESMOS que a
 *    janela desenhou (com os nomes de drop ja resolvidos). Eles nao dependem
 *    do personagem - a troca de personagem NAO os esquece.
 * 2. ARMAZENAMENTO do navegador (`localStorage`): a impressao e as paginas
 *    CRUAS, uma por linha (`<impressao>\n<pagina 1>\n<pagina 2>`). Assim a
 *    primeira abertura de uma sessao NOVA tambem e leve, enquanto o conteudo
 *    do servidor nao mudar. As paginas cruas guardam os drops como `itemId`
 *    (o que o servidor mandou), e nao os nomes da maquina.
 *
 * Todo acesso ao armazenamento esta em try/catch: janela privada, cota
 * estourada e site bloqueado viram "sem cache", e "sem cache" e o pedido cheio
 * de sempre - o caminho que sempre funciona.
 *
 * Este arquivo nao importa nada: sem DOM, sem rede. Ele recebe o armazenamento
 * por parametro, para o teste poder rodar sem navegador.
 */

/** A chave no `localStorage`. Versionada no nome: forma nova, chave nova. */
export const CHAVE_DO_CATALOGO_FIXO = 'RagIdle.HuntMap.catalogoFixo.v1';

const FORMA_DA_IMPRESSAO = /^[0-9a-f]{12}$/;

/** A resposta e a LEVE (so o cabecalho): tem impressao e NAO tem a chave `mapas`. */
export function ehRespostaLeve(data) {
	return !!data && typeof data.fixo === 'string' && !Object.prototype.hasOwnProperty.call(data, 'mapas');
}

/**
 * A IDENTIDADE de um catalogo ja montado, para a regra 2 do `HuntMap.js` (o
 * mesmo catalogo nao desenha de novo): a impressao dos mapas mais o CABECALHO
 * (tudo menos `mapas`, `parte` e `partes`). O cheio e o leve do mesmo catalogo
 * para o mesmo jogador dao a MESMA identidade - o leve so nao traz os mapas.
 *
 * `null` sem impressao (servidor antigo): quem chama compara as paginas cruas,
 * como antes. Erro de ordem de chave aqui so custa um redesenho a mais, nunca
 * um desenho errado: identidade igual exige impressao igual.
 */
export function identidadeDoCatalogo(data) {
	if (!data || typeof data.fixo !== 'string') {
		return null;
	}
	const cabecalho = {};
	for (const chave of Object.keys(data)) {
		if (chave !== 'mapas' && chave !== 'parte' && chave !== 'partes') {
			cabecalho[chave] = data[chave];
		}
	}
	return `fixo:${data.fixo}|${JSON.stringify(cabecalho)}`;
}

/**
 * Os `mapas` de paginas cruas guardadas, na ordem. `null` se alguma pagina nao
 * for legivel - meia lista seria pior que nenhuma (o risco da Caca Medida e
 * alinhado a ORDEM do catalogo inteiro).
 */
function mapasDasPaginas(paginas) {
	let mapas = [];
	for (const json of paginas) {
		const p = JSON.parse(json);
		if (!p || !Array.isArray(p.mapas)) {
			return null;
		}
		mapas = mapas.concat(p.mapas);
	}
	return mapas;
}

/**
 * @param {Storage|null} armazenamento - o `localStorage`, ou `null` sem ele
 */
export function criarCacheDoCatalogo(armazenamento) {
	/** @type {{ fixo: string, mapas: object[] } | null} */
	let emMemoria = null;

	function ler() {
		try {
			return armazenamento ? armazenamento.getItem(CHAVE_DO_CATALOGO_FIXO) : null;
		} catch (e) {
			return null;
		}
	}

	return {
		/** A impressao que o cliente pode mandar no pedido leve, ou `null`. */
		impressao() {
			if (emMemoria) {
				return emMemoria.fixo;
			}
			const guardado = ler();
			if (typeof guardado !== 'string') {
				return null;
			}
			const fim = guardado.indexOf('\n');
			const fixo = fim < 0 ? '' : guardado.slice(0, fim);
			return FORMA_DA_IMPRESSAO.test(fixo) ? fixo : null;
		},

		/**
		 * Guarda os mapas de uma resposta CHEIA. `mapas` e o array que a janela
		 * vai usar; `bruto` sao as paginas cruas unidas por `\n` (JSON nao tem
		 * quebra de linha crua, entao a separacao e segura).
		 *
		 * @returns {string|null} o texto a gravar no armazenamento (o chamador
		 *          grava fora do caminho do desenho, com `gravar`), ou `null`
		 */
		guardar(fixo, mapas, bruto) {
			if (!FORMA_DA_IMPRESSAO.test(String(fixo)) || !Array.isArray(mapas)) {
				return null;
			}
			emMemoria = { fixo, mapas };
			return typeof bruto === 'string' ? `${fixo}\n${bruto}` : null;
		},

		/** Grava o texto de `guardar` no armazenamento (cota estourada = sem cache). */
		gravar(texto) {
			if (typeof texto !== 'string' || !armazenamento) {
				return;
			}
			try {
				armazenamento.setItem(CHAVE_DO_CATALOGO_FIXO, texto);
			} catch (e) {
				try {
					armazenamento.removeItem(CHAVE_DO_CATALOGO_FIXO);
				} catch (e2) {
					/* sem armazenamento: fica so a memoria */
				}
			}
		},

		/**
		 * Os `mapas` da impressao pedida, ou `null` se o cliente nao os tem mais.
		 * A memoria vem primeiro; sem ela, as paginas cruas do armazenamento.
		 */
		mapasDe(fixo) {
			if (emMemoria && emMemoria.fixo === fixo) {
				return emMemoria.mapas;
			}
			const guardado = ler();
			if (typeof guardado !== 'string') {
				return null;
			}
			const linhas = guardado.split('\n');
			if (linhas[0] !== fixo || linhas.length < 2) {
				return null;
			}
			let mapas;
			try {
				mapas = mapasDasPaginas(linhas.slice(1));
			} catch (e) {
				mapas = null;
			}
			if (!mapas) {
				return null;
			}
			emMemoria = { fixo, mapas };
			return mapas;
		},

		/** Esquece as duas camadas (a impressao guardada nao serve mais). */
		esquecer() {
			emMemoria = null;
			try {
				if (armazenamento) {
					armazenamento.removeItem(CHAVE_DO_CATALOGO_FIXO);
				}
			} catch (e) {
				/* sem armazenamento */
			}
		}
	};
}

/** O `localStorage` do navegador, ou `null` onde ele nao existe ou lanca ao ser tocado. */
export function armazenamentoDoNavegador() {
	try {
		return typeof localStorage !== 'undefined' ? localStorage : null;
	} catch (e) {
		return null;
	}
}
