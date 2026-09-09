/**
 * APAGAR TODAS AS MENSAGENS — o pedido do dono no alfa (07/09/2026).
 *
 * *"Adicione uma ação para excluir todas as mensagens, com confirmação antes da
 * exclusão. Preserve mensagens com recompensas ou anexos ainda não resgatados e
 * informe claramente quando alguma mensagem não puder ser apagada. Valide essa
 * proteção também no servidor."*
 *
 * A proteção mora no servidor (`servidor/caixa.ts`, `apagarTodas`, com bateria
 * de mutação própria). O que se mede aqui é a metade do cliente: a FRASE do
 * relatório — a peça que cumpre o "informe claramente".
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { fraseDoRelatorio } from '../../src/UI/Components/CorreioIdle/relatorioDoLote.js';

describe('a frase do relatório', () => {
	it('diz o que SAIU quando tudo saiu', () => {
		expect(fraseDoRelatorio({ apagadas: 3, mantidas: [] })).toBe('3 mensagens apagadas.');
		expect(fraseDoRelatorio({ apagadas: 1, mantidas: [] })).toBe('1 mensagem apagada.');
	});

	it('diz o que FICOU, e por quê, nomeando as cartas', () => {
		/*
		 * A metade que o pedido do dono nomeia. Uma frase que só dissesse
		 * "2 apagadas" deixaria o jogador achando que o botão falhou nas outras
		 * — e ele iria clicar de novo.
		 */
		expect(
			fraseDoRelatorio({
				apagadas: 2,
				mantidas: [
					{ id: 4, titulo: 'Kit de boas-vindas', motivo: 'zeny' },
					{ id: 7, titulo: 'Recompensa da missão', motivo: 'itens' }
				]
			})
		).toBe(
			'2 mensagens apagadas; 2 ficaram com anexo por retirar: Kit de boas-vindas, Recompensa da missão.'
		);
	});

	it('o caso em que NADA saiu ainda explica o porquê', () => {
		// O pior caso para o silêncio: o jogador clica, nada some, e sem frase
		// ele conclui que o botão está quebrado.
		expect(
			fraseDoRelatorio({ apagadas: 0, mantidas: [{ id: 1, titulo: 'Kit', motivo: 'ambos' }] })
		).toBe('Nenhuma mensagem apagada; 1 ficou com anexo por retirar: Kit.');
	});

	it('relatório vazio não estoura', () => {
		expect(fraseDoRelatorio(null)).toBe('Nenhuma mensagem apagada.');
		expect(fraseDoRelatorio({})).toBe('Nenhuma mensagem apagada.');
	});
});

/*
 * A COSTURA. Sem ela, a frase acima passaria com a janela nunca a chamando —
 * e sem botão nenhum na tela.
 */
describe('a janela tem o botão, a confirmação e o pacote', () => {
	const raiz = join(process.cwd(), 'src/UI/Components/CorreioIdle');
	const js = readFileSync(join(raiz, 'CorreioIdle.js'), 'utf8');
	const html = readFileSync(join(raiz, 'CorreioIdle.html'), 'utf8');

	it('o botão está no rodapé da LISTA, e não junto do apagar avulso', () => {
		// Pôr "Apagar todas" ao lado de "Apagar" convidaria ao clique errado.
		expect(html).toContain('data-acao="apagar-todas"');
		const rodape = html.slice(html.indexOf('co-rodape'), html.indexOf('co-painel-dir'));
		expect(rodape).toContain('co-apagar-todas');
	});

	it('há CONFIRMAÇÃO antes, com os dois botões', () => {
		expect(html).toContain('data-acao="apagar-todas-sim"');
		expect(html).toContain('data-acao="apagar-todas-nao"');
		// E o "sim" é o único caminho que manda o pacote.
		const trecho = js.slice(js.indexOf("case 'apagar-todas-sim'"), js.indexOf("case 'apagar-todas-nao'"));
		expect(trecho).toContain('apagarTodas()');
	});

	it('a confirmação diz o NÚMERO — "apagar todas?" sem número ninguém lê', () => {
		expect(js).toContain('co-confirma-todas-texto');
		expect(js).toContain('cartas().length');
	});

	it('o verbo vai no pacote NOSSO, e o relatório volta por ele', () => {
		expect(js).toContain("acao: 'apagar-todas'");
		expect(js).toContain('PACKET.CZ.RAGIDLE_CORREIO_ACAO');
		expect(js).toContain('PACKET.ZC.RAGIDLE_CORREIO');
	});
});
