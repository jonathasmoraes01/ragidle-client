import { describe, expect, it } from 'vitest';
import {
	ajudaSemONome,
	lerOQueCompletar,
	MAXIMO_DE_SUGESTOES_NA_TELA,
	sugestoesPara,
	textoCompletado,
} from 'UI/Components/ChatBox/autocompletarComandos.js';

const lista = [
	{ nome: 'go', ajuda: '@go <destino>' },
	{ nome: 'heal', ajuda: '@heal [hp] [sp]' },
	{ nome: 'item', ajuda: '@item <id|nome> [n]' },
	{ nome: 'item2', ajuda: '@item2 <id>' },
	{ nome: 'iteminfo', ajuda: '@iteminfo <id>' },
	{ nome: 'mais', ajuda: '@mais' },
	{ nome: 'refresh', ajuda: '@refresh' },
];

const nomes = (s) => s.itens.map((i) => i.nome);

describe('o que o campo tem para completar (a proposta 5 da tarefa 20)', () => {
	it('o @ ou o # e o comeco do nome — minusculo, como o servidor le', () => {
		expect(lerOQueCompletar('@it')).toEqual({ simbolo: '@', prefixo: 'it' });
		expect(lerOQueCompletar('#He')).toEqual({ simbolo: '#', prefixo: 'he' });
		expect(lerOQueCompletar('@')).toEqual({ simbolo: '@', prefixo: '' });
	});

	it('CONTROLE: fala, campo vazio, espaco antes e o nome ja terminado nao completam', () => {
		expect(lerOQueCompletar('ola')).toBeNull();
		expect(lerOQueCompletar('')).toBeNull();
		expect(lerOQueCompletar(' @it')).toBeNull();
		expect(lerOQueCompletar('@item 501')).toBeNull();
		expect(lerOQueCompletar(null)).toBeNull();
	});
});

describe('as sugestoes', () => {
	it('primeiro as que COMECAM com o digitado, depois as que o CONTEM', () => {
		expect(nomes(sugestoesPara('@it', lista))).toEqual(['item', 'item2', 'iteminfo']);
		expect(nomes(sugestoesPara('@i', lista))).toEqual(['item', 'item2', 'iteminfo', 'mais']);
		// A ordem das duas listas vence a ordem de chegada: o que CONTEM vem
		// depois mesmo quando chegou antes.
		expect(nomes(sugestoesPara('@i', [{ nome: 'mais' }, { nome: 'item' }]))).toEqual(['item', 'mais']);
	});

	it('o # completa com o #, e o @ com o @', () => {
		expect(sugestoesPara('#he', lista).simbolo).toBe('#');
		expect(sugestoesPara('@he', lista).simbolo).toBe('@');
	});

	it('cabe no teto da tela — e o @ sozinho mostra o comeco da lista', () => {
		const muitos = Array.from({ length: 20 }, (_, i) => ({ nome: `c${String(i).padStart(2, '0')}`, ajuda: '' }));
		const s = sugestoesPara('@', muitos);
		expect(s.itens).toHaveLength(MAXIMO_DE_SUGESTOES_NA_TELA);
		expect(s.itens[0].nome).toBe('c00');
	});

	it('CONTROLE: sem nada que case, sem lista, ou fora de comando, nada a mostrar', () => {
		expect(sugestoesPara('@zz', lista)).toBeNull();
		expect(sugestoesPara('@it', null)).toBeNull();
		expect(sugestoesPara('ola', lista)).toBeNull();
		expect(sugestoesPara('@item 501', lista)).toBeNull();
	});

	it('a lista do servidor e lida com desconfianca: item sem nome de texto nao entra', () => {
		expect(nomes(sugestoesPara('@', [{ nome: 42 }, null, { nome: 'go', ajuda: '' }]))).toEqual(['go']);
	});

	it('escolher completa o nome e deixa o espaco dos argumentos', () => {
		expect(textoCompletado('@', 'item')).toBe('@item ');
		expect(textoCompletado('#', 'heal')).toBe('#heal ');
	});
});

describe('a ajuda que a lista mostra — sem o nome repetido (a primeira foto do celular)', () => {
	it('tira o proprio comando do comeco, e fica a sintaxe e a descricao', () => {
		expect(ajudaSemONome('where', '@where — onde voce esta.')).toBe('onde voce esta.');
		expect(ajudaSemONome('whereis', '@whereis <monstro> — em que mapa ele vive.')).toBe(
			'<monstro> — em que mapa ele vive.'
		);
		expect(ajudaSemONome('go', '@go - para a cidade')).toBe('para a cidade');
	});

	it('so o nome INTEIRO sai: o @where nao come o comeco do @whereis', () => {
		expect(ajudaSemONome('where', '@whereis <monstro> — x')).toBe('@whereis <monstro> — x');
	});

	it('a ajuda que comeca com OUTRO comando fica inteira — a do apelido diz para onde ele leva', () => {
		expect(ajudaSemONome('warp', '@mapmove <mapa> <x> <y> — viaja.')).toBe('@mapmove <mapa> <x> <y> — viaja.');
		expect(ajudaSemONome('mais', '@item <id> — cria o item.')).toBe('@item <id> — cria o item.');
	});

	it('CONTROLE: a ajuda que nao chegou vira vazio', () => {
		expect(ajudaSemONome('go', undefined)).toBe('');
	});
});
