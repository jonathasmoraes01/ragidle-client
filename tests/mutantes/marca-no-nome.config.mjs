// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
// Uso: RAG_MUTANTE_MARCA=<nome> npx vitest run --config tests/mutantes/marca-no-nome.config.mjs
// Cada mutante tem de REPROVAR tests/ui/marcaNoNome.test.js.
import base from '../../vite.config.js';

const ALVO = 'src/UI/Components/ChatBox/marcaNoNome.js';
const mutantes = {
	// o VIP vence o GM (o dono pediu o contrario)
	'vip-vence': ["\tif (ehAdmin) return 'gm';\n\tif (ehVip) return 'vip';", "\tif (ehVip) return 'vip';\n\tif (ehAdmin) return 'gm';"],
	// o GM some da fala
	'sem-gm': ["\tif (ehAdmin) return 'gm';\n", ''],
	// o VIP some da fala
	'sem-vip': ["\tif (ehVip) return 'vip';\n", ''],
	// o bit do VIP deixa de ser lido
	'bit-vip': ['!!(colorType & TYPE.VIP)', 'false'],
	// a fala de admin volta a ser pintada de amarelo com [GM] na etiqueta
	'amarelo-na-fala': ['!!(colorType & TYPE.ADMIN) && !(colorType & tiposDeFala(TYPE))', '!!(colorType & TYPE.ADMIN)'],
	// a linha de quest perde o [GM] e o amarelo
	'quest-sem-gm': ['!!(colorType & TYPE.ADMIN) && !(colorType & tiposDeFala(TYPE))', 'false'],
	// o sussurro deixa de ser fala
	'sussurro-nao-e-fala': ['TYPE.PUBLIC | TYPE.PARTY | TYPE.GUILD | TYPE.PRIVATE | TYPE.CLAN', 'TYPE.PUBLIC | TYPE.PARTY | TYPE.GUILD | TYPE.CLAN'],
	// o icone deixa de ser o do RO Cash
	'icone-errado': ["'/ragidle/shop/icons/shop-icon-ro-cash.png'", "'/ragidle/shop/icons/shop-icon-cart.png'"],
	// o nome VIP perde a classe da cor
	'vip-sem-cor': ['<span class="cb-name cb-name-vip">', '<span class="cb-name">'],
	// o nome GM perde a classe da cor
	'gm-sem-cor': ['<span class="cb-name cb-name-gm">', '<span class="cb-name">'],
	// o sussurro VIP perde a marca
	'sussurro-sem-vip': ["\tif (marca === 'vip') return `${htmlDoIconeDeVip()}<span class=\"cb-name-vip\">${htmlDoNome}</span>`;\n", ''],
	// o sussurro GM perde a marca
	'sussurro-sem-gm': ["\tif (marca === 'gm') return `${htmlDoSeloDeGm()}<span class=\"cb-name-gm\">${htmlDoNome}</span>`;\n", ''],
	// nome vazio passa a casar
	'nome-vazio': ["typeof nome === 'string' && nome !== '' && Array.isArray(lista)", "typeof nome === 'string' && Array.isArray(lista)"],
	// o servidor antigo sem os campos quebra (lixo vira lista)
	'lixo-vira-lista': ["Array.isArray(v) ? v.filter(x => typeof x === 'number') : []", "Array.isArray(v) ? v : []"],
	// o recorte do nome da guilda deixa de aparar
	'sem-trim': ['return m ? m[1].trim() : \'\';', "return m ? m[1] : '';"],
	// os nomes de admin nao sao lidos
	'sem-nomes-admin': ['nomesAdmin: listaDeNomes(d.nomesAdmin)', 'nomesAdmin: []'],
	// a fala de GM deixa de ser pintada inteira
	'linha-gm-sem-cor': ["\tif (marca === 'gm') return 'cb-linha-gm';\n", ''],
	// a fala de VIP deixa de ser pintada inteira
	'linha-vip-sem-cor': ["\tif (marca === 'vip') return 'cb-linha-vip';\n", ''],
	// a linha que nao e fala (quest) passa a ganhar a cor da marca
	'linha-fora-da-fala': ["\tif (!(colorType & tiposDeFala(TYPE))) return '';\n", ''],
	// o sussurro de GM nao manda os bits
	'bits-sem-gm': ["\tif (marca === 'gm') return TYPE.ADMIN;\n", ''],
	// o sussurro de VIP nao manda os bits
	'bits-sem-vip': ["\tif (marca === 'vip') return TYPE.VIP;\n", '']
};
// O FIO (os handlers chamando isto) nao entra aqui: o teste le os fontes do
// DISCO, e um mutante so em memoria nunca chegaria a eles.
const mutante = mutantes[process.env.RAG_MUTANTE_MARCA];
if (!mutante) throw new Error('Escolha RAG_MUTANTE_MARCA: ' + Object.keys(mutantes).join(', ') + '.');

export default {
	...base,
	plugins: [
		{
			name: 'marca-no-nome-somente-em-memoria',
			enforce: 'pre',
			transform(codigo, id) {
				if (!id.replaceAll('\\', '/').endsWith(ALVO)) return null;
				const normal = codigo.replace(/\r\n/g, '\n');
				if (normal.split(mutante[0]).length !== 2) throw new Error('Mutante nao casa exatamente uma vez.');
				return normal.replace(mutante[0], mutante[1]);
			}
		}
	],
	test: { ...base.test, include: ['tests/ui/marcaNoNome.test.js'] }
};

export const NOMES = Object.keys(mutantes);
