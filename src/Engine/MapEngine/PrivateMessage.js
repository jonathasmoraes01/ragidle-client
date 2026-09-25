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
import { bitsDaMarca, comMarcaNoNome, marcaDaFala, nomeNaLista } from 'UI/Components/ChatBox/marcaNoNome.js'; // RAGIDLE (25/09/2026): as marcas de GM e de VIP no sussurro recebido
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
	//
	// As marcas de GM e de VIP (25/09/2026): o sussurro so traz o NOME de quem
	// mandou, e o servidor manda os nomes dos admins e dos VIPs no 0x0fd0 por
	// isso (marcaNoNome.js). O GM vence.
	const marca = marcaDaFala(nomeNaLista(pkt.sender, Session.AdminNomes), nomeNaLista(pkt.sender, Session.VipNomes));
	ChatBox.addText(
		'[ ' +
			escaparHtml(prefix) +
			' ' +
			comMarcaNoNome(spanDeNickname(pkt.sender), marca) +
			' ] : ' +
			renderFalaSegura(msg, segmento => escaparHtml(segmento), { cor: '#FFFF63', cursor: true }),
		// Os bits da marca vao junto para a linha inteira ganhar a cor do nome,
		// como na fala global (classeDaLinha, 25/09/2026).
		ChatBox.TYPE.PRIVATE | bitsDaMarca(marca, ChatBox.TYPE),
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
