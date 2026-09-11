/**
 * Engine/MapEngine/PrivateMessage.js
 *
 * Manage Entity based on received packets from server
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import DB from 'DB/DBManager.js';
import Friends from 'Engine/MapEngine/Friends.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import ChatBox from 'UI/Components/ChatBox/ChatBox.js';
import { renderFalaSegura, spanDeNickname, escaparHtml } from 'UI/Components/ChatBox/textoSeguroDoChat.js'; // D-1308: nome/corpo de sussurro sao de outro jogador (XSS)
import WhisperBox from 'UI/Components/WhisperBox/WhisperBox.js';
import Session from 'Engine/SessionStorage.js';
import PACKETVER from 'Network/PacketVerManager.js';

/**
 * Check if WhisperBox should be used for a specific nickname
 *
 * @param {string} nickname
 * @returns {boolean}
 */
function getShouldOpenWhisperBox(nickname) {
	if (PACKETVER.value < 20090617) {
		return false;
	}

	if (WhisperBox.instances[nickname]) {
		return true;
	}

	const prefs = WhisperBox.preferences;

	const isFriend = Friends.isFriend(nickname);
	return (isFriend && prefs.open1to1Friend) || (!isFriend && prefs.open1to1Stranger);
}

/**
 * Main Player received PM
 *
 * @param {object} pkt - PACKET.ZC.WHISPER
 */
function onPrivateMessage(pkt) {
	const isFriend = Friends.isFriend(pkt.sender);
	const prefix = isFriend ? DB.getMessage(102) : 'From';
	const msg = pkt.msg.replace(/\|\d{2}/, '');

	// Use WhisperBox if open or allowed by settings (version dependent)
	if (getShouldOpenWhisperBox(pkt.sender)) {
		WhisperBox.addText(pkt.sender, pkt.sender + ' : ' + msg, '#b5deef');
		ChatBox.saveNickName(pkt.sender);
		return;
	}

	// Fallback to main ChatBox
	//
	// D-1308: o nome do remetente (`pkt.sender`) e o corpo (`msg`) vem CRUS de
	// outro jogador. Monta o apelido clicavel a partir do NOME (spanDeNickname
	// escapa no atributo `data-nickname` E no texto) e escapa o corpo, expandindo
	// link de item com seguranca. So entao passa override=true — o HTML foi
	// montado aqui, nao veio do texto do jogador.
	ChatBox.addText(
		'[ ' +
			escaparHtml(prefix) +
			' ' +
			spanDeNickname(pkt.sender) +
			' ] : ' +
			renderFalaSegura(msg, segmento => escaparHtml(segmento), { cor: '#FFFF63', cursor: true }),
		ChatBox.TYPE.PRIVATE,
		ChatBox.FILTER.WHISPER,
		null,
		true
	);
	ChatBox.saveNickName(pkt.sender);
}

/**
 * Received data from a sent private message
 *
 * @param {object} pkt - PACKET.ZC.ACK_WHISPER
 */
function onPrivateMessageSent(pkt) {
	const user = ChatBox.PrivateMessageStorage.nick;
	const msg = ChatBox.PrivateMessageStorage.msg;

	if (pkt.result === 0) {
		if (user && msg) {
			if (getShouldOpenWhisperBox(user)) {
				WhisperBox.addText(user, Session.Entity.display.name + ' : ' + msg, '#ffff00');
			} else {
				// D-1308: mesmo cuidado do recebimento — apelido montado do NOME,
				// corpo escapado, override so depois de montado com seguranca aqui.
				ChatBox.addText(
					'[ To ' +
						spanDeNickname(user) +
						' ] : ' +
						renderFalaSegura(msg, segmento => escaparHtml(segmento), { cor: '#FFFF63', cursor: true }),
					ChatBox.TYPE.PRIVATE,
					ChatBox.FILTER.WHISPER,
					null,
					true
				);
			}
		}
	} else {
		const errorMsg = '(' + user + ') : ' + DB.getMessage(147 + pkt.result);
		ChatBox.addText(errorMsg, ChatBox.TYPE.PRIVATE, ChatBox.FILTER.WHISPER);
	}

	ChatBox.PrivateMessageStorage.nick = '';
	ChatBox.PrivateMessageStorage.msg = '';
}

/**
 * Initialize
 */
export default function PrivateMessageEngine() {
	Network.hookPacket(PACKET.ZC.WHISPER, onPrivateMessage);
	Network.hookPacket(PACKET.ZC.WHISPER2, onPrivateMessage);
	Network.hookPacket(PACKET.ZC.ACK_WHISPER, onPrivateMessageSent);
	Network.hookPacket(PACKET.ZC.ACK_WHISPER2, onPrivateMessageSent);

	// Hook WhisperBox outbound messages
	WhisperBox.onRequestTalk = function (nickname, text) {
		const pkt = new PACKET.CZ.WHISPER();
		pkt.receiver = nickname;
		pkt.msg = text;
		Network.sendPacket(pkt);

		// Save temporarily to handle ACK
		ChatBox.PrivateMessageStorage.nick = nickname;
		ChatBox.PrivateMessageStorage.msg = text;
	};
}
