/**
 * Audio/SoundManager.js
 *
 * Sound Manager — efeitos sonoros do jogo, em Web Audio (D-1484, 15/09/2026).
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 *
 * ===========================================================================
 * POR QUE ISTO FOI REESCRITO, COM O NUMERO QUE DECIDIU
 * ===========================================================================
 * Relato do dono, no iPhone: o jogo trava em caca automatica. A investigacao
 * levou quatro medicoes, e cada uma derrubou a conclusao da anterior — o
 * caminho inteiro esta em D-1481. A ultima delas mediu, no aparelho dele:
 *
 *     som: 895 pedidos · 19.617 ms no total · **21,92 ms POR SOM**
 *
 * **Um unico efeito sonoro custava 21,92 ms.** O orcamento inteiro de um
 * quadro a 60 fps e 16,7 ms: tocar um som custava mais do que desenhar um
 * quadro completo. Com ~8 sons por segundo em caca, 17% da sessao inteira era
 * gasta dentro de `play()`, e no pior quadro o som foi 1010 dos 1039 ms.
 *
 * O dono tinha visto a mesma coisa pelo lado de fora, sem saber: *"com o som
 * desabilitado, funciona perfeitamente; quando ativo o som, continua
 * travando"*.
 *
 * ---------------------------------------------------------------------------
 * A CAUSA: `<audio>` E PARA MUSICA, NAO PARA EFEITO DE JOGO
 * ---------------------------------------------------------------------------
 * A versao anterior tocava cada efeito com um `HTMLAudioElement`. Eles sao
 * elementos de MIDIA: cada ativacao monta um pipeline de reproducao, e no
 * WebKit do iOS isso e caro e tem teto baixo de instancias simultaneas. Usar
 * um por golpe e como abrir um tocador de musica novo a cada espadada.
 *
 * A Web Audio existe exatamente para isto: o arquivo e decodificado **uma
 * vez** para um `AudioBuffer`, e cada disparo e um `AudioBufferSourceNode` —
 * um objeto descartavel que custa microssegundos. Tocar o mesmo som mil vezes
 * decodifica uma vez e dispara mil nos baratos.
 *
 * ---------------------------------------------------------------------------
 * O QUE **NAO** MUDOU, E POR QUE ISSO IMPORTA
 * ---------------------------------------------------------------------------
 * A API publica e a mesma: `play`, `playPosition`, `stop`, `setVolume`,
 * `volume` e `diagnostico`. Dezenove arquivos chamam este modulo, e uma
 * migracao que exigisse tocar nos dezenove seria dezenove chances de errar.
 *
 * A BGM (`Audio/BGM.js`) **continua em `<audio>`, de proposito**: musica e
 * exatamente o caso de uso para o qual o elemento foi feito — uma faixa longa,
 * tocada uma vez, com streaming. Trocar ali nao ganharia nada e gastaria
 * memoria decodificando minutos de audio.
 *
 * ---------------------------------------------------------------------------
 * O DESTRAVE POR GESTO, QUE E OBRIGATORIO NO iOS
 * ---------------------------------------------------------------------------
 * Todo navegador nasce com o `AudioContext` em `suspended` ate um gesto do
 * usuario, e o iOS e o mais rigoroso. Sem `resume()`, os sons sairiam mudos
 * para sempre — e em silencio, porque `start()` nao reclama.
 *
 * Por isso `destravarNoPrimeiroGesto` escuta os quatro gestos que valem, uma
 * vez cada. **Este e o principal risco da migracao** (som mudo e pior que som
 * caro), e por isso ele tem teste proprio.
 */

import Client from 'Core/Client.js';
import Preferences from 'Preferences/Audio.js';
import Memory from 'Core/MemoryManager.js';
import glMatrix from 'Utils/gl-matrix.js';
import Session from 'Engine/SessionStorage.js';
import { contarSom } from 'Renderer/fasesDoQuadro.js';

/**
 * O mesmo intervalo minimo da versao anterior: o mesmo som duas vezes dentro
 * desta janela vira um. Em caca automatica a rajada de golpes pede o mesmo
 * `wav` varias vezes no mesmo instante, e empilha-los so soma volume.
 */
const C_SAME_SOUND_DELAY = 100;

/**
 * Teto de nos TOCANDO ao mesmo tempo.
 *
 * Um `AudioBufferSourceNode` e barato, mas nao e de graca: mil simultaneos
 * viram uma parede de som e gastam mistura a toa. 24 e generoso para um jogo
 * em que a cena tem dezenas de mobs — e, ao contrario do teto antigo (que
 * existia para nao estourar o limite de ELEMENTOS DE MIDIA do navegador),
 * este e so bom senso de mixagem.
 */
const C_MAX_VOZES = 24;

/** `AudioBuffer` ja decodificado, por nome de arquivo. Decodifica-se UMA vez. */
const _buffers = new Map();
/** Nomes cuja decodificacao esta em curso — impede pedir o mesmo duas vezes. */
const _decodificando = new Set();
/** Ultimo instante em que cada nome tocou, para o intervalo minimo. */
const _ultimoToque = new Map();
/** Os nos que estao tocando agora. Saem sozinhos no `onended`. */
const _vozes = new Set();

/** @type {AudioContext|null} */
let _ctx = null;
/** @type {GainNode|null} O volume mestre; todo no passa por ele. */
let _mestre = null;
let _destravou = false;

/**
 * O contexto, criado na primeira necessidade.
 *
 * Criar no carregamento do modulo seria pior: navegadores contam contexto
 * criado e nunca usado como abuso, e o modulo e importado mesmo em telas que
 * nao tocam nada (a de login, por exemplo).
 *
 * @return {AudioContext|null} `null` quando o navegador nao tem Web Audio —
 *   nesse caso o jogo roda mudo, e isso e melhor que quebrar.
 */
function contexto() {
	if (_ctx) {
		return _ctx;
	}
	const Ctor = window.AudioContext || window.webkitAudioContext;
	if (!Ctor) {
		return null;
	}
	_ctx = new Ctor();
	_mestre = _ctx.createGain();
	_mestre.gain.value = SoundManager.volume;
	_mestre.connect(_ctx.destination);
	destravarNoPrimeiroGesto();
	return _ctx;
}

/**
 * O CONTEXTO SO ACORDA COM UM GESTO — e sem isto o jogo fica MUDO.
 *
 * Todo navegador nasce com o contexto `suspended`; o iOS e o mais rigoroso.
 * `start()` num contexto suspenso nao lanca e nao avisa: o som simplesmente nao
 * sai. Um `resume()` esquecido aqui seria um defeito silencioso, que e o pior
 * tipo — e por isso este e o unico ponto desta migracao com teste proprio.
 *
 * **Os ouvintes NAO sao `once`, e as duas razoes sao do aparelho do dono:**
 *
 *   1. o contexto nasce no primeiro som, que pode ser MUITO depois dos
 *      primeiros toques (login, escolher personagem). Com `once`, aqueles
 *      gestos teriam sido gastos com `_ctx` ainda nulo, sem destravar nada;
 *   2. o iOS SUSPENDE o contexto de novo quando a aba vai para segundo plano
 *      ou entra uma ligacao. Ouvinte gasto nao traz o som de volta — e um jogo
 *      idle passa muito tempo em segundo plano.
 *
 * O custo de deixa-los armados e desprezivel: quatro ouvintes passivos que
 * chamam uma funcao que sai na primeira linha quando nao ha o que fazer.
 */
function destravarNoPrimeiroGesto() {
	if (_destravou || typeof window === 'undefined' || !window.addEventListener) {
		return;
	}
	_destravou = true;
	for (const gesto of ['pointerdown', 'touchstart', 'mousedown', 'keydown']) {
		window.addEventListener(gesto, acordarOContexto, { passive: true });
	}
}

function acordarOContexto() {
	if (_ctx && _ctx.state === 'suspended') {
		_ctx.resume().catch(() => {});
	}
}

/**
 * OS BYTES DO ARQUIVO — e o `.wav` chega em TRES formas diferentes.
 *
 * Isto quase virou um jogo mudo em producao, e a armadilha merece o registro:
 * `FileManager.getHTTP` tem um atalho declarado para audio —
 *
 *     // Don't load mp3 sounds to avoid blocking the queue
 *     // They can be load by the HTML5 Audio
 *     if (filename.match(/\.(mp3|wav)$/)) { callback(url); return; }
 *
 * — ou seja, para `.wav` vindo de HTTP ele devolve **a URL como texto**, e nao
 * os bytes. E HTTP e justamente o caminho deste jogo: o `remoteClient` aponta
 * para o servidor de assets (`/remote-client/` em casa, `https://assets.<dominio>/`
 * em producao). Um `instanceof ArrayBuffer` sozinho descartaria TODO som.
 *
 * As tres formas, e de onde cada uma vem:
 *   - `ArrayBuffer` — o arquivo salvo no sistema de arquivos do navegador;
 *   - vista tipada (`Uint8Array`) — o GRF lido direto;
 *   - `string` — a URL do atalho acima. Aqui ela e buscada de verdade.
 *
 * **O `fetch` da URL depende de CORS, e o `<audio>` nao dependia.** Elemento de
 * midia carrega em modo no-cors; `fetch` nao. O servidor de assets responde
 * `Access-Control-Allow-Origin: *` (`tools/oraculo/servidor-de-assets.ts`), e
 * por isso isto funciona atravessando o tunel em producao — mas a dependencia e
 * NOVA e agora tem portao la, porque tirar aquele cabecalho deixaria o jogo
 * mudo sem quebrar mais nada.
 */
function bytesDoArquivo(dados) {
	if (dados instanceof ArrayBuffer) {
		// COPIA obrigatoria: `decodeAudioData` DETACHA o buffer que recebe, e o
		// original vive no cache do `MemoryManager` — sem ela, quem pedisse o
		// mesmo arquivo depois acharia um buffer vazio.
		return Promise.resolve(dados.slice(0));
	}
	if (ArrayBuffer.isView(dados)) {
		return Promise.resolve(dados.buffer.slice(dados.byteOffset, dados.byteOffset + dados.byteLength));
	}
	if (typeof dados === 'string') {
		return fetch(dados).then(resposta => {
			if (!resposta.ok) {
				throw new Error(`HTTP ${String(resposta.status)}`);
			}
			return resposta.arrayBuffer();
		});
	}
	return Promise.reject(new Error('formato de audio desconhecido'));
}

/**
 * Garante o `AudioBuffer` do arquivo, decodificando se for a primeira vez.
 *
 * `Client.getFile` (e nao `loadFile`) de proposito: aquele embrulha o audio num
 * blob URL que a Web Audio nao usa — seria criar e revogar uma URL por som,
 * exatamente o churn que a versao anterior tinha (e que fazia o
 * `MemoryManager` revogar a URL debaixo de um `<audio>` ainda vivo).
 *
 * A decodificacao acontece UMA vez por arquivo, e e ela que paga a migracao.
 * O primeiro pedido de um som novo chega aqui, carrega e toca ao terminar — o
 * mesmo comportamento da versao em `<audio>`; os pedidos que chegarem durante
 * esse voo saem calados, em vez de pedir o mesmo arquivo de novo.
 */
function garantirBuffer(filename, aoPronto) {
	const pronto = _buffers.get(filename);
	if (pronto) {
		aoPronto(pronto);
		return;
	}
	if (_decodificando.has(filename)) {
		return; // ja esta a caminho; este pedido simplesmente nao toca
	}
	const ctx = contexto();
	if (!ctx) {
		return;
	}
	_decodificando.add(filename);
	Client.getFile(
		`data/wav/${filename}`,
		dados => {
			bytesDoArquivo(dados)
				.then(
					bytes =>
						new Promise((resolver, recusar) => {
							// A forma de CALLBACK, e nao a que devolve promessa:
							// o WebKit mais velho so tem esta, e e justamente o
							// aparelho desta rodada.
							ctx.decodeAudioData(bytes, resolver, recusar);
						})
				)
				.then(buffer => {
					_decodificando.delete(filename);
					_buffers.set(filename, buffer);
					aoPronto(buffer);
				})
				.catch(() => {
					// Som que nao carrega ou nao decodifica nao vira excecao: o
					// jogo segue sem AQUELE som. Fica fora do cache para uma
					// proxima tentativa poder dar certo.
					_decodificando.delete(filename);
				});
		},
		() => {
			_decodificando.delete(filename);
		}
	);
}

/** Dispara um no descartavel. E este o "tocar" que custa microssegundos. */
function dispararVoz(buffer, volume) {
	const ctx = contexto();
	if (!ctx || _vozes.size >= C_MAX_VOZES) {
		return;
	}
	const fonte = ctx.createBufferSource();
	fonte.buffer = buffer;

	// Um ganho POR VOZ: e ele que carrega o volume relativo da distancia
	// (`playPosition`). O volume geral fica no mestre, para `setVolume` mudar
	// tudo de uma vez sem percorrer voz nenhuma.
	const ganho = ctx.createGain();
	ganho.gain.value = Math.min(Math.max(volume, 0), 1);
	fonte.connect(ganho);
	ganho.connect(_mestre);

	_vozes.add(fonte);
	fonte.onended = () => {
		_vozes.delete(fonte);
		// Desconectar libera o no do grafo na hora, em vez de esperar a coleta.
		try {
			fonte.disconnect();
			ganho.disconnect();
		} catch {
			/* no ja solto: nada a fazer */
		}
	};
	fonte.start(0);
}

/**
 * @Constructor
 */
class SoundManager {
	/**
	 * @var {float} sound volume
	 */
	static volume = Preferences.Sound.volume;

	/**
	 * Play a wav sound
	 *
	 * @param {string} filename
	 * @param {optional|number} vol (volume)
	 */
	static play(filename, vol) {
		const inicioDoSom = performance.now();
		try {
			SoundManager.tocar(filename, vol);
		} finally {
			// A medicao fica: foi ela que achou o defeito, e e ela que vai
			// dizer, no aparelho do dono, o que a migracao valeu.
			contarSom(performance.now() - inicioDoSom);
		}
	}

	static tocar(filename, vol) {
		/*
		 * O produto so decide SE toca. Quem toca e o `vol` sozinho: ele e a
		 * parcela da DISTANCIA (ver `playPosition`), e o volume geral ja mora no
		 * no mestre, por onde toda voz passa. Multiplicar os dois aqui aplicaria
		 * o geral duas vezes.
		 */
		if (SoundManager.volume <= 0 || (vol !== undefined && vol <= 0) || !Preferences.Sound.play) {
			return;
		}

		const agora = Date.now();
		if (agora - (_ultimoToque.get(filename) ?? -Infinity) < C_SAME_SOUND_DELAY) {
			return;
		}
		_ultimoToque.set(filename, agora);

		const relativo = vol === undefined ? 1 : vol;
		garantirBuffer(filename, buffer => dispararVoz(buffer, relativo));
	}

	/**
	 * Play a wav sound with calculated position for volume
	 *
	 * @param {string} filename
	 * @param {optional|number} vol (volume)
	 */
	static playPosition(filename, srcPosition) {
		const dist = Math.floor(glMatrix.vec2.dist(srcPosition, Session.Entity.position));
		const vol = Math.max(1 - Math.abs(((dist - 1) * (1 - 0.01)) / (25 - 1) + 0.01), 0.1);
		SoundManager.play(filename, vol);
	}

	/**
	 * Stop a specify sound, or all sounds.
	 *
	 * @param {optional|string} filename to stop
	 */
	static stop(filename) {
		/*
		 * COM NOME, o contrato mudou de forma honesta: a versao em `<audio>`
		 * guardava uma lista por nome e parava aquelas instancias. Aqui a voz
		 * nao lembra de que arquivo veio (o `AudioBuffer` e compartilhado), e
		 * guardar o nome em cada no so para isto seria estado a mais para um
		 * caso que o jogo usa para CORTAR som — nunca para cortar so um.
		 *
		 * Medido antes de decidir: as quatro chamadas de `stop` no fork passam
		 * SEM argumento. Parar tudo e o comportamento que todas elas esperam.
		 */
		for (const fonte of _vozes) {
			try {
				fonte.stop(0);
			} catch {
				/* ja parou */
			}
		}
		_vozes.clear();

		if (filename) {
			_ultimoToque.delete(filename);
			return;
		}
		_ultimoToque.clear();

		/*
		 * O BUFFER DECODIFICADO FICA. Ele e o ganho inteiro desta migracao:
		 * joga-lo fora obrigaria a decodificar de novo no proximo golpe, que e o
		 * custo que acabamos de tirar do caminho. O que sai da memoria e o
		 * arquivo CRU no `MemoryManager`, que ja cumpriu o papel dele.
		 *
		 * **A chamada anterior tinha a ARIDADE ERRADA e nunca limpou nada**: a
		 * assinatura e `remove(gl, filename)` (`Core/MemoryManager.js`), o codigo
		 * passava `remove(chave)`, entao `filename` chegava `undefined` e a
		 * primeira linha da funcao devolvia sem fazer nada. Ficou invisivel
		 * porque limpar cache nao produz efeito que alguem olhe.
		 *
		 * O `null` no lugar do contexto WebGL e legitimo: ele so e usado para
		 * apagar textura de `.spr`/`.pal`/`.str`, sempre atras de `gl != null`.
		 */
		const lista = Memory.search(/\.wav$/);
		lista.forEach(chave => {
			Memory.remove(null, chave);
		});
	}

	/**
	 * Change volume of all sounds
	 *
	 * @param {number} volume
	 */
	static setVolume(volume) {
		SoundManager.volume = Math.min(volume, 1.0);
		Preferences.Sound.volume = SoundManager.volume;
		Preferences.save();

		// Uma linha, e nao um laco por instancia: e para isto que o no mestre
		// existe. As vozes que ja estao tocando mudam junto.
		if (_mestre) {
			_mestre.gain.value = SoundManager.volume;
		}
	}

	/**
	 * QUANTO O SOM ESTA SEGURANDO (D-1415, refeito em D-1484).
	 *
	 * Os nomes dos campos sobrevivem a migracao porque `tests/util/
	 * somNaoVazaNoIphone.test.js` e a sonda os leem — e o que eles medem
	 * continua sendo a mesma pergunta ("isto acumula?"), so que agora a
	 * resposta e estrutural: nao ha elemento de midia para vazar.
	 *
	 * - `players`: vozes tocando agora (era o contador de `<audio>` vivos);
	 * - `vivos`: o mesmo numero — nesta arquitetura nao ha "preso sem tocar";
	 * - `emCache`: buffers DECODIFICADOS, que e o que ocupa memoria agora.
	 */
	static diagnostico() {
		return { players: _vozes.size, vivos: _vozes.size, emCache: _buffers.size };
	}
}

/*
 * Os ouvintes de gesto ficam armados JA, no carregamento do modulo — e nao so
 * quando o contexto nasce. O contexto nasce no primeiro som, que vem depois do
 * login e da escolha de personagem; sem isto, todos os toques ate la passariam
 * sem ninguem ouvindo, e o primeiro golpe sairia mudo.
 */
destravarNoPrimeiroGesto();

/**
 * Export
 */
export default SoundManager;
