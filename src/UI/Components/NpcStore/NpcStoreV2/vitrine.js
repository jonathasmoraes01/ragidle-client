/**
 * UI/Components/NpcStore/NpcStoreV2/vitrine.js
 *
 * AS REGRAS DA VITRINE, sem DOM: em que categoria cada item cai e em que
 * ordem a lista sai (D-920, 02/09/2026 — pedido do dono: *"separar por
 * categoria os itens na loja"* e *"organizar por quantidade ou raridade na
 * hora de vender"*).
 *
 * Mora fora do componente pelo mesmo motivo de `secoesDaConfig.js` e
 * `memoriaDeAba.js`: e decisao, nao desenho. Aqui ela e testavel sem montar
 * Shadow DOM, e o teste que a prova (`tests/ui/vitrineDaLoja.test.js`) le como
 * a especificacao que e.
 *
 * ## A categoria e a MESMA da mochila
 *
 * `getItemTab` (InventoryCommon.js, copiada em MochilaIdle.js) divide o
 * inventario em tres abas: Consumiveis / Equipar / Diversos. A loja precisa de
 * mais recorte que isso — um Armeiro com 40 linhas nao fica melhor com todas
 * elas em "Equipar" — entao arma vira uma aba, armadura vira outra, e carta e
 * municao saem de "Diversos", onde ninguem as acha. **O agrupamento de base e
 * o mesmo** (nenhum tipo muda de familia); o que muda e a granularidade.
 *
 * Categoria SEM item nao vira aba: a loja de pocao abre com duas abas, nao com
 * sete, seis delas vazias.
 */

import ItemType from 'DB/Items/ItemType.js';

/**
 * As categorias, na ordem em que aparecem. A ordem e a do uso: o que se
 * compra toda hora primeiro, o que quase nunca se compra por ultimo.
 *
 * `CASH` (18) entra em Consumiveis porque no recorte deste jogo ele e item de
 * uso; `SHADOWGEAR` acompanha armadura; `UNKNOWN` cai em Diversos junto com
 * `ETC` — e a rede de seguranca do tipo que ninguem previu.
 */
export const CATEGORIAS = [
	{
		id: 'consumo',
		rotulo: 'Consumíveis',
		tipos: [ItemType.HEALING, ItemType.USABLE, ItemType.DELAYCONSUME, ItemType.CASH]
	},
	{ id: 'armas', rotulo: 'Armas', tipos: [ItemType.WEAPON] },
	{ id: 'armaduras', rotulo: 'Armaduras', tipos: [ItemType.ARMOR, ItemType.SHADOWGEAR] },
	{ id: 'municao', rotulo: 'Munição', tipos: [ItemType.AMMO] },
	{ id: 'cartas', rotulo: 'Cartas', tipos: [ItemType.CARD] },
	{ id: 'pets', rotulo: 'Pets', tipos: [ItemType.PETEGG, ItemType.PETARMOR] },
	{ id: 'diversos', rotulo: 'Diversos', tipos: [ItemType.ETC, ItemType.UNKNOWN] }
];

/** A aba que mostra tudo — sempre a primeira, e sempre a que abre. */
export const CATEGORIA_TUDO = 'tudo';

const _porTipo = new Map();
for (const categoria of CATEGORIAS) {
	for (const tipo of categoria.tipos) {
		_porTipo.set(tipo, categoria.id);
	}
}

/**
 * @param {number|null|undefined} tipo - o `enum item_types` do item
 * @returns {string} o id da categoria; 'diversos' para tipo ausente ou novo
 */
export function categoriaDoTipo(tipo) {
	return _porTipo.get(tipo) || 'diversos';
}

/**
 * O tipo que vale para este item: o do PACOTE quando o servidor mandou um, e o
 * da tabela publicada quando nao (a loja de pontos e uma que nao manda).
 *
 * A escolha e por AUSENCIA, e nao por `||`, e isso e o defeito inteiro que
 * esta funcao existe para nao ter: `HEALING` vale **0** no `enum item_types`,
 * entao `pacote || tabela` mandaria toda pocao para a categoria da tabela — e,
 * quando a tabela tambem nao soubesse, para "Diversos". Uma loja de pocao
 * inteira na aba errada, sem erro nenhum no console.
 *
 * @param {number|null|undefined} doPacote
 * @param {number|null|undefined} daTabela
 * @returns {number|null}
 */
export function tipoEfetivo(doPacote, daTabela) {
	if (doPacote != null) {
		return doPacote;
	}
	return daTabela == null ? null : daTabela;
}

/**
 * @param {string} id
 * @returns {string} o rotulo em pt-BR ('Diversos' para id desconhecido)
 */
export function rotuloDaCategoria(id) {
	const categoria = CATEGORIAS.find(c => c.id === id);
	return categoria ? categoria.rotulo : 'Diversos';
}

/**
 * As abas que esta vitrine merece: 'tudo' na frente e so as categorias com
 * pelo menos um item, na ordem de `CATEGORIAS`.
 *
 * Uma vitrine de UMA categoria so nao ganha aba nenhuma — a barra seria
 * "Tudo | Consumíveis" com as duas mostrando a mesma lista, que e ruido puro.
 *
 * @param {ReadonlyArray<{categoria: string}>} itens
 * @returns {Array<{id: string, rotulo: string, quantidade: number}>}
 */
export function abasDaVitrine(itens) {
	const contagem = new Map();
	for (const item of itens) {
		contagem.set(item.categoria, (contagem.get(item.categoria) || 0) + 1);
	}

	const presentes = CATEGORIAS.filter(c => contagem.has(c.id)).map(c => ({
		id: c.id,
		rotulo: c.rotulo,
		quantidade: contagem.get(c.id)
	}));

	if (presentes.length < 2) {
		return [];
	}

	return [{ id: CATEGORIA_TUDO, rotulo: 'Tudo', quantidade: itens.length }, ...presentes];
}

/**
 * As ordens oferecidas. `padrao` e a ordem em que o servidor mandou — a da
 * linha `shop` do NPC, que costuma ser deliberada — e continua sendo a que
 * abre.
 *
 * `quantidade` e `raridade` sao o pedido do dono para a hora de VENDER;
 * `preco` e `nome` vieram junto porque custam uma linha cada e a lista de
 * compra as pede pelo mesmo motivo.
 */
export const ORDENS = [
	{ id: 'padrao', rotulo: 'Ordem da loja' },
	{ id: 'raridade', rotulo: 'Raridade' },
	{ id: 'quantidade', rotulo: 'Quantidade' },
	{ id: 'preco', rotulo: 'Preço' },
	{ id: 'nome', rotulo: 'Nome (A–Z)' }
];

export const ORDEM_PADRAO = 'padrao';

/**
 * Quantidade e um criterio VAZIO numa vitrine de estoque infinito: a loja de
 * NPC comum nao tem contagem, e oferecer a opcao daria uma lista identica a
 * anterior — o pior tipo de controle, o que parece nao fazer nada.
 *
 * @param {ReadonlyArray<{quantidade: number}>} itens
 * @returns {boolean}
 */
export function temQuantidadeReal(itens) {
	return itens.some(item => isFinite(item.quantidade));
}

/**
 * As ordens que fazem sentido para ESTA vitrine.
 *
 * @param {ReadonlyArray<{quantidade: number}>} itens
 * @param {boolean} temPreco - falso no escambo, onde o custo e em itens
 * @returns {Array<{id: string, rotulo: string}>}
 */
export function ordensDaVitrine(itens, temPreco) {
	const comQuantidade = temQuantidadeReal(itens);
	return ORDENS.filter(o => {
		if (o.id === 'quantidade') {
			return comQuantidade;
		}
		if (o.id === 'preco') {
			return temPreco;
		}
		return true;
	});
}

/**
 * Compara pelo nome, em pt-BR (acento nao joga o item para o fim da lista).
 */
function porNome(a, b) {
	return String(a.nome).localeCompare(String(b.nome), 'pt-BR');
}

/**
 * Ordena uma lista de itens da vitrine.
 *
 * Os tres criterios numericos sao DECRESCENTES (o mais raro, o mais numeroso
 * e o mais caro primeiro) porque em todos os tres o que o jogador procura e o
 * extremo de cima: o que ele nao pode vender por engano, a pilha que enche a
 * mochila, a peca que paga a conta.
 *
 * O desempate e sempre o mesmo par — nome, e depois a posicao original. Sem
 * ele, `Array.prototype.sort` deixaria dois itens de mesma raridade trocarem
 * de lugar a cada redesenho, e a lista "piscaria" sozinha.
 *
 * @param {ReadonlyArray<object>} itens - {ordem, nome, preco, quantidade, raridade}
 * @param {string} ordem - o id de `ORDENS`
 * @returns {Array<object>} uma copia ordenada (a entrada nao e tocada)
 */
export function ordenarVitrine(itens, ordem) {
	const copia = [...itens];

	const desempate = (a, b) => porNome(a, b) || a.ordem - b.ordem;

	switch (ordem) {
		case 'raridade':
			return copia.sort((a, b) => b.raridade - a.raridade || desempate(a, b));

		case 'quantidade':
			// Estoque infinito nao pode encabecar a lista de "quantidade": ele
			// e a AUSENCIA de contagem, e nao a maior de todas. Vai para o fim,
			// entre os seus, na ordem de sempre.
			return copia.sort((a, b) => {
				const ia = isFinite(a.quantidade);
				const ib = isFinite(b.quantidade);
				if (ia !== ib) {
					return ia ? -1 : 1;
				}
				if (!ia) {
					return desempate(a, b);
				}
				return b.quantidade - a.quantidade || desempate(a, b);
			});

		case 'preco':
			return copia.sort((a, b) => b.preco - a.preco || desempate(a, b));

		case 'nome':
			return copia.sort((a, b) => porNome(a, b) || a.ordem - b.ordem);

		default:
			return copia.sort((a, b) => a.ordem - b.ordem);
	}
}

/**
 * A vista completa: filtra pela busca e pela aba, agrupa por categoria quando
 * a aba e "Tudo", e ordena DENTRO de cada grupo.
 *
 * Agrupar so na aba "Tudo" e o que faz as duas coisas que o dono pediu
 * conviverem: a divisao por categoria continua visivel quando ele nao escolheu
 * nenhuma, e some quando ele escolheu — repetir "Cartas" acima de uma lista
 * que ja e so de cartas nao informa nada.
 *
 * @param {ReadonlyArray<object>} itens
 * @param {{termo?: string, categoria?: string, ordem?: string}} vista
 * @returns {Array<{categoria: string, rotulo: string, itens: Array<object>}>}
 */
export function montarVista(itens, vista) {
	const termo = (vista.termo || '').trim().toLocaleLowerCase('pt-BR');
	const categoria = vista.categoria || CATEGORIA_TUDO;
	const ordem = vista.ordem || ORDEM_PADRAO;

	const passa = item =>
		(categoria === CATEGORIA_TUDO || item.categoria === categoria) &&
		(!termo || String(item.nome).toLocaleLowerCase('pt-BR').includes(termo));

	const visiveis = itens.filter(passa);

	if (categoria !== CATEGORIA_TUDO) {
		return visiveis.length
			? [{ categoria, rotulo: rotuloDaCategoria(categoria), itens: ordenarVitrine(visiveis, ordem) }]
			: [];
	}

	return CATEGORIAS.map(c => ({
		categoria: c.id,
		rotulo: c.rotulo,
		itens: ordenarVitrine(
			visiveis.filter(i => i.categoria === c.id),
			ordem
		)
	})).filter(grupo => grupo.itens.length > 0);
}

/**
 * Os indices que a vista mostra, achatados na ordem em que aparecem.
 *
 * E o alcance do "Tudo no maximo" (D-922), e por isso ele sai DAQUI e nao de
 * uma varredura de `_input`: o pedido do dono foi *"caso esteja selecionado
 * uma categoria, deverá selecionar apenas os itens daquela categoria"*, e a
 * unica definicao de "aquela categoria" que nao pode divergir da tela e a
 * propria vista que a desenhou. A busca entra pelo mesmo argumento — botao que
 * mexe no que o jogador NAO esta vendo e a pior forma de acao em massa.
 *
 * @param {ReadonlyArray<{itens: ReadonlyArray<{index: number}>}>} grupos
 * @returns {Array<number>}
 */
export function indicesDaVista(grupos) {
	return grupos.flatMap(grupo => grupo.itens.map(item => item.index));
}
