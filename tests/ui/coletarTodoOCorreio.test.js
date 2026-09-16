/**
 * COLETAR TODOS OS ITENS — o pedido do dono (15/09/2026, D-1494).
 *
 * *"Adicione um botão para 'Coletar todos os itens' no correio. Melhore a
 * distribuição também e diminua a redundância."*
 *
 * A REGRA mora no servidor: `planejarColetaDeAnexos`
 * (`servidor/coleta-de-anexos.ts`, 26 testes e bateria de mutação própria) é
 * quem decide o que cabe, porque o peso ACUMULA ao longo do lote. O que se mede
 * aqui é a metade do cliente: a FRASE do relatório, e a COSTURA — que o botão
 * existe, que o verbo sai, e que a resposta não cai no chão.
 *
 * ── POR QUE A COSTURA VALE MAIS QUE A FRASE, NESTE CASO ───────────────────
 * O servidor já respondia `{ acao: 'coletar-todos', ... }` e a janela DESCARTAVA
 * em silêncio: o `hookPacket` era `if (relatorio.acao !== 'apagar-todas')
 * return`. Uma suíte que só testasse `fraseDaColeta` passaria 4/4 com a frase
 * nunca chegando à tela — que é a armadilha que este projeto chama de
 * "implementado e ligado não é alcançável".
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { fraseDaColeta } from '../../src/UI/Components/CorreioIdle/relatorioDoLote.js';

describe('a frase da coleta', () => {
	it('diz o que VEIO, no singular e no plural', () => {
		expect(fraseDaColeta({ coletadas: 3, zenyTotal: 0, mantidas: [] })).toBe(
			'Anexos de 3 mensagens coletados.'
		);
		expect(fraseDaColeta({ coletadas: 1, zenyTotal: 0, mantidas: [] })).toBe(
			'Anexo de 1 mensagem coletado.'
		);
	});

	it('nomeia o ZENY, porque o botão não o nomeia', () => {
		/*
		 * O rótulo é "Coletar todos os itens" (as palavras do dono) e a ação leva
		 * zeny junto. Dizer o total é o que separa "surpresa boa" de "não sei o
		 * que esse botão fez".
		 */
		expect(fraseDaColeta({ coletadas: 2, zenyTotal: 12500, mantidas: [] })).toBe(
			'Anexos de 2 mensagens coletados (12.500 zeny).'
		);
	});

	it('zero zeny NÃO vira ruído na frase', () => {
		// "(0 zeny)" apareceria em toda coleta que não tinha dinheiro nenhum, que
		// é a maioria delas.
		expect(fraseDaColeta({ coletadas: 1, zenyTotal: 0, mantidas: [] })).not.toContain('zeny');
	});

	it('diz o que NÃO COUBE, e por quê, nomeando as cartas', () => {
		expect(
			fraseDaColeta({
				coletadas: 2,
				zenyTotal: 0,
				mantidas: [
					{ id: 4, titulo: 'Kit de boas-vindas', motivo: 'peso' },
					{ id: 7, titulo: 'Recompensa da missão', motivo: 'peso' }
				]
			})
		).toBe(
			'Anexos de 2 mensagens coletados; 2 não couberam no peso: Kit de boas-vindas, Recompensa da missão.'
		);
	});

	it('o caso em que NADA veio ainda explica o porquê', () => {
		// O pior caso para o silêncio: o jogador clica, nada entra na mochila, e
		// sem frase ele conclui que o botão está quebrado — e clica de novo, para
		// sempre, porque as que ficam nunca saem.
		expect(
			fraseDaColeta({ coletadas: 0, zenyTotal: 0, mantidas: [{ id: 1, titulo: 'Kit', motivo: 'peso' }] })
		).toBe('Nenhum anexo coletado; 1 não coube no peso: Kit.');
	});

	it('relatório vazio não estoura', () => {
		expect(fraseDaColeta(null)).toBe('Nenhum anexo coletado.');
		expect(fraseDaColeta({})).toBe('Nenhum anexo coletado.');
	});

	it('a razão de FICAR é diferente da do apagar, e a frase separa as duas', () => {
		/*
		 * O contrato do pacote (`servidor/protocolo/pacotes-mapa.ts`) cravou os
		 * conjuntos disjuntos de propósito: `'zeny'|'itens'|'ambos'` no apagar,
		 * `'peso'` no coletar. Se um dia alguém fundir as duas funções numa só,
		 * este caso é o que reprova.
		 */
		const frase = fraseDaColeta({
			coletadas: 0,
			zenyTotal: 0,
			mantidas: [{ id: 1, titulo: 'Kit', motivo: 'peso' }]
		});
		expect(frase).toContain('no peso');
		expect(frase).not.toContain('anexo por retirar');
	});
});

/*
 * A COSTURA. Sem ela, a frase acima passaria com a janela nunca a chamando —
 * e sem botão nenhum na tela.
 */
describe('a janela tem o botão, manda o verbo e OUVE a resposta', () => {
	const raiz = join(process.cwd(), 'src/UI/Components/CorreioIdle');
	const js = readFileSync(join(raiz, 'CorreioIdle.js'), 'utf8');
	const html = readFileSync(join(raiz, 'CorreioIdle.html'), 'utf8');
	const css = readFileSync(join(raiz, 'CorreioIdle.css'), 'utf8');

	it('o botão está no rodapé da LISTA', () => {
		// A ação é sobre a caixa inteira; junto do "Coletar zeny/itens" da carta
		// aberta ela convidaria ao clique errado, como o "Apagar todas" já registra.
		expect(html).toContain('data-acao="coletar-todos"');
		const rodape = html.slice(html.indexOf('co-rodape'), html.indexOf('co-painel-dir'));
		expect(rodape).toContain('co-coletar-todos');
	});

	it('o `data-acao` tem `case` — atributo sem case deixa a ação inalcançável', () => {
		/*
		 * Já aconteceu neste projeto, e é o que o cabeçalho de `onClickAcao` avisa.
		 *
		 * A ÂNCORA É A FUNÇÃO, e não o `case`: há DOIS `switch` neste arquivo com
		 * os mesmos dois verbos — o do clique e o do relatório —, em ordens
		 * diferentes. Este caso já nasceu vermelho medindo o switch errado (o
		 * `slice` saiu ao contrário e deu string vazia), que é a armadilha da
		 * "janela fixa" na forma mais barata: vazio contém nada, então o
		 * `toContain` reprova — mas um `not.toContain` teria passado de graça.
		 */
		const despachante = js.slice(js.indexOf('function onClickAcao'), js.indexOf('function pedirColeta'));
		expect(despachante, 'a âncora não pegou o despachante de clique').toContain("btn.dataset.acao");
		const trecho = despachante.slice(despachante.indexOf("case 'coletar-todos'"));
		expect(trecho.slice(0, 120)).toContain('coletarTodos()');
	});

	it('o verbo vai no pacote NOSSO', () => {
		expect(js).toContain("acao: 'coletar-todos'");
		expect(js).toContain('PACKET.CZ.RAGIDLE_CORREIO_ACAO');
	});

	it('o relatório da coleta NÃO cai no chão', () => {
		/*
		 * O defeito que este caso prende, e que existiu de verdade: o `hookPacket`
		 * era `if (relatorio.acao !== 'apagar-todas') return`, então o servidor
		 * respondia e a janela descartava em silêncio.
		 */
		const hook = js.slice(js.indexOf('PACKET.ZC.RAGIDLE_CORREIO'), js.indexOf('this._host.style.top'));
		expect(hook).toContain("case 'coletar-todos'");
		expect(hook).toContain('fraseDaColeta(');
		// E a rota velha continua viva ao lado — as duas, e não uma no lugar da outra.
		expect(hook).toContain("case 'apagar-todas'");
		expect(hook).toContain('fraseDoRelatorio(');
	});

	it('o segundo clique não sai enquanto o lote está no ar', () => {
		// O segundo pedido chegaria com a caixa já esvaziada e voltaria "Nenhum
		// anexo coletado", que não descreve falha nenhuma (é a cicatriz de D-950,
		// no irmão avulso).
		const corpo = js.slice(js.indexOf('function coletarTodos'), js.indexOf('function sincronizarBotaoDaColeta'));
		/*
		 * A GUARDA, e não só a variável. Este caso já sobreviveu a um mutante que
		 * APAGAVA o `if` inteiro: o `toContain('_coletaDeLoteEmVoo')` continuava
		 * passando por causa do `_coletaDeLoteEmVoo = true` logo abaixo. Nomear a
		 * variável não prova que ela decide alguma coisa.
		 */
		expect(corpo, 'a guarda do segundo clique virou só uma menção à variável').toMatch(
			/if\s*\(\s*_coletaDeLoteEmVoo\s*\)\s*\{\s*return;/
		);
		// E quem rearma é a CHEGADA do relatório, não só o relógio.
		const hook = js.slice(js.indexOf('PACKET.ZC.RAGIDLE_CORREIO'), js.indexOf('this._host.style.top'));
		expect(hook).toContain('_coletaDeLoteEmVoo = false');
	});

	it('NÃO há confirmação, e isso é deliberado', () => {
		/*
		 * Este caso é o contrário dos outros: ele prende uma AUSÊNCIA. Coletar não
		 * destrói nada — o pior caso é o peso não caber, e aí a frase diz quais
		 * ficaram. Um gesto a mais tiraria a razão de existir do botão, que é
		 * tirar cliques de cima de quem tem 500 cartas. Quem quiser a confirmação
		 * um dia apaga este caso de propósito, e não por acidente.
		 */
		expect(html).not.toContain('data-acao="coletar-todos-sim"');
		expect(js).not.toContain('mostrarConfirmacaoDeColeta');
	});

	it('o botão ocupa a fila inteira do rodapé', () => {
		// Com TRÊS botões dividindo ~250px cada um fica com ~1/3, e o texto deste é
		// o mais longo. O `nowrap` herdado impede a quebra, e não o transbordo.
		const i = css.indexOf('.co-rodape > button.co-coletar-todos');
		expect(i, 'sumiu a regra da fila inteira').toBeGreaterThan(-1);
		expect(css.slice(i, css.indexOf('}', i))).toContain('1 0 100%');
	});
});
