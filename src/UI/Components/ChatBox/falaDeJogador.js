/**
 * UI/Components/ChatBox/falaDeJogador.js
 *
 * ESTA LINHA DO CHAT FOI ESCRITA POR UM JOGADOR? (D-1929, o jogo em ingles)
 *
 * O tradutor na borda traduz toda linha do chat que o SERVIDOR escreve
 * (sistema, avisos, anuncios). O que um jogador DIGITOU nao se traduz: um
 * "Sim" no chat global nao pode virar "Yes", nem o nome de alguem virar
 * palavra. A linha do jogador leva `translate="no"` no corpo (a etiqueta
 * "[Global]" continua traduzindo).
 *
 * A regra olha o FILTRO e a COR que a origem declarou, sem ler o texto:
 * fala publica, sussurro, grupo, guilda e cla sao de jogador, menos o que
 * chega com cor de anuncio, erro, informacao ou azul (o servidor e o proprio
 * cliente usam esses canais para avisos).
 *
 * @author RagIdle
 */

/**
 * @param {number} filtro - o `filterType` da linha
 * @param {number} cor - o `colorType` da linha (bits de ChatBox.TYPE)
 * @param {{FILTER: object, TYPE: object}} chatBox - as constantes (injetadas, para o teste nao montar o ChatBox)
 * @returns {boolean}
 */
export function falaDeJogador(filtro, cor, chatBox) {
	const { FILTER, TYPE } = chatBox;
	const canaisDeJogador = [FILTER.PUBLIC_CHAT, FILTER.WHISPER, FILTER.PARTY, FILTER.GUILD, FILTER.CLAN];
	if (!canaisDeJogador.includes(filtro)) {
		return false;
	}
	const corDeAviso = TYPE.ANNOUNCE | TYPE.ERROR | TYPE.INFO | TYPE.BLUE;
	return (cor & corDeAviso) === 0;
}
