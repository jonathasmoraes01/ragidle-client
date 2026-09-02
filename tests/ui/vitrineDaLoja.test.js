/**
 * As regras da vitrine da loja, sem DOM (D-920, 02/09/2026): em que categoria
 * cada item cai, que abas a janela merece, que ordens fazem diferenca e como
 * a lista sai ordenada.
 *
 * O pedido do dono era de tres partes — "organizar por quantidade ou raridade
 * na hora de vender" e "separar por categoria os itens na loja". As armadilhas
 * que estes casos guardam sao as tres que custariam uma rodada de jogo cada:
 *
 * 1. **`type` 0 e falsy.** `HEALING` vale 0 no `enum item_types`, e um
 *    `item.type || tabela` mandaria TODA pocao para "Diversos" em silencio —
 *    a categoria errada nao acusa, so parece desorganizacao.
 * 2. **Estoque infinito nao e a maior quantidade.** Ordenar por quantidade com
 *    `Infinity` no topo poria a loja de NPC inteira antes da pilha de 400
 *    Jellopy, que e exatamente o que o jogador procurava.
 * 3. **Ordenacao instavel pisca.** Sem desempate, dois itens de mesma raridade
 *    trocam de lugar a cada tecla digitada na busca.
 */

import { describe, expect, it } from 'vitest';
import ItemType from '../../src/DB/Items/ItemType.js';
import {
	CATEGORIAS,
	CATEGORIA_TUDO,
	ORDEM_PADRAO,
	abasDaVitrine,
	categoriaDoTipo,
	indicesDaVista,
	montarVista,
	ordenarVitrine,
	ordensDaVitrine,
	rotuloDaCategoria,
	temQuantidadeReal,
	tipoEfetivo
} from '../../src/UI/Components/NpcStore/NpcStoreV2/vitrine.js';

/** Um item da vitrine com os campos que `vitrine.js` le. */
function item(parcial) {
	return {
		ordem: 0,
		index: 0,
		nome: 'Item',
		preco: 100,
		quantidade: Infinity,
		raridade: 0,
		categoria: 'diversos',
		...parcial
	};
}

describe('a categoria de cada tipo', () => {
	it('a POCAO cai em Consumíveis — e o tipo dela e ZERO', () => {
		// A armadilha 1 do cabecalho, no caso que a dispara.
		expect(ItemType.HEALING).toBe(0);
		expect(categoriaDoTipo(ItemType.HEALING)).toBe('consumo');
		expect(categoriaDoTipo(ItemType.USABLE)).toBe('consumo');
		expect(categoriaDoTipo(ItemType.DELAYCONSUME)).toBe('consumo');
		expect(categoriaDoTipo(ItemType.CASH)).toBe('consumo');
	});

	it('equipamento se divide em Armas e Armaduras, e nao numa aba so', () => {
		expect(categoriaDoTipo(ItemType.WEAPON)).toBe('armas');
		expect(categoriaDoTipo(ItemType.ARMOR)).toBe('armaduras');
		expect(categoriaDoTipo(ItemType.SHADOWGEAR)).toBe('armaduras');
	});

	it('carta e municao SAEM de Diversos — e onde ninguem as achava', () => {
		expect(categoriaDoTipo(ItemType.CARD)).toBe('cartas');
		expect(categoriaDoTipo(ItemType.AMMO)).toBe('municao');
	});

	it('tipo ausente ou novo cai em Diversos, e nao quebra', () => {
		expect(categoriaDoTipo(null)).toBe('diversos');
		expect(categoriaDoTipo(undefined)).toBe('diversos');
		expect(categoriaDoTipo(99)).toBe('diversos');
		expect(rotuloDaCategoria('diversos')).toBe('Diversos');
		expect(rotuloDaCategoria('nao-existe')).toBe('Diversos');
	});

	it('o tipo 0 do PACOTE vence a tabela — a queda e por ausencia, nao por `||`', () => {
		// A armadilha 1 na fronteira em que ela realmente aparecia: um
		// `pacote || tabela` devolveria a tabela aqui, e a pocao da loja de
		// pontos (que nao manda tipo) iria para a categoria errada.
		expect(tipoEfetivo(ItemType.HEALING, ItemType.CARD)).toBe(ItemType.HEALING);
		expect(categoriaDoTipo(tipoEfetivo(ItemType.HEALING, ItemType.CARD))).toBe('consumo');
	});

	it('sem tipo no pacote, vale o da tabela publicada', () => {
		expect(tipoEfetivo(undefined, ItemType.CARD)).toBe(ItemType.CARD);
		expect(tipoEfetivo(null, ItemType.HEALING)).toBe(ItemType.HEALING);
	});

	it('sem tipo em lugar nenhum, cai em Diversos', () => {
		expect(tipoEfetivo(null, null)).toBe(null);
		expect(categoriaDoTipo(tipoEfetivo(null, null))).toBe('diversos');
	});

	it('todo tipo do enum tem casa — nenhum cai em Diversos por esquecimento', () => {
		const cobertos = new Set(CATEGORIAS.flatMap(c => c.tipos));
		const semCasa = Object.entries(ItemType)
			.filter(([nome]) => nome !== 'SEARCH') // filtro do armazem, nao e item
			.filter(([, valor]) => !cobertos.has(valor))
			.map(([nome]) => nome);
		expect(semCasa).toEqual([]);
	});
});

describe('as abas que a vitrine merece', () => {
	it('categoria vazia NAO vira aba', () => {
		const abas = abasDaVitrine([
			item({ categoria: 'consumo' }),
			item({ categoria: 'consumo' }),
			item({ categoria: 'cartas' })
		]);
		expect(abas.map(a => a.id)).toEqual([CATEGORIA_TUDO, 'consumo', 'cartas']);
		expect(abas.map(a => a.quantidade)).toEqual([3, 2, 1]);
	});

	it('vitrine de UMA categoria nao ganha barra nenhuma', () => {
		// "Tudo | Consumíveis" com as duas mostrando a mesma lista e so ruido.
		expect(abasDaVitrine([item({ categoria: 'consumo' })])).toEqual([]);
		expect(abasDaVitrine([])).toEqual([]);
	});

	it('as abas saem na ordem de CATEGORIAS, e nao na de chegada', () => {
		const abas = abasDaVitrine([
			item({ categoria: 'diversos' }),
			item({ categoria: 'armas' }),
			item({ categoria: 'consumo' })
		]);
		expect(abas.map(a => a.id)).toEqual([CATEGORIA_TUDO, 'consumo', 'armas', 'diversos']);
	});
});

describe('as ordens oferecidas', () => {
	it('estoque infinito nao oferece "Quantidade" — ela nao mudaria nada', () => {
		const infinita = [item({ quantidade: Infinity }), item({ quantidade: Infinity })];
		expect(temQuantidadeReal(infinita)).toBe(false);
		expect(ordensDaVitrine(infinita, true).map(o => o.id)).not.toContain('quantidade');
	});

	it('a lista de VENDA (tudo com contagem) oferece', () => {
		const doInventario = [item({ quantidade: 400 }), item({ quantidade: 3 })];
		expect(temQuantidadeReal(doInventario)).toBe(true);
		expect(ordensDaVitrine(doInventario, true).map(o => o.id)).toContain('quantidade');
	});

	it('o escambo nao oferece "Preço" — o custo dele e em item', () => {
		expect(ordensDaVitrine([item({})], false).map(o => o.id)).not.toContain('preco');
	});

	it('raridade e nome estao sempre la, e a padrao e a ordem da loja', () => {
		const ids = ordensDaVitrine([item({})], true).map(o => o.id);
		expect(ids).toContain('raridade');
		expect(ids).toContain('nome');
		expect(ids[0]).toBe(ORDEM_PADRAO);
	});
});

describe('a ordenacao', () => {
	const carta = item({ ordem: 0, nome: 'Carta do Poring', raridade: 2, quantidade: 1, preco: 5000 });
	const pocao = item({ ordem: 1, nome: 'Poção Vermelha', raridade: 0, quantidade: 400, preco: 25 });
	const asa = item({ ordem: 2, nome: 'Asa de Mosca', raridade: 0, quantidade: 12, preco: 30 });
	const anel = item({ ordem: 3, nome: 'Anel', raridade: 3, quantidade: 1, preco: 90000 });
	const lista = [carta, pocao, asa, anel];

	it('raridade poe o LENDARIO na frente e desempata pelo nome', () => {
		expect(ordenarVitrine(lista, 'raridade').map(i => i.nome)).toEqual([
			'Anel', // 3
			'Carta do Poring', // 2
			'Asa de Mosca', // 0, e "A" vem antes de "P"
			'Poção Vermelha'
		]);
	});

	it('quantidade poe a maior pilha na frente', () => {
		expect(ordenarVitrine(lista, 'quantidade').map(i => i.quantidade)).toEqual([400, 12, 1, 1]);
	});

	it('estoque INFINITO vai para o fim, e nao para o topo', () => {
		// A armadilha 2 do cabecalho: `Infinity` e a ausencia de contagem.
		const comInfinito = [
			item({ ordem: 0, nome: 'Da loja', quantidade: Infinity }),
			item({ ordem: 1, nome: 'Meu', quantidade: 7 })
		];
		expect(ordenarVitrine(comInfinito, 'quantidade').map(i => i.nome)).toEqual(['Meu', 'Da loja']);
	});

	it('preco poe o mais caro na frente', () => {
		expect(ordenarVitrine(lista, 'preco').map(i => i.preco)).toEqual([90000, 5000, 30, 25]);
	});

	it('nome ordena em pt-BR: o acento nao joga o item para o fim', () => {
		const comAcento = [
			item({ ordem: 0, nome: 'Zargon' }),
			item({ ordem: 1, nome: 'Água Benta' }),
			item({ ordem: 2, nome: 'Adaga' })
		];
		expect(ordenarVitrine(comAcento, 'nome').map(i => i.nome)).toEqual(['Adaga', 'Água Benta', 'Zargon']);
	});

	it('a ordem padrao devolve a ordem em que o servidor mandou', () => {
		const embaralhada = [anel, carta, asa, pocao];
		expect(ordenarVitrine(embaralhada, ORDEM_PADRAO).map(i => i.ordem)).toEqual([0, 1, 2, 3]);
	});

	it('e ESTAVEL: reordenar duas vezes da o mesmo resultado', () => {
		// A armadilha 3 do cabecalho — a lista que "pisca" a cada tecla.
		const empatados = [
			item({ ordem: 0, nome: 'Igual', raridade: 1 }),
			item({ ordem: 1, nome: 'Igual', raridade: 1 }),
			item({ ordem: 2, nome: 'Igual', raridade: 1 })
		];
		const uma = ordenarVitrine(empatados, 'raridade').map(i => i.ordem);
		const outra = ordenarVitrine([...empatados].reverse(), 'raridade').map(i => i.ordem);
		expect(uma).toEqual([0, 1, 2]);
		expect(outra).toEqual([0, 1, 2]);
	});

	it('nao mexe na lista de entrada', () => {
		const original = [anel, carta];
		ordenarVitrine(original, 'nome');
		expect(original).toEqual([anel, carta]);
	});
});

describe('a vista completa', () => {
	const vitrine = [
		item({ ordem: 0, index: 0, nome: 'Poção Vermelha', categoria: 'consumo', raridade: 0 }),
		item({ ordem: 1, index: 1, nome: 'Poção Laranja', categoria: 'consumo', raridade: 1 }),
		item({ ordem: 2, index: 2, nome: 'Adaga', categoria: 'armas', raridade: 0 }),
		item({ ordem: 3, index: 3, nome: 'Carta do Poring', categoria: 'cartas', raridade: 2 })
	];

	it('na aba "Tudo" a lista sai DIVIDIDA, na ordem das categorias', () => {
		const grupos = montarVista(vitrine, { categoria: CATEGORIA_TUDO, ordem: ORDEM_PADRAO });
		expect(grupos.map(g => g.categoria)).toEqual(['consumo', 'armas', 'cartas']);
		expect(grupos.map(g => g.rotulo)).toEqual(['Consumíveis', 'Armas', 'Cartas']);
		expect(grupos[0].itens.map(i => i.nome)).toEqual(['Poção Vermelha', 'Poção Laranja']);
	});

	it('a ordem escolhida vale DENTRO de cada grupo', () => {
		const grupos = montarVista(vitrine, { categoria: CATEGORIA_TUDO, ordem: 'raridade' });
		expect(grupos[0].itens.map(i => i.nome)).toEqual(['Poção Laranja', 'Poção Vermelha']);
		// A divisao continua de pe: raridade nao mistura carta com poção.
		expect(grupos.map(g => g.categoria)).toEqual(['consumo', 'armas', 'cartas']);
	});

	it('aba escolhida = um grupo so, com o resto fora', () => {
		const grupos = montarVista(vitrine, { categoria: 'consumo', ordem: ORDEM_PADRAO });
		expect(grupos).toHaveLength(1);
		expect(grupos[0].itens.map(i => i.index)).toEqual([0, 1]);
	});

	it('a busca atravessa a divisao, e ignora caixa e acento do termo', () => {
		const grupos = montarVista(vitrine, { categoria: CATEGORIA_TUDO, termo: 'POÇÃO' });
		expect(grupos).toHaveLength(1);
		expect(grupos[0].itens).toHaveLength(2);
	});

	it('busca sem resultado devolve NENHUM grupo — a janela mostra o vazio', () => {
		expect(montarVista(vitrine, { categoria: CATEGORIA_TUDO, termo: 'zzz' })).toEqual([]);
		expect(montarVista(vitrine, { categoria: 'cartas', termo: 'adaga' })).toEqual([]);
	});

	it('grupo vazio nao vira secao vazia na tela', () => {
		const grupos = montarVista(vitrine, { categoria: CATEGORIA_TUDO, termo: 'adaga' });
		expect(grupos.map(g => g.categoria)).toEqual(['armas']);
	});
});

describe('o alcance do "Tudo no máximo"', () => {
	const vitrine = [
		item({ ordem: 0, index: 10, nome: 'Poção Vermelha', categoria: 'consumo' }),
		item({ ordem: 1, index: 11, nome: 'Poção Laranja', categoria: 'consumo' }),
		item({ ordem: 2, index: 12, nome: 'Adaga', categoria: 'armas' }),
		item({ ordem: 3, index: 13, nome: 'Carta do Poring', categoria: 'cartas' })
	];

	it('na aba "Tudo" ele alcanca a vitrine inteira', () => {
		const grupos = montarVista(vitrine, { categoria: CATEGORIA_TUDO, ordem: ORDEM_PADRAO });
		expect(indicesDaVista(grupos).sort()).toEqual([10, 11, 12, 13]);
	});

	it('com uma CATEGORIA escolhida, ele alcanca SO os itens dela', () => {
		// O pedido do dono, literal: "caso esteja selecionado uma categoria,
		// deverá selecionar apenas os itens daquela categoria".
		const grupos = montarVista(vitrine, { categoria: 'consumo', ordem: ORDEM_PADRAO });
		expect(indicesDaVista(grupos)).toEqual([10, 11]);
	});

	it('a BUSCA tambem encolhe o alcance — ele age no que esta a vista', () => {
		const grupos = montarVista(vitrine, { categoria: CATEGORIA_TUDO, termo: 'carta' });
		expect(indicesDaVista(grupos)).toEqual([13]);
	});

	it('vista vazia nao alcanca nada (o botao trava)', () => {
		expect(indicesDaVista(montarVista(vitrine, { categoria: CATEGORIA_TUDO, termo: 'zzz' }))).toEqual([]);
	});

	it('sai na ORDEM DA TELA, e nao na do catalogo', () => {
		// Ele nao depende disso para funcionar, mas depende para o "ja esta
		// tudo cheio?" do botao nao variar com a ordenacao escolhida.
		const grupos = montarVista(vitrine, { categoria: 'consumo', ordem: 'nome' });
		expect(indicesDaVista(grupos)).toEqual([11, 10]);
	});
});
