/**
 * Core/Events.js
 *
 * Client Manager
 * Manage client files, load GRFs, DATA.INI, extract files from GRFs, ...
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

/**
 * Quanto a fila pode gastar num quadro. Ver `process` para a razao do 8.
 * @const {number}
 */
const ORCAMENTO_DE_EVENTOS_MS = 8;

/**
 * @var {Array} events list
 */
const _events = [];

/**
 * @var {number} game tick (get from rendering loop)
 */
let _tick = 0;

/**
 * @var {number} unique id
 */
let _uid = 0;

/**
 * @Constructor
 */
class Events {
	/**
	 * Alias for setTimeout using the rendering loop getting
	 * bad performances.
	 *
	 * @param {function} callback
	 * @param {number} delay
	 * @return {?} event unique id
	 */
	static setTimeout(callback, delay) {
		let i, count;

		const tick = _tick + delay;
		const event = { callback: callback, tick: tick, uid: _uid++ };

		// Add it to the list, sorted by delay
		for (i = 0, count = _events.length; i < count; ++i) {
			if (tick < _events[i].tick) {
				_events.splice(i, 0, event);
				return event.uid;
			}
		}

		_events.push(event);
		return event.uid;
	}

	/**
	 * Alias for clearTimeout
	 * Remove an event pre-registered
	 *
	 * @param {?} event unique id
	 */
	static clearTimeout(uid) {
		let i;
		const count = _events.length;

		// Find the event and remove it
		for (i = 0; i < count; ++i) {
			if (_events[i].uid === uid) {
				_events.splice(i, 1);
				return;
			}
		}
	}

	/**
	 * Process at each rendering loop
	 *
	 * ---------------------------------------------------------------------------
	 * A FILA TEM ORCAMENTO DE TEMPO (D-1481, 15/09/2026)
	 * ---------------------------------------------------------------------------
	 * Relato do dono, no iPhone, em caca automatica: travadas de meio segundo,
	 * mais de uma por segundo. A instrumentacao por fase mediu o pior quadro e
	 * respondeu onde:
	 *
	 *   pior 519 ms · JS 320 ms (**eventos 214** · desenho 106) · rede 11 ms
	 *   · dano 1 ms · sprite 0 ms · FORA do JS 188 ms
	 *
	 * **214 ms AQUI, num quadro que deveria custar 16.** E os dois suspeitos que
	 * duas varreduras independentes tinham apontado foram absolvidos pela mesma
	 * medida: o numero de dano custou 1 ms e a carga de sprite nem aconteceu.
	 * Consertar qualquer um dos dois teria gasto o dia sem tirar uma travada.
	 *
	 * A causa estava na forma do laco: ele rodava TODO evento vencido, sem teto.
	 * Em caca automatica cada efeito de habilidade agenda o som dele por aqui
	 * (`Renderer/EffectManager.js`), entao uma rajada de habilidades enfileira
	 * dezenas de callbacks que vencem juntos e executam num quadro so. O dono
	 * observou a outra ponta do mesmo fato sem saber: *"quando eu desabilito a
	 * configuracao do som, nitidamente o FPS aumenta MUITO"*.
	 *
	 * ---------------------------------------------------------------------------
	 * POR QUE ADIAR E SEGURO, E POR QUE NADA SE PERDE
	 * ---------------------------------------------------------------------------
	 * O que sobra do orcamento **fica na fila**, na ordem, e roda no quadro
	 * seguinte — antes de qualquer evento novo, porque a lista e ordenada por
	 * `tick` e os atrasados tem o menor. Nao ha descarte e nao ha inanicao: um
	 * evento adiado so pode ser ultrapassado por outro ainda mais atrasado.
	 *
	 * O preco e um atraso de ate um quadro num lote grande — e ele ja existia,
	 * so que concentrado: hoje o lote inteiro atrasa o quadro em 214 ms, o que
	 * atrasa TODOS os eventos seguintes na mesma medida. Espalhar e o que
	 * devolve a cadencia.
	 *
	 * ---------------------------------------------------------------------------
	 * O ORCAMENTO E 8 ms, E O NUMERO TEM RAZAO
	 * ---------------------------------------------------------------------------
	 * Metade de um quadro de 60 fps (16,7 ms). Deixa a outra metade para o
	 * desenho, que no mesmo relato custou 106 ms no pior caso e precisa caber.
	 * Nao e 16 (comeria o quadro inteiro) nem 4 (espalharia demais um lote
	 * legitimo, como a carga de um mapa).
	 *
	 * **O PRIMEIRO EVENTO SEMPRE RODA**, mesmo estourando o orcamento: sem isso,
	 * um unico callback mais caro que 8 ms nunca executaria e a fila travaria
	 * para sempre atras dele. O teto limita quantos rodam por quadro, nunca SE
	 * um roda.
	 *
	 * @param {number} game tick
	 */
	static process(tick) {
		const comeco = performance.now();
		let rodou = 0;

		// Execute time out events.
		while (_events.length > 0) {
			if (_events[0].tick > tick) {
				break;
			}
			// O teto so vale a partir do SEGUNDO: ver o comentario acima.
			if (rodou > 0 && performance.now() - comeco >= ORCAMENTO_DE_EVENTOS_MS) {
				break;
			}

			_events.shift().callback();
			rodou++;
		}

		_tick = tick;
	}

	/**
	 * Delete events from memory
	 */
	static free() {
		_events.length = 0;
	}
}
/**
 * Export
 */
export default Events;
