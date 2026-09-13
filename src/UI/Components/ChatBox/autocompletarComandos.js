/**
 * O AUTOCOMPLETAR DE COMANDOS (a proposta 5 da tarefa 20 do dono, a segunda
 * metade). Ao digitar `@` ou `#` no chat, uma lista sobe da barra com os
 * comandos que comecam com o que ja esta escrito — e e ela que chega ao dedo:
 * as setas do historico (a primeira metade, D-1358) sao do teclado fisico.
 *
 * A LISTA vem do servidor (`ZC_RAGIDLE_COMANDOS`), uma vez por personagem, e
 * ja filtrada pelo que o jogador PODE usar; aqui mora so a regra de, a cada
 * tecla, escolher o que mostrar. A ordem e a do "voce quis dizer" do servidor
 * (D-1347): primeiro os que COMECAM com o digitado, depois os que o CONTEM.
 */

/** Quantas cabem sem cobrir o chat do celular inteiro. Numero nosso. */
export const MAXIMO_DE_SUGESTOES_NA_TELA = 6;

/**
 * O que o campo tem para completar: o simbolo e o comeco do nome, minusculo
 * como o servidor le — ou `null` quando nao ha o que completar (fala, campo
 * vazio, ou o nome ja terminou e o jogador esta nos argumentos).
 */
export function lerOQueCompletar(texto) {
	if (typeof texto !== 'string') return null;
	const achado = /^([@#])(\S*)$/.exec(texto);
	return achado ? { simbolo: achado[1], prefixo: achado[2].toLowerCase() } : null;
}

/**
 * As sugestoes para o que esta no campo — `{ simbolo, itens }`, ou `null` se
 * nao ha nada a mostrar. A lista chega do servidor e e lida com desconfianca:
 * so entra item com `nome` de texto.
 */
export function sugestoesPara(texto, lista, maximo = MAXIMO_DE_SUGESTOES_NA_TELA) {
	const lido = lerOQueCompletar(texto);
	if (lido === null || !Array.isArray(lista)) return null;
	const comecam = [];
	const contem = [];
	for (const item of lista) {
		if (!item || typeof item.nome !== 'string') continue;
		const onde = item.nome.indexOf(lido.prefixo);
		if (onde === 0) comecam.push(item);
		else if (onde > 0) contem.push(item);
	}
	const itens = [...comecam, ...contem].slice(0, maximo);
	return itens.length === 0 ? null : { simbolo: lido.simbolo, itens };
}

/** O texto do campo depois de escolher `nome`: o simbolo, o nome e o espaco dos argumentos. */
export function textoCompletado(simbolo, nome) {
	return `${simbolo}${nome} `;
}

/**
 * A AJUDA como a lista a mostra. A linha de ajuda do servidor COMECA com o
 * proprio comando (`@heal [hp] [sp] — cura...`), e a lista ja mostra o nome em
 * negrito ao lado: sem o corte, o nome saia DUAS vezes na mesma linha — foi o
 * que a primeira foto do celular mostrou. Fica a sintaxe e a descricao. So o
 * nome INTEIRO sai (`@where` nao come o comeco de `@whereis`), e a ajuda que
 * comeca com OUTRO comando — a do apelido, que e a do canonico — fica inteira,
 * porque ela diz para onde o apelido leva.
 */
export function ajudaSemONome(nome, ajuda) {
	if (typeof ajuda !== 'string') return '';
	const texto = ajuda.trim();
	const prefixo = `@${nome}`;
	if (!texto.startsWith(prefixo)) return texto;
	const resto = texto.slice(prefixo.length);
	if (resto !== '' && !/^\s/.test(resto)) return texto;
	return resto.trim().replace(/^[-—]\s*/, '');
}
