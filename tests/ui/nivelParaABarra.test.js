/**
 * O NIVEL QUE VAI PARA A BARRA, escolhido na janela de Habilidades (D-1908).
 *
 * Ate aqui a janela entregava a barra SEMPRE no aprendido. A escolha ("Nivel
 * de uso", acima de "Pôr na barra") vale para o toque e para o arrasto — os
 * dois saem do mesmo payload — e o maximo e o padrao.
 */
import { describe, expect, it } from 'vitest';
import {
	escolhasComPasso,
	htmlDoNivelParaABarra,
	nivelParaABarra,
	spPorNivelDaMecanica
} from '../../src/UI/Components/IdleSkills/nivelParaABarra.js';

const FIRE_BOLT = {
	skillId: 'MG_FIREBOLT',
	nome: 'Fire Bolt',
	aprendido: 10,
	mecanica: Array.from({ length: 10 }, (_, i) => ({ nivel: i + 1, sp: 12 + 2 * i }))
};

describe('o nivel que vai para a barra', () => {
	it('sem escolha, o aprendido', () => {
		expect(nivelParaABarra({}, FIRE_BOLT)).toBe(10);
	});

	it('com escolha, ela — presa ao aprendido e a 1', () => {
		expect(nivelParaABarra({ MG_FIREBOLT: 7 }, FIRE_BOLT)).toBe(7);
		expect(nivelParaABarra({ MG_FIREBOLT: 15 }, FIRE_BOLT)).toBe(10);
		expect(nivelParaABarra({ MG_FIREBOLT: 0 }, FIRE_BOLT)).toBe(1);
	});

	it('"−" desce e grava; "+" de volta ao maximo APAGA a escolha', () => {
		const baixou = escolhasComPasso({}, FIRE_BOLT, -1);
		expect(baixou).toEqual({ MG_FIREBOLT: 9 });
		expect(escolhasComPasso(baixou, FIRE_BOLT, 1)).toEqual({});
		// As escolhas de outra habilidade ficam.
		expect(escolhasComPasso({ AL_HEAL: 3 }, FIRE_BOLT, -1)).toEqual({ AL_HEAL: 3, MG_FIREBOLT: 9 });
	});

	it('nunca abaixo de 1', () => {
		expect(escolhasComPasso({ MG_FIREBOLT: 1 }, FIRE_BOLT, -1)).toEqual({ MG_FIREBOLT: 1 });
	});

	it('o SP por nivel sai da mecanica do servidor; nivel ausente vira buraco, e nao numero emprestado', () => {
		expect(spPorNivelDaMecanica(FIRE_BOLT).slice(0, 3)).toEqual([12, 14, 16]);
		const comBuraco = spPorNivelDaMecanica({ mecanica: [{ nivel: 1, sp: 5 }, { nivel: 3, sp: 9 }] });
		expect(comBuraco[0]).toBe(5);
		expect(comBuraco[1]).toBeUndefined();
		expect(comBuraco[2]).toBe(9);
	});
});

describe('o bloco "Nivel de uso" do detalhe', () => {
	function montar(html) {
		const caixa = document.createElement('div');
		caixa.innerHTML = html;
		return caixa;
	}

	it('aparece com o nivel escolhido, o SP dele e o selo fixo', () => {
		const el = montar(htmlDoNivelParaABarra(FIRE_BOLT, { MG_FIREBOLT: 7 }, true));
		expect(el.querySelector('.is-nivel-uso-rotulo').textContent).toBe('Nível de uso');
		expect(el.querySelector('[data-nivel-chave="barra.MG_FIREBOLT"]')).not.toBeNull();
		expect(el.querySelector('.ri-nivel-valor').textContent).toBe('Nv 7/10 · 24 SP');
		expect(el.querySelector('.ri-nivel-selo').textContent).toBe('fixo');
	});

	it('no maximo, o selo "máx" e o "+" apagado', () => {
		const el = montar(htmlDoNivelParaABarra(FIRE_BOLT, {}, true));
		expect(el.querySelector('.ri-nivel-selo').textContent).toBe('máx');
		expect(el.querySelector('[data-nivel-passo="1"]').disabled).toBe(true);
	});

	it('some quando a habilidade nao vai para a barra, ou tem um nivel so', () => {
		expect(htmlDoNivelParaABarra(FIRE_BOLT, {}, false)).toBe('');
		expect(htmlDoNivelParaABarra({ ...FIRE_BOLT, aprendido: 1 }, {}, true)).toBe('');
	});
});
