/**
 * Core/ThreadEventHandler.js
 *
 * Handler data received from Main Thread and process.
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import FileManager from 'Core/FileManager.js';
import FileSystem from 'Core/FileSystem.js';
import MapLoader from 'Loaders/MapLoader.js';
import { transferiveisDoMapa } from 'Loaders/transferiveisDoMapa.js';

/**
 * A carga de mapa em curso no worker (D-2055): a proxima a cancela.
 * @type {MapLoader|null}
 */
let cargaDeMapaEmCurso = null;

/** O intervalo minimo entre dois avisos de rede andando (D-2055). */
const INTERVALO_DA_ATIVIDADE_MS = 500;

/**
 *	Send an Error to main thread
 *
 * @param {string} error
 */
function sendError() {
	postMessage({ type: 'THREAD_ERROR', data: Array.prototype.slice.call(arguments, 0) });
}

/**
 *	Send a message log to main thread
 *
 * @param {string} error
 */
function sendLog() {
	postMessage({ type: 'THREAD_LOG', data: Array.prototype.slice.call(arguments, 0) });
}

/**
 * Receiving data, process action
 *
 * @param {object} event - EventHandler
 */
onmessage = function receive(event) {
	const msg = event.data;

	switch (msg.type) {
		// Modify client host
		case 'SET_HOST':
			if (msg.data.substr(-1) !== '/') {
				msg.data += '/';
			}

			FileManager.remoteClient = msg.data;
			break;

		// Save full client and use it
		case 'CLIENT_INIT':
			FileSystem.bind('onprogress', function (progress) {
				postMessage({ type: 'CLIENT_SAVE_PROGRESS', data: progress });
			});

			// full client saved !
			FileSystem.bind('onuploaded', function () {
				postMessage({ type: 'CLIENT_SAVE_COMPLETE' });
			});

			FileManager.onGameFileLoaded = function (filename) {
				sendLog('Success to load GRF file "' + filename + '"');
			};

			FileManager.onGameFileError = function (filename, error) {
				sendError('Error loading GRF file "' + filename + '" : ' + error);
			};

			// Start loading GRFs files
			FileSystem.bind('onready', function () {
				FileManager.clean();
				FileManager.init(msg.data.grfList);

				postMessage({
					uid: msg.uid,
					arguments: [FileManager.gameFiles.length, null, msg.data]
				});
			});

			// Saving full client
			FileSystem.init(msg.data.files, msg.data.save, msg.data.quota);
			break;

		// Files alias
		case 'CLIENT_FILES_ALIAS':
			FileManager.filesAlias = msg.data;
			break;

		// Get a file from client/grf
		case 'GET_FILE':
			FileManager.get(msg.data.filename, function (result, error) {
				if (error) {
					sendError('[Thread] ' + error + ' (' + msg.data.filename + ')');
				}

				if (msg.uid) {
					postMessage({
						uid: msg.uid,
						arguments: [result, error, msg.data]
					});
				}
			});
			break;

		// Get and load a file from client/grf
		case 'LOAD_FILE':
			FileManager.load(
				msg.data.filename,
				function (result, error) {
					if (error) {
						sendError('[Thread] ' + error + ' (' + msg.data.filename + ')');
					}

					if (msg.uid) {
						postMessage({
							uid: msg.uid,
							arguments: [result, error, msg.data]
						});
					}
				},
				msg.data.args
			);
			break;

		// D-2055: o fio principal desistiu da carga em curso (a mensagem do
		// worker que nao se leu): ela para de falar e aborta os pedidos.
		case 'CANCEL_MAP':
			if (cargaDeMapaEmCurso) {
				cargaDeMapaEmCurso.cancelar();
				cargaDeMapaEmCurso = null;
			}
			break;

		// Search a file in Client
		case 'SEARCH_FILE':
			if (msg.uid) {
				postMessage({
					uid: msg.uid,
					arguments: [FileManager.search(msg.data), null, msg.data]
				});
			}
			break;

		// Start loading a map
		case 'LOAD_MAP': {
			/*
			 * UMA CARGA DE MAPA POR VEZ, E CADA UMA COM O SEU NUMERO (D-2055).
			 * `msg.data` e o nome do `.rsw` (o GrfViewer) ou `{ filename, carga }`
			 * (o `MapRenderer`). O numero vai em toda mensagem da carga, e o fio
			 * principal descarta a de uma carga que nao e mais a dele - a carga
			 * refeita pelo "Tentar de novo" nao recebe o `MAP_GROUND` da velha.
			 * A carga anterior e CANCELADA aqui: os pedidos de rede dela sao
			 * abortados e ela nao fala mais nada.
			 */
			const pedido = typeof msg.data === 'string' ? { filename: msg.data } : msg.data;
			const carga = pedido.carga;
			if (cargaDeMapaEmCurso) {
				cargaDeMapaEmCurso.cancelar();
			}
			const map = new MapLoader();
			cargaDeMapaEmCurso = map;
			let ultimaAtividade = 0;

			map.onprogress = function (progress) {
				postMessage({ type: 'MAP_PROGRESS', data: progress, carga });
			};

			map.onload = function (success, error, medida) {
				if (cargaDeMapaEmCurso === map) {
					cargaDeMapaEmCurso = null;
				}
				if (msg.uid) {
					postMessage({
						uid: msg.uid,
						arguments: [success, error, msg.data, medida]
					});
				}
			};

			// Os buffers grandes do chao e dos modelos vao TRANSFERIDOS, e nao
			// copiados (D-2055, achado A3): copiar um `.gnd` de 13 MB montado
			// dobra o pico de memoria, e no celular e onde o `postMessage` falha.
			map.ondata = function (type, data) {
				postMessage({ type: type, data: data, carga }, transferiveisDoMapa(type, data));
			};

			// A rede ANDANDO (bytes chegando, nova tentativa saindo): e o sinal de
			// vida que a vigia do fio principal escuta enquanto a barra nao se
			// move. No maximo uma mensagem a cada `INTERVALO_DA_ATIVIDADE_MS` -
			// um `.gnd` de 13 MB chega em centenas de pedacos -, mas a nova
			// tentativa sai sempre.
			map.onatividade = function (atividade) {
				const agora = Date.now();
				if (atividade.tentativa === undefined && agora - ultimaAtividade < INTERVALO_DA_ATIVIDADE_MS) {
					return;
				}
				ultimaAtividade = agora;
				postMessage({ type: 'MAP_ATIVIDADE', data: atividade, carga });
			};

			// A parte sincrona da carga tambem nao pode deixar o fio principal
			// esperando para sempre (D-2055, achado A3).
			try {
				map.load(pedido.filename);
			} catch (excecao) {
				map.terminarCarga(false, 'Erro ao comecar a carga do mapa - ' + (excecao && excecao.message));
				map.cancelar();
			}
			break;
		}
	}
};

/**
 * Once the thread is ready
 */
postMessage({ type: 'THREAD_READY' });
