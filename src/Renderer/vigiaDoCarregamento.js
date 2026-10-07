/**
 * Renderer/vigiaDoCarregamento.js
 *
 * A VIGIA DA CARGA DO MAPA INTEIRA (D-2055, 06/10/2026).
 *
 * O prazo por pedido (`Core/baixarComVigia.js`) garante que um ARQUIVO nao
 * fica pendurado; esta vigia garante que a ETAPA nao fica: ela olha a carga
 * de cima, pelo que chega do worker, e responde duas perguntas com dois
 * relogios:
 *
 *  - "a barra esta parada ha muito?" (`avisoMs`, rearmado so quando a barra
 *    anda): o jogador merece saber o que acontece - `aoDemorar` mostra a
 *    linha de aviso ("Baixando o mapa: 2,1 de 5,4 MB");
 *  - "NADA anda ha muito?" (`limiteMs`, rearmado pela barra E pelos bytes):
 *    a carga parou de verdade - `aoTravar` mostra a saida ("Tentar de novo").
 *
 * Bytes chegando NAO contam como travada: um `.gnd` de 13 MB num celular lento
 * deixa a barra em 2% por um minuto, chegando bytes o tempo todo, e oferecer
 * "Tentar de novo" ali so jogaria fora o que ja chegou. A nova tentativa que
 * sai sozinha tambem nao rearma o relogio de travada: ela e o sistema
 * tentando, e nao o mapa andando.
 *
 * Puro nos relogios (injetados). Nao lanca: os retornos sao chamados em
 * `try/catch`, porque esta vigia roda DURANTE a carga, antes do
 * `CZ_NOTIFY_ACTORINIT` (D-993).
 */
import { AVISO_DE_LENTIDAO_MS, SEM_SINAL_MAXIMO_MS } from 'UI/saidaDoCarregamento.js';

/**
 * @param {object} p
 * @param {function} p.aoTravar - nada andou por `limiteMs`
 * @param {function(object|null):void} [p.aoDemorar] - a barra parou por
 *   `avisoMs` (recebe a ultima atividade de rede, ou `null`) - chamado de novo
 *   a cada atividade enquanto a barra seguir parada
 * @param {function} [p.aoAndar] - a barra voltou a andar depois de um aviso
 * @param {number} [p.limiteMs]
 * @param {number} [p.avisoMs]
 * @param {function} [p.agendar]
 * @param {function} [p.cancelar]
 */
export function criarVigiaDoCarregamento(p) {
	const limiteMs = p.limiteMs || SEM_SINAL_MAXIMO_MS;
	const avisoMs = p.avisoMs || AVISO_DE_LENTIDAO_MS;
	// O relogio global e lido na HORA (e nao capturado aqui): a vigia do
	// `MapRenderer` nasce quando o modulo carrega, antes de qualquer relogio
	// falso de teste.
	const agendar = p.agendar || ((fn, ms) => setTimeout(fn, ms));
	const cancelar = p.cancelar || (id => clearTimeout(id));

	let ativa = false;
	let travou = false;
	let demorando = false;
	let relogioDaTravada = null;
	let relogioDoAviso = null;
	let ultimaAtividade = null;

	const chamar = (fn, arg) => {
		try {
			if (fn) fn(arg);
		} catch (erro) {
			console.error('[vigia do carregamento] retorno falhou', erro);
		}
	};
	const armarTravada = () => {
		if (relogioDaTravada !== null) cancelar(relogioDaTravada);
		relogioDaTravada = agendar(() => {
			relogioDaTravada = null;
			if (!ativa || travou) return;
			travou = true;
			chamar(p.aoTravar);
		}, limiteMs);
	};
	const armarAviso = () => {
		if (relogioDoAviso !== null) cancelar(relogioDoAviso);
		relogioDoAviso = agendar(() => {
			relogioDoAviso = null;
			if (!ativa) return;
			demorando = true;
			chamar(p.aoDemorar, ultimaAtividade);
		}, avisoMs);
	};
	const parar = () => {
		if (relogioDaTravada !== null) cancelar(relogioDaTravada);
		if (relogioDoAviso !== null) cancelar(relogioDoAviso);
		relogioDaTravada = null;
		relogioDoAviso = null;
	};

	return {
		/** A carga comecou (ou recomecou). */
		comecar() {
			ativa = true;
			travou = false;
			demorando = false;
			ultimaAtividade = null;
			armarTravada();
			armarAviso();
		},
		/** A barra andou. */
		progresso() {
			if (!ativa) return;
			ultimaAtividade = null;
			armarTravada();
			armarAviso();
			if (demorando) {
				demorando = false;
				chamar(p.aoAndar);
			}
		},
		/**
		 * A rede deu sinal (`{recebidos, total}` = bytes; `{tentativa}` = nova
		 * tentativa saindo).
		 * @param {object} atividade
		 */
		atividade(atividade) {
			if (!ativa) return;
			ultimaAtividade = atividade || null;
			if (!atividade || typeof atividade.tentativa !== 'number') {
				// Os bytes provam a carga viva. A nova tentativa, nao.
				armarTravada();
				if (travou) {
					// Voltou a chegar coisa depois da saida aberta: a carga se
					// recuperou sozinha, e quem decide fechar a saida e quem chama.
					travou = false;
				}
			}
			if (demorando) chamar(p.aoDemorar, ultimaAtividade);
		},
		/** A carga acabou (bem ou mal). */
		terminar() {
			ativa = false;
			parar();
		},
		/** A saida ja foi oferecida nesta carga? */
		travou() {
			return travou;
		}
	};
}
