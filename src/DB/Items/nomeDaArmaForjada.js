/**
 * DB/Items/nomeDaArmaForjada.js
 *
 * O NOME DA ARMA FORJADA (lote 5 da comunidade, 14/10/2026, D-2474 no
 * servidor). A forja grava a assinatura nos quatro `card[]` da arma
 * (rAthena skill.cpp:13246-13249):
 *
 *   card1 = 0x00FF (CARD0_FORGE)
 *   card2 = ((estrelas * 5) << 8) + elemento   (e_element: 1 agua, 2 terra, 3 fogo, 4 vento)
 *   card3 = palavra baixa do id do ferreiro
 *   card4 = palavra alta do id do ferreiro
 *
 * e o cliente monta o nome com as mensagens 450-454 e 459-461 do
 * `msgstringtable`: o elemento ("Flamejante"), as Estrelinhas ("Forte",
 * "Muito Forte", "Fortissimo") e o nome de quem forjou.
 *
 * ## A ORDEM DEPENDE DA LINGUA, e quem diz e o proprio dado
 *
 * O roBrowser monta na ordem inglesa e coreana, tudo ANTES do nome do item:
 * "Very Strong Fulano's Fire Sword". As mensagens em portugues do cliente
 * oficial (LATAM) foram escritas para a ordem CONTRARIA: todas comecam com
 * espaco e nenhuma termina com ele (" de ", " Flamejante", " Forte"), ou seja,
 * sao SUFIXOS. Na ordem inglesa elas dariam " Forte Fulano Flamejante Espada"
 * e, sem elemento, "Fulano de  Espada".
 *
 * A escolha sai do texto da mensagem 450, e nao de uma bandeira de idioma: a
 * mensagem do "de" que comeca com espaco e a do idioma que poe o dono no fim.
 * Em portugues sai "Espada Flamejante Muito Forte de Fulano" e, sem pedra
 * nem Estrelinha, "Espada de Fulano"; em ingles continua como sempre foi.
 *
 * Funcao pura (recebe as mensagens por parametro) para o teste nao depender
 * do `msgstringtable` carregado.
 */

/** As mensagens do elemento, pelo valor de `e_element` no nibble baixo de card2. */
const MENSAGEM_DO_ELEMENTO = { 1: 452, 2: 454, 3: 451, 4: 453 };

/** As mensagens das Estrelinhas: 1, 2 e 3 (MSI_ONE/TWO/THREE_STARPIECE). */
const MENSAGEM_DAS_ESTRELAS = { 1: 459, 2: 460, 3: 461 };

/**
 * Quantas Estrelinhas a assinatura diz. O byte alto de card2 e `estrelas * 5`
 * (5, 10, 15); os degraus sao os que o roBrowser ja usava (1024, 2560, 3840).
 *
 * @param {number} card2
 * @return {number} 0 a 3
 */
export function estrelasDaAssinatura(card2) {
	if (card2 >= 3840) return 3;
	if (card2 >= 2560) return 2;
	if (card2 >= 1024) return 1;
	return 0;
}

/**
 * O elemento da assinatura: o nibble baixo de card2, como o servidor o le
 * (`card[1] & 0x0f`, rAthena status.cpp:4010).
 *
 * @param {number} card2
 * @return {number} 0 (sem pedra) a 4
 */
export function elementoDaAssinatura(card2) {
	return card2 & 0x0f;
}

/**
 * O nome do ferreiro em TEXTO seguro: sem os caracteres de marcacao, para o
 * mesmo nome servir a quem o poe em `innerHTML` e a quem o poe em
 * `textContent` (D-1308: o nome vem cru do pacote). Vazio vira "Unknown".
 *
 * @param {string} nome
 * @return {string}
 */
/** Os caracteres que fazem marcacao em HTML (e a crase dos modelos de texto). */
const MARCACAO = ['<', '>', '&', '"', "'", '`'];

export function donoEmTexto(nome) {
	const limpo = Array.from(String(nome ?? ''))
		.filter(c => c.charCodeAt(0) >= 32 && !MARCACAO.includes(c))
		.join('')
		.trim();
	return limpo === '' ? 'Unknown' : limpo;
}

/**
 * As duas partes do nome de uma arma forjada: o que vai ANTES do nome do item
 * e o que vai DEPOIS.
 *
 * @param {number} card2 - o card[1] da assinatura
 * @param {string} dono - o nome do ferreiro, ja em HTML seguro (o `<font>` do DBManager)
 * @param {function(number): (string|undefined)} mensagem - le o msgstringtable
 * @return {{prefixo: string, sufixo: string}}
 */
export function partesDoNomeForjado(card2, dono, mensagem) {
	const msg = id => mensagem(id) ?? '';
	const estrelas = estrelasDaAssinatura(card2);
	const muito = estrelas > 0 ? msg(MENSAGEM_DAS_ESTRELAS[estrelas]) : '';
	const idDoElemento = MENSAGEM_DO_ELEMENTO[elementoDaAssinatura(card2)];
	const de = msg(450);

	if (de.startsWith(' ')) {
		// Portugues: "Espada" + " Flamejante" + " Muito Forte" + " de " + "Fulano".
		const elemento = idDoElemento !== undefined ? msg(idDoElemento) : '';
		return { prefixo: '', sufixo: elemento + muito + de + dono };
	}

	// Ingles e coreano, a montagem de sempre: "Very Strong Fulano's Fire Sword".
	const elemento = idDoElemento !== undefined ? msg(idDoElemento) : de;
	return { prefixo: muito + ' ' + dono + elemento + ' ', sufixo: '' };
}
