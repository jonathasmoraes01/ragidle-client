/**
 * PEGAR E PÔR — O CAMINHO POR TOQUE PARA A BARRA DE ATALHOS (D-938, 05/09/2026).
 *
 * O buraco que gerou este módulo: pôr uma habilidade ou um consumível na barra
 * de atalhos tem UM caminho neste cliente, e ele é o arrasto HTML5 — que **não
 * existe no toque**. Não é "funciona mal": o navegador de celular não gera
 * `dragstart` a partir de um dedo, então nada da sequência começa.
 *
 * As perguntas que valem daqui a um mês:
 *
 * 1. **Tocar de novo no mesmo botão desarma.** É como o jogador desiste sem
 *    procurar um "cancelar" na tela — e é a única regra deste módulo que
 *    depende de comparar dois payloads, portanto a única que quebra em
 *    silêncio se alguém mexer na chave de identidade.
 *
 * 2. **`entregar()` esvazia, `pendente()` não.** Dois toques quase
 *    simultâneos (um `click` e um `pointerup` sintético, por exemplo) não
 *    podem aplicar o mesmo pegado duas vezes — e "aplicar duas vezes" aqui
 *    significa dois pacotes ao servidor.
 *
 * 3. **O ESC desarma ANTES de fechar janela** (a integração com a
 *    `pilhaDeJanelas`): com algo na mão, o voltar do Android está desistindo
 *    daquele gesto, não pedindo para fechar a mochila inteira.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Toque, { assinar, cancelar, entregar, esquecerTudo, pegar, pendente } from 'UI/toqueParaAtalho.js';

const HABILIDADE = {
	type: 'skill',
	from: 'IdleSkills',
	data: { SKID: 46, level: 5, selectedLevel: 5 },
	rotulo: 'Flecha Melódica'
};

const OUTRA_HABILIDADE = {
	type: 'skill',
	from: 'IdleSkills',
	data: { SKID: 47, level: 1, selectedLevel: 1 },
	rotulo: 'Tocar Instrumento'
};

const POCAO = {
	type: 'item',
	from: 'Inventory',
	data: { ITID: 501, index: 3 },
	rotulo: 'Poção Vermelha'
};

describe('pegar e pôr', () => {
	beforeEach(() => {
		esquecerTudo();
	});

	it('a mao comeca vazia', () => {
		expect(pendente()).toBe(null);
	});

	it('pegar poe na mao, e o payload chega INTEIRO', () => {
		expect(pegar(HABILIDADE)).toBe(true);
		/* Inteiro e não "equivalente": este objeto vai direto para o `switch`
		   do `onDrop` da barra, que lê `from`, `type` e `data.SKID`. */
		expect(pendente()).toEqual(HABILIDADE);
	});

	it('TOCAR DE NOVO NO MESMO ALVO DESARMA', () => {
		pegar(HABILIDADE);
		expect(pegar(HABILIDADE)).toBe(false);
		expect(pendente()).toBe(null);
	});

	it('mas um alvo DIFERENTE troca o que esta na mao, em vez de desarmar', () => {
		pegar(HABILIDADE);
		expect(pegar(OUTRA_HABILIDADE)).toBe(true);
		expect(pendente().data.SKID).toBe(47);
	});

	it('duas pilhas do MESMO item em posicoes diferentes sao alvos diferentes', () => {
		/* A mochila pode ter duas pilhas do mesmo `ITID`. Se a chave ignorasse
		   o índice, pegar a segunda pilha desarmaria a primeira e o jogador
		   ficaria com a mão vazia sem entender por quê. */
		pegar(POCAO);
		expect(pegar({ ...POCAO, data: { ITID: 501, index: 9 } })).toBe(true);
		expect(pendente().data.index).toBe(9);
	});

	it('habilidade e item com o mesmo numero NAO se confundem', () => {
		pegar({ type: 'skill', from: 'IdleSkills', data: { SKID: 501 } });
		/* Sem o prefixo de tipo na chave, este segundo `pegar` desarmaria o
		   primeiro em vez de trocar. */
		expect(pegar({ type: 'item', from: 'Inventory', data: { ITID: 501, index: 0 } })).toBe(true);
		expect(pendente().type).toBe('item');
	});

	it('lixo nao entra na mao', () => {
		expect(pegar(null)).toBe(false);
		expect(pegar({})).toBe(false);
		expect(pegar({ type: 'skill' })).toBe(false);
		/* `type` fora do par que a barra aceita: o `onDrop` dela recusaria
		   depois, mas armar por engano acenderia a barra inteira à toa. */
		expect(pegar({ type: 'monstro', from: 'X', data: { SKID: 1 } })).toBe(false);
		expect(pendente()).toBe(null);
	});

	it('entregar ESVAZIA — o mesmo pegado nao vai ao servidor duas vezes', () => {
		pegar(HABILIDADE);
		expect(entregar()).toEqual(HABILIDADE);
		expect(entregar()).toBe(null);
		expect(pendente()).toBe(null);
	});

	it('pendente NAO esvazia — quem so quer pintar a tela nao rouba a carga', () => {
		pegar(HABILIDADE);
		expect(pendente()).toEqual(HABILIDADE);
		expect(pendente()).toEqual(HABILIDADE);
		expect(entregar()).toEqual(HABILIDADE);
	});

	it('cancelar e idempotente', () => {
		expect(cancelar()).toBe(false);
		pegar(HABILIDADE);
		expect(cancelar()).toBe(true);
		expect(cancelar()).toBe(false);
	});
});

describe('quem assina', () => {
	beforeEach(() => {
		esquecerTudo();
	});

	it('nasce sabendo o estado atual, e nao esperando a proxima mudanca', () => {
		pegar(HABILIDADE);
		const visto = [];
		assinar(carga => visto.push(carga));
		/* A barra de atalhos pode ser montada DEPOIS de o jogador pegar algo.
		   Se ela só soubesse da próxima mudança, nasceria apagada com algo na
		   mão — e o jogador não veria onde tocar. */
		expect(visto).toHaveLength(1);
		expect(visto[0]).toEqual(HABILIDADE);
	});

	it('e avisado ao pegar, ao trocar, ao cancelar e ao entregar', () => {
		const espiao = vi.fn();
		assinar(espiao);
		espiao.mockClear();

		pegar(HABILIDADE);
		pegar(OUTRA_HABILIDADE);
		cancelar();
		pegar(POCAO);
		entregar();

		expect(espiao).toHaveBeenCalledTimes(5);
		expect(espiao.mock.calls[2][0]).toBe(null);
		expect(espiao.mock.calls[4][0]).toBe(null);
	});

	it('desassinar realmente cala', () => {
		const espiao = vi.fn();
		const desassinar = assinar(espiao);
		espiao.mockClear();
		desassinar();
		pegar(HABILIDADE);
		expect(espiao).not.toHaveBeenCalled();
	});

	it('um assinante que EXPLODE nao impede os outros de saber', () => {
		/* A barra e o botão da árvore assinam o mesmo estado. Se o botão
		   quebrasse, a barra ficaria acesa sem nada na mão — ou apagada com
		   algo — dependendo da ordem de registro. */
		const bom = vi.fn();
		assinar(() => {
			throw new Error('assinante quebrado');
		});
		assinar(bom);
		bom.mockClear();
		expect(() => pegar(HABILIDADE)).not.toThrow();
		expect(bom).toHaveBeenCalledWith(HABILIDADE);
	});

	it('um assinante que se desassina DE DENTRO do aviso nao encurta o laco', () => {
		const depois = vi.fn();
		let sair;
		sair = assinar(() => sair());
		assinar(depois);
		depois.mockClear();
		pegar(HABILIDADE);
		expect(depois).toHaveBeenCalledWith(HABILIDADE);
	});
});

describe('o ESC e o voltar do Android', () => {
	beforeEach(() => {
		esquecerTudo();
	});

	it('com algo na mao, o escape DESARMA e consome o evento', () => {
		pegar(HABILIDADE);
		expect(Toque.aoEscapar()).toBe(true);
		expect(pendente()).toBe(null);
	});

	it('com a mao vazia ele nao consome nada — quem decide e a pilha de janelas', () => {
		expect(Toque.aoEscapar()).toBe(false);
	});
});
