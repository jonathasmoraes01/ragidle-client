/**
 * AS PAGINAS DAS JANELAS QUE PASSAM DO U16 (07/10/2026, D-2071) - o juntador
 * puro (`Network/juntarPaginas.js`). O servidor que as corta e
 * `servidor/mapa/paginas-da-janela.ts`, no repositorio do jogo.
 */
import { describe, expect, it } from 'vitest';

import { criarJuntadorDePaginas } from 'Network/juntarPaginas.js';

function pagina(parte, partes, grupos, extra = {}) {
	return { v: 1, meu: { grupoId: 7 }, grupos, parte, partes, ...extra };
}

describe('o juntador de paginas', () => {
	it('o corpo sem paginas passa direto, o mesmo objeto', () => {
		const juntar = criarJuntadorDePaginas('grupos');
		const corpo = { v: 1, grupos: [1, 2] };
		expect(juntar(corpo)).toBe(corpo);
		const umaSo = { v: 1, grupos: [1], parte: 1, partes: 1 };
		expect(juntar(umaSo)).toBe(umaSo);
	});

	it('as paginas viram UM corpo so na ultima, sem parte/partes, com a lista inteira na ordem', () => {
		const juntar = criarJuntadorDePaginas('grupos');
		expect(juntar(pagina(1, 3, [1, 2]))).toBeNull();
		expect(juntar(pagina(2, 3, [3]))).toBeNull();
		expect(juntar(pagina(3, 3, [4, 5]))).toEqual({ v: 1, meu: { grupoId: 7 }, grupos: [1, 2, 3, 4, 5] });
	});

	it('a primeira pagina guardada nao e mexida pelas seguintes (copia)', () => {
		const juntar = criarJuntadorDePaginas('grupos');
		const p1 = pagina(1, 2, [1]);
		juntar(p1);
		juntar(pagina(2, 2, [2]));
		expect(p1.grupos).toEqual([1]);
	});

	it('pagina fora de ordem, de outra serie (partes ou rev) ou sem a primeira: descarta, e a proxima serie recomeca', () => {
		const juntar = criarJuntadorDePaginas('skills');
		expect(juntar({ skills: [9], parte: 2, partes: 2, rev: 1 })).toBeNull();
		juntar({ skills: [1], parte: 1, partes: 3, rev: 5 });
		expect(juntar({ skills: [3], parte: 3, partes: 3, rev: 5 })).toBeNull();
		expect(juntar({ skills: [2], parte: 2, partes: 3, rev: 5 })).toBeNull();
		juntar({ skills: [1], parte: 1, partes: 2, rev: 6 });
		expect(juntar({ skills: [2], parte: 2, partes: 2, rev: 7 })).toBeNull();
		juntar({ skills: [1], parte: 1, partes: 2, rev: 8 });
		expect(juntar({ skills: [2], parte: 2, partes: 3, rev: 8 })).toBeNull();
		// A serie misturada foi descartada: a 3a pagina dela nao fecha nada.
		expect(juntar({ skills: [3], parte: 3, partes: 3, rev: 8 })).toBeNull();
		// Uma serie nova e inteira fecha normalmente.
		juntar({ skills: [1], parte: 1, partes: 2, rev: 9 });
		expect(juntar({ skills: [2], parte: 2, partes: 2, rev: 9 })).toEqual({ skills: [1, 2], rev: 9 });
	});

	it('um corpo sem paginas no meio de uma serie a descarta (o servidor recomecou)', () => {
		const juntar = criarJuntadorDePaginas('grupos');
		juntar(pagina(1, 2, [1]));
		expect(juntar({ v: 1, grupos: [5] })).toEqual({ v: 1, grupos: [5] });
		expect(juntar(pagina(2, 2, [2]))).toBeNull();
	});

	it('fatia que nao e lista conta como vazia', () => {
		const juntar = criarJuntadorDePaginas('grupos');
		juntar(pagina(1, 2, null));
		expect(juntar(pagina(2, 2, [3])).grupos).toEqual([3]);
	});
});
