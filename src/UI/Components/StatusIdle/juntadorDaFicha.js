/**
 * UI/Components/StatusIdle/juntadorDaFicha.js
 *
 * UM PEDIDO DE FICHA POR RAJADA DE STATUS (auditoria de desempenho de
 * 15/10/2026).
 *
 * Com a janela de Status aberta, CADA `ZC_MSG_STATE_CHANGE` do proprio
 * personagem mandava um `CZ_RAGIDLE_PEDIR_FICHA` (`StatusIdle.aoMudarStatus`).
 * Um buff de grupo, uma troca de equipamento ou o fim de varios buffs juntos
 * chegam como uma RAJADA de mudancas no mesmo quadro de rede — e cada uma
 * virava um pedido e uma ficha inteira (JSON) de volta.
 *
 * O juntador:
 *  - junta as mudancas de um quadro num pedido so (o pedido sai no proximo
 *    quadro, e nao na hora);
 *  - com um pedido EM VOO, nao pede de novo: guarda que houve mudanca e, quando
 *    a ficha chega, pede UMA vez mais. A ficha em voo foi montada pelo servidor
 *    depois do pedido; a de depois garante que a tela nunca fica com o numero
 *    de antes de uma mudanca que chegou durante o voo — o mesmo resultado de
 *    antes, com no maximo dois pedidos por rajada em vez de um por mudanca;
 *  - o voo VENCE (`PRAZO_DO_VOO_MS`): uma ficha que nunca volta (a troca de
 *    mapa no meio, o servidor que recusou) nao pode calar os pedidos para
 *    sempre.
 */

export const PRAZO_DO_VOO_MS = 3000;

/**
 * @param {object} opcoes
 * @param {function(function): void} opcoes.agendar - roda no proximo quadro
 * @param {function(): boolean} opcoes.enviar - manda o pedido; `false` se nao
 *        mandou (a janela fechou no meio)
 * @param {function(): number} opcoes.agora
 */
export function criarJuntadorDaFicha({ agendar, enviar, agora }) {
	let agendado = false;
	let emVooDesde = null;
	let mudouNoVoo = false;

	function voando() {
		return emVooDesde !== null && agora() - emVooDesde < PRAZO_DO_VOO_MS;
	}

	function disparar() {
		agendado = false;
		if (voando()) {
			mudouNoVoo = true;
			return;
		}
		if (enviar()) {
			emVooDesde = agora();
			mudouNoVoo = false;
		}
	}

	/** Um status mudou: pede a ficha no proximo quadro, uma vez so. */
	function pedir() {
		if (voando()) {
			mudouNoVoo = true;
			return;
		}
		if (agendado) {
			return;
		}
		agendado = true;
		agendar(disparar);
	}

	return {
		pedir,
		/** Um pedido saiu por outra porta (a abertura da janela). */
		enviou() {
			emVooDesde = agora();
			mudouNoVoo = false;
		},
		/** A ficha chegou (resposta ou empurrada pelo servidor). */
		chegou() {
			emVooDesde = null;
			if (mudouNoVoo) {
				mudouNoVoo = false;
				pedir();
			}
		},
		/** A troca de personagem: nada do anterior atravessa. */
		esquecer() {
			emVooDesde = null;
			mudouNoVoo = false;
		}
	};
}
