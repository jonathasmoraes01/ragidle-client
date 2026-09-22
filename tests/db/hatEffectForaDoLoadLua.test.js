/**
 * A TABELA DE HAT EFFECT CARREGA COM `loadLua: false` (21/09/2026).
 *
 * O relato do dono foi *"a aura que eu recebo, a Astra Blessing, ela nao esta
 * aparecendo no personagem"*, e as cinco camadas foram medidas uma a uma no
 * jogo de verdade. Quatro estavam certas: o servidor decide, o pacote
 * `ZC_EQUIPMENT_EFFECT` (0x0a3b) CHEGA no fio com o efeito 175, `onHatEffects`
 * roda e pede a arte. A quinta era o buraco: `loadHatEffectInfo` morava dentro
 * do bloco `if (Configs.get('loadLua'))` de `DBManager.lazyInit`, e o Rag Idle
 * roda com `loadLua: false` desde 17/08/2026 (o GRF ROLatam nao tem `System/`,
 * e com o bloco ligado o cliente empaca em 84%). Com a tabela VAZIA,
 * `DB.getHatResource(175)` devolve `null` e o `if (!hatEffect) continue` de
 * `Entity.js` descarta a aura EM SILENCIO - nada no console, nada na tela.
 *
 * Medido, com o mesmo personagem e a mesma camera: com o portao, 0 entradas na
 * tabela e chao limpo; sem ele, 254 entradas e o circulo astral no chao.
 *
 * O teste le o FONTE porque a pergunta e de POSICAO, e nao de comportamento:
 * importar `DBManager` puxaria o cliente inteiro (lua wasm, workers, GRF) para
 * responder "esta chamada esta dentro ou fora daquele `if`?". A posicao e
 * medida por CASAMENTO DE CHAVES, e nao por um trecho de texto cravado - texto
 * cravado morre na primeira refatoracao e o portao fica verde sem medir nada.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/* `import.meta.url` aqui e uma URL http (o vitest roda sobre o vite), entao o
   caminho sai do cwd, que e a raiz do projeto - a mesma nota de
   `areasDeSkill.test.js`. */
const FONTE = readFileSync(join(process.cwd(), 'src', 'DB', 'DBManager.js'), 'utf8');

const ABERTURA_DO_PORTAO = "if (Configs.get('loadLua')) {";

/**
 * O indice logo depois do `}` que fecha o `if (...) { ... } else { ... }` que
 * comeca em `inicio`, contando chaves. `else` conta como continuacao.
 */
function fimDoBloco(texto, inicio) {
	let i = texto.indexOf('{', inicio);
	let profundidade = 0;
	for (; i < texto.length; i += 1) {
		const c = texto[i];
		if (c === '{') profundidade += 1;
		else if (c === '}') {
			profundidade -= 1;
			if (profundidade === 0) {
				// Um `else` (ou `else if`) emenda outro bloco no mesmo `if`.
				const resto = texto.slice(i + 1, i + 40);
				const emenda = /^\s*else\b/.exec(resto);
				if (emenda === null) return i + 1;
				i = texto.indexOf('{', i + 1) - 1;
			}
		}
	}
	throw new Error('as chaves do bloco do loadLua nao fecham');
}

describe('a tabela de hat effect (a aura dos visuais da temporada)', () => {
	it('CONTROLE: o portao `loadLua` continua existindo, e continua tendo um `else`', () => {
		// Sem isto o caso seguinte aprovaria sozinho num arquivo que perdeu o `if`.
		expect(FONTE.split(ABERTURA_DO_PORTAO)).toHaveLength(2);
		const inicio = FONTE.indexOf(ABERTURA_DO_PORTAO);
		const fim = fimDoBloco(FONTE, inicio);
		expect(fim).toBeGreaterThan(inicio);
		// O bloco e grande: ele carrega itemInfo, navegacao, achievement e afins.
		expect(fim - inicio).toBeGreaterThan(5_000);
	});

	it('`loadHatEffectInfo` e chamada UMA vez, e FORA do portao `loadLua`', () => {
		const chamadas = [...FONTE.matchAll(/loadHatEffectInfo\(onLoad\(\)\)/g)];
		expect(chamadas).toHaveLength(1);

		const inicio = FONTE.indexOf(ABERTURA_DO_PORTAO);
		const fim = fimDoBloco(FONTE, inicio);
		const onde = chamadas[0].index;
		const dentroDoPortao = onde >= inicio && onde < fim;
		expect(dentroDoPortao).toBe(false);

		/*
		 * E nao basta estar fora: a PRIMEIRA versao deste portao media so a
		 * posicao, e o mutante que devolve o defeito sem mover a chamada
		 * (`if (PACKETVER.value >= 20150507 && Configs.get('loadLua'))`)
		 * sobrevivia a ele. O `if` que cerca a chamada nao pode consultar o
		 * `loadLua` de forma nenhuma.
		 */
		const abreOIf = FONTE.lastIndexOf('if (', onde);
		expect(abreOIf).toBeGreaterThan(fim);
		expect(FONTE.slice(abreOIf, onde)).not.toContain('loadLua');
	});

	it('os tres arquivos da tabela sao pedidos por caminho de `data/`, e nao de `System/`', () => {
		// `System/` e a pasta que este GRF nao tem - era ela que obrigava o
		// `loadLua: false`. Se o carregador passar a depender dela, este conserto
		// volta a ficar preso ao portao sem ninguem notar.
		expect(FONTE).toContain("DB.LUA_PATH + 'hateffectinfo/'");
		expect(FONTE).toContain("basePath + 'hateffectids.lub'");
		expect(FONTE).toContain("basePath + 'hateffectinfo.lub'");
		expect(FONTE).toContain("basePath + 'footprinteffectinfo.lub'");
		expect(FONTE).toContain("static LUA_PATH = 'data/luafiles514/lua files/'");
	});
});
