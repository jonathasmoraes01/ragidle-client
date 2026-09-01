/**
 * A JANELA DE REFINO PRECISA ESTAR LIGADA NA CONFIG (01/09/2026).
 *
 * Queixa do dono, com print: *"clico no Hollgrehenn e nao acontece nada"*.
 *
 * O refino inteiro ja existia dos DOIS lados — o servidor manda
 * `ZC_OPEN_REFINING_UI` quando o NPC e de refino
 * (`rag-idle-master/servidor/mapa/servidor-mapa.ts:21014`, provado por TCP em
 * `prove:refino` e `prove-ferreiro-na-casa`) e o cliente tem a janela inteira
 * (`src/UI/Components/Refine/`). Faltava UMA CHAVE de config, e sem ela:
 *
 *   - `Refine.prepare()` nunca roda (`src/Engine/MapEngine.js:539`);
 *   - `onOpenRefineUI` recebe o pacote e RETORNA
 *     (`src/UI/Components/Refine/Refine.js:371`), deixando so um
 *     `console.warn` que ninguem le enquanto joga.
 *
 * Clique mudo, servidor verde: e a forma catalogada "prova verde e jogador
 * vendo nada". Por isso o portao nao mede a janela — mede a CONFIG, que e onde
 * o defeito morava, nas DUAS bases que existem:
 *
 *   - `applications/pwa/Config.js`  -> o `npm run dev` (o que o dono joga aqui);
 *   - `applications/tools/builder-web.mjs` -> o `Config.js` que o build GERA
 *     para o `dist/Web`, que e o que vai para a v0 no Vercel.
 *
 * Consertar so a primeira deixaria a v0 com o clique mudo — foi o que quase
 * aconteceu.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Tira comentario do fonte ANTES de medir — a mesma razao registrada em
 * `memoriaDeAba.test.js`: sem isto, a PROSA deste arquivo (e a dos outros)
 * responderia pelos casos, e um portao que passa lendo comentario nao e um
 * portao.
 */
function semComentarios(fonte) {
	return fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

const CONFIG_DO_DEV = semComentarios(
	fs.readFileSync(path.join(RAIZ, 'applications', 'pwa', 'Config.js'), 'utf8')
);
const GERADOR_DO_BUILD = fs.readFileSync(
	path.join(RAIZ, 'applications', 'tools', 'builder-web.mjs'),
	'utf8'
);

describe('a janela de refino esta ligada', () => {
	it('o Config.js do dev liga `enableRefineUI`', () => {
		expect(
			/enableRefineUI:\s*true/.test(CONFIG_DO_DEV),
			'sem esta chave o clique no Ferreiro nao abre nada no `npm run dev`'
		).toBe(true);
	});

	it('o Config.js que o build GERA liga `enableRefineUI`', () => {
		expect(
			/enableRefineUI:\s*true/.test(GERADOR_DO_BUILD),
			'sem esta chave a v0 no Vercel fica com o clique mudo, mesmo com o dev certo'
		).toBe(true);
	});

	/**
	 * O PORTAO que vale daqui a um mes.
	 *
	 * Chave AUSENTE e chave `false`: `Configs.get` devolve `undefined` e o `if`
	 * do `MapEngine` nao roda. Foi assim que a loja de cash (`enableCashShop`,
	 * o comentario no proprio `Config.js`) e o refino sumiram — duas janelas
	 * inteiras, o mesmo sintoma, meses de distancia.
	 *
	 * Entao: toda janela que o `MapEngine` prepara atras de um `enable*` tem de
	 * ter a chave DEFINIDA na base. O valor e escolha (uma janela pode nascer
	 * desligada de proposito); o que nao pode e a chave nao existir, porque ai
	 * ninguem sabe que a janela existe.
	 *
	 * `forceUseAddress` e afins ficam de fora de proposito: nao sao portas de
	 * janela, sao opcoes de conexao que so o `Config.local.js` de cada ambiente
	 * responde.
	 */
	it('toda janela que o MapEngine abre atras de um `enable*` tem a chave na base', () => {
		const motor = fs.readFileSync(path.join(RAIZ, 'src', 'Engine', 'MapEngine.js'), 'utf8');
		const portas = [
			...new Set(
				[...motor.matchAll(/Configs\.get\('(enable[A-Za-z]+)'\)/g)].map(achado => achado[1])
			)
		];
		expect(portas.length, 'nenhuma porta encontrada — o `MapEngine` mudou de forma').toBeGreaterThan(
			0
		);
		const orfas = portas.filter(chave => !CONFIG_DO_DEV.includes(chave + ':'));
		expect(orfas, `chave sem valor na base = janela que nunca abre: ${orfas.join(', ')}`).toEqual(
			[]
		);
	});
});
