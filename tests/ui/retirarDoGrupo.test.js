/**
 * O BOTAO "RETIRAR DO GRUPO" e a CONFIRMACAO de transferir/retirar (03/10/2026).
 *
 * Mesmo padrao de `transferirLideranca.test.js`: `GrupoIdle.js` nao monta em
 * jsdom, entao a costura e provada por leitura de fonte.
 *
 * O que este arquivo cobra:
 *   1. o X so existe para o LIDER, nunca na propria linha, e nao depende de
 *      online nem de mapa (o lider retira qualquer um);
 *   2. nenhum dos dois botoes manda pacote no clique — os dois passam por
 *      `pedirConfirmacao`, e o pacote so sai no `aoConfirmar`;
 *   3. o `aoConfirmar` RELE o estado (`membroAtual`) antes de mandar;
 *   4. o pacote de retirar e o NATIVO `CZ.REQ_EXPEL_GROUP_MEMBER`;
 *   5. a caixa existe no HTML e nao usa `window.confirm`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const pasta = join(process.cwd(), 'src/UI/Components/GrupoIdle');
const fonte = readFileSync(join(pasta, 'GrupoIdle.js'), 'utf8');
const html = readFileSync(join(pasta, 'GrupoIdle.html'), 'utf8');

function corpoDaFuncao(nome) {
	const inicio = fonte.indexOf('function ' + nome + '(');
	expect(inicio, `função ${nome} sumiu de GrupoIdle.js`).toBeGreaterThan(-1);
	const fim = fonte.indexOf('\n}', inicio);
	expect(fim, `não achei o fecho de ${nome}`).toBeGreaterThan(inicio);
	return fonte.slice(inicio, fim);
}

describe('o X só existe para o líder, e vale para qualquer membro', () => {
	it('botaoExpulsar sai vazio sem ser líder, ou na própria linha', () => {
		const corpo = corpoDaFuncao('botaoExpulsar');
		expect(corpo).toContain('if (!ctx.souLider || m.souEu)');
		expect(corpo).not.toContain('online');
		expect(corpo).not.toContain('disabled');
	});

	it('a linha do membro desenha o X e a lista religa o clique', () => {
		expect(corpoDaFuncao('linhaDeMembro')).toContain('botaoExpulsar(m, ctx)');
		expect(corpoDaFuncao('desenharMembros')).toContain('ligarBotoesDeExpulsar(lista)');
	});
});

describe('o pacote só sai depois do "Sim", com o estado relido', () => {
	for (const [nome, pacote] of [
		['ligarBotoesDeExpulsar', 'REQ_EXPEL_GROUP_MEMBER'],
		['ligarBotoesDeTransferir', 'CHANGE_GROUP_MASTER']
	]) {
		it(`${nome} manda ${pacote} só dentro do aoConfirmar, depois de membroAtual`, () => {
			const corpo = corpoDaFuncao(nome);
			const confirma = corpo.indexOf('pedirConfirmacao(');
			const dentro = corpo.indexOf('aoConfirmar:');
			const rele = corpo.indexOf('membroAtual(contaId)');
			const manda = corpo.indexOf('new PACKET.CZ.' + pacote + '()');
			expect(confirma).toBeGreaterThan(-1);
			expect(dentro).toBeGreaterThan(confirma);
			expect(rele).toBeGreaterThan(dentro);
			expect(manda).toBeGreaterThan(rele);
		});
	}

	it('membroAtual exige ser líder e acha o alvo pela conta', () => {
		const corpo = corpoDaFuncao('membroAtual');
		expect(corpo).toContain('!eu.souLider');
		expect(corpo).toContain('x.contaId === contaId && !x.souEu');
	});
});

describe('a caixa de confirmação', () => {
	it('existe no HTML, escondida, com Cancelar e Sim', () => {
		expect(html).toContain('<div class="gi-modal" hidden>');
		expect(html).toContain('gi-modal-nao');
		expect(html).toContain('gi-modal-sim');
	});

	it('não usa window.confirm', () => {
		expect(fonte).not.toContain('window.confirm(');
	});

	it('fechar a janela do grupo fecha a confirmação', () => {
		const inicio = fonte.indexOf('GrupoIdle.fechar = function fechar()');
		const corpo = fonte.slice(inicio, fonte.indexOf('\n};', inicio));
		expect(corpo).toContain('fecharConfirmacao()');
	});
});
