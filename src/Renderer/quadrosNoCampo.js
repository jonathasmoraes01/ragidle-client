/**
 * O FPS QUE O APARELHO DO JOGADOR DESENHA DE VERDADE (13/09/2026, auditoria do
 * iPhone).
 *
 * Jogadores de iPhone relataram travamento, e nenhum numero de FPS de telefone
 * existia: as sondas rodam numa maquina com placa de video de desktop, e a GPU
 * de um telefone nao se reproduz ali. Este modulo faz o aparelho CONTAR.
 *
 * O QUE ELE MEDE: o intervalo entre quadros que o jogo DESENHOU — ele e chamado
 * por `Renderer._render` depois do limitador de quadros, entao um quadro que o
 * limitador descartou nao conta (contar o `requestAnimationFrame` cru contaria).
 * Intervalos acima de `INTERVALO_MAXIMO_MS` sao a aba escondida ou a carga de um
 * mapa, e nao um quadro lento, e ficam de fora.
 *
 * AS REGRAS, as mesmas do relato de erro (`UI/relatoDeErro.js`):
 *   1. nunca atrapalha o jogo: por quadro sao duas contas e uma escrita num
 *      vetor ja alocado; o envio e `fire-and-forget`;
 *   2. manda POUCO: um relato a cada `INTERVALO_DO_RELATO_MS`, e so em jogo, com
 *      a aba na frente e amostra suficiente;
 *   3. nao manda dado de jogador: numeros do quadro, a tela e o agente do
 *      navegador. O que se quer saber e o APARELHO.
 * O servidor valida tudo de novo (`servidor/analytics/desempenho-do-cliente.ts`).
 * Teste: `tests/renderer/quadrosNoCampo.test.js`.
 */
import Session from 'Engine/SessionStorage.js';
import { ehDedo } from 'UI/escalaDaHud.js';
import { ehCelularEmPe } from 'UI/hudVertical.js';
import { rotaDoBalcao } from 'UI/enderecoDoBalcao.js';
import { versaoDoBuild } from 'UI/relatoDeErro.js';

export const ROTA_DO_DESEMPENHO = '/analytics/desempenho';
export const INTERVALO_DO_RELATO_MS = 120_000;
/** Menos que isso em dois minutos e o jogo parado numa tela, e nao amostra. */
export const MINIMO_DE_QUADROS = 120;
export const INTERVALO_MAXIMO_MS = 1000;
/** Dois minutos a 120 fps sao 14.400 quadros; sobra folga. */
const CAPACIDADE = 16384;

const _intervalos = new Float32Array(CAPACIDADE);
let _quantos = 0;
let _anterior = 0;
/*
 * O PRIMEIRO QUADRO EM JOGO (13/09/2026). "Perde FPS depois de um tempo" pode
 * ser acumulo no jogo ou o telefone esquentando; o relato leva os minutos
 * desde que o jogador entrou, e o painel mostra o FPS por faixa de minutos.
 * Voltar para a selecao zera: a sessao que interessa e a de jogo.
 */
let _entrouEm = 0;

/**
 * Um quadro desenhado. Chamado todo quadro pelo renderizador.
 * @param {number} agora - o `DOMHighResTimeStamp` do quadro
 */
export function registrarQuadro(agora) {
	if (!Session.Playing) {
		_entrouEm = 0;
	} else if (_entrouEm === 0) {
		_entrouEm = agora;
	}
	if (_anterior > 0) {
		const delta = agora - _anterior;
		if (delta > 0 && delta <= INTERVALO_MAXIMO_MS && _quantos < CAPACIDADE) {
			_intervalos[_quantos++] = delta;
		}
	}
	_anterior = agora;
}

/** Quantos intervalos a amostra atual tem. */
export function quadrosNaAmostra() {
	return _quantos;
}

/** Descarta a amostra atual, o quadro anterior e o relogio da sessao. */
export function zerarAmostra() {
	_quantos = 0;
	_anterior = 0;
	_entrouEm = 0;
}

/**
 * Os minutos desde o primeiro quadro em jogo, medidos no MESMO relogio dos
 * quadros (o carimbo do `requestAnimationFrame`), e nao em outro.
 * @return {number}
 */
function minutosEmJogo() {
	if (_entrouEm === 0 || _anterior < _entrouEm) {
		return 0;
	}
	return Math.round(((_anterior - _entrouEm) / 60000) * 10) / 10;
}

/**
 * @param {ArrayLike<number>} intervalos
 * @param {number} quantos
 * @return {{quadros: number, fps: number, p50Ms: number, p95Ms: number}|null}
 */
export function resumirIntervalos(intervalos, quantos) {
	if (!(quantos > 0)) {
		return null;
	}
	const ordenados = Array.prototype.slice.call(intervalos, 0, quantos).sort((a, b) => a - b);
	let soma = 0;
	for (let i = 0; i < quantos; i++) {
		soma += ordenados[i];
	}
	const percentil = q => ordenados[Math.min(quantos - 1, Math.floor(quantos * q))];
	return {
		quadros: quantos,
		fps: Math.round(((quantos * 1000) / soma) * 10) / 10,
		p50Ms: Math.round(percentil(0.5) * 10) / 10,
		p95Ms: Math.round(percentil(0.95) * 10) / 10
	};
}

/** O aparelho: densidade, buffer do mundo, tela em CSS, dedo e agente. */
function aparelho() {
	const canvas = document.querySelector('canvas.ro-scene');
	const relato = {
		dpr: window.devicePixelRatio || 1,
		dedo: ehDedo(),
		emPe: ehCelularEmPe(),
		ua: String((window.navigator && window.navigator.userAgent) || '').slice(0, 200)
	};
	if (canvas) {
		relato.bufferL = canvas.width;
		relato.bufferA = canvas.height;
		relato.cssL = canvas.clientWidth;
		relato.cssA = canvas.clientHeight;
	}
	const versao = versaoDoBuild();
	if (versao) {
		relato.versao = versao;
	}
	return relato;
}

/**
 * Manda o relato da amostra atual, se ela vale, e comeca outra.
 * @return {boolean} se mandou
 */
export function enviarRelatoDeDesempenho() {
	try {
		const vale = !document.hidden && Session.Playing && _quantos >= MINIMO_DE_QUADROS;
		const resumo = vale ? resumirIntervalos(_intervalos, _quantos) : null;
		_quantos = 0;
		if (!resumo) {
			return false;
		}
		fetch(rotaDoBalcao(ROTA_DO_DESEMPENHO), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(Object.assign(resumo, aparelho(), { minutosDeSessao: minutosEmJogo() })),
			keepalive: true
		}).catch(function () {});
		return true;
	} catch {
		return false; /* medir nao pode virar erro */
	}
}

/** Liga o relato periodico. Idempotente. */
export function ligarRelatoDeDesempenho() {
	if (typeof window === 'undefined' || window.__ragidleDesempenhoLigado) {
		return;
	}
	window.__ragidleDesempenhoLigado = true;
	// A volta de uma aba escondida nao e um quadro de varios minutos.
	document.addEventListener('visibilitychange', () => {
		_anterior = 0;
	});
	setInterval(enviarRelatoDeDesempenho, INTERVALO_DO_RELATO_MS);
}
