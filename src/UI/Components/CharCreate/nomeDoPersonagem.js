/**
 * UI/Components/CharCreate/nomeDoPersonagem.js
 *
 * RAGIDLE: O NOME DO PERSONAGEM E APARADO E CONFERIDO ANTES DE IR AO SERVIDOR
 * (10/09/2026). Relato do dono: *"Players do mobile nao estao conseguindo
 * criar um personagem na tela de login."*
 *
 * Duas coisas que o teclado do CELULAR faz e o do desktop nao faz:
 *
 *  - ao tocar numa sugestao, ele escreve a palavra E UM ESPACO depois;
 *  - ele corrige e completa sozinho o que o jogador digitou.
 *
 * Um "Joe " com o espaco da sugestao tem 4 caracteres, e ia ao servidor como
 * nome valido e com um espaco no fim. Um "Ana" ia com 3, e o servidor recusava
 * com a UNICA mensagem que mandava para toda recusa: "Ja existe um personagem
 * com este nome." Quem digitou um nome curto ouvia que o nome estava tomado,
 * tentava outro curto, ouvia de novo — e desistia. Por fora, isso e "no celular
 * nao da para criar personagem".
 *
 * O APARO E O DA FONTE, e nao escolha nossa: `char_make_new_char` chama
 * `normalize_name(name, TRIM_CHARS)` antes de validar (`char.cpp:1404`), e
 * `normalize_name` (`strlib.cpp:59-93`) tira os `TRIM_CHARS` das pontas e
 * troca cada sequencia deles no meio por UM espaco. `TRIM_CHARS` e
 * `"\255\xA0\032\t\x0A\x0D "` (`char.hpp:161`) — o `\255` e OCTAL: 0xAD, o
 * hifen suave. O servidor faz a mesma conta (`servidor/char/nome-de-personagem.ts`);
 * esta copia e conforto para o jogador ler o erro sem esperar a ida e volta, e
 * nunca a guarda — quem manda o pacote na mao esbarra no servidor.
 *
 * A RECUSA LOCAL DO NOME CURTO tambem e da fonte: *"By default the client does
 * not allow you to create names with less than 4 characters"* (`char.cpp:1341`).
 * O cliente oficial recusa ali mesmo, com a mensagem certa.
 */

/** `TRIM_CHARS` (`char.hpp:161`), com o `\255` octal lido como 0xAD. */
export const CARACTERES_APARADOS = '\u00ad\u00a0\u001a\t\n\r ';

/** `char_name_min_length` (`conf/char_athena.conf:149`). */
export const NOME_MINIMO = 4;
/** `NAME_LENGTH (23 + 1)` (`mmo.hpp:154`), menos o NUL. */
export const NOME_MAXIMO = 23;

function ehAparado(c) {
	return CARACTERES_APARADOS.indexOf(c) !== -1;
}

/**
 * O porte de `normalize_name` (`strlib.cpp:59-93`): pontas fora, e cada
 * sequencia de aparados no meio vira um espaco so.
 *
 * @param {string} nome
 * @returns {string}
 */
export function normalizarNomeDoPersonagem(nome) {
	const texto = typeof nome === 'string' ? nome : '';
	let i = 0;
	let saida = '';
	let porEspaco = false;
	while (i < texto.length && ehAparado(texto.charAt(i))) {
		i++;
	}
	while (i < texto.length) {
		if (porEspaco) {
			saida += ' ';
		}
		while (i < texto.length && !ehAparado(texto.charAt(i))) {
			saida += texto.charAt(i);
			i++;
		}
		while (i < texto.length && ehAparado(texto.charAt(i))) {
			i++;
		}
		porEspaco = true;
	}
	return saida;
}

/**
 * O que dizer ao jogador ANTES de mandar o pedido — `null` quando o nome pode
 * seguir para o servidor.
 *
 * @param {string} nomeJaNormalizado
 * @returns {string|null}
 */
export function recusaDoNomeNoCliente(nomeJaNormalizado) {
	const nome = typeof nomeJaNormalizado === 'string' ? nomeJaNormalizado : '';
	if (nome.length < NOME_MINIMO || nome.length > NOME_MAXIMO) {
		return `O nome do personagem precisa ter de ${NOME_MINIMO} a ${NOME_MAXIMO} caracteres.`;
	}
	return null;
}
