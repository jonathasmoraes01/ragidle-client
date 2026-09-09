/**
 * UI/Components/ChatBox/linkDeItemNoChat.js
 *
 * LINKAR UM ITEM NO CHAT (D-946, 06/09/2026 — pedido do dono).
 *
 * O cliente ja sabia linkar item desde sempre: `DB.createItemLink` monta a
 * etiqueta `<ITEML>...</ITEML>`, o servidor ecoa os BYTES da fala sem tocar
 * neles (servidor/mapa/servidor-mapa.ts, CZ_REQUEST_CHAT) e `ChatBox.addText`
 * volta a transformar a etiqueta em `.item-link` clicavel, que reabre a ficha.
 * O que faltava era a PORTA: o unico gesto que produzia um link era
 * SHIFT+clique na mochila — que **nao existe no celular**, onde o jogo mora.
 *
 * Este modulo e a parte PURA dessa porta: as tres perguntas que o chat precisa
 * responder antes de receber o link. Elas estao aqui, e nao dentro do
 * ChatBox.js, porque cada uma ja foi um jeito silencioso de o link se perder:
 *
 *   1. **A barra de digitacao nasce ESCONDIDA.** `ChatBox.onAppend` poe
 *      `.input` em `display:none` e mostra o modo batalha no lugar. O
 *      SHIFT+clique de `InventoryCommon.js` escrevia direto no campo sem olhar
 *      isso — numa sessao recem-aberta o link entrava num campo invisivel e o
 *      jogador via o nada acontecer.
 *   2. **No celular o chat nasce RECOLHIDO** (D-930), e recolhido a `.input`
 *      inteira sai do fluxo (`#chatbox.is-recolhido .input {display:none}`).
 *      Mesmo desfecho, no aparelho onde o botao mais importa.
 *   3. **Tres dos quatro canais nao digitam**: `logs` e so leitura, `trade`
 *      troca o campo pela frase de canal inexistente e `farm` esconde a barra
 *      inteira. Linkar sem trocar de canal escreveria num campo que o CSS
 *      escondeu, ou numa aba que recusa o Enter depois.
 *
 * Nada aqui toca o DOM do chat de proposito: a decisao e testavel sozinha
 * (`tests/ui/linkDeItemNoChat.test.js`), e quem executa e o ChatBox.
 */

/**
 * Os canais onde a fala do jogador NAO sai — cada um pelo seu motivo, todos
 * com o mesmo desfecho para quem tentar linkar sem trocar de aba.
 *
 * `logs`  — so leitura (CANAIS_SO_LEITURA em ChatBox.js recusa o submit);
 * `trade` — o servidor de mapa nao tem canal de comercio, e o CSS troca o
 *           campo pela frase que explica isso (`.cb-inerte`);
 * `farm`  — a barra inteira sai (`#chatbox.canal-farm .input`).
 */
export const CANAIS_QUE_NAO_DIGITAM = ['logs', 'trade', 'farm'];

/** Para onde mandar quem esta num canal mudo. */
export const CANAL_DE_FALA = 'global';

/**
 * OS CANAIS QUE SE LEEM MAS NAO SE FALAM (08/09/2026, ordem do dono: "o chat na
 * aba Logs e Farm estao disponiveis sim, mas quando o player digita, a mensagem
 * dele cai em Global"). Digitar neles TROCA para o Global antes de enviar — o
 * eco do servidor cai na aba que o jogador esta vendo. O Trade fica de fora:
 * ele nao tem canal no servidor e continua sem digitacao (".cb-inerte").
 */
export const CANAIS_QUE_FALAM_NO_GLOBAL = ['logs', 'farm'];

/** Em que canal a fala digitada em `canalAtivo` deve sair. */
export function canalDaFala(canalAtivo) {
	return CANAIS_QUE_FALAM_NO_GLOBAL.includes(canalAtivo) ? CANAL_DE_FALA : canalAtivo;
}

/**
 * O que o chat precisa fazer ANTES de receber o link.
 *
 * @param {{recolhido?: boolean, canal?: string, barraVisivel?: boolean}} estado
 * @returns {{trocarPara: string|null, expandir: boolean, abrirBarra: boolean}}
 */
export function preparoParaLinkar(estado) {
	const { recolhido = false, canal = CANAL_DE_FALA, barraVisivel = false } = estado || {};

	return {
		trocarPara: CANAIS_QUE_NAO_DIGITAM.includes(canal) ? CANAL_DE_FALA : null,
		expandir: !!recolhido,
		abrirBarra: !barraVisivel
	};
}

/**
 * O link CABE no que a barra ainda aceita?
 *
 * O teto de 100 caracteres (`MAX_LENGTH` em ChatBox.js) e cobrado no `input` e
 * no `paste`, mas nunca na escrita por codigo — e o texto que conta e o CRU, a
 * etiqueta `<ITEML>...</ITEML>` inteira, que e o que `extractChatMessage`
 * devolve e o que viaja no pacote. Sem esta pergunta, o link entra inteiro,
 * estoura o teto e a barra trava para digitar: o jogador ganha um link que nao
 * consegue mais acompanhar de texto nenhum.
 *
 * O `+ 1` e o espaco que vai depois do link, para o jogador continuar
 * escrevendo sem colar palavra no nome do item.
 *
 * @param {string} textoAtual texto CRU ja no campo
 * @param {string} link etiqueta `<ITEML>...</ITEML>`
 * @param {number} limite
 * @returns {boolean}
 */
export function cabeNoLimite(textoAtual, link, limite) {
	return (textoAtual || '').length + (link || '').length + 1 <= limite;
}

/**
 * O markup do link dentro da barra de digitacao.
 *
 * O `data-item` guarda a etiqueta CRUA — e ela, e nao o texto visivel, que
 * `extractChatMessage` devolve no lugar do `<span>` na hora de enviar. O nome
 * aparece entre `&lt;` e `&gt;` e na cor verde-oliva do link em digitacao (o
 * amarelo `#FFFF63` e o do link ja PUBLICADO, em `ChatBox.addText`).
 *
 * Escapar nao e paranoia decorativa: nome de item vem do banco do cliente e
 * carrega parentese, aspas e barra ("Espada de Vidro [3]", "Elmo do Sol '"),
 * e o `data-item` fica dentro de um atributo entre aspas duplas.
 *
 * @param {string} link
 * @param {string} nome
 * @returns {string}
 */
export function markupDoLink(link, nome) {
	return (
		'<span data-item="' +
		escaparAtributo(link) +
		'" class="item-link" style="color:#A9B95F;">&lt;' +
		escaparTexto(nome) +
		'&gt;</span>'
	);
}

/** Texto seguro para innerHTML — a mesma tecnica de `ItemInfo.js#_escapeHTML`. */
function escaparTexto(texto) {
	const div = document.createElement('div');
	div.textContent = texto == null ? '' : String(texto);
	return div.innerHTML;
}

/** Idem, mais as aspas: este vai DENTRO de um atributo. */
function escaparAtributo(texto) {
	return escaparTexto(texto).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
