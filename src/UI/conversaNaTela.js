/**
 * UI/conversaNaTela.js
 *
 * A CONVERSA NA TELA (D-2049, 06/10/2026) — o registro de quem ja e dono do
 * ESC: o menu do NPC, a caixa de fala dele e a confirmacao do servidor
 * (`ZC_RAGIDLE_CONFIRMAR`).
 *
 * O DEFEITO, medido na tela (`diag-defeitos-do-npc-na-tela`, desktop): o ESC
 * no menu da Kafra fechava o menu E abria as Configuracoes por cima. Todo
 * tratador de tecla deste fork mora em `window`, na ordem em que o componente
 * foi anexado; o `Escape` (as Configuracoes) e anexado no boot do mapa, entao
 * roda ANTES do menu — e alternava a si mesmo antes de o menu cancelar e
 * parar o evento. A pilha de janelas (`pilhaDeJanelas.js`) nao ajudava: ela
 * so conhece as janelas registradas nela, e a conversa nao esta la (com
 * "nada aberto" ela deixa o ESC seguir, de proposito, para as Configuracoes).
 *
 * POR QUE UM REGISTRO, e nao a conversa na pilha:
 *   - como DECISAO, a pilha engoliria o ESC e o menu nao cancelaria — e na
 *     fonte (roBrowser/RO) o ESC cancela o menu e fecha a fala;
 *   - como JANELA, o ESC fecharia TODAS as outras junto, e a regra de uma
 *     janela por vez do celular fecharia a fala quando outra abrisse.
 * A conversa continua cuidando do proprio ESC; o `Escape` so pergunta aqui se
 * ha uma na tela, como ja pergunta se a morte esta (`DeathWindow`).
 *
 * Sem import nenhum: o `Escape` e os componentes da conversa leem daqui, e
 * nenhum deles passa a importar o outro (o `NpcBox` ja importa o `NpcMenu`).
 */

/** nome -> `estaNaTela()` */
const _conversas = new Map();

/**
 * Registra uma parte da conversa. Registrar de novo com o mesmo nome troca a
 * leitura (o componente e criado uma vez, mas o registro nao deve empilhar).
 *
 * @param {string} nome
 * @param {function(): boolean} estaNaTela
 */
export function registrarConversa(nome, estaNaTela) {
	if (!nome || typeof estaNaTela !== 'function') {
		return;
	}
	_conversas.set(nome, estaNaTela);
}

/** Tira uma parte do registro (os testes usam). */
export function desregistrarConversa(nome) {
	_conversas.delete(nome);
}

/**
 * O nome da primeira parte da conversa na tela, ou `null`.
 *
 * Uma leitura que lanca conta como FORA da tela: um componente quebrado nao
 * pode trancar o ESC do jogo inteiro (as Configuracoes sao a saida dele).
 *
 * @returns {string|null}
 */
export function conversaNaTela() {
	for (const [nome, estaNaTela] of _conversas) {
		let naTela = false;
		try {
			naTela = estaNaTela() === true;
		} catch (_erro) {
			naTela = false;
		}
		if (naTela) {
			return nome;
		}
	}
	return null;
}

/**
 * O componente de UI esta na tela? A leitura comum das tres partes: anexado
 * (`__active`, que o `remove()` zera NA HORA, antes da saida animada tirar o
 * host do documento) e sem `display: none`.
 *
 * @param {object} componente  um GUIComponent
 * @returns {boolean}
 */
export function componenteNaTela(componente) {
	return !!(componente && componente.__active && componente._host && componente._host.style.display !== 'none');
}
