/** As ultimas N de cada canal (F31, auditoria de 22/09/2026). */
import { describe, expect, it } from 'vitest';
import { podarPorCanal } from 'UI/Components/ChatBox/podarPorCanal.js';

const msg = (canal, n) => ({ canal, n });
const canalDe = m => m.canal;

describe('podarPorCanal', () => {
	it('mantem as ULTIMAS de cada canal, na ordem de chegada', () => {
		const lista = [msg('farm', 1), msg('farm', 2), msg('global', 1), msg('farm', 3)];
		expect(podarPorCanal(lista, canalDe, 2)).toEqual([msg('farm', 2), msg('global', 1), msg('farm', 3)]);
	});

	it('o canal barulhento nao expulsa o sussurro solitario', () => {
		const lista = [msg('sussurro', 1), ...Array.from({ length: 5000 }, (_, i) => msg('farm', i))];
		const podada = podarPorCanal(lista, canalDe, 400);
		expect(podada).toHaveLength(401);
		expect(podada[0]).toEqual(msg('sussurro', 1));
	});

	it('abaixo do teto nada sai', () => {
		const lista = [msg('a', 1), msg('b', 1)];
		expect(podarPorCanal(lista, canalDe, 400)).toEqual(lista);
	});
});

describe('o ChatBox poda o buffer (F31)', () => {
	it('no push, quando passa do dobro do teto, e no flush, antes de desenhar', async () => {
		const { readFileSync } = await import('node:fs');
		const fonte = readFileSync('src/UI/Components/ChatBox/ChatBox.js', 'utf8')
			.replace(/\/\*[\s\S]*?\*\//g, '')
			.replace(/^[ \t]*\/\/.*$/gm, '');
		expect(fonte).toMatch(/if \(_messageBuffer\.length > 2 \* MAX_MSG\) \{\s*_messageBuffer = podarPorCanal\(/);
		expect(fonte).toMatch(/const messages = podarPorCanal\(_messageBuffer,/);
	});
});
