/**
 * A OFERTA DE CLASSE BLOQUEADA GANHA UM BOTAO QUE LEVA A PROVA (21/09/2026).
 *
 * ---------------------------------------------------------------------------
 * O PEDIDO
 * ---------------------------------------------------------------------------
 * Dono, com print da janela de Missoes: *"em vez de colocar nas opcionais, a
 * gente vai colocar um botao ali, que a pessoa clica para ir fazer a quest, e
 * depois, na hora que ela completa a quest, libera o botao para ela clicar para
 * ir para o NPC."*
 *
 * **A SEGUNDA METADE JA EXISTIA**: quando a prova fecha, o servidor manda
 * `bloqueadaPor: null` e o "Ir ate o NPC" aparece sozinho. Este arquivo mede as
 * duas, porque medir so a nova deixaria passar um conserto que quebrasse a
 * velha — e as duas moram no MESMO ternario.
 *
 * O que faltava era a primeira: a linha *"Conclua antes a Prova de Vocacao: X"*
 * nomeava a missao e nao levava a lugar nenhum, e ate hoje a prova morava na
 * aba Opcionais, que o jogador nao tem motivo para abrir (ela virou
 * `tipo: 'principal'` no mesmo pedido, em `game/missoes-do-jogo.ts`, com portao
 * proprio em `game/prova-nao-cobra-base.test.ts`).
 *
 * ---------------------------------------------------------------------------
 * POR QUE O BOTAO NAO APARECE SEMPRE
 * ---------------------------------------------------------------------------
 * Ele so nasce quando a prova REALMENTE comeca — a mesma `podeIniciarMissao` do
 * botao "Iniciar" do cartao (I16: uma regra so, com teste que a executa). Um
 * botao que sempre aparecesse e respondesse "nao pode" seria pior que a frase
 * que ele substitui, e e por isso que os casos de silencio abaixo existem.
 *
 * E ele acha a prova pelo `bloqueadaPorId` que o servidor passou a mandar, e
 * nao pelo titulo: casar texto e a familia de defeito que este projeto passa o
 * dia consertando.
 *
 * ---------------------------------------------------------------------------
 * OS QUATRO `vi.mock` SAO OS DE `missoesConcluidasOcultas.test.js`
 * ---------------------------------------------------------------------------
 * Mesmo componente, mesma cadeia de imports: sem eles o modulo explode no
 * `getContext('2d')`, que devolve `null` no jsdom, ANTES de qualquer caso
 * rodar.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('Network/NetworkManager.js', () => ({
	default: { sendPacket: vi.fn(), hookPacket: vi.fn() }
}));
vi.mock('Renderer/Renderer.js', () => ({
	default: { render: vi.fn(), stop: vi.fn(), width: 1280, height: 720 }
}));
vi.mock('UI/UIManager.js', () => ({ default: { showErrorBox: vi.fn(), addComponent: c => c } }));
vi.mock('UI/Components/ChatBox/ChatBox.js', () => ({
	default: { addText: vi.fn(), TYPE: { ERROR: 1 }, FILTER: { PUBLIC_LOG: 1 } }
}));

const PROVA = {
	id: 'prova-arqueiro',
	tipo: 'principal',
	titulo: 'Prova de Vocacao: Arqueiro',
	estado: 'disponivel',
	executavel: true,
	cooldownS: 0
};

/** A oferta do Arqueiro, com a prova ainda por fazer. */
function ofertaBloqueada(extra = {}) {
	return {
		classe: 'Archer',
		nomePt: 'Arqueiro',
		cidade: 'Payon',
		mestre: 'Mestre Arqueiro',
		mapa: 'payon',
		resumo: 'Dano a distancia.',
		bloqueadaPor: 'Prova de Vocacao: Arqueiro',
		bloqueadaPorId: 'prova-arqueiro',
		...extra
	};
}

function trocaDeClasse(classes) {
	return {
		id: 'troca-de-classe',
		tipo: 'principal',
		titulo: 'Troca de Classe',
		descricao: 'Escolha um caminho.',
		estado: 'disponivel',
		cooldownS: 0,
		classes
	};
}

async function montar(missoes, execucao = {}) {
	const { default: html } = await import('UI/Components/MissoesIdle/MissoesIdle.html?raw');
	const { default: MissoesIdle } = await import('UI/Components/MissoesIdle/MissoesIdle.js');

	MissoesIdle._host = document.createElement('div');
	MissoesIdle._host.innerHTML = html;
	MissoesIdle._shadow = null;
	MissoesIdle.draggable = () => {};
	MissoesIdle.missoes = missoes;
	MissoesIdle.execucao = execucao;
	MissoesIdle.init();

	return MissoesIdle;
}

const botaoDaProva = ui => ui._host.querySelector('.mi-classe [data-executar="iniciar"]');
const botaoDoNpc = ui => ui._host.querySelector('.mi-classe [data-mapa]');
const textoDaLista = ui => ui._host.querySelector('.mi-body').textContent;

describe('a oferta bloqueada leva a pessoa ate a prova', () => {
	beforeEach(() => {
		localStorage.clear();
		vi.resetModules();
	});

	it('com a prova disponivel, aparece "Fazer a prova" com o id DELA', async () => {
		const ui = await montar([trocaDeClasse([ofertaBloqueada()]), PROVA]);

		const botao = botaoDaProva(ui);
		expect(botao, 'a oferta bloqueada continua sem botao — a pessoa le o nome da prova e nao tem para onde ir').not.toBeNull();
		expect(botao.textContent).toContain('Fazer a prova');
		// O id, e nao o titulo: e ele que vai no `{ acao: 'iniciar', id }`.
		expect(botao.dataset.id).toBe('prova-arqueiro');
	});

	it('CONTROLE: a frase que nomeia a prova continua la', async () => {
		// Sem isto, apagar a frase e por o botao passaria — e quem nao pode
		// comecar a prova ainda precisa LER qual e ela.
		const ui = await montar([trocaDeClasse([ofertaBloqueada()]), PROVA]);
		expect(textoDaLista(ui)).toContain('Conclua antes a Prova de Vocacao: Arqueiro');
	});

	it('a prova FORA da lista nao inventa botao', async () => {
		// Se um dia ela sair de Principais, a busca falha e o cartao volta a
		// mostrar so a frase: degrau seguro, e nao tela quebrada.
		const ui = await montar([trocaDeClasse([ofertaBloqueada()])]);
		expect(botaoDaProva(ui)).toBeNull();
		expect(textoDaLista(ui)).toContain('Conclua antes a');
	});

	it('a prova que NAO pode comecar nao vira botao', async () => {
		// Bloqueada por nivel, por exemplo. Um botao que responde "nao pode"
		// e pior que a frase que ele substituiria.
		const ui = await montar([
			trocaDeClasse([ofertaBloqueada()]),
			{ ...PROVA, estado: 'bloqueada' }
		]);
		expect(botaoDaProva(ui)).toBeNull();
	});

	it('a prova JA EM ANDAMENTO diz isso, em vez de oferecer comecar de novo', async () => {
		const ui = await montar([trocaDeClasse([ofertaBloqueada()]), PROVA], {
			ativaId: 'prova-arqueiro'
		});
		expect(botaoDaProva(ui)).toBeNull();
		expect(textoDaLista(ui)).toContain('Prova em andamento');
	});

	it('A SEGUNDA METADE: prova concluida libera o "Ir ate o NPC"', async () => {
		// `bloqueadaPor: null` e o que o servidor manda quando a prova fecha.
		// Este caso e o que impede um conserto da primeira metade de quebrar a
		// segunda — as duas moram no mesmo ternario.
		const ui = await montar([
			trocaDeClasse([ofertaBloqueada({ bloqueadaPor: null, bloqueadaPorId: null })])
		]);

		const npc = botaoDoNpc(ui);
		expect(npc, 'a prova fechou e o botao do Mestre nao apareceu').not.toBeNull();
		expect(npc.textContent).toContain('Ir até o NPC');
		expect(npc.dataset.mapa).toBe('payon');
		expect(botaoDaProva(ui), 'com a prova fechada nao ha prova a fazer').toBeNull();
	});
});
