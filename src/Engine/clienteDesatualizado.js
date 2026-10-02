/**
 * Engine/clienteDesatualizado.js
 *
 * RAGIDLE: O LOGIN RECUSADO POR VERSAO (28/09/2026, D-1635 do servidor).
 *
 * O servidor recusa o cliente mais velho que o minimo dele com o motivo 5 do
 * `AC_REFUSE_LOGIN` - o *"Your Game's EXE file is not the latest version"* do
 * protocolo (`loginclif.cpp:189`). A frase do RO para o 5 e a 310, *"O seu
 * arquivo .EXE do jogo nao e a ultima versao."*, que num jogo de navegador nao
 * diz o que fazer. Esta e a nossa, e ela nao e um beco:
 *
 *  - na PRIMEIRA recusa, o "Ok" RECARREGA a pagina. A navegacao e rede
 *    primeiro (`applications/pwa/sw.js`) e todo bundle leva o `?v=<build>`,
 *    entao a pagina recarregada ja e a versao publicada - o mesmo mecanismo
 *    da atualizacao automatica (D-997);
 *  - se a pagina recarregada AINDA for recusada dentro do prazo
 *    (`MS_SEM_REPETIR_A_MESMA_VERSAO`, o mesmo de D-997), nao recarrega de
 *    novo - recarregar em laco seria pior - e diz exatamente o que fazer.
 *
 * A recarga fica anotada na ABA (`sessionStorage`), com `try` em tudo: sem
 * armazenamento, a decisao cai para "orientar", que nunca prende ninguem.
 */
import { MS_SEM_REPETIR_A_MESMA_VERSAO } from 'UI/atualizacaoAutomatica.js';

/** O motivo do `AC_REFUSE_LOGIN` para o cliente desatualizado (`loginclif.cpp:189`). */
export const MOTIVO_DE_CLIENTE_DESATUALIZADO = 5;

export const CHAVE_DA_RECARGA_POR_VERSAO = 'ragidle:recarga-por-versao';

/** O que o jogador le quando a pagina vai se atualizar. */
export const TEXTO_DE_RECARREGAR =
	'Há uma versão nova do jogo. Toque em Ok para atualizar agora - sua conta e seu progresso estão normais.';

/** O que o jogador le quando a atualizacao automatica nao resolveu. */
export const TEXTO_DE_ORIENTAR =
	'Seu jogo ainda está numa versão antiga. Feche o jogo e abra de novo (no computador, Ctrl+F5). Se continuar, avise no nosso Discord.';

/**
 * A decisao, pura: recarregar (a primeira vez) ou orientar (se ja recarregou
 * por este motivo dentro do prazo).
 *
 * @param {number|null} ultimaRecargaEm quando a aba recarregou por versao, ou `null`
 * @param {number} agora
 * @returns {'recarregar'|'orientar'}
 */
export function acaoDoClienteDesatualizado(ultimaRecargaEm, agora) {
	if (typeof ultimaRecargaEm === 'number' && agora - ultimaRecargaEm < MS_SEM_REPETIR_A_MESMA_VERSAO) {
		return 'orientar';
	}
	return 'recarregar';
}

export function textoDoClienteDesatualizado(acao) {
	return acao === 'recarregar' ? TEXTO_DE_RECARREGAR : TEXTO_DE_ORIENTAR;
}

/** Quando esta aba recarregou por versao, ou `null` (sem anotacao ou sem armazenamento). */
export function lerUltimaRecarga(armazenamento) {
	try {
		const bruto = (armazenamento || window.sessionStorage).getItem(CHAVE_DA_RECARGA_POR_VERSAO);
		const n = Number(bruto);
		return bruto !== null && Number.isFinite(n) ? n : null;
	} catch (_e) {
		return null;
	}
}

export function anotarRecarga(agora, armazenamento) {
	try {
		(armazenamento || window.sessionStorage).setItem(CHAVE_DA_RECARGA_POR_VERSAO, String(agora));
		return true;
	} catch (_e) {
		return false;
	}
}

/**
 * Recarrega a pagina INTEIRA: a de cima quando o jogo mora num `<iframe>` (o
 * dev), para a casca vir junto. Sem acesso a de cima, a propria.
 */
export function recarregarAPagina(janela) {
	const w = janela || window;
	try {
		(w.top || w).location.reload();
	} catch (_e) {
		w.location.reload();
	}
}

/**
 * O "Ok" da recusa: decide, anota e (se for o caso) recarrega. Devolve a acao
 * tomada, para quem desenha a caixa saber o que fazer depois.
 *
 * Sem armazenamento a anotacao falha, e a recarga NAO acontece: sem como
 * lembrar que ja recarregou, recarregar poderia virar laco.
 */
export function decidirERecarregar(agora, armazenamento, janela) {
	const acao = acaoDoClienteDesatualizado(lerUltimaRecarga(armazenamento), agora);
	if (acao === 'recarregar' && anotarRecarga(agora, armazenamento)) {
		recarregarAPagina(janela);
		return 'recarregar';
	}
	return 'orientar';
}
