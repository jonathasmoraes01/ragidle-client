/**
 * A janela de boas-vindas NAO abre quando a entrada vem da atualizacao
 * automatica (D-997). Pedido do dono, 23/09/2026: *"isso significa que o
 * player ja estava online e viu essa mesma janela anteriormente"*.
 *
 * O componente roda de verdade (`onAppend`), com o GUIComponent e as
 * preferencias falsificados: o que se mede e a decisao de mostrar, e nao o
 * desenho.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('UI/GUIComponent.js', () => ({
	default: class {
		static MouseMode = { CROSS: 0, STOP: 1, FREEZE: 2 };
		constructor(nome) {
			this.name = nome;
		}
	}
}));
vi.mock('Core/Preferences.js', () => ({
	default: { get: (_nome, padrao) => ({ ...padrao, save() {} }) }
}));
vi.mock('../../src/UI/Components/limpezaDeJanelaIdle.js', () => ({ fecharEEsquecer: () => {} }));

const { default: BoasVindasIdle } = await import('UI/Components/BoasVindasIdle/BoasVindasIdle.js');
const retomada = await import('Engine/retomadaAposAtualizacao.js');

let mostrou;
beforeEach(() => {
	mostrou = 0;
	BoasVindasIdle.mostrar = () => {
		mostrou++;
	};
	retomada.esquecerEntradaPorAtualizacao();
	BoasVindasIdle.limparEstadoDoPersonagem = BoasVindasIdle.limparEstadoDoPersonagem.bind(BoasVindasIdle);
	try {
		BoasVindasIdle.limparEstadoDoPersonagem();
	} catch {
		/* sem DOM do componente: so a trava interessa aqui */
	}
});

describe('a janela de boas-vindas e a atualizacao automatica', () => {
	it('entrada normal: a janela abre (CONTROLE)', () => {
		BoasVindasIdle.onAppend();
		expect(mostrou).toBe(1);
	});

	it('entrada que veio da atualizacao: a janela NAO abre', () => {
		retomada.marcarEntradaPorAtualizacao();
		BoasVindasIdle.onAppend();
		expect(mostrou).toBe(0);
	});

	it('a marca vale UMA entrada: entrar de novo com outro personagem mostra a janela', () => {
		retomada.marcarEntradaPorAtualizacao();
		BoasVindasIdle.onAppend();
		BoasVindasIdle.limparEstadoDoPersonagem();
		BoasVindasIdle.onAppend();
		expect(mostrou).toBe(1);
	});

	it('login digitado depois da marca (a retomada foi recusada): a janela abre', () => {
		retomada.marcarEntradaPorAtualizacao();
		retomada.esquecerEntradaPorAtualizacao();
		BoasVindasIdle.onAppend();
		expect(mostrou).toBe(1);
	});
});
