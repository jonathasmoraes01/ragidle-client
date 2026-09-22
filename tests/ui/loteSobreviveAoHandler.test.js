/**
 * UM HANDLER QUE LANCA NAO LEVA O LOTE JUNTO (F27, auditoria de 22/09/2026).
 *
 * `processarPacotes` fatia o buffer de rede e chama o handler de cada pacote.
 * Sem `try` por pacote, a excecao de UM handler saia do laco: os pacotes que
 * vinham depois no mesmo quadro do WebSocket eram descartados sem ninguem
 * contar, e o `_save_buffer` de um lote partido (so zerado no FIM) era colado
 * na frente do lote seguinte — o fluxo dessincronizava e cada pacote dali em
 * diante era lido do byte errado.
 *
 * Mesmo molde de `reconexaoTransporte.test.js`: socket falso pela fabrica.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('Network/PacketVersions.js', () => ({ default: {} }));
vi.mock('Network/PacketRegister.js', () => ({ default: {} }));
vi.mock('Network/PacketLength.js', () => ({
	default: {
		init() {},
		getPacketLength: id => (id === 0x7771 || id === 0x7772 ? 4 : 0)
	}
}));

const { default: Network } = await import('Network/NetworkManager.js');

function Lanca(fp) {
	this.valor = fp.readUShort();
}
function Conta(fp) {
	this.valor = fp.readUShort();
}
Network.registerPacket(0x7771, Lanca);
Network.registerPacket(0x7772, Conta);

/** Dois bytes de opcode + um u16 de valor. */
function pacote(id, valor) {
	return [id & 0xff, id >> 8, valor & 0xff, valor >> 8];
}
function lote(...bytes) {
	return new Uint8Array(bytes.flat()).buffer;
}

describe('o lote sobrevive a um handler que lanca (F27)', () => {
	let socket;
	let vistos;

	beforeEach(() => {
		vistos = [];
		Network.hookPacket(Lanca, () => {
			throw new Error('handler quebrado');
		});
		Network.hookPacket(Conta, pkt => vistos.push(pkt.valor));
		Network.setSocketFactory(() => ({ connected: true, send() {}, close() {} }));
		socket = Network.connect('127.0.0.1', 5121, () => {}, false);
		socket.onComplete(true);
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		Network.setSocketFactory(null);
		vi.restoreAllMocks();
	});

	it('o pacote DEPOIS do que lancou, no mesmo lote, ainda chega', () => {
		socket.onMessage(lote(pacote(0x7771, 1), pacote(0x7772, 2)));
		expect(vistos).toEqual([2]);
	});

	it('um lote PARTIDO seguido de um handler que lanca nao deixa resto velho para o proximo lote', () => {
		// Metade de um pacote fica guardada; o lote seguinte a completa e traz o
		// que lanca. O terceiro lote tem de ser lido do comeco, e nao colado a
		// um resto que ja foi consumido.
		socket.onMessage(lote([0x72, 0x77]));
		socket.onMessage(lote([0x05, 0x00], pacote(0x7771, 1)));
		socket.onMessage(lote(pacote(0x7772, 9)));
		expect(vistos).toEqual([5, 9]);
	});
});
