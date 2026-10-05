// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
//
// A FLECHA NO CELULAR (05/10/2026). Cada mutante e um jeito de a Mochila voltar
// ao relato: a flecha sem "Equipar", a flecha vestida dizendo "nao foi
// possivel", ou a grade refeita a cada tiro. A costura em `MochilaIdle.js` e
// portao de FONTE (`tests/ui/municaoNaMochila.test.js` le o arquivo), que a
// transformacao em memoria nao alcanca.
//
//   RAG_MUTANTE_MUNICAO=<nome> npx vitest run --config tests/mutantes/municao-na-mochila.config.mjs
//
// Um mutante MORTO faz a corrida reprovar.
import base from '../../vite.config.js';

const ALVO = 'src/UI/Components/MochilaIdle/municaoNaMochila.js';

const mutantes = {
	// a flecha volta a nao ter acao no menu
	semEquipar: ["return municaoVestida(mascaraVestida) ? null : 'equipar-municao';", 'return null;'],
	// a flecha vestida tambem ganha "Equipar"
	vestidaGanhaEquipar: ["return municaoVestida(mascaraVestida) ? null : 'equipar-municao';", "return 'equipar-municao';"],
	// a carta perde o encaixe (a ordem dos ramos importa)
	cartaSemEncaixe: ["\t\treturn 'encaixar';", '\t\treturn null;'],
	// qualquer espaco conta como municao
	qualquerEspaco: ['return ((mascara | 0) & EquipLocation.AMMO) !== 0;', 'return (mascara | 0) !== 0;'],
	// a recusa volta a dizer "nao foi possivel" sempre
	semprRecusa: ['\treturn municaoVestida(mascaraDepois);', '\treturn false;'],
	// a mascara pedida ignora o item
	mascaraFixa: ["return typeof item.location === 'number' && item.location > 0 ? item.location : EquipLocation.AMMO;", 'return 0;'],
	// a quantidade volta a refazer a grade
	quantidadeRefazTudo: ["return antes.quantidades === agora.quantidades ? 'nada' : 'quantidade';", "return antes.quantidades === agora.quantidades ? 'nada' : 'tudo';"],
	// a trava some da estrutura
	semTravaNaEstrutura: [" + ':' + (it.travado ? 1 : 0)", ''],
	// a identificacao some da estrutura
	semIdentificacao: [" + ':' + (it.IsIdentified ? 1 : 0)", ''],
	// o contador nao some quando a pilha chega a 1
	contadorNaoSome: ['\t\t} else if (qtd) {\n\t\t\tqtd.remove();\n\t\t}', '\t\t}'],
	// o contador novo nasce no fim da celula
	contadorNoFim: ['cell.insertBefore(qtd, icone ? icone.nextSibling : cell.firstChild);', 'cell.appendChild(qtd);'],
	// o numero nao e reescrito
	numeroVelho: ['\t\t\tqtd.textContent = String(count);', ''],
	// a dica volta a ler o WearState da flecha (toda flecha "Equipado")
	seloPeloWearState: ['\t\treturn mascaraDosLadrilhos() & EquipLocation.AMMO;', '\t\treturn item.WearState;'],
	// o slot deixa de mandar no selo
	seloSemSlot: ["\tif (typeof vestidoEmForcado === 'number' && vestidoEmForcado > 0) {", '\tif (false) {']
};
const mutante = mutantes[process.env.RAG_MUTANTE_MUNICAO];
if (!mutante) throw new Error(`Escolha RAG_MUTANTE_MUNICAO: ${Object.keys(mutantes).join(', ')}.`);

export default {
	...base,
	plugins: [{
		name: 'municao-na-mochila-somente-em-memoria',
		enforce: 'pre',
		transform(codigo, id) {
			if (!id.replaceAll('\\', '/').endsWith(ALVO)) return null;
			const normalizado = codigo.replaceAll('\r\n', '\n');
			if (normalizado.split(mutante[0]).length !== 2) throw new Error('Mutante nao casa exatamente uma vez.');
			return normalizado.replace(mutante[0], mutante[1]);
		}
	}],
	test: { ...base.test, include: ['tests/ui/municaoNaMochila.test.js'] }
};

export const NOMES = Object.keys(mutantes);
