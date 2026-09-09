/**
 * As regras sem DOM da Configuração idle redesenhada (D-915): as seções, os
 * apelidos das abas antigas, os resumos do trilho, a contagem de alterações e
 * a cura que mora na rotação.
 */
import { describe, expect, it } from 'vitest';
import {
	ABAS_ACEITAS,
	ABA_PADRAO,
	SECOES,
	TETO_DA_ORDEM,
	TETO_DE_BUFFS,
	abaCanonica,
	alternarCura,
	alvoDoBuff,
	contarAlteracoes,
	curaNaRotacao,
	duracaoCurta,
	resumoDaSecao,
	curaLigada,
	curaLigadaPara,
} from '../../src/UI/Components/IdleConfig/secoesDaConfig.js';

const CTX = {
	ehCidade: false,
	mobsDoMapa: [
		{ mobId: 1002, nome: 'Poring' },
		{ mobId: 1113, nome: 'Drops' },
		{ mobId: 1031, nome: 'Poporing' }
	],
	skillsDeCura: [{ skillId: 'AL_HEAL', aprendido: 5, custoSp: 25, alcancaGrupo: true }]
};

const CFG = {
	cacaAutomatica: true,
	coletarItens: true,
	alvosDesabilitados: [1113],
	rotacao: [{ skillId: 'AL_HEAL', nivelDeUso: 5 }, { skillId: 'MG_FIREBOLT', nivelDeUso: 3 }],
	rotacaoDeBuffs: [{ skillId: 'AL_BLESSING', nivelDeUso: 5, alvo: 'grupo' }],
	modoDeAtaque: 'skills-e-basico',
	descanso: { ligado: true },
	pocaoDeHp: { ligado: true },
	pocaoDeSp: { ligado: false },
	usarBuffsDeItem: false,
	cura: { alvo: 'grupo', curarAbaixoDe: 50 }
};

describe('as seções e os apelidos das abas antigas', () => {
	it('são cinco, na ordem do que o autômato faz, e a padrão é a Caçada', () => {
		expect(SECOES.map(s => s.id)).toEqual(['caca', 'ataque', 'suporte', 'sobrevivencia', 'consumiveis']);
		expect(ABA_PADRAO).toBe('caca');
	});

	it('cada aba antiga cai na seção que herdou o conteúdo dela', () => {
		expect(abaCanonica('geral')).toBe('caca');
		expect(abaCanonica('alvos')).toBe('caca');
		expect(abaCanonica('skills')).toBe('ataque');
		expect(abaCanonica('recuperacao')).toBe('sobrevivencia');
		expect(abaCanonica('itens')).toBe('consumiveis');
	});

	it('id novo passa intacto; desconhecido cai no padrão', () => {
		expect(abaCanonica('suporte')).toBe('suporte');
		expect(abaCanonica('aposentada')).toBe('caca');
		expect(abaCanonica(undefined)).toBe('caca');
	});

	it('a lista aceita pela memória de aba tem as novas E as antigas', () => {
		expect(ABAS_ACEITAS).toContain('suporte');
		expect(ABAS_ACEITAS).toContain('alvos');
	});
});

describe('os resumos do trilho', () => {
	it('Caçada conta as presas marcadas — e diz "na cidade" onde não há caça', () => {
		expect(resumoDaSecao('caca', CFG, CTX)).toBe('2/3 presas');
		expect(resumoDaSecao('caca', CFG, { ...CTX, ehCidade: true })).toBe('na cidade');
		expect(resumoDaSecao('caca', CFG, { ...CTX, mobsDoMapa: [] })).toBe('sem presas aqui');
	});

	it('Ataque conta os golpes e marca o modo sem básico', () => {
		expect(resumoDaSecao('ataque', CFG, CTX)).toBe('2 golpes');
		expect(resumoDaSecao('ataque', { ...CFG, rotacao: [] }, CTX)).toBe('só o básico');
		expect(resumoDaSecao('ataque', { ...CFG, rotacao: [CFG.rotacao[0]], modoDeAtaque: 'apenas-skills' }, CTX)).toBe(
			'1 golpe · sem básico'
		);
	});

	it('Suporte diz buffs e cura — ou "nada mantido"', () => {
		expect(resumoDaSecao('suporte', CFG, CTX)).toBe('1 buff · cura');
		// 08/09/2026: a cura e SUPORTE e nao mora mais na ordem de golpes — tirar
		// a habilidade da `rotacao` nao a desliga; o interruptor e `cura.ligada`.
		expect(resumoDaSecao('suporte', { ...CFG, rotacao: [] }, CTX)).toBe('1 buff · cura');
		expect(
			resumoDaSecao('suporte', { ...CFG, rotacaoDeBuffs: [], rotacao: [], cura: { ...(CFG.cura || {}), ligada: false } }, CTX)
		).toBe('nada mantido');
	});

	it('Sobrevivência lista o que está ligado', () => {
		expect(resumoDaSecao('sobrevivencia', CFG, CTX)).toBe('senta · poção HP');
		expect(
			resumoDaSecao('sobrevivencia', { ...CFG, descanso: { ligado: false }, pocaoDeHp: { ligado: false } }, CTX)
		).toBe('desligada');
	});

	it('Consumíveis e o vazio', () => {
		expect(resumoDaSecao('consumiveis', CFG, CTX)).toBe('desligado');
		expect(resumoDaSecao('consumiveis', { ...CFG, usarBuffsDeItem: true }, CTX)).toBe('buffs de item');
		expect(resumoDaSecao('caca', null, CTX)).toBe('');
	});
});

describe('a cura mora na rotação', () => {
	it('acha a entrada de cura pela lista do servidor', () => {
		expect(curaNaRotacao(CFG, CTX)).toEqual({ skillId: 'AL_HEAL', nivelDeUso: 5 });
		expect(curaNaRotacao({ ...CFG, rotacao: [] }, CTX)).toBeNull();
		expect(curaNaRotacao(CFG, {})).toBeNull();
	});

	it('ligar põe a cura na PRIMEIRA vaga; desligar tira só ela', () => {
		const sem = { ...CFG, rotacao: [{ skillId: 'MG_FIREBOLT', nivelDeUso: 3 }] };
		expect(alternarCura(sem, CTX, true)).toEqual([
			{ skillId: 'AL_HEAL', nivelDeUso: 5 },
			{ skillId: 'MG_FIREBOLT', nivelDeUso: 3 }
		]);
		expect(alternarCura(CFG, CTX, false)).toEqual([{ skillId: 'MG_FIREBOLT', nivelDeUso: 3 }]);
	});

	it('ligar já ligada não duplica; ligar sem vaga ou sem habilidade devolve null', () => {
		expect(alternarCura(CFG, CTX, true)).toEqual(CFG.rotacao);
		const cheia = {
			...CFG,
			rotacao: [
				{ skillId: 'A', nivelDeUso: 1 },
				{ skillId: 'B', nivelDeUso: 1 },
				{ skillId: 'C', nivelDeUso: 1 }
			]
		};
		expect(alternarCura(cheia, CTX, true)).toBeNull();
		expect(alternarCura({ ...CFG, rotacao: [] }, { skillsDeCura: [] }, true)).toBeNull();
	});
});

describe('miúdos', () => {
	it('o alvo de um buff sem campo é grupo (P2), e só "eu" diz eu', () => {
		expect(alvoDoBuff({ skillId: 'X', nivelDeUso: 1 })).toBe('grupo');
		expect(alvoDoBuff({ skillId: 'X', nivelDeUso: 1, alvo: 'eu' })).toBe('eu');
		expect(alvoDoBuff({ skillId: 'X', nivelDeUso: 1, alvo: 'inventado' })).toBe('grupo');
	});

	it('conta alterações por CAMPO — marcar e desmarcar a mesma presa dá zero', () => {
		expect(contarAlteracoes(CFG, CFG)).toBe(0);
		expect(contarAlteracoes(CFG, { ...CFG, alvosDesabilitados: [] })).toBe(1);
		expect(contarAlteracoes(CFG, { ...CFG, alvosDesabilitados: [], coletarItens: false })).toBe(2);
		expect(contarAlteracoes(null, CFG)).toBe(0);
	});

	it('a duração curta arredonda para minuto ou segundo', () => {
		expect(duracaoCurta(60000)).toBe('1 min');
		expect(duracaoCurta(120000)).toBe('2 min');
		expect(duracaoCurta(10000)).toBe('10 s');
		expect(duracaoCurta(0)).toBe('');
	});
});

describe('os dois tetos (D-917)', () => {
	it('a ordem de golpes fica em 3 (o que a doca desenha) e os buffs sobem para 6', () => {
		expect(TETO_DA_ORDEM).toBe(3);
		expect(TETO_DE_BUFFS).toBe(6);
	});

	it('a cura respeita o teto da ORDEM, e não o dos buffs', () => {
		const cheia = { ...CFG, rotacao: Array.from({ length: TETO_DA_ORDEM }, (_, i) => ({ skillId: `G${i}`, nivelDeUso: 1 })) };
		expect(alternarCura(cheia, CTX, true)).toBeNull();
		const comVaga = { ...CFG, rotacao: cheia.rotacao.slice(0, TETO_DA_ORDEM - 1) };
		expect(alternarCura(comVaga, CTX, true)).toHaveLength(TETO_DA_ORDEM);
	});
});

describe('a cura e configurada POR HABILIDADE (08/09/2026, ordem do dono)', () => {
	const DUAS = { skillsDeCura: [{ skillId: 'AL_HEAL', aprendido: 3, custoSp: 21, alcancaGrupo: true }, { skillId: 'NV_FIRSTAID', aprendido: 1, custoSp: 5, alcancaGrupo: false }] };

	it('Primeiros Socorros desligado e Curar ligado: a secao continua com cura', () => {
		const cfg = { cura: { alvo: 'grupo', curarAbaixoDe: 50, habilidades: { NV_FIRSTAID: { ligada: false }, AL_HEAL: { ligada: true } } } };
		expect(curaLigadaPara(cfg.cura, 'NV_FIRSTAID')).toBe(false);
		expect(curaLigadaPara(cfg.cura, 'AL_HEAL')).toBe(true);
		expect(curaLigada(cfg, DUAS)).toBe(true);
	});

	it('as duas desligadas: sem cura no resumo', () => {
		const cfg = { cura: { alvo: 'grupo', curarAbaixoDe: 50, habilidades: { NV_FIRSTAID: { ligada: false }, AL_HEAL: { ligada: false } } } };
		expect(curaLigada(cfg, DUAS)).toBe(false);
	});

	it('habilidade sem entrada propria herda o interruptor geral', () => {
		expect(curaLigadaPara({ alvo: 'eu', curarAbaixoDe: 50, ligada: false }, 'AL_HEAL')).toBe(false);
		expect(curaLigadaPara({ alvo: 'eu', curarAbaixoDe: 50 }, 'AL_HEAL')).toBe(true);
		expect(curaLigadaPara(undefined, 'AL_HEAL')).toBe(true);
	});
});
