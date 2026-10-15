/**
 * UI/Components/CharCreate/esperaDaCriacao.js
 *
 * RAGIDLE: A ESPERA DA CRIACAO DE PERSONAGEM (16/10/2026). Relato do dono, em
 * producao: depois de "Criar personagem" a tela parecia CONGELADA por uns 10 s
 * e so entao voltava a lista, com o personagem criado. O jogador novo (e a
 * primeira impressao do jogo) clicava 10 vezes.
 *
 * O servidor pode, legitimamente, levar segundos para responder o
 * `CH_MAKE_CHAR3`: desde o multiprocesso ele espera a conta ser liberada por
 * outro processo (ate 8 s) e depois a gravacao confirmar. A resposta e
 * `HC_ACCEPT_MAKECHAR` (sucesso) ou `HC_REFUSE_MAKECHAR` com o codigo.
 *
 * Esta peca e a DECISAO da espera, sem DOM e sem rede, para ter teste:
 *  - `comecar()` so aceita UM pedido por vez (o duplo clique, o Enter e o
 *    toque repetido mandam UM pacote);
 *  - `terminar()` e a resposta do servidor (aceite ou recusa);
 *  - sem resposta em `TEMPO_MAXIMO_DA_CRIACAO_MS`, a espera acaba sozinha e
 *    avisa (`aoEsgotar`). Ela NUNCA reenvia: o servidor pode ainda estar
 *    criando, e um segundo pedido viraria "nome ja existe" ou um duplicado.
 */

/** Teto da espera. O servidor leva ate ~8 s esperando a conta, mais a gravacao. */
export const TEMPO_MAXIMO_DA_CRIACAO_MS = 20000;

/** O rotulo do botao enquanto o servidor responde (o tradutor da borda o leva ao ingles). */
export const TEXTO_CRIANDO = 'Criando personagem...';

/** A caixa quando a espera esgota sem resposta. */
export const TEXTO_SERVIDOR_DEMOROU = 'O servidor demorou a responder. Tente novamente.';

/**
 * O `0xff` do `HC_REFUSE_MAKECHAR` ("Char creation denied"). Neste servidor ele
 * e, quase sempre, a conta presa por outro processo alem do prazo: passa
 * sozinho, e a frase diz isso em vez do "criacao negada" que soa definitivo.
 */
export const TEXTO_RECUSA_TEMPORARIA = 'Não foi possível criar agora. Tente novamente em alguns segundos.';

/**
 * @param {object} opcoes
 * @param {(criando: boolean) => void} opcoes.aoMudar - pinta o formulario (travado ou livre)
 * @param {() => void} opcoes.aoEsgotar - a espera acabou SEM resposta
 * @param {number} [opcoes.tempoMs]
 * @param {(fn: Function, ms: number) => any} [opcoes.agendar]
 * @param {(id: any) => void} [opcoes.desagendar]
 */
export function criarEsperaDaCriacao({
	aoMudar,
	aoEsgotar,
	tempoMs = TEMPO_MAXIMO_DA_CRIACAO_MS,
	agendar = (fn, ms) => setTimeout(fn, ms),
	desagendar = id => clearTimeout(id)
}) {
	let _emCurso = false;
	let _relogio = null;
	// O pedido da vez: o relogio de um pedido velho nunca solta o novo.
	let _pedido = 0;

	function soltar() {
		if (_relogio !== null) {
			desagendar(_relogio);
			_relogio = null;
		}
		const estava = _emCurso;
		_emCurso = false;
		return estava;
	}

	return {
		/** @returns {boolean} true se este pedido pode seguir; false se ja ha um no ar */
		comecar() {
			if (_emCurso) {
				return false;
			}
			_emCurso = true;
			const meu = ++_pedido;
			_relogio = agendar(() => {
				if (meu !== _pedido || !_emCurso) {
					return;
				}
				_relogio = null;
				_emCurso = false;
				aoMudar(false);
				aoEsgotar();
			}, tempoMs);
			aoMudar(true);
			return true;
		},

		/** A resposta chegou (ou a tela fechou): solta o formulario. */
		terminar() {
			if (soltar()) {
				aoMudar(false);
			}
		},

		/** @returns {boolean} */
		emCurso() {
			return _emCurso;
		}
	};
}

/**
 * Depois da espera esgotada, o CharEngine pede a lista de novo: se o servidor
 * criou o personagem mesmo assim, ele ja esta na vaga pedida, e o jogador vai
 * para a lista VER o personagem em vez de tentar de novo (o que daria "nome ja
 * existe"). `CharNum` e a vaga na lista do `HC_ACCEPT_ENTER_NEO_UNION`.
 *
 * @param {Array<{CharNum: number}>|undefined} lista
 * @param {number} vaga
 * @returns {object|null}
 */
export function personagemCriadoNaLista(lista, vaga) {
	if (!Array.isArray(lista)) {
		return null;
	}
	return lista.find(personagem => personagem && personagem.CharNum === vaga) || null;
}
