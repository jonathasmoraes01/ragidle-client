/**
 * A HUD IDLE LE DA ENTIDADE — e quem escreve tem de escrever LA (D-537).
 *
 * Queixa do dono, jogando: "Classe Lv. nao esta subindo automatico, ele so
 * atualiza quando o player atualiza a pagina."
 *
 * ## O mecanismo
 *
 * `BasicInfoIdle` e `StatusIdle` nao guardam estado: elas releem
 * `Session.Entity` a cada tique do laco de polling
 * (`BasicInfoIdle.js`, `setInterval(syncFromNativeState, ...)`). Entao o
 * numero na tela e exatamente o que estiver na ENTIDADE.
 *
 * A janela nativa do roBrowser (`BasicInfo`) funciona ao contrario: ela
 * guarda o proprio `jlvl` e nunca consulta a entidade. Por isso o roBrowser de
 * origem nunca precisou escrever `Session.Entity.joblevel` — e nao escrevia.
 * O unico lugar do jogo inteiro que escrevia era o char-select
 * (`CharEngine.js`, `new Player(entity)`), o que explica o sintoma ao pe da
 * letra: o valor do LOGIN, congelado, ate a proxima atualizacao de pagina.
 *
 * `CLEVEL` (`Session.Entity.clevel = amount`) e `WEIGHT`
 * (`Session.Entity.weight = amount`) ja faziam certo. `JOBLEVEL` era o unico
 * dos tres que so falava com a janela nativa.
 *
 * ## Por que o teste le o FONTE
 *
 * Levantar a HUD de verdade exigiria WebGL, o GRF e uma sessao logada. O que
 * importa aqui nao e o pixel: e o CONTRATO entre dois arquivos distantes —
 * "quem a HUD le, o par-change escreve". Isso da para conferir no texto, e e
 * a unica forma barata de a regra valer para o campo que alguem somar amanha.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ler = nome => readFileSync(join(process.cwd(), 'src', nome), 'utf8');

const MAIN = ler('Engine/MapEngine/Main.js');

/**
 * Os campos que a HUD idle le da entidade e de onde o servidor os atualiza.
 * O `case` e o do `switch (pkt.varID)` de `onParChange`.
 */
const CAMPOS = [
	{ campo: 'clevel', caso: 'CLEVEL' },
	{ campo: 'joblevel', caso: 'JOBLEVEL' },
	{ campo: 'weight', caso: 'WEIGHT' }
];

/** O corpo de um `case StatusProperty.X:` ate o `break;` dele. */
function corpoDoCaso(fonte, nome) {
	const inicio = fonte.indexOf(`case StatusProperty.${nome}:`);
	expect(inicio, `case StatusProperty.${nome} sumiu de Main.js`).toBeGreaterThan(-1);
	const fim = fonte.indexOf('break;', inicio);
	expect(fim, `case StatusProperty.${nome} sem break`).toBeGreaterThan(inicio);
	return fonte.slice(inicio, fim);
}

describe('todo campo que a HUD idle le volta para Session.Entity', () => {
	for (const { campo, caso } of CAMPOS) {
		it(`${caso} escreve Session.Entity.${campo}`, () => {
			expect(corpoDoCaso(MAIN, caso)).toContain(`Session.Entity.${campo} =`);
		});
	}
});

describe('e as duas HUDs realmente leem esses campos da entidade', () => {
	// Se um dia elas pararem de ler da entidade, os testes de cima viram
	// exigencia sem dono — e este bloco avisa em vez de deixa-los apodrecer.
	const BASIC = ler('UI/Components/BasicInfoIdle/BasicInfoIdle.js');
	const STATUS = ler('UI/Components/StatusIdle/StatusIdle.js');

	it('BasicInfoIdle le clevel, joblevel e weight de `entity`', () => {
		for (const { campo } of CAMPOS) {
			expect(BASIC, `BasicInfoIdle nao le entity.${campo}`).toContain(`entity.${campo}`);
		}
	});

	it('StatusIdle le clevel e joblevel de `entity`', () => {
		expect(STATUS).toContain('entity.clevel');
		expect(STATUS).toContain('entity.joblevel');
	});
});
