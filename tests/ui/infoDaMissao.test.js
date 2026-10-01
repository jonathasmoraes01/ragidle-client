/**
 * O "(i)" DE UMA MISSÃO (01/10/2026, pedido do dono).
 *
 * *"adicionar um botão de (i) = tooltip na missão, para que o player quando
 * estiver caçando possa clicar e abrir as informações referente à missão que
 * ele clicou/está fazendo atualmente"*.
 *
 * O painel é um balão da HUD (como o seletor de nível da barra, D-1908): abre
 * no toque, o mesmo "(i)" fecha, um só por vez, toque fora fecha, e o ESC e o
 * voltar do Android fecham PRIMEIRO (`balaoDaHud.js`, perguntado pela pilha).
 * Este arquivo mede o CONTEÚDO (o que o jogador lê) e o COMPORTAMENTO, em
 * jsdom; a geometria no celular de verdade é foto da sessão principal.
 *
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* O celular em pé é decidido por `ehCelularEmPe()` — aqui, um interruptor. */
let _celular = false;
vi.mock('UI/hudVertical.js', () => ({ ehCelularEmPe: () => _celular }));

import {
	abrirInfoDaMissao,
	alternarInfoDaMissao,
	botaoDeInfoHtml,
	fecharInfoDaMissao,
	infoDaMissaoAberta,
	infoDaMissaoHtml,
	redesenharInfoDaMissao
} from '../../src/UI/Components/MissoesIdle/infoDaMissao.js';
import { _zerarBaloesDaHud, fecharBalaoDaHud, temBalaoAberto } from '../../src/UI/balaoDaHud.js';
import Pilha from '../../src/UI/pilhaDeJanelas.js';

const CACA = {
	id: 'matar-1002',
	descricao: 'Caçar 25 Poring',
	progresso: 12,
	alvo: 25,
	mapa: 'prt_fild08',
	mapaRotulo: 'Campos de Prontera 08'
};
const COLETA = {
	id: 'coletar-909',
	descricao: 'Trazer 3 Jellopy',
	progresso: 3,
	alvo: 3,
	itemId: 909,
	nomeDoItem: 'Jellopy',
	caiDe: { mapa: 'prt_fild08', rotulo: 'Campos de Prontera 08', monstros: ['Poring', 'Lunático'] },
	mapasOndeCai: 4
};

function missao(extra = {}) {
	return {
		id: 'primeiros-passos',
		tipo: 'principal',
		titulo: 'Primeiros Passos',
		descricao: 'Mostre que sabe se virar.',
		dificuldade: 'Fácil',
		estado: 'em-andamento',
		executavel: true,
		aceita: true,
		pronta: false,
		npc: 'Guarda de Prontera',
		objetivos: [CACA, COLETA],
		recompensas: [
			{ tipo: 'expBase', quantidade: 200, itemId: null, rotulo: '200 de EXP de base' },
			{ tipo: 'item', quantidade: 5, itemId: 501, rotulo: '5x Poção Vermelha' }
		],
		...extra
	};
}

const EXECUCAO = { aceitas: ['primeiros-passos'], maximo: 3 };

function desenhar(m, execucao = EXECUCAO, opcoes) {
	const div = document.createElement('div');
	div.innerHTML = infoDaMissaoHtml(m, execucao, opcoes);
	return div;
}

describe('o que o painel mostra', () => {
	it('título, dificuldade, de quem é a missão, o estado e a descrição', () => {
		const p = desenhar(missao());
		expect(p.querySelector('.im-titulo').textContent).toBe('Primeiros Passos');
		expect(p.querySelector('.im-dif').textContent).toBe('Fácil');
		expect(p.querySelector('.im-npc').textContent).toBe('Missão de Guarda de Prontera');
		expect(p.querySelector('.im-estado').textContent).toBe('Em andamento');
		expect(p.querySelector('.im-desc').textContent).toBe('Mostre que sabe se virar.');
	});

	it('cada objetivo com a barra e "progresso/alvo"', () => {
		const objetivos = desenhar(missao()).querySelectorAll('.im-objetivo');
		expect(objetivos).toHaveLength(2);
		expect(objetivos[0].querySelector('.im-objetivo-desc').textContent).toBe('Caçar 25 Poring');
		expect(objetivos[0].querySelector('.im-conta').textContent).toBe('12/25');
		expect(objetivos[0].querySelector('.im-barra-fill').style.width).toBe('48%');
		expect(objetivos[0].classList.contains('is-completo')).toBe(false);
		expect(objetivos[1].querySelector('.im-conta').textContent).toBe('3/3');
		expect(objetivos[1].classList.contains('is-completo')).toBe(true);
		expect(objetivos[1].querySelector('.im-barra-fill').style.width).toBe('100%');
	});

	it('"Onde" na caça (o `mapaRotulo`) e "Cai de" na coleta (quem solta, e onde)', () => {
		const objetivos = desenhar(missao()).querySelectorAll('.im-objetivo');
		expect(objetivos[0].querySelector('.im-onde').textContent).toBe('Onde: Campos de Prontera 08');
		expect(objetivos[1].querySelector('.im-onde').textContent).toBe(
			'Cai de: Poring, Lunático (Campos de Prontera 08)'
		);
	});

	it('o objetivo sem mapa nenhum não inventa um "Onde"', () => {
		const p = desenhar(missao({ objetivos: [{ descricao: 'Falar com o Guarda', progresso: 0, alvo: 1 }] }));
		expect(p.querySelector('.im-onde')).toBeNull();
	});

	it('as recompensas, pelo `rotulo` que o servidor monta', () => {
		const itens = [...desenhar(missao()).querySelectorAll('.im-recompensas li')].map(li => li.textContent);
		expect(itens).toEqual(['200 de EXP de base', '5x Poção Vermelha']);
	});

	it('os estados no vocabulário novo: pronta, disponível e bloqueada com o requisito', () => {
		expect(desenhar(missao({ pronta: true })).querySelector('.im-estado').textContent).toBe('Pronta para finalizar');
		expect(
			desenhar(missao({ aceita: false, estado: 'disponivel' }), { aceitas: [], maximo: 3 }).querySelector('.im-estado')
				.textContent
		).toBe('Disponível');
		expect(
			desenhar(missao({ aceita: false, estado: 'bloqueada', requisito: 'Alcance o nível 5' }), { aceitas: [], maximo: 3 })
				.querySelector('.im-estado').textContent
		).toBe('Bloqueada: Alcance o nível 5');
	});

	it('os botões espelham o cartão: Finalizar apagado, Ir caçar, Abandonar', () => {
		const p = desenhar(missao());
		const acoes = [...p.querySelectorAll('[data-im-acao]')].map(b => b.getAttribute('data-im-acao'));
		expect(acoes).toEqual(['fechar', 'finalizar', 'teleporte', 'abandonar']);
		expect(p.querySelector('[data-im-acao="finalizar"]').disabled).toBe(true);
	});

	it('pronta: Finalizar ACESO e em ouro, e sem "Ir caçar" (não há o que caçar)', () => {
		const p = desenhar(missao({ pronta: true }));
		const fin = p.querySelector('[data-im-acao="finalizar"]');
		expect(fin.disabled).toBe(false);
		expect(fin.classList.contains('ri-btn--ouro')).toBe(true);
		expect(p.querySelector('[data-im-acao="teleporte"]')).toBeNull();
	});

	it('a não aceita: "Iniciar", ou o teto apagado com três aceitas', () => {
		const livre = desenhar(missao({ aceita: false, estado: 'disponivel' }), { aceitas: ['x'], maximo: 3 });
		expect(livre.querySelector('[data-im-acao="iniciar"]')).not.toBeNull();

		const cheio = desenhar(missao({ aceita: false, estado: 'disponivel' }), { aceitas: ['x', 'y', 'z'], maximo: 3 });
		expect(cheio.querySelector('[data-im-acao="iniciar"]')).toBeNull();
		const teto = cheio.querySelector('.im-acao[disabled]');
		expect(teto.textContent).toBe('3 de 3 em andamento');
	});

	it('"Ver na janela de missões" só quando quem abriu oferece', () => {
		expect(desenhar(missao()).querySelector('[data-im-acao="ver"]')).toBeNull();
		expect(desenhar(missao(), EXECUCAO, { verNaJanela: true }).querySelector('[data-im-acao="ver"]').textContent).toBe(
			'Ver na janela de missões'
		);
	});

	it('o texto do servidor é escapado', () => {
		const p = desenhar(missao({ titulo: '<img src=x>', npc: '<b>x</b>' }));
		expect(p.innerHTML).not.toContain('<img');
		expect(p.querySelector('.im-titulo').textContent).toBe('<img src=x>');
	});

	it('o botão "(i)" leva o id e um nome que o leitor de tela lê', () => {
		const div = document.createElement('div');
		div.innerHTML = botaoDeInfoHtml({ id: 'a', titulo: 'Primeiros Passos' }, 'mt-info');
		const b = div.querySelector('button');
		expect(b.getAttribute('data-info')).toBe('a');
		expect(b.classList.contains('im-i')).toBe(true);
		expect(b.classList.contains('mt-info')).toBe(true);
		expect(b.getAttribute('aria-label')).toBe('Informações da missão Primeiros Passos');
	});
});

/* ═══════════════════════════════════════════════════════════════════════
   O COMPORTAMENTO
   ═══════════════════════════════════════════════════════════════════════ */

describe('abrir, alternar e fechar', () => {
	let conteiner;
	let host;
	let estado;
	let agidas;
	let vistas;

	function pedido(id = 'primeiros-passos', ancoraId = id) {
		return {
			id,
			conteiner,
			host,
			ancora: () => conteiner.querySelector(`[data-info="${ancoraId}"]`),
			dados: () => estado,
			agir: (acao, missaoId) => agidas.push([acao, missaoId]),
			verNaJanela: (missaoId, tipo) => vistas.push([missaoId, tipo])
		};
	}

	const painel = () => conteiner.querySelector('.im-painel');
	const aberto = () => !!(painel() && painel().classList.contains('is-aberto'));
	const ponteiro = alvo =>
		alvo.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true, composed: true }));

	beforeEach(() => {
		_celular = false;
		_zerarBaloesDaHud();
		document.body.innerHTML = '';
		host = document.createElement('div');
		conteiner = document.createElement('div');
		conteiner.innerHTML =
			botaoDeInfoHtml({ id: 'primeiros-passos', titulo: 'Primeiros Passos' }, 'mt-info') +
			botaoDeInfoHtml({ id: 'outra', titulo: 'Outra' }, 'mt-info');
		host.appendChild(conteiner);
		document.body.appendChild(host);
		const fora = document.createElement('div');
		fora.className = 'fora';
		document.body.appendChild(fora);
		estado = { missoes: [missao(), missao({ id: 'outra', titulo: 'Outra', aceita: false, estado: 'disponivel' })], execucao: EXECUCAO };
		agidas = [];
		vistas = [];
	});

	afterEach(() => {
		fecharInfoDaMissao();
		_zerarBaloesDaHud();
	});

	it('abre DENTRO do conteiner, marca o host e entra na lista do ESC', () => {
		expect(abrirInfoDaMissao(pedido())).toBe(true);
		expect(aberto()).toBe(true);
		expect(painel().parentElement).toBe(conteiner);
		expect(painel().getAttribute('role')).toBe('dialog');
		expect(host.dataset.infoDaMissao).toBe('aberta');
		expect(infoDaMissaoAberta()).toBe('primeiros-passos');
		expect(temBalaoAberto()).toBe(true);
	});

	it('o MESMO "(i)" de novo fecha (alternar), e o host volta ao plano dele', () => {
		expect(alternarInfoDaMissao(pedido())).toBe(true);
		expect(alternarInfoDaMissao(pedido())).toBe(false);
		expect(aberto()).toBe(false);
		expect(host.dataset.infoDaMissao).toBeUndefined();
		expect(temBalaoAberto()).toBe(false);
	});

	it('o "(i)" de OUTRA missão troca o conteúdo — um painel só', () => {
		alternarInfoDaMissao(pedido());
		alternarInfoDaMissao(pedido('outra'));
		expect(conteiner.querySelectorAll('.im-painel')).toHaveLength(1);
		expect(painel().querySelector('.im-titulo').textContent).toBe('Outra');
		expect(infoDaMissaoAberta()).toBe('outra');
	});

	it('toque FORA fecha; toque DENTRO não', () => {
		abrirInfoDaMissao(pedido());
		ponteiro(painel().querySelector('.im-corpo'));
		expect(aberto()).toBe(true);
		ponteiro(document.querySelector('.fora'));
		expect(aberto()).toBe(false);
	});

	it('o toque no MESMO "(i)" não fecha no `pointerdown` — quem fecha é o clique (senão ele reabriria)', () => {
		abrirInfoDaMissao(pedido());
		ponteiro(conteiner.querySelector('[data-info="primeiros-passos"]'));
		expect(aberto()).toBe(true);
		// E o "(i)" de outra missão é "fora": fecha, e o clique dele abre o dela.
		ponteiro(conteiner.querySelector('[data-info="outra"]'));
		expect(aberto()).toBe(false);
	});

	it('o ESC (a lista de balões) fecha, e devolve se fechou', () => {
		abrirInfoDaMissao(pedido());
		expect(fecharBalaoDaHud()).toBe(true);
		expect(aberto()).toBe(false);
		expect(fecharBalaoDaHud()).toBe(false);
	});

	it('a PILHA pergunta pelo balão antes das janelas: ESC/voltar com o painel aberto só o fecham', () => {
		abrirInfoDaMissao(pedido());
		expect(Pilha.aoEscapar(document)).toBe('desarmou');
		expect(aberto()).toBe(false);
		// Sem balão e sem janela, a pilha não tem o que fazer.
		expect(Pilha.aoEscapar(document)).toBe('nada');
	});

	it('o "×" fecha', () => {
		abrirInfoDaMissao(pedido());
		painel().querySelector('[data-im-acao="fechar"]').click();
		expect(aberto()).toBe(false);
	});

	it('um botão de ação manda a ação COM o id e fecha o painel', () => {
		estado.missoes[0] = missao({ pronta: true });
		abrirInfoDaMissao(pedido());
		painel().querySelector('[data-im-acao="finalizar"]').click();
		expect(agidas).toEqual([['finalizar', 'primeiros-passos']]);
		expect(aberto()).toBe(false);
	});

	it('o "Finalizar" apagado não manda nada', () => {
		abrirInfoDaMissao(pedido());
		painel().querySelector('[data-im-acao="finalizar"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(agidas).toEqual([]);
	});

	it('"Ver na janela de missões" entrega o id e o tipo a quem abriu', () => {
		abrirInfoDaMissao(pedido());
		painel().querySelector('[data-im-acao="ver"]').click();
		expect(vistas).toEqual([['primeiros-passos', 'principal']]);
		expect(aberto()).toBe(false);
	});

	it('o progresso que chega com o painel aberto aparece nele (redesenhar)', () => {
		abrirInfoDaMissao(pedido());
		expect(painel().querySelector('.im-conta').textContent).toBe('12/25');
		estado = { ...estado, missoes: [missao({ objetivos: [{ ...CACA, progresso: 20 }, COLETA] }), estado.missoes[1]] };
		redesenharInfoDaMissao();
		expect(painel().querySelector('.im-conta').textContent).toBe('20/25');
	});

	it('a missão que sai da lista FECHA o painel (ele não fala do que não existe)', () => {
		abrirInfoDaMissao(pedido());
		estado = { ...estado, missoes: [] };
		redesenharInfoDaMissao();
		expect(aberto()).toBe(false);
		expect(infoDaMissaoAberta()).toBeNull();
	});

	it('fechar com OUTRO conteiner não fecha o painel deste', () => {
		abrirInfoDaMissao(pedido());
		expect(fecharInfoDaMissao(document.createElement('div'))).toBe(false);
		expect(aberto()).toBe(true);
	});

	it('no celular em pé o painel ganha `is-celular` (a largura da tela vem do CSS)', () => {
		_celular = true;
		abrirInfoDaMissao(pedido());
		expect(painel().classList.contains('is-celular')).toBe(true);
		// No celular o JS escreve so o topo; a esquerda e a direita sao do CSS.
		expect(painel().style.left).toBe('');
		expect(painel().style.top).not.toBe('');
	});

	it('no computador ele é posicionado pelo JS, sem `is-celular`', () => {
		abrirInfoDaMissao(pedido());
		expect(painel().classList.contains('is-celular')).toBe(false);
		expect(painel().style.left).not.toBe('');
	});
});

/* ═══════════════════════════════════════════════════════════════════════
   O CSS (o que o jsdom não desenha, mas o fonte promete)
   ═══════════════════════════════════════════════════════════════════════ */

describe('o CSS do painel e do "(i)"', () => {
	const css = readFileSync('src/UI/Components/MissoesIdle/infoDaMissao.css', 'utf8').replace(/\r\n/g, '\n');
	const common = readFileSync('src/UI/Common.css', 'utf8').replace(/\r\n/g, '\n');
	const pilha = readFileSync('src/UI/pilhaDeJanelas.js', 'utf8');
	const tracker = readFileSync('src/UI/Components/MissoesTrackerIdle/MissoesTrackerIdle.js', 'utf8');
	const trackerCss = readFileSync('src/UI/Components/MissoesTrackerIdle/MissoesTrackerIdle.css', 'utf8').replace(/\r\n/g, '\n');
	const janela = readFileSync('src/UI/Components/MissoesIdle/MissoesIdle.js', 'utf8');

	it('o painel é FIXO e recebe toque (o host dos componentes é `pointer-events: none`)', () => {
		expect(css).toMatch(/\.im-painel \{[^}]*position: fixed;/);
		expect(css).toMatch(/\.im-painel \{[^}]*pointer-events: auto;/);
	});

	it('no celular em pé: a largura da tela com 16px de cada lado, e o corpo rola por dentro', () => {
		expect(css).toMatch(/\.im-painel\.is-celular \{[^}]*left: calc\(var\(--safe-esq, 0px\) \+ 16px\);[^}]*right: calc\(var\(--safe-dir, 0px\) \+ 16px\);/);
		expect(css).toMatch(/\.im-corpo \{[^}]*overflow-y: auto;/);
		expect(css).toMatch(/\.im-corpo \{[^}]*overflow-x: hidden;/);
	});

	it('no dedo: o "×" e os botões do painel chegam a 44px', () => {
		const coarse = css.slice(css.indexOf('@media (pointer: coarse)'));
		expect(coarse).toMatch(/\.im-fechar \{[^}]*width: var\(--hit-touch, 44px\);[^}]*height: var\(--hit-touch, 44px\);/);
		expect(coarse).toMatch(/\.im-acao,\s*\.im-ver \{[^}]*min-height: var\(--hit-touch, 44px\);/);
	});

	it('no dedo: o "(i)" ganha a área de 44px no bloco coarse do Common.css, e é posicionado', () => {
		const coarse = common.slice(common.indexOf('@media (pointer: coarse) {\n\t/* O "X" de toda janela'));
		expect(coarse).toMatch(/\.im-i::before \{\s*content: '';\s*position: absolute;\s*inset: -10px;/);
		expect(css).toMatch(/\.im-i \{[^}]*position: relative;/);
	});

	it('com o painel aberto, o cartão sobe acima da moldura da HUD (e abaixo das janelas)', () => {
		expect(common).toMatch(
			/#MissoesTrackerIdle\[data-info-da-missao\],\s*html\.ri-vertical #MissoesTrackerIdle\[data-info-da-missao\] \{\s*z-index: 58 !important;/
		);
	});

	it('a pilha pergunta pelos balões DEPOIS do seletor de nível e ANTES das janelas', () => {
		const escapar = pilha.slice(pilha.indexOf('export function aoEscapar('));
		const seletor = escapar.indexOf('fecharSeletorDeNivel()');
		const balao = escapar.indexOf('fecharBalaoDaHud()');
		const janelas = escapar.indexOf('temAberta()');
		expect(seletor).toBeGreaterThan(-1);
		expect(balao).toBeGreaterThan(seletor);
		expect(janelas).toBeGreaterThan(balao);
	});

	it('as duas telas somam a folha do painel à própria', () => {
		expect(tracker).toContain("cssText + '\\n' + infoCss");
		expect(janela).toContain("cssText + '\\n' + escolhaCss + '\\n' + infoCss");
	});

	it('o cartão NÃO cresce no celular: o corpo continua no teto de D-1483 e rola por dentro', () => {
		expect(trackerCss).toMatch(/\.ri-vertical \.mt-corpo \{[^}]*max-height: 22dvh;[^}]*overflow-y: auto;/);
	});

	it('o cartão não vira "janela" para o portão de limpeza (sem `is-open` no fonte)', () => {
		// `servidor/mapa/janela-idle-esquece-o-desenho.test.ts` chama de JANELA
		// todo componente cujo fonte contém `is-open`. O painel usa `is-aberto`.
		expect(tracker).not.toContain('is-open');
		expect(readFileSync('src/UI/Components/MissoesIdle/infoDaMissao.js', 'utf8')).not.toContain('is-open');
	});
});
