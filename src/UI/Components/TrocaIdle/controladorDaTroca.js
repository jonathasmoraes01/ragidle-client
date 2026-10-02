/**
 * UI/Components/TrocaIdle/controladorDaTroca.js
 *
 * O CONTROLADOR da janela "Trade" (02/10/2026, pedido do dono): um campo, o
 * nome do personagem, e o botao "Confirmar". Ele NAO importa Network nem
 * GUIComponent - quem liga isso ao jogo e `TrocaIdle.js`, passando `enviar`.
 * E essa costura que deixa a janela inteira rodar no jsdom (teste) sem
 * servidor, o mesmo desenho do `controladorDaDoacao.js`.
 *
 * ---------------------------------------------------------------------------
 * O FIO (servidor/mapa/troca-pelo-nome.ts)
 * ---------------------------------------------------------------------------
 *   sobe:  { acao: 'pedir', nome }                           0x0fb2
 *   desce: { v: 1, acao: 'pedir', ok, motivo, texto, nome }  0x0fb3
 *
 * Quem decide TUDO e o servidor: o VIP dos dois, o mesmo mapa, as 2 celulas
 * do rAthena e a troca em andamento. A janela so confere o que nao precisa
 * dele (o nome vazio) e mostra a FRASE que desceu - toda recusa vem com o
 * motivo, para o jogador ver na tela por que nao deu.
 *
 * Aceito o pedido, quem segue e o caminho NATIVO: o outro jogador recebe a
 * caixa "aceitar?" e, aceitando, a janela de troca abre nos dois lados
 * (`Engine/MapEngine/Trade.js`). Esta janela so escuta a resposta para fechar
 * quando a troca abre, ou dizer que o outro recusou.
 */

/** Sem resposta do servidor em 10 s, a trava abre e avisa. */
export const TIMEOUT_DO_PEDIDO_MS = 10000;

/** O resultado do `ZC_ACK_EXCHANGE_ITEM` que abre a janela de troca (Trade.js). */
export const RESPOSTA_ACEITOU = 3;
/** O resultado de "cancelado": o outro recusou, ou o pedido caiu. */
export const RESPOSTA_CANCELOU = 4;

/** O nome como vai no pedido: aparado. A caixa fica - o servidor nao a diferencia. */
export function nomeParaEnvio(texto) {
	return String(texto == null ? '' : texto).trim();
}

/**
 * @param {object} opcoes
 * @param {Element|ShadowRoot} opcoes.raiz - onde mora o HTML de TrocaIdle.html
 * @param {function(object):void} opcoes.enviar - manda um corpo JSON ao servidor
 * @param {function():void} [opcoes.fechar] - fecha a janela (a troca abriu)
 * @param {function(function, number):*} [opcoes.agendar]
 * @param {function(*):void} [opcoes.cancelar]
 */
export function criarControladorDaTroca(opcoes) {
	const raiz = opcoes.raiz;
	const enviar = opcoes.enviar;
	const fechar = opcoes.fechar || (() => {});
	const agendar = opcoes.agendar || ((fn, ms) => setTimeout(fn, ms));
	const cancelar = opcoes.cancelar || (id => clearTimeout(id));

	const s = {
		enviando: false,
		/** O pedido saiu e o outro ainda nao respondeu: e quando o 3/4 nativo interessa. */
		aguardandoResposta: false,
		nomeDoAlvo: '',
		recado: '',
		tom: '' // '' | 'is-erro' | 'is-ok'
	};
	let _timer = null;

	const $ = sel => raiz.querySelector(sel);

	function desenhar() {
		const recado = $('.tr-recado');
		if (recado) {
			recado.textContent = s.recado;
			recado.className = 'tr-recado' + (s.tom ? ' ' + s.tom : '');
		}
		const botao = $('.tr-confirmar');
		if (botao) {
			botao.disabled = s.enviando;
			botao.setAttribute('aria-busy', s.enviando ? 'true' : 'false');
		}
	}

	function avisar(texto, tom) {
		s.recado = texto;
		s.tom = tom;
		desenhar();
	}

	function pararRelogio() {
		if (_timer) {
			cancelar(_timer);
			_timer = null;
		}
	}

	/** O "Confirmar" (e o Enter do campo). Devolve `true` se o pedido saiu. */
	function confirmar() {
		if (s.enviando) {
			return false;
		}
		const campo = $('.tr-nome');
		const nome = nomeParaEnvio(campo ? campo.value : '');
		if (!nome) {
			avisar('Digite o nome do personagem.', 'is-erro');
			return false;
		}
		s.enviando = true;
		s.aguardandoResposta = false;
		avisar('Enviando o pedido de troca…', '');
		enviar({ acao: 'pedir', nome });
		pararRelogio();
		_timer = agendar(() => {
			_timer = null;
			if (!s.enviando) {
				return;
			}
			s.enviando = false;
			avisar('O servidor não respondeu. Tente de novo.', 'is-erro');
		}, TIMEOUT_DO_PEDIDO_MS);
		return true;
	}

	/** A resposta do servidor (0x0fb3). Devolve `true` se era desta janela. */
	function receber(dados) {
		if (!dados || typeof dados !== 'object' || dados.acao !== 'pedir') {
			return false;
		}
		pararRelogio();
		s.enviando = false;
		const ok = dados.ok === true;
		const texto = typeof dados.texto === 'string' ? dados.texto.trim() : '';
		s.aguardandoResposta = ok;
		s.nomeDoAlvo = typeof dados.nome === 'string' ? dados.nome : '';
		avisar(
			texto || (ok ? 'Pedido de troca enviado. Aguarde a resposta.' : 'Não foi possível pedir a troca.'),
			ok ? 'is-ok' : 'is-erro'
		);
		return true;
	}

	/**
	 * A resposta NATIVA ao pedido (`ZC_ACK_EXCHANGE_ITEM`, o dono e
	 * `Engine/MapEngine/Trade.js`). So interessa com o pedido desta janela no
	 * ar: aceito, a janela de troca abriu e esta sai da frente; recusado, o
	 * motivo fica aqui, e nao so no chat.
	 */
	function receberRespostaNativa(resultado) {
		if (!s.aguardandoResposta) {
			return false;
		}
		if (resultado === RESPOSTA_ACEITOU) {
			s.aguardandoResposta = false;
			avisar('', '');
			fechar();
			return true;
		}
		if (resultado === RESPOSTA_CANCELOU) {
			s.aguardandoResposta = false;
			const quem = s.nomeDoAlvo || 'O outro jogador';
			avisar(`${quem} recusou o pedido de troca.`, 'is-erro');
			return true;
		}
		return false;
	}

	/** Abrir comeca limpo: sem recado velho e sem trava presa. */
	function aoAbrir() {
		pararRelogio();
		s.enviando = false;
		avisar('', '');
		const campo = $('.tr-nome');
		if (campo && typeof campo.focus === 'function') {
			campo.focus();
		}
	}

	/** Fechar esquece o recado; um pedido no ar segue no servidor como pedido nativo. */
	function aoFechar() {
		pararRelogio();
		s.enviando = false;
		avisar('', '');
	}

	return {
		confirmar,
		receber,
		receberRespostaNativa,
		aoAbrir,
		aoFechar,
		estado: () => ({ ...s })
	};
}
