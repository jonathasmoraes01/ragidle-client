/**
 * AS DUAS METADES DE DEF E MDEF (auditoria C, 27/08/2026).
 *
 * O emulador manda DEF e MDEF em dois campos, e no renewal o `leftside` e o
 * derivado de STATUS e o `rightside` e o de EQUIPAMENTO (`pc.hpp:1241-1244`,
 * dentro do `#ifdef RENEWAL`; no pre-renewal os lados sao trocados).
 *
 * A ficha RAGIDLE trazia so a metade de EQUIPAMENTO. Para o MDEF isso e
 * devastador: MDEF de jogador nasce SO de `bonus bMdef` — nao ha campo
 * `MagicDefense` no item_db de equipamento —, entao essa metade e ZERO em quase
 * todo personagem.
 *
 * Medido no corpus antes do conserto: **276 de 276** fichas com
 * `derivados.mdef === 0`. O jogador com INT abria a janela de Status e lia
 * MDEF 0, com o numero calculado do outro lado o tempo todo.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const FONTE = readFileSync('src/UI/Components/StatusIdle/StatusIdle.js', 'utf8');

/** O helper mora num closure do modulo; a medida possivel e ler o fonte. */
function somaDasMetades(deStatus, deEquipamento) {
	const corpo = FONTE.slice(
		FONTE.indexOf('function somaDasMetades('),
		FONTE.indexOf('function setText('),
	);
	// eslint-disable-next-line no-new-func
	return new Function('deStatus', 'deEquipamento', corpo + ' return somaDasMetades(deStatus, deEquipamento);')(
		deStatus,
		deEquipamento,
	);
}

describe('a janela de Status mostra as duas metades', () => {
	it('com as duas, escreve "status + equipamento"', () => {
		expect(somaDasMetades(12, 3)).toBe('12 + 3');
	});

	it('sem equipamento, escreve so a de STATUS — e e ela que faltava', () => {
		/*
		 * O caso comum do MDEF: `bonus bMdef` zero, INT dando o numero. Antes,
		 * a tela recebia 0.
		 */
		expect(somaDasMetades(9, 0)).toBe('9');
	});

	it('servidor ANTIGO, sem a metade de status, cai no numero de antes', () => {
		/*
		 * A compatibilidade importa: a ficha e JSON, e um servidor que ainda nao
		 * manda `defDeStatus` nao pode fazer a janela mostrar "undefined + 3".
		 */
		expect(somaDasMetades(undefined, 3)).toBe(3);
		expect(somaDasMetades(undefined, 0)).toBe(0);
	});

	it('a janela USA o helper nas duas linhas — nao so numa', () => {
		/*
		 * Consertar DEF e esquecer MDEF seria o defeito pela metade, e MDEF era
		 * justamente o caso caro. O portao cobra os dois.
		 */
		expect(FONTE).toContain("setText(root, '.st-def', somaDasMetades(derivados.defDeStatus, derivados.def))");
		expect(FONTE).toContain("setText(root, '.st-mdef', somaDasMetades(derivados.mdefDeStatus, derivados.mdef))");
	});
});
