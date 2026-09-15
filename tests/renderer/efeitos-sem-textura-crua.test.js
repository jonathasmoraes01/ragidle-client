/**
 * NENHUM EFEITO DE HABILIDADE CARREGA TEXTURA CRUA (15/09/2026, D-1412).
 *
 * ---------------------------------------------------------------------------
 * O ACHADO
 * ---------------------------------------------------------------------------
 * A D-1378 (13/09/2026) achou e consertou o mesmo defeito em `ThreeDEffect.js`
 * e `TwoDEffect.js`: uma textura NOVA na GPU a cada efeito criado, e o
 * `free()` nunca a apagava — medido, +480 texturas vivas em 4 min de caça,
 * "e o que deixa o jogo mais lento com o tempo" num telefone com memória
 * curta. O relato do dono, via analytics, é o mesmo sintoma continuando:
 * usuários de iPhone (17, sem aquecimento — descartada a hipótese térmica que
 * a D-1378 também previu) caindo a ~24 fps depois de ~30 min numa hunt com
 * caça automática e habilidades automáticas.
 *
 * A D-1378 só migrou `ThreeDEffect`/`TwoDEffect` para o cache compartilhado
 * (`texturaDeEfeito.js`). Oito classes de efeito ESPECÍFICAS DE HABILIDADE —
 * cada uma com o próprio `Client.loadFile` + `WebGL.texture` per-instância,
 * nunca migradas — tinham o MESMO defeito: `MagnumBreak` (Magnum Break, uma
 * das AoEs mais usadas em rotação automática de Espadachim), `GroundAura`,
 * `MagicRing`, `Cylinder`, `QuadHorn`, `Level99Bubble`, `SwirlingAura`
 * (a aura de nível 99) e `PropertyGround`. `Cylinder` e `QuadHorn` também
 * vazavam um BUFFER de vértice por instância, nunca apagado em `free()`.
 *
 * ---------------------------------------------------------------------------
 * POR QUE UM PORTÃO DE FONTE, E NÃO UM TESTE DE COMPORTAMENTO
 * ---------------------------------------------------------------------------
 * Cada classe precisa de um contexto WebGL de verdade para exercitar
 * `init()`/`free()`, e o jsdom não tem. O que se pode conferir sem WebGL é a
 * FORMA do código: usa o carregador compartilhado, ou lê `data/texture/`
 * direto? O mesmo princípio de `todo-canal-de-fala-tranca.test.ts` (servidor).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = join(process.cwd(), 'src', 'Renderer', 'Effects');

/** As oito classes achadas com o mesmo defeito da D-1378, e não migradas. */
const ARQUIVOS = [
	'MagnumBreak.js',
	'GroundAura.js',
	'MagicRing.js',
	'Cylinder.js',
	'QuadHorn.js',
	'Level99Bubble.js',
	'SwirlingAura.js',
	'PropertyGround.js'
];

describe('efeitos de habilidade usam a textura COMPARTILHADA, e não uma crua por instância (D-1412)', () => {
	for (const arquivo of ARQUIVOS) {
		it(`${arquivo} chama texturaDeEfeito() em vez de WebGL.texture() direto`, () => {
			const codigo = readFileSync(join(DIR, arquivo), 'utf8');
			expect(codigo, `${arquivo} nao importa o cache compartilhado`).toContain(
				"from 'Renderer/Effects/texturaDeEfeito.js'"
			);
			expect(codigo, `${arquivo} ainda chama WebGL.texture() direto — uma textura por instancia, nunca apagada`).not.toMatch(
				/WebGL\.texture\(/
			);
			expect(codigo, `${arquivo} ainda importa Client so para o loadFile da textura`).not.toMatch(
				/import Client from ['"]Core\/Client\.js['"]/
			);
		});
	}

	it('Cylinder e QuadHorn tambem apagam o BUFFER de vertice por instancia', () => {
		const cylinder = readFileSync(join(DIR, 'Cylinder.js'), 'utf8');
		// `this.buffer` nasce em `init()`; so o `free()` de instancia (nao o
		// `static free`, onde `this` e a CLASSE e `this.buffer` nunca existe)
		// pode apaga-lo de verdade.
		const freeDeInstancia = cylinder.slice(cylinder.indexOf('\tfree(gl) {'));
		expect(freeDeInstancia.slice(0, freeDeInstancia.indexOf('\n\n'))).toContain('gl.deleteBuffer(this.buffer)');

		const quadHorn = readFileSync(join(DIR, 'QuadHorn.js'), 'utf8');
		expect(quadHorn, 'texCoordBuffer nasce em init() e precisa morrer em free()').toContain(
			'gl.deleteBuffer(this.texCoordBuffer)'
		);
	});
});
