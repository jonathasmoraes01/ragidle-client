/**
 * ALTURA VEM DA CELULA (x, y) — NUNCA DE (y, y) (D-543).
 *
 * `Altitude.getCellHeight(x, y)` devolve a altura do terreno naquela celula.
 * Passar a mesma coordenada duas vezes le a celula ERRADA — e o defeito e
 * invisivel em mapa PLANO, porque ali toda celula tem a mesma altura. So
 * aparece em mapa com relevo, e com erro proporcional ao desnivel entre a
 * celula certa e a lida por engano.
 *
 * Achado em `Engine/MapEngine/Entity.js` (marcador de conjuracao no chao,
 * `EF_GROUNDSAMPLE`), passando `yPos` nas duas posicoes. Os outros 30 pontos
 * de chamada do cliente ja passavam o par certo.
 *
 * O teste cobre a REGRA e nao aquela linha: o mesmo engano em qualquer outro
 * ponto de chamada seria igualmente mudo em mapa plano, e e justamente por
 * ser mudo que ele sobrevive a uma revisao.
 */

import { describe, expect, it } from 'vitest';
import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(process.cwd(), 'src');

/**
 * Os dois argumentos de uma chamada a `getCellHeight`. Argumento com virgula
 * ou parenteses dentro fica de fora do casamento de proposito: a regra so
 * sabe julgar o caso simples, e um caso composto julgado por engano seria
 * pior que um caso nao julgado.
 */
const CHAMADA = /getCellHeight\(\s*([^,()]+?)\s*,\s*([^,()]+?)\s*\)/g;

function arquivosJs() {
	// `join` aceita os dois separadores; o `rel` so viaja como rotulo.
	return globSync('**/*.js', { cwd: RAIZ });
}

/**
 * Sem isto a varredura acusa COMENTARIO como codigo — e o primeiro a cair foi
 * o comentario que explica o conserto de D-543, que cita a chamada errada por
 * extenso. Um gate que nao distingue os dois torna impossivel escrever sobre
 * o defeito que ele guarda.
 *
 * As linhas viram espaco em vez de sumir, para o numero de linha do relatorio
 * continuar batendo com o arquivo aberto no editor.
 */
function semComentarios(texto) {
	const emBranco = trecho => trecho.replace(/[^\n]/g, ' ');
	return texto.replace(/\/\*[\s\S]*?\*\//g, emBranco).replace(/\/\/[^\n]*/g, emBranco);
}

function chamadasDe(rel) {
	const texto = semComentarios(readFileSync(join(RAIZ, rel), 'utf8'));
	return [...texto.matchAll(CHAMADA)].map(m => ({
		linha: texto.slice(0, m.index).split('\n').length,
		x: m[1].trim(),
		y: m[2].trim()
	}));
}

describe('nenhuma chamada a getCellHeight le a mesma coordenada duas vezes', () => {
	// 30 s e nao os 5 padrao (27/08/2026): esta varredura le ~900 arquivos e
	// REPROVOU DUAS VEZES por timeout com a maquina carregada (pos-pull de
	// 26/08 e a rodada de 27/08, sempre com stack+suite juntos) — verde nas
	// re-corridas isoladas. Timeout de varredura nao e criterio de correcao.
	it('varre todo o src/', { timeout: 30_000 }, () => {
		const suspeitas = [];
		for (const rel of arquivosJs()) {
			for (const c of chamadasDe(rel)) {
				if (c.x === c.y) {
					suspeitas.push(`${rel}:${c.linha} — getCellHeight(${c.x}, ${c.y})`);
				}
			}
		}
		expect(suspeitas).toEqual([]);
	});

	it('a varredura enxerga as chamadas de verdade — senao ela passaria vazia', () => {
		const total = arquivosJs().reduce((soma, rel) => soma + chamadasDe(rel).length, 0);
		expect(total).toBeGreaterThan(20);
	});

	it('e ela ignora comentario, senao nao daria para escrever sobre o defeito', () => {
		const fonte = 'a();\n// getCellHeight(y, y)\n/* getCellHeight(y, y) */\nb();';
		expect([...semComentarios(fonte).matchAll(CHAMADA)]).toHaveLength(0);
		// E o numero de linha nao anda: o comentario vira espaco, nao some.
		expect(semComentarios(fonte).split('\n')).toHaveLength(4);
	});
});
