/**
 * O BOTAO DA LOJA DE CASH E "RO SHOP" (F1/T2, 21/09/2026 - D-1672).
 *
 * Pedido do dono: *"Altere o botao atual da loja de cash para 'RO Shop',
 * preservando seu acesso a loja e o funcionamento das compras."*
 *
 * O item do menu ja dizia "RO Shop"; o que ainda dizia "Cash" era o TITULO da
 * janela que o botao abre. Este arquivo le o fonte (sao rotulos em HTML, nao
 * ha aritmetica a executar) e pina os tres pontos: o titulo, o item do menu e
 * o caminho do clique ate `CashShop.toggle()`. A pilula de SALDO do painel
 * ("Cash 0") fica como esta de proposito: ela responde "quanto eu tenho", nao
 * e porta - e o caso ultimo cobra que ela NAO virou botao.
 *
 * A compra em si e provada no fio pelo servidor (`npm run prove:cash`).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ler = (rel) => readFileSync(join(process.cwd(), 'src', rel), 'utf8');

describe('o botao da loja de cash diz RO Shop', () => {
	it('o titulo da janela da loja e "RO Shop", e nao "Loja de Cash"', () => {
		const html = ler('UI/Components/CashShop/CashShop.html');
		const titulo = /class="text ri-title">([^<]*)</.exec(html)?.[1]?.trim();
		expect(titulo).toBe('RO Shop');
		expect(html).not.toContain('Loja de Cash');
	});

	it('o item do menu se chama "RO Shop" e abre a MESMA loja (CashShop.toggle)', () => {
		const html = ler('UI/Components/TopMenuIdle/TopMenuIdle.html');
		const item = /data-action="roshop"[\s\S]*?<span class="tm-label">([^<]*)<\/span>/.exec(html)?.[1];
		expect(item).toBe('RO Shop');
		const js = ler('UI/Components/TopMenuIdle/TopMenuIdle.js');
		const caso = js.slice(js.indexOf("case 'roshop':"));
		expect(caso.slice(0, 200)).toContain('CashShop.toggle()');
	});

	it('a pilula de saldo do painel continua sendo SALDO, nao botao', () => {
		const html = ler('UI/Components/BasicInfoIdle/BasicInfoIdle.html');
		const pilula = /<(\w+)[^>]*class="bi-moeda bi-moeda-cash"/.exec(html)?.[1];
		expect(pilula).toBe('div');
	});
});
