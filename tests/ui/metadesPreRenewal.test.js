/**
 * A janela de Status com as legendas do PRE-RENEWAL (26/09/2026).
 *
 * O servidor ja mandava os lados na ordem do `#else` de `pc.hpp:1255-1274`;
 * a janela e que escrevia o MATK como "50 + 80" (o jogador lia 130, e os dois
 * sao minimo e maximo) e legendava o DEF com os lados trocados.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import { METADES, notaDoTotal, textoDaDireita } from 'UI/Components/StatusIdle/metadesDaDerivada.js';

const def = chave => METADES.find(d => d.chave === chave);

describe('metades do status no pre-renewal', () => {
	it('o MATK e uma FAIXA: "~ 80", sem sinal', () => {
		expect(textoDaDireita(def('matk'), 80)).toBe('~ 80');
	});

	it('ATK/DEF/MDEF seguem como parcela: "+ 10" e "- 3"', () => {
		expect(textoDaDireita(def('atk'), 10)).toBe('+ 10');
		expect(textoDaDireita(def('def'), -3)).toBe('- 3');
		expect(textoDaDireita(def('mdef'), 0)).toBe('+ 0');
	});

	it('as legendas sao as do pre-renewal (a esquerda do DEF e o EQUIPAMENTO)', () => {
		expect([def('atk').daEsquerda, def('atk').daDireita]).toEqual(['de status e arma', 'de refino']);
		expect([def('matk').daEsquerda, def('matk').daDireita]).toEqual(['minimo', 'maximo']);
		expect([def('def').daEsquerda, def('def').daDireita]).toEqual(['de equipamento', 'de VIT']);
		expect([def('mdef').daEsquerda, def('mdef').daDireita]).toEqual(['de equipamento', 'de INT']);
	});

	it('a nota do total do motor so aparece quando ele DIFERE da soma', () => {
		const par = { esquerda: 30, direita: 5, temDireita: true };
		expect(notaDoTotal(def('atk'), par, { atk: 35 })).toBeNull();
		expect(notaDoTotal(def('atk'), par, { atk: 40 })).toContain('Total no motor: 40');
		// A faixa do MATK nao tem total para comparar.
		expect(notaDoTotal(def('matk'), par, { matk: 99 })).toBeNull();
	});

	it('a janela desenha a esquiva perfeita ao lado do FLEE', () => {
		const html = readFileSync('src/UI/Components/StatusIdle/StatusIdle.html', 'utf8');
		expect(html).toContain('<span class="st-flee">0</span><span class="st-flee2 st-bonus"></span>');
		const js = readFileSync('src/UI/Components/StatusIdle/StatusIdle.js', 'utf8');
		expect(js).toContain("derivados.fleePerfeita > 0 ? '+ ' + derivados.fleePerfeita : ''");
	});
});

describe('a producao e pre-renewal', () => {
	it('o gerador do Config.local.js de producao manda renewal: false', () => {
		const gerador = readFileSync('oraculo/gerar-config-de-producao.mjs', 'utf8');
		expect(gerador).toContain('renewal: false,');
		expect(gerador).not.toContain('renewal: true,');
	});
});
