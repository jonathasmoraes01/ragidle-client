/**
 * UI/Components/StatusIdle/metadesDaDerivada.js
 *
 * As QUATRO derivadas que o RO escreve em DUAS METADES (ATK, MATK, DEF, MDEF):
 * a tabela que diz de que lado cada numero cai, e a decisao de QUAL fonte da
 * ficha usar. Estado puro: sem DOM, sem rede, sem timer -- por isso roda no
 * Node dos testes sem navegador nenhum.
 *
 * ── POR QUE ISTO SAIU DO CLOSURE DE StatusIdle.js (06/09/2026) ───────────
 * `lerMetades` DECIDE: ela escolhe entre o contrato v2 (`derivados.metades`),
 * a rede do `legado` e o total do motor sozinho. Decisao dentro do closure de
 * uma janela nao tem como ser medida a nao ser lendo o FONTE -- e foi
 * exatamente assim que o portao desta regra morreu.
 *
 * O portao `tests/ui/duasMetadesDeDefesa.test.js` nasceu em 27/08/2026
 * (commit 5cea3376) casando o TEXTO de duas linhas de implementacao:
 *
 *     setText(root, '.st-def', somaDasMetades(derivados.defDeStatus, ...))
 *
 * Em `21fcf185` (D-852) a janela passou a desenhar `base + bonus` em DOIS
 * elementos (`.st-def` e `.st-def2`, como o cliente nativo faz), a
 * `somaDasMetades` deixou de existir, e o portao ficou VERMELHO sem nenhuma
 * regressao de comportamento: ele media a forma da linha, e nao a regra. Ficou
 * assim por tres refatoracoes.
 *
 * A licao e a de sempre neste projeto, na forma mais cara: portao que casa
 * texto de implementacao morre na primeira refatoracao, enquanto a PROPRIEDADE
 * que ele protegia continua viva e desprotegida. Com a decisao aqui, o portao
 * EXECUTA a regra e sobrevive a qualquer redesenho da janela.
 *
 * ── A CICATRIZ QUE CRIOU A METADE DE STATUS (27/08/2026, auditoria C) ────
 * A ficha mandava so a metade de EQUIPAMENTO. Para o MDEF isso e devastador e
 * mensuravel: MDEF de jogador nasce SO de `bonus bMdef` (nao ha campo
 * `MagicDefense` no item_db de equipamento), entao a metade de equipamento e
 * zero em quase todo personagem. Medido no corpus antes do conserto: **276 de
 * 276** fichas com `derivados.mdef === 0`. O jogador abria a janela com INT e
 * lia MDEF 0 -- o numero de status estava calculado o tempo todo, so nao
 * atravessava.
 */

/**
 * ── Por que os lados sao esses ──────────────────────────────────────────
 * O emulador manda DUAS: no renewal o `leftside` e o derivado de STATUS e o
 * `rightside` e o de EQUIPAMENTO (`pc.hpp:1241-1244`, dentro do `#ifdef
 * RENEWAL`; no pre-renewal os lados de ATK e MATK TROCAM). Quem decide de que
 * lado cada numero cai e o SERVIDOR, que ja entrega `esquerda`/`direita`
 * prontos -- esta tabela so desenha, e por isso nao ha `isRenewal` nenhum aqui.
 *
 * `legado` e o par de campos soltos do v1 que ainda diz a mesma coisa para
 * DEF/MDEF; ele e a rede quando um servidor v2 esquecer de mandar `metades`
 * (ver lerMetades()). ATK/MATK NAO tem legado: `derivados.atk` e o total do
 * motor, e nao a metade da direita -- usa-lo ali imprimiria 123 no lugar de 55.
 *
 * `totalDoMotor` so existe onde o total DIVERGE da soma das duas metades, que
 * e exatamente ATK e MATK. Em DEF/MDEF a soma na tela ja E o total, e repeti-la
 * no title seria ruido.
 */
export const METADES = [
	{
		chave: 'atk',
		rotulo: 'ATK',
		alvo: '.st-atk',
		alvoDaDireita: '.st-atk2',
		daEsquerda: 'de status',
		daDireita: 'de arma e equipamento',
		totalDoMotor: 'atk',
		legado: null
	},
	{
		chave: 'matk',
		rotulo: 'MATK',
		alvo: '.st-matk',
		alvoDaDireita: '.st-matk2',
		daEsquerda: 'de status',
		daDireita: 'de equipamento',
		totalDoMotor: 'matk',
		legado: null
	},
	{
		chave: 'def',
		rotulo: 'DEF',
		alvo: '.st-def',
		alvoDaDireita: '.st-def2',
		daEsquerda: 'de status',
		daDireita: 'de equipamento',
		totalDoMotor: null,
		legado: { esquerda: 'defDeStatus', direita: 'def' }
	},
	{
		chave: 'mdef',
		rotulo: 'MDEF',
		alvo: '.st-mdef',
		alvoDaDireita: '.st-mdef2',
		daEsquerda: 'de status',
		daDireita: 'de equipamento',
		totalDoMotor: null,
		legado: { esquerda: 'mdefDeStatus', direita: 'mdef' }
	}
];

/**
 * As duas metades de uma derivada, com a rede do `legado` (ver METADES).
 *
 * Sem `metades` E sem legado (ATK/MATK), sobra o total do motor sozinho do lado
 * esquerdo -- e o unico numero verdadeiro que existe nesse caso. O console diz o
 * que faltou, porque o sintoma na tela ("ATK 123" sem a metade) e discreto
 * demais para alguem notar que o servidor regrediu.
 *
 * `Number(x) || 0` em toda saida NAO e paranoia: a ficha e JSON, e um servidor
 * antigo que nao mande um dos campos faria a janela escrever "undefined" ou
 * "NaN" ao lado do numero certo -- e numero plausivel-com-lixo-do-lado e pior
 * que numero ausente, porque o jogador nao sabe qual metade acreditar.
 */
export function lerMetades(metade, derivados, def) {
	if (metade && metade.esquerda !== undefined && metade.direita !== undefined) {
		return {
			esquerda: Number(metade.esquerda) || 0,
			direita: Number(metade.direita) || 0,
			temDireita: true
		};
	}

	console.warn(`[StatusIdle] derivados.metades.${def.chave} ausente na ficha; caindo no formato antigo.`);

	if (def.legado) {
		return {
			esquerda: Number(derivados[def.legado.esquerda]) || 0,
			direita: Number(derivados[def.legado.direita]) || 0,
			temDireita: true
		};
	}

	return {
		esquerda: Number(derivados[def.totalDoMotor]) || 0,
		direita: 0,
		temDireita: false
	};
}

export default { METADES, lerMetades };
