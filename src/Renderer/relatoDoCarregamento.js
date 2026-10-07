/**
 * Renderer/relatoDoCarregamento.js
 *
 * QUANTO O CARREGAMENTO DO MAPA LEVA NO APARELHO DO JOGADOR, POR FASE
 * (D-2055, 06/10/2026 — "medir antes de mexer", ordem do dono).
 *
 * ---------------------------------------------------------------------------
 * POR QUE ELE EXISTE
 * ---------------------------------------------------------------------------
 * Os relatos de 06/10 eram "a barra parou em 2% e nunca termina", sobretudo no
 * celular, com o servidor de producao a 97% de CPU. Nenhum numero dizia quanto
 * cada fase levava, qual arquivo segurava, se o arquivo vinha do cache, nem se
 * o problema era do celular ou de todo mundo. O cache de mapas no aparelho (a
 * proxima entrega, se a medida mandar) depende exatamente disso.
 *
 * ---------------------------------------------------------------------------
 * AS REGRAS, as mesmas do relato de erro e do FPS
 * ---------------------------------------------------------------------------
 *  1. NADA ANTES DO `CZ_NOTIFY_ACTORINIT` (D-993). O relato de um carregamento
 *     que terminou sai num `setTimeout` agendado DEPOIS do pacote
 *     (`aoEstouProntoEnviado`, chamado pelo `MapEngine` logo apos o envio).
 *     As marcas do caminho (`comecarCarregamento`, `anotar*`) so escrevem
 *     numeros num objeto, e todas sao chamadas dentro de `try/catch`.
 *  2. UM relato por carregamento. O carregamento refeito pelo "Tentar de novo"
 *     e o MESMO carregamento para quem joga, e por isso conta junto
 *     (`cargasRefeitas`). Quem desiste (fecha a aba, recarrega) tambem conta:
 *     e justamente o caso que mais se quer ver, e ele nunca chega ao
 *     `ACTORINIT` - sai com `desfecho: 'abandonou'` ou `'recarregou'`.
 *  3. SEM DADO PESSOAL: o mapa, os tempos, as contagens, o tipo de aparelho e
 *     o agente do navegador aparado (como o relato de FPS). Nem conta, nem
 *     personagem, nem IP.
 *  4. Fire-and-forget: o `fetch` com `keepalive`, e o `catch` vazio.
 *
 * O servidor valida tudo de novo (`servidor/analytics/carregamento-do-cliente.ts`)
 * e o painel mostra na secao Desempenho do `/analytics`.
 */
import { ehDedo } from 'UI/escalaDaHud.js';
import { rotaDoBalcao } from 'UI/enderecoDoBalcao.js';
import { versaoDoBuild } from 'UI/relatoDeErro.js';

export const ROTA_DO_CARREGAMENTO = '/analytics/carregamento';

/**
 * A resposta do servidor de mapa vale como "a espera desta entrada" so se o
 * carregamento comecou logo depois dela. O `onConnectionAccepted` chama o
 * `setMap` na mesma volta do laco; 10 s e folga para a aba que estava oculta.
 */
const JANELA_DA_ENTRADA_MS = 10000;

let _atual = null;
let _pedidoDeEntradaEm = null;
let _entradaAceitaEm = null;
let _vigiandoSaida = false;

function agoraPadrao() {
	return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
}

/** O nome do mapa sem extensao, so com os caracteres de nome de mapa. */
export function nomeDoMapaParaRelato(mapa) {
	const limpo = String(mapa || '')
		.replace(/\.(gat|rsw)$/i, '')
		.toLowerCase();
	return /^[a-z0-9_@-]{1,40}$/.test(limpo) ? limpo : '?';
}

/** O aparelho, como o painel agrupa: o dedo ou o agente de celular. */
export function tipoDeAparelho(dedo, agente) {
	return dedo || /iphone|ipod|android|mobile/i.test(agente || '') ? 'celular' : 'computador';
}

/**
 * O pedido de entrada no servidor de mapa saiu (`MapEngine.init`: o socket do
 * mapa vai abrir e o `CZ_ENTER2` sai em seguida).
 */
export function marcarPedidoDeEntrada(agora = agoraPadrao()) {
	_pedidoDeEntradaEm = agora;
	_entradaAceitaEm = null;
}

/** O servidor aceitou a entrada (`ZC_ACCEPT_ENTER*`). */
export function marcarEntradaAceita(agora = agoraPadrao()) {
	if (_pedidoDeEntradaEm !== null) {
		_entradaAceitaEm = agora;
	}
}

/**
 * Um carregamento de mapa DE VERDADE comecou (`MapRenderer.setMap`, quando o
 * mapa muda). O teleporte no mesmo mapa nao passa por aqui.
 *
 * @param {string} mapa
 */
export function comecarCarregamento(mapa, agora = agoraPadrao()) {
	const veioDaEntrada = _entradaAceitaEm !== null && agora - _entradaAceitaEm <= JANELA_DA_ENTRADA_MS;
	_atual = {
		mapa: nomeDoMapaParaRelato(mapa),
		inicio: agora,
		motivo: veioDaEntrada ? 'entrada' : 'viagem',
		esperaDoServidorMs: veioDaEntrada ? Math.max(0, _entradaAceitaEm - _pedidoDeEntradaEm) : undefined,
		travou: false,
		cargasRefeitas: 0,
		abaOculta: typeof document !== 'undefined' && document.visibilityState === 'hidden',
		worker: null,
		workerTerminouEm: null,
		montadoEm: null,
		falhas: 0
	};
	_pedidoDeEntradaEm = null;
	_entradaAceitaEm = null;
	vigiarSaidaDaPagina();
}

/** O jogador pediu "Tentar de novo": o mesmo carregamento, outra carga. */
export function anotarCargaRefeita() {
	if (_atual) {
		_atual.cargasRefeitas++;
		_atual.worker = null;
		_atual.workerTerminouEm = null;
	}
}

/**
 * O motivo da falha (o primeiro, aparado): QUAL arquivo e QUAL erro. So texto
 * do carregador ("Can't find file", "Erro ao montar o mapa (data\x.gnd) - ..."),
 * nunca dado do jogador.
 * @param {string} erro
 */
export function anotarErroDaCarga(erro) {
	if (_atual && !_atual.erro && erro) {
		_atual.erro = String(erro).slice(0, 120);
	}
}

/** A saida ("Tentar de novo") apareceu neste carregamento. */
export function anotarTravou() {
	if (_atual) _atual.travou = true;
}

/**
 * O worker terminou a carga (bem ou mal) e mandou a medida das fases.
 * @param {boolean} sucesso
 * @param {object|undefined} medida - o `resumo()` de `Loaders/medidaDaCarga.js`
 */
export function anotarFimNoWorker(sucesso, medida, agora = agoraPadrao()) {
	if (!_atual) return;
	_atual.worker = medida && typeof medida === 'object' ? medida : null;
	_atual.workerTerminouEm = agora;
	if (!sucesso) _atual.falhas++;
}

/** A montagem no fio principal acabou (o veu saiu, o `onLoad` vai rodar). */
export function anotarMontado(agora = agoraPadrao()) {
	if (_atual) _atual.montadoEm = agora;
}

/** Ha um carregamento em curso? (a sonda e os testes perguntam) */
export function carregamentoEmCurso() {
	return _atual !== null;
}

/**
 * O RELATO, puro: o estado do carregamento vira o corpo do POST.
 *
 * @param {object} estado - o `_atual`
 * @param {number} agora
 * @param {'ok'|'abandonou'|'recarregou'} desfecho
 * @param {{dedo: boolean, ua: string, versao?: string}} aparelho
 */
export function montarRelato(estado, agora, desfecho, aparelho) {
	const relato = {
		mapa: estado.mapa,
		motivo: estado.motivo,
		desfecho,
		aparelho: tipoDeAparelho(aparelho.dedo, aparelho.ua),
		dedo: !!aparelho.dedo,
		ua: String(aparelho.ua || '').slice(0, 200),
		totalMs: Math.max(0, Math.round(agora - estado.inicio)),
		travou: !!estado.travou,
		cargasRefeitas: estado.cargasRefeitas,
		abaOculta: !!estado.abaOculta,
		falhas: estado.falhas
	};
	if (aparelho.versao) relato.versao = aparelho.versao;
	if (estado.erro) relato.erro = estado.erro;
	if (typeof estado.esperaDoServidorMs === 'number') {
		relato.esperaDoServidorMs = Math.round(estado.esperaDoServidorMs);
	}
	if (estado.workerTerminouEm !== null && estado.montadoEm !== null) {
		relato.montagemMs = Math.max(0, Math.round(estado.montadoEm - estado.workerTerminouEm));
	}
	const w = estado.worker;
	if (w) {
		for (const chave of Object.keys(w)) {
			const valor = w[chave];
			if (typeof valor === 'number' || typeof valor === 'boolean') {
				relato[chave] = valor;
			}
		}
	}
	return relato;
}

function aparelhoAtual() {
	let ua = '';
	try {
		ua = String((window.navigator && window.navigator.userAgent) || '');
	} catch {
		ua = '';
	}
	return { dedo: ehDedo(), ua, versao: versaoDoBuild() };
}

/** @param {object} relato */
function enviar(relato) {
	try {
		fetch(rotaDoBalcao(ROTA_DO_CARREGAMENTO), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(relato),
			keepalive: true
		}).catch(function () {});
	} catch {
		/* medir nao pode virar erro */
	}
}

/**
 * O `CZ_NOTIFY_ACTORINIT` acabou de sair (chamado pelo `MapEngine` DEPOIS do
 * pacote). Fecha o carregamento em curso e agenda o relato - o envio nunca
 * acontece na mesma volta do laco do estou-pronto.
 *
 * Sem carregamento em curso (o teleporte no mesmo mapa, a reconexao que achou
 * o mapa ja na tela) nao ha o que relatar.
 *
 * @returns {boolean} se agendou um relato
 */
export function aoEstouProntoEnviado(agora = agoraPadrao(), agendar = setTimeout) {
	try {
		if (!_atual || _atual.workerTerminouEm === null) {
			return false;
		}
		if (_atual.montadoEm === null) _atual.montadoEm = agora;
		const relato = montarRelato(_atual, agora, 'ok', aparelhoAtual());
		_atual = null;
		agendar(() => enviar(relato), 0);
		return true;
	} catch {
		return false;
	}
}

/**
 * O carregamento NAO terminou e a pagina vai embora (fechou a aba, ou o
 * "Recarregar o jogo"). E o caso que mais se quer ver - o jogador que desistiu
 * - e por isso ele sai ja, com `keepalive`.
 *
 * @param {'abandonou'|'recarregou'} desfecho
 */
export function relatarDesistencia(desfecho, agora = agoraPadrao()) {
	try {
		if (!_atual) return false;
		const relato = montarRelato(_atual, agora, desfecho, aparelhoAtual());
		_atual = null;
		enviar(relato);
		return true;
	} catch {
		return false;
	}
}

function vigiarSaidaDaPagina() {
	if (_vigiandoSaida || typeof window === 'undefined') return;
	_vigiandoSaida = true;
	try {
		window.addEventListener('pagehide', () => relatarDesistencia('abandonou'));
		document.addEventListener('visibilitychange', () => {
			if (_atual && document.visibilityState === 'hidden') _atual.abaOculta = true;
		});
	} catch {
		/* sem os ganchos, so os carregamentos que terminam sao relatados */
	}
}

/** So para os testes: esquece tudo. */
export function zerarParaTeste() {
	_atual = null;
	_pedidoDeEntradaEm = null;
	_entradaAceitaEm = null;
}
