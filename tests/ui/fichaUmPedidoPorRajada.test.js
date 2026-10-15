/**
 * UM PEDIDO DE FICHA POR RAJADA DE STATUS (auditoria de desempenho de
 * 15/10/2026).
 *
 * Com a janela de Status aberta, cada `ZC_MSG_STATE_CHANGE` do proprio mandava
 * um `CZ_RAGIDLE_PEDIR_FICHA`. O juntador (`juntadorDaFicha.js`) e exercitado
 * de verdade com um quadro e um relogio de mentira; a costura no `StatusIdle`
 * e lida do fonte (o componente puxa meio cliente no import).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { criarJuntadorDaFicha, PRAZO_DO_VOO_MS } from '../../src/UI/Components/StatusIdle/juntadorDaFicha.js';

function montar({ aberta = true } = {}) {
	const quadro = [];
	const estado = { agora: 0, envios: 0, aberta };
	const juntador = criarJuntadorDaFicha({
		agendar: fn => quadro.push(fn),
		enviar: () => {
			if (!estado.aberta) return false;
			estado.envios++;
			return true;
		},
		agora: () => estado.agora
	});
	const proximoQuadro = () => {
		const fila = quadro.splice(0);
		for (const fn of fila) fn();
	};
	return { juntador, estado, proximoQuadro, quadro };
}

describe('o juntador da ficha', () => {
	it('dez mudancas no mesmo quadro: UM pedido, no quadro seguinte', () => {
		const { juntador, estado, proximoQuadro } = montar();
		for (let i = 0; i < 10; i++) juntador.pedir();
		expect(estado.envios).toBe(0);
		proximoQuadro();
		expect(estado.envios).toBe(1);
	});

	it('com um pedido em voo nao pede de novo; a mudanca do voo pede UMA vez quando a ficha chega', () => {
		const { juntador, estado, proximoQuadro } = montar();
		juntador.pedir();
		proximoQuadro();
		expect(estado.envios).toBe(1);
		for (let i = 0; i < 5; i++) {
			juntador.pedir();
			proximoQuadro();
		}
		expect(estado.envios).toBe(1);
		juntador.chegou();
		proximoQuadro();
		expect(estado.envios).toBe(2);
		// e sem mudanca no voo, a chegada nao pede nada
		juntador.chegou();
		proximoQuadro();
		expect(estado.envios).toBe(2);
	});

	it('a ficha que chega sem mudanca no voo nao gera pedido', () => {
		const { juntador, estado, proximoQuadro } = montar();
		juntador.pedir();
		proximoQuadro();
		juntador.chegou();
		proximoQuadro();
		expect(estado.envios).toBe(1);
	});

	it('o voo que nunca volta vence: depois do prazo a mudanca pede de novo', () => {
		const { juntador, estado, proximoQuadro } = montar();
		juntador.pedir();
		proximoQuadro();
		estado.agora = PRAZO_DO_VOO_MS - 1;
		juntador.pedir();
		proximoQuadro();
		expect(estado.envios).toBe(1);
		estado.agora = PRAZO_DO_VOO_MS;
		juntador.pedir();
		proximoQuadro();
		expect(estado.envios).toBe(2);
	});

	it('o pedido da abertura da janela tambem conta como voo', () => {
		const { juntador, estado, proximoQuadro } = montar();
		juntador.enviou();
		juntador.pedir();
		proximoQuadro();
		expect(estado.envios).toBe(0);
		juntador.chegou();
		proximoQuadro();
		expect(estado.envios).toBe(1);
	});

	it('a janela que fecha antes do quadro nao pede, e nao fica presa em voo', () => {
		const { juntador, estado, proximoQuadro } = montar();
		juntador.pedir();
		estado.aberta = false;
		proximoQuadro();
		expect(estado.envios).toBe(0);
		estado.aberta = true;
		juntador.pedir();
		proximoQuadro();
		expect(estado.envios).toBe(1);
	});

	it('a troca de personagem esquece o voo', () => {
		const { juntador, estado, proximoQuadro } = montar();
		juntador.pedir();
		proximoQuadro();
		juntador.esquecer();
		juntador.pedir();
		proximoQuadro();
		expect(estado.envios).toBe(2);
	});
});

describe('a costura no StatusIdle', () => {
	const fonte = readFileSync('src/UI/Components/StatusIdle/StatusIdle.js', 'utf8').replace(/\r\n/g, '\n');
	const corpo = inicio => {
		const i = fonte.indexOf(inicio);
		expect(i, inicio).toBeGreaterThan(-1);
		return fonte.slice(i, fonte.indexOf('\n}', i));
	};

	it('aoMudarStatus passa pelo juntador, e nao manda o pedido direto', () => {
		const c = corpo('StatusIdle.aoMudarStatus = function');
		expect(c).toContain('_juntadorDaFicha.pedir();');
		expect(c).not.toContain('requestFicha()');
	});

	it('todo pedido marca o voo, e toda ficha que chega o encerra', () => {
		expect(corpo('function requestFicha()')).toContain('_juntadorDaFicha.enviou();');
		const chegada = corpo('function onFichaReceived(pkt)');
		expect(chegada.indexOf('_juntadorDaFicha.chegou();')).toBeGreaterThan(-1);
		expect(chegada.indexOf('_juntadorDaFicha.chegou();')).toBeLessThan(chegada.indexOf('JSON.parse'));
	});

	it('a troca de personagem esquece o voo', () => {
		expect(corpo('StatusIdle.limparEstadoDoPersonagem = function')).toContain('_juntadorDaFicha.esquecer();');
	});
});
