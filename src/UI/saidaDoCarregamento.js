/**
 * UI/saidaDoCarregamento.js
 *
 * A SAIDA VISIVEL DA TELA DE CARREGAMENTO PRESA (D-2055, 06/10/2026 — relatos
 * de producao: "a barra parou em 2% e nunca termina", sobretudo no celular).
 *
 * Duas pecas, as duas por cima da arte de carregamento (`UI/Background.js`):
 *
 *  - o AVISO, uma linha logo abaixo da barra, sem clique: aparece so quando a
 *    barra fica parada um tempo (`AVISO_DE_LENTIDAO_MS`) e diz o que esta
 *    acontecendo ("Baixando o mapa: 2,1 de 5,4 MB", "A conexão falhou;
 *    tentando de novo (1 de 3)"). A barra fica como sempre foi: numa entrada
 *    normal nada disto aparece;
 *  - a SAIDA, um painel com "Tentar de novo" (refaz a carga do mapa sem sair
 *    do jogo: o socket e o login ficam) e "Recarregar o jogo" (recarrega a
 *    pagina pela retomada de D-997, sem pedir a senha quando da). Ela aparece
 *    quando nada anda por `SEM_SINAL_MAXIMO_MS`, ou quando a carga falha.
 *
 * Nada aqui roda antes do `CZ_NOTIFY_ACTORINIT` de uma carga que ANDA: as
 * duas pecas so existem numa carga parada ou falha, e cada chamada e
 * protegida por quem a faz (`MapRenderer`). Mesmo assim nenhuma funcao deste
 * arquivo lanca: DOM ausente e um `return`.
 *
 * Mobile (regra do dono de 08/09/2026): botoes de 44px de altura no dedo
 * (`--hit-touch`), o painel cabe em 393px com a margem segura, e o texto
 * quebra em vez de vazar. O ESC nao fecha o painel de proposito: ele nao e uma
 * janela do jogo (nao entra em `pilhaDeJanelas`), e fecha-lo deixaria o
 * jogador de novo na barra parada, sem saida.
 */
import { traduzir } from 'Core/Traducao.js';

/** A carga parada sem NENHUM sinal (barra nem bytes) por isto mostra a saida. */
export const SEM_SINAL_MAXIMO_MS = 45000;

/** A barra parada por isto, mesmo com bytes chegando, mostra o aviso. */
export const AVISO_DE_LENTIDAO_MS = 8000;

let _aviso = null;
let _saida = null;

function injetarCss() {
	if (typeof document === 'undefined' || document.querySelector('style[data-ragidle-saida-da-carga]')) {
		return;
	}
	const style = document.createElement('style');
	style.setAttribute('data-ragidle-saida-da-carga', '');
	style.textContent = `
		/* O aviso fica logo abaixo da barra (a barra mora em top: 75%, 16px). */
		.rag-carga-aviso {
			position: fixed;
			left: 50%;
			top: calc(75% + 24px);
			transform: translateX(-50%);
			z-index: 1001;
			max-width: calc(100vw - 32px);
			text-align: center;
			font: var(--type-info);
			color: var(--gold-200);
			text-shadow: 0 1px 2px rgba(9, 21, 38, 0.9), 0 0 12px rgba(9, 21, 38, 0.75);
			pointer-events: none;
		}
		.rag-carga-saida {
			position: fixed;
			left: 50%;
			top: 50%;
			transform: translate(-50%, -50%);
			z-index: 1002;
			box-sizing: border-box;
			width: min(420px, calc(100vw - 32px - var(--safe-esq) - var(--safe-dir)));
			max-height: calc(100vh - 32px - var(--safe-topo) - var(--safe-baixo));
			overflow-y: auto;
			padding: var(--pad-window);
			background: var(--window-fill);
			border: var(--window-frame);
			border-radius: var(--radius-window);
			box-shadow: var(--window-shadow);
			pointer-events: auto;
		}
		.rag-carga-saida-titulo {
			font: var(--type-window-title);
			color: var(--text-title);
			margin-bottom: var(--sp-4);
		}
		.rag-carga-saida-texto {
			font: var(--type-info);
			line-height: var(--lh-read);
			color: var(--text-body);
			overflow-wrap: anywhere;
		}
		.rag-carga-saida-botoes {
			display: flex;
			flex-wrap: wrap;
			gap: var(--sp-4);
			justify-content: flex-end;
			margin-top: var(--sp-7);
		}
		.rag-carga-saida-botoes .ri-btn {
			min-height: 32px;
		}
		.rag-carga-saida.rag-carga-dedo .ri-btn {
			min-height: var(--hit-touch);
			flex: 1 1 140px;
		}
	`;
	document.head.appendChild(style);
}

/**
 * Mostra (ou troca) a linha do aviso. Texto vazio esconde.
 * @param {string} texto
 */
export function mostrarAviso(texto) {
	try {
		if (typeof document === 'undefined') return;
		if (!texto) {
			esconderAviso();
			return;
		}
		injetarCss();
		if (!_aviso) {
			_aviso = document.createElement('div');
			_aviso.className = 'rag-carga-aviso';
			_aviso.setAttribute('role', 'status');
		}
		_aviso.textContent = traduzir(texto);
		if (!_aviso.parentNode) document.body.appendChild(_aviso);
	} catch {
		/* o aviso nao pode virar erro */
	}
}

export function esconderAviso() {
	try {
		if (_aviso && _aviso.parentNode) _aviso.parentNode.removeChild(_aviso);
	} catch {
		/* idem */
	}
}

/**
 * Mostra a saida. Chamar de novo troca o texto (a carga que falhou de vez
 * depois da saida ja aberta).
 *
 * @param {object} p
 * @param {string} p.texto - o que aconteceu, para quem joga
 * @param {function} p.aoTentar - "Tentar de novo"
 * @param {function} p.aoRecarregar - "Recarregar o jogo"
 * @param {boolean} [p.dedo] - o aparelho e de toque (alvos de 44px)
 */
export function mostrarSaida(p) {
	try {
		if (typeof document === 'undefined') return;
		injetarCss();
		esconderAviso();
		if (!_saida) {
			_saida = document.createElement('div');
			_saida.className = 'rag-carga-saida';
			_saida.setAttribute('role', 'alertdialog');
			_saida.setAttribute('aria-modal', 'true');
			const titulo = document.createElement('div');
			titulo.className = 'rag-carga-saida-titulo';
			const texto = document.createElement('div');
			texto.className = 'rag-carga-saida-texto';
			const botoes = document.createElement('div');
			botoes.className = 'rag-carga-saida-botoes';
			const recarregar = document.createElement('button');
			recarregar.type = 'button';
			recarregar.className = 'ri-btn ri-btn--sec';
			recarregar.setAttribute('data-acao', 'recarregar');
			const tentar = document.createElement('button');
			tentar.type = 'button';
			tentar.className = 'ri-btn';
			tentar.setAttribute('data-acao', 'tentar');
			botoes.appendChild(recarregar);
			botoes.appendChild(tentar);
			_saida.appendChild(titulo);
			_saida.appendChild(texto);
			_saida.appendChild(botoes);
			// O clique nao atravessa para o jogo atras (o canvas escuta o body).
			for (const tipo of [
				'mousedown',
				'mouseup',
				'click',
				'touchstart',
				'touchend',
				'pointerdown',
				'pointerup',
				'wheel'
			]) {
				_saida.addEventListener(tipo, e => e.stopPropagation());
			}
		}
		_saida.classList.toggle('rag-carga-dedo', !!p.dedo);
		_saida.querySelector('.rag-carga-saida-titulo').textContent = traduzir('O carregamento do mapa parou');
		_saida.querySelector('.rag-carga-saida-texto').textContent = traduzir(p.texto || '');
		const tentar = _saida.querySelector('[data-acao="tentar"]');
		const recarregar = _saida.querySelector('[data-acao="recarregar"]');
		tentar.textContent = traduzir('Tentar de novo');
		recarregar.textContent = traduzir('Recarregar o jogo');
		// Um clique so por botao: o segundo toque nervoso nao refaz a carga duas vezes.
		tentar.onclick = () => {
			esconderSaida();
			if (p.aoTentar) p.aoTentar();
		};
		recarregar.onclick = () => {
			tentar.disabled = true;
			recarregar.disabled = true;
			if (p.aoRecarregar) p.aoRecarregar();
		};
		tentar.disabled = false;
		recarregar.disabled = false;
		if (!_saida.parentNode) document.body.appendChild(_saida);
	} catch {
		/* a saida nao pode virar erro */
	}
}

export function esconderSaida() {
	try {
		if (_saida && _saida.parentNode) _saida.parentNode.removeChild(_saida);
	} catch {
		/* idem */
	}
}

/** A saida esta na tela? (a sonda e os testes perguntam) */
export function saidaVisivel() {
	return !!(_saida && _saida.parentNode);
}

/**
 * O texto da carga parada, no verbo do aparelho: "Toque" no dedo, "Clique" no
 * mouse (D-2055 - o desktop lia "Toque em" para um botao que se clica). Puro;
 * quem pergunta "e dedo?" e quem chama (`ehDedo()`, `UI/escalaDaHud.js`).
 *
 * @param {boolean} dedo
 * @returns {string}
 */
export function textoDaCargaParada(dedo) {
	return dedo
		? 'O mapa parou de chegar do servidor. Toque em "Tentar de novo" para pedir o mapa outra vez.'
		: 'O mapa parou de chegar do servidor. Clique em "Tentar de novo" para pedir o mapa outra vez.';
}

/** Esconde as duas pecas (o mapa carregou, ou outra carga comecou). */
export function esconderTudo() {
	esconderAviso();
	esconderSaida();
}

/**
 * O texto do aviso para a atividade da rede. Puro.
 *
 * @param {{recebidos?: number, total?: number, tentativa?: number}|null} atividade
 * @param {number} maximoDeTentativas
 * @returns {string}
 */
export function textoDoAviso(atividade, maximoDeTentativas) {
	if (atividade && typeof atividade.tentativa === 'number') {
		return `A conexão falhou; tentando de novo (${atividade.tentativa} de ${maximoDeTentativas})`;
	}
	if (atividade && atividade.recebidos > 0) {
		const mb = n => (n / 1048576).toFixed(1).replace('.', ',');
		if (atividade.total > 0) {
			return `Baixando o mapa: ${mb(atividade.recebidos)} de ${mb(atividade.total)} MB`;
		}
		return `Baixando o mapa: ${mb(atividade.recebidos)} MB`;
	}
	return 'Aguardando o servidor...';
}
