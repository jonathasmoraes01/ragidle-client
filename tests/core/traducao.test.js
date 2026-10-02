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

describe('lacunas especiais (achados das frentes de traducao, 01/10/2026)', () => {
	it('lacuna COLADA numa palavra pode sair vazia (o plural "falta{0}")', () => {
		absorverCatalogo({
			v: 1,
			exatos: { nível: 'level' },
			modelos: [{ pt: 'falta{0} {1} {2} de base', en: '{1} more base {2}' }]
		});
		expect(traduzir('falta 1 nível de base')).toBe('1 more base level');
		expect(traduzir('faltam 3 nível de base')).toBe('3 more base level');
	});

	it('lacuna entre espacos continua exigindo conteudo', () => {
		absorverCatalogo({ v: 1, exatos: {}, modelos: [{ pt: 'Custa {0} zeny', en: 'Costs {0} zeny' }] });
		expect(traduzir('Custa  zeny')).toBe('Custa  zeny');
	});

	it('o espaco da ponta da lacuna fica ("o VIP{1}" com " ativo")', () => {
		absorverCatalogo({ v: 1, exatos: { ativo: 'active' }, modelos: [{ pt: 'Com o VIP{0}', en: 'With VIP{0}' }] });
		expect(traduzir('Com o VIP ativo')).toBe('With VIP active');
		expect(traduzir('Com o VIP')).toBe('With VIP');
	});

	it('lacunas coladas ("{0}{1}") sao UM grupo: o valor vai inteiro na primeira', () => {
		absorverCatalogo({
			v: 1,
			exatos: { 'Lobo Selvagem': 'Wild Wolf' },
			modelos: [{ pt: 'Cai de: {0}{1}', en: 'Drops from: {0}{1}' }]
		});
		expect(traduzir('Cai de: Lobo Selvagem')).toBe('Drops from: Wild Wolf');
	});

	it('no empate de letras vence o modelo mais longo', () => {
		absorverCatalogo({
			v: 1,
			exatos: {},
			modelos: [
				{ pt: 'Tamanho: {0}', en: 'CURTO {0}' },
				{ pt: 'Tamanho: {0}. {1}', en: 'Size: {0}. {1}' }
			]
		});
		expect(traduzir('Tamanho: 2x. 3x')).toBe('Size: 2x. 3x');
	});

	it('numero com sinal e porcento tambem vira ingles', () => {
		expect(numeroParaIngles('+0,5%')).toBe('+0.5%');
		expect(numeroParaIngles('-1.250,75')).toBe('-1,250.75');
		expect(numeroParaIngles('12%')).toBeNull();
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

	it('nome proprio igual nos dois idiomas passa intocado se o resto traduziu ("MVP · Baphomet")', () => {
		absorverCatalogo({ ...CATALOGO, exatos: { ...CATALOGO.exatos, há: 'ago', min: 'min' } });
		expect(traduzir('Prontera · Baphomet')).toBe('Prontera · Baphomet');
		expect(traduzir('Orc Warrior · há 5min')).toBe('Orc Warrior · ago 5min');
		// So nome sem nada traduzido: continua falta (nada mudou de verdade).
		expect(traduzir('Orc Warrior · Baphomet')).toBe('Orc Warrior · Baphomet');
	});

	it('pedaco portugues minusculo ou com acento NAO passa por nome proprio', () => {
		absorverCatalogo(CATALOGO);
		expect(traduzir('3 missões · coisa nova')).toBe('3 missões · coisa nova');
		expect(traduzir('Nível 10 · Proteção')).toBe('Nível 10 · Proteção');
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
