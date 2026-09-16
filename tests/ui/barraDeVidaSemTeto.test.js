/**
 * A BARRA PRETA DEBAIXO DO PERSONAGEM — relato com print (08/09/2026).
 *
 * O dono mandou a foto: a barrinha de vida embaixo do personagem, no mundo,
 * desenhada e **preta**. Ela não é a da janela de Grupo — é a `EntityLife`, o
 * canvas que o roBrowser pendura em cada entidade.
 *
 * A causa é uma guarda que não fecha o zero:
 *
 * ```js
 * if (this.hp < 0 || this.hp_max < 0) { this.remove(); return; }
 * const hp_per = hpVisivel / this.hp_max;     // hp_max 0 -> Infinity/NaN
 * ```
 *
 * Com `hp_max === 0` o `fillRect` do preenchimento recebe largura `NaN` e não
 * desenha nada; sobra a borda `#10189c` preenchendo os 5px, que lê como preto.
 * **Não é uma barra vazia por falta de vida — é uma barra indefinida por falta
 * de teto**, e as duas se parecem na tela.
 *
 * O caso lê o fonte porque levantar a `EntityLife` de verdade puxa canvas,
 * `Renderer`, `DB` e uma entidade completa; o que importa aqui é a CONDIÇÃO, e
 * ela está no texto.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const js = readFileSync(join(process.cwd(), 'src/Renderer/Entity/EntityLife.js'), 'utf8');

describe('a barra de vida da entidade recusa teto zero', () => {
	it('a guarda cobre `hp_max <= 0`, e não só o negativo', () => {
		expect(js).toContain('this.hp < 0 || this.hp_max <= 0');
		// O critério antigo NÃO pode voltar por descuido: ele deixava o zero passar.
		expect(js).not.toContain('this.hp < 0 || this.hp_max < 0');
	});

	it('a divisão pelo teto continua DEPOIS da guarda — a ordem é o conserto', () => {
		/*
		 * Se alguém mover a conta para cima da guarda, o `NaN` volta e a guarda
		 * vira decoração. É o mesmo defeito, com outro arranjo de linhas.
		 */
		const guarda = js.indexOf('this.hp < 0 || this.hp_max <= 0');
		const divisao = js.indexOf('hpVisivel / this.hp_max');
		expect(guarda).toBeGreaterThan(-1);
		expect(divisao).toBeGreaterThan(guarda);
	});
});
