/**
 * As regras SEM DOM do Mapa de Caça redesenhado (D-901, 01/09/2026):
 * `atlasDeCaca.js`. Executa a aritmética — encaixe, medidor, motivo da busca,
 * ordem e formato de chance — em vez de ler o fonte.
 */
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	classeDeRaridade,
	derivarRaridade,
	encaixeDeNivel,
	medidorDeEncaixe,
	motivoDaBusca,
	ordenarMapas,
	raridadeDoDrop,
	resumoDoMotivo,
	rotuloDeRaridade,
	textoDaRecomendacao
} from '../../src/UI/Components/HuntMap/atlasDeCaca.js';

const campo = { mapa: 'prt_fild08', rotulo: 'Campo de Prontera', nivelQueAbre: 1, nivelMinimo: 1, nivelMaximo: 16, nivelMedio: 6.5 };
const cemiterio = { mapa: 'gl_chyard', rotulo: 'Cemitério de Glast Heim', nivelQueAbre: 55, nivelMinimo: 55, nivelMaximo: 70, nivelMedio: 62 };

describe('encaixeDeNivel', () => {
	it('a tranca vem antes de tudo', () => {
		expect(encaixeDeNivel(10, cemiterio).cls).toBe('locked');
		expect(encaixeDeNivel(10, cemiterio).rotulo).toBe('Abre no Nv. 55');
	});
	it('dentro da faixa é ideal; acima é fácil; abaixo (mas aberto) é desafio', () => {
		expect(encaixeDeNivel(10, campo).cls).toBe('ideal');
		expect(encaixeDeNivel(16, campo).cls).toBe('ideal');
		expect(encaixeDeNivel(17, campo).cls).toBe('easy');
		const aberto = { ...cemiterio, nivelQueAbre: 50 };
		expect(encaixeDeNivel(52, aberto).cls).toBe('challenge');
	});
});

describe('medidorDeEncaixe', () => {
	it('o meio da faixa cai no meio da régua', () => {
		const { marcador, dentro } = medidorDeEncaixe(8.5, campo);
		expect(marcador).toBe(50);
		expect(dentro).toBe(true);
	});
	it('as bordas da faixa caem em 25% e 75%', () => {
		expect(medidorDeEncaixe(1, campo).marcador).toBe(25);
		expect(medidorDeEncaixe(16, campo).marcador).toBe(75);
	});
	it('fora da faixa o marcador gruda na ponta e diz que está fora', () => {
		expect(medidorDeEncaixe(99, campo)).toEqual({ marcador: 100, dentro: false });
		expect(medidorDeEncaixe(1, cemiterio)).toEqual({ marcador: 0, dentro: false });
	});
	it('faixa de um nível só não colapsa num ponto', () => {
		const um = { nivelMinimo: 30, nivelMaximo: 30 };
		expect(medidorDeEncaixe(30, um).marcador).toBe(50);
		expect(medidorDeEncaixe(31, um).marcador).toBeGreaterThan(50);
		expect(medidorDeEncaixe(31, um).marcador).toBeLessThan(100);
	});
});

describe('motivoDaBusca', () => {
	const poring = { nome: 'Poring', drops: ['Jellopy', 'Maçã'] };
	const lunatic = { nome: 'Lunatic', drops: [{ nome: 'Cenoura' }, { nome: 'Jellopy' }] };
	it('sem termo, tudo casa e o motivo é vazio', () => {
		expect(motivoDaBusca(campo, [poring], '')).toEqual({ peloNome: true, monstros: [], drops: [] });
	});
	it('não casou = null (é o filtro da lista)', () => {
		expect(motivoDaBusca(campo, [poring, lunatic], 'zumbi')).toBeNull();
	});
	it('casa pelo nome do mapa, do monstro e do drop — nas duas formas de drop (índice e ficha)', () => {
		expect(motivoDaBusca(campo, [poring], 'pront').peloNome).toBe(true);
		expect(motivoDaBusca(campo, [poring, lunatic], 'luna').monstros).toEqual(['Lunatic']);
		expect(motivoDaBusca(campo, [poring, lunatic], 'jell').drops).toEqual([
			{ item: 'Jellopy', monstro: 'Poring' },
			{ item: 'Jellopy', monstro: 'Lunatic' }
		]);
	});
	it('casa pelo nome LOCAL do item (o que o jogador lê) e o devolve no motivo', () => {
		const willow = { nome: 'Willow', drops: [{ nome: 'Tree Root', nomeLocal: 'Raiz de Árvore' }] };
		expect(motivoDaBusca(campo, [willow], 'raiz').drops).toEqual([{ item: 'Raiz de Árvore', monstro: 'Willow' }]);
		expect(motivoDaBusca(campo, [willow], 'tree root').drops).toEqual([{ item: 'Raiz de Árvore', monstro: 'Willow' }]);
		expect(motivoDaBusca(campo, [willow], 'jellopy')).toBeNull();
	});
	it('o resumo diz quem trouxe o mapa e corta em três', () => {
		const motivo = motivoDaBusca(campo, [poring, lunatic], 'jell');
		expect(resumoDoMotivo(motivo)).toBe('Jellopy (Poring) · Jellopy (Lunatic)');
		const muitos = { peloNome: false, monstros: ['A', 'B', 'C', 'D'], drops: [] };
		expect(resumoDoMotivo(muitos)).toBe('A · B · C +1');
		expect(resumoDoMotivo({ peloNome: true, monstros: [], drops: [] })).toBe('');
		expect(resumoDoMotivo(null)).toBe('');
	});
});

describe('ordenarMapas', () => {
	const mapas = [cemiterio, campo, { ...campo, mapa: 'x', rotulo: 'Arredores', nivelQueAbre: 1, nivelMinimo: 1, nivelMedio: 3 }];
	it('por nível: TRANCA crescente (o número do cartão), média desempata, nome por último', () => {
		expect(ordenarMapas(mapas, 'nivel', 1).map(m => m.rotulo)).toEqual([
			'Arredores',
			'Campo de Prontera',
			'Cemitério de Glast Heim'
		]);
	});
	it('a chave é a TRANCA, não o mínimo — mapa com bicho fraco e média alta desce na lista', () => {
		// O caso que criou a regra (pay_fild04): mínimo 1, tranca 17. Ordenado
		// pelo mínimo ele apareceria como "mapa de nível 1" acima de mapas que
		// abrem no 10 — a contradição que o dono viu no print do celular.
		const payonzao = { ...campo, mapa: 'pay', rotulo: 'Payonzão', nivelQueAbre: 17, nivelMinimo: 1, nivelMedio: 17.5, nivelMaximo: 37 };
		const meio = { ...campo, mapa: 'meio', rotulo: 'Meio', nivelQueAbre: 10, nivelMinimo: 10, nivelMedio: 12, nivelMaximo: 14 };
		expect(ordenarMapas([payonzao, meio, campo], 'nivel', 1).map(m => m.rotulo)).toEqual([
			'Campo de Prontera',
			'Meio',
			'Payonzão'
		]);
	});

	it('por nome: alfabética pt-BR', () => {
		expect(ordenarMapas(mapas, 'nome', 1).map(m => m.rotulo)).toEqual([
			'Arredores',
			'Campo de Prontera',
			'Cemitério de Glast Heim'
		]);
	});
	it('para meu nível: o mapa cuja média fica mais perto sobe', () => {
		expect(ordenarMapas(mapas, 'nivel-recomendado', 60)[0]).toBe(cemiterio);
		expect(ordenarMapas(mapas, 'nivel-recomendado', 3)[0].rotulo).toBe('Arredores');
	});
	it('não muda a lista de entrada', () => {
		const copia = mapas.slice();
		ordenarMapas(mapas, 'nome', 1);
		expect(mapas).toEqual(copia);
	});
});

describe('derivarRaridade', () => {
	it('as bordas da escada defensiva (a mesma do servidor): ≤3 Lendário (ordem do dono 08/09), ≤100 Raro, ≤1000 Incomum, senão Comum', () => {
		expect(derivarRaridade(3)).toBe(3); // 0,03% — o teto do Lendário
		expect(derivarRaridade(4)).toBe(2); // 0,04% — o primeiro Raro
		expect(derivarRaridade(5)).toBe(2); // 0,05% — era Lendário até a emenda; o limiar do ANÚNCIO ficou lá
		expect(derivarRaridade(100)).toBe(2);
		expect(derivarRaridade(101)).toBe(1);
		expect(derivarRaridade(1000)).toBe(1);
		expect(derivarRaridade(1001)).toBe(0);
	});
	it('chance ausente não quebra: cai no mesmo caminho de chance zero', () => {
		expect(derivarRaridade(undefined)).toBe(derivarRaridade(0));
	});
});

describe('raridadeDoDrop', () => {
	it('o campo `raridade` do servidor SEMPRE vence — o cliente não recalcula por cima dele', () => {
		// chance 9000 (90%) derivaria Comum pela escada; o servidor manda
		// Lendário explícito, e é isso que tem que aparecer.
		expect(raridadeDoDrop({ chance: 9000, raridade: 3 })).toBe(3);
		expect(raridadeDoDrop({ chance: 1, raridade: 0 })).toBe(0);
	});
	it('sem `raridade` (servidor velho), deriva DEFENSIVAMENTE da chance pela mesma escada', () => {
		expect(raridadeDoDrop({ chance: 3 })).toBe(3);
		expect(raridadeDoDrop({ chance: 1001 })).toBe(0);
	});
	it('`raridade` fora de 0..3 ou não-inteiro é tratado como ausente (defesa contra payload sujo)', () => {
		expect(raridadeDoDrop({ chance: 3, raridade: 4 })).toBe(3);
		expect(raridadeDoDrop({ chance: 3, raridade: -1 })).toBe(3);
		expect(raridadeDoDrop({ chance: 3, raridade: 1.5 })).toBe(3);
		expect(raridadeDoDrop({ chance: 3, raridade: null })).toBe(3);
	});
});

describe('rotuloDeRaridade', () => {
	it('os quatro rótulos exatos, com acento', () => {
		expect(rotuloDeRaridade(0)).toBe('Comum');
		expect(rotuloDeRaridade(1)).toBe('Incomum');
		expect(rotuloDeRaridade(2)).toBe('Raro');
		expect(rotuloDeRaridade(3)).toBe('Lendário');
	});
	it('índice desconhecido cai em Comum, não fica vazio', () => {
		expect(rotuloDeRaridade(undefined)).toBe('Comum');
		expect(rotuloDeRaridade(9)).toBe('Comum');
	});
});

describe('classeDeRaridade', () => {
	it('r0..r3, uma por raridade', () => {
		expect(classeDeRaridade(0)).toBe('r0');
		expect(classeDeRaridade(1)).toBe('r1');
		expect(classeDeRaridade(2)).toBe('r2');
		expect(classeDeRaridade(3)).toBe('r3');
	});
	it('índice desconhecido cai em r0', () => {
		expect(classeDeRaridade(9)).toBe('r0');
	});
});

describe('textoDaRecomendacao (R15/C2-4, 14/09/2026)', () => {
	const ELEMENT_PT_DE_TESTE = { Water: 'Água', Fire: 'Fogo' };

	it('SEM o campo (ausente, ou `null` — "nada passou de 100%" no ajusteElemental do servidor), diz "sem dado" — nunca inventa', () => {
		expect(textoDaRecomendacao(undefined, ELEMENT_PT_DE_TESTE)).toBe('Recomendado: sem dado');
		expect(textoDaRecomendacao(null, ELEMENT_PT_DE_TESTE)).toBe('Recomendado: sem dado');
		expect(textoDaRecomendacao({}, ELEMENT_PT_DE_TESTE)).toBe('Recomendado: sem dado');
	});

	it('com o campo, traduz o elemento e mostra o multiplicador', () => {
		expect(textoDaRecomendacao({ elemento: 'Water', multiplicador: 200 }, ELEMENT_PT_DE_TESTE)).toBe(
			'Recomendado: Água (200%)'
		);
	});

	it('elemento sem entrada no dicionario usa o nome cru, em vez de sumir', () => {
		expect(textoDaRecomendacao({ elemento: 'Poison', multiplicador: 125 }, ELEMENT_PT_DE_TESTE)).toBe(
			'Recomendado: Poison (125%)'
		);
	});

	it('sem dicionario nenhum (chamada crua), ainda funciona com o nome do elemento', () => {
		expect(textoDaRecomendacao({ elemento: 'Fire', multiplicador: 150 })).toBe('Recomendado: Fire (150%)');
	});

	it('multiplicador ausente nao inventa numero — so' + ' o elemento aparece', () => {
		expect(textoDaRecomendacao({ elemento: 'Fire' }, ELEMENT_PT_DE_TESTE)).toBe('Recomendado: Fogo');
	});
});

/**
 * O DESENHO REAL em HuntMap.js (R15/C2-4, destrave de 14/09/2026: o campo
 * `FichaDeMonstro.recomendacao?: { elemento, multiplicador }` agora existe no
 * servidor, derivado de `ajusteElemental`, `null` quando nada passa de 100%).
 *
 * `textoDaRecomendacao` acima é puro e não tem chamador nestes testes — e
 * "módulo puro sem chamador fica verde" é uma armadilha já registrada neste
 * projeto: o CALL SITE em `HuntMap.js` podia regredir (voltar a mostrar
 * hardcoded, trocar `m.recomendacao` por outro campo, sair da guarda da
 * ficha) sem que nenhum caso aqui acusasse, porque nenhum deles importa
 * `HuntMap.js`. `HuntMap.js` puxa Renderer/rede/UIManager/28 subsistemas do
 * MapEngine — importar o módulo inteiro só para isto trocaria um teste barato
 * por uma manutenção cara. Por isso este é um teste de FONTE (o mesmo molde
 * de `tests/ui/estadoEntrePersonagensEMapas.test.js`): lê o arquivo real e
 * confere a FORMA do call site, não a prosa ao redor dela.
 */
describe('renderMobRow (HuntMap.js) liga o campo real, e nao so a funcao pura', () => {
	const NL = String.fromCharCode(10);

	function corpoDeRenderMobRow() {
		const fonte = fs.readFileSync('src/UI/Components/HuntMap/HuntMap.js', 'utf8');
		const inicio = fonte.indexOf('function renderMobRow(');
		expect(inicio, 'renderMobRow sumiu de HuntMap.js').toBeGreaterThan(-1);
		const fim = fonte.indexOf(NL + '}', inicio);
		return fonte.slice(inicio, fim);
	}

	it('chama textoDaRecomendacao com o campo real do monstro (m.recomendacao), nao um valor fixo', () => {
		const corpo = corpoDeRenderMobRow();
		expect(corpo, 'o call site parou de chamar textoDaRecomendacao').toContain(
			'textoDaRecomendacao(m.recomendacao, ELEMENT_PT)'
		);
	});

	it('so desenha a recomendacao QUANDO a ficha real (com raca) ja chegou — sem flash de "sem dado" antes da hora', () => {
		const corpo = corpoDeRenderMobRow();
		const guarda = corpo.indexOf('if (ficha && m.raca)');
		const usoDaFuncao = corpo.indexOf('textoDaRecomendacao(');
		expect(guarda, 'a guarda da ficha sumiu — sem ela a recomendacao pode desenhar antes do raca/elemento chegarem').toBeGreaterThan(-1);
		expect(usoDaFuncao, 'a chamada continua depois da guarda, no mesmo bloco').toBeGreaterThan(guarda);
	});

	it('o texto sai dentro de .hm-chip-recomendacao, escapado (nunca HTML cru do servidor)', () => {
		const corpo = corpoDeRenderMobRow();
		expect(corpo).toContain('class="hm-chip-recomendacao"');
		expect(corpo, 'o texto da recomendacao passou a ir pro HTML sem escapeHtml').toContain(
			'escapeHtml(textoDaRecomendacao('
		);
	});
});

describe('.hm-chip-recomendacao — legibilidade movel (nao trunca com ellipsis como nome/meta)', () => {
	it('usa white-space normal, ao contrario de .hm-chip-name/.hm-chip-meta (nowrap+ellipsis)', () => {
		const css = fs.readFileSync('src/UI/Components/HuntMap/HuntMap.css', 'utf8');
		const inicio = css.indexOf('.hm-chip-recomendacao {');
		expect(inicio, '.hm-chip-recomendacao sumiu do CSS').toBeGreaterThan(-1);
		const bloco = css.slice(inicio, css.indexOf('}', inicio));
		expect(bloco, 'a recomendacao pode voltar a ser cortada com ellipsis num nome de elemento longo').toContain(
			'white-space: normal'
		);
	});
});
