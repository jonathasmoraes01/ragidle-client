/**
 * applications/pwa/registrar-sw.js — a ponte entre o service worker e o jogador
 * (D-933, 05/09/2026).
 *
 * Três trabalhos, e nenhum deles depende do jogo estar carregado:
 *
 *   1. registrar o service worker;
 *   2. avisar, DENTRO do jogo, quando existe versão nova — com um botão, e
 *      nunca recarregando sozinho;
 *   3. guardar o `beforeinstallprompt` para o botão "Instalar" das
 *      Configurações poder dispará-lo depois.
 *
 * ─── POR QUE ELE É AUTÔNOMO ─────────────────────────────────────────────
 * Este arquivo roda na CASCA, e a casca hospeda o jogo de dois jeitos
 * diferentes: em desenvolvimento o jogo vive num `<iframe>`
 * (`ROBrowser.TYPE.FRAME`), e em produção ele é embutido no mesmo documento.
 * Um aviso que dependesse dos componentes do jogo funcionaria num e não no
 * outro — e o "não no outro" seria justamente produção.
 *
 * Por isso o aviso é um `<dialog>`-menos, montado à mão com estilo embutido:
 * ele aparece igual nos dois, sem importar nada.
 *
 * ─── E POR QUE ELE NÃO MEXE NO PROTOCOLO ────────────────────────────────
 * A Fase 4 pedia "compare versão de protocolo no handshake". Isso mudaria o
 * protocolo WebSocket, e a frente tem ordem explícita de NÃO tocar nele sem
 * autorização. O que dá o mesmo resultado sem atravessar essa linha: a casca
 * pergunta ao service worker se existe versão nova do CLIENTE. Se existe, o
 * jogador vê o aviso — e um cliente desatualizado deixa de falar com um
 * servidor novo em silêncio, que era o objetivo.
 *
 * A comparação no handshake fica registrada como decisão pendente do dono.
 */
(function () {
	'use strict';

	/* Vira verdadeiro só quando o jogador clica em "Recarregar" no aviso de
	   versão nova. Sem isso, a troca de controller da PRIMEIRA instalação
	   recarregaria a página no meio do carregamento do jogo. */
	var _trocaPedida = false;
	var _recarregando = false;

	var API = {
		/** O `beforeinstallprompt` guardado, ou `null`. */
		promptDeInstalacao: null,
		/** O worker esperando para assumir, ou `null`. */
		versaoNova: null,
	};
	window.RagIdlePWA = API;

	/* ═════════════════════════════════════════════════════════════════════
	   O AVISO DE VERSÃO NOVA
	   ═════════════════════════════════════════════════════════════════════ */

	function mostrarAviso(aoRecarregar) {
		if (document.getElementById('ri-aviso-versao')) {
			return;
		}
		var caixa = document.createElement('div');
		caixa.id = 'ri-aviso-versao';
		caixa.setAttribute('role', 'status');
		caixa.style.cssText = [
			'position:fixed',
			'left:50%',
			'transform:translateX(-50%)',
			/* Em CIMA, e não embaixo: o rodapé do jogo é onde moram a doca, o
			   chat e a barra de atalhos (D-930), e um aviso ali cobriria o que
			   o jogador usa. */
			'top:calc(env(safe-area-inset-top, 0px) + 12px)',
			'z-index:2147483000',
			'display:flex',
			'align-items:center',
			'gap:12px',
			'max-width:calc(100vw - 24px)',
			'padding:10px 12px',
			'border-radius:10px',
			'border:1px solid rgba(232,184,75,0.45)',
			'background:rgba(6,8,16,0.96)',
			'color:#f4f8fd',
			'font:600 13px/1.3 system-ui,Segoe UI,Arial,sans-serif',
			'box-shadow:0 6px 24px rgba(0,0,0,0.45)',
		].join(';');

		var texto = document.createElement('span');
		texto.textContent = 'Nova versão do jogo disponível.';
		texto.style.cssText = 'flex:1;min-width:0';

		var recarregar = document.createElement('button');
		recarregar.type = 'button';
		recarregar.textContent = 'Recarregar';
		/* 44px de altura: este botão nasce num celular tanto quanto num
		   computador, e o piso tátil vale para ele igual. */
		recarregar.style.cssText = [
			'min-height:44px',
			'padding:0 14px',
			'border-radius:8px',
			'border:1px solid rgba(232,184,75,0.6)',
			'background:linear-gradient(180deg,#e0b04d,#c9a227)',
			'color:#12294a',
			'font:700 13px system-ui,Segoe UI,Arial,sans-serif',
			'cursor:pointer',
		].join(';');
		recarregar.addEventListener('click', aoRecarregar);

		var depois = document.createElement('button');
		depois.type = 'button';
		depois.textContent = 'Depois';
		depois.setAttribute('aria-label', 'Dispensar o aviso de nova versão');
		depois.style.cssText = [
			'min-height:44px',
			'padding:0 10px',
			'border-radius:8px',
			'border:1px solid rgba(255,255,255,0.18)',
			'background:transparent',
			'color:#c3d8ee',
			'font:600 13px system-ui,Segoe UI,Arial,sans-serif',
			'cursor:pointer',
		].join(';');
		depois.addEventListener('click', function () {
			caixa.remove();
		});

		caixa.appendChild(texto);
		caixa.appendChild(recarregar);
		caixa.appendChild(depois);
		document.body.appendChild(caixa);
	}

	/* ═════════════════════════════════════════════════════════════════════
	   REGISTRO
	   ═════════════════════════════════════════════════════════════════════ */

	if ('serviceWorker' in navigator) {
		window.addEventListener('load', function () {
			navigator.serviceWorker
				.register('./sw.js', { scope: './' })
				.then(function (registro) {
					function vigiar(worker) {
						if (!worker) {
							return;
						}
						worker.addEventListener('statechange', function () {
							/*
							 * `installed` COM um controller já ativo = versão
							 * nova esperando. Sem controller é a PRIMEIRA
							 * instalação, e avisar "nova versão" para quem
							 * acabou de abrir o jogo pela primeira vez seria
							 * mentira.
							 */
							if (worker.state === 'installed' && navigator.serviceWorker.controller) {
								API.versaoNova = worker;
								mostrarAviso(function () {
									/* Só a partir daqui a troca de controller é
									   ESPERADA — ver a guarda do
									   `controllerchange` abaixo. */
									_trocaPedida = true;
									worker.postMessage({ tipo: 'ragidle:assumir' });
								});
							}
						});
					}

					vigiar(registro.waiting);
					vigiar(registro.installing);
					registro.addEventListener('updatefound', function () {
						vigiar(registro.installing);
					});
				})
				.catch(function (erro) {
					/* Sem service worker o jogo funciona igual — ele é cache e
					   instalação, não gameplay. Falhar aqui não pode derrubar
					   nada. */
					console.warn('[PWA] service worker nao registrou:', erro && erro.message);
				});

			/*
			 * ═══════════════════════════════════════════════════════════
			 * RECARREGA SÓ SE O JOGADOR PEDIU — a guarda que faltava
			 * ═══════════════════════════════════════════════════════════
			 * A primeira versão recarregava em QUALQUER `controllerchange`, e
			 * a prova de instalabilidade pegou o defeito na cara: o `sw.js`
			 * chama `clients.claim()` no `activate`, o que faz o worker assumir
			 * a página JÁ CARREGADA. Isso dispara `controllerchange` na
			 * **primeira visita de todo mundo** — e a página recarregava
			 * sozinha no meio do carregamento de um jogo que leva ~10s para
			 * abrir.
			 *
			 * `_trocaPedida` só vira verdadeiro quando o jogador clica em
			 * "Recarregar" no aviso de versão nova. Sem clique, a troca de
			 * controller é a instalação normal e não se faz nada.
			 *
			 * `_recarregando` continua ali por outro motivo: algumas versões do
			 * Chrome disparam este evento uma vez a mais, e duas recargas
			 * seguidas piscam.
			 */
			navigator.serviceWorker.addEventListener('controllerchange', function () {
				if (!_trocaPedida || _recarregando) {
					return;
				}
				_recarregando = true;
				window.location.reload();
			});
		});
	}

	/* ═════════════════════════════════════════════════════════════════════
	   O BOTÃO INSTALAR — o evento é guardado, quem dispara é as Configurações
	   ═════════════════════════════════════════════════════════════════════ */

	window.addEventListener('beforeinstallprompt', function (evento) {
		/* `preventDefault` para o navegador NÃO mostrar o banner dele. O pedido
		   do dono é explícito: o botão mora nas Configurações, e nada de banner
		   intrusivo no meio do jogo. */
		evento.preventDefault();
		API.promptDeInstalacao = evento;
		window.dispatchEvent(new CustomEvent('ragidle:pode-instalar'));
	});

	window.addEventListener('appinstalled', function () {
		API.promptDeInstalacao = null;
		window.dispatchEvent(new CustomEvent('ragidle:instalado'));
	});

	/** O jogo está rodando instalado (sem barra do navegador)? */
	API.estaInstalado = function () {
		return (
			window.matchMedia('(display-mode: standalone)').matches ||
			window.matchMedia('(display-mode: fullscreen)').matches ||
			window.navigator.standalone === true
		);
	};

	/** É Safari no iOS? Lá o `beforeinstallprompt` não existe. */
	API.ehIOS = function () {
		var ua = navigator.userAgent || '';
		var ehApple = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
		var ehSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
		return ehApple && ehSafari;
	};

	/**
	 * Dispara a instalação. Devolve o que aconteceu, para as Configurações
	 * poderem dizer a verdade em vez de fingir que deu certo.
	 *
	 * @returns {Promise<'instalado'|'recusado'|'ja-instalado'|'ios'|'indisponivel'>}
	 */
	API.instalar = function () {
		if (API.estaInstalado()) {
			return Promise.resolve('ja-instalado');
		}
		if (!API.promptDeInstalacao) {
			/* No iOS não há evento nenhum: a instalação é pelo menu
			   Compartilhar > Adicionar à Tela de Início, e a única coisa
			   honesta a fazer é dizer isso. */
			return Promise.resolve(API.ehIOS() ? 'ios' : 'indisponivel');
		}
		var prompt = API.promptDeInstalacao;
		API.promptDeInstalacao = null;
		prompt.prompt();
		return prompt.userChoice.then(function (escolha) {
			return escolha && escolha.outcome === 'accepted' ? 'instalado' : 'recusado';
		});
	};
})();
