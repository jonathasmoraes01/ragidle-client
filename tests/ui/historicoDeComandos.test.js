import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	comandosQueComecamCom,
	comecaComoComando,
	ehLinhaDeComando,
	guardarComando,
	lerComandosGravados,
	passoDaBusca,
	TETO_DO_HISTORICO_DE_COMANDOS,
} from 'UI/Components/ChatBox/historicoDeComandos.js';

describe('o historico so de comandos (a proposta 5 da tarefa 20)', () => {
	it('so @ e # com alguma coisa colada viram comando para guardar; fala e barra nao', () => {
		expect(ehLinhaDeComando('@item 501 10')).toBe(true);
		expect(ehLinhaDeComando('#heal Fulano')).toBe(true);
		expect(ehLinhaDeComando('  @who  ')).toBe(true);
		expect(ehLinhaDeComando('oi pessoal')).toBe(false);
		expect(ehLinhaDeComando('/sit')).toBe(false);
		expect(ehLinhaDeComando('@')).toBe(false);
		expect(ehLinhaDeComando('@ espaco')).toBe(false);
	});

	it('o gatilho das setas vale ate para o @ sozinho, e nao para o campo vazio nem para fala', () => {
		expect(comecaComoComando('@')).toBe(true);
		expect(comecaComoComando('#he')).toBe(true);
		expect(comecaComoComando('')).toBe(false);
		expect(comecaComoComando('ola @todos')).toBe(false);
	});

	it('guardar: sem repetida, o mais novo no fim, e o teto corta o mais velho', () => {
		expect(guardarComando(['@who', '@heal'], '@who')).toEqual(['@heal', '@who']);
		expect(guardarComando([], '  @item 501  ')).toEqual(['@item 501']);
		const cheia = Array.from({ length: TETO_DO_HISTORICO_DE_COMANDOS }, (_, i) => `@c${String(i)}`);
		const depois = guardarComando(cheia, '@novo');
		expect(depois).toHaveLength(TETO_DO_HISTORICO_DE_COMANDOS);
		expect(depois[0]).toBe('@c1');
		expect(depois.at(-1)).toBe('@novo');
	});

	it('o gravado e lido com desconfianca: so texto de comando, e no teto', () => {
		expect(lerComandosGravados(null)).toEqual([]);
		expect(lerComandosGravados({ a: 1 })).toEqual([]);
		expect(lerComandosGravados(['@who', 42, 'oi', ' #heal x '])).toEqual(['@who', '#heal x']);
		expect(lerComandosGravados(['@a', '@b', '@c'], 2)).toEqual(['@b', '@c']);
	});

	it('a busca pelo que ja foi digitado: do mais novo ao mais velho, sem o proprio prefixo', () => {
		const lista = ['@item 501 10', '@who', '@item 909 1', '@it'];
		expect(comandosQueComecamCom(lista, '@it')).toEqual(['@item 909 1', '@item 501 10']);
		expect(comandosQueComecamCom(lista, '#')).toEqual([]);
	});
});

describe('as setas na busca de comandos', () => {
	const lista = ['@who', '@item 501 10', '@heal'];

	it('para cima: do mais novo ao mais velho, e para no mais velho', () => {
		let p = passoDaBusca(null, '@', lista, 'cima');
		expect(p.texto).toBe('@heal');
		p = passoDaBusca(p.busca, p.texto, lista, 'cima');
		expect(p.texto).toBe('@item 501 10');
		p = passoDaBusca(p.busca, p.texto, lista, 'cima');
		expect(p.texto).toBe('@who');
		p = passoDaBusca(p.busca, p.texto, lista, 'cima');
		expect(p.texto).toBe('@who');
	});

	it('para baixo: volta pelo mesmo caminho e termina no que o jogador tinha escrito', () => {
		let p = passoDaBusca(null, '@', lista, 'cima');
		p = passoDaBusca(p.busca, p.texto, lista, 'cima');
		p = passoDaBusca(p.busca, p.texto, lista, 'baixo');
		expect(p.texto).toBe('@heal');
		p = passoDaBusca(p.busca, p.texto, lista, 'baixo');
		expect(p.texto).toBe('@');
	});

	it('mexer no texto recomeca a busca com o novo prefixo', () => {
		let p = passoDaBusca(null, '@', lista, 'cima');
		expect(p.texto).toBe('@heal');
		p = passoDaBusca(p.busca, '@it', lista, 'cima');
		expect(p.texto).toBe('@item 501 10');
		// So um comando comeca com @it: a seta para nele, e nao segue pela busca
		// antiga do @ — e para baixo volta ao @it, e nao ao @.
		p = passoDaBusca(p.busca, p.texto, lista, 'cima');
		expect(p.texto).toBe('@item 501 10');
		p = passoDaBusca(p.busca, p.texto, lista, 'baixo');
		expect(p.texto).toBe('@it');
	});

	it('CONTROLE: sem nada que comece assim, o campo fica como esta', () => {
		expect(passoDaBusca(null, '@zz', lista, 'cima').texto).toBe('@zz');
		expect(passoDaBusca(null, '@', [], 'cima').texto).toBe('@');
	});
});

describe('a costura com o chat', () => {
	/*
	 * A regra pura passar nao prova que o chat a usa. Estes casos leem o fonte
	 * e cobram a costura: o envio guarda SO comando e grava por personagem, a
	 * entrada no personagem le a lista, o "Restaurar padrao" apaga a chave E a
	 * lista em memoria, e as setas usam a busca quando o campo comeca com @ ou #
	 * — escrevendo TEXTO, e nao HTML, porque a linha agora volta do
	 * `localStorage`. Ler o fonte nao ve o que as setas FAZEM na tela: isso e
	 * pergunta de olho humano (a regra 5).
	 */
	const fonte = readFileSync('src/UI/Components/ChatBox/ChatBox.js', 'utf8');
	const vezes = (trecho) => fonte.split(trecho).length - 1;

	it('o envio guarda SO comando e grava por personagem; o "Restaurar padrao" apaga a chave', () => {
		expect(fonte).toContain('if (ehLinhaDeComando(trimmedText)) {');
		expect(fonte).toContain("gravarPreferencia('Comandos', _comandos)");
		expect(fonte).toMatch(/const SUFIXOS = \[[^\]]*'Comandos'/);
	});

	it('a lista e lida ao entrar no personagem, e o "Restaurar padrao" esvazia a da memoria', () => {
		expect(fonte).toContain("_comandos = lerComandosGravados(lerListaGravada('Comandos'));");
		// Sem esvaziar a memoria, o proximo comando regravaria a lista que o
		// jogador acabou de apagar.
		expect(fonte).toMatch(/_recolhido = \{ estado: 'aberto' \};\r?\n\t_comandos = \[\];/);
	});

	it('as setas usam a busca de comandos nas DUAS direcoes, e escrevem texto puro', () => {
		expect(fonte).toContain("passoDaBusca(_buscaDeComando, digitado, _comandos, 'cima')");
		expect(fonte).toContain("passoDaBusca(_buscaDeComando, digitado, _comandos, 'baixo')");
		// Contagens, e nao so presenca: cada seta tem o seu gatilho, o seu passo
		// guardado e a sua escrita — tirar o de uma deixaria o da outra, e a
		// presenca continuaria verdadeira.
		expect(vezes('if (comecaComoComando(digitado)) {')).toBe(2);
		expect(vezes('_buscaDeComando = passo.busca;')).toBe(2);
		expect(vezes('messageBox.textContent = passo.texto;')).toBe(2);
	});

	it('a busca recomeca ao entrar no personagem, ao enviar e ao restaurar', () => {
		// A declaracao e os tres recomecos.
		expect(vezes('_buscaDeComando = null;')).toBe(4);
	});
});
