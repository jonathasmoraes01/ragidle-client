import { describe, expect, it } from 'vitest';
import {
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
		expect(getStatusIconsPerColumn(768, 282)).toBe(13);
		expect(getStatusIconsPerColumn(768, 166)).toBe(16);
		expect(getStatusIconsPerColumn(300, 282)).toBe(1);
	});

	it('da nome legivel ao EFST que nao tem descricao do GRF', () => {
		expect(getStatusLabel({ INC_AGI: 12 }, 12)).toBe('Inc Agi');
		expect(getStatusLabel({}, 1400)).toBe('Status 1400');
	});
});
