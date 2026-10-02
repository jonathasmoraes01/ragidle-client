/**
 * O TRADUTOR NA BORDA (D-1929, 01/10/2026 — o jogo em ingles).
 *
 * O catalogo aqui e um fixture pequeno, escrito para cada regra do contrato
 * (`docs/PLANO-IDIOMA-INGLES.md` do repositorio do jogo, secao 3.2): exato,
 * modelo com lacuna traduzida de novo, lacuna `cru`, numero no formato
 * brasileiro, segmentos tudo-ou-nada, e o texto intacto quando falta.
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
	absorverCatalogo,
	carregarCatalogo,
	compilarModelo,
	desligarTraducao,
	faltasDeTraducao,
	normalizar,
	numeroParaIngles,
	traducaoLigada,
	traduzir
} from 'Core/Traducao.js';

const CATALOGO = {
	v: 1,
	exatos: {
		'Agora nao': 'Not now',
		'Poção Vermelha': 'Red Potion',
		Carta: 'Card',
		'Carta Poring': 'Poring Card',
		Prontera: 'Prontera',
		'Campo de Prontera (Rockers)': 'Prontera Field (Rockers)',
		missões: 'missions',
		Nível: 'Level',
		Peso: 'Weight',
		'Você não pode fazer isso agora.': 'You cannot do that right now.'
	},
	modelos: [
		{ pt: '{0} conseguiu {1} de {2}', en: '{0} got {1} from {2}', cru: [0] },
		{ pt: 'Você recebeu {0}x {1}.', en: 'You received {0}x {1}.' },
		{ pt: 'Custa {0} zeny', en: 'Costs {0} zeny' },
		{ pt: '{0} (Vento)', en: '{0} (Wind)' }
	]
};

afterEach(() => {
	desligarTraducao();
});

describe('desligado (portugues, o padrao)', () => {
	it('devolve o MESMO texto, sem catalogo', () => {
		expect(traducaoLigada()).toBe(false);
		expect(traduzir('Agora nao')).toBe('Agora nao');
	});
});

describe('normalizar (o contrato, secao 3.2)', () => {
	it('junta todo espaco (quebra de linha, tab, espaco duro) num so e tira as pontas', () => {
		expect(normalizar('  Agora\n\tnao  ')).toBe('Agora nao');
		expect(normalizar('Ação!')).toBe('Ação!');
	});
});

describe('exato', () => {
	it('traduz o texto normalizado e PRESERVA o espacamento das pontas', () => {
		absorverCatalogo(CATALOGO);
		expect(traduzir('Agora nao')).toBe('Not now');
		expect(traduzir('  Agora\n nao ')).toBe('  Not now ');
	});

	it('texto sem letra nao e tocado, menos o numero brasileiro sozinho (RO Cash pronto do servidor)', () => {
		absorverCatalogo(CATALOGO);
		expect(traduzir('123 / 456')).toBe('123 / 456');
		expect(traduzir(' 4.985,00 ')).toBe(' 4,985.00 ');
		expect(traduzir('15')).toBe('15');
	});
});

describe('modelo', () => {
	it('preenche as lacunas, traduz de novo as nao-cru e deixa o nome do jogador cru', () => {
		absorverCatalogo(CATALOGO);
		expect(traduzir('Carta conseguiu Poção Vermelha de Prontera')).toBe('Carta got Red Potion from Prontera');
	});

	it('lacuna que tambem casa outro modelo e traduzida por ele (nome distinto do monstro)', () => {
		absorverCatalogo({ ...CATALOGO, exatos: { ...CATALOGO.exatos, Goblin: 'Goblin' } });
		expect(traduzir('Fulano conseguiu Poção Vermelha de Goblin (Vento)')).toBe('Fulano got Red Potion from Goblin (Wind)');
	});

	it('numero brasileiro dentro da lacuna vira ingles', () => {
		absorverCatalogo(CATALOGO);
		expect(traduzir('Custa 1.500 zeny')).toBe('Costs 1,500 zeny');
		expect(traduzir('Você recebeu 3x Poção Vermelha.')).toBe('You received 3x Red Potion.');
	});

	it('lacuna sem traducao fica como veio (o resto da frase traduz)', () => {
		absorverCatalogo(CATALOGO);
		expect(traduzir('Você recebeu 2x Coisa Nova.')).toBe('You received 2x Coisa Nova.');
	});

	it('o modelo de MAIS letras fora das lacunas vence', () => {
		absorverCatalogo({
			v: 1,
			exatos: {},
			modelos: [
				{ pt: '{0} de {1} zeny', en: 'GENERICO' },
				{ pt: 'Custa {0} zeny', en: 'Costs {0} zeny' }
			]
		});
		expect(traduzir('Custa 10 zeny')).toBe('Costs 10 zeny');
	});
});

describe('compilarModelo recusa o malformado (a falha e alta)', () => {
	it('lacuna no ingles que nao existe no portugues', () => {
		expect(() => compilarModelo({ pt: 'Custa {0} zeny', en: 'Costs {1}' })).toThrow(/\{1\}/);
	});
	it('modelo sem lacuna', () => {
		expect(() => compilarModelo({ pt: 'Agora nao', en: 'Not now' })).toThrow(/sem lacuna/);
	});
	it('menos de 4 letras fora das lacunas e composicao', () => {
		expect(() => compilarModelo({ pt: '{0} x {1}', en: '{0} x {1}' })).toThrow(/composicao/);
	});
});

describe('numeroParaIngles', () => {
	it('troca so o que e numero brasileiro sem duvida', () => {
		expect(numeroParaIngles('1.234,5')).toBe('1,234.5');
		expect(numeroParaIngles('2,5')).toBe('2.5');
		expect(numeroParaIngles('1.500')).toBe('1,500');
		expect(numeroParaIngles('1.5')).toBeNull();
		expect(numeroParaIngles('15')).toBeNull();
	});
});

describe('segmentos (tudo ou nada)', () => {
	it('numero e separador ficam, cada pedaco com letra traduz exato', () => {
		absorverCatalogo(CATALOGO);
		expect(traduzir('3 missões')).toBe('3 missions');
		expect(traduzir('Nível 10 · Prontera')).toBe('Level 10 · Prontera');
		expect(traduzir('Peso: 1.250')).toBe('Weight: 1,250');
	});

	it('um pedaco sem traducao = o texto inteiro intacto, e anotado como falta', () => {
		absorverCatalogo(CATALOGO);
		expect(traduzir('3 coisas novas')).toBe('3 coisas novas');
		expect(faltasDeTraducao()).toContain('3 coisas novas');
	});
});

describe('absorverCatalogo', () => {
	it('recusa versao desconhecida', () => {
		expect(() => absorverCatalogo({ v: 2, exatos: {}, modelos: [] })).toThrow(/versao 2/);
		expect(traducaoLigada()).toBe(false);
	});
});

describe('carregarCatalogo', () => {
	it('liga o tradutor com o arquivo publicado', async () => {
		const ligou = await carregarCatalogo('en', () => Promise.resolve({ ok: true, json: () => Promise.resolve(CATALOGO) }));
		expect(ligou).toBe(true);
		expect(traduzir('Agora nao')).toBe('Not now');
	});

	it('sem arquivo, o jogo segue em portugues (e nao lanca)', async () => {
		const ligou = await carregarCatalogo('en', () => Promise.resolve({ ok: false, status: 404 }));
		expect(ligou).toBe(false);
		expect(traduzir('Agora nao')).toBe('Agora nao');
	});

	it('idioma sem catalogo (portugues) nem busca', async () => {
		let buscou = false;
		const ligou = await carregarCatalogo('pt-BR', () => {
			buscou = true;
			return Promise.resolve({ ok: true, json: () => Promise.resolve(CATALOGO) });
		});
		expect(ligou).toBe(false);
		expect(buscou).toBe(false);
	});
});
