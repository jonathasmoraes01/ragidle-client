/**
 * Engine/voltaQuente.js
 *
 * A VOLTA QUENTE (D-2576, 15/10/2026 — o jogo em segundo plano).
 *
 * O pedido do dono: a volta do segundo plano *"sincroniza sozinha: sem tela de
 * login, sem tela de personagens, sem recarregar o mapa"*. A reconexao por baixo
 * e inevitavel (o navegador corta o socket da aba no fundo); a carga do mapa,
 * nao.
 *
 * ONDE A CARGA NASCIA. Toda reconexao e `MapEngine.init`, e o `init` zerava
 * `MapRenderer.currentMap` no socket novo ("Force reloading map", herdado do
 * roBrowser). Com o nome vazio o `setMap` do mapa da volta nunca e "o mesmo
 * mapa": ele caia no ramo da carga inteira — o worker parseia o mapa de novo,
 * as texturas e modelos sobem de novo, a arte de carregamento cobre a tela por
 * segundos e, com a aba ainda escondida, o carregamento espera um quadro que a
 * aba escondida nao da (a tela preta de 16/09/2026).
 *
 * O QUE JA RESOLVE. O `setMap` tem o ramo do TELEPORTE LOCAL (a Asa de Mosca):
 * mesmo mapa -> limpa as entidades e os efeitos, mantem chao, modelos e
 * texturas, e roda o `onLoad` (que manda o `CZ_NOTIFY_ACTORINIT`; o servidor
 * desce o lote do mundo, que repovoa a tela). E exatamente a volta quente, e e
 * um caminho que o jogo ja percorre a cada Asa. Este modulo so decide QUANDO a
 * reconexao pode usa-lo; o `MapEngine` costura.
 *
 * O CONTRATO DE D-993. A decisao roda no socket novo, ANTES do
 * `CZ_NOTIFY_ACTORINIT` — nao e cosmetica (decide se a cena fica), e o
 * `MapEngine` a chama em `try/catch` com a resposta de sempre (recarregar) no
 * `catch`: um erro aqui nunca impede a entrada, so devolve a carga de antes.
 *
 * This file is part of the ragidle fork of ROBrowser.
 */

/**
 * A cena que esta na tela serve para a volta? (pura)
 *
 * So a RECONEXAO do mesmo personagem (`volta`) — o login, a troca de
 * personagem e a troca de servidor de mapa continuam recarregando, como sempre.
 * E so com a cena inteira: um nome de mapa (o mapa que esta desenhado), nenhum
 * carregamento em curso (o pedido durante uma carga ja tem dono: o
 * `mapaPendente` do `setMap`) e o contexto WebGL vivo (perdido, a GPU ja jogou
 * fora chao e texturas; quem cuida e `Renderer/perdaDeContexto.js`).
 *
 * Se o mapa da volta for OUTRO (morreu no fundo e foi a Prontera, a viagem pelo
 * menu atravessou a queda), nao ha o que decidir aqui: o `setMap` ve o nome
 * diferente e carrega, como sempre.
 *
 * @param {{ volta: boolean, mapaNaCena: string, carregando: boolean, contextoPerdido: boolean }} c
 * @return {boolean}
 */
export function cenaServeParaAVolta(c) {
	if (!c || c.volta !== true) return false;
	if (typeof c.mapaNaCena !== 'string' || c.mapaNaCena === '') return false;
	if (c.carregando === true) return false;
	return c.contextoPerdido !== true;
}

/**
 * O prazo para o `ZC_NPCACK_MAPMOVE` da volta chegar, antes de o aceite montar
 * a cena sozinho. O servidor manda os dois em sequencia, no mesmo tique
 * (`servidor-mapa.ts`, a ordem do oraculo: `ZC_ACCEPT_ENTER2` ->
 * `ZC_NPCACK_MAPMOVE`); o prazo so vence com um servidor que nao manda o
 * MAPMOVE na entrada (o rAthena-oraculo), e entao a entrada segue como antes.
 */
export const PRAZO_DO_MAPA_DA_VOLTA_MS = 1500;

/**
 * NA VOLTA, QUEM MONTA A CENA E O MAPMOVE, E NAO O ACEITE (D-2576).
 *
 * O aceite (`ZC_ACCEPT_ENTER2`) chamava `onMapChange` com o mapa guardado no
 * `init` — o da ENTRADA, velho se o personagem viajou por menu na mesma
 * conexao, ou se morreu no fundo e foi a Prontera. Logo atras chega o
 * `ZC_NPCACK_MAPMOVE` com o mapa de AGORA. Na volta quente isso montava a cena
 * duas vezes (dois `CZ_NOTIFY_ACTORINIT`, e a segunda limpeza apagava parte do
 * lote do primeiro); na volta fria carregava o mapa velho inteiro para so depois
 * carregar o certo. Na volta, o aceite so AGENDA a montagem: o MAPMOVE a
 * cancela e monta com o mapa certo; sem MAPMOVE no prazo, o aceite monta.
 *
 * @param {{ agendar?: function(function(): void, number): any, desagendar?: function(any): void, prazoMs?: number }} [deps]
 */
export function criarEsperaPeloMapaDaVolta(deps = {}) {
	const agendar = deps.agendar || ((fn, ms) => setTimeout(fn, ms));
	const desagendar = deps.desagendar || (t => clearTimeout(t));
	const prazoMs = typeof deps.prazoMs === 'number' ? deps.prazoMs : PRAZO_DO_MAPA_DA_VOLTA_MS;
	let timer = null;

	/** Agenda a montagem pelo aceite (substitui uma agendada antes: o aceite mais novo vence). */
	function esperar(montarPeloAceite) {
		cancelar();
		timer = agendar(() => {
			timer = null;
			montarPeloAceite();
		}, prazoMs);
	}

	/** O MAPMOVE chegou: a montagem pelo aceite nao acontece. Devolve se havia uma esperando. */
	function mapaChegou() {
		const havia = timer !== null;
		cancelar();
		return havia;
	}

	function cancelar() {
		if (timer !== null) {
			desagendar(timer);
			timer = null;
		}
	}

	return { esperar, mapaChegou, cancelar, esperando: () => timer !== null };
}
