/**
 * O BOTAO DA LOJA DE CASH E "RO SHOP" (F1/T2, 21/09/2026 - D-1672), e desde
 * 22/09/2026 ele abre o RO SHOP NOVO (D-RS-03).
 *
 * Pedido do dono em 21/09: *"Altere o botao atual da loja de cash para 'RO
 * Shop', preservando seu acesso a loja e o funcionamento das compras."* Em
 * 22/09 a missao RO Shop trocou a LOJA por tras da porta: a `CashShop` nativa
 * (catalogo derivado de zeny) deixou de ser caminho de compra, e o item do
 * menu e o `CashShopIcon` abrem a janela `RoShop` (canal 0x0fb8/0x0fb9).
 *
 * Este arquivo le o fonte (rotulos em HTML e o caminho do clique, nao ha
 * aritmetica a executar). A pilula de SALDO do painel ("Cash 0") fica como
 * esta de proposito: ela responde "quanto eu tenho", nao e porta.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ler = (rel) => readFileSync(join(process.cwd(), 'src', rel), 'utf8');

describe('o botao da loja de cash diz RO Shop e abre o RO Shop novo', () => {
	it('o titulo da janela nova e "RO Shop"', () => {
		const html = ler('UI/Components/RoShop/RoShop.html');
		const titulo = /class="rs-titulo-texto">([^<]*)</.exec(html)?.[1]?.trim();
		expect(titulo).toBe('RO Shop');
	});

	it('o titulo da janela nativa continua "RO Shop" (ela so nao e mais porta)', () => {
		const html = ler('UI/Components/CashShop/CashShop.html');
		const titulo = /class="text ri-title">([^<]*)</.exec(html)?.[1]?.trim();
		expect(titulo).toBe('RO Shop');
		expect(html).not.toContain('Loja de Cash');
	});

	it('o item do menu se chama "RO Shop" e abre o RoShop (nunca a CashShop nativa)', () => {
		const html = ler('UI/Components/TopMenuIdle/TopMenuIdle.html');
		const item = /data-action="roshop"[\s\S]*?<span class="tm-label">([^<]*)<\/span>/.exec(html)?.[1];
		expect(item).toBe('RO Shop');
		const js = ler('UI/Components/TopMenuIdle/TopMenuIdle.js');
		const abrir = js.slice(js.indexOf("case 'roshop':"));
		expect(abrir.slice(0, 120)).toContain('RoShop.toggle()');
		expect(js).not.toContain('CashShop.toggle()');
	});

	it('o aro do menu acende pelo `.rs-window` (os DOIS switches)', () => {
		const js = ler('UI/Components/TopMenuIdle/TopMenuIdle.js');
		expect(js).toContain("isRagIdleWindowOpen(RoShop, '.rs-window')");
	});

	it('o icone solto da loja (CashShopIcon) abre a MESMA porta', () => {
		const js = ler('UI/Components/CashShopIcon/CashShopIcon.js');
		expect(js).toContain('RoShop.toggle()');
		expect(js).not.toContain('CashShop.toggle()');
	});

	it('a pilula de saldo do painel continua sendo SALDO, nao botao', () => {
		const html = ler('UI/Components/BasicInfoIdle/BasicInfoIdle.html');
		const pilula = /<(\w+)[^>]*class="bi-moeda bi-moeda-cash"/.exec(html)?.[1];
		expect(pilula).toBe('div');
	});
});
