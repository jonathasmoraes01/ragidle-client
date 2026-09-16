/**
 * O AVISO DE ITEM OBTIDO NAO PODE MORAR NUM NUMERO CRAVADO (07/09/2026).
 *
 * ---------------------------------------------------------------------------
 * O QUE ACONTECEU
 * ---------------------------------------------------------------------------
 * O dono pediu para conferir o anuncio de drop: *"quando a pessoa dropa o item
 * (...) na tela apareca o icone do item que a pessoa dropou e o item que ela
 * dropou escrito"*. Ele aparecia — e no celular em pe aparecia EM CIMA do
 * cartao de missoes, cobrindo o "Ver todas as missoes".
 *
 * A causa era um numero: `html.ri-vertical #ItemObtain` punha o toast em
 * `--vr-abaixo-do-topo + 130px`, e o 130 foi escolhido com o cartao mostrando
 * UMA missao. O cartao cresce com o numero de missoes — com duas ele passa dos
 * 130 e o vizinho de baixo nasce por cima dele.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ISTO E UM TESTE, E NAO SO O CONSERTO
 * ---------------------------------------------------------------------------
 * O conserto (medir o cartao em `ItemObtain.js` e publicar
 * `--vr-item-obtido-topo`) e uma linha, e uma linha e facil de desfazer numa
 * "simplificacao": o `calc` de nascenca continua no CSS como fallback, entao
 * apagar o JS **nao quebra nada visivelmente** — volta a colidir so quando o
 * jogador tem duas missoes, que e o caso comum e nao o caso de teste.
 *
 * Este arquivo e o despertador: ele cobra que a regra da vertical seja uma
 * VARIAVEL (e nao um `calc` cravado) e que exista quem a escreva. A geometria
 * de verdade — as duas caixas medidas na tela, com o jogo rodando — e da
 * `prove:anuncio-de-drop`, no repositorio do servidor; este e o portao barato
 * que roda em toda suite.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const COMUM = readFileSync(join(process.cwd(), 'src', 'UI', 'Common.css'), 'utf8');
const COMPONENTE = readFileSync(
	join(process.cwd(), 'src', 'UI', 'Components', 'ItemObtain', 'ItemObtain.js'),
	'utf8',
);

/** O corpo da regra `html.ri-vertical #ItemObtain { ... }`. */
function regraDaVertical() {
	const inicio = COMUM.indexOf('html.ri-vertical #ItemObtain');
	expect(inicio, 'a regra do aviso na HUD vertical sumiu do Common.css').toBeGreaterThan(-1);
	const abre = COMUM.indexOf('{', inicio);
	const fecha = COMUM.indexOf('}', abre);
	return COMUM.slice(abre + 1, fecha);
}

describe('o aviso de item obtido na HUD vertical', () => {
	it('posiciona por VARIAVEL, e nao por um `top` cravado', () => {
		const corpo = regraDaVertical();
		expect(corpo, 'a regra deixou de posicionar o topo').toContain('top:');
		expect(
			corpo,
			'o `top` voltou a ser um numero fixo — ele colide com o cartao de missoes ' +
				'assim que o jogador tem duas missoes (07/09/2026)',
		).toContain('--vr-item-obtido-topo');
	});

	it('e o `calc` que sobrou e FALLBACK, dentro do `var()`', () => {
		/*
		 * O valor de nascenca continua util: sem cartao de missoes na tela (jogador
		 * sem missao nenhuma) nao ha o que medir, e o toast precisa de um lugar. O
		 * que ele nao pode ser e o valor NORMAL.
		 */
		const corpo = regraDaVertical();
		const varComFallback = /var\(\s*--vr-item-obtido-topo\s*,[^)]*calc\(/.test(
			corpo.replace(/\s+/g, ' '),
		);
		expect(varComFallback, 'o `calc` saiu de dentro do `var(...)`').toBe(true);
	});

	it('e ha quem ESCREVA a variavel, medindo o cartao de missoes', () => {
		/*
		 * Sem este caso os dois de cima passariam com a variavel nunca definida — e
		 * a tela cairia sempre no fallback, que e exatamente o defeito de origem.
		 * "Criterio que passa com zero" e a armadilha que este projeto mais repete.
		 */
		expect(
			COMPONENTE,
			'ninguem escreve `--vr-item-obtido-topo` — a regra da vertical usa so o fallback',
		).toContain('--vr-item-obtido-topo');
		/*
		 * O SELETOR INTEIRO, e nao a palavra `MissoesTrackerIdle` solta: ela
		 * aparece tambem no comentario acima da funcao, entao a versao curta
		 * deste caso sobreviveria a um mutante que trocasse a consulta por
		 * `null` e deixasse a prosa no lugar. Casar o seletor cobra o CODIGO.
		 */
		expect(
			COMPONENTE,
			'a posicao voltou a ser adivinhada: ela tem de MEDIR o cartao de missoes',
		).toContain('querySelector(\'div[id^="MissoesTrackerIdle"]\')');
		expect(COMPONENTE, 'a medida do cartao nao usa a caixa real').toContain(
			'getBoundingClientRect',
		);
	});

	it('so mexe no arranjo VERTICAL — no desktop o `top: 50px` continua mandando', () => {
		/*
		 * A guarda `ri-vertical` e o que impede o conserto do celular de reescrever
		 * a posicao no desktop, onde nao ha cartao de missoes fixo no caminho e o
		 * `:host { top: 50px }` do proprio componente e quem decide.
		 */
		expect(COMPONENTE, 'a guarda da HUD vertical sumiu').toContain('ri-vertical');
	});
});
