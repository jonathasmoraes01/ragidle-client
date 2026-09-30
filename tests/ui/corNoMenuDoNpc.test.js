/**
 * A COR NUMA OPCAO DO MENU DE NPC NAO SOME NA SELECAO (D-1858, 30/09/2026).
 *
 * O servidor pinta parte de uma opcao com o codigo de cor do RO (`^RRGGBB`):
 * a Praca de EXP mostra "+150% de EXP (sua)" em verde e "+50% de EXP
 * (inferior)" em ambar, ordem do dono (*"que esteja destacado com cor diferente
 * pra ela ver"*). O `setMenu` passa cada opcao por `DB.formatMsgToHtml`, que a
 * vira `<span style="color:#...">` — e a PRIMEIRA opcao ja nasce selecionada,
 * com o fundo azul da aba ativa. Verde e ambar escuros (os que leem no fundo
 * claro) somem nesse azul.
 *
 * O portao prende as duas metades baratas de quebrar: o menu continua
 * passando a opcao pelo formatador de cor, e a linha selecionada poe o span
 * numa pilula clara SEM apagar a cor (a primeira versao devolvia o span ao
 * branco, e o verde nunca aparecia ao abrir: a opcao pintada de verde e a que
 * nasce selecionada - achado da auditoria de 30/09/2026). Le o fonte SEM os comentarios, para nao passar pela
 * propria prosa.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const semComentario = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const CSS = semComentario(readFileSync('src/UI/Components/NpcMenu/NpcMenu.css', 'utf8'));
const JS = semComentario(readFileSync('src/UI/Components/NpcMenu/NpcMenu.js', 'utf8'));

describe('a cor numa opcao do menu de NPC (D-1858)', () => {
	it('o menu pinta o codigo de cor de cada opcao', () => {
		expect(JS).toContain('div.innerHTML = DB.formatMsgToHtml(_escapeHTML(list[i]));');
	});

	it('a opcao selecionada poe o trecho pintado numa pilula clara, sem apagar a cor', () => {
		const regra = CSS.match(/#NpcMenu \.content div\.selected span\s*\{([^}]*)\}/);
		expect(regra, 'a regra do span na linha selecionada sumiu').not.toBeNull();
		const corpo = regra[1].replace(/\s+/g, ' ');
		expect(corpo).toContain('background: var(--white);');
		// A cor do servidor tem de sobreviver: a primeira opcao nasce selecionada.
		expect(corpo).not.toMatch(/(^|[^-])color\s*:/);
	});
});
