/**
 * UI/Components/CacaMedidaIdle/controladorDaCacaMedida.js
 *
 * O CONTROLADOR da janela "Seus mapas" (28/09/2026): abrir, fechar, receber o
 * pacote e o relogio do `pedir`. Recebe o DOM, o envio e o relogio por
 * injecao — e isso que deixa o teste rodar a janela de verdade no jsdom, com o
 * HTML real e um relogio manual, sem WebGL nem sessao logada.
 *
 * ## As tres regras de custo (contrato, secao 6)
 *
 * 1. **Um `innerHTML` por pacote.** O corpo sai inteiro de
 *    `montarHtmlDaCacaMedida` e e escrito de uma vez.
 * 2. **Nada com a janela fechada.** O pacote que chega sem `abrir` e com a
 *    janela fechada e descartado sem desenhar; o relogio do `pedir` so existe
 *    enquanto ela esta aberta.
 * 3. **Nenhum ouvinte por cartao.** O clique e delegado no corpo, entao
 *    redesenhar a cada 15 s nao religa nada.
 *
 * This file is part of the ragidle fork of ROBrowser.
 */
import { CRITERIO, INTERVALO_DO_PEDIDO_MS, montarHtmlDaCacaMedida } from './formatoDaCacaMedida.js';

/**
 * @param {object} d
 * @param {function(): (Element|ShadowRoot|null)} d.raiz  onde moram `.cm-window` e `.cm-corpo`
 * @param {function(string): void} d.enviar                manda `{ acao }` ao servidor
 * @param {{ setInterval: function, clearInterval: function }} [d.relogio]
 * @param {string} [d.criterioInicial]
 * @param {function(string): void} [d.aoTrocarCriterio]    para lembrar a escolha
 */
export function criarControladorDaCacaMedida({ raiz, enviar, relogio, criterioInicial, aoTrocarCriterio }) {
	const tempo = relogio || { setInterval: (f, ms) => setInterval(f, ms), clearInterval: id => clearInterval(id) };
	let dados = null;
	let criterio = criterioInicial === CRITERIO.ZENY ? CRITERIO.ZENY : CRITERIO.EXP;
	let temporizador = null;

	const elemento = seletor => {
		const r = raiz();
		return r ? r.querySelector(seletor) : null;
	};

	function estaAberta() {
		const janela = elemento('.cm-window');
		return !!(janela && janela.classList.contains('is-open'));
	}

	function desenhar() {
		const corpo = elemento('.cm-corpo');
		if (corpo) {
			corpo.innerHTML = montarHtmlDaCacaMedida(dados, criterio);
		}
	}

	function marcarSeletor() {
		const r = raiz();
		if (!r) {
			return;
		}
		r.querySelectorAll('.cm-criterio').forEach(botao => {
			const ativo = botao.dataset.criterio === criterio;
			botao.classList.toggle('is-active', ativo);
			botao.setAttribute('aria-pressed', ativo ? 'true' : 'false');
		});
	}

	function pararRelogio() {
		if (temporizador !== null) {
			tempo.clearInterval(temporizador);
			temporizador = null;
		}
	}

	function ligarRelogio() {
		pararRelogio();
		temporizador = tempo.setInterval(() => {
			// A guarda e a regra "nada com a janela fechada" escrita de novo
			// aqui: se alguem fechar por fora (tirando o `is-open` direto), o
			// proximo tique desliga o relogio em vez de pedir para ninguem.
			if (!estaAberta()) {
				pararRelogio();
				return;
			}
			enviar('pedir');
		}, INTERVALO_DO_PEDIDO_MS);
	}

	/**
	 * Abre (ou reabre) a janela. `pedir: false` e para quando o pacote que
	 * mandou abrir JA trouxe o estado — pedir de novo seria um vai-e-volta
	 * para receber o que acabou de chegar.
	 */
	function abrir({ pedir = true } = {}) {
		const janela = elemento('.cm-window');
		if (!janela) {
			return;
		}
		janela.classList.add('is-open');
		marcarSeletor();
		desenhar();
		if (pedir) {
			enviar('pedir');
		}
		ligarRelogio();
	}

	function fechar() {
		pararRelogio();
		const janela = elemento('.cm-window');
		if (janela) {
			janela.classList.remove('is-open');
		}
	}

	/**
	 * Um `0x0fb5` ja lido. Devolve o que o dono do componente precisa fazer:
	 * `'abrir'` (o comando pediu e a janela esta fechada — quem abre e o
	 * `toggle()`, para a pilha de janelas ver), `'desenhou'` ou `'ignorado'`.
	 */
	function receber(novo) {
		if (!novo) {
			return 'ignorado';
		}
		if (estaAberta()) {
			dados = novo;
			desenhar();
			return 'desenhou';
		}
		if (novo.abrir) {
			dados = novo;
			return 'abrir';
		}
		// Fechada e sem pedido de abrir: nao guarda, nao desenha. A proxima
		// abertura pede o estado de novo.
		return 'ignorado';
	}

	function trocarCriterio(novo) {
		const valido = novo === CRITERIO.ZENY ? CRITERIO.ZENY : CRITERIO.EXP;
		if (valido === criterio) {
			return;
		}
		criterio = valido;
		marcarSeletor();
		desenhar();
		if (aoTrocarCriterio) {
			aoTrocarCriterio(criterio);
		}
	}

	/**
	 * O clique delegado do corpo: os botoes levam `data-acao`. O botao e
	 * desligado na hora, para um segundo toque nao mandar o verbo duas vezes;
	 * o proximo pacote redesenha o corpo e ele volta (ou some) com o estado
	 * que o servidor decidiu.
	 */
	function aoClicarNoCorpo(evento) {
		const alvo = evento.target && evento.target.closest ? evento.target.closest('[data-acao]') : null;
		if (!alvo || alvo.disabled) {
			return;
		}
		const acao = alvo.dataset.acao;
		if (acao !== 'explorar' && acao !== 'cancelar') {
			return;
		}
		alvo.disabled = true;
		enviar(acao);
	}

	/** A troca de personagem: fecha, esquece o dado e o relogio. */
	function esquecer() {
		pararRelogio();
		dados = null;
	}

	return {
		abrir,
		fechar,
		receber,
		estaAberta,
		trocarCriterio,
		aoClicarNoCorpo,
		pararRelogio,
		esquecer,
		get criterio() {
			return criterio;
		},
		get dados() {
			return dados;
		},
		get relogioLigado() {
			return temporizador !== null;
		}
	};
}
