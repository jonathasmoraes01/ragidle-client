/**
 * O NIVEL DE USO NA CONFIGURACAO IDLE (D-1906).
 *
 * A ordem de golpes, os buffs mantidos e a cura ganham o seletor
 * `[−] Nv 7/10 · 22 SP [+]`. Aqui se prova o que e da JANELA: o seletor so com
 * a capacidade do servidor, o que um "−"/"+" muda no rascunho, e o SP por
 * nivel que a barra de atalhos passa a conhecer.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
	aplicarPassoDeNivel,
	duracaoDaEntrada,
	lembrarSpDoContexto,
	nivelEscolhidoServido,
	seletorDaCura,
	seletorDaEntrada
} from '../../src/UI/Components/IdleConfig/nivelNaConfig.js';
import { spLembrado, _zerarNivelDeUso } from 'UI/nivelDeUso.js';

const SP_DO_BOLT = [12, 14, 16, 18, 20, 22, 24, 26, 28, 30];

function contexto(extra = {}) {
	return {
		capacidades: { nivelDeUsoEscolhido: true },
		skillsAtivas: [{ skillId: 'MG_FIREBOLT', aprendido: 10, custoSpPorNivel: SP_DO_BOLT }],
		skillsDeBuff: [{ skillId: 'AL_BLESSING', aprendido: 10, custoSpPorNivel: [28, 32, 36, 40, 44, 48, 52, 56, 60, 64] }],
		skillsDeCura: [
			{ skillId: 'AL_HEAL', aprendido: 10, custoSpPorNivel: [13, 16, 19, 22, 25, 28, 31, 34, 37, 40] },
			{ skillId: 'AM_POTIONPITCHER', aprendido: 5, gastaPocao: true, custoSpPorNivel: [1, 1, 1, 1, 1] }
		],
		...extra
	};
}

function montar(html) {
	const caixa = document.createElement('div');
	caixa.innerHTML = html;
	return caixa;
}

beforeEach(() => {
	_zerarNivelDeUso();
});

describe('o seletor so com a capacidade do servidor', () => {
	it('com a capacidade: o seletor, com o SP do nivel que sai hoje', () => {
		const ctx = contexto();
		const html = seletorDaEntrada({
			chave: 'rotacao.0',
			entrada: { skillId: 'MG_FIREBOLT', nivelDeUso: 10 },
			info: ctx.skillsAtivas[0],
			capaz: nivelEscolhidoServido(ctx),
			nome: 'Fire Bolt'
		});
		const el = montar(html);
		expect(el.querySelector('[data-nivel-chave="rotacao.0"]')).not.toBeNull();
		expect(el.querySelector('.ri-nivel-valor').textContent).toBe('Nv 10/10 · 30 SP');
	});

	it('SEM a capacidade (servidor velho): o selo antigo, so leitura — nada de "fixo" que ninguem cumpre', () => {
		const ctx = contexto({ capacidades: {} });
		expect(nivelEscolhidoServido(ctx)).toBe(false);
		const html = seletorDaEntrada({
			chave: 'rotacao.0',
			entrada: { skillId: 'MG_FIREBOLT', nivelDeUso: 7, nivelFixo: true },
			info: ctx.skillsAtivas[0],
			capaz: nivelEscolhidoServido(ctx),
			nome: 'Fire Bolt'
		});
		expect(html).toBe('<span class="ri-badge ri-badge--azul">Nv 7</span>');
	});

	it('a cura que gasta pocao e a de um nivel so nao tem seletor', () => {
		const ctx = contexto();
		expect(seletorDaCura({ cura: ctx.skillsDeCura[1], ajuste: { ligada: true }, capaz: true, nome: 'Aid Potion' })).toBe('');
		expect(seletorDaCura({ cura: { skillId: 'NV_FIRSTAID', aprendido: 1 }, ajuste: {}, capaz: true, nome: 'PS' })).toBe('');
	});

	it('a Curar com o nivel escolhido mostra o fixo e o SP DELE', () => {
		const ctx = contexto();
		const el = montar(seletorDaCura({ cura: ctx.skillsDeCura[0], ajuste: { ligada: true, nivelDeUso: 5 }, capaz: true, nome: 'Curar' }));
		expect(el.querySelector('[data-nivel-chave="cura.AL_HEAL"]')).not.toBeNull();
		expect(el.querySelector('.ri-nivel-valor').textContent).toBe('Nv 5/10 · 25 SP');
		expect(el.querySelector('.ri-nivel-selo').textContent).toBe('fixo');
	});
});

describe('o "−"/"+" muda o rascunho', () => {
	it('"−" na entrada que acompanha o 10 vai ao 9 FIXO e tira a marca automatica', () => {
		const cfg = { rotacao: [{ skillId: 'MG_FIREBOLT', nivelDeUso: 10, automatica: true }] };
		expect(aplicarPassoDeNivel(cfg, contexto(), 'rotacao.0', -1)).toBe(true);
		expect(cfg.rotacao[0]).toEqual({ skillId: 'MG_FIREBOLT', nivelDeUso: 9, nivelFixo: true });
	});

	it('"+" de volta ao 10 desfaz o fixo (acompanha de novo)', () => {
		const cfg = { rotacao: [{ skillId: 'MG_FIREBOLT', nivelDeUso: 9, nivelFixo: true }] };
		expect(aplicarPassoDeNivel(cfg, contexto(), 'rotacao.0', 1)).toBe(true);
		expect(cfg.rotacao[0]).toEqual({ skillId: 'MG_FIREBOLT', nivelDeUso: 10 });
	});

	it('o passo parte do que a entrada conjura HOJE, e nao do numero cru (a foto velha)', () => {
		// Gravado 3, sem a marca: conjura no 10 (D-635). O "−" vai ao 9, e nao ao 2.
		const cfg = { rotacao: [{ skillId: 'MG_FIREBOLT', nivelDeUso: 3 }] };
		aplicarPassoDeNivel(cfg, contexto(), 'rotacao.0', -1);
		expect(cfg.rotacao[0].nivelDeUso).toBe(9);
	});

	it('no maximo, "+" nao muda nada (e devolve false: nada a marcar como alterado)', () => {
		const cfg = { rotacao: [{ skillId: 'MG_FIREBOLT', nivelDeUso: 10 }] };
		expect(aplicarPassoDeNivel(cfg, contexto(), 'rotacao.0', 1)).toBe(false);
		expect(cfg.rotacao[0]).toEqual({ skillId: 'MG_FIREBOLT', nivelDeUso: 10 });
	});

	it('os buffs mantidos, com o alvo preservado', () => {
		const cfg = { rotacaoDeBuffs: [{ skillId: 'AL_BLESSING', nivelDeUso: 10, alvo: 'grupo' }] };
		expect(aplicarPassoDeNivel(cfg, contexto(), 'rotacaoDeBuffs.0', -1)).toBe(true);
		expect(cfg.rotacaoDeBuffs[0]).toEqual({ skillId: 'AL_BLESSING', nivelDeUso: 9, nivelFixo: true, alvo: 'grupo' });
	});

	it('a cura grava `nivelDeUso` no ajuste dela, e o interruptor e o alvo atravessam', () => {
		const cfg = { cura: { alvo: 'grupo', curarAbaixoDe: 50, habilidades: { AL_HEAL: { ligada: true, alvo: 'eu' } } } };
		expect(aplicarPassoDeNivel(cfg, contexto(), 'cura.AL_HEAL', -1)).toBe(true);
		expect(cfg.cura.habilidades.AL_HEAL).toEqual({ ligada: true, alvo: 'eu', nivelDeUso: 9 });
		expect(aplicarPassoDeNivel(cfg, contexto(), 'cura.AL_HEAL', 1)).toBe(true);
		expect(cfg.cura.habilidades.AL_HEAL).toEqual({ ligada: true, alvo: 'eu' });
	});

	it('a Aid Potion recusa (o servidor recusaria o campo nela)', () => {
		const cfg = { cura: { alvo: 'grupo', curarAbaixoDe: 50, habilidades: { AM_POTIONPITCHER: { ligada: true } } } };
		expect(aplicarPassoDeNivel(cfg, contexto(), 'cura.AM_POTIONPITCHER', -1)).toBe(false);
		expect(cfg.cura.habilidades.AM_POTIONPITCHER).toEqual({ ligada: true });
	});

	it('chave desconhecida ou entrada que nao existe nao mexe em nada', () => {
		const cfg = { rotacao: [{ skillId: 'MG_FIREBOLT', nivelDeUso: 10 }] };
		expect(aplicarPassoDeNivel(cfg, contexto(), 'rotacao.5', -1)).toBe(false);
		expect(aplicarPassoDeNivel(cfg, contexto(), 'outra.0', -1)).toBe(false);
		expect(cfg.rotacao).toEqual([{ skillId: 'MG_FIREBOLT', nivelDeUso: 10 }]);
	});
});

describe('o SP por nivel chega a barra', () => {
	it('o contexto da config ensina o SP de cada nivel para a dica dos slots', () => {
		lembrarSpDoContexto(contexto());
		expect(spLembrado('MG_FIREBOLT', 7)).toBe(24);
		expect(spLembrado('AL_BLESSING', 1)).toBe(28);
		expect(spLembrado('AL_HEAL', 10)).toBe(40);
	});
});

describe('o relogio do buff e o do nivel que ele conjura (D-1929)', () => {
	const info = { aprendido: 10, duracaoMs: 240000, duracaoMsPorNivel: [60000, 80000, 100000, 120000, 140000, 160000, 180000, 200000, 220000, 240000] };
	it('acompanhando o aprendido, vale a duracao do maximo', () => {
		expect(duracaoDaEntrada({ skillId: 'AL_BLESSING', nivelDeUso: 10 }, info)).toBe(240000);
	});
	it('fixado abaixo do maximo, vale a duracao do nivel fixado', () => {
		expect(duracaoDaEntrada({ skillId: 'AL_BLESSING', nivelDeUso: 3, nivelFixo: true }, info)).toBe(100000);
	});
	it('sem a lista por nivel (servidor antigo), cai na duracao do aprendido; sem info, null', () => {
		expect(duracaoDaEntrada({ skillId: 'X', nivelDeUso: 3, nivelFixo: true }, { aprendido: 10, duracaoMs: 5000 })).toBe(5000);
		expect(duracaoDaEntrada({ skillId: 'X', nivelDeUso: 3 }, undefined)).toBeNull();
	});
});
