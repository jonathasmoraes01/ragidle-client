/**
 * XSS pelo nome do DONO de uma arma forjada (D-1308).
 *
 * `getItemName`, no ramo da arma forjada (`item.slot.card1 === 0x00ff`), montava
 * `<font ...>` + `DB.CNameTable[GID]` + `</font>`, e o nome do dono vem CRU do
 * pacote (`onUpdateOwnerName`: `CNameTable[GID] = pkt.CName`). Esse retorno e
 * injetado via `innerHTML`/`insertAdjacentHTML` por sete janelas (Storage,
 * ItemReform, Laphine) — entao um jogador com um nome `<img onerror=...>` que
 * forjasse/negociasse uma arma rodava JavaScript no navegador de quem visse o
 * item. O conserto escapa o nome num lugar so, na montagem do `<font>`.
 */

import { describe, expect, it } from 'vitest';
import DB from 'DB/DBManager.js';

describe('getItemName — nome do dono de arma forjada', () => {
	it('o nome do dono, cru do pacote, sai como TEXTO e nao como HTML', () => {
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
		expect(nome).not.toContain('<img');
		expect(nome).toContain('&lt;img');

		// O `<font class="owner-<GID>">` legitimo continua sendo montado (o ramo
		// `.owner-<GID>` que atualiza depois usa innerText), com o nome como TEXTO.
		const font = div.querySelector('.owner-' + GID);
		expect(font).not.toBeNull();
		expect(font.textContent).toBe(nomeMalicioso);
	});

	it('um dono com aspas nao escapa de nenhum atributo do <font>', () => {
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
	});
});
