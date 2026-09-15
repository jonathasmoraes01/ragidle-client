/**
 * O PORTAO DO LINT (15/09/2026) — `no-undef` e `ReferenceError` em producao.
 *
 * ---------------------------------------------------------------------------
 * A CICATRIZ QUE CRIOU ESTE ARQUIVO
 * ---------------------------------------------------------------------------
 * D-1396 (14/09/2026) tirou do cliente o relogio proprio do "Dormir" e apagou
 * as declaracoes `_mapaDoRelogioDeSono` e `_entrouNoMapaDoSonoEm` — mas deixou
 * as DUAS ATRIBUICOES delas dentro de
 * `HuntAnalyzer.limparEstadoDoPersonagem()`. Arquivo ESM e strict mode: ali
 * aquilo nao cria variavel global, LANCA `ReferenceError`.
 *
 * E essa funcao roda dentro de um `for` em `cleanGameUI()`
 * (`src/Engine/MapEngine.js`), que percorre 20 modulos chamando a limpeza de
 * cada um. A excecao ABORTAVA O LACO: os 11 modulos listados depois do
 * `HuntAnalyzer` nunca limpavam o estado do personagem anterior. Um dia
 * inteiro em producao.
 *
 * O `npx eslint` deste repositorio pegava o defeito o tempo todo — 2 erros
 * `no-undef`, nome e linha certos. O que faltava era alguem RODAR: `npm test`
 * e so `vitest run`, o `npm run ci` (lint + format) nao esta em gatilho
 * nenhum, e a esteira de deploy so constroi.
 *
 * Por isso o portao mora AQUI, dentro da suite, e nao num script que alguem
 * precisa lembrar de chamar: e a regra do projeto de que CONVENCAO NAO SEGURA,
 * PORTAO SIM. Custo medido: ~10 s numa suite de ~72 s.
 *
 * ---------------------------------------------------------------------------
 * POR QUE SO `no-undef`, E NAO TODO ERRO
 * ---------------------------------------------------------------------------
 * `no-undef` e a unica regra desta configuracao cuja violacao **apaga
 * comportamento em producao**: em modulo ESM ela e um `ReferenceError` na
 * cara, e uma excecao no lugar errado leva junto tudo o que vinha depois — foi
 * exatamente o que aconteceu com os 11 modulos de `cleanGameUI()`.
 *
 * As outras que hoje estao em erro (`prefer-const` x2 em `UI/UIManager.js`,
 * `no-shadow` x1 em `Renderer/Entity/EntityWalk.js`) sao ESTILO: o jogo faz a
 * mesma coisa com elas e sem elas. Paga-las exige mexer em dois arquivos que
 * nada tem a ver com o defeito desta rodada, e este projeto tem regra contra
 * empacotar arrumacao com conserto. Quem as pagar um dia troca o filtro abaixo
 * por `m.severity !== 2` e o portao vira "zero erro", que e o destino.
 */
import { describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';

/** A regra que e defeito de EXECUCAO, e nao de gosto. */
const REGRA = 'no-undef';

describe('o lint do cliente nao tem `no-undef` (D-1413)', () => {
	it(
		'nenhum arquivo de `src/` usa nome que nao existe',
		async () => {
			const eslint = new ESLint({ cwd: process.cwd() });
			const relatorio = await eslint.lintFiles(['src']);

			const achados = [];
			for (const arquivo of relatorio) {
				for (const m of arquivo.messages) {
					if (m.severity !== 2 || m.ruleId !== REGRA) {
						continue;
					}
					const curto = arquivo.filePath.replace(process.cwd(), '').replace(/\\/g, '/');
					achados.push(`${curto}:${m.line} — ${m.message}`);
				}
			}

			expect(
				achados,
				`${achados.length} uso(s) de nome inexistente — cada um e um ReferenceError esperando o jogador:\n${achados.join('\n')}`
			).toEqual([]);
		},
		60_000
	);
});
