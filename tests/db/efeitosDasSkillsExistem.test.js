import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * V7 (07/10/2026): AS 15 SKILLS COM EFEITO/SOM QUEBRADO NO CLIENTE.
 *
 * `EffectManager.spam` e `spamSkillZone` voltam EM SILENCIO quando a chave nao existe
 * no EffectTable: a skill ficava sem efeito e sem som e ninguem via. Este portao le o
 * FONTE (o EffectTable importa o renderizador inteiro, o vitest nao o carrega) e exige,
 * para cada uma das 15:
 *   1. toda chave que SkillEffect.js/SkillUnit.js cita EXISTE no EffectTable.js;
 *   2. todo .wav e todo STR/SPR desses efeitos esta na lista de arquivos CONFERIDOS no
 *      GRF (tests/fixtures/assets-das-skills-verificados.json, feita com tools/grf).
 * O GRF nao mora neste repo, entao a conferencia de EXISTENCIA e contra essa lista:
 * apontar para outro arquivo reprova ate alguem conferi-lo no GRF e acrescenta-lo.
 */
const EFEITO = readFileSync('src/DB/Skills/SkillEffect.js', 'latin1').replace(/\r\n/g, '\n');
const UNIDADE = readFileSync('src/DB/Skills/SkillUnit.js', 'latin1').replace(/\r\n/g, '\n');
const CONST = readFileSync('src/DB/Effects/EffectConst.js', 'latin1').replace(/\r\n/g, '\n');
const TABELA = readFileSync('src/DB/Effects/EffectTable.js', 'latin1').replace(/\r\n/g, '\n');
const VERIFICADOS = new Set(
	JSON.parse(readFileSync('tests/fixtures/assets-das-skills-verificados.json', 'utf8')).arquivos.map(a =>
		a.toLowerCase()
	)
);

// skill -> unidade de chao que o servidor manda (SkillUnitConst), quando ha
const SKILLS = {
	AM_POTIONPITCHER: null,
	CR_SHRINK: null,
	MO_BALKYOUNG: null,
	MO_COMBOFINISH: null,
	RG_CLOSECONFINE: null,
	SA_DELUGE: 'UNT_DELUGE',
	SA_VIOLENTGALE: 'UNT_VIOLENTGALE',
	SA_LANDPROTECTOR: 'UNT_LANDPROTECTOR',
	SA_VOLCANO: 'UNT_VOLCANO',
	TF_SPRINKLESAND: null,
	HT_ANKLESNARE: 'UNT_ANKLESNARE',
	RG_GRAFFITI: 'UNT_GRAFFITI',
	HT_SHOCKWAVE: 'UNT_SHOCKWAVE',
	SA_ELEMENTWIND: null,
	SA_LIGHTNINGLOADER: null
};

// Unidade que e EF_NONE DE PROPOSITO: o grafite e um balao de fala (Entity.js onSkillAppear)
const SEM_EFEITO_DE_PROPOSITO = new Set(['UNT_GRAFFITI']);

const CHAVES_DA_TABELA = new Set(
	[...TABELA.matchAll(/^\t(?:'([^']+)'|([A-Za-z_]\w*|\d+)):\s*\[/gm)].map(m => m[1] ?? m[2])
);

function entradaDa(chave) {
	const i = TABELA.search(new RegExp(String.raw`^	(?:'${chave}'|${chave}):\s*\[`, 'm'));
	if (i < 0) return '';
	const j = TABELA.indexOf('\n\t],', i);
	return TABELA.slice(i, j < 0 ? undefined : j);
}

/** Chaves (numero ou texto) citadas no lado direito de SkillEffect[SK.NOME]. */
function chavesDoEfeito(nome) {
	const m = EFEITO.match(new RegExp(String.raw`^SkillEffect\[SK\.${nome}\] = (\{.*\});`, 'm'));
	expect(m, `${nome} sem entrada no SkillEffect.js`).not.toBeNull();
	const chaves = [];
	for (const campo of m[1].matchAll(/(\w*[Ee]ffectId\w*):\s*(\[[^\]]*\]|[^,}]+)/g)) {
		for (const v of campo[2].matchAll(/'([^']+)'|(\d+)/g)) chaves.push(v[1] ?? v[2]);
	}
	return chaves;
}

function chaveDaUnidade(unt) {
	const m = UNIDADE.match(new RegExp(String.raw`SkillUnit\[SU\.${unt}\] = (.+);`));
	expect(m, `${unt} sem entrada no SkillUnit.js`).not.toBeNull();
	const ec = m[1].match(/^EC\.(\w+)/);
	if (ec) {
		const c = CONST.match(new RegExp(String.raw`(?:^|\W)${ec[1]}:\s*(-?\d+)`, 'm'));
		expect(c, `${ec[1]} sem valor no EffectConst.js`).not.toBeNull();
		return { nome: ec[1], chave: c[1] };
	}
	return { nome: m[1], chave: m[1].replace(/['"]/g, '') };
}

describe('as 15 skills: toda chave de efeito resolve no EffectTable', () => {
	for (const [skill, unt] of Object.entries(SKILLS)) {
		it(`${skill}: SkillEffect nao cita chave inexistente`, () => {
			for (const chave of chavesDoEfeito(skill)) {
				expect(CHAVES_DA_TABELA.has(chave), `${skill} cita a chave '${chave}', que nao existe no EffectTable`).toBe(true);
			}
		});
		if (unt) {
			it(`${skill}: a unidade ${unt} resolve (ou e EF_NONE de proposito)`, () => {
				const { nome, chave } = chaveDaUnidade(unt);
				if (nome === 'EF_NONE') {
					expect(SEM_EFEITO_DE_PROPOSITO.has(unt), `${unt} e EF_NONE sem estar na lista de proposito`).toBe(true);
					return;
				}
				expect(CHAVES_DA_TABELA.has(chave), `${unt} aponta '${chave}', que nao existe no EffectTable`).toBe(true);
			});
		}
	}
});

describe('as 15 skills: os arquivos dos efeitos existem no GRF (lista conferida)', () => {
	const chaves = new Set();
	for (const [skill, unt] of Object.entries(SKILLS)) {
		chavesDoEfeito(skill).forEach(c => CHAVES_DA_TABELA.has(c) && chaves.add(c));
		if (unt) {
			const { nome, chave } = chaveDaUnidade(unt);
			if (nome !== 'EF_NONE' && CHAVES_DA_TABELA.has(chave)) chaves.add(chave);
		}
	}

	for (const chave of chaves) {
		it(`efeito ${chave}: wav, STR e SPR estao na lista conferida`, () => {
			const texto = entradaDa(chave);
			expect(texto, `entrada ${chave} vazia`).not.toBe('');
			// um bloco por parte do efeito: cada `{ ... }` de nivel 2
			for (const parte of texto.split(/\n\t\t\{/).slice(1)) {
				const tipo = (parte.match(/type:\s*'(\w+)'/) || [])[1];
				const arq = (parte.match(/\bfile:\s*'([^']+)'/) || [])[1];
				const wav = (parte.match(/\bwav:\s*'([^']+)'/) || [])[1];
				if (wav && !/%d/.test(wav)) {
					expect(VERIFICADOS.has(`data/wav/${wav}.wav`.toLowerCase()), `efeito ${chave}: wav 'data/wav/${wav}.wav' nao conferido no GRF`).toBe(true);
				}
				if (tipo === 'STR' && arq && !/%d/.test(arq)) {
					expect(VERIFICADOS.has(`data/texture/effect/${arq}.str`.toLowerCase()), `efeito ${chave}: STR '${arq}' nao conferido no GRF`).toBe(true);
				}
				if (tipo === 'SPR' && arq) {
					const pasta = '\u00c0\u00cc\u00c6\u00d1\u00c6\u00ae';
					expect(VERIFICADOS.has(`data/sprite/${pasta}/${arq}.spr`.toLowerCase()), `efeito ${chave}: SPR '${arq}' nao conferido no GRF`).toBe(true);
				}
			}
		});
	}

	it('o conjunto de efeitos conferido nao esta vazio (o portao nao pode passar no vazio)', () => {
		expect(chaves.size).toBeGreaterThanOrEqual(7);
	});
});
