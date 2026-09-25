// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
// Uso: RAG_MUTANTE_ESPACO=<nome> node ../../../node_modules/vitest/vitest.mjs run --config tests/mutantes/nome-com-espaco.config.mjs
// Cada mutante tem de REPROVAR tests/ui/nomeDoPersonagem.test.js ou tests/ui/roShopRodada2.test.js.
//
// A ordem do dono (25/09/2026): *"Nao deixe criar personagens que tenham espaco
// entre os nomes, ok? Esse 'Testem an' deveria ser 'Testeman'."*
// O CharEngine (quem chama `textoDaRecusaDeCriacao`) nao entra aqui: o teste o
// le do DISCO, e um mutante so em memoria nunca chegaria a ele.
import base from '../../vite.config.js';

const NOME = 'src/UI/Components/CharCreate/nomeDoPersonagem.js';
const LOJA = 'src/UI/Components/RoShop/formatoDoRoShop.js';

const mutantes = {
	// o defeito de volta: "Testem an" vai ao servidor sem aviso
	'sem-recusa': [NOME, '\tif (ESPACO_NO_NOME.test(nome)) {\n\t\treturn MENSAGEM_NOME_COM_ESPACO;\n\t}\n', ''],
	// so o espaco ASCII: o U+3000 do teclado japones passa
	'so-ascii': [NOME, '/[\\s\\u180e\\u200b]/', '/[ \\u180e\\u200b]/'],
	// o espaco de largura zero passa
	'sem-200b': [NOME, '/[\\s\\u180e\\u200b]/', '/[\\s\\u180e]/'],
	// o U+180E (que o \\s nao considera espaco) passa
	'sem-180e': [NOME, '/[\\s\\u180e\\u200b]/', '/[\\s\\u200b]/'],
	// a frase deixa de ser a que o dono pediu
	'frase-errada': [NOME, "'O nome não pode ter espaços.'", "'Nome inválido.'"],
	// o espaco e dito antes do tamanho: "A B" ouve "espaco" em vez de "curto"
	'espaco-antes-do-tamanho': [
		NOME,
		'\tif (nome.length < NOME_MINIMO || nome.length > NOME_MAXIMO) {',
		'\tif (ESPACO_NO_NOME.test(nome)) {\n\t\treturn MENSAGEM_NOME_COM_ESPACO;\n\t}\n\tif (nome.length < NOME_MINIMO || nome.length > NOME_MAXIMO) {'
	],
	// a recusa 0x02 do servidor volta a frase generica
	'servidor-02-generico': [NOME, '\t\tcase CODIGO_NOME_COM_SIMBOLO:\n\t\t\treturn MENSAGEM_NOME_COM_ESPACO;\n', ''],
	// o codigo deixa de ser o 0x02 que o servidor manda
	'codigo-errado': [NOME, 'export const CODIGO_NOME_COM_SIMBOLO = 0x02;', 'export const CODIGO_NOME_COM_SIMBOLO = 0x04;'],
	// "ja existe" vira "criacao negada"
	'ja-existe-generico': [NOME, "return lerMensagem(10); // 'Charname already exists'", "return lerMensagem(11); // 'Charname already exists'"],
	// a troca de nome do RO Shop manda o nome com espaco
	'roshop-sem-recusa': [LOJA, '\t\tif (ESPACO_NO_NOME.test(nome)) {\n\t\t\treturn { ok: false, erro: MENSAGEM_NOME_COM_ESPACO };\n\t\t}\n', '']
};
const mutante = mutantes[process.env.RAG_MUTANTE_ESPACO];
if (!mutante) throw new Error('Escolha RAG_MUTANTE_ESPACO: ' + Object.keys(mutantes).join(', ') + '.');

export default {
	...base,
	plugins: [
		{
			name: 'nome-com-espaco-somente-em-memoria',
			enforce: 'pre',
			transform(codigo, id) {
				if (!id.replaceAll('\\', '/').endsWith(mutante[0])) return null;
				const normal = codigo.replace(/\r\n/g, '\n');
				if (normal.split(mutante[1]).length !== 2) throw new Error('Mutante nao casa exatamente uma vez.');
				return normal.replace(mutante[1], mutante[2]);
			}
		}
	],
	test: { ...base.test, include: ['tests/ui/nomeDoPersonagem.test.js', 'tests/ui/roShopRodada2.test.js'] }
};

export const NOMES = Object.keys(mutantes);
