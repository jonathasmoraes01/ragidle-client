/**
 * Network/SocketHelpers/WebSocket.js
 *
 * HTML5 WebSocket if the server support the protocole
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

/**
 * HTML5 WebSocket System
 *
 * @param {string} url
 */
function Socket(host, port, proxy) {
	let url = 'ws://' + host + ':' + port + '/';
	const self = this;
	this.connected = false;

	// Use of a proxy
	if (proxy) {
		url = proxy;

		if (!url.match(/\/$/)) {
			url += '/';
		}

		url += host + ':' + port;
	}

	// Open Websocket
	this.ws = new WebSocket(url);
	this.ws.binaryType = 'arraybuffer';

	this.ws.onopen = function OnOpen() {
		self.connected = true;
		self.onComplete(true);
	};

	this.ws.onerror = function OnError() {
		if (!self.connected) {
			self.onComplete(false);
		}
	};

	this.ws.onmessage = function OnMessage(event) {
		self.onMessage(event.data);
	};

	this.ws.onclose = function OnClose(event) {
		self.connected = false;
		/*
		 * R12 (14/09/2026, reconexao automatica): guarda o codigo/razao do
		 * fechamento ANTES de notificar — e' o unico jeito de a camada de cima
		 * (NetworkManager.onClose) distinguir "servidor fora" de "a PONTE
		 * recusou por lotacao" (wsproxy.js fecha com 1013, motivo "ponte no
		 * limite: ..."). `event` pode faltar num `close()` disparado por nos
		 * mesmos (linha abaixo, `this.close()` sem argumento nenhum), entao os
		 * dois campos tem valor de reserva.
		 */
		self.closeCode = event && typeof event.code === 'number' ? event.code : null;
		self.closeReason = event && typeof event.reason === 'string' ? event.reason : '';
		this.close();

		if (self.onClose) {
			self.onClose();
		}
	};
}

/**
 * Sending packet to applet
 *
 * @param {ArrayBuffer} buffer
 */
Socket.prototype.send = function Send(buffer) {
	if (this.connected) {
		this.ws.send(buffer);
	}
};

/**
 * Closing connection to server
 *
 * R12 (14/09/2026): antes so fechava se `this.connected` fosse verdadeiro —
 * uma conexao ainda em CONNECTING (nem aberta nem com erro ainda) passava
 * batido, e e' exatamente o caso que a reconexao automatica precisa
 * encerrar de fora quando uma tentativa fica PENDURADA alem do proprio
 * orcamento de tempo (Network/reconexao.js). `readyState` e' quem manda
 * agora: fecha em CONNECTING (0) e OPEN (1), nunca de novo em CLOSING (2)
 * ou CLOSED (3) — chamar `.close()` num WebSocket ja fechado nao da erro,
 * mas nao ha motivo para o pedido extra.
 */
Socket.prototype.close = function Close() {
	if (this.ws && this.ws.readyState !== 2 && this.ws.readyState !== 3) {
		this.ws.close();
	}
	this.connected = false;
};

/**
 * Export
 */
export default Socket;
