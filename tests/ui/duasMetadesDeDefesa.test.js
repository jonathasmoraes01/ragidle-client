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
 *
 * ── ESTE PORTAO JA MORREU UMA VEZ, E O CONSERTO E O ASSUNTO (06/09/2026) ─
 * Ele nasceu (commit 5cea3376) casando o TEXTO de duas linhas:
 *
 *     expect(FONTE).toContain("setText(root, '.st-def', somaDasMetades(...))")
 *
 * ...lendo `StatusIdle.js` com `readFileSync` e executando um PEDACO do fonte
 * recortado com `new Function`. Em `21fcf185` (D-852) a janela passou a
 * desenhar `base + bonus` em DOIS elementos, a `somaDasMetades` deixou de
 * existir, e os quatro casos ficaram VERMELHOS — sem uma linha de
 * comportamento ter mudado. Ficaram assim por tres refatoracoes.
 *
 * Agora a decisao mora num modulo PURO (`metadesDaDerivada.js`) e este arquivo
 * a EXECUTA. O que se mede aqui e a REGRA, nao a forma da linha que a chama:
 * a metade de status atravessa, o servidor antigo nao imprime lixo, e as
 * QUATRO derivadas passam pela mesma peca. Refatorar a janela nao derruba mais
 * nada disto — e se alguem apagar a regra, cai na hora.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

import { METADES, lerMetades } from 'UI/Components/StatusIdle/metadesDaDerivada.js';

const FONTE = readFileSync('src/UI/Components/StatusIdle/StatusIdle.js', 'utf8');

/** Acha a linha da tabela pela derivada, para os casos lerem por NOME. */
function metade(chave) {
	const def = METADES.find(m => m.chave === chave);
	expect(def, `a derivada "${chave}" sumiu da tabela METADES`).toBeDefined();
	return def;
}

beforeEach(() => {
	/*
	 * O `console.warn` da queda para o formato antigo e DELIBERADO (o sintoma
	 * na tela e discreto demais), entao ele dispara de proposito em metade dos
	 * casos abaixo. Silenciado aqui para nao encher a saida da suite — e
	 * `vi.spyOn` em vez de sobrescrever, para o vitest devolve-lo sozinho.
	 */
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('a metade de STATUS atravessa — a cicatriz do MDEF 0', () => {
	it('com o contrato v2, as duas metades saem como o servidor mandou', () => {
		const par = lerMetades({ esquerda: 12, direita: 3 }, {}, metade('def'));
		expect(par).toEqual({ esquerda: 12, direita: 3, temDireita: true });
	});

	it('metade de EQUIPAMENTO zero nao apaga a de status — e o caso caro', () => {
		/*
		 * O caso comum do MDEF: `bonus bMdef` zero, INT dando o numero. Antes do
		 * conserto de 27/08 a tela recebia 0; o que este caso proibe e a
		 * esquerda ser descartada quando a direita e zero.
		 */
		const par = lerMetades({ esquerda: 9, direita: 0 }, {}, metade('mdef'));
		expect(par.esquerda).toBe(9);
		expect(par.temDireita, 'a direita e ESTRUTURAL: o RO mostra os dois lados').toBe(true);
	});

	it('DEF e MDEF tem a rede do legado — nenhuma das duas ficou de fora', () => {
		/*
		 * Consertar DEF e esquecer MDEF seria o defeito pela metade, e MDEF era
		 * justamente o caso caro. Antes isto era um `toContain` de duas linhas de
		 * codigo; agora e a regra rodando nas duas.
		 */
		for (const [chave, campoDeStatus] of [
			['def', 'defDeStatus'],
			['mdef', 'mdefDeStatus']
		]) {
			const def = metade(chave);
			expect(def.legado, `${chave} perdeu a rede do legado`).not.toBeNull();
			expect(def.legado.esquerda).toBe(campoDeStatus);

			const par = lerMetades(undefined, { [campoDeStatus]: 7, [chave]: 4 }, def);
			expect(par, `${chave} nao caiu no legado`).toEqual({ esquerda: 7, direita: 4, temDireita: true });
		}
	});
});

describe('servidor ANTIGO nao vira lixo na tela', () => {
	it('campo ausente vale ZERO, e nunca "undefined" ou "NaN"', () => {
		/*
		 * A compatibilidade importa: a ficha e JSON, e um servidor que ainda nao
		 * manda `defDeStatus` nao pode fazer a janela mostrar "undefined + 3".
		 * Numero plausivel com lixo do lado e pior que numero ausente — o
		 * jogador nao sabe qual metade acreditar.
		 */
		const par = lerMetades(undefined, { def: 3 }, metade('def'));
		expect(par).toEqual({ esquerda: 0, direita: 3, temDireita: true });

		const vazio = lerMetades(undefined, {}, metade('def'));
		expect(vazio).toEqual({ esquerda: 0, direita: 0, temDireita: true });

		for (const valor of Object.values(lerMetades({ esquerda: 'x', direita: null }, {}, metade('def')))) {
			expect(Number.isNaN(valor), 'NaN chegou ao desenho').toBe(false);
		}
	});

	it('metade PELA METADE (so um dos lados) nao e aceita como v2', () => {
		/*
		 * `{esquerda: 5}` sem `direita` significa contrato quebrado, e nao
		 * "direita zero": aceita-lo imprimiria 5 + 0 com cara de medida. A queda
		 * para o legado e a resposta certa, e ela avisa no console.
		 */
		const par = lerMetades({ esquerda: 5 }, { defDeStatus: 1, def: 2 }, metade('def'));
		expect(par).toEqual({ esquerda: 1, direita: 2, temDireita: true });
		expect(console.warn).toHaveBeenCalled();
	});

	it('ATK/MATK NAO tem legado — usar `derivados.atk` ali imprimiria o total', () => {
		/*
		 * `derivados.atk` e o TOTAL do motor (inclui variancia e bonus de
		 * atributo), e nao a metade da direita. Dar legado a ele poria 123 no
		 * lugar de 55 — grandezas diferentes na mesma linha.
		 */
		const par = lerMetades(undefined, { atk: 123 }, metade('atk'));
		expect(par).toEqual({ esquerda: 123, direita: 0, temDireita: false });
		expect(metade('matk').legado, 'MATK ganhou um legado que mente').toBeNull();
	});
});

describe('a janela desenha as duas metades das QUATRO', () => {
	it('a tabela cobre ATK, MATK, DEF e MDEF, cada uma com os dois alvos', () => {
		expect(METADES.map(m => m.chave)).toEqual(['atk', 'matk', 'def', 'mdef']);

		for (const def of METADES) {
			// Sem o alvo da DIREITA a metade de equipamento nao tem onde pousar,
			// que e a forma nova do defeito antigo (uma metade some da tela).
			expect(def.alvo, `${def.chave} sem alvo`).toBeTruthy();
			expect(def.alvoDaDireita, `${def.chave} sem alvo da direita`).toBeTruthy();
		}
	});

	it('renderMetades percorre a tabela e escreve os DOIS lados', () => {
		/*
		 * O unico casamento de texto que sobrou, e ele mede ESTRUTURA (o laco
		 * existe e escreve nos dois alvos), nao a forma de uma chamada. Sem
		 * isto, a regra poderia continuar certa e simplesmente nao ser chamada
		 * por ninguem — o modo de falha que nenhum teste de unidade pega.
		 */
		const corpo = FONTE.slice(FONTE.indexOf('function renderMetades('), FONTE.indexOf('function titleDaMetade('));
		expect(corpo, 'renderMetades sumiu').toBeTruthy();
		expect(corpo, 'a janela parou de percorrer a tabela').toContain('METADES.forEach');
		expect(corpo, 'a metade da esquerda nao e escrita').toContain('setText(root, def.alvo, par.esquerda)');
		expect(corpo, 'a metade da direita nao e escrita').toContain('def.alvoDaDireita');
	});
});
