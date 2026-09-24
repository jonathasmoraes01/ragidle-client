import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { deveEncolherAoApanhar, acoesDeAtaqueDa } from 'Engine/MapEngine/encolherAoApanhar.js';

// Os ids de acao do TYPE_PC (EntityAction.js): ATTACK=-2 (resolvido na hora),
// ATTACK1=5, HURT=6, ATTACK2=10, ATTACK3=11, IDLE=0, WALK=1, SIT=2,
// READYFIGHT=4, SKILL=12.
const ACTION_PC = { IDLE: 0, WALK: 1, SIT: 2, READYFIGHT: 4, ATTACK: -2, ATTACK1: 5, HURT: 6, ATTACK2: 10, ATTACK3: 11, SKILL: 12 };
// Monstro (TYPE_MOB): ATTACK=2, HURT=3, ATTACK2=5, ATTACK3=6 (e ATTACK1 nao mapeado).
const ACTION_MOB = { IDLE: 0, WALK: 1, ATTACK: 2, HURT: 3, ATTACK1: -1, ATTACK2: 5, ATTACK3: 6 };

const ataquesPC = acoesDeAtaqueDa(ACTION_PC);

describe('o golpe do monstro nao corta o golpe do jogador (24/09/2026)', () => {
	it('o JOGADOR LOCAL no meio do balanco (ATTACK1/2/3) NAO encolhe', () => {
		for (const acao of [ACTION_PC.ATTACK1, ACTION_PC.ATTACK2, ACTION_PC.ATTACK3]) {
			expect(
				deveEncolherAoApanhar({ ehOJogadorLocal: true, acaoAtual: acao, animacaoAcabou: false, acoesDeAtaque: ataquesPC })
			).toBe(false);
		}
	});

	it('CONTROLE: o mesmo balanco num MONSTRO ou outro jogador continua encolhendo', () => {
		for (const acao of [ACTION_PC.ATTACK1, ACTION_PC.ATTACK2, ACTION_PC.ATTACK3]) {
			expect(
				deveEncolherAoApanhar({ ehOJogadorLocal: false, acaoAtual: acao, animacaoAcabou: false, acoesDeAtaque: ataquesPC })
			).toBe(true);
		}
		expect(
			deveEncolherAoApanhar({
				ehOJogadorLocal: false,
				acaoAtual: ACTION_MOB.ATTACK,
				animacaoAcabou: false,
				acoesDeAtaque: acoesDeAtaqueDa(ACTION_MOB)
			})
		).toBe(true);
	});

	it('o jogador local PARADO, ANDANDO, sentado, em guarda ou conjurando encolhe como sempre', () => {
		for (const acao of [ACTION_PC.IDLE, ACTION_PC.WALK, ACTION_PC.SIT, ACTION_PC.READYFIGHT, ACTION_PC.SKILL, ACTION_PC.HURT]) {
			expect(
				deveEncolherAoApanhar({ ehOJogadorLocal: true, acaoAtual: acao, animacaoAcabou: false, acoesDeAtaque: ataquesPC })
			).toBe(true);
		}
	});

	it('o ataque que JA ACABOU (ultimo quadro, esperando o READYFIGHT) nao protege', () => {
		expect(
			deveEncolherAoApanhar({ ehOJogadorLocal: true, acaoAtual: ACTION_PC.ATTACK1, animacaoAcabou: true, acoesDeAtaque: ataquesPC })
		).toBe(true);
	});

	it('ids nao mapeados (-1/-2) nao contam como ataque — -1 e o HURT/IDLE indefinido de alguns tipos', () => {
		expect(
			deveEncolherAoApanhar({ ehOJogadorLocal: true, acaoAtual: -1, animacaoAcabou: false, acoesDeAtaque: [-2, -1, -1, -1] })
		).toBe(true);
	});
});

describe('a costura em onEntityWillBeHitSub', () => {
	const fonte = readFileSync('src/Engine/MapEngine/Entity.js', 'utf8');
	const inicio = fonte.indexOf('function onEntityWillBeHitSub');
	const fim = fonte.indexOf('function resumeWalk', inicio);
	const trecho = fonte.slice(inicio, fim);

	it('o impacto consulta a regra ANTES do setAction(HURT), e sabe quem e o jogador local', () => {
		expect(inicio).toBeGreaterThan(0);
		expect(fim).toBeGreaterThan(inicio);
		const consulta = trecho.indexOf('deveEncolherAoApanhar(');
		const hurt = trecho.indexOf('ACTION.HURT');
		expect(consulta).toBeGreaterThan(0);
		expect(hurt).toBeGreaterThan(consulta);
		expect(trecho).toMatch(/dstEntity\.GID === Session\.Entity\.GID/);
		expect(trecho).toMatch(/animation\.play === false/);
	});

	it('a consulta mora DENTRO do impendingAttack (lida no impacto, e nao ao agendar)', () => {
		const impacto = trecho.indexOf('function impendingAttack');
		expect(impacto).toBeGreaterThan(0);
		expect(trecho.indexOf('deveEncolherAoApanhar(')).toBeGreaterThan(impacto);
	});
});
