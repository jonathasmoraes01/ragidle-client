/**
 * UI/recargaMantendoASessao.js
 *
 * RECARREGA A ABA SEM DESLOGAR (D-1929, a troca de idioma).
 *
 * E o mesmo caminho da atualizacao automatica (`UI/atualizacaoAutomatica.js`,
 * D-997): guarda a retomada (o servidor de personagem e o personagem em
 * jogo), avisa a reconexao de que o fechamento e deliberado e recarrega a
 * CASCA (o cliente vive num iframe). Na volta, o login retoma sozinho.
 *
 * Sem retomada (fora do jogo, ou se algo falhar), a recarga cai no login —
 * pior, mas nao trava.
 *
 * @author RagIdle
 */

import Session from 'Engine/SessionStorage.js';
import { guardarRetomada } from 'Engine/retomadaAposAtualizacao.js';
import { janelaDaCasca } from 'UI/ofertaDeInstalacao.js';

/**
 * @param {function} [recarregar] - injetavel no teste; o padrao recarrega a casca
 * @returns {Promise<void>}
 */
export function recarregarMantendoASessao(recarregar) {
	const recarregarFn = recarregar || (() => janelaDaCasca().location.reload());
	return import('Engine/CharEngine.js')
		.then(m => {
			if (Session.Playing) {
				guardarRetomada(Session, m.default.servidorAtual, Session.GID, Date.now());
			}
		})
		.catch(() => {})
		.then(() => import('Network/reconexao.js'))
		.then(m => {
			m.default.cancelarParaFechamentoDeliberado();
		})
		.catch(() => {})
		.then(() => {
			recarregarFn();
		});
}
