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
 *  - `Network.onDisconnect` e' a UNICA porta de entrada — nao ha
 *    `visibilitychange`/`online` hookado aqui (de proposito: o pedido do
 *    dono especificamente pede para essas voltas NAO disparar varias
 *    tentativas de uma vez, e o jeito mais seguro de garantir isso e' nao
 *    escutar esses eventos, deixando o AGENDAMENTO por horario absoluto
 *    (`_proximoHorario`) ser a UNICA fonte de verdade sobre quando tentar).
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

/**
 * QUANTAS TENTATIVAS ANTES DE DESISTIR E MANDAR PARA O LOGIN (16/09/2026).
 *
 * Ate hoje a escalada repetia o ultimo degrau **para sempre**, e o
 * `aoSerRecusado()` — a unica porta para o login — era CODIGO MORTO: as tres
 * recusas do `CZ_ENTER2` fechavam o socket em silencio, e do lado de ca a
 * recusa era indistinguivel de um servidor fora do ar. **Desde D-1520
 * (16/09/2026) o servidor avisa** com o `SC_NOTIFY_BAN` codigo 0, como o
 * `pc_authfail` do rAthena, e o `LoginEngine.onServerClosed` chama
 * `aoSerRecusado()`; o teto abaixo fica como rede para servidor sem o aviso.
 *
 * O resultado media-se no relato do dono: com o passe vencido (o defeito de
 * D-1506), o cliente tentava a cada 60 s, com uma credencial que o servidor ja
 * tinha apagado, **sem fim e sem saida**. O jogador ficava olhando
 * "Reconectando automaticamente" para sempre — que e o "volta com o aviso de
 * disconnect" que ele descreveu.
 *
 * 12 tentativas sao ~5,5 min de escalada (10, 20 e depois 30 fixos — o teto
 * era 60 ate 16/09/2026).
 * O numero e generoso de proposito: reinicio de servidor e deploy cabem com
 * folga larga, e quem cai por rede instavel volta muito antes. Passou disso, a
 * hipotese "o servidor volta sozinho" ja se esgotou e insistir so esconde do
 * jogador que ele precisa entrar de novo.
 *
 * **Isto NAO substitui o pacote de recusa** — com ele o jogador iria ao login
 * na primeira tentativa, em vez de na decima segunda. Ele continua sendo
 * divida nomeada no servidor; este teto e a rede embaixo dela.
 */
const TENTATIVAS_ANTES_DE_DESISTIR = 12;

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

/** Encerra o ciclo por completo — sucesso, cancelamento ou sessão inválida. */
function limparCiclo() {
	limparTimers();
	_emCiclo = false;
	_tentativaEmAndamento = false;
	_indice = 0;
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
}

/**
 * Chamado pelo MapEngine ao confirmar entrada. Se um ciclo estava em curso
 * (reconexao bem-sucedida), zera a escalada e mostra o aviso de sucesso; se
 * nao (entrada normal), so' garante que nada ficou visivel de uma sessao
 * anterior.
 */
function aoEntrarComSucesso() {
	const estavaEmCiclo = _emCiclo;
	limparCiclo();

	importarUI().then(ui => {
		if (estavaEmCiclo) {
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
 * o teto de tentativas, que e a rede para servidor que nao avisa. Deixar o
 * corpo duplicado seria o defeito que este projeto mais repete: duas rotas, e
 * a segunda escrita a mao.
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
	_proximoHorario = Date.now() + esperaParaAIndice(0) + jitter();

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
		if (_tentativaEmAndamento) {
			ui.mostrar(textoDoEstado(_motivoAtual, true));
		} else {
			const restanteMs = _proximoHorario - Date.now();
			if (restanteMs <= 0) {
				iniciarTentativa();
				return;
			}
			ui.mostrar({ ...textoDoEstado(_motivoAtual, false), segundos: restanteMs / 1000 });
		}
	});

	_timerDeTick = setTimeout(tick, INTERVALO_DO_TICK_MS);
}

function iniciarTentativa() {
	/*
	 * O TETO DE DESISTENCIA (16/09/2026) — ver `TENTATIVAS_ANTES_DE_DESISTIR`.
	 *
	 * A checagem vem ANTES de incrementar e de abrir socket: desistir e uma
	 * decisao sobre a escalada, e nao o resultado de mais uma tentativa.
	 * Reusa `desistirEIrParaOLogin`, que e o mesmo caminho de
	 * `aoSerRecusado()` — um lugar so sabe como sair daqui.
	 */
	if (_indice >= TENTATIVAS_ANTES_DE_DESISTIR) {
		desistirEIrParaOLogin();
		return;
	}

	_tentativaEmAndamento = true;
	_geracao++;
	const minhaGeracao = _geracao;

	// O intervalo e' ENTRE INICIOS: a proxima tentativa ja fica agendada
	// pelo horario fixo, sem esperar esta terminar (a regra do orcamento).
	_indice++;
	_proximoHorario = Date.now() + esperaParaAIndice(_indice) + jitter();

	const endereco = _endereco;
	if (!endereco) {
		return;
	}

	importarMapEngine().then(MapEngine => {
		if (minhaGeracao !== _geracao) {
			return; // o ciclo avancou (sucesso/cancelamento/nova tentativa) enquanto importava
		}

		const socket = MapEngine.init(endereco.ip, endereco.port, endereco.mapName, () => {
			if (minhaGeracao !== _geracao) {
				return;
			}
			_tentativaEmAndamento = false;
		});

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
	aoSerRecusado
};

export default Reconexao;
