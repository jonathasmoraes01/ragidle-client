/**
 * O REGISTRO DA CAÇADA (Hunt Analyzer).
 *
 * O que estes casos guardam não é "a soma soma" — é a lista de coisas que a
 * janela tem o direito de AFIRMAR. Um analisador é uma tela feita inteira de
 * números derivados, e o modo de falha dele não é quebrar: é mostrar um
 * número com toda a seriedade quando não havia amostra para calculá-lo.
 *
 * Três casos abaixo existem só por causa disso — o ritmo antes de haver
 * tempo medido, a taxa de item sem abate nenhum, e a estimativa de nível com
 * ritmo zero. Nos três a resposta certa é `null`, e a errada é um número.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
	MS_MINIMOS_PARA_RITMO,
	estimarMsAteONivel,
	ler,
	registrarAbate,
	registrarExp,
	registrarItem,
	zerar
} from 'UI/Components/HuntAnalyzer/registroDaCaca.js';

const EU = 2000001;
const OUTRO = 2000002;
const T0 = 1_000_000;

/** Um instante confortavelmente além da janela mínima de medida. */
const T_MEDIDO = T0 + MS_MINIMOS_PARA_RITMO;

beforeEach(() => {
	zerar();
});

describe('o relógio da medida', () => {
	it('começa no PRIMEIRO evento, e não no login', () => {
		// Nada aconteceu ainda: o retrato é vazio, mesmo com o tempo andando.
		expect(ler(EU, T0 + 60_000).decorridoMs).toBe(0);

		registrarAbate(EU, 'Poring', T0 + 60_000);

		// O decorrido conta do abate, não dos 60 s parado antes dele.
		expect(ler(EU, T0 + 70_000).decorridoMs).toBe(10_000);
	});

	it('experiência ZERO não inicia a janela de medida', () => {
		registrarExp(EU, 'base', 0, T0);
		expect(ler(EU, T0 + 60_000).decorridoMs).toBe(0);

		registrarExp(EU, 'base', 50, T0 + 60_000);
		expect(ler(EU, T0 + 70_000).decorridoMs).toBe(10_000);
	});

	it('conta há quanto tempo nada acontece', () => {
		registrarAbate(EU, 'Poring', T0);
		expect(ler(EU, T0 + 5_000).ociosoMs).toBe(5_000);
	});

	/*
	 * ESTE CASO NASCEU DE UM MUTANTE SOBREVIVENTE.
	 *
	 * Trocar `if (_inicio === null) { _inicio = agora; }` por `_inicio = agora`
	 * — ou seja, reiniciar a janela a cada evento em vez de fixá-la no
	 * primeiro — passava nos 16 casos anteriores. Todos eles tinham os eventos
	 * no MESMO instante, então "primeiro" e "último" coincidiam e a diferença
	 * era invisível.
	 *
	 * Com a janela reiniciando a cada abate, `decorridoMs` viraria o intervalo
	 * entre os dois últimos e o ritmo seria o ritmo instantâneo — que num idle
	 * oscila de 300/h a 20.000/h entre uma onda e outra.
	 */
	it('a janela abrange do PRIMEIRO ao agora, mesmo com eventos espalhados', () => {
		registrarAbate(EU, 'Poring', T0);
		registrarAbate(EU, 'Poring', T0 + 30_000);

		expect(ler(EU, T0 + 60_000).decorridoMs).toBe(60_000);
		// ...e o ocioso continua medindo a partir do ÚLTIMO: são coisas diferentes.
		expect(ler(EU, T0 + 60_000).ociosoMs).toBe(30_000);
	});
});

describe('o ritmo por hora', () => {
	it('é null enquanto a janela medida for curta demais', () => {
		registrarAbate(EU, 'Poring', T0);
		registrarExp(EU, 'base', 100, T0);

		const cedo = ler(EU, T0 + MS_MINIMOS_PARA_RITMO - 1);

		// O ponto do caso: 1 abate em 1 ms projetaria 3.600.000 abates/hora, e
		// a tela mostraria isso sem piscar.
		expect(cedo.abatesPorHora).toBeNull();
		expect(cedo.expBasePorHora).toBeNull();
		// ...mas o ACUMULADO é real desde o primeiro evento, e aparece.
		expect(cedo.abatesTotal).toBe(1);
		expect(cedo.expBase).toBe(100);
	});

	it('aparece assim que há janela, e a conta é a proporção', () => {
		registrarAbate(EU, 'Poring', T0);
		registrarAbate(EU, 'Lunatic', T0);
		registrarExp(EU, 'base', 300, T0);
		registrarExp(EU, 'classe', 100, T0);

		// 10 s medidos = 1/360 de hora. 2 abates -> 720/h; 300 exp -> 108.000/h.
		const r = ler(EU, T_MEDIDO);
		expect(r.abatesPorHora).toBeCloseTo(720, 6);
		expect(r.expBasePorHora).toBeCloseTo(108_000, 6);
		expect(r.expClassePorHora).toBeCloseTo(36_000, 6);
	});

	it('base e classe são somadas em trilhos separados', () => {
		registrarExp(EU, 'base', 500, T0);
		registrarExp(EU, 'classe', 7, T0);

		const r = ler(EU, T_MEDIDO);
		expect(r.expBase).toBe(500);
		expect(r.expClasse).toBe(7);
	});
});

describe('o ranking de monstro', () => {
	it('ordena do mais morto para o menos', () => {
		registrarAbate(EU, 'Lunatic', T0);
		registrarAbate(EU, 'Poring', T0);
		registrarAbate(EU, 'Poring', T0);
		registrarAbate(EU, 'Poring', T0);
		registrarAbate(EU, 'Fabre', T0);
		registrarAbate(EU, 'Fabre', T0);

		expect(ler(EU, T_MEDIDO).ranking).toEqual([
			{ nome: 'Poring', abates: 3 },
			{ nome: 'Fabre', abates: 2 },
			{ nome: 'Lunatic', abates: 1 }
		]);
	});

	it('mob sem nome vai para um balde EXPLÍCITO, e não some da contagem', () => {
		registrarAbate(EU, 'Poring', T0);
		registrarAbate(EU, '', T0);

		const r = ler(EU, T_MEDIDO);
		// O total continua honesto: 2 morreram, e o ranking diz onde foi o
		// segundo. Descartar o anônimo faria total e ranking divergirem.
		expect(r.abatesTotal).toBe(2);
		expect(r.ranking).toContainEqual({ nome: 'Nao identificado', abates: 1 });
	});
});

describe('os itens e a taxa observada', () => {
	it('soma por nome e ordena pela quantidade', () => {
		registrarItem(EU, 'Jellopy', 3, T0);
		registrarItem(EU, 'Poção Vermelha', 1, T0);
		registrarItem(EU, 'Jellopy', 2, T0);

		expect(ler(EU, T_MEDIDO).itens).toEqual([
			{ nome: 'Jellopy', quantidade: 5 },
			{ nome: 'Poção Vermelha', quantidade: 1 }
		]);
	});

	it('a taxa é null sem abate nenhum — dividir por zero não vira "0%"', () => {
		registrarItem(EU, 'Jellopy', 1, T0);
		expect(ler(EU, T_MEDIDO).itensPor100Abates).toBeNull();
	});

	it('a taxa é por 100 abates, para taxa pequena não virar "0,0"', () => {
		for (let i = 0; i < 200; i += 1) {
			registrarAbate(EU, 'Poring', T0);
		}
		registrarItem(EU, 'Card', 1, T0);

		// 1 em 200 = 0,5 por 100 abates. Por ABATE seria 0,005 e a tela
		// arredondaria para zero — a taxa de carta de D-215 é justamente 1%.
		expect(ler(EU, T_MEDIDO).itensPor100Abates).toBeCloseTo(0.5, 9);
	});

	it('quantidade não-positiva é ignorada', () => {
		registrarItem(EU, 'Jellopy', 0, T0);
		expect(ler(EU, T_MEDIDO).itensTotal).toBe(0);
	});
});

describe('a troca de personagem', () => {
	it('zera o registro — o ganho de um não pode virar o do outro', () => {
		registrarAbate(EU, 'Poring', T0);
		registrarExp(EU, 'base', 500, T0);
		expect(ler(EU, T_MEDIDO).abatesTotal).toBe(1);

		// Mesmo processo, outro GID: é a lição já registrada em
		// Engine/MapEngine/Main.js:206-210 para nível e zeny.
		registrarAbate(OUTRO, 'Fabre', T_MEDIDO);

		const doOutro = ler(OUTRO, T_MEDIDO + MS_MINIMOS_PARA_RITMO);
		expect(doOutro.abatesTotal).toBe(1);
		expect(doOutro.expBase).toBe(0);
	});

	it('ler com o GID errado devolve vazio, e não o registro alheio', () => {
		registrarAbate(EU, 'Poring', T0);
		expect(ler(OUTRO, T_MEDIDO).abatesTotal).toBe(0);
	});
});

describe('a estimativa de tempo até o nível', () => {
	it('converte o que falta no ritmo medido', () => {
		// Faltam 54.000 de exp a 108.000/h = meia hora.
		expect(estimarMsAteONivel(54_000, 108_000)).toBeCloseTo(1_800_000, 6);
	});

	it('é null quando não há resposta, em vez de Infinity ou de um número grande', () => {
		expect(estimarMsAteONivel(54_000, null)).toBeNull(); // ritmo ainda não medido
		expect(estimarMsAteONivel(54_000, 0)).toBeNull(); // parado: nunca chega
		expect(estimarMsAteONivel(0, 108_000)).toBeNull(); // o cliente não sabe o teto
	});
});
