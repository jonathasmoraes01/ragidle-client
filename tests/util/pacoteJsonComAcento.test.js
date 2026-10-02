/**
 * PACOTE JSON COM ACENTO CHEGA INTEIRO AO SERVIDOR (02/10/2026).
 *
 * Nasceu da doacao por PIX: "coloco meu nome completo e meu CPF, mas nao gera
 * o pix" - so para quem tem acento no nome (Joao com til, Conceicao, Araujo
 * com agudo...). O `build()` dos CZ_RAGIDLE com JSON ja reservava o pacote
 * pelos bytes UTF-8 reais, e depois chamava `writeString(this.json)` SEM
 * comprimento - e o `writeString` sem comprimento AUMENTA o buffer de novo
 * pela diferenca bytes - caracteres (o remendo do roBrowser para quem reserva
 * pelo `.length`). A diferenca era contada DUAS vezes: o pacote saia com um
 * zero por byte extra depois do JSON, o `JSON.parse` do servidor lancava, a
 * doacao virava um pedido de estado do RO Shop e a janela esperava 15 s e
 * dizia "O servidor nao respondeu".
 *
 * O portao vale para TODO construtor CZ_RAGIDLE que carrega `json`, e le o
 * pacote como o servidor le: o comprimento do cabecalho, e o corpo inteiro
 * como UTF-8 estrito.
 */
import { describe, expect, it } from 'vitest';
import PACKET from 'Network/PacketStructure.js';

const TEXTO_COM_ACENTO = 'João da Conceição Araújo, ação ç ã é í ô ü ’ 🙂';

/** Os construtores CZ_RAGIDLE cujo corpo e o `json` da instancia. */
function construtoresDeJson() {
	return Object.keys(PACKET.CZ)
		.filter(nome => nome.startsWith('RAGIDLE_'))
		.filter(nome => {
			try {
				return typeof new PACKET.CZ[nome]().json === 'string';
			} catch {
				return false;
			}
		});
}

/** Como o servidor le: comprimento do cabecalho e corpo em UTF-8 estrito. */
function lerComoOServidor(writer) {
	const bytes = new Uint8Array(writer.buffer);
	const comprimento = bytes[2] | (bytes[3] << 8);
	const corpo = bytes.subarray(4, comprimento);
	const texto = new TextDecoder('utf-8', { fatal: true }).decode(corpo);
	return { bytes, comprimento, texto };
}

describe('pacote JSON com acento chega inteiro ao servidor', () => {
	const nomes = construtoresDeJson();

	it('acha os construtores (lista vazia passaria calada)', () => {
		expect(nomes.length).toBeGreaterThanOrEqual(24);
		expect(nomes).toContain('RAGIDLE_ROSHOP');
	});

	it.each(nomes)('%s: comprimento = bytes UTF-8 reais, sem zero no fim, JSON intacto', nome => {
		const pedido = { acao: 'doacao-gerar', quantidade: 10, nome: TEXTO_COM_ACENTO, cpf: '12345678909' };
		const json = JSON.stringify(pedido);
		const esperado = new TextEncoder().encode(json).length;

		const pkt = new PACKET.CZ[nome]();
		pkt.json = json;
		const { bytes, comprimento, texto } = lerComoOServidor(pkt.build());

		expect(comprimento).toBe(4 + esperado);
		expect(bytes.length).toBe(comprimento);
		expect(texto).toBe(json);
		expect(JSON.parse(texto)).toEqual(pedido);
	});

	it('ASCII puro continua igual', () => {
		const pkt = new PACKET.CZ.RAGIDLE_ROSHOP();
		pkt.json = '{"acao":"estado"}';
		const { bytes, comprimento, texto } = lerComoOServidor(pkt.build());
		expect(comprimento).toBe(4 + 17);
		expect(bytes.length).toBe(comprimento);
		expect(texto).toBe('{"acao":"estado"}');
	});
});
