import { describe, expect, it } from 'vitest';
import {
	PASSO_VERTICAL,
	formatarRelogioDoBuff,
	getStatusEnd,
	getStatusIconsPerColumn,
	getStatusLabel,
	isStatusActive,
	tempoDaDica
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

	it('...e a `1d18h` a partir de um dia (D-1376, o evento de EXP dura dias)', () => {
		// Sete dias em `H:MM:SS` seriam `168:00:00` — nove caracteres na faixa de 38px.
		const HORA = 3_600_000;
		expect(formatarRelogioDoBuff(42 * HORA)).toBe('1d18h');
		expect(formatarRelogioDoBuff(48 * HORA)).toBe('2d');
		expect(formatarRelogioDoBuff(168 * HORA)).toBe('7d');
		// A borda: um segundo a menos de um dia continua no formato de horas.
		expect(formatarRelogioDoBuff(24 * HORA - 1000)).toBe('23:59:59');
		expect(formatarRelogioDoBuff(24 * HORA)).toBe('1d');
		// E o `ceil` vale aqui tambem: 47h59m59s e alguns ms ja leem como 2 dias.
		expect(formatarRelogioDoBuff(48 * HORA - 1)).toBe('2d');
	});

	it('a dica escreve o tempo por extenso, com dia e hora, e sem o `ss` (D-1376)', () => {
		const HORA = 3_600_000;
		// O que a foto mostrava num evento de dois dias: `2878 minutoss 53 segundoss`.
		expect(tempoDaDica(48 * HORA - 67_000, 'minutos', 'segundos')).toBe('1 dia 23 horas');
		expect(tempoDaDica(48 * HORA, 'minutos', 'segundos')).toBe('2 dias');
		expect(tempoDaDica(2 * HORA + 5 * 60_000, 'minutos', 'segundos')).toBe('2 horas 5 minutos');
		expect(tempoDaDica(HORA, 'minuto', 'segundo')).toBe('1 hora');
		// Abaixo de uma hora, o formato de sempre — e o plural certo venha a
		// palavra da tabela no singular ou no plural.
		expect(tempoDaDica(17 * 60_000 + 13_000, 'minutos', 'segundos')).toBe('17 minutos 13 segundos');
		expect(tempoDaDica(17 * 60_000 + 13_000, 'minuto', 'segundo')).toBe('17 minutos 13 segundos');
		expect(tempoDaDica(61_000, 'minutos', 'segundos')).toBe('1 minuto 1 segundo');
		expect(tempoDaDica(9_999)).toBe('9 segundos');
		expect(tempoDaDica(0)).toBe('');
		expect(tempoDaDica(Infinity)).toBe('');
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
