/**
 * Utils/saldoDeCash.js
 *
 * A FONTE UNICA DO SALDO DE RO CASH NO CLIENTE (RO Shop, rodada 2, 22/09/2026).
 *
 * ---------------------------------------------------------------------------
 * O DEFEITO QUE ELA FECHA (QA_PLAN do RO Shop, risco P1-02)
 * ---------------------------------------------------------------------------
 * Quatro lugares mostram o mesmo dinheiro da mesma conta: a pilula da HUD
 * (`Session.cash`, alimentada pelo 0x0fce), a carteira do RO Shop
 * (`estado.moeda.saldoMinor`), a da Temporada (`estado.moeda.saldoMinor` ou o
 * saldo do Passe) e a do Passe. Cada janela lia SO o proprio pacote: comprar
 * no RO Shop com a Temporada aberta deixava a Temporada mostrando o saldo de
 * antes da compra ate o proximo pacote DELA - e o jogador via dois saldos
 * diferentes na mesma tela.
 *
 * ---------------------------------------------------------------------------
 * A REGRA
 * ---------------------------------------------------------------------------
 * Todo pacote do servidor que traz o saldo PUBLICA aqui (`publicarSaldoDeCash`)
 * e toda carteira na tela LE daqui (`saldoDeCashConhecido`) ou ASSINA a
 * mudanca (`assinarSaldoDeCash`). O ultimo numero que chegou vence: os pacotes
 * vem de uma conexao so, na ordem em que o servidor os escreveu, e cada um
 * traz o saldo do instante em que saiu - o mais novo e o verdadeiro.
 *
 * Publicar nao e decidir nada: quem debita e credita continua sendo o
 * servidor. Este modulo so garante que as janelas concordem com o ULTIMO
 * numero que ele mandou.
 *
 * `Session.cash` continua sendo o campo que a HUD le (a cada 250 ms, sem
 * gancho); este modulo e quem escreve nele.
 */

import Session from 'Engine/SessionStorage.js';
import { ehMinor } from 'Utils/roCash.js';

const _ouvintes = new Set();

/* `Session.cash` nasce 0, e 0 e um saldo possivel: a janela precisa saber se
   o numero ja chegou do servidor ou se e so o valor inicial do campo. */
let _conhecido = false;

/**
 * Um pacote do servidor trouxe o saldo (em MINOR). Devolve `true` quando o
 * numero mudou e os ouvintes foram avisados. Valor que nao e minor (float,
 * texto, negativo) e ignorado: nunca um saldo adivinhado.
 *
 * @param {number} minor
 * @returns {boolean}
 */
export function publicarSaldoDeCash(minor) {
	if (!ehMinor(minor) || minor < 0) {
		return false;
	}
	const mudou = !_conhecido || Session.cash !== minor;
	Session.cash = minor;
	_conhecido = true;
	if (!mudou) {
		return false;
	}
	_ouvintes.forEach(fn => {
		/* Um ouvinte com defeito nao pode calar os outros - nem subir para o
		   laco de rede que chamou (excecao-no-laco-de-rede). */
		try {
			fn(minor);
		} catch (err) {
			console.error('[saldoDeCash] ouvinte falhou', err);
		}
	});
	return true;
}

/** O saldo em MINOR se algum pacote ja o trouxe; senao `null`. */
export function saldoDeCashConhecido() {
	return _conhecido && ehMinor(Session.cash) ? Session.cash : null;
}

/**
 * Avisa `fn(minor)` a cada saldo NOVO. Devolve a funcao que desliga.
 *
 * @param {function(number):void} fn
 * @returns {function():void}
 */
export function assinarSaldoDeCash(fn) {
	if (typeof fn !== 'function') {
		return () => {};
	}
	_ouvintes.add(fn);
	return () => _ouvintes.delete(fn);
}

/** Troca de conta (volta ao login): o saldo da conta anterior nao vale mais. */
export function esquecerSaldoDeCash() {
	_conhecido = false;
	Session.cash = 0;
}
