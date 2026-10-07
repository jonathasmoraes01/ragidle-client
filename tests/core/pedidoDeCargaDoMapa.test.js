/**
 * O PEDIDO DE CARGA DO MAPA QUE QUALQUER VERSAO DO WORKER ENTENDE (07/10/2026).
 *
 * No deploy da D-2055 o fio principal novo mandou `{ filename, carga }` a um
 * `ThreadEventHandler.js` velho (nome fixo, sem o `?v=`), que faz
 * `map.load(msg.data)`: 8 relatos de `Can't find file "[object Object]"` no
 * /analytics. O principal voltou a mandar TEXTO, com o numero a parte.
 */
import { describe, expect, it, vi } from 'vitest';
import { pedidoDeCargaDoMapa } from 'Core/pedidoDeCargaDoMapa.js';

describe('o pedido de carga do mapa (worker novo)', () => {
	it('o texto com o numero no envelope: o MapRenderer de hoje', () => {
		expect(pedidoDeCargaDoMapa({ data: 'prontera.rsw', carga: 7 })).toEqual({ filename: 'prontera.rsw', carga: 7 });
	});

	it('o texto sozinho: o GrfViewer (sem numero de carga)', () => {
		expect(pedidoDeCargaDoMapa({ data: 'prontera.rsw' })).toEqual({ filename: 'prontera.rsw', carga: undefined });
	});

	it('o objeto da D-2055: uma aba aberta com o principal daquele deploy', () => {
		expect(pedidoDeCargaDoMapa({ data: { filename: 'prontera.rsw', carga: 3 } })).toEqual({
			filename: 'prontera.rsw',
			carga: 3
		});
	});

	it('numero que nao e numero nao vira numero', () => {
		expect(pedidoDeCargaDoMapa({ data: 'prontera.rsw', carga: '7' }).carga).toBeUndefined();
	});
});

describe('o envelope que o worker VELHO entende', () => {
	it('o Thread.send poe o extra no envelope sem tocar no data', async () => {
		vi.resetModules();
		const enviados = [];
		const Thread = (await import('Core/Thread.js')).default;
		// `delegate` e a porta de apontar o destino (o mesmo que o worker usa).
		Thread.delegate({ postMessage: (msg) => enviados.push(msg) }, '*');
		Thread.send('LOAD_MAP', 'prontera.rsw', undefined, { carga: 9 });
		const ultimo = enviados.at(-1);
		expect(ultimo, 'o Thread nao enviou nada: a montagem do teste nao liga o destino').toBeDefined();
		// O worker velho faz `map.load(msg.data)`: o data tem de continuar TEXTO.
		expect(ultimo.data).toBe('prontera.rsw');
		expect(ultimo.carga).toBe(9);
		expect(ultimo.type).toBe('LOAD_MAP');
	});
});
