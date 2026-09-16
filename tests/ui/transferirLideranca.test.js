/**
 * O BOTAO "TRANSFERIR LIDERANCA" na janela de Grupo (10/09/2026).
 *
 * O padrao deste arquivo e o de `vidaDosAliados.test.js`: `GrupoIdle.js` nao
 * e facil de montar em jsdom (GUIComponent, Client.loadFile, Network real),
 * entao a COSTURA e provada por leitura de fonte — a mesma tecnica que os
 * portoes do lado do servidor ja usam para closures grandes demais para
 * instanciar em teste de unidade.
 *
 * O que este arquivo cobra:
 *   1. o botao so existe para o LIDER, e nunca na PROPRIA linha do lider;
 *   2. ele nunca SOME por estar indisponivel — fica desabilitado com o
 *      motivo (a mesma UX do `.gi-teleportar` e dos cartoes de posto);
 *   3. as DUAS razoes de recusa (offline — D3; mapa diferente — D2) leem o
 *      payload que a janela ja tem, sem inventar uma terceira fonte;
 *   4. o pacote e o NATIVO `CZ.CHANGE_GROUP_MASTER` (o mesmo que
 *      `Engine/MapEngine/Group.js:onRequestChangeLeader` ja fala) — nao um
 *      verbo novo em `CZ_RAGIDLE_GRUPO_ACAO`;
 *   5. o listener e RELIGADO depois de todo `innerHTML` da lista de membros
 *      (o mesmo padrao de `.gi-assumir`/`desenharPostos`), e RELE o estado
 *      mais recente antes de mandar (D-984: "nao confie so no disabled").
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const fonte = readFileSync(
	join(process.cwd(), 'src/UI/Components/GrupoIdle/GrupoIdle.js'),
	'utf8'
);

/** O corpo de uma funcao, do cabecalho ate o fecho na coluna 0 (`\n}`). */
function corpoDaFuncao(nome) {
	const inicio = fonte.indexOf('function ' + nome + '(');
	expect(inicio, `função ${nome} sumiu de GrupoIdle.js`).toBeGreaterThan(-1);
	const fim = fonte.indexOf('\n}', inicio);
	expect(fim, `não achei o fecho de ${nome}`).toBeGreaterThan(inicio);
	return fonte.slice(inicio, fim);
}

describe('o botão só existe para quem manda, e nunca na própria linha', () => {
	it('botaoTransferir sai vazio sem ser líder, ou na linha de quem clicou', () => {
		const corpo = corpoDaFuncao('botaoTransferir');
		expect(corpo).toContain('if (!ctx.souLider || m.souEu)');
		expect(corpo).toContain("return '';");
	});

	it('o contexto vem do payload que a janela já tem — souLider de `eu`, mapa da PRÓPRIA linha', () => {
		const corpo = corpoDaFuncao('desenharMembros');
		expect(corpo).toContain('e.eu.souLider');
		// `meuMapa` sai de `grupo.membros` filtrando `souEu` — não de um campo
		// novo em `eu` (o topo do pacote não carrega mapa nenhum).
		expect(corpo).toContain('return x.souEu;');
		expect(corpo).toContain('meuMembro ? meuMembro.mapa : null');
	});
});

describe('desabilitado com o motivo — nunca escondido (D2/D3)', () => {
	const corpo = corpoDaFuncao('botaoTransferir');

	it('D3: offline recusa, com o nome de quem está ausente', () => {
		expect(corpo).toContain('const offline = !m.online;');
		expect(corpo).toContain("' esta offline agora.'");
	});

	it('D2: mapa diferente recusa, com a razão (mesma tranca do party.conf:64)', () => {
		expect(corpo).toContain('ctx.meuMapa !== null && m.mapa !== ctx.meuMapa');
		expect(corpo).toContain("'Precisa estar no mesmo mapa que '");
	});

	it('o botão RENDERIZA sempre que aparece — o `disabled` é atributo, nunca ausência do elemento', () => {
		expect(corpo).toContain('disabled aria-disabled="true"');
		expect(corpo).toContain('<button type="button" class="gi-transferir"');
	});
});

describe('o pacote é o NATIVO — reuso, não um verbo novo', () => {
	it('usa PACKET.CZ.CHANGE_GROUP_MASTER com .AID, a mesma dupla do Group.js', () => {
		const corpo = corpoDaFuncao('ligarBotoesDeTransferir');
		expect(corpo).toContain('new PACKET.CZ.CHANGE_GROUP_MASTER()');
		expect(corpo).toContain('pkt.AID = contaId;');
		expect(corpo).toContain('Network.sendPacket(pkt);');
	});

	it('CZ_RAGIDLE_GRUPO_ACAO não ganhou um verbo de transferência — o mandar() desta janela continua o de sempre', () => {
		// `mandar()` é o único ponto que monta RAGIDLE_GRUPO_ACAO nesta janela;
		// a transferência tem de ficar de fora dele, do mesmo jeito que
		// 'sair'/'dissolver' já ficam (painel-do-grupo.test.ts, lado servidor).
		const mandarFn = corpoDaFuncao('mandar');
		expect(mandarFn).not.toMatch(/transferir/i);
	});
});

describe('a costura: religar depois do innerHTML, e reler antes de mandar', () => {
	it('ligarBotoesDeTransferir roda DEPOIS do innerHTML da lista', () => {
		const corpo = corpoDaFuncao('desenharMembros');
		const posInner = corpo.indexOf('lista.innerHTML = grupo.membros');
		const posLigar = corpo.indexOf('ligarBotoesDeTransferir(lista);');
		expect(posInner, 'innerHTML da lista sumiu').toBeGreaterThan(-1);
		expect(posLigar, 'a religação sumiu — os cliques morreriam a cada empurrão').toBeGreaterThan(-1);
		expect(posInner).toBeLessThan(posLigar);
	});

	it('o clique RELÊ GrupoIdle.estado — não confia no `disabled` desenhado (D-984)', () => {
		const corpo = corpoDaFuncao('ligarBotoesDeTransferir');
		expect(corpo).toContain('const atual = GrupoIdle.estado;');
		expect(corpo).toContain('if (botao.disabled) {');
		expect(corpo).toContain("mostrarRecado(alvo.nome + ' esta offline agora.', true);");
	});
});
