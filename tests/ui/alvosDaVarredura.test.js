/**
 * A varredura de barras de rolagem olha SO o que mudou (13/09/2026). Ver
 * `src/UI/alvosDaVarredura.js`.
 *
 * Antes, cada mutacao num componente (uma linha nova no chat e uma) disparava
 * `getComputedStyle` em TODO no dele. O chat guarda ate 400 linhas por aba, e
 * o custo de cada linha nova crescia com o historico — o "fica mais lento com o
 * tempo" que a sonda de degradacao mediu no DOM do ChatBox.
 */
import { describe, expect, it } from 'vitest';
import { alvosDaVarredura } from 'UI/alvosDaVarredura.js';

function adicionou(pai, ...filhos) {
	for (const f of filhos) pai.appendChild(f);
	return { type: 'childList', target: pai, addedNodes: filhos, removedNodes: [] };
}

function trocouClasse(el) {
	return { type: 'attributes', attributeName: 'class', target: el, oldValue: '' };
}

function trocouEstilo(el, antes) {
	return { type: 'attributes', attributeName: 'style', target: el, oldValue: antes };
}

describe('alvosDaVarredura', () => {
	it('uma linha nova no chat varre SO a linha, e nao o chat inteiro', () => {
		const log = document.createElement('div');
		const linha = document.createElement('div');
		const r = alvosDaVarredura([adicionou(log, linha)]);
		expect(r.tudo).toBe(false);
		expect(r.alvos).toEqual([linha]);
	});

	it('texto solto nao e alvo — so elemento tem estilo', () => {
		const log = document.createElement('div');
		const r = alvosDaVarredura([adicionou(log, document.createTextNode('ola'))]);
		expect(r.alvos).toEqual([]);
	});

	it('troca de classe varre o elemento que trocou (e os filhos dele)', () => {
		const janela = document.createElement('div');
		const r = alvosDaVarredura([trocouClasse(janela)]);
		expect(r.alvos).toEqual([janela]);
	});

	it('janela que APARECEU e varrida; estilo que so mudou de cor, nao', () => {
		const janela = document.createElement('div');
		janela.style.display = 'block';
		expect(alvosDaVarredura([trocouEstilo(janela, 'display: none;')]).alvos).toEqual([janela]);
		expect(alvosDaVarredura([trocouEstilo(janela, 'color: red;')]).alvos).toEqual([]);
	});

	it('folha de estilo nova pode mudar qualquer no: a varredura volta a ser do componente inteiro', () => {
		const raiz = document.createElement('div');
		const r = alvosDaVarredura([adicionou(raiz, document.createElement('style'))]);
		expect(r.tudo).toBe(true);
	});

	it('alvo dentro de outro alvo nao e varrido duas vezes', () => {
		const janela = document.createElement('div');
		const filho = document.createElement('div');
		const r = alvosDaVarredura([adicionou(janela, filho), trocouClasse(janela)]);
		expect(r.alvos).toEqual([janela]);
	});

	it('o mesmo alvo em duas mutacoes aparece uma vez', () => {
		const janela = document.createElement('div');
		const r = alvosDaVarredura([trocouClasse(janela), trocouClasse(janela)]);
		expect(r.alvos).toEqual([janela]);
	});

	it('sem mutacao que importe, nada a varrer', () => {
		expect(alvosDaVarredura([])).toEqual({ tudo: false, alvos: [] });
	});
});

describe('muitos alvos de uma vez (F31, auditoria de 22/09/2026)', () => {
	it('acima do limite, a varredura e do componente inteiro — e nao n^2 comparacoes', async () => {
		const { alvosDaVarredura, LIMITE_DE_ALVOS } = await import('UI/alvosDaVarredura.js');
		const pai = document.createElement('div');
		const linhas = Array.from({ length: LIMITE_DE_ALVOS + 1 }, () => pai.appendChild(document.createElement('div')));
		const r = alvosDaVarredura([{ type: 'childList', addedNodes: linhas }]);
		expect(r.tudo).toBe(true);
	});

	it('no limite, ainda poda por alvo', async () => {
		const { alvosDaVarredura, LIMITE_DE_ALVOS } = await import('UI/alvosDaVarredura.js');
		const pai = document.createElement('div');
		const linhas = Array.from({ length: LIMITE_DE_ALVOS }, () => pai.appendChild(document.createElement('div')));
		const r = alvosDaVarredura([{ type: 'childList', addedNodes: linhas }]);
		expect(r.tudo).toBe(false);
		expect(r.alvos).toHaveLength(LIMITE_DE_ALVOS);
	});
});
