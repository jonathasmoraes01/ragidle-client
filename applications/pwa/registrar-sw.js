/**
 * applications/pwa/registrar-sw.js — a ponte entre o service worker e o jogador
 * (D-933, 05/09/2026).
 *
 * Três trabalhos, e nenhum deles depende do jogo estar carregado:
 *
 *   1. registrar o service worker;
 *   2. trocar para a versão nova SEM PERGUNTAR NADA ao jogador (23/09/2026 —
 *      ver "A VERSÃO NOVA" abaixo);
 *   3. guardar o `beforeinstallprompt` para o botão "Instalar" das
 *      Configurações poder dispará-lo depois.
 *
 * ─── POR QUE ELE É AUTÔNOMO ─────────────────────────────────────────────
 * Este arquivo roda na CASCA, e a casca hospeda o jogo de dois jeitos
 * diferentes: em desenvolvimento o jogo vive num `<iframe>`
 * (`ROBrowser.TYPE.FRAME`), e em produção ele é embutido no mesmo documento.
 * Por isso ele não importa nada do jogo.
 *
 * ─── E POR QUE ELE NÃO MEXE NO PROTOCOLO ────────────────────────────────
 * A Fase 4 pedia "compare versão de protocolo no handshake". Isso mudaria o
 * protocolo WebSocket, e a frente tem ordem explícita de NÃO tocar nele sem
 * autorização. A comparação no handshake fica registrada como decisão
 * pendente do dono.
 */
(function () {
	'use strict';

	var API = {
		/** O `beforeinstallprompt` guardado, ou `null`. */
		promptDeInstalacao: null,
		/**
		 * A versão do BUILD desta página. O build troca o literal (a MESMA
		 * troca que o `sw.js` recebe, em `copyPwaFiles`); no dev os dois ficam
		 * com o literal e continuam iguais.
		 */
		versaoDaPagina: '__VERSAO_DO_BUILD__',
	};
	window.RagIdlePWA = API;

	/* ═════════════════════════════════════════════════════════════════════
	   A VERSÃO NOVA — sem aviso, sem contagem, sem recarga (23/09/2026, D-996)
	   ═════════════════════════════════════════════════════════════════════

	   O relato do dono, com print do iPhone: *"toda vez que eu entro no game
	   aparece a tela de que a nova versão está disponível... está maçante;
	   precisa mesmo disso? é eficiente?"*. Não era, e por dois motivos:

	   1. ELE PRENDIA O IPHONE NUMA VERSÃO VELHA. Este arquivo era pedido SEM
	      carimbo (`<script src="./registrar-sw.js">`), e o `sw.js` responde do
	      cache tudo o que é da casca — então a cópia de 06/09 ficava sendo
	      servida para sempre. Nela os botões do aviso não recebiam toque no
	      iPhone (o conserto é o D-1380, de 13/09), a versão nova nunca era
	      aceita, e a correção nunca chegava porque vinha justamente na versão
	      nova. O print do dono em 23/09 ainda mostrava o aviso de 06/09. Hoje o
	      `<script>` leva o `?v=<build>` dos bundles (`builder-web.mjs`), e o
	      `sw.js` deixou de servir do cache o que não tem carimbo.

	   2. ELE PERGUNTAVA O QUE NÃO PRECISA SER PERGUNTADO. A NAVEGAÇÃO é rede
	      primeiro (`sw.js`), e todo bundle leva o `?v=<build>` — logo a página
	      que acabou de abrir JÁ É a versão publicada, com ou sem o worker novo.
	      O worker em espera só guarda a casca para o modo offline. Trocar para
	      ele não pede recarga nenhuma, e perguntar ao jogador era um aviso sem
	      nada para decidir, a cada deploy (e todo commit no `master` é um).

	   A REGRA de agora: o worker em espera assume SOZINHO quando é do MESMO
	   build que esta página. Quando ele é MAIS NOVO que a página (houve deploy
	   com o jogo aberto), ele fica esperando e a página continua jogando — o
	   jogador pega a versão nova da próxima vez que abrir o jogo, e ninguém é
	   interrompido no meio de uma caçada.

	   POR QUE A TROCA NÃO ACONTECE com o worker mais novo que a página: o
	   `activate` apaga o cache da versão anterior, e um `import()` que a página
	   velha ainda fizesse chegaria ao servidor pedindo um arquivo que o deploy
	   já substituiu — versões misturadas no mesmo documento.
	*/

	/** Quanto se espera a resposta do worker antes de desistir (e esperar). */
	var MS_ATE_DESISTIR_DA_VERSAO = 3000;

	/**
	 * A cada quanto a sessão pergunta se há versão nova (F30, auditoria de
	 * 22/09/2026). Sem isto uma sessão longa — o jogo idle fica aberto por
	 * horas — nunca descobria o deploy: o navegador só confere o `sw.js` na
	 * navegação, e aqui ninguém navega. Descobrir não interrompe ninguém: o
	 * worker fica pronto para a próxima abertura.
	 */
	var MS_ENTRE_CONFERENCIAS_DE_VERSAO = 30 * 60 * 1000;

	/**
	 * A decisão, pura. `assumir` só com as duas versões conhecidas e iguais —
	 * qualquer dúvida (worker antigo que não responde, resposta vazia) é
	 * `esperar`, porque esperar nunca quebra nada e assumir errado mistura
	 * versões.
	 *
	 * @returns {'assumir'|'esperar'}
	 */
	function decidirVersaoNova(versaoDaPagina, versaoDoWorker) {
		if (!versaoDaPagina || !versaoDoWorker) {
			return 'esperar';
		}
		return versaoDaPagina === versaoDoWorker ? 'assumir' : 'esperar';
	}
	API.decidirVersaoNova = decidirVersaoNova;

	/**
	 * Pergunta ao worker de qual build ele é. Worker de antes de 23/09 não
	 * conhece a pergunta e nunca responde: aí a promessa resolve `null` pelo
	 * prazo, e a decisão é esperar.
	 */
	function perguntarVersao(worker) {
		return new Promise(function (resolver) {
			var respondeu = false;
			function responder(versao) {
				if (respondeu) {
					return;
				}
				respondeu = true;
				resolver(versao || null);
			}
			setTimeout(function () {
				responder(null);
			}, MS_ATE_DESISTIR_DA_VERSAO);
			try {
				var canal = new MessageChannel();
				canal.port1.onmessage = function (evento) {
					responder(evento.data && evento.data.versao);
				};
				worker.postMessage({ tipo: 'ragidle:versao' }, [canal.port2]);
			} catch (erro) {
				responder(null);
			}
		});
	}

	/*
	 * `installed` COM um controller já ativo = versão nova esperando. Sem
	 * controller é a PRIMEIRA instalação: o worker ativa sozinho e não há nada
	 * a decidir.
	 */
	function estaEsperando(worker) {
		return !!worker && worker.state === 'installed' && !!navigator.serviceWorker.controller;
	}

	/* Um worker já decidido não é perguntado de novo a cada conferência. */
	var _jaDecididos = [];

	/**
	 * SEM RESPOSTA NÃO É DECISÃO. Um worker parado pelo navegador precisa
	 * acordar para responder, e com o jogo carregando isso pode passar do
	 * prazo. A primeira versão marcava o worker como decidido mesmo assim, e a
	 * `prove:pwa` pegou o efeito numa corrida de três: a página já era a nova,
	 * e o worker novo ficava esperando até a abertura SEGUINTE. Agora a
	 * pergunta se repete, algumas vezes, antes de desistir.
	 */
	var TENTATIVAS_DE_PERGUNTA = 4;
	var MS_ENTRE_TENTATIVAS = 5000;

	/** O que foi decidido nesta página, para quem precisar ler (a prova). */
	API.decisoes = [];

	function decidir(worker, tentativa) {
		tentativa = tentativa || 1;
		if (tentativa === 1 && _jaDecididos.indexOf(worker) !== -1) {
			return Promise.resolve('ja-decidido');
		}
		if (tentativa === 1) {
			_jaDecididos.push(worker);
		}
		return perguntarVersao(worker).then(function (versaoDoWorker) {
			var decisao = decidirVersaoNova(API.versaoDaPagina, versaoDoWorker);
			API.decisoes.push({ versao: versaoDoWorker, decisao: decisao, tentativa: tentativa });
			if (versaoDoWorker === null && tentativa < TENTATIVAS_DE_PERGUNTA) {
				setTimeout(function () {
					decidir(worker, tentativa + 1);
				}, MS_ENTRE_TENTATIVAS);
				return 'perguntar-de-novo';
			}
			if (decisao === 'assumir') {
				/* Sem recarga: a página JÁ É deste build. O `controllerchange`
				   que vem daqui não tem ouvinte que recarregue. */
				worker.postMessage({ tipo: 'ragidle:assumir' });
			}
			return decisao;
		});
	}
	API.decidir = decidir;

	function acompanharRegistro(registro) {
		function vigiar(worker) {
			if (!worker) {
				return;
			}
			/*
			 * O QUE JÁ ESTÁ ESPERANDO NÃO DISPARA `statechange` (F30). O worker
			 * que ficou em `installed` numa visita anterior chega aqui em
			 * `registro.waiting`, e o estado dele não muda mais.
			 */
			if (estaEsperando(worker)) {
				decidir(worker);
				return;
			}
			worker.addEventListener('statechange', function () {
				if (estaEsperando(worker)) {
					decidir(worker);
				}
			});
		}

		vigiar(registro.waiting);
		vigiar(registro.installing);
		registro.addEventListener('updatefound', function () {
			vigiar(registro.installing);
		});

		function conferir() {
			var pedido = registro.update && registro.update();
			if (pedido && pedido.catch) {
				pedido.catch(function () {});
			}
			vigiar(registro.waiting);
		}
		setInterval(conferir, MS_ENTRE_CONFERENCIAS_DE_VERSAO);
		document.addEventListener('visibilitychange', function () {
			if (document.visibilityState === 'visible') {
				conferir();
			}
		});
	}
	API.acompanharRegistro = acompanharRegistro;

	/* ═════════════════════════════════════════════════════════════════════
	   REGISTRO
	   ═════════════════════════════════════════════════════════════════════

	   NÃO HÁ ouvinte de `controllerchange` que recarregue — e é de propósito.
	   A primeira versão recarregava em qualquer troca de controller, e o
	   `clients.claim()` do `activate` dispara essa troca JÁ NA PRIMEIRA VISITA
	   de todo mundo: a página se reiniciava no meio do carregamento do jogo. A
	   `prove:pwa` cobra que isso não volte. */

	if ('serviceWorker' in navigator) {
		window.addEventListener('load', function () {
			navigator.serviceWorker
				.register('./sw.js', { scope: './' })
				.then(acompanharRegistro)
				.catch(function (erro) {
					/* Sem service worker o jogo funciona igual — ele é cache e
					   instalação, não gameplay. Falhar aqui não pode derrubar
					   nada. */
					console.warn('[PWA] service worker nao registrou:', erro && erro.message);
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
