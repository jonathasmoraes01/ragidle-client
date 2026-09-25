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
import { comDescricaoLocal, completarFicha, unknownItem } from 'DB/Items/FichaDoItem.js';
import { DESCRICOES_LOCAIS } from 'DB/Items/nomesLocais.js';

describe('completarFicha', () => {
	it('o estube SEM nome local vira nome legivel COM o id', () => {
		/*
		 * ESTE CASO USAVA O 4545 e mudou de cobaia no MESMO DIA: o dono
		 * decidiu ("pode abrir frente para nomea-los") e o 4545 agora tem
		 * nome de verdade pela tabela local (ver nomesLocais.test.js). O
		 * comportamento que ele guarda — id no nome, porque "Unknown Item"
		 * nao permite reportar nada — continua valendo para todo id FORA da
		 * tabela, entao a cobaia virou um id que nao esta nela.
		 */
		const ficha = completarFicha(999123, { ClassNum: 0 });
		expect(ficha.identifiedDisplayName).toBe('Item desconhecido (999123)');
		expect(ficha.unidentifiedDisplayName).toBe('Item desconhecido (999123)');
	});

	it('o estube ganha ICONE e DESCRICAO, e nao so o nome', () => {
		/*
		 * A cobaia era o 4545, depois o 28382 (31/08/2026); os dois sairam do
		 * jogo com a virada para pre-renewal (22/09/2026). Hoje e o 12849
		 * (Combination Kit): estube no ItemTable.js, nome local e NENHUM icone
		 * local — o mesmo papel que o 28382 fazia.
		 */
		// Sem isto o caminho do sprite vira `.../undefined.bmp` e a caixa de
		// descricao fica vazia — os outros dois tercos da queixa do dono.
		const ficha = completarFicha(12849, { ClassNum: 0 });
		expect(ficha.identifiedResourceName).toBe(unknownItem.identifiedResourceName);
		expect(ficha.identifiedDescriptionName).toBe('...');
		expect(ficha.slotCount).toBe(0);
	});

	it('a descricao remendada e STRING, e nao array', () => {
		// `getItemInfo` junta as linhas ANTES de chamar esta funcao. Devolver
		// `['...']` aqui poria um array cru na caixa de descricao.
		expect(Array.isArray(completarFicha(12849, {}).identifiedDescriptionName)).toBe(false);
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
		const meia = { identifiedDisplayName: 'Nome Que O GRF Trouxe', slotCount: 3 };
		const ficha = completarFicha(12849, meia);
		expect(ficha.identifiedDisplayName).toBe('Nome Que O GRF Trouxe');
		expect(ficha.slotCount).toBe(3);
		// e o lado que faltava ganha o remendo — que para o 12849 e o nome
		// LOCAL, nao o generico com id.
		expect(ficha.unidentifiedDisplayName).toBe('Combination Kit');
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

	it('ficha ausente cai no unknownItem de sempre — quando o id NAO tem nome local', () => {
		/*
		 * A cobaia era o 25729 (Shadowdecon) e mudou junto com a frente dos
		 * 22: agora ele sai BATIZADO pelo caminho !ficha (nomesLocais.test.js
		 * cobre). A identidade `toBe(unknownItem)` — sem copia — continua
		 * valendo para id sem nome local, que e o caso de todo item futuro.
		 */
		expect(completarFicha(999123, undefined)).toBe(unknownItem);
		expect(completarFicha(999123, null)).toBe(unknownItem);
	});

	it('o remendo NAO e gravado de volta na ficha de origem', () => {
		// As tabelas do GRF carregam DEPOIS, de forma assincrona. Carimbar
		// "Item desconhecido" no `ItemTable` deixaria o nome de verdade sem
		// onde chegar — e o item ficaria com o nome de emergencia para sempre.
		const estube = { ClassNum: 0 };
		completarFicha(12849, estube);
		expect(estube.identifiedDisplayName).toBeUndefined();
	});
});

/*
 * A FRASE DO ITEM NOSSO (25/09/2026): o servidor de assets descreve todo item
 * do pacote so com DADOS (Tipo/Peso/Nivel), e essa descricao escondia a frase
 * de `DESCRICOES_LOCAIS`. Agora a frase vai em cima e os dados embaixo.
 */
describe('a descricao local de um item nosso', () => {
	const DADOS = 'Tipo: ^777777Diverso^000000\nPeso: ^7777770^000000';

	it('a Barra de Midgard ganha a frase em cima dos dados do servidor', () => {
		const texto = comDescricaoLocal(9003002, DADOS);
		expect(texto.startsWith(DESCRICOES_LOCAIS[9003002])).toBe(true);
		expect(texto.endsWith(DADOS)).toBe(true);
	});

	it('as tres recompensas da Praca tem frase propria, sem porcentagem de drop', () => {
		for (const id of [9003000, 9003001, 9003002]) {
			expect(DESCRICOES_LOCAIS[id]).toBeTruthy();
			expect(DESCRICOES_LOCAIS[id]).not.toMatch(/%/);
			expect(DESCRICOES_LOCAIS[id]).toContain('NPC');
		}
	});

	it('e idempotente: rodar de novo nao repete a frase', () => {
		const uma = comDescricaoLocal(9003000, DADOS);
		expect(comDescricaoLocal(9003000, uma)).toBe(uma);
	});

	it('sem dados (vazio ou reticencias), so a frase', () => {
		expect(comDescricaoLocal(9003001, '...')).toBe(DESCRICOES_LOCAIS[9003001]);
		expect(comDescricaoLocal(9003001, '')).toBe(DESCRICOES_LOCAIS[9003001]);
	});

	it('CONTROLE: item oficial (sem frase local) fica como veio', () => {
		expect(comDescricaoLocal(501, DADOS)).toBe(DADOS);
		expect(comDescricaoLocal(9003002, undefined)).toBeUndefined();
	});
});
