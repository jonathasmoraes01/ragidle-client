/**
 * A PESQUISA DO PAINEL DE COMANDO (25/09/2026, pedido do dono para o `@who`).
 * A regra e pura; a ligacao na janela e cobrada lendo o fonte.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { filtrarLinhas } from 'UI/Components/PainelComandoIdle/tabelaDoPainel.js';

const LINHAS = [
	{ valores: { nome: 'José Pedro', mapa: 'prontera', nivel: 50 } },
	{ valores: { nome: 'Takeso', mapa: 'pay_fild01', nivel: 32 } },
	{ valores: { nome: 'Ana', mapa: 'prt_fild08', nivel: 12 } }
];

describe('filtrarLinhas', () => {
	it('termo vazio devolve tudo', () => {
		expect(filtrarLinhas(LINHAS, '')).toHaveLength(3);
		expect(filtrarLinhas(LINHAS, '   ')).toHaveLength(3);
	});

	it('acha pelo nome sem caixa e sem acento', () => {
		expect(filtrarLinhas(LINHAS, 'jose').map((l) => l.valores.nome)).toEqual(['José Pedro']);
		expect(filtrarLinhas(LINHAS, 'TAKE').map((l) => l.valores.nome)).toEqual(['Takeso']);
	});

	it('acha por qualquer coluna (mapa, nivel)', () => {
		expect(filtrarLinhas(LINHAS, 'pay_fild').map((l) => l.valores.nome)).toEqual(['Takeso']);
		expect(filtrarLinhas(LINHAS, '12').map((l) => l.valores.nome)).toEqual(['Ana']);
	});

	it('sem nada que case, lista vazia', () => {
		expect(filtrarLinhas(LINHAS, 'zzz')).toEqual([]);
	});
});

describe('a janela usa a pesquisa', () => {
	const JS = readFileSync('src/UI/Components/PainelComandoIdle/PainelComandoIdle.js', 'utf8');
	const HTML = readFileSync('src/UI/Components/PainelComandoIdle/PainelComandoIdle.html', 'utf8');
	it('o campo existe e a tela e o relogio leem as MESMAS linhas pesquisadas', () => {
		expect(HTML).toContain('class="pc-busca"');
		expect(JS).toContain('return filtrarLinhas(ordenarLinhas(painel, ordem), _busca);');
		expect(JS).toContain('const linhas = linhasVisiveis(painel, ordem);');
		expect(JS).toContain('const linhas = linhasVisiveis(painel, ordemVigente());');
	});
});
