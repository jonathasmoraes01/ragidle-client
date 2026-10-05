/**
 * O "ABRIR TODOS" DA TEMPORADA (05/10/2026, pedido do dono) - a metade pura:
 * quanto pedir, quando seguir pedindo, o que a janela do lote desenha e a
 * frase do fim. E o guarda da MACA no icone (a copia batizada de
 * `unknownItem`), lido no fonte da janela.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
	contagemDoLote,
	deveSeguirOLote,
	MINIMO_PARA_ABRIR_TODOS,
	quantidadeDoProximoLote,
	renderCaixaHtml,
	renderItensDoLoteHtml,
	renderLoteHtml,
	renderProgressoDoLoteHtml,
	renderRevealHtml,
	resumoDoLote,
	TETO_DO_LOTE
} from 'UI/Components/TemporadaIdle/formatoDaTemporada.js';

function caixa(extra = {}) {
	return {
		pool: 'GARMENT',
		nome: 'Caixa Manto',
		slot: 'Manto',
		preco: null,
		fechadas: 0,
		compra: { pode: false, motivo: 'saldo', texto: null },
		pity: { contador: 0, garantia: 80, faltam: 80, garantidoNaProxima: false },
		recompensas: [],
		...extra
	};
}

function abertura(extra = {}) {
	return {
		pool: 'GARMENT',
		itemId: 20762,
		nome: 'Grandes Asas de Demônio',
		raridade: 'COMMON',
		rotuloDaRaridade: 'Comum',
		foiGarantia: false,
		pityDepois: 1,
		repetida: false,
		destino: 'mochila',
		...extra
	};
}

const ok = (aberturas, extra = {}) => ({ acao: 'abrir-caixas', ok: true, aberturas, ...extra });

describe('quanto pedir', () => {
	it('o teto e o do servidor (10), e nada torto passa de 0', () => {
		expect(TETO_DO_LOTE).toBe(10);
		expect(quantidadeDoProximoLote(25)).toBe(10);
		expect(quantidadeDoProximoLote(10)).toBe(10);
		expect(quantidadeDoProximoLote(5)).toBe(5);
		expect(quantidadeDoProximoLote(1)).toBe(1);
		for (const torto of [0, -2, null, undefined, 'x', Number.NaN]) {
			expect(quantidadeDoProximoLote(torto), String(torto)).toBe(0);
		}
	});
});

describe('quando o lote segue pedindo', () => {
	const tres = [abertura(), abertura(), abertura()];

	it('segue com o pedido certo e ainda caixa fechada', () => {
		expect(deveSeguirOLote(ok(tres), 15, false)).toBe(true);
		expect(deveSeguirOLote(ok(tres), 1, false)).toBe(true);
	});

	it('para: acabaram, o jogador fechou, recusa, parada, so repetidas, nada aberto', () => {
		expect(deveSeguirOLote(ok(tres), 0, false)).toBe(false);
		expect(deveSeguirOLote(ok(tres), 15, true)).toBe(false);
		expect(deveSeguirOLote({ acao: 'abrir-caixas', ok: false, motivo: 'correio-cheio' }, 15, false)).toBe(false);
		expect(deveSeguirOLote(ok(tres, { parada: 'correio-cheio' }), 15, false)).toBe(false);
		expect(deveSeguirOLote(ok([abertura({ repetida: true, destino: null })]), 15, false)).toBe(false);
		expect(deveSeguirOLote(ok([]), 15, false)).toBe(false);
		expect(deveSeguirOLote(null, 15, false)).toBe(false);
	});
});

describe('o botao no cartao da caixa', () => {
	const todos = html => html.match(/<button[^>]*data-agir="abrir-todas"[^>]*>[^<]*/);

	it('aparece com 2 ou mais fechadas, dizendo quantas', () => {
		expect(MINIMO_PARA_ABRIR_TODOS).toBe(2);
		expect(todos(renderCaixaHtml(caixa({ fechadas: 0 })))).toBeNull();
		expect(todos(renderCaixaHtml(caixa({ fechadas: 1 })))).toBeNull();
		const dois = todos(renderCaixaHtml(caixa({ fechadas: 2 })));
		expect(dois[0]).toContain('data-pool="GARMENT"');
		expect(dois[0]).toMatch(/Abrir todos \(2\)$/);
		expect(todos(renderCaixaHtml(caixa({ fechadas: 25 })))[0]).toMatch(/Abrir todos \(25\)$/);
	});

	it('o retrato do topo leva o slot (a reserva quando a imagem nao carrega)', () => {
		expect(renderCaixaHtml(caixa())).toContain('data-slot="Manto"');
	});
});

describe('a janela do lote', () => {
	it('a casca: o nome, o retrato do slot, a lista, o resumo e os dois Fechar', () => {
		const html = renderLoteHtml({ nome: 'Caixa Manto', slot: 'Manto', total: 25, aberturas: [], pronto: false });
		expect(html).toContain('<strong>Caixa Manto</strong>');
		expect(html).toContain('icone-caixa-manto.webp');
		expect(html).toContain('class="te-lote-lista');
		expect(html).toContain('class="te-lote-resumo"');
		expect(html.match(/class="te-lote-fechar/g)).toHaveLength(2);
		expect(html).toContain('Abrindo');
	});

	it('o progresso conta so as NOVAS, contra o total do clique', () => {
		const lote = { total: 25, aberturas: [abertura(), abertura(), abertura({ repetida: true })], pronto: false };
		const html = renderProgressoDoLoteHtml(lote);
		expect(html).toContain('2 de 25');
		expect(html).toContain('width:8%');
		expect(renderProgressoDoLoteHtml({ ...lote, pronto: true })).toContain('Abertas');
	});

	it('os itens: a raridade em classe e em TEXTO do servidor, o icone por id, o correio dito, e so a partir do inicio', () => {
		const lista = [
			abertura({ itemId: 9000300, nome: 'Asas de Anjo' }),
			abertura({ itemId: 9000305, nome: 'Máscara', raridade: 'LEGENDARY', rotuloDaRaridade: 'Lendária', foiGarantia: true, destino: 'correio' })
		];
		const html = renderItensDoLoteHtml(lista);
		expect(html.match(/class="te-lote-item /g)).toHaveLength(2);
		expect(html).toContain('te-lote-item te-raridade--legendary is-garantia');
		expect(html).toContain('data-item-id="9000305"');
		expect(html).toContain('>Lendária<');
		expect(html).toContain('>Correio<');
		expect(html).not.toContain('LEGENDARY<');
		expect(html).toContain('style="--i:1"');
		const so = renderItensDoLoteHtml(lista, 1);
		expect(so).not.toContain('9000300');
		expect(so).toContain('style="--i:0"');
	});

	it('a contagem por raridade, a lendaria primeiro, sem as repetidas', () => {
		const c = contagemDoLote([
			abertura(),
			abertura({ raridade: 'RARE', rotuloDaRaridade: 'Rara' }),
			abertura(),
			abertura({ raridade: 'LEGENDARY', rotuloDaRaridade: 'Lendária' }),
			abertura({ repetida: true })
		]);
		expect(c).toEqual([
			{ raridade: 'LEGENDARY', rotulo: 'Lendária', quantidade: 1 },
			{ raridade: 'RARE', rotulo: 'Rara', quantidade: 1 },
			{ raridade: 'COMMON', rotulo: 'Comum', quantidade: 2 }
		]);
	});
});

describe('a frase do fim', () => {
	it('conta a lista inteira, diz o correio, a garantia, e o motivo de parar', () => {
		const lista = [abertura(), abertura({ destino: 'correio' }), abertura({ foiGarantia: true })];
		expect(resumoDoLote(lista, ok([]), 'concluido')).toEqual({
			texto: '3 caixas abertas. 1 visual foi para o correio (a mochila não coube). Lendário garantido pela Proteção Lendária!',
			ehErro: false
		});
		expect(resumoDoLote([abertura()], ok([], { parada: 'correio-cheio', textoDaParada: 'Seu correio está cheio.' }), 'concluido')).toEqual({
			texto: '1 caixa aberta. Parou: Seu correio está cheio.',
			ehErro: true
		});
	});

	it('a recusa, o fechar no meio e a falta de resposta', () => {
		expect(resumoDoLote([], { ok: false, texto: 'Você não tem esta caixa para abrir.' }, 'concluido')).toEqual({
			texto: 'Você não tem esta caixa para abrir.',
			ehErro: true
		});
		expect(resumoDoLote([abertura()], null, 'cancelado').texto).toBe(
			'1 caixa aberta. Você fechou antes do fim: as caixas que faltam continuam fechadas.'
		);
		expect(resumoDoLote([abertura()], null, 'sem-resposta')).toEqual({
			texto: '1 caixa aberta. Sem resposta do servidor. O que já saiu está com você.',
			ehErro: true
		});
		expect(resumoDoLote([], null, 'concluido').texto).toBe('Nenhuma caixa foi aberta.');
	});
});

describe('a revelacao de uma', () => {
	it('leva os raios na cor da raridade (o efeito), sem trocar o resto', () => {
		const html = renderRevealHtml({ texto: 'x', abertura: abertura({ raridade: 'RARE', rotuloDaRaridade: 'Rara' }) });
		expect(html).toContain('te-reveal-caixa te-raridade--rare');
		expect(html).toContain('class="te-reveal-raios"');
		expect(html).toContain('te-reveal-fechar');
	});
});

describe('a janela, no fonte', () => {
	const fonte = readFileSync(join(process.cwd(), 'src', 'UI', 'Components', 'TemporadaIdle', 'TemporadaIdle.js'), 'utf8').replace(
		/\/\*[\s\S]*?\*\//g,
		' '
	);

	it('o icone pelo GRF pergunta pelo CAMPO (temIconeProprio), e nao pela identidade - a MACA', () => {
		expect(fonte).toMatch(/if \(!temIconeProprio\(info\)\)/);
		expect(fonte).not.toMatch(/info === unknownItem/);
	});

	it('o lote fecha no ESC antes da janela (balao) e o pedido e o verbo do servidor', () => {
		expect(fonte).toMatch(/abrirBalao\(BALAO_DO_LOTE, fecharLote\)/);
		expect(fonte).toMatch(/abrirBalao\(BALAO_DA_REVELACAO, fecharReveal\)/);
		expect(fonte).toContain("acao: 'abrir-caixas'");
	});
});
