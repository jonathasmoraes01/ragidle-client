import { describe, expect, it } from 'vitest';
import {
	estadoVazio,
	fraseDaRecusa,
	lerEstadoDeTitulos
} from '../../src/UI/Components/StatusIdle/formatoDosTitulos.js';

// O exemplo da secao 4.3 do contrato (docs/CONTRATO-ALFA.md, servidor).
const EXEMPLO = {
	v: 1,
	titulos: {
		definicoes: [
			{ id: 90001, codigo: 'PIONEIRO', nome: 'Pioneiro' },
			{ id: 90002, codigo: 'CACADOR_DE_BUGS', nome: 'Caçador de Bugs' },
			{ id: 90003, codigo: 'VISIONARIO', nome: 'Visionário' },
			{ id: 90004, codigo: 'LENDA_DO_ALFA', nome: 'Lenda do Alfa' }
		],
		desbloqueados: [90001, 90004],
		equipado: 90004
	},
	auras: {
		definicoes: [{ codigo: 'AURA_DO_ALFA', nome: 'Aura do Alfa', efeitoDeChapeu: null }],
		desbloqueadas: ['AURA_DO_ALFA'],
		ativa: null
	},
	resultado: { acao: 'aura', ok: true }
};

describe('lerEstadoDeTitulos (0x0fb6)', () => {
	it('le o exemplo do contrato', () => {
		const e = lerEstadoDeTitulos(JSON.stringify(EXEMPLO));
		expect(e.definicoes).toHaveLength(4);
		expect(e.desbloqueados).toEqual([90001, 90004]);
		expect(e.equipado).toBe(90004);
		expect(e.auras).toEqual([{ codigo: 'AURA_DO_ALFA', nome: 'Aura do Alfa', efeitoDeChapeu: null }]);
		expect(e.aurasDesbloqueadas).toEqual(['AURA_DO_ALFA']);
		expect(e.auraAtiva).toBeNull();
		expect(e.resultado).toEqual({ acao: 'aura', ok: true, motivo: null });
	});

	it('corpo quebrado, versao desconhecida ou nao-objeto viram null (a tela fica como estava)', () => {
		expect(lerEstadoDeTitulos('{')).toBeNull();
		expect(lerEstadoDeTitulos('null')).toBeNull();
		expect(lerEstadoDeTitulos('[]')).toBeNull();
		expect(lerEstadoDeTitulos(JSON.stringify({ ...EXEMPLO, v: 2 }))).toBeNull();
	});

	it('nao inventa posse: desbloqueado sem definicao, duplicado ou lixo fica de fora', () => {
		const e = lerEstadoDeTitulos(
			JSON.stringify({
				v: 1,
				titulos: {
					definicoes: [{ id: 90001, nome: 'Pioneiro' }, { id: -1, nome: 'x' }, { id: 5, nome: '' }],
					desbloqueados: [90001, 90001, 90004, '90001', null],
					equipado: 'lixo'
				},
				auras: { definicoes: [], desbloqueadas: ['AURA_DO_ALFA'], ativa: 'AURA_DO_ALFA' }
			})
		);
		expect(e.definicoes.map(d => d.id)).toEqual([90001]);
		expect(e.desbloqueados).toEqual([90001]);
		expect(e.equipado).toBe(0);
		expect(e.aurasDesbloqueadas).toEqual([]);
		expect(e.auraAtiva).toBeNull();
	});

	it('efeitoDeChapeu numerico e preservado', () => {
		const corpo = structuredClone(EXEMPLO);
		corpo.auras.definicoes[0].efeitoDeChapeu = 42;
		expect(lerEstadoDeTitulos(JSON.stringify(corpo)).auras[0].efeitoDeChapeu).toBe(42);
	});

	it('frase da recusa', () => {
		expect(fraseDaRecusa(null)).toBe('');
		expect(fraseDaRecusa({ ok: true })).toBe('');
		expect(fraseDaRecusa({ ok: false, motivo: 'nao-possui' })).toBe('Sua conta não possui esta aura.');
		expect(fraseDaRecusa({ ok: false, motivo: 'outro' })).toBe('O servidor recusou o pedido.');
	});

	it('estado vazio nao tem titulo nem aura', () => {
		expect(estadoVazio()).toMatchObject({ desbloqueados: [], equipado: 0, auraAtiva: null });
	});
});
