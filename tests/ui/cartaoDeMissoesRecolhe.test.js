/**
 * O CARTAO DE MISSOES RECOLHE POR COMPLETO NO CELULAR (26/09/2026).
 *
 * Relato de jogadores trazido pelo dono: *"ainda nao estao conseguindo
 * minimizar por completo essa janela de missao, assim como eles fazem na
 * UI"*. De 08/09 a 26/09 a HUD vertical DEVOLVIA o corpo ao cartao recolhido
 * (a missao em curso e a primeira linha ficavam na tela). A medida no jogo e
 * da sonda `scripts/diag-armazem-no-celular.ts` (rag-idle): 250 px aberto,
 * 50 px recolhido. Este portao le o CSS para a regra que devolvia o corpo nao
 * voltar calada.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(process.cwd(), 'src/UI/Components/MissoesTrackerIdle/MissoesTrackerIdle.css'), 'utf8').replace(/\r\n/g, '\n');

describe('o cartao de Missoes recolhido', () => {
	it('a regra base esconde o corpo inteiro', () => {
		expect(css).toMatch(/\.mt-painel\.is-recolhido \.mt-corpo \{\s*display: none;/);
	});

	it('a HUD vertical NAO devolve o corpo ao recolhido (a regra de 08/09 saiu)', () => {
		expect(css).not.toMatch(/\.ri-vertical \.mt-painel\.is-recolhido \.mt-corpo \{\s*display: flex;/);
	});

	it('o rodape "Ver todas as missoes" some junto no celular', () => {
		expect(css).toMatch(/\.ri-vertical \.mt-painel\.is-recolhido \.mt-ver-todas \{\s*display: none;/);
	});
});
