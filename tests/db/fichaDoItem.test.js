/**
 * O ITEM "undefined" DOS CAMPOS DE PRONTERA (o dono, jogando, 25/08/2026).
 *
 * Um drop sem nome, sem imagem e sem descricao. O culpado tem nome e id: o
 * **4545 (Novice Poring Card)**, que o Little Poring solta a 1% em
 * `prt_fild08`. Cruzando os drops dos 112 monstros do jogo contra
 * `data/idnum2itemdisplaynametable.txt` do GRF, 22 ids nao tem nome no
 * cliente — e o 4545 e o UNICO deles que tambem esta no `ItemTable.js` como
 * estube (`4545: { ClassNum: 0 }`).
 *
 * E essa coincidencia e a causa inteira. `getItemInfo` fazia
 * `ItemTable[itemid] || unknownItem`: o estube e truthy, o `||` nao dispara, e
 * a ficha volta sem `identifiedDisplayName`. Os outros 21, que nao estao no
 * `ItemTable.js` de jeito nenhum, sempre apareceram certinhos como "Unknown
 * Item" — o estube e PIOR que a ausencia, e e por isso que o defeito parecia
 * aleatorio.
 */

import { describe, expect, it } from 'vitest';
import { completarFicha, unknownItem } from 'DB/Items/FichaDoItem.js';

describe('completarFicha', () => {
	it('o caso do dono: o estube de ClassNum vira nome legivel COM o id', () => {
		// O id no nome nao e enfeite: "Unknown Item" nao permite reportar nada,
		// e foi preciso cruzar duas tabelas para descobrir que era o 4545.
		const ficha = completarFicha(4545, { ClassNum: 0 });
		expect(ficha.identifiedDisplayName).toBe('Item desconhecido (4545)');
		expect(ficha.unidentifiedDisplayName).toBe('Item desconhecido (4545)');
	});

	it('o estube ganha ICONE e DESCRICAO, e nao so o nome', () => {
		// Sem isto o caminho do sprite vira `.../undefined.bmp` e a caixa de
		// descricao fica vazia — os outros dois tercos da queixa do dono.
		const ficha = completarFicha(4545, { ClassNum: 0 });
		expect(ficha.identifiedResourceName).toBe(unknownItem.identifiedResourceName);
		expect(ficha.identifiedDescriptionName).toBe('...');
		expect(ficha.slotCount).toBe(0);
	});

	it('a descricao remendada e STRING, e nao array', () => {
		// `getItemInfo` junta as linhas ANTES de chamar esta funcao. Devolver
		// `['...']` aqui poria um array cru na caixa de descricao.
		expect(Array.isArray(completarFicha(4545, {}).identifiedDescriptionName)).toBe(false);
	});

	it('ficha completa volta COMO VEIO — sem copia, e sem tocar em nada', () => {
		// O caminho quente e 99,9% das chamadas. A identidade e o que este caso
		// mede: uma copia por chamada seria lixo em cada quadro do inventario.
		const boa = {
			identifiedDisplayName: 'Red Potion',
			unidentifiedDisplayName: 'Red Potion',
			identifiedResourceName: '\xbb\xe7\xb0\xfa',
			slotCount: 0
		};
		expect(completarFicha(501, boa)).toBe(boa);
	});

	it('o que ja existe NAO e sobrescrito pelo remendo', () => {
		// Meia ficha e o caso real de uma tabela do GRF que carregou e outra
		// que nao: o que chegou tem de sobreviver.
		const meia = { identifiedDisplayName: 'Novice Poring Card', slotCount: 3 };
		const ficha = completarFicha(4545, meia);
		expect(ficha.identifiedDisplayName).toBe('Novice Poring Card');
		expect(ficha.slotCount).toBe(3);
		// e o lado que faltava ganha o remendo
		expect(ficha.unidentifiedDisplayName).toBe('Item desconhecido (4545)');
	});

	it('os campos que o remendo nao nomeia sobrevivem inteiros', () => {
		// O remendo tapa buraco, nao substitui a ficha. `ClassNum` decide o
		// sprite da arma e `prefixName`/`isPostfix` montam o nome com carta —
		// nenhum dos tres esta na lista de campos remendados, e perder qualquer
		// um deles nao produziria erro nenhum, so um boneco com a arma errada.
		const estube = { ClassNum: 5, prefixName: 'Very Strong', isPostfix: true, _decoded: true };
		const ficha = completarFicha(1202, estube);
		expect(ficha.ClassNum).toBe(5);
		expect(ficha.prefixName).toBe('Very Strong');
		expect(ficha.isPostfix).toBe(true);
		expect(ficha._decoded).toBe(true);
	});

	it('ficha ausente cai no unknownItem de sempre — os 21 ids fora do ItemTable', () => {
		expect(completarFicha(25729, undefined)).toBe(unknownItem);
		expect(completarFicha(25729, null)).toBe(unknownItem);
	});

	it('o remendo NAO e gravado de volta na ficha de origem', () => {
		// As tabelas do GRF carregam DEPOIS, de forma assincrona. Carimbar
		// "Item desconhecido" no `ItemTable` deixaria o nome de verdade sem
		// onde chegar — e o item ficaria com o nome de emergencia para sempre.
		const estube = { ClassNum: 0 };
		completarFicha(4545, estube);
		expect(estube.identifiedDisplayName).toBeUndefined();
	});
});
