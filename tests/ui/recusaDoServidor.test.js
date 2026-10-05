/**
 * O motivo do servidor chega ao aviso da Mochila (04/10/2026, relato do cajado
 * que "nao equipa" sem dizer por que). Ver src/UI/Components/MochilaIdle/recusaDoServidor.js.
 */
import { describe, expect, it } from 'vitest';
import { JANELA_DA_RECUSA_MS, anotarFalaDoSistema, consumirMotivoRecente } from 'UI/Components/MochilaIdle/recusaDoServidor.js';

describe('o motivo do servidor para nao vestir', () => {
	it('a recusa de vestir anotada vira o motivo do pedido', () => {
		anotarFalaDoSistema('Sistema : Nao deu para equipar: a sua classe nao usa este item\0', 1000);
		expect(consumirMotivoRecente(1500)).toBe('a sua classe nao usa este item');
	});
	it('le uma vez so: o segundo pedido nao herda o motivo do primeiro', () => {
		anotarFalaDoSistema('Sistema : Nao deu para equipar: nivel insuficiente', 1000);
		expect(consumirMotivoRecente(1100)).toBe('nivel insuficiente');
		expect(consumirMotivoRecente(1200)).toBeNull();
	});
	it('a recusa velha nao explica o pedido de agora', () => {
		anotarFalaDoSistema('Sistema : Nao deu para equipar: nivel insuficiente', 1000);
		expect(consumirMotivoRecente(1000 + JANELA_DA_RECUSA_MS + 1)).toBeNull();
	});
	it('CONTROLE: outra fala do sistema nao vira motivo', () => {
		consumirMotivoRecente(0);
		anotarFalaDoSistema('Sistema : Voce recebeu 10 zeny', 1000);
		expect(consumirMotivoRecente(1100)).toBeNull();
	});
	it('a recusa com acento tambem casa', () => {
		anotarFalaDoSistema('Sistema : Não deu para equipar: a peça está quebrada', 1000);
		expect(consumirMotivoRecente(1100)).toBe('a peça está quebrada');
	});
});
