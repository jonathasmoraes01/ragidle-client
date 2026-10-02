/**
 * O NIVEL DE USO ESCOLHIDO (D-1906/D-1908) — as regras sem DOM que a
 * Configuracao idle, a janela de Habilidades e a barra de atalhos dividem.
 *
 * Pedido do dono: *"preciso que seja possivel alterar o nivel da habilidade
 * ativa que sera usada, seja na barra (manual) ou no automatico (...) tem
 * players que preferem utilizar habilidades num nivel abaixo porque consome
 * menos SP"*.
 *
 * As perguntas que valem daqui a um mes:
 *
 * 1. A janela desenha o MESMO nivel que o servidor conjura? (`nivelEfetivoDaEntrada`
 *    espelha `nivelDeUsoDaEntrada`, `servidor/idle/nivel-da-rotacao.ts`.)
 * 2. Baixar do maximo FIXA e tira a marca `automatica`; voltar ao maximo
 *    DESFAZ o fixo — "maximo" e "acompanhar" sao a mesma escolha.
 * 3. O seletor desenhado apaga o "−" no 1 e o "+" no maximo, menos quando a
 *    entrada esta fixa (o "+" e o caminho de volta a acompanhar).
 * 4. O ESC/voltar fecha o seletor da barra antes de qualquer janela.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
	ajusteDaCuraComNivel,
	dicaDoAtalho,
	entradaComNivel,
	fecharSeletorDeNivel,
	htmlDoSeletorDeNivel,
	lembrarSpPorNivel,
	lerPassoDoSeletor,
	nivelDaCura,
	nivelDoSlotComPasso,
	nivelEfetivoDaEntrada,
	registrarFechamentoDoSeletor,
	spDoNivel,
	spLembrado,
	textoDoNivel,
	_zerarNivelDeUso
} from 'UI/nivelDeUso.js';
import Pilha from 'UI/pilhaDeJanelas.js';

beforeEach(() => {
	_zerarNivelDeUso();
});

/** O seletor desenhado num elemento de verdade, para ler o que o jogador ve. */
function montar(html) {
	const caixa = document.createElement('div');
	caixa.innerHTML = html;
	return caixa.firstElementChild;
}

describe('o espelho da regra do servidor (D-1905)', () => {
	it('sem a marca, o nivel ACOMPANHA o aprendido — a Fire Bolt de D-635', () => {
		expect(nivelEfetivoDaEntrada({ nivelDeUso: 1 }, 10)).toBe(10);
	});

	it('com a marca, o escolhido — e nunca acima do aprendido', () => {
		expect(nivelEfetivoDaEntrada({ nivelDeUso: 7, nivelFixo: true }, 10)).toBe(7);
		expect(nivelEfetivoDaEntrada({ nivelDeUso: 7, nivelFixo: true }, 5)).toBe(5);
	});

	it('aprendido desconhecido (0) devolve a entrada como esta', () => {
		expect(nivelEfetivoDaEntrada({ nivelDeUso: 4, nivelFixo: true }, 0)).toBe(4);
	});
});

describe('baixar fixa, voltar ao maximo acompanha', () => {
	it('baixar do maximo grava a marca e TIRA a automatica — a entrada passa a ser do jogador', () => {
		const nova = entradaComNivel({ skillId: 'MG_FIREBOLT', nivelDeUso: 10, automatica: true }, 9, 10);
		expect(nova).toEqual({ skillId: 'MG_FIREBOLT', nivelDeUso: 9, nivelFixo: true });
	});

	it('voltar ao maximo tira a marca (acompanha de novo)', () => {
		const nova = entradaComNivel({ skillId: 'MG_FIREBOLT', nivelDeUso: 9, nivelFixo: true }, 10, 10);
		expect(nova).toEqual({ skillId: 'MG_FIREBOLT', nivelDeUso: 10 });
	});

	it('preso em 1..aprendido, e os outros campos atravessam', () => {
		const comAlvo = { skillId: 'AL_BLESSING', nivelDeUso: 2, nivelFixo: true, alvo: 'eu' };
		expect(entradaComNivel(comAlvo, 0, 10)).toEqual({ skillId: 'AL_BLESSING', nivelDeUso: 1, nivelFixo: true, alvo: 'eu' });
		expect(entradaComNivel(comAlvo, 99, 10)).toEqual({ skillId: 'AL_BLESSING', nivelDeUso: 10, alvo: 'eu' });
	});

	it('a entrada de partida nao e mexida — o rascunho troca a referencia', () => {
		const velha = { skillId: 'MG_FIREBOLT', nivelDeUso: 10, automatica: true };
		entradaComNivel(velha, 5, 10);
		expect(velha).toEqual({ skillId: 'MG_FIREBOLT', nivelDeUso: 10, automatica: true });
	});

	it('a cura: abaixo do maximo grava o nivel; no maximo o campo sai', () => {
		const ajuste = { ligada: true, alvo: 'grupo' };
		expect(ajusteDaCuraComNivel(ajuste, 5, 10)).toEqual({ ligada: true, alvo: 'grupo', nivelDeUso: 5 });
		expect(ajusteDaCuraComNivel({ ...ajuste, nivelDeUso: 9 }, 10, 10)).toEqual(ajuste);
		expect(nivelDaCura({ ligada: true, nivelDeUso: 5 }, 10)).toBe(5);
		expect(nivelDaCura({ ligada: true, nivelDeUso: 7 }, 5)).toBe(5);
		expect(nivelDaCura({ ligada: true }, 10)).toBe(10);
	});

	it('o slot da barra anda de 1 em 1, preso em 1..aprendido, e parte do que conjura hoje', () => {
		expect(nivelDoSlotComPasso(7, 10, -1)).toBe(6);
		expect(nivelDoSlotComPasso(1, 10, -1)).toBe(1);
		expect(nivelDoSlotComPasso(10, 10, 1)).toBe(10);
		// O slot acima do aprendido conjura no aprendido: o "−" sai DALI.
		expect(nivelDoSlotComPasso(10, 5, -1)).toBe(4);
		// Aprendido desconhecido: o slot nao muda.
		expect(nivelDoSlotComPasso(7, 0, -1)).toBe(7);
	});
});

describe('o SP de cada nivel e o texto', () => {
	it('o SP vem da lista do servidor; nivel fora dela e null (nunca emprestado)', () => {
		expect(spDoNivel([12, 14, 16], 2)).toBe(14);
		expect(spDoNivel([12, 14, 16], 4)).toBeNull();
		expect(spDoNivel(undefined, 1)).toBeNull();
	});

	it('"Nv 7/10 · 22 SP", e sem SP quando ele nao e conhecido', () => {
		expect(textoDoNivel(7, 10, 22)).toBe('Nv 7/10 · 22 SP');
		expect(textoDoNivel(7, 10, null)).toBe('Nv 7/10');
	});

	it('a dica da barra diz o nivel e o SP, no formato de colchete que a barra ja usava', () => {
		expect(dicaDoAtalho({ hotkey: 'F3', nome: 'Fire Bolt', nivel: 7, sp: 26 })).toBe('[ F3 ] Fire Bolt · Nv 7 · 26 SP');
		expect(dicaDoAtalho({ hotkey: '', nome: 'Fire Bolt', nivel: 7, sp: null })).toBe('Fire Bolt · Nv 7');
		expect(dicaDoAtalho({ hotkey: 'F3', nome: 'Fire Bolt', nivel: 0, sp: null })).toBe('[ F3 ] Fire Bolt');
	});

	it('o SP lembrado por habilidade alimenta a barra', () => {
		expect(spLembrado('MG_FIREBOLT', 3)).toBeNull();
		lembrarSpPorNivel('MG_FIREBOLT', [12, 14, 16]);
		expect(spLembrado('MG_FIREBOLT', 3)).toBe(16);
		// Lista vazia nao apaga o que ja se sabia.
		lembrarSpPorNivel('MG_FIREBOLT', []);
		expect(spLembrado('MG_FIREBOLT', 3)).toBe(16);
	});
});

describe('o seletor desenhado', () => {
	const base = { chave: 'rotacao.0', aprendido: 10, sp: 22, nome: 'Fire Bolt' };

	it('no meio: os dois botoes ligados, o texto e o selo "fixo"', () => {
		const el = montar(htmlDoSeletorDeNivel({ ...base, nivel: 7, fixo: true }));
		expect(el.getAttribute('data-nivel-chave')).toBe('rotacao.0');
		const [menos, mais] = el.querySelectorAll('[data-nivel-passo]');
		expect(menos.disabled).toBe(false);
		expect(mais.disabled).toBe(false);
		expect(el.querySelector('.ri-nivel-valor').textContent).toBe('Nv 7/10 · 22 SP');
		expect(el.querySelector('.ri-nivel-selo').textContent).toBe('fixo');
		expect(el.classList.contains('is-fixo')).toBe(true);
	});

	it('no maximo e acompanhando: o "+" apaga e o selo diz "máx"', () => {
		const el = montar(htmlDoSeletorDeNivel({ ...base, nivel: 10, fixo: false }));
		const [, mais] = el.querySelectorAll('[data-nivel-passo]');
		expect(mais.disabled).toBe(true);
		expect(el.querySelector('.ri-nivel-selo').textContent).toBe('máx');
	});

	it('fixo NO aprendido (a habilidade desceu ate ele): o "+" fica ligado — e a volta a acompanhar', () => {
		const el = montar(htmlDoSeletorDeNivel({ ...base, nivel: 10, fixo: true }));
		const [, mais] = el.querySelectorAll('[data-nivel-passo]');
		expect(mais.disabled).toBe(false);
	});

	it('no nivel 1 o "−" apaga', () => {
		const el = montar(htmlDoSeletorDeNivel({ ...base, nivel: 1, fixo: true }));
		expect(el.querySelector('[data-nivel-passo="-1"]').disabled).toBe(true);
	});

	it('o nome vindo do servidor e escapado (nao vira HTML)', () => {
		const el = montar(htmlDoSeletorDeNivel({ ...base, nivel: 5, fixo: true, nome: '<img src=x onerror=1>' }));
		expect(el.querySelector('img')).toBeNull();
		expect(el.querySelector('[data-nivel-passo="-1"]').getAttribute('aria-label')).toContain('<img');
	});

	it('o clique e lido como (chave, passo) — e o botao apagado nao conta', () => {
		const el = montar(htmlDoSeletorDeNivel({ ...base, nivel: 1, fixo: true }));
		expect(lerPassoDoSeletor(el.querySelector('[data-nivel-passo="1"]'))).toEqual({ chave: 'rotacao.0', passo: 1 });
		expect(lerPassoDoSeletor(el.querySelector('[data-nivel-passo="-1"]'))).toBeNull();
		expect(lerPassoDoSeletor(el.querySelector('.ri-nivel-valor'))).toBeNull();
	});
});

describe('o ESC e o voltar fecham o seletor da barra ANTES das janelas', () => {
	it('fecharSeletorDeNivel chama quem abriu, uma vez, e diz que fechou', () => {
		let fechou = 0;
		registrarFechamentoDoSeletor(() => {
			fechou += 1;
		});
		expect(fecharSeletorDeNivel()).toBe(true);
		expect(fecharSeletorDeNivel()).toBe(false);
		expect(fechou).toBe(1);
	});

	it('a pilha consome o ESC no seletor aberto — sem ele, o voltar perguntaria se quer sair do jogo', () => {
		let fechou = false;
		registrarFechamentoDoSeletor(() => {
			fechou = true;
		});
		expect(Pilha.aoEscapar(document)).toBe('desarmou');
		expect(fechou).toBe(true);
		// CONTROLE: fechado, o ESC segue o caminho de sempre.
		expect(Pilha.aoEscapar(document)).toBe('nada');
	});
});
