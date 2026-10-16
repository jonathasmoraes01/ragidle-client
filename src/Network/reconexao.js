/**
 * Network/reconexao.js
 *
 * RECONEXAO AUTOMATICA (R12, 14/09/2026).
 *
 * Hoje uma queda de conexao na fase de MAPA (o jogo em si, nao login/char)
 * so mostra `UIManager.showErrorBox('Disconnected from Server.')`
 * (NetworkManager.js:onClose) — uma caixa com "OK", e o OK recarrega o
 * jogo INTEIRO (UIManager.js -> GameEngine.reload()). Reentrar exige
 * refazer login/selecao de personagem a mao, mesmo quando a queda foi so'
 * o servidor reiniciando por um segundo.
 *
 * ESTE MODULO arma UM ciclo por sessao (MapEngine chama `armar()` a cada
 * entrada bem-sucedida no mapa — nova ou reconexao) e, quando o socket cai
 * SEM ter sido um logout voluntario, tenta reentrar sozinho, escalando o
 * intervalo ENTRE OS INICIOS das tentativas: 10, 20, 30, 40, 50, 60s, e
 * depois 60s fixo (t aproximado: 10, 30, 60, 100, 150, 210, 270...) — a
 * interpretacao operacional do pedido, documentada no prompt do dono.
 *
 * O QUE GARANTE "um ciclo, sem socket nem listener duplicado":
 *  - `_geracao` e' um contador de EPOCA: toda vez que uma tentativa NOVA
 *    comeca (`iniciarTentativa`) ou o ciclo e' encerrado por qualquer
 *    motivo (`limparCiclo`), ele avanca — e o callback de QUALQUER
 *    tentativa anterior (sucesso atrasado, falha atrasada, watchdog) se
 *    compara contra o valor ATUAL antes de agir. Uma resposta que chegue
 *    depois do proprio ciclo ter avancado e' descartada, calada.
 *  - So' existe UM timer de agenda (`_timerDeTick`) e UM watchdog
 *    (`_watchdogDaTentativa`) vivos por vez; `limparTimers()` sempre roda
 *    antes de criar um novo.
 *  - `Network.onDisconnect` e' a UNICA porta de ENTRADA no ciclo. Ate
 *    24/09/2026 era tambem a unica coisa escutada, sem `visibilitychange`
 *    nem `online` (de proposito: o pedido do dono especificamente pede para
 *    essas voltas NAO disparar varias tentativas de uma vez). Desde a lacuna
 *    5 da auditoria da reconexao, os dois eventos sao escutados SO DENTRO de
 *    um ciclo (ligados em `iniciarCiclo`, desligados em `limparCiclo`) e so
 *    adiantam a tentativa quando nao ha nenhuma em voo — ver
 *    `deveTentarAgoraNaVolta`. A promessa de "uma tentativa por vez" segue
 *    inteira; o que mudou e que a volta da rede nao espera mais ate 30 s.
 *
 * A CONTA DO ORCAMENTO ("timeout e espera nunca se somam"): cada tentativa,
 * ao COMECAR, ja calcula e agenda a PROXIMA pelo horario fixo (nunca espera
 * a si mesma terminar para existir). Se a tentativa ficar PENDURADA alem de
 * `TIMEOUT_DA_TENTATIVA_MS`, o watchdog fecha o socket dela explicitamente
 * (Network.connect devolve o socket p/ isso, NetworkManager.js) e o relogio
 * do tick, que ja tinha o proximo horario agendado, so' precisa parar de
 * mostrar "tentando" e voltar a contagem — nao ha tempo extra somado.
 *
 * JITTER PEQUENO E DECLARADO: o backend alarma tempestade de conexoes
 * (`servidor/alarme-de-abuso.ts:177`, ~150 simultaneas dispara) — um
 * reinicio de servidor derruba TODOS os jogadores ao mesmo tempo, e sem
 * jitter todo mundo tentaria reconectar no MESMO segundo.
 */

import Network from './NetworkManager.js';

/**
 * Intervalo ENTRE OS INICIOS das tentativas (ms). O ultimo repete.
 *
 * O teto era 60 s; o dono pediu 30 (16/09/2026: *"60 e muita coisa"*). A
 * contagem que o jogador ve na tela nunca passa de 30 s.
 */
const ESPERA_MS = [10000, 20000, 30000];

/** Pequeno e declarado — ver o cabecalho do arquivo. */
const JITTER_MAX_MS = 2000;

/**
 * Encerra a tentativa pendurada antes de abrir outra. Este numero e' uma
 * escolha de engenharia (nao um valor citado pelo pedido do dono): tempo
 * generoso o bastante para um handshake real atraves da ponte, curto o
 * bastante para nunca disputar com o menor intervalo da escalada (10s).
 */
const TIMEOUT_DA_TENTATIVA_MS = 8000;

/** Quanto tempo o aviso de sucesso fica visivel antes de sumir sozinho. */
const VIDA_DO_AVISO_DE_SUCESSO_MS = 1800;

/*
 * A RECONEXAO NAO DESISTE (D-2575, 15/10/2026 — o jogo em segundo plano).
 *
 * De 16/09 a 15/10/2026 havia um TETO: 12 tentativas que contavam (com rede e
 * aba visivel), ~5,5 min, e depois "Sessao expirada" e o login. Ele nasceu
 * quando a recusa do servidor era MUDA (o defeito do passe de D-1506: o
 * cliente batia para sempre numa porta que ja tinha apagado a credencial).
 * Desde D-1520 o servidor RECUSA EM VOZ ALTA (`SC_NOTIFY_BAN` 0, o
 * `pc_authfail`), e o `LoginEngine.onServerClosed` chama `aoSerRecusado()`:
 * o teto virou a rede de uma divida que ja foi paga.
 *
 * E ele passou a ser o defeito. O dono (15/10/2026): o segundo plano paga
 * 100%, sem teto de tempo, e a volta *"sincroniza sozinha: sem tela de login,
 * sem tela de personagens"*. Com o passe valendo a ausencia inteira (frente A),
 * qualquer queda que dure mais que a escalada — o servidor reiniciando num
 * deploy longo, o Wi-Fi do onibus, o notebook fechado — mandava ao login quem o
 * servidor ainda aceitava. Agora a escalada repete o ultimo degrau ate o
 * servidor RESPONDER: aceitar (a volta) ou recusar (o login, com o motivo).
 * Descartado: subir o teto (12 -> 60): so adia o mesmo login indevido.
 */

/**
 * A VOLTA DO FUNDO (D-2575): uma queda que comeca com a aba escondida, ou ate
 * esta janela depois de ela voltar, e a do jogador que deu alt-tab — e nao a de
 * quem esta olhando o jogo. 20 s cobrem a vigia de silencio, que leva ate
 * `LIMITE_APOS_DESPERTAR_MS` (12 s) para provar morto o socket de uma pagina
 * que o navegador congelou.
 */
export const JANELA_DA_VOLTA_MS = 20000;

/**
 * Quanto tempo a reconexao da volta fica INVISIVEL (D-2575). O dono: *"a
 * reconexao por baixo e inevitavel (o navegador corta), mas o jogador nao pode
 * VE-LA"*. Uma volta saudavel leva menos de 2 s; se em 10 s ela nao fechou, o
 * servidor esta fora de verdade e o aviso de sempre aparece, com a contagem.
 * Descartado: esconder SEMPRE — quem fica minutos sem servidor precisa saber.
 */
export const PRAZO_DISCRETO_MS = 10000;

/**
 * Esta queda e a VOLTA DO FUNDO? (pura, D-2575)
 *
 * @param {{ visivel: boolean, agora: number, voltouEm: number|null, janelaMs?: number }} c
 * @return {boolean}
 */
export function ehVoltaDoFundo(c) {
	if (!c) return false;
	if (!c.visivel) return true;
	const janela = typeof c.janelaMs === 'number' ? c.janelaMs : JANELA_DA_VOLTA_MS;
	return typeof c.voltouEm === 'number' && c.agora - c.voltouEm <= janela;
}

/**
 * Ate quando o aviso fica calado (pura, D-2575). Com a aba escondida: ate ela
 * voltar (`Infinity`; quem fixa o prazo e a volta). Visivel e na volta: o
 * prazo a partir de agora. Fora da volta: 0 (o aviso de sempre).
 *
 * @param {{ voltaDoFundo: boolean, visivel: boolean, agora: number }} c
 * @return {number}
 */
export function discretoAte(c) {
	if (!c || !c.voltaDoFundo) return 0;
	return c.visivel ? c.agora + PRAZO_DISCRETO_MS : Infinity;
}

/**
 * O aviso pode aparecer agora? (pura, D-2575)
 *
 * @param {number} agora
 * @param {number} ate - de `discretoAte`
 * @return {boolean}
 */
export function avisoVisivel(agora, ate) {
	return !(agora < ate);
}

/**
 * A espera ate a PRIMEIRA tentativa do ciclo (pura, D-2575). A queda comum
 * espera o primeiro degrau com o jitter: um reinicio de servidor derruba todos
 * juntos, e o jitter espalha a volta (o alarme de tempestade). A volta do fundo
 * com a aba VISIVEL tenta ja: o jogador esta olhando, e quedas de alt-tab nao
 * sao correlacionadas entre jogadores. Escondida, espera como a comum — a volta
 * da aba adianta a tentativa (`aoVoltarRedeOuAba`).
 *
 * @param {{ voltaDoFundo: boolean, visivel: boolean, primeiroDegrauMs: number, jitterMs: number }} c
 * @return {number}
 */
export function esperaDaPrimeiraTentativa(c) {
	if (c.voltaDoFundo && c.visivel) return 0;
	return c.primeiroDegrauMs + c.jitterMs;
}

/**
 * O endereco da tentativa (pura, D-2575). O guardado em `armar()` traz o mapa
 * da ENTRADA; o personagem pode ter viajado por menu na mesma conexao, e o
 * `MapEngine.servidorAtual` sabe o mapa de agora. Mesmo servidor: vale o de
 * agora; outro (ou nenhum): o guardado.
 *
 * @param {{ip:number, port:number, mapName:string}|null} guardado
 * @param {{ip:number, port:number, mapName:string}|null} atual
 */
export function enderecoDaTentativa(guardado, atual) {
	if (!guardado) return null;
	if (atual && atual.ip === guardado.ip && atual.port === guardado.port && atual.mapName) {
		return { ip: guardado.ip, port: guardado.port, mapName: atual.mapName };
	}
	return guardado;
}

/**
 * A REDE VOLTOU (evento `online`) OU A ABA VOLTOU: tenta agora? (lacuna 5)
 *
 * So dentro de um ciclo, e so sem tentativa em voo — `online` e
 * `visibilitychange` costumam chegar JUNTOS quando o notebook acorda, e duas
 * tentativas simultaneas abririam dois sockets para o mesmo personagem. A
 * tentativa em voo, se houver, ja tem o proprio watchdog; a volta so espera
 * por ela.
 *
 * @param {{ emCiclo: boolean, tentativaEmAndamento: boolean }} estado
 * @return {boolean}
 */
export function deveTentarAgoraNaVolta(estado) {
	return !!(estado && estado.emCiclo && !estado.tentativaEmAndamento);
}

/** O ambiente de agora, lido com defesa: fora do navegador, conta como visivel e online. */
function ambienteAtual() {
	const online = typeof navigator === 'undefined' || navigator.onLine !== false;
	const visivel = typeof document === 'undefined' || document.visibilityState !== 'hidden';
	return { online, visivel };
}

/** Cadencia de atualizacao da contagem regressiva mostrada na tela. */
const INTERVALO_DO_TICK_MS = 1000;

/**
 * 1013 = o CODIGO_DE_RECUSA do wsproxy (wsproxy.js:274/655) — a PONTE
 * recusando por limite de conexoes, e nao o servidor de jogo fora do ar.
 * Mesma escalada, mensagem diferente (pedido explicito do dono).
 */
const CODIGO_DE_RECUSA_DA_PONTE = 1013;

let _endereco = null; // { ip, port, mapName } — ver armar()
let _emCiclo = false;
let _tentativaEmAndamento = false;
let _motivoAtual = 'servidor-fora';
let _indice = 0; // quantas tentativas ja comecaram nesta escalada
let _discretoAte = 0; // ate quando o aviso fica calado (D-2575) — ver `discretoAte`
let _voltouEm = null; // Date.now() da ultima vez que a aba VOLTOU a ficar visivel (D-2575)
let _vigiandoAba = false;
let _escutandoVolta = false;
let _proximoHorario = 0; // Date.now() absoluto da proxima tentativa agendada
let _geracao = 0;
let _timerDeTick = null;
let _watchdogDaTentativa = null;
let _tickAtivo = false;

function esperaParaAIndice(i) {
	return ESPERA_MS[Math.min(i, ESPERA_MS.length - 1)];
}

function jitter() {
	return Math.floor(Math.random() * JITTER_MAX_MS);
}

function importarUI() {
	return import('UI/Components/Reconexao/Reconexao.js').then(m => m.default);
}

function importarMapEngine() {
	return import('Engine/MapEngine.js').then(m => m.default);
}

function importarGameEngine() {
	return import('Engine/GameEngine.js').then(m => m.default);
}

/** 1013 (a ponte recusando por lotacao) vs qualquer outro fechamento. */
function classificarFechamento(info) {
	if (info && info.code === CODIGO_DE_RECUSA_DA_PONTE) {
		return 'ponte-cheia';
	}
	return 'servidor-fora';
}

function textoDoEstado(motivo, tentando) {
	if (motivo === 'ponte-cheia') {
		return tentando
			? { titulo: 'Servidor cheio', texto: 'Tentando entrar agora…' }
			: { titulo: 'Servidor cheio', texto: 'Muitas conexões agora. Nova tentativa automática em breve.' };
	}
	return tentando
		? { titulo: 'Conexão perdida', texto: 'Tentando reconectar agora…' }
		: { titulo: 'Conexão perdida', texto: 'Reconectando automaticamente.' };
}

function limparTimers() {
	if (_timerDeTick !== null) {
		clearTimeout(_timerDeTick);
		_timerDeTick = null;
	}
	if (_watchdogDaTentativa !== null) {
		clearTimeout(_watchdogDaTentativa);
		_watchdogDaTentativa = null;
	}
	_tickAtivo = false;
}

/**
 * A volta da rede ou da aba, DURANTE um ciclo (lacuna 5). Recomeca a escalada
 * — o aparelho acabou de mudar, e as tentativas de antes nao diziam nada sobre
 * o servidor — e tenta ja, se nao houver outra em voo.
 */
function aoVoltarRedeOuAba() {
	if (!ambienteAtual().visivel) {
		return; // o `visibilitychange` que ESCONDE a aba nao e volta
	}
	if (!_emCiclo) {
		return;
	}
	// A volta do fundo durante um ciclo (D-2575): o aviso fica calado pelo prazo
	// a partir de AGORA, tenha a tentativa saido ja ou esteja uma em voo.
	_discretoAte = Math.max(_discretoAte === Infinity ? 0 : _discretoAte, Date.now() + PRAZO_DISCRETO_MS);
	if (!deveTentarAgoraNaVolta({ emCiclo: _emCiclo, tentativaEmAndamento: _tentativaEmAndamento })) {
		esconderOAvisoSeCalado();
		return;
	}
	_indice = 0;
	iniciarTentativa();
	esconderOAvisoSeCalado();
}

/** O aviso que ja estava na tela (de antes de esconder) sai enquanto a volta e discreta. */
function esconderOAvisoSeCalado() {
	if (avisoVisivel(Date.now(), _discretoAte)) return;
	importarUI().then(ui => {
		if (!avisoVisivel(Date.now(), _discretoAte)) ui.esconder();
	});
}

/**
 * A MEMORIA DA VOLTA DA ABA (D-2575), ligada uma vez e para sempre: a queda
 * pode vir DEPOIS da volta (a vigia leva ate 12 s para provar o socket morto),
 * e nessa hora o ciclo ainda nao existia para ouvir o evento.
 */
function vigiarAba() {
	if (_vigiandoAba || typeof document === 'undefined') {
		return;
	}
	_vigiandoAba = true;
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState !== 'hidden') {
			_voltouEm = Date.now();
		}
	});
}

function escutarVolta() {
	if (_escutandoVolta) {
		return;
	}
	_escutandoVolta = true;
	if (typeof window !== 'undefined') {
		window.addEventListener('online', aoVoltarRedeOuAba);
	}
	if (typeof document !== 'undefined') {
		document.addEventListener('visibilitychange', aoVoltarRedeOuAba);
	}
}

function pararDeEscutarVolta() {
	if (!_escutandoVolta) {
		return;
	}
	_escutandoVolta = false;
	if (typeof window !== 'undefined') {
		window.removeEventListener('online', aoVoltarRedeOuAba);
	}
	if (typeof document !== 'undefined') {
		document.removeEventListener('visibilitychange', aoVoltarRedeOuAba);
	}
}

/** Encerra o ciclo por completo — sucesso, cancelamento ou sessão inválida. */
function limparCiclo() {
	limparTimers();
	pararDeEscutarVolta();
	_emCiclo = false;
	_tentativaEmAndamento = false;
	_indice = 0;
	_discretoAte = 0;
	_geracao++;
}

/**
 * Chamado pelo MapEngine assim que a entrada no mapa e' confirmada
 * (ZC_ACCEPT_ENTER*), nova OU reconexao. Arma o gancho de desconexao e
 * memoriza o endereco para uma eventual reentrada — ip/port/mapName sao os
 * MESMOS argumentos que `MapEngine.init()` recebeu, entao chamar
 * `MapEngine.init` de novo com eles e' o mesmo caminho de entrada (ja
 * reentrante, usado hoje por `onServerChange` a cada troca de zona).
 */
function armar(ip, port, mapName) {
	_endereco = { ip, port, mapName };
	Network.onDisconnect = aoDesconectar;
	vigiarAba();
}

/**
 * Chamado pelo MapEngine ao confirmar entrada. Se um ciclo estava em curso
 * (reconexao bem-sucedida), zera a escalada e mostra o aviso de sucesso; se
 * nao (entrada normal), so' garante que nada ficou visivel de uma sessao
 * anterior.
 */
function aoEntrarComSucesso() {
	const estavaEmCiclo = _emCiclo;
	// A volta discreta (D-2575) fecha sem o "Reconectado": o jogador nao viu cair.
	const discreta = estavaEmCiclo && !avisoVisivel(Date.now(), _discretoAte);
	limparCiclo();

	/* A VOLTA DE UMA QUEDA e o momento de conferir a versao (23/09/2026): o
	   deploy reinicia o servidor, e a versao nova do cliente sai junto. */
	if (estavaEmCiclo) {
		import('UI/atualizacaoAutomatica.js')
			.then(m => m.conferirVersaoAgora())
			.catch(() => {});
	}

	importarUI().then(ui => {
		if (estavaEmCiclo && !discreta) {
			ui.mostrar({ titulo: 'Reconectado', texto: 'A conexão com o servidor voltou.' });
			setTimeout(() => ui.esconder(), VIDA_DO_AVISO_DE_SUCESSO_MS);
		} else {
			ui.esconder();
		}
	});
}

/**
 * Logout voluntario, restart para o char-select, etc. `Network.close()`
 * (chamado por esses fluxos ANTES desta funcao, em MapEngine.js) ja zera
 * `_socket` antes de fechar o socket — o proprio `onClose` de baixo nunca
 * dispara `_onDisconnect` para um fechamento que a gente mesmo pediu (ver
 * NetworkManager.js: `this === _socket` da falso pois `_socket` ja e'
 * null). Esta funcao e' a rede de seguranca explicita mesmo assim: cancela
 * qualquer ciclo que por acaso estivesse em andamento e desarma o gancho.
 */
function cancelar() {
	limparCiclo();
	Network.onDisconnect = null;
	importarUI().then(ui => ui.esconder());
}

/**
 * O FECHAMENTO QUE A GENTE MESMO PROVOCOU (F09, auditoria de 22/09/2026).
 *
 * O "Acordar agora" pede ao servidor, e o servidor FECHA o socket logo depois
 * do resumo. `cancelar()` e a porta do LOGOUT: ela poe o gancho em `null`, e
 * com `null` o `NetworkManager.onClose` mostra "Disconnected from Server." —
 * cujo OK manda ao login. Foi a regressao de a92d1df6.
 *
 * Aqui o gancho vira um NO-OP, como em `desistirEIrParaOLogin`: o fechamento
 * esperado nao abre caixa nem vira tentativa. Quem rearma e `armar()`, quando o
 * socket da volta ao mundo abre. Nao troca o `cancelar()` do logout: la um
 * no-op calaria uma queda de verdade na tela de login.
 */
function cancelarParaFechamentoDeliberado() {
	limparCiclo();
	Network.onDisconnect = () => {};
	importarUI().then(ui => ui.esconder());
}

/**
 * O servidor recusou a reentrada (ZC_REFUSE_ENTER) DURANTE um ciclo de
 * reconexao — a sessao (AuthCode) nao vale mais. Devolve `true` quando
 * tratou (o MapEngine NAO deve mostrar a caixa de erro generica nesse
 * caso); `false` quando nao havia ciclo (entrada normal recusada, o
 * comportamento de sempre).
 */
function aoSerRecusado() {
	if (!_emCiclo) {
		return false;
	}
	desistirEIrParaOLogin('Sua sessão não é mais válida. Voltando ao login…');
	return true;
}

/**
 * A UNICA SAIDA DO CICLO QUE NAO E SUCESSO (16/09/2026).
 *
 * Nasceu do corpo de `aoSerRecusado()` porque passou a ter DOIS chamadores: a
 * recusa explicita (o `SC_NOTIFY_BAN` desde D-1520, ou o `ZC_REFUSE_ENTER`) e
 * o teto de tentativas, que era a rede para servidor que nao avisa. O teto saiu
 * em D-2575 (15/10/2026); a funcao fica, com a recusa como chamador unico.
 *
 * O gancho vira um NO-OP antes do `reload()`, e nao `null` (16/09/2026): sem
 * gancho nenhum o `NetworkManager.onClose` cai no ramo padrao e mostra a caixa
 * inglesa "Disconnected from Server." quando o servidor fecha o socket que a
 * recusa deixou aberto — por cima do "Sessao expirada". E o no-op, e nao este
 * mesmo gancho, porque o fechamento da propria recarga nao pode reentrar aqui.
 */
function desistirEIrParaOLogin(texto) {
	limparCiclo();
	Network.onDisconnect = () => {};

	importarUI().then(ui => {
		ui.mostrar({
			titulo: 'Sessão expirada',
			texto: texto || 'Não foi possível reconectar. Voltando ao login…'
		});
		setTimeout(() => {
			ui.esconder();
			importarGameEngine().then(GameEngine => GameEngine.reload());
		}, 2500);
	});
}

/**
 * O gancho de `Network.onDisconnect` — dispara tanto na queda FRESCA
 * (nenhum ciclo ainda) quanto no fechamento de uma tentativa em curso
 * (inclusive a recusa da ponte, 1013, chegando bem depois do socket ter
 * "aberto" — ver o comentario grande do arquivo sobre a ordem de eventos
 * do wsproxy).
 */
function aoDesconectar(info) {
	if (!_endereco) {
		return;
	}
	const motivo = classificarFechamento(info);

	if (!_emCiclo) {
		iniciarCiclo(motivo);
		return;
	}

	// Mid-ciclo: a tentativa atual (se havia uma) acabou de cair.
	if (_watchdogDaTentativa !== null) {
		clearTimeout(_watchdogDaTentativa);
		_watchdogDaTentativa = null;
	}
	_tentativaEmAndamento = false;
	_motivoAtual = motivo;
	// O tick() ja em curso volta a mostrar a contagem para `_proximoHorario`
	// (agendado quando a tentativa comecou) — nada aqui reagenda nada.
}

function iniciarCiclo(motivo) {
	_emCiclo = true;
	_tentativaEmAndamento = false;
	_indice = 0;
	_motivoAtual = motivo;
	const agora = Date.now();
	const { visivel } = ambienteAtual();
	const voltaDoFundo = ehVoltaDoFundo({ visivel, agora, voltouEm: _voltouEm });
	_discretoAte = discretoAte({ voltaDoFundo, visivel, agora });
	_proximoHorario =
		agora + esperaDaPrimeiraTentativa({ voltaDoFundo, visivel, primeiroDegrauMs: esperaParaAIndice(0), jitterMs: jitter() });
	escutarVolta();

	if (!_tickAtivo) {
		_tickAtivo = true;
		tick();
	}
}

/** Roda a cada ~1s enquanto o ciclo existir: mostra o estado e dispara a tentativa na hora certa. */
function tick() {
	if (!_emCiclo) {
		_tickAtivo = false;
		return;
	}

	importarUI().then(ui => {
		if (!_emCiclo) {
			return;
		}
		// A volta discreta (D-2575): a tentativa segue no horario, so o aviso cala.
		const mostrar = estado => (avisoVisivel(Date.now(), _discretoAte) ? ui.mostrar(estado) : ui.esconder());
		if (_tentativaEmAndamento) {
			mostrar(textoDoEstado(_motivoAtual, true));
		} else {
			const restanteMs = _proximoHorario - Date.now();
			if (restanteMs <= 0) {
				iniciarTentativa();
				return;
			}
			mostrar({ ...textoDoEstado(_motivoAtual, false), segundos: restanteMs / 1000 });
		}
	});

	_timerDeTick = setTimeout(tick, INTERVALO_DO_TICK_MS);
}

function iniciarTentativa() {
	// Sem teto de desistencia (D-2575): a unica saida que nao e a volta e a
	// RECUSA do servidor (`aoSerRecusado`).
	_tentativaEmAndamento = true;
	_geracao++;
	const minhaGeracao = _geracao;

	// O intervalo e' ENTRE INICIOS: a proxima tentativa ja fica agendada
	// pelo horario fixo, sem esperar esta terminar (a regra do orcamento).
	_indice++;
	_proximoHorario = Date.now() + esperaParaAIndice(_indice) + jitter();

	if (!_endereco) {
		return;
	}

	importarMapEngine().then(MapEngine => {
		if (minhaGeracao !== _geracao) {
			return; // o ciclo avancou (sucesso/cancelamento/nova tentativa) enquanto importava
		}
		const endereco = enderecoDaTentativa(_endereco, MapEngine.servidorAtual || null);

		// `volta: true` (D-2576): a reentrada do MESMO personagem, e a cena que
		// esta na tela pode ficar se o mapa for o mesmo (`Engine/voltaQuente.js`).
		const socket = MapEngine.init(
			endereco.ip,
			endereco.port,
			endereco.mapName,
			() => {
				if (minhaGeracao !== _geracao) {
					return;
				}
				_tentativaEmAndamento = false;
			},
			{ volta: true }
		);

		_watchdogDaTentativa = setTimeout(() => {
			if (minhaGeracao !== _geracao) {
				return;
			}
			try {
				if (socket && typeof socket.close === 'function') {
					socket.close();
				}
			} catch {
				/* fechar ja fechado nao e problema de ninguem */
			}
			_tentativaEmAndamento = false;
		}, TIMEOUT_DA_TENTATIVA_MS);
	});
}

const Reconexao = {
	armar,
	aoEntrarComSucesso,
	cancelar,
	cancelarParaFechamentoDeliberado,
	aoSerRecusado
};

export default Reconexao;
