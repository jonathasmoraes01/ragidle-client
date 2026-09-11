/**
 * UI/Components/ChatBox/textoSeguroDoChat.js
 *
 * O CHAT NUNCA DEIXA O TEXTO DO JOGADOR DECIDIR SE ELE E HTML (D-1308).
 *
 * O defeito de origem morava em `ChatBox.addText`: achar `<ITEM>`/`<ITEML>`
 * (ou o literal `<span class="nickname-link"`) DENTRO do texto ligava um flag
 * `override`, e o override jogava a mensagem INTEIRA, crua, em `innerHTML`.
 * Ou seja: bastava um jogador DIGITAR uma dessas coisas -- ou um
 * `<img src=x onerror=...>` -- para rodar JavaScript no navegador de quem
 * lesse. O mesmo furo tinha copia no WhisperBox e no sussurro do
 * PrivateMessage.
 *
 * A regra do conserto e uma so: ESCAPAR PRIMEIRO, DEPOIS TRANSFORMAR. Nunca
 * deixar a string do jogador dizer que e confiavel. Estas funcoes montam o
 * markup legitimo (link de item, apelido clicavel) a partir de DADO
 * ESTRUTURADO -- o id que o parser extrai, o nome que o DB resolve --, nunca
 * ecoando o markup que o jogador digitou; e tudo o que veio do jogador passa
 * pelo escapador antes.
 */

import DB from 'DB/DBManager.js';
import { escaparHtml } from 'Utils/escaparHtml.js';

// Reexportado para os consumidores do chat (ChatBox, WhisperBox,
// PrivateMessage) nao precisarem de dois imports.
export { escaparHtml };

/**
 * A etiqueta CRUA de um link de item, nos tres formatos que o protocolo usa.
 * `[\s\S]*?` (e nao `.`) porque a fala pode conter quebra de linha; a fonte
 * fica em string para cada chamada criar o seu RegExp e ninguem compartilhar
 * `lastIndex`.
 */
const FONTE_DO_LINK_DE_ITEM = '<ITEMLINK>[\\s\\S]*?<\\/ITEMLINK>|<ITEML>[\\s\\S]*?<\\/ITEML>|<ITEM>[\\s\\S]*?<\\/ITEM>';

/**
 * O `<span>` SEGURO de um link de item.
 *
 * O `data-item` guarda a etiqueta CRUA -- e so ela que o clique reabre em
 * ficha (`DB.parseItemLink` de novo) --, mas escapada, porque vai dentro de um
 * atributo. O nome exibido vem de `item.name` (o parser resolve pelo DB no
 * formato `<ITEML>`; no formato `<ITEM>` o proprio texto traz o nome) e e
 * escapado como texto. Se o parser recusar, o trecho vira TEXTO escapado --
 * nunca HTML.
 *
 * @param {string} match a etiqueta crua casada
 * @param {{cor?: string, cursor?: boolean}} [opcoes]
 * @returns {string}
 */
export function spanDeLinkDeItem(match, opcoes) {
	const item = DB.parseItemLink(match);
	if (!item) {
		return escaparHtml(match);
	}
	const cor = (opcoes && opcoes.cor) || '#FFFF63';
	const cursor = !!(opcoes && opcoes.cursor);
	const estilo = 'color:' + cor + ';' + (cursor ? ' cursor:pointer;' : '');
	return (
		'<span data-item="' +
		escaparHtml(match) +
		'" class="item-link" style="' +
		estilo +
		'">&lt;' +
		escaparHtml(item.name) +
		'&gt;</span>'
	);
}

/**
 * Renderiza uma fala CRUA com seguranca: tudo FORA dos links de item passa por
 * `realce` (que TEM a obrigacao de escapar), e cada link vira um
 * `spanDeLinkDeItem`. Assim o link continua clicavel para conteudo legitimo,
 * enquanto quem DIGITA `<img onerror=...>` (ou o proprio `<span
 * class="nickname-link">`) ve o texto literal.
 *
 * @param {string} rawText
 * @param {(segmento: string, ehPrimeiro: boolean) => string} [realce]
 *        o escapador/realce do trecho de texto; recebe se e o PRIMEIRO trecho
 *        (para o prefixo "Nome : " so ser destacado no comeco). O default e o
 *        escapador puro.
 * @param {{cor?: string, cursor?: boolean}} [opcoesDoLink]
 * @returns {string}
 */
export function renderFalaSegura(rawText, realce, opcoesDoLink) {
	const texto = String(rawText === null || rawText === undefined ? '' : rawText);
	const aplicar = typeof realce === 'function' ? realce : escaparHtml;
	const re = new RegExp(FONTE_DO_LINK_DE_ITEM, 'gi');
	let out = '';
	let last = 0;
	let primeiro = true;
	let m;
	while ((m = re.exec(texto)) !== null) {
		out += aplicar(texto.slice(last, m.index), primeiro);
		out += spanDeLinkDeItem(m[0], opcoesDoLink);
		last = re.lastIndex;
		primeiro = false;
		// Guarda contra um casamento de comprimento zero travar o laco. Os
		// padroes exigem <TAG>...</TAG>, entao isso nao acontece hoje; a guarda
		// e barata e a fica se um padrao vazio for somado um dia.
		if (m.index === re.lastIndex) {
			re.lastIndex++;
		}
	}
	out += aplicar(texto.slice(last), primeiro);
	return out;
}

/**
 * O `<span>` clicavel de um APELIDO -- montado a partir de um nome, nunca de
 * markup. O nome e escapado no atributo (`data-nickname`) E no texto visivel,
 * entao um nome com `"` ou `<` nao quebra nem o atributo nem o corpo.
 *
 * @param {string} nome
 * @returns {string}
 */
export function spanDeNickname(nome) {
	const seguro = escaparHtml(nome);
	return (
		'<span class="nickname-link" data-nickname="' +
		seguro +
		'" style="cursor:pointer; text-decoration:underline;">' +
		seguro +
		'</span>'
	);
}
