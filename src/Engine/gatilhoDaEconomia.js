/**
 * Engine/gatilhoDaEconomia.js
 *
 * O GATILHO DA ECONOMIA DE ENERGIA / MODO DESCANSO (D-1389/D-1394, 14/09/2026;
 * de volta em 13/10/2026, bug #10, para o Bot novo). Quando a aba vai para o
 * fundo o cliente avisa o servidor (`entrar`); o servidor deixa o personagem no
 * mundo e, com o Bot ligado, o Bot V5 segue cacando mesmo que a conexao caia.
 *
 * Este modulo e a parte PURA da decisao (visibilidade -> aviso -> tela preta),
 * com o relogio e o envio entrando por parametro. Morava dentro de
 * `MapEngine.js`, que nao carrega em jsdom, e por isso o atraso de 14 s so era
 * cobrado por casamento de texto; agora o comportamento e provado com relogio
 * falso.
 *
 * O AVISO E A TELA SAO DUAS COISAS (D-2598, 16/10/2026, frente J do segundo
 * plano). Ate aqui UM interruptor ("Entrar sozinho ao trocar de aba", nas
 * Configuracoes de Video) controlava o aviso ao servidor E a tela preta.
 * Desligado, o `entrar` nunca saia: quando o navegador derrubava a conexao, o
 * servidor a tratava como queda comum e o personagem SAIA DO MUNDO (o farm
 * parava) - o contrario do que o dono pediu ("e inviavel que eu perca alguma
 * coisa porque estou com o jogo numa aba diferente, mas online"). Agora:
 *   - o AVISO (`entrar`) sai SEMPRE que a aba esconde (o desktop pelo atraso de
 *     14 s, o dedo na hora): e ele que mantem o personagem farmando sem cliente e
 *     corta a rede da aba oculta (D-2570);
 *   - a VOLTA (`sair`) sai SEMPRE que a aba volta sem a tela preta na frente: a
 *     volta nao pode ser vista (decisao 3 do dono), entao nada cobre o jogo e o
 *     "Enquanto voce esteve fora" (D-2565) diz o que rendeu;
 *   - a TELA PRETA so existe para quem a ESCOLHEU (`telaPretaEscolhida`, o
 *     interruptor): ela abre depois dos 14 s com a aba oculta e fica ate o
 *     "Voltar a jogar" (D-1392), com o farm do servidor ao vivo.
 *
 * O ATRASO existe para distinguir "so foi pro fundo" (alt-tab, troca de app) de
 * "fechou de vez" NO DESKTOP: se a aba fechar, o JavaScript morre antes do
 * atraso disparar e o aviso nunca sai. Pedido do dono (14/09/2026): "essa
 * economia de energia automatica e feita somente caso a pessoa de alt tab ou
 * troque de aplicativo. Se ele FECHAR a aba ou o aplicativo, deve encerrar."
 *
 * O CELULAR ARMA NA HORA (decisao do dono, 13/10/2026, bug #10): o iPhone (e o
 * Android depois de um tempo) CONGELA a pagina e o socket antes dos 14 s; se o
 * `entrar` so saisse apos o atraso, nada armaria e a queda removeria o
 * personagem (o bug #10 persistiria nesse aparelho). No DEDO o `entrar` sai no
 * instante em que a aba some (e no `pagehide`); o atraso de 14 s passa a valer
 * so para a TELA PRETA. Voltar antes disso manda `sair` sem efeito visivel.
 *
 * As fases da economia deste lado:
 *   livre       nada pedido
 *   armada      o `entrar` ja foi e nao ha tela preta (ainda: o dedo espera o
 *               atraso; ou nunca: a tela nao foi escolhida). A resposta
 *               `ativa:true` fica guardada; a volta da aba manda `sair`
 *   liberada    a tela preta escolhida pode abrir (desktop: o aviso saiu depois
 *               do atraso; dedo: o atraso passou); a volta da aba NAO sai
 *   desarmando  a aba voltou e o `sair` foi: respostas `ativa:true` atrasadas
 *               sao ignoradas ate o ack
 *
 * This file is part of the ragidle fork of ROBrowser.
 */

/**
 * 14 s desde 23/09/2026 (era 3 s; ordem do dono no open beta: "Aumente esse
 * tempo para 14 segundos"): um alt-tab curto nao tira o jogador da tela do jogo.
 */
export const MS_DE_ATRASO_ANTES_DE_ENTRAR_NA_ECONOMIA = 14000;

/**
 * @param {{
 *   oculta: function(): boolean,
 *   telaPretaEscolhida: function(): boolean,
 *   pedirEntrar: function(): void,
 *   pedirSair?: function(): void,
 *   armarNaHora?: function(): boolean,
 *   abrirTela?: function(number): void,
 *   agendar?: function(function(): void, number): any,
 *   desagendar?: function(any): void,
 *   atrasoMs?: number
 * }} deps
 */
export function criarGatilhoDaEconomia(deps) {
	const agendar = deps.agendar || ((fn, ms) => setTimeout(fn, ms));
	const desagendar = deps.desagendar || (t => clearTimeout(t));
	const atrasoMs = deps.atrasoMs === undefined ? MS_DE_ATRASO_ANTES_DE_ENTRAR_NA_ECONOMIA : deps.atrasoMs;
	const naHora = () => (deps.armarNaHora ? deps.armarNaHora() === true : false);
	const comTela = () => deps.telaPretaEscolhida() === true;
	let atraso = null;
	let fase = 'livre';
	let pendente = null;

	function limparTimer() {
		if (atraso !== null) {
			desagendar(atraso);
			atraso = null;
		}
	}

	/** Cancela o atraso pendente e zera a fase (a reentrada, o fim da sessao, o botao "Voltar a jogar"). */
	function cancelar() {
		limparTimer();
		fase = 'livre';
		pendente = null;
	}

	/** O dedo: o `entrar` sai no instante em que a aba some (a pagina congela antes dos 14 s). */
	function entrarCedo() {
		if (fase === 'armada') {
			return;
		}
		deps.pedirEntrar();
		fase = 'armada';
		pendente = null;
	}

	/** A aba voltou sem tela preta na frente: o `sair` desfaz o que o `entrar` armou, sem tela nenhuma. */
	function desarmar() {
		if (deps.pedirSair) {
			deps.pedirSair();
		}
		fase = 'desarmando';
		pendente = null;
	}

	/**
	 * O atraso de 14 s. Confere de novo; no dedo (o `entrar` ja saiu) so falta a tela, e so para quem a escolheu; no
	 * desktop manda o `entrar`, com ou sem tela: e ele que segura o personagem no mundo se a conexao cair.
	 */
	function agendarAtraso() {
		atraso = agendar(() => {
			atraso = null;
			// Confere de novo: pode ter voltado no instante exato do disparo.
			if (!deps.oculta()) {
				return;
			}
			if (fase === 'armada') {
				if (comTela()) {
					fase = 'liberada';
					if (pendente !== null && deps.abrirTela) {
						deps.abrirTela(pendente);
					}
					pendente = null;
				}
				return;
			}
			deps.pedirEntrar();
			fase = comTela() ? 'liberada' : 'armada';
		}, atrasoMs);
	}

	/**
	 * `visibilitychange`: a ida pro FUNDO agenda o aviso (desktop) ou o manda ja (celular). A volta manda `sair`
	 * quando nada esta na frente (D-2598); a tela preta ESCOLHIDA so fecha no botao (D-1392).
	 */
	function aoMudarVisibilidade() {
		if (deps.oculta()) {
			if (atraso !== null) {
				return; // ja agendado: nao empilha um segundo
			}
			// D-1392: com a tela preta ja liberada so o botao "Voltar a jogar" fecha. Esconder de novo nao recomeca o
			// aviso cedo (voltar em menos de 14 s mandaria `sair` e fecharia a tela sem o botao).
			//
			// Mas REARMA (D-2578, 15/10/2026): o servidor pode ter desarmado CALADO enquanto a aba estava a vista, e o
			// cliente seguia em `liberada` sem reenviar o `entrar` - a proxima queda tirava o personagem do mundo. O
			// `entrar` repetido e idempotente no servidor (so a primeira armada decide o instante) e so reabre a tela
			// que ja esta aberta. No dedo sai ja (a pagina congela logo); no desktop, pelo mesmo atraso de 14 s (fechar
			// a aba antes dele segue encerrando). A fase NAO muda: voltar antes do atraso so cancela o relogio, sem `sair`.
			if (fase === 'liberada') {
				if (naHora()) {
					deps.pedirEntrar();
				} else {
					agendarAtraso();
				}
				return;
			}
			if (naHora()) {
				entrarCedo();
			}
			agendarAtraso();
		} else {
			limparTimer();
			// D-2598: a volta sem a tela preta na frente sai da economia sozinha, com o interruptor ligado ou nao.
			if (fase === 'armada') {
				desarmar();
			}
		}
	}

	/** `pagehide`: o ultimo instante em que o JS ainda roda no celular. So no dedo, e so uma vez. */
	function aoEsconderPagina() {
		if (!naHora()) {
			return;
		}
		if (fase === 'livre') {
			entrarCedo();
			// A tela preta segue a mesma regra do esconder: so depois do atraso (e so se a aba estiver oculta nessa hora).
			if (atraso === null) {
				agendarAtraso();
			}
		}
	}

	/**
	 * O servidor respondeu `ativa:true`: a tela pode abrir agora? (`false` = guardada ou ignorada). So a fase
	 * `liberada` abre: e a unica em que a tela foi escolhida e o atraso passou. Em `livre` a resposta e de um pedido
	 * velho (o `resumo` em voo quando o "Voltar a jogar" foi clicado, o `entrar` de antes de uma reentrada) e
	 * reabriria a tela que o jogador acabou de fechar; em `desarmando`, o `entrar` que o `sair` ja desfez.
	 */
	function aoResponderAtiva(decorridoMs) {
		if (fase === 'armada') {
			pendente = decorridoMs;
			return false;
		}
		return fase === 'liberada';
	}

	/** O servidor respondeu `ativa:false` (o ack do `sair`, uma recusa). */
	function aoResponderInativa() {
		if (fase !== 'armada') {
			fase = 'livre';
			pendente = null;
		}
	}

	return {
		aoMudarVisibilidade,
		aoEsconderPagina,
		aoResponderAtiva,
		aoResponderInativa,
		cancelar,
		agendado: () => atraso !== null,
		fase: () => fase
	};
}
