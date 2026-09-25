/**
 * A secao "Gerais" da janela de Status e as secoes recolhiveis
 * (src/UI/Components/StatusIdle/geraisDaFicha.js, 25/09/2026).
 *
 * O exemplo abaixo tem a FORMA que `servidor/ficha-gerais.ts` (repo do
 * servidor) produz; os numeros sao os dos casos escritos a mao la.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
	SECOES_RECOLHIVEIS,
	alternarSecao,
	estaRecolhida,
	formatarNumero,
	lerRecolhidas,
	linhasParaDesenhar,
	textoDoCodex
} from '../../src/UI/Components/StatusIdle/geraisDaFicha.js';

const GERAIS = [
	{
		chave: 'regenHp',
		unidade: 'porSegundo',
		valor: 2.17,
		codex: 0.67,
		codexPorcento: 60,
		canais: [
			{ fonte: 'natural', quantidade: 7, intervaloMs: 6000 },
			{ fonte: 'habilidade', quantidade: 10, intervaloMs: 10000 }
		]
	},
	{ chave: 'danoFisico', unidade: 'porcento', valor: 0.5, codex: 0.5 },
	{ chave: 'danoMagico', unidade: 'porcento', valor: 10.55, codex: 0.5 },
	{ chave: 'hpMaximo', unidade: 'pontos', valor: 5230, codex: 26, codexPorcento: 0.5 },
	{ chave: 'ataquesPorSegundo', unidade: 'porSegundo', valor: 1.43, codex: 0, codexPorcento: 0.2 },
	{ chave: 'esquivaPerfeita', unidade: 'porcento', valor: 2.5, codex: 0 },
	{ chave: 'custoDeSp', unidade: 'porcento', valor: 85, codex: 0 },
	{ chave: 'spMaximo', unidade: 'pontos', valor: 300, codex: 0, codexPorcento: 0 }
];

function porChave(linhas) {
	return Object.fromEntries(linhas.map(l => [l.chave, l]));
}

describe('formatarNumero', () => {
	it('pt-BR com no maximo duas casas e sem zero pendurado', () => {
		expect(formatarNumero(2.17)).toBe('2,17');
		expect(formatarNumero(0.5)).toBe('0,5');
		expect(formatarNumero(10)).toBe('10');
		expect(formatarNumero(5230)).toBe('5.230');
		expect(formatarNumero(1234567.5)).toBe('1.234.567,5');
		expect(formatarNumero(-3)).toBe('-3');
		// o lixo de ponto flutuante nao chega na tela
		expect(formatarNumero(0.1 + 0.2)).toBe('0,3');
	});
});

describe('linhasParaDesenhar', () => {
	const l = porChave(linhasParaDesenhar(GERAIS));

	it('o valor sai com a unidade, e com sinal so onde e acrescimo', () => {
		expect(l.regenHp).toMatchObject({ rotulo: 'Recuperação de HP', valor: '2,17/s' });
		expect(l.danoFisico.valor).toBe('+0,5%');
		expect(l.danoMagico).toMatchObject({ rotulo: 'Dano mágico', valor: '+10,55%' });
		expect(l.hpMaximo.valor).toBe('5.230');
		// taxas absolutas: sem "+"
		expect(l.esquivaPerfeita.valor).toBe('2,5%');
		expect(l.custoDeSp.valor).toBe('85%');
	});

	it('a parte do Codex: valor, e o percentual do motor entre parenteses', () => {
		expect(l.regenHp.codex).toBe('Codex +0,67/s (+60%)');
		expect(l.hpMaximo.codex).toBe('Codex +26 (+0,5%)');
		expect(l.danoFisico.codex).toBe('Codex +0,5%');
		// o Codex aplica 0,2% mas a diferenca em golpes/s nao chega a 0,01
		expect(l.ataquesPorSegundo.codex).toBe('Codex +0,2%');
		// sem Codex: nada, e nunca "Codex +0"
		expect(l.esquivaPerfeita.codex).toBe('');
		expect(l.spMaximo.codex).toBe('');
	});

	it('o title explica os canais de recuperacao', () => {
		expect(l.regenHp.titulo).toContain('Natural: 7 HP a cada 6 s');
		expect(l.regenHp.titulo).toContain('Habilidade: 10 HP a cada 10 s');
	});

	it('Codex que o servidor nao mediu (null) nao vira "Codex +0", e o title diz', () => {
		const [linha] = linhasParaDesenhar([{ chave: 'hpMaximo', unidade: 'pontos', valor: 900, codex: null, codexPorcento: 10 }]);
		expect(linha.codex).toBe('');
		expect(linha.titulo).toContain('Não foi possível medir a parte do Codex');
		expect(textoDoCodex({ unidade: 'pontos', codex: null, codexPorcento: 10 })).toBe('');
	});

	it('servidor sem a secao: null (o card some), e nao lista vazia', () => {
		expect(linhasParaDesenhar(undefined)).toBeNull();
		expect(linhasParaDesenhar(null)).toBeNull();
		expect(linhasParaDesenhar({})).toBeNull();
		expect(linhasParaDesenhar([])).toEqual([]);
	});

	it('chave desconhecida ou linha estragada sai SOZINHA, sem derrubar as outras', () => {
		const r = linhasParaDesenhar([
			{ chave: 'eixoDoFuturo', unidade: 'porcento', valor: 3, codex: 0 },
			{ chave: 'toString', unidade: 'porcento', valor: 3, codex: 0 },
			{ chave: 'danoFisico', unidade: 'furlongs', valor: 3, codex: 0 },
			{ chave: 'danoFisico', unidade: 'porcento', valor: 'muito', codex: 0 },
			null,
			{ chave: 'reducaoMagica', unidade: 'porcento', valor: 2.5, codex: 2.5 }
		]);
		expect(r.map(x => x.chave)).toEqual(['reducaoMagica']);
		expect(r[0].valor).toBe('+2,5%');
	});

	it('a ordem e a do servidor', () => {
		expect(linhasParaDesenhar(GERAIS).map(x => x.chave)).toEqual(GERAIS.map(x => x.chave));
	});
});

describe('as secoes recolhidas', () => {
	it('sao tres, e "Personagem" nao esta entre elas', () => {
		expect(SECOES_RECOLHIVEIS).toEqual(['atributos', 'estatisticas', 'gerais']);
	});

	it('lerRecolhidas limpa o que veio do armazenamento', () => {
		expect(lerRecolhidas(undefined)).toEqual([]);
		expect(lerRecolhidas('gerais')).toEqual([]);
		expect(lerRecolhidas(['gerais', 'personagem', 'gerais', 'atributos'])).toEqual(['atributos', 'gerais']);
	});

	it('alternar recolhe a aberta e abre a recolhida', () => {
		const uma = alternarSecao([], 'gerais');
		expect(uma).toEqual(['gerais']);
		expect(estaRecolhida(uma, 'gerais')).toBe(true);
		expect(estaRecolhida(uma, 'atributos')).toBe(false);
		const duas = alternarSecao(uma, 'atributos');
		expect(duas).toEqual(['atributos', 'gerais']);
		expect(alternarSecao(duas, 'gerais')).toEqual(['atributos']);
	});

	it('secao desconhecida nao muda nada', () => {
		expect(alternarSecao(['gerais'], 'personagem')).toEqual(['gerais']);
	});

	it('nao muta a lista recebida (a Preferences guarda a referencia)', () => {
		const antes = ['gerais'];
		alternarSecao(antes, 'atributos');
		expect(antes).toEqual(['gerais']);
	});
});

/*
 * O HTML E O JS TEM DE CONCORDAR com a lista de secoes. Le o fonte, mas cobra
 * uma PROPRIEDADE (cada secao recolhivel tem card, titulo-botao e corpo com o
 * id que o aria-controls aponta) e nao a forma de uma linha.
 */
describe('o markup da janela', () => {
	const HTML = readFileSync('src/UI/Components/StatusIdle/StatusIdle.html', 'utf8');

	it.each(SECOES_RECOLHIVEIS)('a secao %s tem card, botao com aria e corpo', secao => {
		expect(HTML).toContain(`data-secao="${secao}"`);
		expect(HTML).toContain(`aria-controls="st-secao-${secao}"`);
		expect(HTML).toContain(`id="st-secao-${secao}"`);
	});

	it('o titulo e um <button> (teclado e toque de graca)', () => {
		const botoes = HTML.match(/<button type="button" class="st-card-title st-card-toggle" aria-expanded="true"/g) || [];
		expect(botoes).toHaveLength(SECOES_RECOLHIVEIS.length);
	});

	it('o card "Gerais" nasce escondido ate o servidor mandar a secao', () => {
		expect(HTML).toMatch(/class="st-card ri-card st-card--gerais" data-secao="gerais" hidden/);
	});
});
