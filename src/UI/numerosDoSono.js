/**
 * UI/numerosDoSono.js
 *
 * OS NUMEROS DA TELA "DORMINDO..." (J21 do jogador "lucas seabra", 14/10/2026, D-2478).
 *
 * O relato: "varias vezes pus o personagem para dormir e, ao voltar, nao tinha subido nada de XP", e o pedido de um
 * jeito melhor de mostrar que ele esta dormindo E GANHANDO. A tela so dizia o que faltava ("pela frente"); agora diz
 * tambem o que ja rendeu e o ritmo, e avisa quando o sono nao rende nada (a taxa zero dos sonos aceitos antes da
 * D-2477, que recusa a amostra sem EXP).
 *
 * Os tres numeros saem da MESMA taxa que o servidor congelou ao iniciar (`taxaExpBasePorMs`, D-1386) e do tempo que
 * ele diz que ja foi dormido (`dormidoMs`). Nunca inventam numero (regra 1): sao a conta que o acerto faz, `taxa x
 * tempo`, com o piso do acerto. O acerto de verdade reescala nivel a nivel quem atravessa um estagio de EXP
 * (`acertoPorEstagios`, servidor), por isso a tela mostra "~".
 *
 * Puro: nada de DOM nem de relogio; quem chama passa o `restanteMs` e o `dormidoMs` de agora.
 */

/** Uma hora, para o ritmo. */
const UMA_HORA_MS = 3600 * 1000;

/**
 * @param {{restanteMs: number, dormidoMs: number, expBasePorMs: number, expClassePorMs: number}} p
 * @returns {{ateAgora: {base: number, classe: number}, porHora: {base: number, classe: number},
 *   pelaFrente: {base: number, classe: number}, rendendo: boolean, completo: boolean}}
 */
export function numerosDoSono(p) {
	const base = Math.max(0, Number(p?.expBasePorMs) || 0);
	const classe = Math.max(0, Number(p?.expClassePorMs) || 0);
	const dormido = Math.max(0, Number(p?.dormidoMs) || 0);
	const restante = Math.max(0, Number(p?.restanteMs) || 0);
	return {
		ateAgora: { base: Math.floor(base * dormido), classe: Math.floor(classe * dormido) },
		porHora: { base: Math.floor(base * UMA_HORA_MS), classe: Math.floor(classe * UMA_HORA_MS) },
		pelaFrente: { base: Math.floor(base * restante), classe: Math.floor(classe * restante) },
		// O acerto paga a classe junto da base (D-2477): sem taxa de base o sono nao rende nada.
		rendendo: base > 0,
		// O teto passou (rodada 2, N1 do critico): o sono parou de render e so espera o "Acordar" para pagar. A tela
		// dizia "Dormindo e ganhando EXP" de um sono parado; agora diz que terminou, com o ganho.
		completo: restante <= 0
	};
}

/** O espaco que nao quebra a linha (U+00A0). */
const SEM_QUEBRA = '\u00a0';

/**
 * Cada metade do resumo: "~N EXP base", "~N EXP classe", "~N EXP classe pela frente" (o "/h" do ritmo ja vem colado,
 * sem espaco). O numero vai ate o espaco comum (o separador de milhar nunca e o espaco comum: "22.733", "22,733").
 */
const METADE = /~[^ ·]+ EXP (?:base|classe)(?: pela frente)?/g;

/**
 * A LINHA DO RESUMO QUE NAO DEIXA "classe" SOZINHA (rodada 3 da D-2478, N4 do critico). No celular em pe, "Ganho ate
 * agora: ~22.733 EXP base · ~14.072 EXP classe" nao cabe numa linha, e a quebra caia entre "EXP" e "classe": a
 * palavra ficava sozinha embaixo, como um quarto item da lista. Aqui o espaco DENTRO de cada metade vira o espaco sem
 * quebra, e o "·" gruda na metade da esquerda: a linha so quebra no rotulo ("Ganho ate agora:") ou depois do "·".
 * Nada some: o texto e o mesmo, so muda onde ele pode dobrar.
 *
 * O texto continua UM no so, igual ao do fonte: o tradutor (`Core/Traducao.js`, `normalizar`) e o extrator do
 * servidor tratam o U+00A0 como espaco (o `\s` do JavaScript), entao o modelo do ingles casa como antes. O ingles
 * traduzido sai com o espaco comum (o tradutor escreve o texto do catalogo), e ele e mais curto que o portugues.
 *
 * @param {string} texto a linha pronta, com os numeros ja formatados
 * @returns {string}
 */
export function semQuebraDentroDasMetades(texto) {
	return String(texto)
		.replace(METADE, metade => metade.replace(/ /g, SEM_QUEBRA))
		.replace(/ ·/g, `${SEM_QUEBRA}·`);
}
