// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
//
// A FORJA ELEMENTAL NO CLIENTE (14/10/2026): a janela por clique e toque
// (MakeItemSelection), o nome da arma forjada na ordem da lingua
// (nomeDaArmaForjada) e o "Beloved" que so vale para o ovo de pet (DBManager).
//
//   RAG_MUTANTE_FORJA=<nome> npx vitest run --config tests/mutantes/forja.config.mjs
//   (todos: ver o rodape)
//
// Um mutante MORTO faz a corrida reprovar.
import base from '../../vite.config.js';

const JANELA = 'src/UI/Components/MakeItemSelection/MakeItemSelection.js';
const NOME = 'src/DB/Items/nomeDaArmaForjada.js';
const DB = 'src/DB/DBManager.js';

export const mutantes = {
	// o Ferro volta a abrir a tela dos opcionais
	minerioComOpcionais: [JANELA, '\tif (PRODUTOS_SEM_MATERIAL_OPCIONAL.has(Number(itemId))) {\n\t\treturn false;\n\t}\n', ''],
	// a pocao (sem processitemlist) tambem vai para os opcionais
	semProcessItemList: [JANELA, "\treturn !!it && typeof it.processitemlist === 'string' && it.processitemlist !== '';", '\treturn !!it;'],
	// a segunda pedra cabe
	duasPedras: [JANELA, '\treturn !MakeItemSelection.material.some(it => validSingleMaterials.includes(it.ITID));', '\treturn true;'],
	// o quarto material cabe
	quatroSlots: [JANELA, '\tif (MakeItemSelection.material.length >= SLOTS_DE_MATERIAL) {', '\tif (MakeItemSelection.material.length > SLOTS_DE_MATERIAL) {'],
	// o botao do material nao faz nada
	cliqueMudo: [JANELA, "\t\t\tMakeItemSelection.colocarDaMochila(Number(botao.getAttribute('data-itid')));", '\t\t\tvoid botao;'],
	// o slot cheio nao devolve
	slotPreso: [JANELA, "\t\t\tMakeItemSelection.removerMaterial(Number(slot.getAttribute('data-posicao')));", '\t\t\tvoid slot;'],
	// tirar do slot nao devolve a mochila desenhada
	semDevolver: [JANELA, '\tInventory.getUI().addItem(Object.assign({}, item, { count: 1 }));\n\tdesenharSlots();', '\tdesenharSlots();'],
	// o ESC so fecha, como antes
	escSoFecha: [JANELA, '\t\tthis.cancelar();\n\t}', '\t\tthis.remove();\n\t}'],
	// o material vai para o slot sem sair da mochila desenhada
	semTirar: [JANELA, "\t\tcase 'Inventory':\n\t\t\tInventory.getUI().removeItem(item.index, 1);\n\t\t\tbreak;\n", ''],
	// a ordem portuguesa vira a inglesa
	semSufixo: [NOME, "\tif (de.startsWith(' ')) {", '\tif (false) {'],
	// o portugues perde o elemento
	semElemento: [NOME, "\t\tconst elemento = idDoElemento !== undefined ? msg(idDoElemento) : '';\n\t\treturn { prefixo: '', sufixo: elemento + muito + de + dono };", "\t\treturn { prefixo: '', sufixo: muito + de + dono };"],
	// o elemento vira o resto por 10 (o roBrowser), e nao o nibble baixo
	elementoPorDez: [NOME, '\treturn card2 & 0x0f;', '\treturn card2 % 10 + 1;'],
	// o degrau de 3 Estrelinhas some
	semTerceiraEstrela: [NOME, '\tif (card2 >= 3840) return 3;\n', ''],
	// o Beloved volta a pegar todo item com card4 = 1 (a arma do ferreiro de id 65.536 a 131.071)
	belovedEmTudo: [
		DB,
		'\t\tstr += it.identifiedDisplayName + sufixoDaForja;',
		"\t\tif (item.slot && item.slot.card4 === 0x1) str = DB.getMessage(756) + ' ' + str;\n\t\tstr += it.identifiedDisplayName + sufixoDaForja;"
	],
	// o pet renomeado perde o Beloved
	petSemBeloved: [DB, '\t\t\t\t\tif (item.slot.card4 === 0x1) {\n\t\t\t\t\t\t//BELOVED PET', '\t\t\t\t\tif (false) {\n\t\t\t\t\t\t//BELOVED PET'],
	// o nome do dono volta a passar a marcacao (D-1308)
	donoSemLimpeza: [NOME, '\t\t.filter(c => c.charCodeAt(0) >= 32 && !MARCACAO.includes(c))\n', ''],
	// o dono volta a sair em `<font>` (a dica da Mochila mostrava a marcacao crua)
	donoEmFont: [
		DB,
		'\t\t\t\t\t\tname = donoEmTexto(conhecido);',
		"\t\t\t\t\t\tname = '<font color=\"#87cefa\">' + donoEmTexto(conhecido) + '</font>';"
	],
	// o sufixo da forja nao entra no nome
	semSufixoNoNome: [DB, '\t\tstr += it.identifiedDisplayName + sufixoDaForja;', '\t\tstr += it.identifiedDisplayName;']
};

const nome = process.env.RAG_MUTANTE_FORJA;
const mutante = mutantes[nome];
if (nome && !mutante) throw new Error(`Escolha RAG_MUTANTE_FORJA: ${Object.keys(mutantes).join(', ')}.`);

export default {
	...base,
	plugins: [
		...(mutante
			? [
					{
						name: 'forja-somente-em-memoria',
						enforce: 'pre',
						transform(codigo, id) {
							if (!id.replaceAll('\\', '/').endsWith(mutante[0])) return null;
							const normalizado = codigo.replaceAll('\r\n', '\n');
							if (normalizado.split(mutante[1]).length !== 2) throw new Error(`Mutante ${nome} nao casa exatamente uma vez.`);
							return normalizado.replace(mutante[1], mutante[2]);
						}
					}
				]
			: [])
	],
	test: { ...base.test, include: ['tests/ui/forjaPorCliqueEToque.test.js', 'tests/db/nomeDaArmaForjada.test.js', 'tests/db/nomeForjadoNoGetItemName.test.js', 'tests/db/xssNomeDoDonoDaArma.test.js'] }
};

// Rodar todos (bash):
//   for m in $(node -e "import('./tests/mutantes/forja.config.mjs').then(x=>console.log(Object.keys(x.mutantes).join(' ')))"); do
//     RAG_MUTANTE_FORJA=$m npx vitest run --config tests/mutantes/forja.config.mjs >/dev/null 2>&1 && echo "SOBREVIVEU $m" || echo "morto $m"; done
