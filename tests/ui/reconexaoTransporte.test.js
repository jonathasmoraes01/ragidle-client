/**
 * O TRANSPORTE que a reconexao automatica precisa (R12, 14/09/2026):
 * `NetworkManager.js` + `SocketHelpers/WebSocket.js`.
 *
 * Tres defeitos que o SENIOR-C apontou antes de qualquer logica de
 * escalonamento fazer sentido:
 *
 *  1. `onClose()` nunca zerava `_socket` — depois de cair, `Network.send()`
 *     virava um no-op CALADO (`if (_socket) socket.send(...)`), nunca um
 *     erro que alguem notasse.
 *  2. Uma tentativa que falha (`onComplete(false)`, so' via `onerror`, antes
 *     de qualquer `onopen`) nunca entrava em `_sockets` nem virava `_socket`
 *     — e nada chamava `.close()` nela: o socket nativo ficava ORFAO.
 *  3. `Network.onDisconnect` nao recebia NADA sobre o motivo do fechamento —
 *     sem o codigo do WebSocket, dá para saber que a conexao caiu, mas nao
 *     dá para distinguir "servidor fora" de "a PONTE recusou por lotacao"
 *     (wsproxy.js, codigo 1013).
 *
 * Este arquivo usa `Network.setSocketFactory` para injetar um socket FALSO
 * — controlado a mao, sem WebSocket de verdade — e prova os tres.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('Network/PacketVersions.js', () => ({ default: {} }));
vi.mock('Network/PacketRegister.js', () => ({ default: {} }));

const { default: Network } = await import('Network/NetworkManager.js');

/** Um socket que so' faz o que o teste manda — os 4 "handlers" ficam visiveis. */
function socketFalso() {
	return {
		connected: false,
		sent: [],
		fechado: false,
		send(buf) {
			this.sent.push(buf);
		},
		close() {
			this.fechado = true;
		}
	};
}

describe('NetworkManager.connect/onClose (o transporte da reconexao)', () => {
	let socketsCriados;

	beforeEach(() => {
		socketsCriados = [];
		Network.setSocketFactory((host, port) => {
			const s = socketFalso();
			s.host = host;
			s.port = port;
			socketsCriados.push(s);
			return s;
		});
		Network.onDisconnect = null;
	});

	afterEach(() => {
		Network.setSocketFactory(null);
		Network.onDisconnect = null;
	});

	it('connect() devolve o socket SINCRONAMENTE — a reconexao precisa dele para abortar uma tentativa pendurada', () => {
		let devolvido;
		const socket = Network.connect('127.0.0.1', 6900, () => {}, false);
		devolvido = socketsCriados[socketsCriados.length - 1];

		expect(socket, 'connect() parou de devolver o socket').toBe(devolvido);
	});

	it('uma tentativa que FALHA fecha o socket explicitamente — sem orfao', () => {
		const socket = Network.connect('127.0.0.1', 6900, () => {}, false);

		expect(socket.fechado, 'o socket fechou antes mesmo de falhar — o teste nao mede nada').toBe(false);

		socket.onComplete(false);

		expect(socket.fechado, 'o socket que falhou ficou orfao (sem .close())').toBe(true);
	});

	it('uma tentativa que TEM SUCESSO nao fecha o proprio socket', () => {
		const socket = Network.connect('127.0.0.1', 6900, () => {}, false);
		socket.connected = true;

		socket.onComplete(true);

		expect(socket.fechado).toBe(false);
	});

	it('depois de cair, onClose() zera _socket — send() vira no-op honesto, nao mentira', () => {
		const socket = Network.connect('127.0.0.1', 6900, () => {}, false);
		socket.connected = true;
		socket.onComplete(true);

		Network.sendPacket({ build: () => ({ buffer: new ArrayBuffer(2), view: new DataView(new ArrayBuffer(2)) }) });
		expect(socket.sent.length, 'o controle: o socket vivo recebeu o pacote').toBe(1);

		socket.onClose();

		Network.sendPacket({ build: () => ({ buffer: new ArrayBuffer(2), view: new DataView(new ArrayBuffer(2)) }) });
		expect(socket.sent.length, 'send() depois do close ainda escreveu no socket morto').toBe(1);
	});

	it('onDisconnect recebe {code, reason} do fechamento — para distinguir a recusa da ponte (1013) de servidor fora', () => {
		const recebidos = [];
		Network.onDisconnect = info => recebidos.push(info);

		const socket = Network.connect('127.0.0.1', 6900, () => {}, false);
		socket.connected = true;
		socket.onComplete(true);
		socket.closeCode = 1013;
		socket.closeReason = 'ponte no limite: teto total';

		socket.onClose();

		expect(recebidos).toHaveLength(1);
		expect(recebidos[0]).toEqual({ code: 1013, reason: 'ponte no limite: teto total' });
	});

	it('onDisconnect ainda funciona sem codigo/razao (fechamento sem esses campos)', () => {
		const recebidos = [];
		Network.onDisconnect = info => recebidos.push(info);

		const socket = Network.connect('127.0.0.1', 6900, () => {}, false);
		socket.connected = true;
		socket.onComplete(true);

		socket.onClose();

		expect(recebidos).toEqual([{ code: null, reason: '' }]);
	});

	it('onDisconnect so dispara para o socket ATUAL — um close() tardio de um socket ja substituido nao conta', () => {
		const recebidos = [];
		Network.onDisconnect = info => recebidos.push(info);

		const antigo = Network.connect('127.0.0.1', 6900, () => {}, false);
		antigo.connected = true;
		antigo.onComplete(true);

		const novo = Network.connect('127.0.0.1', 6900, () => {}, false);
		novo.connected = true;
		novo.onComplete(true);

		// O antigo, ja substituido, fecha atrasado — nao e' mais `_socket`.
		antigo.onClose();

		expect(recebidos, 'o close atrasado do socket velho disparou onDisconnect por engano').toEqual([]);
	});
});
