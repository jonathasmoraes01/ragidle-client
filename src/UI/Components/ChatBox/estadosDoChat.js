/**
 * UI/Components/ChatBox/estadosDoChat.js
 *
 * O CICLO DO CHEVRON DO CHAT, e a marca do chat minimizado no documento.
 *
 * O chat tem tres estados (ChatBox.js, "OS TRES ESTADOS"): aberto -> recolhido (so a barra de digitar) ->
 * minimizado (so o disco). Na HUD mobile premium o dono pediu DOIS (15/10/2026): *"o chat por padrao vem
 * minimizado e o player clica para abrir e minimizar com 1 click"*. Com tres, fechar o chat aberto custava dois
 * toques, e o do meio deixava a barra de digitar ocupando o rodape.
 *
 * Puro, sem DOM, para o teste alcancar.
 *
 * This file is part of the ragidle fork of ROBrowser.
 */

/** Os tres estados, na ordem do chevron. */
export const ESTADOS_DO_CHAT = Object.freeze(['aberto', 'recolhido', 'minimizado']);

/**
 * A marca no `<html>` do documento do jogo enquanto o chat esta minimizado: os buffs da HUD premium leem dela
 * para descer ao lado do disco (`documento.css`). Fora da premium nenhum CSS a le.
 */
export const MARCA_CHAT_MINIMIZADO = 'ri-chat-minimizado';

/**
 * O proximo estado do chevron.
 *
 * @param {string} estado o de agora
 * @param {boolean} doisEstados true na HUD premium: aberto <-> minimizado, um toque cada
 * @returns {string}
 */
export function proximoEstadoDoChat(estado, doisEstados) {
	if (doisEstados) {
		return estado === 'aberto' ? 'minimizado' : 'aberto';
	}
	const i = ESTADOS_DO_CHAT.indexOf(estado);
	return ESTADOS_DO_CHAT[(i < 0 ? 0 : i + 1) % ESTADOS_DO_CHAT.length];
}
