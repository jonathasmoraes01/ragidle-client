/**
 * O RASCUNHO PODRE DEPOIS DO RESET (07/10/2026, D-2085 — o resto do relato de D-2084).
 *
 * Um Templario com a Curar na Config Idle resetou as habilidades e nao
 * conseguia mais ligar a caca. O servidor ja purga a config gravada (D-2084);
 * aqui fica a metade do cliente: o RASCUNHO (`editConfig`) sobrevive a recusa,
 * ao fechar e ao empurrao (com alteracao pendente so a base anda), e guardava a
 * habilidade que o reset levou. Com o reset TOTAL a lista de golpes nem e
 * desenhada, entao a entrada era invisivel e o Aplicar, recusado para sempre.
 *
 * O criterio e o que sai no FIO quando o jogador aperta Aplicar: so o que o
 * personagem tem, e a alteracao legitima dele preservada.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { podarRascunhoPeloContexto } from 'UI/Components/IdleConfig/rascunhoContraOContexto.js';

const mocks = vi.hoisted(() => ({
	enviados: [],
	hooks: [],
	network: {
		sendPacket: (p) => mocks.enviados.push(p),
		hookPacket: (_pkt, cb) => mocks.hooks.push(cb)
	}
}));

vi.mock('Network/NetworkManager.js', () => ({ default: mocks.network }));
vi.mock('Renderer/Renderer.js', () => ({ default: { render: vi.fn(), vsync: [] } }));
vi.mock('UI/UIManager.js', () => ({ default: { showErrorBox: vi.fn(), addComponent: (c) => c } }));
vi.mock('UI/Components/ChatBox/ChatBox.js', () => ({
	default: { addText: vi.fn(), TYPE: { ERROR: 1 }, FILTER: { PUBLIC_LOG: 1 } }
}));

const { default: htmlDoComponente } = await import('UI/Components/IdleConfig/IdleConfig.html?raw');
const { default: IdleConfig } = await import('UI/Components/IdleConfig/IdleConfig.js');

const copia = (o) => JSON.parse(JSON.stringify(o));

/** O que o Templario tinha ACEITO antes do reset. */
const ANTES = {
	cacaAutomatica: false,
	coletarItens: true,
	modoDeAtaque: 'skills-e-basico',
	rotacao: [{ skillId: 'CR_HOLYCROSS', nivelDeUso: 5 }],
	rotacaoDeBuffs: [{ skillId: 'AL_BLESSING', nivelDeUso: 10, alvo: 'grupo' }],
	cura: { alvo: 'grupo', curarAbaixoDe: 50, habilidades: { AL_HEAL: { ligada: true, alvo: 'grupo' } } },
	alvosDesabilitados: [],
	asa: { ligada: true, teleportarApos: 10 }
};

/** A config que o servidor purgou e serve depois do reset (D-2084). */
const DEPOIS = {
	...copia(ANTES),
	rotacao: [],
	rotacaoDeBuffs: [],
	cura: { alvo: 'grupo', curarAbaixoDe: 50, habilidades: {} }
};

/** O contexto do reset TOTAL: nenhum golpe, buff ou cura aprendido. */
const CONTEXTO_ZERADO = { ehCidade: false, skillsAtivas: [], skillsPassivas: [], skillsDeBuff: [], skillsDeCura: [] };

const receber = (corpo) => mocks.hooks[0]({ json: JSON.stringify(corpo) });
const aplicar = () => {
	// O MESMO caminho do botao Aplicar (`onClickApply` -> `applyConfig`).
	IdleConfig.aplicarConfig();
	return JSON.parse(mocks.enviados[mocks.enviados.length - 1].json);
};

describe('o rascunho depois do reset de habilidades', () => {
	beforeEach(() => {
		mocks.enviados.length = 0;
		IdleConfig._host = document.createElement('div');
		IdleConfig._host.innerHTML = htmlDoComponente;
		IdleConfig._shadow = null;
		IdleConfig.serverConfig = copia(ANTES);
		// O jogador mexeu em outra coisa e nao aplicou: o rascunho esta SUJO.
		IdleConfig.editConfig = { ...copia(ANTES), coletarItens: false };
		IdleConfig.dirty = true;
		IdleConfig.contexto = {
			ehCidade: false,
			skillsAtivas: [{ skillId: 'CR_HOLYCROSS', aprendido: 5, nome: 'Cruz Sagrada' }],
			skillsPassivas: [],
			skillsDeBuff: [{ skillId: 'AL_BLESSING', aprendido: 10, mantivel: true }],
			skillsDeCura: [{ skillId: 'AL_HEAL', aprendido: 10 }]
		};
	});

	it('o empurrao do servidor depois do reset tira do rascunho o que o reset levou, e o Aplicar sai valido', () => {
		receber({ v: 1, config: copia(DEPOIS), contexto: CONTEXTO_ZERADO });

		const enviado = aplicar();
		expect(enviado.rotacao, 'a Cruz Sagrada que o reset levou voltou no Aplicar').toEqual([]);
		expect(enviado.rotacaoDeBuffs).toEqual([]);
		expect(Object.keys(enviado.cura.habilidades), 'a Curar podre voltou no Aplicar').toEqual([]);
		expect(enviado.modoDeAtaque).toBe('skills-e-basico');
		// A alteracao LEGITIMA do jogador nao se perde.
		expect(enviado.coletarItens).toBe(false);
		expect(IdleConfig.dirty).toBe(true);
	});

	it('a RECUSA tambem poda: o Aplicar seguinte manda o que o servidor aceita', () => {
		receber({
			v: 1,
			aplicado: false,
			problemas: ['rotacao.0: "CR_HOLYCROSS" nao e uma skill de ataque aprendida'],
			config: copia(DEPOIS),
			contexto: CONTEXTO_ZERADO
		});

		const enviado = aplicar();
		expect(enviado.rotacao).toEqual([]);
		expect(enviado.cura.habilidades).toEqual({});
		expect(enviado.coletarItens).toBe(false);
	});

	it('podado ate ficar igual ao servidor, o rascunho deixa de estar sujo', () => {
		IdleConfig.editConfig = copia(ANTES);
		receber({ v: 1, config: copia(DEPOIS), contexto: CONTEXTO_ZERADO });
		expect(IdleConfig.editConfig).toEqual(DEPOIS);
		expect(IdleConfig.dirty).toBe(false);
	});

	it('NAO reescreve escolha: quem marcou "Nunca dar o golpe basico" continua marcado, e o servidor responde com o motivo', () => {
		const comACaixa = { ...copia(ANTES), modoDeAtaque: 'apenas-skills' };
		IdleConfig.serverConfig = copia(comACaixa);
		IdleConfig.editConfig = { ...copia(comACaixa), coletarItens: false };
		receber({ v: 1, config: { ...copia(DEPOIS), modoDeAtaque: 'apenas-skills' }, contexto: CONTEXTO_ZERADO });

		const enviado = aplicar();
		expect(enviado.rotacao).toEqual([]);
		// A caixa continua marcada: quem a desmarca e o jogador (a recusa de D-407 diz como).
		expect(enviado.modoDeAtaque).toBe('apenas-skills');
	});

	it('NAO reescreve escolha: o nivel escolhido acima do aprendido de hoje vai no Aplicar como esta (D-1905)', () => {
		const ctx = {
			...CONTEXTO_ZERADO,
			skillsAtivas: [{ skillId: 'CR_HOLYCROSS', aprendido: 3 }],
			skillsDeCura: [{ skillId: 'AL_HEAL', aprendido: 5 }]
		};
		IdleConfig.editConfig = {
			...copia(ANTES),
			coletarItens: false,
			rotacao: [{ skillId: 'CR_HOLYCROSS', nivelDeUso: 5, nivelFixo: true }],
			cura: { alvo: 'grupo', curarAbaixoDe: 50, habilidades: { AL_HEAL: { ligada: true, nivelDeUso: 7 } } }
		};
		receber({ v: 1, config: copia(ANTES), contexto: ctx });

		const enviado = aplicar();
		expect(enviado.rotacao).toEqual([{ skillId: 'CR_HOLYCROSS', nivelDeUso: 5, nivelFixo: true }]);
		expect(enviado.cura.habilidades.AL_HEAL).toEqual({ ligada: true, nivelDeUso: 7 });
	});

	it('o que o personagem ainda tem fica intacto, inclusive com o rascunho sujo', () => {
		const ctx = {
			...CONTEXTO_ZERADO,
			skillsAtivas: [{ skillId: 'CR_HOLYCROSS', aprendido: 5 }],
			skillsDeBuff: [{ skillId: 'AL_BLESSING', aprendido: 10, mantivel: true }],
			skillsDeCura: [{ skillId: 'AL_HEAL', aprendido: 10 }]
		};
		receber({ v: 1, config: copia(ANTES), contexto: ctx });
		expect(IdleConfig.editConfig).toEqual({ ...ANTES, coletarItens: false });
	});
});

describe('podarRascunhoPeloContexto (a regra)', () => {
	const ctx = {
		skillsAtivas: [{ skillId: 'A', aprendido: 3 }, { skillId: 'B', aprendido: 10 }],
		skillsDeBuff: [{ skillId: 'BUFF', aprendido: 5, mantivel: true }, { skillId: 'DUETO', aprendido: 5, mantivel: false }],
		skillsDeCura: [{ skillId: 'AL_HEAL', aprendido: 4 }]
	};

	it('nada a tirar devolve null', () => {
		const cfg = { rotacao: [{ skillId: 'B', nivelDeUso: 10 }], rotacaoDeBuffs: [{ skillId: 'BUFF', nivelDeUso: 5 }], cura: { habilidades: { AL_HEAL: { ligada: true } } } };
		expect(podarRascunhoPeloContexto(cfg, ctx)).toBeNull();
	});

	it('NAO apara o nivel acima do aprendido: a escolha fica, e quem conjura e desenha usa o min', () => {
		const cfg = {
			rotacao: [{ skillId: 'A', nivelDeUso: 10, nivelFixo: true }],
			cura: { habilidades: { AL_HEAL: { ligada: true, nivelDeUso: 10 } } }
		};
		expect(podarRascunhoPeloContexto(cfg, ctx)).toBeNull();
	});

	it('podar nao mexe no rascunho original', () => {
		const cfg = { rotacao: [{ skillId: 'A' }, { skillId: 'X' }], cura: { habilidades: { AL_HEAL: {}, Z: {} } } };
		const podado = podarRascunhoPeloContexto(cfg, ctx);
		expect(podado.rotacao).toEqual([{ skillId: 'A' }]);
		expect(podado.cura.habilidades).toEqual({ AL_HEAL: {} });
		expect(cfg.rotacao.length, 'mexeu no rascunho original').toBe(2);
		expect(Object.keys(cfg.cura.habilidades)).toEqual(['AL_HEAL', 'Z']);
	});

	it('a cura que perde todas as chaves fica com habilidades: {} (o campo presente continua presente)', () => {
		const podado = podarRascunhoPeloContexto({ cura: { alvo: 'eu', habilidades: { Z: {} } } }, ctx);
		expect(podado.cura).toEqual({ alvo: 'eu', habilidades: {} });
	});

	it('o buff que nao e mantivel sai da rotacao de buffs', () => {
		const cfg = { rotacaoDeBuffs: [{ skillId: 'DUETO', nivelDeUso: 5 }, { skillId: 'BUFF', nivelDeUso: 5 }] };
		expect(podarRascunhoPeloContexto(cfg, ctx).rotacaoDeBuffs).toEqual([{ skillId: 'BUFF', nivelDeUso: 5 }]);
	});

	it('mantem a ordem do que fica', () => {
		const cfg = { rotacao: [{ skillId: 'B' }, { skillId: 'X' }, { skillId: 'A' }] };
		expect(podarRascunhoPeloContexto(cfg, ctx).rotacao.map(r => r.skillId)).toEqual(['B', 'A']);
	});

	it('o modo NAO e assunto da poda: apenas-skills fica, mesmo quando a poda esvazia a rotacao', () => {
		expect(podarRascunhoPeloContexto({ modoDeAtaque: 'apenas-skills', rotacao: [{ skillId: 'X' }] }, ctx).modoDeAtaque).toBe('apenas-skills');
		expect(podarRascunhoPeloContexto({ modoDeAtaque: 'apenas-skills', rotacao: [] }, ctx)).toBeNull();
	});

	it('lista ausente no contexto nao poda nada (servidor velho, contexto magro)', () => {
		const cfg = { modoDeAtaque: 'apenas-skills', rotacao: [{ skillId: 'X' }], rotacaoDeBuffs: [{ skillId: 'Y' }], cura: { habilidades: { Z: {} } } };
		expect(podarRascunhoPeloContexto(cfg, { ehCidade: false })).toBeNull();
	});

	it('a forma errada fica para a validacao do servidor responder', () => {
		const cfg = { rotacao: [null, { skillId: 7 }] };
		expect(podarRascunhoPeloContexto(cfg, ctx)).toBeNull();
	});
});
