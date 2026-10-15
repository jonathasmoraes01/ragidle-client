import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
	RESULTADO_DA_PRODUCAO,
	avisarResultadoDaProducao,
	producaoSaiu,
	textoDoResultadoDaProducao
} from '../../src/Engine/MapEngine/resultadoDaProducao.js';

/*
 * A ANIMACAO E A LINHA DA FORJA (D-2506, pedido de jogador de 16/10/2026).
 * O servidor manda o `ZC_ACK_REQMAKINGITEM` (0x018f) ao ferreiro e difunde o
 * `ZC_NOTIFY_EFFECT` (0x019b) do refino (3 saiu, 2 falhou) a quem esta no mapa.
 * O cliente toca o efeito pelo `onSpecialEffect` e escreve a linha pelo
 * `onMakeitemResult`. Os dois sao cosmeticos: nada aqui pode lancar (D-993).
 */
const aqui = dirname(fileURLToPath(import.meta.url));
const lido = (rel) => readFileSync(join(aqui, '../..', rel), 'utf8').replaceAll('\r\n', '\n');

describe('a linha do resultado da producao (ZC_ACK_REQMAKINGITEM)', () => {
	it('os codigos sao os de clif_produceeffect (0/1 forja, 2/3 farmacia)', () => {
		expect(RESULTADO_DA_PRODUCAO).toEqual({ FORJA_SAIU: 0, FORJA_FALHOU: 1, FARMACIA_SAIU: 2, FARMACIA_FALHOU: 3 });
		expect([0, 1, 2, 3].map(producaoSaiu)).toEqual([true, false, true, false]);
	});

	it('o texto diz o desfecho e o item', () => {
		expect(textoDoResultadoDaProducao(0, 'Espada')).toBe('A forja deu certo: Espada.');
		expect(textoDoResultadoDaProducao(1, 'Espada')).toBe('A forja falhou: Espada não saiu.');
		expect(textoDoResultadoDaProducao(2, 'Poção Vermelha')).toBe('A preparação deu certo: Poção Vermelha.');
		expect(textoDoResultadoDaProducao(3, 'Poção Vermelha')).toBe('A preparação falhou: Poção Vermelha não saiu.');
	});

	it('sem nome o texto nao quebra, e codigo que o jogo nao serve nao tem linha', () => {
		expect(textoDoResultadoDaProducao(0, '')).toBe('A forja deu certo: o item.');
		expect(textoDoResultadoDaProducao(1, undefined)).toBe('A forja falhou: o item não saiu.');
		expect(textoDoResultadoDaProducao(4, 'Runa')).toBeNull();
		expect(textoDoResultadoDaProducao(7, 'Bomba')).toBeNull();
	});

	it('escreve a linha com o nome do item pedido e diz se saiu', () => {
		const escrever = vi.fn();
		const nomeDoItem = vi.fn(() => 'Espada');
		expect(avisarResultadoDaProducao({ result: 0, ITID: 1101 }, { nomeDoItem, escrever })).toBe(true);
		expect(nomeDoItem).toHaveBeenCalledWith(1101);
		expect(escrever).toHaveBeenCalledWith('A forja deu certo: Espada.', true);
		escrever.mockClear();
		avisarResultadoDaProducao({ result: 1, ITID: 1101 }, { nomeDoItem, escrever });
		expect(escrever).toHaveBeenCalledWith('A forja falhou: Espada não saiu.', false);
	});

	it('nunca lanca: nem com o nome quebrado, nem com o chat quebrado', () => {
		const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const escrever = vi.fn();
		expect(
			avisarResultadoDaProducao({ result: 0, ITID: 1 }, { nomeDoItem: () => { throw new Error('sem DB'); }, escrever })
		).toBe(true);
		expect(escrever).toHaveBeenCalledWith('A forja deu certo: o item.', true);
		expect(
			avisarResultadoDaProducao({ result: 1, ITID: 1 }, { nomeDoItem: () => 'X', escrever: () => { throw new Error('sem chat'); } })
		).toBe(false);
		expect(avisarResultadoDaProducao(null, { nomeDoItem: () => 'X', escrever })).toBe(false);
		aviso.mockRestore();
	});

	it('o resultado de codigo desconhecido nao escreve nada', () => {
		const escrever = vi.fn();
		expect(avisarResultadoDaProducao({ result: 5, ITID: 1 }, { nomeDoItem: () => 'X', escrever })).toBe(false);
		expect(escrever).not.toHaveBeenCalled();
	});
});

describe('as costuras (Item.js, Skill.js e a tabela de efeitos)', () => {
	it('Item.js ouve o 0x018f e escreve pela regra pura, no filtro de item', () => {
		const src = lido('src/Engine/MapEngine/Item.js');
		expect(src).toContain('Network.hookPacket(PACKET.ZC.ACK_REQMAKINGITEM, onMakeitemResult);');
		const corpo = src.slice(src.indexOf('function onMakeitemResult(pkt)'));
		expect(corpo).toContain('avisarResultadoDaProducao(pkt, {');
		expect(corpo).toContain('ChatBox.addText(texto, saiu ? ChatBox.TYPE.BLUE : ChatBox.TYPE.ERROR, ChatBox.FILTER.ITEM);');
		expect(corpo).toContain('return info && info.identifiedDisplayName ? info.identifiedDisplayName : \'\';');
	});

	it('o 0x019b liga 2 ao EF_REFINEFAIL e 3 ao EF_REFINEOK, e o spam nao derruba o laco', () => {
		const src = lido('src/Engine/MapEngine/Skill.js');
		const inicio = src.indexOf('function onSpecialEffect(pkt)');
		const fim = src.indexOf('\n}\n', inicio);
		const corpo = src.slice(inicio, fim);
		const lista = corpo.slice(corpo.indexOf('['), corpo.indexOf(']'));
		const nomes = lista.split(',').map((l) => l.replace(/\/\/.*$/m, '').trim()).filter(Boolean);
		expect(nomes[2]).toBe('EffectConst.EF_REFINEFAIL');
		expect(nomes[3]).toBe('EffectConst.EF_REFINEOK');
		expect(nomes[5]).toBe('EffectConst.EF_PHARMACY_OK');
		expect(nomes[6]).toBe('EffectConst.EF_PHARMACY_FAIL');
		expect(corpo).toMatch(/try \{\n\t\t\tEffectManager\.spam\(EF_Init_Par\);\n\t\t\} catch/);
		expect(src).toContain('Network.hookPacket(PACKET.ZC.NOTIFY_EFFECT, onSpecialEffect);');
	});

	it('a tabela de efeitos toca a arte e o som do refino do cliente oficial (154/155)', () => {
		const tabela = lido('src/DB/Effects/EffectTable.js');
		const de = (id) => tabela.slice(tabela.indexOf(`\n\t${id}: [`), tabela.indexOf(`\n\t${id + 1}: [`));
		expect(de(154)).toContain("file: 'bs_refinesuccess'");
		expect(de(154)).toContain("wav: 'effect/bs_refinesuccess'");
		expect(de(155)).toContain("file: 'bs_refinefailed'");
		expect(de(155)).toContain("wav: 'effect/bs_refinefailed'");
		const consts = lido('src/DB/Effects/EffectConst.js');
		expect(consts).toContain('EF_REFINEOK: 154,');
		expect(consts).toContain('EF_REFINEFAIL: 155,');
	});
});
