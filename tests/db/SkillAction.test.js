// D-700: Double Strafe fazia animacao de soco no Arqueiro.
//
// A causa: SkillAction.js pregava AC_DOUBLE (e ASC_BREAKER/HT_PHANTASMIC) no
// quadro ATTACK3, mas qual dos tres quadros de ataque e o do ARCO muda por
// classe (WeaponAction.js): no Arqueiro arco = 1 (ATTACK2) e ATTACK3 e a
// adaga — o "soco" do print. A correcao manda essas skills para ACTION.ATTACK,
// o sentinela que setAction (EntityAction.js) resolve pela arma equipada via
// getWeaponAction — o mesmo caminho do ataque basico e do AC_SHOWER.
// MO_TRIPLEATTACK entra pelo mesmo motivo: o motor o emite como golpe de skill
// e sem entrada ele caia no DEFAULT (pose de conjuracao no meio do combo).
import { describe, it, expect } from 'vitest';
import SkillAction from 'DB/Skills/SkillAction.js';
import SK from 'DB/Skills/SkillConst.js';
import WeaponAction from 'DB/Jobs/WeaponAction.js';
import JobId from 'DB/Jobs/JobConst.js';
import WeaponType from 'DB/Items/WeaponType.js';

// Os indices de acao de um sprite de jogador (EntityAction.js, TYPE_PC)
function entidadeDeJogador() {
	return {
		ACTION: {
			IDLE: 0,
			ATTACK: -2, // sentinela: setAction resolve pela arma
			ATTACK1: 5,
			ATTACK2: 10,
			ATTACK3: 11,
			SKILL: 12,
			READYFIGHT: 4
		}
	};
}

// Replica da resolucao de EntityAction.js:88-91
function quadroResolvido(entidade, indiceDaArma) {
	return [entidade.ACTION.ATTACK1, entidade.ACTION.ATTACK2, entidade.ACTION.ATTACK3][indiceDaArma];
}

describe('SkillAction — skills de golpe fisico resolvem a animacao pela arma (D-700)', () => {
	const skillsResolvidasPelaArma = [
		['AC_DOUBLE', SK.AC_DOUBLE],
		['HT_PHANTASMIC', SK.HT_PHANTASMIC],
		['ASC_BREAKER', SK.ASC_BREAKER],
		['MO_TRIPLEATTACK', SK.MO_TRIPLEATTACK],
		['AC_SHOWER', SK.AC_SHOWER],
		['AC_CHARGEARROW', SK.AC_CHARGEARROW],
		['MO_CHAINCOMBO', SK.MO_CHAINCOMBO]
	];

	it.each(skillsResolvidasPelaArma)('%s devolve ACTION.ATTACK (resolvida pela arma)', (_nome, skid) => {
		const entidade = entidadeDeJogador();
		const acao = SkillAction[skid](entidade, 0);
		expect(acao.action).toBe(entidade.ACTION.ATTACK);
	});

	it('Arqueiro com arco: o quadro final e ATTACK2 (arco na mao), nao ATTACK3 (adaga)', () => {
		const entidade = entidadeDeJogador();
		const indice = WeaponAction[JobId.ARCHER][WeaponType.BOW];
		expect(indice).toBe(1);
		expect(quadroResolvido(entidade, indice)).toBe(entidade.ACTION.ATTACK2);
	});

	it('Cacador com arco: o quadro final continua ATTACK3 (nada mudou para ele)', () => {
		const entidade = entidadeDeJogador();
		const indice = WeaponAction[JobId.HUNTER][WeaponType.BOW];
		expect(indice).toBe(2);
		expect(quadroResolvido(entidade, indice)).toBe(entidade.ACTION.ATTACK3);
	});

	it('Assassino: katar cai em ATTACK3 e adaga em ATTACK2 — por isso ASC_BREAKER nao pode ser pregada', () => {
		const entidade = entidadeDeJogador();
		expect(quadroResolvido(entidade, WeaponAction[JobId.ASSASSIN][WeaponType.KATAR])).toBe(
			entidade.ACTION.ATTACK3
		);
		expect(quadroResolvido(entidade, WeaponAction[JobId.ASSASSIN][WeaponType.SHORTSWORD])).toBe(
			entidade.ACTION.ATTACK2
		);
	});

	it('Monge de mao vazia: MO_TRIPLEATTACK resolve para ATTACK1 (soco), nao para a pose de conjuracao', () => {
		const entidade = entidadeDeJogador();
		const indice = WeaponAction[JobId.MONK][WeaponType.NONE];
		expect(quadroResolvido(entidade, indice)).toBe(entidade.ACTION.ATTACK1);
	});

	it('SN_SHARPSHOOTING (fora do jogo) segue pregada em ATTACK3, como no upstream', () => {
		const entidade = entidadeDeJogador();
		expect(SkillAction[SK.SN_SHARPSHOOTING](entidade, 0).action).toBe(entidade.ACTION.ATTACK3);
	});
});
