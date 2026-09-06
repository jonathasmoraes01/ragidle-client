import { describe, expect, it } from 'vitest';
import {
	PASSO_VERTICAL,
	formatarRelogioDoBuff,
	getStatusEnd,
	getStatusIconsPerColumn,
	getStatusLabel,
	isStatusActive
} from '../../src/UI/Components/StatusIcons/statusTiming.js';

describe('tempo e estado dos buffs da HUD', () => {
	it('considera ativo o pacote EFST que nao possui campo state', () => {
		expect(isStatusActive(undefined)).toBe(true);
		expect(isStatusActive(null)).toBe(true);
	});

	it('respeita ativacao e remocao explicitas', () => {
		expect(isStatusActive(1)).toBe(true);
		expect(isStatusActive(0)).toBe(false);
	});

	it('mantem como permanentes buffs ativos sem duracao', () => {
		expect(getStatusEnd(1000, 0)).toBe(Infinity);
		expect(getStatusEnd(1000, undefined)).toBe(Infinity);
		expect(getStatusEnd(1000, 9999)).toBe(Infinity);
	});

	it('calcula o fim de buffs temporarios', () => {
		expect(getStatusEnd(1000, 30000)).toBe(31000);
	});

	it('distribui as colunas usando a posicao atual da HUD', () => {
		/*
		 * Os numeros cairam em 06/09/2026 porque a CELULA cresceu: o passo era
		 * o icone solto de 36px e passou a ser a moldura mais a faixa do
		 * relogio (54px). A conta e a mesma; o que mudou foi o que cabe.
		 */
		expect(PASSO_VERTICAL, 'a medida da celula mudou — reveja estes casos').toBe(54);
		expect(getStatusIconsPerColumn(768, 282)).toBe(8);
		expect(getStatusIconsPerColumn(768, 166)).toBe(10);
	});

	it('cabe SEMPRE pelo menos um, mesmo numa tela que nao comporta a celula', () => {
		// Sem o piso, uma janela baixa devolveria zero e a divisao por coluna
		// no `resetElementsPosition` viraria `Infinity` — a pilha inteira some.
		expect(getStatusIconsPerColumn(300, 282)).toBe(1);
		expect(getStatusIconsPerColumn(100, 282)).toBe(1);
	});

	it('escreve o relogio da celula como a print: `M:SS`', () => {
		// Os tres valores sao os da print do dono: 14:50, 3:10 e 0:11.
		expect(formatarRelogioDoBuff(890_000)).toBe('14:50');
		expect(formatarRelogioDoBuff(190_000)).toBe('3:10');
		expect(formatarRelogioDoBuff(11_000)).toBe('0:11');
	});

	it('...e passa a `H:MM:SS` depois de uma hora', () => {
		// Com `M:SS` puro, uma hora e dois minutos sairia como `62:00` — um
		// numero que o jogador le como sessenta e dois de alguma coisa.
		expect(formatarRelogioDoBuff(3_720_000)).toBe('1:02:00');
	});

	it('arredonda para CIMA — o ultimo segundo do buff nao aparece como zero', () => {
		/*
		 * Com `floor`, os ultimos 999 ms apareceriam como `0:00`, e um zero que
		 * ainda tem efeito le como defeito. O vazio so chega no fim de verdade.
		 */
		expect(formatarRelogioDoBuff(1)).toBe('0:01');
		expect(formatarRelogioDoBuff(1_500)).toBe('0:02');
	});

	it('nao escreve nada para o que nao expira nem para o que ja venceu', () => {
		// Buff de duracao infinita desce como 0/0 no fio; escrever `0:00` nele
		// seria numero inventado, e o CSS esconde a faixa vazia.
		expect(formatarRelogioDoBuff(Infinity)).toBe('');
		expect(formatarRelogioDoBuff(0)).toBe('');
		expect(formatarRelogioDoBuff(-1)).toBe('');
		expect(formatarRelogioDoBuff(undefined)).toBe('');
	});

	it('da nome legivel ao EFST que nao tem descricao do GRF', () => {
		expect(getStatusLabel({ INC_AGI: 12 }, 12)).toBe('Inc Agi');
		expect(getStatusLabel({}, 1400)).toBe('Status 1400');
	});
});
