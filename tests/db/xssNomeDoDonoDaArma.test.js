/**
 * XSS pelo nome do DONO de uma arma forjada (D-1308).
 *
 * `getItemName`, no ramo da arma forjada (`item.slot.card1 === 0x00ff`), monta
 * o nome com o do ferreiro, e o nome do dono vem CRU do pacote
 * (`onUpdateOwnerName`: `CNameTable[GID] = pkt.CName`). Esse retorno e
 * injetado via `innerHTML`/`insertAdjacentHTML` por algumas janelas (Storage,
 * ItemReform, Laphine), entao um jogador com um nome `<img onerror=...>` que
 * forjasse/negociasse uma arma rodava JavaScript no navegador de quem visse o
 * item.
 *
 * Desde 14/10/2026 (a forja elemental) o dono sai em TEXTO, e nao num `<font>`:
 * outras janelas usam o mesmo nome em `textContent` e mostravam a marcacao crua.
 * A seguranca continua, num lugar so: `donoEmTexto` tira do nome os caracteres
 * de marcacao, e o mesmo texto serve aos dois tipos de janela.
 */

import { describe, expect, it } from 'vitest';
import DB from 'DB/DBManager.js';

describe('getItemName: nome do dono de arma forjada', () => {
	it('o nome do dono, cru do pacote, nao vira HTML em quem usa innerHTML', () => {
		const GID = 123456;
		const nomeMalicioso = '<img src=x onerror="window.__xss_dono = true">';
		DB.CNameTable[GID] = nomeMalicioso;

		const item = {
			ITID: 1201,
			IsIdentified: 1,
			RefiningLevel: 0,
			enchantgrade: 0,
			slot: {
				card1: 0x00ff, // FORGE
				card2: 0,
				card3: GID & 0xffff,
				card4: (GID >> 16) & 0xffff
			}
		};

		const nome = DB.getItemName(item);

		const div = document.createElement('div');
		div.innerHTML = nome;

		expect(div.querySelector('img')).toBeNull();
		expect(div.children).toHaveLength(0);
		expect(nome).not.toContain('<');
		// O nome continua la, legivel, sem os caracteres de marcacao.
		expect(nome).toContain('img src=x onerror=window.__xss_dono = true');
	});

	it('um dono com aspas nao escapa de nenhum atributo', () => {
		const GID = 222333;
		DB.CNameTable[GID] = 'Zed"><img src=x onerror="window.__xss_dono = true">';

		const item = {
			ITID: 1201,
			IsIdentified: 1,
			RefiningLevel: 0,
			enchantgrade: 0,
			slot: { card1: 0x00ff, card2: 0, card3: GID & 0xffff, card4: (GID >> 16) & 0xffff }
		};

		const div = document.createElement('div');
		div.innerHTML = DB.getItemName(item);
		expect(div.querySelector('img')).toBeNull();
		expect(div.textContent).toContain('Zed');
	});

	it('o nome sai igual em textContent e em innerHTML (a dica da Mochila mostrava a marcacao crua)', () => {
		const GID = 150777;
		DB.CNameTable[GID] = 'Ferreira';
		const nome = DB.getItemName({
			ITID: 1101,
			IsIdentified: 1,
			RefiningLevel: 0,
			slot: { card1: 0x00ff, card2: 0, card3: GID & 0xffff, card4: (GID >> 16) & 0xffff }
		});
		const div = document.createElement('div');
		div.innerHTML = nome;
		expect(div.textContent).toBe(nome);
		expect(nome).toContain('Ferreira');
	});
});
