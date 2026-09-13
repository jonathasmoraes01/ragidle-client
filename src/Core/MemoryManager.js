/**
 * Core/MemoryManager.js
 *
 * Memory Manager
 *
 * Set up a cache context to avoid re-loading/parsing files each time, files are removed automatically if not used
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import MemoryItem from 'Core/MemoryItem.js';

/**
 * List of files in memory
 * @var List MemoryItem
 */
const _memory = {};

/**
 * Remove files from memory if not used until a period of time.
 * PHP servers: 30s is safe to avoid high memory usage on shared hosting.
 * Node.js (RemoteClient-JS): 120-300s recommended, heap is usually abundant.
 * @var {number}
 */
const _rememberTime = 30 * 1000; // 30s

/**
 * @var {number} last time we clean up variables
 */
let _lastCheckTick = 0;

/**
 * @var {number} perform the clean up every 10 secs
 */
const _cleanUpInterval = 10 * 1000;

/**
 * Async cleanup state tracking.
 * These variables are used to split memory cleanup into small chunks
 * to avoid blocking the main thread during large clean operations.
 */
let _cleaningInProgress = false; // Prevents multiple clean cycles running at the same time
let _cleanIndex = 0; // Tracks the current cleanup position
let _filesToClean = []; // List of memory entries scheduled for removal

/*
 * RAGIDLE (13/09/2026): O IPHONE NAO TEM `requestIdleCallback`.
 *
 * O Safari do iOS nao expoe a funcao em versao estavel nenhuma, e o Chrome do
 * iPhone e o mesmo WebKit. A chamada crua lancava `ReferenceError` logo depois
 * de `clean` ligar `_cleaningInProgress` — a trava nunca soltava, e a partir da
 * primeira limpeza NENHUM sprite, textura ou som era liberado ate a pagina
 * recarregar. Medido com o jogo de verdade: 0 limpezas sem a funcao, contra 4
 * limpezas e 583 arquivos no mesmo tempo com ela.
 *
 * Sem a funcao o passo roda num `setTimeout` com um orcamento fixo de 8 ms
 * (meio quadro de 60 fps) — o mesmo teto de 5 arquivos por passo continua
 * valendo. E a guarda do `catch` solta a trava se algo lancar no meio: sem ela,
 * qualquer excecao repetia o defeito por outro caminho.
 * Teste: `tests/util/memoriaSemIdleCallback.test.js`.
 */
const ORCAMENTO_SEM_IDLE_CALLBACK_MS = 8;

function _quandoOcioso(passo) {
	const rodar = deadline => {
		try {
			passo(deadline);
		} catch (e) {
			console.error('[MemoryManager] limpeza interrompida:', e);
			_cleaningInProgress = false;
			_filesToClean = [];
			_cleanIndex = 0;
		}
	};
	if (typeof requestIdleCallback === 'function') {
		requestIdleCallback(rodar);
		return;
	}
	setTimeout(() => {
		const inicio = Date.now();
		rodar({
			didTimeout: false,
			timeRemaining: () => Math.max(0, ORCAMENTO_SEM_IDLE_CALLBACK_MS - (Date.now() - inicio))
		});
	}, 1);
}

class MemoryManager {
	/**
	 * Get back data from memory
	 *
	 * @param {string} filename
	 * @param {function} onload - optional
	 * @param {function} onerror - optional
	 * @return mixed data
	 */
	static get = (filename, onload, onerror) => {
		// Not in memory yet, create slot
		if (!_memory[filename]) {
			_memory[filename] = new MemoryItem();
		}

		const item = _memory[filename];

		if (onload) {
			item.addEventListener('load', onload);
		}

		if (onerror) {
			item.addEventListener('error', onerror);
		}

		return item.data;
	};

	/**
	 * Check if the entry exists
	 *
	 * @param {string} filename
	 * @return boolean isInMemory
	 */
	static exist = filename => {
		return !!_memory[filename];
	};

	/**
	 * Stored data in memory
	 *
	 * @param {string} filename
	 * @param {string|object} data
	 * @param {string} error - optional
	 */
	static set = (filename, data, error) => {
		// Not in memory yet, create slot
		if (!_memory[filename]) {
			_memory[filename] = new MemoryItem();
		}

		if (error || !data) {
			_memory[filename].onerror(error);
		} else {
			_memory[filename].onload(data);
		}
	};

	/**
	 * Clean up not used data from memory
	 *
	 * @param {object} gl - WebGL Context
	 * @param {number} now - game tick
	 */
	static clean = (gl, now) => {
		// Skip cleanup if interval has not elapsed or if an async cleanup is already running
		if (_lastCheckTick + _cleanUpInterval > now || _cleaningInProgress) {
			return;
		}

		const files = [];
		_filesToClean = []; // Reset pending cleanup list

		const keys = Object.keys(_memory);
		const count = keys.length;
		const tick = now - _rememberTime;

		for (let i = 0; i < count; ++i) {
			const item = _memory[keys[i]];
			if (item.complete && item.lastTimeUsed < tick) {
				_filesToClean.push(keys[i]); // Collect unused memory entries instead of removing them immediately
			}
		}
		// If nothing needs to be cleaned, just update the last check timestamp
		if (_filesToClean.length === 0) {
			_lastCheckTick = now;
			return;
		}

		// Mark cleanup as running to avoid re-entry
		_cleaningInProgress = true;
		_cleanIndex = 0;

		// Perform cleanup incrementally during idle time to reduce frame drops
		_quandoOcioso(function cleanChunk(deadline) {
			let processed = 0;
			// Limit the number of removals per idle callback
			const maxProcess = Math.min(5, _filesToClean.length - _cleanIndex);

			while (_cleanIndex < _filesToClean.length && processed < maxProcess && deadline.timeRemaining() > 0) {
				// Um arquivo que falha ao sair (textura de um contexto ja perdido,
				// por exemplo) nao pode barrar os outros: sai da lista mesmo assim.
				try {
					MemoryManager.remove(gl, _filesToClean[_cleanIndex]);
				} catch (e) {
					console.error('[MemoryManager] falha ao liberar ' + _filesToClean[_cleanIndex], e);
					delete _memory[_filesToClean[_cleanIndex]];
				}
				files.push(_filesToClean[_cleanIndex]);
				_cleanIndex++;
				processed++;
			}

			if (_cleanIndex < _filesToClean.length) {
				// Continue cleanup in the next idle period
				_quandoOcioso(cleanChunk);
			} else {
				// Cleanup finished
				_cleaningInProgress = false;
				_lastCheckTick = now;
				_filesToClean = [];

				if (files.length) {
					console.log(
						'%c[MemoryManager] - Removed ' + files.length + ' unused elements from memory.',
						'color:#d35111',
						{ files }
					);
				}
			}
		});
	};

	/**
	 * Force immediate cleanup of memory entries matching an optional regex.
	 * Useful after bulk loading (e.g., DB.lazyInit) to free parsed file data.
	 *
	 * @param {object} gl - WebGL Context (can be null)
	 * @param {RegExp} [regex] - Optional pattern to match filenames. If omitted, all complete items are removed.
	 */
	static forceClean = async (gl, regex) => {
		const keys = Object.keys(_memory);
		const removed = [];

		keys.forEach(key => {
			const item = _memory[key];
			if (item.complete && (!regex || key.match(regex))) {
				MemoryManager.remove(gl, key);
				removed.push(key);
			}
		});

		if (removed.length) {
			console.log('%c[MemoryManager] - Removed ' + removed.length + ' elements from memory.', 'color:#d35111', {
				files: removed
			});
		}
	};

	/**
	 * Remove Item from memory
	 *
	 * @param {object} gl - WebGL Context
	 * @param {string} filename
	 */
	static remove = (gl, filename) => {
		// Not found or filename is undefined?
		if (!filename || !_memory[filename]) {
			return;
		}

		const file = MemoryManager.get(filename);
		let ext = '';
		let i, count;

		const matches = filename.match(/\.[^.]+$/);

		if (matches) {
			ext = matches.toString().toLowerCase();
		}

		// Free file
		if (file) {
			switch (ext) {
				// Delete GPU textures from sprites
				case '.spr':
					if (file.frames) {
						for (i = 0, count = file.frames.length; i < count; ++i) {
							if (file.frames[i].texture && gl != null && gl.isTexture(file.frames[i].texture)) {
								gl.deleteTexture(file.frames[i].texture);
							}
						}
					}
					if (file.texture && gl != null && gl.isTexture(file.texture)) {
						gl.deleteTexture(file.texture);
					}
					break;

				// Delete palette
				case '.pal':
					if (file.texture && gl != null && gl.isTexture(file.texture)) {
						gl.deleteTexture(file.texture);
					}
					break;

				// Delete GPU textures from STR effects
				case '.str':
					if (file.layers) {
						for (i = 0, count = file.layers.length; i < count; ++i) {
							if (file.layers[i].materials) {
								for (let j = 0, matCount = file.layers[i].materials.length; j < matCount; ++j) {
									if (
										file.layers[i].materials[j] &&
										gl != null &&
										gl.isTexture(file.layers[i].materials[j])
									) {
										gl.deleteTexture(file.layers[i].materials[j]);
									}
								}
							}
						}
					}
					break;

				// If file is a blob, remove it (wav, mp3, lua, lub, txt, ...)
				default:
					if (file.match && file.match(/^blob:/)) {
						URL.revokeObjectURL(file);
					}
					break;
			}
		}

		// Delete from memory
		delete _memory[filename];
	};

	/**
	 * Search files in memory based on a regex
	 *
	 * @param regex
	 * @return string[] filename
	 */
	static search = regex => {
		return Object.keys(_memory).filter(k => k.match(regex));
	};
}
/**
 * Export methods
 */
export default MemoryManager;
