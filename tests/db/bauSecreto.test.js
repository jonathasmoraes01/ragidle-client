/**
 * O BAU SECRETO DO REI PORING (25/09/2026, ordem do dono): as quatro chances
 * ESCRITAS na descricao do item, e a mesma tabela do servidor.
 *
 * Quem decide o premio e o servidor (`PREMIOS_DO_BAU_SECRETO`,
 * `servidor/zona-de-zeny/bau-secreto.ts`). A descricao que o jogador le mora
 * aqui, e o cruzamento abaixo le o fonte do servidor na arvore irma para as
 * duas tabelas nunca divergirem em silencio - uma chance mudada so de um lado
 * seria o jogador lendo uma promessa que o jogo nao cumpre.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DESCRICOES_LOCAIS, NOMES_LOCAIS, PREMIOS_DO_BAU_SECRETO, linhasDasChancesDoBau } from 'DB/Items/nomesLocais.js';

const BAU = 9003003;

describe('a descricao do Bau Secreto diz as chances', () => {
	it('as quatro linhas do dono, na ordem', () => {
		expect(linhasDasChancesDoBau()).toEqual([
			'30.000 zeny: 80%',
			'50.000 zeny: 15%',
			'100.000 zeny: 4,5%',
			'300.000 zeny: 0,5%',
		]);
	});

	it('toda linha de chance aparece na dica da Mochila (o filtro rotulo: valor)', () => {
		const RE_LINHA_FICHA = /^([^:]{1,28}):\s(.+)$/;
		for (const linha of linhasDasChancesDoBau()) expect(linha).toMatch(RE_LINHA_FICHA);
	});

	it('os pesos fecham em 1000', () => {
		expect(PREMIOS_DO_BAU_SECRETO.reduce((s, p) => s + p.peso, 0)).toBe(1000);
	});

	it('a descricao do item traz as quatro linhas e diz que nao vende', () => {
		const texto = DESCRICOES_LOCAIS[BAU];
		expect(NOMES_LOCAIS[BAU]).toBe('Baú Secreto do Rei Poring');
		for (const linha of linhasDasChancesDoBau()) expect(texto).toContain(linha);
		expect(texto).toContain('Não pode ser negociado nem vendido a NPCs.');
		expect(texto).not.toContain('Vale zeny no NPC');
	});

	/*
	 * O fonte do servidor, na arvore irma. `RAG_JOGO` primeiro (o mesmo do
	 * `nomesLocais.test.js`); depois o vizinho do repositorio e, numa WORKTREE
	 * (`.claude/worktrees/<nome>`), o vizinho quatro niveis acima.
	 */
	const FONTE = [
		process.env.RAG_JOGO ? join(process.env.RAG_JOGO, 'servidor', 'zona-de-zeny', 'bau-secreto.ts') : null,
		...['Rag Idle 2.0', 'rag-idle-master'].flatMap(pasta => [
			join(process.cwd(), '..', pasta, 'servidor', 'zona-de-zeny', 'bau-secreto.ts'),
			join(process.cwd(), '..', '..', '..', '..', pasta, 'servidor', 'zona-de-zeny', 'bau-secreto.ts'),
		]),
	]
		.filter(Boolean)
		.find(existsSync);

	it.skipIf(FONTE === undefined)('a tabela daqui e a MESMA do servidor', () => {
		const fonte = readFileSync(FONTE, 'utf8');
		const bloco = /PREMIOS_DO_BAU_SECRETO[^=]*=\s*\[([\s\S]*?)\];/.exec(fonte);
		expect(bloco, 'a tabela sumiu do fonte do servidor - mudou de nome?').not.toBeNull();
		const doServidor = [...bloco[1].matchAll(/\{\s*zeny:\s*([\d_]+),\s*peso:\s*(\d+)\s*\}/g)].map(m => ({
			zeny: Number(m[1].replace(/_/g, '')),
			peso: Number(m[2]),
		}));
		expect(doServidor.length).toBe(4);
		expect(PREMIOS_DO_BAU_SECRETO).toEqual(doServidor);
	});
});
