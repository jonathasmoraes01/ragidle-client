/**
 * O "Recarregar" da Temporada (23/09/2026, relato do dono: "esse botao de
 * recarregar nao esta funcionando"). Ele nascia `disabled` no HTML, de antes da
 * doacao via PIX existir. Hoje ele abre a janela de doacao pela ponte do
 * MapEngine - a mesma do Recarregar do RO Shop.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const raiz = join(__dirname, '..', '..', 'src');
const ler = rel => readFileSync(join(raiz, rel), 'utf8');

describe('o Recarregar da Temporada', () => {
	it('o botao nao nasce desligado', () => {
		const html = ler('UI/Components/TemporadaIdle/TemporadaIdle.html');
		const botao = html.match(/<button[^>]*class="te-recarregar"[^>]*>/);
		expect(botao).not.toBeNull();
		expect(botao[0]).not.toMatch(/\bdisabled\b/);
	});

	it('o clique chama a ponte da doacao', () => {
		const js = ler('UI/Components/TemporadaIdle/TemporadaIdle.js');
		const trecho = js.slice(js.indexOf("closest('.te-recarregar')"));
		expect(trecho.slice(0, 400)).toMatch(/TemporadaIdle\.aoAbrirDoacao\(\)/);
	});

	it('o MapEngine liga a ponte na janela de doacao', () => {
		expect(ler('Engine/MapEngine.js')).toMatch(/TemporadaIdle\.aoAbrirDoacao = \(\) => DoacaoIdle\.abrir\(\);/);
	});
});
