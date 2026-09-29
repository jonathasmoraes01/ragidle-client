/**
 * As regras sem DOM dos PERFIS da config idle (Fase V2, 29/09/2026): salvar,
 * carregar, excluir — e o motivo por trás de "Salvar atual como" desabilitado.
 * O servidor valida tudo de novo (`servidor/idle/config-idle.test.ts`); aqui
 * só a lógica de rascunho que a janela usa antes do Aplicar.
 */
import { describe, expect, it } from 'vitest';
import {
	TETO_DE_PERFIS,
	TAMANHO_MAXIMO_DO_NOME_DE_PERFIL,
	perfisDe,
	motivoParaNaoSalvar,
	salvarPerfilComo,
	carregarPerfil,
	excluirPerfil
} from '../../src/UI/Components/IdleConfig/perfisDaConfig.js';

const CONFIG_BASE = {
	cacaAutomatica: true,
	coletarItens: true,
	alvosDesabilitados: [1113],
	rotacao: [{ skillId: 'MG_FIREBOLT', nivelDeUso: 3 }],
	modoDeAtaque: 'skills-e-basico',
	descanso: { ligado: true },
	pocaoDeHp: { ligado: true },
	pocaoDeSp: { ligado: false },
	usarBuffsDeItem: false
};

describe('perfisDe: sempre um array', () => {
	it('config sem o campo devolve lista vazia (retrocompatibilidade)', () => {
		expect(perfisDe(CONFIG_BASE)).toEqual([]);
		expect(perfisDe(undefined)).toEqual([]);
		expect(perfisDe(null)).toEqual([]);
	});

	it('config com o campo devolve a própria lista', () => {
		const perfis = [{ nome: 'Farm', config: CONFIG_BASE }];
		expect(perfisDe({ ...CONFIG_BASE, perfis })).toBe(perfis);
	});
});

describe('motivoParaNaoSalvar', () => {
	it('nome vazio ou só espaço é recusado', () => {
		expect(motivoParaNaoSalvar([], '')).toMatch(/dê um nome/);
		expect(motivoParaNaoSalvar([], '   ')).toMatch(/dê um nome/);
	});

	it('nome dentro do teto de tamanho passa; acima é recusado', () => {
		const noTeto = 'x'.repeat(TAMANHO_MAXIMO_DO_NOME_DE_PERFIL);
		expect(motivoParaNaoSalvar([], noTeto)).toBeNull();
		const gigante = 'x'.repeat(TAMANHO_MAXIMO_DO_NOME_DE_PERFIL + 1);
		expect(motivoParaNaoSalvar([], gigante)).toMatch(/muito longo/);
	});

	it('caractere de controle no nome é recusado', () => {
		expect(motivoParaNaoSalvar([], 'Farm\u0007')).toMatch(/controle/);
	});

	it('nome NOVO no teto de 5 perfis é recusado', () => {
		const cinco = Array.from({ length: TETO_DE_PERFIS }, (_, i) => ({ nome: `P${i}`, config: CONFIG_BASE }));
		expect(motivoParaNaoSalvar(cinco, 'Sexto')).toMatch(/máximo de 5/);
	});

	it('sobrescrever um nome JÁ existente (sem diferenciar maiúscula) não conta contra o teto', () => {
		const cinco = Array.from({ length: TETO_DE_PERFIS }, (_, i) => ({ nome: `P${i}`, config: CONFIG_BASE }));
		expect(motivoParaNaoSalvar(cinco, 'p0')).toBeNull();
	});

	it('nome legítimo, lista não cheia: aceito', () => {
		expect(motivoParaNaoSalvar([{ nome: 'Farm', config: CONFIG_BASE }], 'Boss')).toBeNull();
	});
});

describe('salvarPerfilComo', () => {
	it('acrescenta um perfil novo sem tocar nos campos do rascunho', () => {
		const config = { ...CONFIG_BASE, perfis: [] };
		const salvo = salvarPerfilComo(config, 'Farm padrão');
		expect(salvo.perfis).toHaveLength(1);
		expect(salvo.perfis[0].nome).toBe('Farm padrão');
		expect(salvo.perfis[0].config).toEqual(CONFIG_BASE);
		expect(salvo.cacaAutomatica).toBe(true);
	});

	it('o nome digitado é aparado (trim) antes de salvar', () => {
		const salvo = salvarPerfilComo({ ...CONFIG_BASE, perfis: [] }, '  Farm  ');
		expect(salvo.perfis[0].nome).toBe('Farm');
	});

	it('o snapshot salvo NUNCA carrega o campo perfis (perfil não guarda perfil)', () => {
		const comPerfis = { ...CONFIG_BASE, perfis: [{ nome: 'Antigo', config: CONFIG_BASE }] };
		const salvo = salvarPerfilComo(comPerfis, 'Novo');
		const novaEntrada = salvo.perfis.find(p => p.nome === 'Novo');
		expect('perfis' in novaEntrada.config).toBe(false);
	});

	it('salvar com o MESMO nome (case-insensitive) SUBSTITUI, não duplica', () => {
		const config = { ...CONFIG_BASE, perfis: [{ nome: 'Farm', config: { ...CONFIG_BASE, coletarItens: true } }] };
		const editado = { ...config, coletarItens: false };
		const salvo = salvarPerfilComo(editado, 'farm');
		expect(salvo.perfis).toHaveLength(1);
		expect(salvo.perfis[0].nome).toBe('farm');
		expect(salvo.perfis[0].config.coletarItens).toBe(false);
	});

	it('recusado (nome inválido ou teto): devolve a MESMA referência, sem mudar nada', () => {
		const config = { ...CONFIG_BASE, perfis: [] };
		expect(salvarPerfilComo(config, '')).toBe(config);
		const cheio = { ...CONFIG_BASE, perfis: Array.from({ length: TETO_DE_PERFIS }, (_, i) => ({ nome: `P${i}`, config: CONFIG_BASE })) };
		expect(salvarPerfilComo(cheio, 'Sexto')).toBe(cheio);
	});
});

describe('carregarPerfil', () => {
	it('copia o config do perfil por cima do rascunho, preservando a lista de perfis', () => {
		const perfilDeAtaque = { ...CONFIG_BASE, cacaAutomatica: false, coletarItens: false };
		const perfis = [{ nome: 'Descanso', config: perfilDeAtaque }];
		const rascunho = { ...CONFIG_BASE, cacaAutomatica: true, perfis };
		const carregado = carregarPerfil(rascunho, 'Descanso');
		expect(carregado.cacaAutomatica).toBe(false);
		expect(carregado.coletarItens).toBe(false);
		// A LISTA de perfis salvos sobrevive — carregar um não apaga os outros.
		expect(carregado.perfis).toBe(perfis);
	});

	it('perfil inexistente devolve null — quem chama não aplica nada', () => {
		const rascunho = { ...CONFIG_BASE, perfis: [{ nome: 'Farm', config: CONFIG_BASE }] };
		expect(carregarPerfil(rascunho, 'Sumiu')).toBeNull();
	});

	it('o rascunho original não é mutado', () => {
		const perfil = { ...CONFIG_BASE, cacaAutomatica: false };
		const rascunho = { ...CONFIG_BASE, perfis: [{ nome: 'X', config: perfil }] };
		const antes = JSON.stringify(rascunho);
		carregarPerfil(rascunho, 'X');
		expect(JSON.stringify(rascunho)).toBe(antes);
	});
});

describe('excluirPerfil', () => {
	it('remove só o perfil pedido, pelo nome exato', () => {
		const perfis = [
			{ nome: 'Farm', config: CONFIG_BASE },
			{ nome: 'farm', config: CONFIG_BASE },
			{ nome: 'Boss', config: CONFIG_BASE }
		];
		const depois = excluirPerfil({ ...CONFIG_BASE, perfis }, 'Farm');
		expect(depois.perfis.map(p => p.nome)).toEqual(['farm', 'Boss']);
	});

	it('nome que não existe não quebra nada', () => {
		const perfis = [{ nome: 'Farm', config: CONFIG_BASE }];
		const depois = excluirPerfil({ ...CONFIG_BASE, perfis }, 'Sumiu');
		expect(depois.perfis).toEqual(perfis);
	});
});
