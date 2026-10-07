/**
 * UI/janelaPorDiferenca.js
 *
 * A CONFIG IDLE E A JANELA DE GRUPO POR DIFERENCA (07/10/2026, D-2077) - a
 * metade do cliente, pura.
 *
 * O `ZC_RAGIDLE_CONFIG` (0x0ff4) e o `ZC_RAGIDLE_GRUPO` (0x0fcc) desciam o
 * estado INTEIRO a cada envio: a config a cada entrada no mundo, abertura e
 * gravacao; o grupo a cada mudanca em QUALQUER grupo do servidor, para toda
 * janela inscrita. O servidor (`servidor/mapa/janela-por-diferenca.ts`, no
 * repositorio do jogo) agora numera cada envio (`rev`) e, para a conexao que
 * DECLAROU que entende o parcial, manda so as TROCAS (`[caminho, valor]`) sobre
 * a revisao `de`: `{v: 2, parcial: true, de, rev, trocas, ...envio}`.
 *
 * A DECLARACAO e a da entrada no mapa (`Engine/declaracaoDasBases.js`): as
 * chaves `config` e `grupo`, com a revisao que esta memoria tem de cada janela
 * (ou `null`). O servidor antigo as ignora e segue mandando o inteiro - que
 * este modulo trata como sempre.
 *
 * A janela continua sem calcular nada: o que sai daqui e o MESMO objeto que o
 * inteiro seria (com os campos do envio), e dai em diante o caminho e o dela.
 * A aplicacao das trocas e a da Temporada (`aplicarTrocas`).
 */

import { aplicarTrocas } from './Components/TemporadaIdle/parcialDaTemporada.js';

/** A versao do parcial no fio (o inteiro das duas janelas e `v: 1`). */
export const VERSAO_DO_PARCIAL_DE_JANELA = 2;

/** Os campos que sao do ENVIO (a resposta ao gesto), e nao do estado da janela. */
export const CAMPOS_DO_ENVIO_DA_CONFIG = ['aplicado', 'problemas'];
export const CAMPOS_DO_ENVIO_DO_GRUPO = ['aplicado', 'problemas', 'recado'];

function copia(valor) {
	return JSON.parse(JSON.stringify(valor));
}

/** O envio e um parcial de janela (e nao o estado inteiro)? */
export function ehParcialDeJanela(corpo) {
	return !!corpo && corpo.parcial === true && corpo.v === VERSAO_DO_PARCIAL_DE_JANELA;
}

/**
 * Recebe um envio da janela.
 *
 * `guardado` e o que esta memoria tem (`{rev, estado}`, ou `null`). Devolve:
 * - `dados`: o corpo que o handler da janela le, no formato do inteiro (o
 *   estado com os campos do envio); `null` quando o parcial nao cai sobre o
 *   que temos;
 * - `guardado`: o que guardar daqui em diante (o mesmo de antes quando o
 *   parcial nao caiu);
 * - `pedirInteiro`: o parcial nao caiu (sem estado, ou `de` nao e a revisao
 *   que temos) - quem chama declara `null` e pede de novo.
 */
export function receberEnvioDeJanela(guardado, corpo, camposDoEnvio) {
	if (!ehParcialDeJanela(corpo)) {
		const estado = {};
		for (const k of Object.keys(corpo || {})) {
			if (camposDoEnvio.indexOf(k) === -1) {
				estado[k] = corpo[k];
			}
		}
		const rev = corpo && typeof corpo.rev === 'number' ? corpo.rev : null;
		delete estado.rev;
		return { dados: corpo, guardado: { rev, estado: copia(estado) }, pedirInteiro: false };
	}
	if (!guardado || guardado.rev === null || guardado.rev !== corpo.de || !Array.isArray(corpo.trocas)) {
		return { dados: null, guardado: guardado || null, pedirInteiro: true };
	}
	const estado = aplicarTrocas(guardado.estado, corpo.trocas);
	if (!estado) {
		return { dados: null, guardado, pedirInteiro: true };
	}
	const dados = copia(estado);
	for (const k of camposDoEnvio) {
		if (Object.prototype.hasOwnProperty.call(corpo, k)) {
			dados[k] = corpo[k];
		}
	}
	dados.rev = corpo.rev;
	return { dados, guardado: { rev: corpo.rev, estado }, pedirInteiro: false };
}

/** A revisao que o guardado tem, para a declaracao da entrada (`null` sem nenhuma). */
export function revisaoGuardada(guardado) {
	return guardado && typeof guardado.rev === 'number' ? guardado.rev : null;
}

/**
 * O RECEPTOR de uma janela: guarda o que a memoria tem e decide o que o
 * handler le. `pedirInteiro` e chamado UMA vez quando um parcial nao cai (ele
 * declara `null` e repete o pedido fixo); ate o inteiro chegar, os parciais
 * que vierem sao ignorados (eles encadeiam sobre a base que nao temos) e a
 * revisao declarada e `null`.
 *
 * `receber` devolve `{ignorado, dados}`: `ignorado` quando o handler nao tem
 * nada a fazer; senao `dados` e o corpo no formato do inteiro.
 */
export function criarReceptorDeJanela(camposDoEnvio, pedirInteiro) {
	let guardado = null;
	let esperandoInteiro = false;
	return {
		receber(corpo) {
			const r = receberEnvioDeJanela(guardado, corpo, camposDoEnvio);
			if (r.pedirInteiro) {
				if (!esperandoInteiro) {
					esperandoInteiro = true;
					pedirInteiro();
				}
				return { ignorado: true, dados: null };
			}
			if (!ehParcialDeJanela(corpo)) {
				esperandoInteiro = false;
			}
			guardado = r.guardado;
			return { ignorado: false, dados: r.dados };
		},
		revisao() {
			return esperandoInteiro ? null : revisaoGuardada(guardado);
		},
		esquecer() {
			guardado = null;
			esperandoInteiro = false;
		}
	};
}
