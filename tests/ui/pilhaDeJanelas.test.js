/**
 * A PILHA DE JANELAS E O ESC (D-931, 05/09/2026).
 *
 * O defeito que gerou esta bateria: com a Mochila aberta, o ESC abria as
 * **Configurações por cima** em vez de fechar o que estava aberto. A causa não
 * era da Mochila — era de **nenhuma das nove janelas Idle ter `onKeyDown`** e
 * de `Escape.onKeyDown` alternar a si mesmo sem perguntar o que mais estava na
 * tela.
 *
 * As quatro primeiras perguntas aqui são, literalmente, os quatro casos que o
 * dono escreveu:
 *
 *   Inventário > ESC > cena limpa
 *   Inventário > Skills > ESC > cena limpa
 *   foco no chat > ESC > perde o foco e a janela CONTINUA
 *   modal de decisão > ESC > o modal CONTINUA
 *
 * As demais existem porque cada uma corresponde a uma armadilha real deste
 * fork, e estão nomeadas uma a uma.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Pilha, { TIPO } from 'UI/pilhaDeJanelas.js';
import Toque from 'UI/toqueParaAtalho.js';

/**
 * Uma janela de mentira com a MESMA forma das nove de verdade: um elemento que
 * ganha e perde `is-open`, e um `toggle()` público. É essa forma comum que
 * permite a pilha se manter sem que nenhuma janela saiba dela.
 */
function janelaFalsa(prefixo) {
	const host = document.createElement('div');
	const win = document.createElement('div');
	win.className = `${prefixo}-window`;
	host.appendChild(win);
	document.body.appendChild(host);

	const componente = {
		_host: host,
		_shadow: host,
		toggle() {
			win.classList.toggle('is-open');
		},
	};
	return { componente, win, seletor: `.${prefixo}-window` };
}

function tecla(alvo, key = 'Escape') {
	const ev = new window.KeyboardEvent('keydown', { key, which: 27, bubbles: true, cancelable: true });
	Object.defineProperty(ev, 'target', { value: alvo || window, configurable: true });
	window.dispatchEvent(ev);
	return ev;
}

describe('a pilha de janelas e o ESC', () => {
	let mochila;
	let skills;

	beforeEach(() => {
		Pilha._zerar();
		document.body.innerHTML = '';
		mochila = janelaFalsa('mo');
		skills = janelaFalsa('is');
		Pilha.registrar({ nome: 'mochila', componente: mochila.componente, seletor: mochila.seletor });
		Pilha.registrar({ nome: 'skills', componente: skills.componente, seletor: skills.seletor });
		Pilha.ligar();
	});

	it('Inventário > ESC > cena limpa', () => {
		mochila.componente.toggle();
		expect(Pilha.abertas()).toEqual(['mochila']);

		tecla();

		expect(mochila.win.classList.contains('is-open')).toBe(false);
		expect(Pilha.abertas()).toEqual([]);
	});

	it('Inventário > Skills > ESC > cena limpa (as DUAS, num ESC só)', () => {
		mochila.componente.toggle();
		skills.componente.toggle();
		expect(Pilha.abertas()).toEqual(['mochila', 'skills']);

		tecla();

		expect(mochila.win.classList.contains('is-open')).toBe(false);
		expect(skills.win.classList.contains('is-open')).toBe(false);
		expect(Pilha.abertas()).toEqual([]);
	});

	it('foco no chat > ESC > perde o foco e a janela CONTINUA aberta', () => {
		mochila.componente.toggle();
		const campo = document.createElement('input');
		document.body.appendChild(campo);
		campo.focus();
		expect(document.activeElement).toBe(campo);

		tecla(campo);

		expect(document.activeElement).not.toBe(campo);
		expect(mochila.win.classList.contains('is-open')).toBe(true);

		// O SEGUNDO ESC é que fecha — é o contrato inteiro da regra 1.
		tecla();
		expect(mochila.win.classList.contains('is-open')).toBe(false);
	});

	it('modal de decisão > ESC > o modal CONTINUA, e nada embaixo dele fecha', () => {
		mochila.componente.toggle();
		const morte = janelaFalsa('dw');
		Pilha.registrar({
			nome: 'morte',
			componente: morte.componente,
			seletor: morte.seletor,
			tipo: TIPO.DECISAO,
		});
		morte.componente.toggle();

		tecla();

		expect(morte.win.classList.contains('is-open')).toBe(true);
		/* A Mochila também fica: com um modal na tela o ESC não faz NADA. Fechar
		   o que está por baixo daria a impressão de que o ESC "funcionou" e
		   deixaria o jogador achando que respondeu ao modal. */
		expect(mochila.win.classList.contains('is-open')).toBe(true);
	});

	/*
	 * ─── O DEFEITO ORIGINAL, REPRODUZIDO ───────────────────────────────
	 *
	 * As duas provas abaixo montam um `Escape` de mentira: um listener de ESC
	 * em `window`, na fase de BOLHA, exatamente como o
	 * `GUIComponent._bindKeyDown` registra o do `Escape` de verdade. Se ele
	 * rodar com uma janela aberta, as Configurações abrem por cima — que é a
	 * queixa inteira.
	 *
	 * A primeira versão desta prova olhava `ev.defaultPrevented`, e ela
	 * APROVAVA um código sem `stopImmediatePropagation` — `preventDefault` e
	 * `stopImmediatePropagation` são coisas diferentes, e só a segunda impede
	 * outro listener do MESMO alvo de rodar. O mutante passou vivo e denunciou
	 * a prova. Contar que "o evento foi tratado" não prova que o outro não foi
	 * chamado; só chamar o outro prova.
	 */
	function escapeDeMentira() {
		const espiao = vi.fn();
		window.addEventListener('keydown', espiao); // bolha, como o Escape real
		return {
			espiao,
			soltar: () => window.removeEventListener('keydown', espiao),
		};
	}

	it('com janela aberta, o Escape nativo NÃO chega a rodar', () => {
		const { espiao, soltar } = escapeDeMentira();
		mochila.componente.toggle();

		tecla();

		expect(mochila.win.classList.contains('is-open')).toBe(false);
		expect(espiao).not.toHaveBeenCalled();
		soltar();
	});

	it('sem nada aberto, o Escape nativo RODA — é assim que as Configurações abrem', () => {
		const { espiao, soltar } = escapeDeMentira();

		tecla();

		expect(espiao).toHaveBeenCalledTimes(1);
		soltar();
	});

	it('com modal de decisão, o Escape nativo também NÃO roda', () => {
		/* Senão o modal ficaria na tela COM as Configurações por cima dele —
		   o mesmo defeito, na tela em que ele é mais grave. */
		const { espiao, soltar } = escapeDeMentira();
		const morte = janelaFalsa('dw2');
		Pilha.registrar({
			nome: 'morte2',
			componente: morte.componente,
			seletor: morte.seletor,
			tipo: TIPO.DECISAO,
		});
		morte.componente.toggle();

		tecla();

		expect(espiao).not.toHaveBeenCalled();
		soltar();
	});

	it('o ESC atravessa Shadow DOM para achar o campo de texto', () => {
		/* `document.activeElement` para no HOST do componente: o campo de
		   verdade mora no `shadowRoot`. Sem descer, o chat (que é shadow) nunca
		   seria reconhecido como "digitando" — e o primeiro ESC fecharia a
		   janela de quem estava no meio de uma frase. */
		const host = document.createElement('div');
		document.body.appendChild(host);
		const shadow = host.attachShadow({ mode: 'open' });
		const campo = document.createElement('input');
		shadow.appendChild(campo);
		campo.focus();

		expect(Pilha.campoDeTextoFocado(document)).toBe(campo);
	});

	it('a pilha guarda a ORDEM DE ABERTURA, e reabrir move para o topo', () => {
		mochila.componente.toggle();
		skills.componente.toggle();
		expect(Pilha.topo().nome).toBe('skills');

		mochila.componente.toggle(); // fecha
		mochila.componente.toggle(); // reabre
		expect(Pilha.abertas()).toEqual(['skills', 'mochila']);
		expect(Pilha.topo().nome).toBe('mochila');
	});

	it('janela que se fechou por fora SAI da pilha sozinha na leitura seguinte', () => {
		/* A cicatriz: neste fork o `is-open` já sumiu por baixo dos panos numa
		   troca de mapa e numa troca de personagem (ver o cabeçalho de
		   LFGIdle.js). Uma pilha que não reconciliasse com o DOM ficaria presa a
		   um fantasma, e o ESC pararia de abrir as Configurações para sempre. */
		mochila.componente.toggle();
		expect(Pilha.temAberta()).toBe(true);

		mochila.win.classList.remove('is-open'); // ninguém avisou a pilha

		expect(Pilha.abertas()).toEqual([]);
		expect(Pilha.temAberta()).toBe(false);
	});

	it('janela aberta por fora do `toggle()` ENTRA na pilha na leitura seguinte', () => {
		/* O caminho das janelas nativas, que abrem por `append()`. */
		mochila.win.classList.add('is-open');
		expect(Pilha.abertas()).toEqual(['mochila']);
	});

	it('uma janela que explode ao fechar não prende as outras abertas', () => {
		const quebrada = janelaFalsa('qb');
		quebrada.componente.toggle = () => {
			throw new Error('estourei');
		};
		quebrada.win.classList.add('is-open');
		Pilha.registrar({ nome: 'quebrada', componente: quebrada.componente, seletor: quebrada.seletor });
		mochila.componente.toggle();

		const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
		tecla();
		erro.mockRestore();

		expect(mochila.win.classList.contains('is-open')).toBe(false);
	});

	it('o embrulho do toggle NÃO muda o que a janela faz', () => {
		/* A janela continua sendo dona do trabalho dela: o embrulho só compara
		   o antes com o depois. Se ele engolisse o retorno ou pulasse a chamada,
		   metade da contabilidade das janelas (posição salva, pacote pedido ao
		   servidor) sumiria em silêncio. */
		const alvo = janelaFalsa('tg');
		let chamou = 0;
		alvo.componente.toggle = function () {
			chamou++;
			alvo.win.classList.toggle('is-open');
			return 'devolvido';
		};
		Pilha.registrar({ nome: 'alvo', componente: alvo.componente, seletor: alvo.seletor });

		expect(alvo.componente.toggle()).toBe('devolvido');
		expect(chamou).toBe(1);
		expect(alvo.win.classList.contains('is-open')).toBe(true);
	});

	it('registrar duas vezes não embrulha duas vezes', () => {
		/*
		 * `MapEngine` roda o registro a CADA entrada no mapa. Sem a guarda, cada
		 * troca de mapa somaria uma camada de embrulho — e na décima o `toggle`
		 * estaria dez funções fundo.
		 *
		 * A pergunta é a IDENTIDADE da função, e não quantas vezes o corpo
		 * original rodou: um embrulho sobre outro continua chamando o original
		 * uma vez só, então contar chamadas aprova o aninhamento. Foi assim que
		 * a primeira versão desta prova deixou o mutante passar vivo.
		 */
		const alvo = janelaFalsa('dv');
		Pilha.registrar({ nome: 'dv', componente: alvo.componente, seletor: alvo.seletor });
		const depoisDoPrimeiro = alvo.componente.toggle;
		Pilha.registrar({ nome: 'dv', componente: alvo.componente, seletor: alvo.seletor });

		expect(alvo.componente.toggle).toBe(depoisDoPrimeiro);
	});
});

describe('o botão VOLTAR do Android segue a MESMA regra do ESC', () => {
	let mochila;

	beforeEach(() => {
		Pilha._zerar();
		document.body.innerHTML = '';
		mochila = janelaFalsa('mo');
		Pilha.registrar({ nome: 'mochila', componente: mochila.componente, seletor: mochila.seletor });
		Pilha.ligar();
	});

	it('com janela aberta, o voltar FECHA a janela em vez de sair do jogo', () => {
		mochila.componente.toggle();
		const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);

		window.dispatchEvent(new window.PopStateEvent('popstate', { state: {} }));

		expect(mochila.win.classList.contains('is-open')).toBe(false);
		/* E o mais importante: NÃO perguntou nada. Sair do jogo não estava em
		   questão — havia uma janela aberta. */
		expect(confirmar).not.toHaveBeenCalled();
		confirmar.mockRestore();
	});

	it('com modal de decisão, o voltar NÃO pergunta e NÃO deixa o jogo', () => {
		/*
		 * O caso mais caro do voltar: um modal na tela é alguém esperando
		 * resposta (uma troca, um refino, a morte). Se o voltar tratasse isso
		 * como "nada aberto", ele perguntaria "sair do jogo?" no meio de uma
		 * troca — e um toque errado levaria a sessão embora.
		 *
		 * Ele também tem de DEVOLVER a entrada de histórico que o navegador
		 * acabou de consumir; sem isso, o segundo voltar sai do jogo direto,
		 * com o modal ainda na tela.
		 */
		const morte = janelaFalsa('dw3');
		Pilha.registrar({
			nome: 'morte3',
			componente: morte.componente,
			seletor: morte.seletor,
			tipo: TIPO.DECISAO,
		});
		morte.componente.toggle();

		const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);
		const empilhar = vi.spyOn(window.history, 'pushState');

		window.dispatchEvent(new window.PopStateEvent('popstate', { state: {} }));

		expect(confirmar).not.toHaveBeenCalled();
		expect(morte.win.classList.contains('is-open')).toBe(true);
		expect(empilhar).toHaveBeenCalled();

		confirmar.mockRestore();
		empilhar.mockRestore();
	});

	it('sem nada aberto, o voltar PERGUNTA antes de deixar o jogo', () => {
		const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);

		window.dispatchEvent(new window.PopStateEvent('popstate', { state: {} }));

		expect(confirmar).toHaveBeenCalledTimes(1);
		/* Em `standalone` não existe barra do navegador: um voltar sem querer é
		   perda de sessão. A pergunta é o único freio que existe. */
		confirmar.mockRestore();
	});
});


describe('algo NA MAO desarma antes de fechar janela (D-938)', () => {
	let mochila;

	beforeEach(() => {
		Pilha._zerar();
		Toque.esquecerTudo();
		document.body.innerHTML = '';
		mochila = janelaFalsa('mo');
		Pilha.registrar({ nome: 'Mochila', componente: mochila.componente, seletor: mochila.seletor });
		Pilha.ligar();
		mochila.componente.toggle();
	});

	it('o ESC com uma habilidade pega DESARMA e a janela CONTINUA aberta', () => {
		Toque.pegar({ type: 'skill', from: 'IdleSkills', data: { SKID: 46 } });

		tecla();

		/* Um passo, uma desfeita: quem pegou uma habilidade e apertou voltar
		   está desistindo DAQUELE gesto — perder a mochila junto seria cobrar
		   caro por uma ação que nem chegou a acontecer. */
		expect(Toque.pendente()).toBe(null);
		expect(mochila.win.classList.contains('is-open')).toBe(true);
	});

	it('o SEGUNDO ESC ai fecha a janela, como sempre fez', () => {
		Toque.pegar({ type: 'skill', from: 'IdleSkills', data: { SKID: 46 } });
		tecla();
		tecla();
		expect(mochila.win.classList.contains('is-open')).toBe(false);
	});

	it('com a mao vazia nada muda — a ordem antiga fica intocada', () => {
		tecla();
		expect(mochila.win.classList.contains('is-open')).toBe(false);
	});

	it('o campo de texto ainda vem PRIMEIRO que a mao', () => {
		/* Desfocar o chat é o único caso mais imediato que desarmar, e essa
		   ordem existia antes desta decisão: quem digita e aperta ESC espera
		   sair do campo, não descobrir que perdeu o que tinha pegado. */
		const campo = document.createElement('input');
		campo.type = 'text';
		document.body.appendChild(campo);
		campo.focus();
		Toque.pegar({ type: 'skill', from: 'IdleSkills', data: { SKID: 46 } });

		tecla(campo);

		expect(Toque.pendente()).not.toBe(null);
		expect(mochila.win.classList.contains('is-open')).toBe(true);
	});

	it('o VOLTAR do Android desarma e DEVOLVE a entrada de historico', () => {
		Toque.pegar({ type: 'skill', from: 'IdleSkills', data: { SKID: 46 } });
		const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);
		const empilhar = vi.spyOn(window.history, 'pushState');

		window.dispatchEvent(new window.PopStateEvent('popstate', { state: {} }));

		expect(Toque.pendente()).toBe(null);
		expect(mochila.win.classList.contains('is-open')).toBe(true);
		/* Desarmar não fechou janela nenhuma: a entrada que o navegador acabou
		   de consumir ainda pertence à mochila aberta. Sem devolvê-la, o
		   próximo voltar sairia do jogo com a mochila na tela. */
		expect(empilhar).toHaveBeenCalled();
		expect(confirmar).not.toHaveBeenCalled();

		confirmar.mockRestore();
		empilhar.mockRestore();
	});
});
