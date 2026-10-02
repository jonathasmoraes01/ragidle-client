/**
 * RO SHOP - O USO DO TICKET NO INVENTARIO (02/10/2026). O servidor manda
 * `abrir-ticket` ao usar o item; o servico abre na hora, sem a loja, e o
 * pedido sai como `usar-ticket` preso a POSICAO do item.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { criarControlador } from 'UI/Components/RoShop/controladorDoRoShop.js';

const SRC = join(process.cwd(), 'src');
const HTML = readFileSync(join(SRC, 'UI/Components/RoShop/RoShop.html'), 'utf8');

function montar() {
	document.body.innerHTML = '';
	const raiz = document.createElement('div');
	raiz.innerHTML = HTML;
	document.body.appendChild(raiz);
	const enviados = [];
	let n = 0;
	const c = criarControlador({
		raiz,
		enviar: corpo => enviados.push(JSON.parse(JSON.stringify(corpo))),
		gerarChave: () => `chave-${++n}`,
		resolverIcone: (_id, _ok, falha) => falha(),
		agendar: () => 1,
		cancelar: () => {},
		aoSaldo: () => {}
	});
	const $ = sel => raiz.querySelector(sel);
	const clicar = sel => c.onClick({ target: $(sel) });
	return { c, enviados, $, clicar };
}

let t;
beforeEach(() => {
	t = montar();
});

describe('abrirTicket (a loja NUNCA foi aberta: estado ainda nulo)', () => {
	it('o reset abre a confirmacao do ITEM, com nome, sem "credito"', () => {
		t.c.abrirTicket({ tipo: 'abrir-ticket', servico: 'reset-de-skills', posicao: 4 }, { soTicket: true });
		const modal = t.$('.rs-modal--servico');
		expect(modal.hidden).toBe(false);
		expect(modal.textContent).toContain('Usar o item Reset de Skills');
		expect(modal.textContent).not.toContain('crédito');
		expect(t.$('.rs-modal--servico .rs-modal-titulo').textContent).toBe('Usar item');
	});

	it('"Usar agora" manda usar-ticket com a posicao e a chave', () => {
		t.c.abrirTicket({ tipo: 'abrir-ticket', servico: 'reset-de-status', posicao: 7 }, { soTicket: true });
		t.clicar('[data-rs="confirmar-servico"]');
		t.clicar('[data-rs="confirmar-servico"]');
		expect(t.enviados).toEqual([{ acao: 'usar-ticket', chave: 'chave-1', posicao: 7 }]);
	});

	it('troca de nome leva o nome normalizado em parametros e so acende valido', () => {
		t.c.abrirTicket({ tipo: 'abrir-ticket', servico: 'troca-de-nome', posicao: 2 }, { soTicket: true });
		const campo = t.$('[data-rs-campo="novoNome"]');
		expect(t.$('[data-rs="confirmar-servico"]').disabled).toBe(true);
		campo.value = '  NovoNome ';
		t.c.onInput({ target: campo });
		t.clicar('[data-rs="confirmar-servico"]');
		expect(t.enviados).toEqual([
			{ acao: 'usar-ticket', chave: 'chave-1', posicao: 2, parametros: { novoNome: 'NovoNome' } }
		]);
	});

	it('a resposta com a mesma chave vira sucesso e o ticket continua preso para o "Corrigir"', () => {
		t.c.abrirTicket({ tipo: 'abrir-ticket', servico: 'troca-de-nome', posicao: 2 }, { soTicket: true });
		const campo = t.$('[data-rs-campo="novoNome"]');
		campo.value = 'NomeRuim';
		t.c.onInput({ target: campo });
		t.clicar('[data-rs="confirmar-servico"]');
		t.c.receber({
			versao: 1,
			tipo: 'resultado',
			acao: 'usar-servico',
			ok: false,
			chave: 'chave-1',
			texto: 'Nome em uso.',
			parametrosRecusados: { novoNome: 'em-uso' }
		});
		expect(t.$('.rs-modal--servico').textContent).toContain('Nome em uso.');
		t.clicar('[data-rs="voltar-servico"]');
		const campo2 = t.$('[data-rs-campo="novoNome"]');
		campo2.value = 'OutroNome';
		t.c.onInput({ target: campo2 });
		t.clicar('[data-rs="confirmar-servico"]');
		expect(t.enviados[1]).toEqual({
			acao: 'usar-ticket',
			chave: 'chave-2',
			posicao: 2,
			parametros: { novoNome: 'OutroNome' }
		});
	});

	it('com o ITEM, nem a dica do nome nem o resultado falam em credito', () => {
		t.c.abrirTicket({ tipo: 'abrir-ticket', servico: 'troca-de-nome', posicao: 2 }, { soTicket: true });
		expect(t.$('.rs-modal--servico').textContent).toContain('não gasta o item');
		expect(t.$('.rs-modal--servico').textContent).not.toMatch(/crédito/);
		const campo = t.$('[data-rs-campo="novoNome"]');
		campo.value = 'NomeNovo';
		t.c.onInput({ target: campo });
		t.clicar('[data-rs="confirmar-servico"]');
		t.c.receber({
			versao: 1,
			tipo: 'resultado',
			acao: 'usar-servico',
			ok: true,
			chave: 'chave-1',
			texto: 'Nome trocado.',
			creditosRestantes: 0,
			requerRelog: true
		});
		expect(t.$('.rs-modal--servico').textContent).toContain('Nome trocado.');
		expect(t.$('.rs-modal--servico').textContent).not.toMatch(/crédito/);
	});

	it('fechar a caixa quando a janela nasceu so para o ticket pede para fechar a janela', () => {
		t.c.abrirTicket({ tipo: 'abrir-ticket', servico: 'reset-de-skills', posicao: 1 }, { soTicket: true });
		expect(t.clicar('[data-rs="fechar-servico"]')).toBe('fechar');
		expect(t.c.espiar().servico).toBeNull();
	});

	it('com a loja ja aberta, fechar a caixa NAO fecha a janela', () => {
		t.c.abrirTicket({ tipo: 'abrir-ticket', servico: 'reset-de-skills', posicao: 1 }, { soTicket: false });
		expect(t.clicar('[data-rs="fechar-servico"]')).not.toBe('fechar');
	});

	it('nao interrompe um pedido em voo', () => {
		t.c.abrirTicket({ tipo: 'abrir-ticket', servico: 'reset-de-skills', posicao: 1 }, { soTicket: true });
		t.clicar('[data-rs="confirmar-servico"]');
		t.c.abrirTicket({ tipo: 'abrir-ticket', servico: 'reset-de-status', posicao: 9 }, { soTicket: true });
		expect(t.c.espiar().servico.id).toBe('reset-de-skills');
	});

	it('a recusa item-invalido do servidor (com versao) aparece como aviso', () => {
		t.c.receber({
			versao: 1,
			tipo: 'resultado',
			acao: 'usar-servico',
			ok: false,
			motivo: 'item-invalido',
			chave: null,
			texto: 'Este item não está mais na sua mochila.'
		});
		expect(t.$('.rs-aviso').textContent).toContain('não está mais na sua mochila');
	});
});
