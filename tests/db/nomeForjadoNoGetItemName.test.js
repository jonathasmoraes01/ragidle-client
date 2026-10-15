/**
 * O SUFIXO DA ARMA FORJADA ENTRA DEPOIS DO NOME DO ITEM (14/10/2026).
 *
 * Nos testes o `msgstringtable` nao esta carregado, e a montagem em
 * portugues (que depende das mensagens) nao aparece por `getItemName` sozinho.
 * Este arquivo troca `partesDoNomeForjado` por um dublê que devolve um sufixo
 * fixo e mede a COSTURA: o `getItemName` poe o prefixo antes e o sufixo depois
 * do nome do item, e nao no lugar do prefixo de cartas.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('DB/Items/nomeDaArmaForjada.js', () => ({
	partesDoNomeForjado: () => ({ prefixo: '[ANTES] ', sufixo: ' [DEPOIS]' }),
	donoEmTexto: nome => nome
}));

const { default: DB } = await import('DB/DBManager.js');

describe('getItemName costura as duas partes da arma forjada', () => {
	it('o prefixo antes e o sufixo depois do nome do item', () => {
		const GID = 150001;
		DB.CNameTable[GID] = 'Ferreiro';
		const nome = DB.getItemName({
			ITID: 1101,
			IsIdentified: 1,
			RefiningLevel: 3,
			slot: { card1: 0x00ff, card2: 0, card3: GID & 0xffff, card4: (GID >> 16) & 0xffff }
		});
		const nomeDoItem = DB.getItemInfo(1101).identifiedDisplayName;
		expect(nome).toBe('+3 [ANTES] ' + nomeDoItem + ' [DEPOIS]');
	});

	it('a peca comum nao ganha sufixo nenhum', () => {
		const nome = DB.getItemName({ ITID: 1101, IsIdentified: 1, RefiningLevel: 0, slot: { card1: 0, card2: 0, card3: 0, card4: 0 } });
		expect(nome).not.toContain('[DEPOIS]');
	});
});
