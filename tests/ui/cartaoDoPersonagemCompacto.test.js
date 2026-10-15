/**
 * O CARTAO DO PERSONAGEM COMPACTO da HUD mobile premium (pedido do dono, 15/10/2026): *"elabore uma versao mais
 * compacta das informacoes do char, esta muito grande isso e da para reduzirmos"*.
 *
 * O desenho e CSS (a prova de tela, `scripts/foto-hud-premium.mjs`, mede e fotografa); o que se cobra aqui e o
 * contrato que o CSS precisa do HTML e que quebraria calado:
 *   - TRES fileiras: nome; HP e SP; Base e Classe - e nao as seis da primeira versao;
 *   - o nome do nivel por extenso mora num `span` proprio, que a tela estreita esconde inteiro ("B 61"/"C 1"):
 *     o `font-size: 0` no rotulo era desfeito pelo ajuste de texto do navegador do celular (medido);
 *   - o numero do nivel continua no `<b>` que o JS escreve.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const raiz = join(__dirname, '..', '..', 'src', 'UI');
const html = readFileSync(join(raiz, 'Components', 'BasicInfoIdle', 'BasicInfoIdle.html'), 'utf8');
const css = readFileSync(join(raiz, 'HudPremium', 'componentes', 'BasicInfoIdle.css'), 'utf8');

describe('o cartao do personagem compacto', () => {
	it('tem tres fileiras: nome; HP e SP; Base e Classe', () => {
		const areas = css.match(/grid-template-areas:\s*((?:'[^']*'\s*)+);/);
		expect(areas).not.toBeNull();
		expect(areas[1].match(/'[^']*'/g)).toEqual(["'av nome nome zeny'", "'av hp sp cash'", "'av niveis niveis aparelho'"]);
	});

	it('o nome do nivel por extenso tem span proprio, e o numero segue no <b> do JS', () => {
		expect(html).toContain(
			'<span class="bi-level-label"><span class="bi-level-nome">Base Lv.</span> <b class="bi-blvl-value">1</b></span>'
		);
		expect(html).toContain(
			'<span class="bi-level-label"><span class="bi-level-nome">Classe Lv.</span> <b class="bi-jlvl-value">1</b></span>'
		);
	});

	it('na tela estreita o nome por extenso sai inteiro, e nao por font-size zero', () => {
		expect(css).toMatch(/\.ri-premium\.ri-tela-estreita \.bi-level-nome \{\s*display: none;/);
		expect(css).not.toMatch(/font-size:\s*0[;\s]/);
	});
});
