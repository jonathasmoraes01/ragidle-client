/**
 * A FILA DE EVENTOS TEM ORCAMENTO DE TEMPO (D-1481, 15/09/2026).
 *
 * ---------------------------------------------------------------------------
 * O QUE ESTE ARQUIVO PRENDE, E COMO ELE FOI ENCONTRADO
 * ---------------------------------------------------------------------------
 * `Events.process` rodava TODO evento vencido no mesmo quadro, sem teto. Em
 * caca automatica cada efeito de habilidade agenda o som dele por ali, entao
 * uma rajada de habilidades enfileira dezenas de callbacks que vencem juntos.
 *
 * A instrumentacao por fase mediu, no iPhone do dono:
 *
 *   pior 519 ms · JS 320 ms (**eventos 214** · desenho 106) · rede 11 ms
 *   · dano 1 ms · sprite 0 ms · FORA do JS 188 ms
 *
 * Vale registrar o que esse numero DERRUBOU: duas varreduras independentes
 * tinham apontado o numero de dano e a carga de sprite como suspeitos, e a
 * mesma medida os absolveu (1 ms e 0 ms). Consertar um deles era o caminho
 * obvio e teria custado o dia sem tirar uma travada.
 *
 * ---------------------------------------------------------------------------
 * OS DOIS CASOS QUE IMPORTAM SAO OS DE NAO-REGRESSAO
 * ---------------------------------------------------------------------------
 * Limitar uma fila e facil; limitar sem PERDER e sem TRAVAR e o que precisa de
 * portao. Por isso os casos centrais aqui nao sao "gastou menos que 8 ms" e sim
 * "todo evento acaba rodando" e "um callback lento nao prende a fila".
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { default: Events } = await import('Core/Events.js');

/** Faz `performance.now()` andar sob controle, em vez de depender da maquina. */
function relogioFalso() {
	let agora = 0;
	vi.spyOn(performance, 'now').mockImplementation(() => agora);
	return {
		avancar: ms => {
			agora += ms;
		}
	};
}

/*
 * O TIQUE DO JOGO CRESCE ENTRE OS CASOS, e isto nao e detalhe de arrumacao.
 *
 * `Events.free()` esvazia a lista mas NAO zera o `_tick` interno do modulo — e
 * nem deveria: em producao o tique vem do relogio e so anda para frente. Como
 * `setTimeout(cb, 0)` agenda para `_tick + 0`, um caso que reusasse um tique
 * MENOR que o do caso anterior agendaria no passado-relativo e o evento nunca
 * venceria.
 *
 * A primeira versao deste arquivo caiu exatamente nisso: o quarto caso passava
 * `process(10)` depois de o terceiro ter levado o tique a 29, e media "nada
 * rodou" como se fosse defeito do orcamento. Cada caso pega agora uma janela
 * propria, sempre a frente.
 */
let _proximoTique = 1_000_000;
function tiqueNovo() {
	_proximoTique += 1_000;
	return _proximoTique;
}

describe('a fila de eventos respeita um orcamento por quadro', () => {
	beforeEach(() => {
		Events.free();
		vi.restoreAllMocks();
	});

	it('CONTROLE: sem estourar o orcamento, TODOS rodam no mesmo quadro', () => {
		relogioFalso(); // o tempo nao anda: nada estoura
		const rodaram = [];
		for (let i = 0; i < 50; i++) {
			Events.setTimeout(() => rodaram.push(i), 0);
		}

		Events.process(tiqueNovo());

		expect(rodaram.length, 'sem custo, adiar seria pessimizar por nada').toBe(50);
	});

	it('com callbacks caros, o quadro PARA no orcamento em vez de rodar tudo', () => {
		const relogio = relogioFalso();
		const rodaram = [];
		for (let i = 0; i < 50; i++) {
			Events.setTimeout(() => {
				rodaram.push(i);
				relogio.avancar(3); // cada um custa 3 ms
			}, 0);
		}

		Events.process(tiqueNovo());

		// 8 ms de orcamento / 3 ms por evento: o 1o roda sempre, e o teto e
		// conferido ANTES de cada seguinte — para em 4 (0, 3, 6 e o que cruza).
		expect(rodaram.length).toBeGreaterThan(0);
		expect(rodaram.length, 'rodou o lote inteiro: o orcamento nao esta valendo').toBeLessThan(50);
	});

	it('O QUE SOBRA NAO SE PERDE: os quadros seguintes terminam a fila, EM ORDEM', () => {
		const relogio = relogioFalso();
		const rodaram = [];
		for (let i = 0; i < 50; i++) {
			Events.setTimeout(() => {
				rodaram.push(i);
				relogio.avancar(3);
			}, 0);
		}

		// Vinte quadros bastam de sobra para drenar 50 eventos a ~3 por quadro.
		const base = tiqueNovo();
		for (let quadro = 0; quadro < 20; quadro++) {
			Events.process(base + quadro);
		}

		expect(rodaram.length, 'evento adiado sumiu — isto seria pior que a travada').toBe(50);
		// A ORDEM importa: a lista e ordenada por `tick`, e adiar nao pode
		// embaralhar o que ja estava agendado.
		expect(rodaram).toEqual([...Array(50).keys()]);
	});

	it('UM callback mais caro que o orcamento inteiro ainda RODA — senao a fila trava para sempre', () => {
		const relogio = relogioFalso();
		const rodaram = [];
		// O primeiro sozinho estoura o teto de 8 ms.
		Events.setTimeout(() => {
			rodaram.push('caro');
			relogio.avancar(500);
		}, 0);
		Events.setTimeout(() => rodaram.push('depois'), 0);

		const base = tiqueNovo();
		Events.process(base);
		expect(rodaram, 'o caro precisa rodar, mesmo estourando').toEqual(['caro']);

		Events.process(base + 1);
		expect(rodaram, 'e o seguinte roda no quadro seguinte').toEqual(['caro', 'depois']);
	});

	it('evento que ainda NAO venceu continua esperando, orcamento ou nao', () => {
		relogioFalso();
		const rodaram = [];
		Events.setTimeout(() => rodaram.push('agora'), 0);
		Events.setTimeout(() => rodaram.push('depois'), 1000);

		Events.process(tiqueNovo());

		expect(rodaram).toEqual(['agora']);
	});
});
