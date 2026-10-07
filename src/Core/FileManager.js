/**
 * Core/FileManager.js
 *
 * Manage and load files
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import GameFile from 'Loaders/GameFile.js';
import World from 'Loaders/World.js';
import Ground from 'Loaders/Ground.js';
import Altitude from 'Loaders/Altitude.js';
import Model from 'Loaders/Model.js';
import Sprite from 'Loaders/Sprite.js';
import Action from 'Loaders/Action.js';
import Str from 'Loaders/Str.js';
import FileSystem from 'Core/FileSystem.js';
import { devoBaixarDeNovo, devoTentarDeNovo, esperaAntesDaTentativa } from 'Core/tentativasDeArquivo.js';
import { baixarComVigia } from 'Core/baixarComVigia.js';

/**
 * Quanto o cache local do aparelho (`FileSystem`) tem para dizer se tem o
 * arquivo (D-2055). A API de arquivos do Chrome responde em milissegundos; a
 * guarda existe porque um `getFile` que nunca chama nenhum dos dois retornos
 * deixaria o arquivo pendurado ANTES de a rede ser sequer tentada - o mesmo
 * "preso para sempre" do pedido de rede, uma camada acima. Passado o prazo, o
 * arquivo vai para a rede como se nao estivesse no cache.
 */
export const PRAZO_DO_CACHE_LOCAL_MS = 5000;

/** O relogio das medidas (o `performance.now` do worker, ou o de parede). */
function agoraMs() {
	return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
}

// Load dependencies
/* global process */
let fs = null;

const isElectron = typeof process !== 'undefined' && process.versions?.electron;

if (isElectron) {
	try {
		// eslint-disable-next-line
		const req = Function('return require')();
		fs = req('fs');
	} catch {
		//ignore error
	}
}

/**
 * Batch file loading - groups requests within a frame and sends them as one
 * Falls back to individual requests if batch endpoint is unavailable
 */
const _batchQueue = [];
let _batchTimer = null;

/**
 * FileManager namespace
 */
class FileManager {
	/**
	 * Where is the remote client located ?
	 * @var {string} http
	 */
	static remoteClient = '';

	/**
	 * List of Game Archives loads
	 * @var {array} GameFile[]
	 */
	static gameFiles = [];

	/**
	 * Files alias
	 * @var {object}
	 */
	static filesAlias = {};

	/**
	 * Initialize file manager with a list of files
	 *
	 * @param {mixed} grf list
	 */
	static init(grfList) {
		let content, files, result, regex;
		let i,
			count,
			sortBySize = true;
		let list = [];

		// load GRFs from a file (DATA.INI)
		if (typeof grfList === 'string') {
			if (fs) {
				content = fs.readFileSync(grfList);
			} else if ((files = FileSystem.search(grfList)).length) {
				content = new FileReaderSync().readAsText(files[0]);
			} else {
				grfList = /\.grf$/i;
			}

			if (content) {
				regex = /(\d+)=([^\s]+)/g;

				// Get a list of GRF
				while ((result = regex.exec(content))) {
					list[parseInt(result[1])] = result[2];
				}

				// Remove empty slot from list
				for (i = 0, count = list.length; i < count;) {
					if (list[i] === undefined) {
						list.splice(i, 1);
						count--;
						continue;
					}
					i++;
				}

				grfList = list;
				sortBySize = false;
			}
		}

		// Load grfs from a list defined by the user
		if (grfList instanceof Array) {
			list = grfList;
			for (i = 0, count = list.length; i < count; ++i) {
				if (fs && fs.existsSync(list[i])) {
					list[i] = {
						name: list[i],
						size: fs.statSync(list[i]).size,
						fd: fs.openSync(list[i], 'r')
					};
					continue;
				}
				list[i] = FileSystem.getFileSync(list[i]);
			}
		}

		// Search GRF from a regex
		if (grfList instanceof RegExp) {
			list = FileSystem.search(grfList);
		}

		if (sortBySize) {
			list.sort(function (a, b) {
				return a.size - b.size;
			});
		}

		// Load Game files
		for (i = 0, count = list.length; i < count; ++i) {
			FileManager.addGameFile(list[i]);
		}
	}

	/**
	 * Add a game archive to the list
	 *
	 * @param {File} file to load
	 */
	static addGameFile(file) {
		try {
			const grf = new GameFile();
			grf.load(file);

			FileManager.gameFiles.push(grf);

			if (FileManager.onGameFileLoaded) {
				FileManager.onGameFileLoaded(file.name);
			}
		} catch (e) {
			if (FileManager.onGameFileError) {
				FileManager.onGameFileError(file.name, e.message);
			}
		}
	}

	/**
	 * Clean up Game files
	 */
	static clean() {
		FileManager.gameFiles.length = 0;
	}

	/**
	 * Search a file in each GameFile
	 *
	 * @param {RegExp} regex
	 * @return {Array} filename list
	 */
	static search(regex) {
		// Use hosted client (only one to be async ?)
		if (!FileManager.gameFiles.length && FileManager.remoteClient) {
			const req = new XMLHttpRequest();
			req.open('POST', FileManager.remoteClient, false);
			req.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
			req.overrideMimeType('text/plain; charset=ISO-8859-1');
			req.send('filter=' + encodeURIComponent(regex.source));
			return req.responseText.split('\n');
		}

		return Array.from(new Set(FileManager.gameFiles.flatMap(file => file.table.data.match(regex) || [])));
	}

	/**
	 * Get a file
	 *
	 * @param {string} filename
	 * @param {function} callback - (buffer, erro, info); `info` diz de onde o
	 *   arquivo veio (`origem`), quantas novas tentativas e silencios houve e
	 *   quanto levou - a medida por fase do carregamento (D-2055) le daqui
	 * @param {object} [opcoes] - repassadas ao `getHTTP` (`aoReceber`,
	 *   `aoTentarDeNovo`, `sinal`)
	 */
	static get(filename, callback, opcoes) {
		// Trim the path
		filename = filename.replace(/^\s+|\s+$/g, '');
		const inicio = agoraMs();

		if (fs && fs.existsSync(filename)) {
			callback(fs.readFileSync(filename), undefined, {
				origem: 'disco',
				tentativas: 0,
				silencios: 0,
				bytes: 0,
				ms: 0
			});
			return;
		}

		// A guarda do cache local (D-2055): o primeiro retorno vence, e o
		// prazo conta como "nao achei".
		let respondeu = false;
		const naoAchou = () => {
			const path = filename.replace(/\//g, '\\');
			const fileList = FileManager.gameFiles;
			const count = fileList.length;

			for (let i = 0; i < count; ++i) {
				if (fileList[i].getFile(path, callback)) {
					return;
				}
			}

			// Not in GRFs ? Try to load it from
			// remote client host
			FileManager.getHTTP(filename, callback, opcoes);
		};
		const guarda = setTimeout(() => {
			if (respondeu) return;
			respondeu = true;
			naoAchou();
		}, PRAZO_DO_CACHE_LOCAL_MS);

		// Search in filesystem
		FileSystem.getFile(
			filename,

			// Found in file system, youhou !
			function onFound(file) {
				if (respondeu) return;
				respondeu = true;
				clearTimeout(guarda);
				const reader = new FileReader();
				reader.onloadend = function onLoad(event) {
					callback(event.target.result, undefined, {
						origem: 'cache-local',
						tentativas: 0,
						silencios: 0,
						bytes: 0,
						ms: agoraMs() - inicio
					});
				};
				reader.readAsArrayBuffer(file);
			},

			// Not found, fetching files
			function onNotFound() {
				if (respondeu) return;
				respondeu = true;
				clearTimeout(guarda);
				naoAchou();
			}
		);
	}

	/**
	 * Trying to load a file from the remote host
	 *
	 * @param {string} filename
	 * @param {function} callback - (buffer, erro, info)
	 * @param {object} [opcoes]
	 * @param {function(number, number):void} [opcoes.aoReceber] - bytes chegando (recebidos, total)
	 * @param {function(number):void} [opcoes.aoTentarDeNovo] - a nova tentativa numero N vai sair
	 * @param {AbortSignal} [opcoes.sinal] - cancela o pedido (a carga que foi refeita)
	 */
	static getHTTP(filename, callback, opcoes) {
		filename = filename.replace(/\\/g, '/');
		let url = filename.replace(/[^/]+/g, a => {
			return encodeURIComponent(a);
		});

		// Use http request here
		if (!FileManager.remoteClient) {
			url = '/client/' + url;
		} else {
			url = FileManager.remoteClient + url;
		}

		// Don't load mp3 sounds to avoid blocking the queue
		// They can be load by the HTML5 Audio
		if (filename.match(/\.(mp3|wav)$/)) {
			callback(url);
			return;
		}

		// Use Fetch API for better performance and HTTP/2 multiplexing support
		if (typeof fetch !== 'undefined') {
			/*
			 * A NOVA TENTATIVA (23/09/2026): falha PASSAGEIRA (rede, 408, 429,
			 * 5xx) tenta de novo antes de desistir - ver `tentativasDeArquivo.js`.
			 * Sem isto um soluco de rede no meio da troca de mapa virava
			 * "Can't find file" com o arquivo existindo no servidor.
			 *
			 * E O SILENCIO (D-2055, 06/10/2026): o pedido que nunca responde
			 * nao rejeitava nunca, e o arquivo ficava pendurado para sempre - a
			 * barra parada em 2%. `baixarComVigia` aborta o pedido calado e ele
			 * conta como rede caida (`status === null`), entrando na MESMA
			 * nova tentativa, com o mesmo recuo e o mesmo teto. A pagina HTML
			 * no lugar do binario continua contando como 404 (dentro dele).
			 */
			const inicio = agoraMs();
			let silencios = 0;
			const informar = (feitas, extra) =>
				Object.assign(
					{ origem: 'rede', tentativas: feitas, silencios, bytes: 0, ms: agoraMs() - inicio },
					extra
				);
			const tentar = feitas => {
				let status = null;
				// Quem ja recebeu o arquivo nao recebe de novo: um erro DENTRO do
				// `callback` tambem cai no `catch`, e sem esta marca ele viraria
				// "a rede falhou" e o arquivo seria entregue duas vezes.
				let entregue = false;
				baixarComVigia(url, {
					aoReceber: opcoes && opcoes.aoReceber,
					sinal: opcoes && opcoes.sinal
				})
					.then(resposta => {
						if (!resposta.ok) {
							status = resposta.status;
							throw new Error('HTTP ' + resposta.status);
						}
						entregue = true;
						callback(
							resposta.buffer,
							undefined,
							informar(feitas, {
								origem: resposta.doCacheHttp ? 'cache-http' : 'rede',
								bytes: resposta.bytes || 0
							})
						);
						FileSystem.saveFile(filename, resposta.buffer);
					})
					.catch(err => {
						if (entregue) {
							console.error('[FileManager] erro depois de entregar ' + filename, err);
							return;
						}
						if (err && err.cancelado) {
							callback(null, 'Pedido cancelado', informar(feitas, { cancelado: true }));
							return;
						}
						if (err && err.silencio) {
							silencios++;
						}
						if (devoTentarDeNovo(status, feitas)) {
							if (opcoes && opcoes.aoTentarDeNovo) {
								try {
									opcoes.aoTentarDeNovo(feitas + 1);
								} catch {
									/* avisar nao pode impedir a nova tentativa */
								}
							}
							setTimeout(() => tentar(feitas + 1), esperaAntesDaTentativa(feitas));
							return;
						}
						callback(null, "Can't get file", informar(feitas, { falhou: true }));
					});
			};
			tentar(0);
			return;
		}

		// Fallback to XMLHttpRequest for older environments
		const xhr = new XMLHttpRequest();
		xhr.open('GET', url, true);
		xhr.responseType = 'arraybuffer';
		xhr.onload = () => {
			if (xhr.status == 200) {
				callback(xhr.response);
				FileSystem.saveFile(filename, xhr.response);
			} else {
				callback(null, "Can't get file");
			}
		};
		xhr.onerror = () => {
			callback(null, "Can't get file");
		};

		// Can throw an error if not connected to internet
		try {
			xhr.send(null);
		} catch (_e) {
			callback(null, "Can't get file");
		}
	}

	static getBatchHTTP(filename, callback) {
		// Only batch when using remote client
		if (!FileManager.remoteClient) {
			FileManager.getHTTP(filename, callback);
			return;
		}

		_batchQueue.push({ filename: filename, callback: callback });

		if (!_batchTimer) {
			_batchTimer = setTimeout(() => {
				const queue = _batchQueue.splice(0);
				_batchTimer = null;

				// Single file - no need to batch
				if (queue.length === 1) {
					FileManager.getHTTP(queue[0].filename, queue[0].callback);
					return;
				}

				const files = queue.map(q => {
					return q.filename.replace(/\\/g, '/');
				});

				fetch(FileManager.remoteClient + 'batch', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ files: files })
				})
					.then(r => {
						return r.json();
					})
					.then(results => {
						queue.forEach(q => {
							const key = q.filename.replace(/\\/g, '/');
							if (results[key]) {
								const binary = atob(results[key]);
								const buffer = new ArrayBuffer(binary.length);
								const view = new Uint8Array(buffer);
								for (let i = 0; i < binary.length; i++) {
									view[i] = binary.charCodeAt(i);
								}
								q.callback(buffer);
								FileSystem.saveFile(q.filename, buffer);
							} else {
								q.callback(null, "Can't get file");
							}
						});
					})
					.catch(() => {
						// Fallback: load individually
						queue.forEach(q => {
							FileManager.getHTTP(q.filename, q.callback);
						});
					});
			}, 16); // Wait 1 frame (~16ms) to group requests
		}
	}

	/**
	 * Load a file
	 *
	 * @param {string} filename
	 * @param {function} callback - (resultado, erro, info) - ver `get`
	 * @param {object} [args] - argumentos do formato (vem do fio, clonavel)
	 * @param {object} [opcoes] - as do `getHTTP` (so dentro do worker: funcoes)
	 * @return {string|object}
	 */
	static load(filename, callback, args, opcoes) {
		if (!filename) {
			callback(null, 'undefined ?');
			return;
		}

		filename = filename.replace(/^\s+|\s+$/g, '');

		/*
		 * O ARQUIVO QUE VEIO E NAO ABRE (25/09/2026, relato do open beta: um
		 * jogador preso em "Can't find file pay_fild01.gnd", com o arquivo
		 * servido normalmente). Uma copia CORROMPIDA no cache local do aparelho
		 * e lida a cada tentativa e nunca abre - a nova tentativa de rede nem
		 * chega a acontecer. Quem veio com bytes e nao abriu tem a copia local
		 * APAGADA e e baixado de novo do servidor, uma vez so (`jaRefez`).
		 */
		const tratar = (buffer, error, jaRefez, info) => {
			const ext = filename
				.match(/.[^.]+$/)
				.toString()
				.substr(1)
				.toLowerCase();
			let result = null;

			if (!buffer || buffer.byteLength === 0) {
				callback(null, error, info);
				return;
			}

			error = null;

			try {
				switch (ext) {
					// Regular images files
					case 'jpg':
					case 'jpeg':
					case 'bmp':
					case 'gif':
					case 'png':
						result = URL.createObjectURL(new Blob([buffer], { type: 'image/' + ext }));
						break;

					// Audio
					case 'wav':
					case 'mp3':
					case 'ogg':
						// From GRF : change the data to an URI
						if (buffer instanceof ArrayBuffer) {
							result = URL.createObjectURL(new Blob([buffer], { type: 'audio/' + ext }));
							break;
						}
						result = buffer;
						break;

					case 'tga':
						result = buffer;
						break;

					// Texts
					case 'xml':
					case 'txt':
					case 'lua':
					case 'lub':
					case 'csv':
						result = new Uint8Array(buffer);
						break;

					// Sprite
					case 'spr': {
						const spr = new Sprite(buffer);
						if (args && args.to_rgba) {
							spr.switchToRGBA();
						}

						result = spr.compile();
						break;
					}
					// Binary
					case 'rsw':
						result = new World(buffer);
						break;

					case 'gnd':
						result = new Ground(buffer);
						break;

					case 'gat':
						result = new Altitude(buffer);
						break;

					case 'rsm':
					case 'rsm2':
						result = new Model(buffer);
						break;

					case 'act':
						result = new Action(buffer).compile();
						break;

					case 'str':
						result = new Str(buffer, args?.texturePath ?? '');
						break;

					default:
						result = buffer;
						break;
				}
			} catch (e) {
				error = e.message;
			}

			if (devoBaixarDeNovo({ tinhaBytes: true, abriu: error === null, jaRefez })) {
				FileSystem.removeFile(filename);
				FileManager.getHTTP(
					filename,
					(novo, erroNovo, infoNovo) => tratar(novo, erroNovo, true, infoNovo),
					opcoes
				);
				return;
			}

			callback(result, error, info);
		};
		FileManager.get(filename, (buffer, error, info) => tratar(buffer, error, false, info), opcoes);
	}
}
/**
 * Export
 */
export default FileManager;
