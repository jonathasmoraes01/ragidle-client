/**
 * DB/Items/classesDosItens.js
 *
 * QUAL CLASSE USA QUAL EQUIPAMENTO (J7, relato da comunidade, 15/10/2026,
 * D-2470) - o dado do filtro por classe do Mapa de Caca.
 *
 * ## O buraco
 *
 * O cliente nao sabe de que classe e cada arma e armadura: o `ItemTable.js`
 * nasce do GRF, e la a classe so existe como TEXTO dentro da descricao. O
 * catalogo do Mapa de Caca tambem nao ajuda (so ids de drop, por causa do teto
 * de 65.535 bytes do pacote).
 *
 * ## A fonte
 *
 * `/ragidle/classes-dos-itens.json`, publicado pelo repositorio do jogo
 * (`scripts/publicar-classes-dos-itens.ts`) a partir do bloco `Jobs`/`Classes`
 * do `item_db` do rAthena, pela MESMA regra do vestir do servidor. Nada aqui e
 * tabela a mao, e este modulo nao decide quem usa o que: so le o arquivo.
 *
 * ## O formato (v1)
 *
 *   classes   - nomes de item_db das classes jogaveis (`Swordman`, `Bard`...)
 *   nomes     - o nome em portugues de cada uma, no mesmo indice
 *   conjuntos - listas distintas de indices de `classes`
 *   itens     - itemId -> indice em `conjuntos`
 *
 * Item ausente de `itens` nao e equipamento (ou esta fora do recorte): para ele
 * `classeUsaItem` devolve `null`, e quem filtra trata como "nao conta".
 *
 * ## A carga
 *
 * Uma vez por sessao, sob demanda. Falha de rede nao derruba nada: o seletor
 * de classe do Mapa de Caca simplesmente nao aparece, e o console registra o
 * motivo (o arquivo e publicado pelo OUTRO repositorio, e "nao subiu" e a falha
 * provavel).
 *
 * @author RagIdle
 */

/** O `v` que este modulo sabe ler. Contrato diferente = arquivo recusado. */
const VERSAO_ACEITA = 1;

const CAMINHO = '/ragidle/classes-dos-itens.json';

/** @type {Array<{id: string, nome: string}>} */
let _classes = [];

/** @type {Array<Set<number>>} */
let _conjuntos = [];

/** @type {Map<number, number>} itemId -> indice em _conjuntos */
const _itens = new Map();

/** @type {Promise<boolean>|null} a carga em curso (ou a que ja terminou) */
let _carga = null;

/**
 * Le o JSON publicado para dentro das tabelas. Exportada para o teste poder
 * exercitar o formato sem rede.
 *
 * @param {object} dados - o objeto do arquivo
 * @returns {number} quantos equipamentos entraram
 */
export function absorverClassesDosItens(dados) {
	if (
		!dados ||
		dados.v !== VERSAO_ACEITA ||
		!Array.isArray(dados.classes) ||
		!Array.isArray(dados.nomes) ||
		!Array.isArray(dados.conjuntos) ||
		!dados.itens
	) {
		throw new Error(
			`classes-dos-itens.json: versao ${dados && dados.v} nao reconhecida (esperava ${VERSAO_ACEITA})`
		);
	}

	_classes = dados.classes.map((id, i) => ({ id, nome: dados.nomes[i] || id }));
	_conjuntos = dados.conjuntos.map(lista => new Set(lista));
	_itens.clear();
	for (const id in dados.itens) {
		const indice = dados.itens[id];
		if (Number.isInteger(indice) && indice >= 0 && indice < _conjuntos.length) {
			_itens.set(parseInt(id, 10), indice);
		}
	}
	return _itens.size;
}

/**
 * Carrega o arquivo uma vez por sessao. Chamar de novo devolve a MESMA
 * promessa - inclusive depois de falhar.
 *
 * @returns {Promise<boolean>} true se ha classes para filtrar
 */
export function carregarClassesDosItens() {
	if (_carga) {
		return _carga;
	}

	// `Promise.resolve().then` e de proposito: onde nao ha `fetch` (teste em jsdom, navegador
	// velho) o erro cai no `catch` abaixo em vez de derrubar quem abriu a janela.
	_carga = Promise.resolve()
		.then(() => fetch(CAMINHO))
		.then(resposta => {
			if (!resposta.ok) {
				throw new Error(`HTTP ${resposta.status}`);
			}
			return resposta.json();
		})
		.then(dados => absorverClassesDosItens(dados) > 0)
		.catch(erro => {
			console.warn(`[classesDosItens] ${CAMINHO} nao carregou (${erro.message}); Mapa de Caca sem filtro por classe`);
			return false;
		});

	return _carga;
}

/**
 * As classes do seletor, na ordem do arquivo (a ordem de id do servidor).
 *
 * @returns {Array<{indice: number, id: string, nome: string}>}
 */
export function classesParaOFiltro() {
	return _classes.map((c, indice) => ({ indice, id: c.id, nome: c.nome }));
}

/**
 * A classe de indice `indice` usa o equipamento `itemId`?
 *
 * @param {number} indice - o indice em `classesParaOFiltro()`
 * @param {number} itemId
 * @returns {boolean|null} `null` quando o item nao e equipamento do recorte
 */
export function classeUsaItem(indice, itemId) {
	const conjunto = _itens.get(itemId);
	if (conjunto === undefined) {
		return null;
	}
	const usam = _conjuntos[conjunto];
	return usam ? usam.has(indice) : null;
}
