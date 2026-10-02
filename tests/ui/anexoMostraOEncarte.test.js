/**
 * O ANEXO DA CARTA MOSTRA O ENCARTE (02/10/2026).
 *
 * O servidor passou a mandar a UNIDADE inteira no 0x09eb (refino, 4 cartas,
 * runas) porque o Marketplace entrega o item comprado pelo correio. O pacote o
 * cliente ja lia (`PacketStructure.js`: RefiningLevel, slot.card1..4); o que
 * faltava era a janela: o ladrilho mostrava so icone e quantidade, e uma
 * Katana +7 com carta parecia a Katana limpa.
 *
 * O caminho tem dois saltos e este portao mede os dois: a ReadRodex (nativa,
 * escondida) grava o refino e o nome completo no DOM, e o CorreioIdle le esse
 * DOM e desenha "+7" e o `title`. Le o FONTE (sem comentarios), porque as duas
 * janelas montam DOM dentro de closures do UIManager.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const raiz = join(__dirname, '..', '..');
const semComentarios = texto => texto.replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const READ_RODEX = semComentarios(readFileSync(join(raiz, 'src/UI/Components/Rodex/ReadRodex.js'), 'utf8'));
const CORREIO = semComentarios(readFileSync(join(raiz, 'src/UI/Components/CorreioIdle/CorreioIdle.js'), 'utf8'));
const CSS = readFileSync(join(raiz, 'src/UI/Components/CorreioIdle/CorreioIdle.css'), 'utf8');

describe('a ReadRodex grava o encarte do anexo no DOM', () => {
	it('o refino vem do RefiningLevel do pacote', () => {
		expect(READ_RODEX).toContain("tile.setAttribute('data-refino', String(Number(item.RefiningLevel) || 0));");
	});

	it('o nome completo vem do getItemName (refino e cartas), sem HTML, no title', () => {
		expect(READ_RODEX).toContain("tile.title = String(DB.getItemName(item) || '').replace(/<[^>]*>/g, '');");
	});
});

describe('o CorreioIdle mostra o que a ReadRodex gravou', () => {
	it('le o refino e o nome de cada ladrilho', () => {
		expect(CORREIO).toContain("refino: Number(el.getAttribute('data-refino')) || 0,");
		expect(CORREIO).toContain("nome: el.title || ''");
	});

	it('desenha "+N" so quando ha refino, e o nome no title', () => {
		expect(CORREIO).toContain('if (item.refino > 0) {');
		expect(CORREIO).toContain("refino.textContent = '+' + item.refino;");
		expect(CORREIO).toContain('tile.title = item.nome;');
		expect(CSS).toContain('.co-anexo-item-refino {');
	});
});
