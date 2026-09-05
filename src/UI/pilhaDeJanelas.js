/**
 * UI/pilhaDeJanelas.js
 *
 * A PILHA DE JANELAS (D-931, 05/09/2026) — o dono do ESC, do botão VOLTAR do
 * Android e da ordem em que as janelas do jogo convivem.
 *
 * ─── O DEFEITO QUE ELE EXISTE PARA MATAR ────────────────────────────────
 *
 * Com a Mochila aberta, apertar ESC abria as **Configurações por cima** em vez
 * de fechar o que estava aberto. A cadeia, medida em 05/09/2026:
 *
 *   1. `Escape.append()` roda muito cedo no boot do mapa
 *      (`Engine/MapEngine.js:846`) e o `GUIComponent` registra o `onKeyDown`
 *      dele em `window`, fase de BUBBLE — primeiro da fila.
 *   2. **Nenhuma das nove janelas Idle tem `onKeyDown`.** Nem Mochila, nem
 *      Skills, Config, Caça, Códex, Correio, LFG, Missões ou Passe. Zero
 *      ocorrências, por grep. O ESC nunca chegava nelas.
 *   3. `Escape.onKeyDown` só pergunta uma coisa antes de agir: se a morte está
 *      na tela. Para todo o resto, ele alterna a si mesmo e chama `focus()`.
 *   4. `GUIComponent.focus()` reindexa o z-index de TODO componente ativo do
 *      jogo — e o Escape sobe acima da Mochila, que continua aberta embaixo.
 *
 * E o buraco é SISTÊMICO, não da Mochila: `Inventory.js:46-52` e
 * `Equipment.js:48-54` têm `onKeyDown` e **nenhum dos dois chama
 * `stopPropagation`** — mesmo com tratador, o Escape abriria por cima. Qualquer
 * conserto que só desse `onKeyDown` às janelas Idle deixaria o caso nativo
 * quebrado.
 *
 * ─── POR QUE UM REGISTRO PRÓPRIO, E NÃO O `UIManager.components` ────────
 *
 * `UIManager.components` é o registro de TUDO — HUD, ícones, painéis sempre
 * visíveis. `GUIComponent.focus()` itera ele inteiro. "Janela" é um conceito
 * mais estreito: o que o jogador ABRE e espera FECHAR. Reaproveitar aquela
 * lista faria o ESC "fechar" a doca.
 *
 * ─── COMO A PILHA SE MANTÉM SEM TOCAR EM NENHUMA JANELA ─────────────────
 *
 * As nove janelas Idle têm a MESMA forma: um `.<prefixo>-window` que ganha e
 * perde a classe `is-open`, e um `toggle()` público. O registro **embrulha** o
 * `toggle()` de cada uma: a função original continua fazendo o trabalho dela
 * (posição salva, pacote pedido ao servidor, foco), e o embrulho só olha o
 * antes/depois e atualiza a pilha.
 *
 * Isso é deliberado. A alternativa era editar nove arquivos para cada um
 * avisar a pilha — nove chances de alguém esquecer, e nove conflitos com quem
 * estiver mexendo nelas. O embrulho mantém a regra do dono ("nenhuma janela
 * abre ou fecha por conta própria fora dele") sem exigir que nenhuma delas
 * saiba que a pilha existe.
 *
 * ─── AS QUATRO REGRAS DO ESC, NA ORDEM EM QUE SÃO PERGUNTADAS ───────────
 *
 *   1. **Campo de texto focado** → tira o foco do campo, e mais nada. O
 *      segundo ESC é que fecha janela. (Quem está digitando no chat esperava
 *      sair do chat, não perder a janela inteira.)
 *   2. **Modal de decisão aberto** (troca, venda, refino, morte, pedido de
 *      NPC) → o ESC não faz NADA. Sai por Confirmar ou Cancelar, explícito.
 *   3. **Qualquer janela aberta** → fecha TODAS e devolve a cena limpa.
 *   4. **Nada aberto** → aí sim abre as Configurações.
 *
 * ─── O BOTÃO VOLTAR DO ANDROID SEGUE A MESMA REGRA ──────────────────────
 *
 * Em `standalone` (o app instalado) não existe barra do navegador: sair sem
 * querer é perder a sessão. Cada janela aberta empilha uma entrada de
 * histórico; o voltar consome essa entrada e cai na regra do ESC. Com nada
 * aberto, o voltar PERGUNTA antes de deixar o jogo.
 */

import KEYS from 'Controls/KeyEventHandler.js';
import { aoEscapar as desarmarAtalhoPendente } from 'UI/toqueParaAtalho.js';

/** Os tipos de janela, e o que cada um responde ao ESC. */
export const TIPO = {
	/** Painel comum: o ESC fecha, junto com todos os outros. */
	JANELA: 'janela',
	/**
	 * Exige uma decisão do jogador (troca, venda, refino, morte, pedido de
	 * NPC). O ESC não fecha e não vaza para as janelas de baixo: sair daqui é
	 * por Confirmar ou Cancelar, com o dedo no botão.
	 */
	DECISAO: 'decisao',
};

const _registro = new Map();
/** Nomes das janelas abertas, na ORDEM DE ABERTURA (o último é o topo). */
const _pilha = [];

let _ligado = false;
/** Quantas entradas de histórico esta pilha empilhou (só para o voltar). */
let _entradasNoHistorico = 0;
let _pedindoConfirmacaoDeSaida = false;

/**
 * Registra uma janela.
 *
 * @param {object} d
 * @param {string} d.nome        identificador estável (usado nos testes)
 * @param {object} d.componente  o GUIComponent
 * @param {string} [d.seletor]   o elemento que ganha `is-open` (`.mo-window`)
 * @param {string} [d.tipo]      TIPO.JANELA (padrão) ou TIPO.DECISAO
 * @param {function} [d.estaAberta] leitura própria, quando não é `is-open`
 * @param {function} [d.fechar]  fechamento próprio, quando não é `toggle()`
 */
export function registrar({ nome, componente, seletor, tipo = TIPO.JANELA, estaAberta, fechar }) {
	if (!nome || !componente) {
		return;
	}

	const raiz = () => componente._shadow || componente._host || null;
	const elemento = () => {
		const r = raiz();
		return r && seletor ? r.querySelector(seletor) : null;
	};

	const lerAberta =
		estaAberta ||
		(() => {
			const el = elemento();
			return !!(el && el.classList.contains('is-open'));
		});

	const fecharDeVerdade =
		fechar ||
		(() => {
			/* `toggle()` e não `classList.remove`: a função da janela faz a
			   contabilidade dela (salvar posição, soltar foco, avisar o
			   servidor). Mexer na classe por fora deixaria metade disso para
			   trás — e é exatamente o tipo de atalho que este arquivo existe
			   para não precisar. */
			if (lerAberta() && typeof componente.toggle === 'function') {
				componente.toggle();
			}
		});

	_registro.set(nome, { nome, componente, tipo, estaAberta: lerAberta, fechar: fecharDeVerdade });

	/*
	 * D-932 — A MARCA `ri-janela` NO HOST.
	 *
	 * Em tela estreita uma janela arrastável não serve: a Mochila mede mais que
	 * a tela inteira de um celular. Medido em 393x852 com o jogo de pé, o "X"
	 * dela ficava em **x = 503 numa tela de 393** — desenhado e fora do mundo.
	 *
	 * O `Common.css` transforma toda janela em painel de tela cheia abaixo de
	 * 600px, e precisa de um jeito de saber QUAIS hosts são janelas. Ele não
	 * pode adivinhar: `[data-gui-component]` marca todo componente, e a doca e
	 * o painel de personagem também são componentes.
	 *
	 * Quem já sabe a resposta é este registro — é literalmente a definição dele.
	 * Então ele marca, e o CSS lê. Um componente que nunca se registrar aqui
	 * simplesmente não vira painel, e isso é visível na primeira vez que alguém
	 * o abrir num celular — falha alta, e não silenciosa.
	 */
	const host = componente._host;
	/* D-937: com a bandeira de rollout desligada, a janela NAO vira painel de
	   tela cheia — a marca e o que o CSS le, entao nao marcar e o desligamento
	   inteiro. A pilha e o ESC continuam funcionando: eles nao sao aparencia. */
	const classica =
		typeof document !== 'undefined' &&
		document.documentElement.classList.contains('ri-hud-classica');
	if (host && host.classList && !classica) {
		host.classList.add('ri-janela');
	}

	/*
	 * O EMBRULHO DO `toggle()`. Ele não muda o que a janela faz — chama a
	 * função original e só compara o antes com o depois para saber se deve
	 * empilhar ou desempilhar. Se a janela não tiver `toggle`, quem a abre
	 * chama `aoAbrir(nome)` na mão.
	 */
	if (typeof componente.toggle === 'function' && !componente.__pilhaEmbrulhada) {
		const original = componente.toggle.bind(componente);
		componente.toggle = function toggleComPilha(...args) {
			const antes = lerAberta();
			const r = original(...args);
			const depois = lerAberta();
			if (!antes && depois) {
				aoAbrir(nome);
			} else if (antes && !depois) {
				aoFechar(nome);
			}
			return r;
		};
		componente.__pilhaEmbrulhada = true;
	}
}

/** Avisa a pilha que a janela abriu (o embrulho chama sozinho). */
export function aoAbrir(nome) {
	if (!_registro.has(nome)) {
		return;
	}
	const i = _pilha.indexOf(nome);
	if (i !== -1) {
		_pilha.splice(i, 1);
	}
	_pilha.push(nome);
	empilharHistorico();
}

/** Avisa a pilha que a janela fechou (o embrulho chama sozinho). */
export function aoFechar(nome) {
	const i = _pilha.indexOf(nome);
	if (i !== -1) {
		_pilha.splice(i, 1);
	}
}

/**
 * As janelas abertas AGORA, em ordem de abertura.
 *
 * A pilha é reconciliada com o DOM a cada leitura: uma janela que se fechou por
 * um caminho que a pilha não viu (troca de mapa, troca de personagem — os dois
 * casos que já derrubaram o `is-open` por baixo dos panos neste fork) sai
 * daqui sozinha, em vez de manter o ESC preso a um fantasma.
 */
export function abertas() {
	for (let i = _pilha.length - 1; i >= 0; i--) {
		const d = _registro.get(_pilha[i]);
		if (!d || !d.estaAberta()) {
			_pilha.splice(i, 1);
		}
	}
	/* Janela aberta por fora do embrulho (o `append()` de uma nativa) entra
	   aqui na primeira leitura, no fim da pilha — ela é a mais recente que a
	   pilha conhece. */
	for (const [nome, d] of _registro) {
		if (d.estaAberta() && !_pilha.includes(nome)) {
			_pilha.push(nome);
		}
	}
	return _pilha.slice();
}

/** Existe alguma janela aberta? (modais contam) */
export function temAberta() {
	return abertas().length > 0;
}

/** A janela do topo, ou `null`. */
export function topo() {
	const a = abertas();
	return a.length ? _registro.get(a[a.length - 1]) : null;
}

/** Existe um modal de decisão aberto? */
export function temDecisaoAberta() {
	return abertas().some(n => _registro.get(n).tipo === TIPO.DECISAO);
}

/**
 * Fecha todas as janelas comuns. Modais de decisão NUNCA são fechados por
 * aqui — quem os abriu espera uma resposta.
 *
 * Fecha do topo para a base: uma janela que abriu outra (a ficha de item que
 * nasce da Mochila) some antes da dona, e não depois.
 */
export function fecharTodas() {
	const nomes = abertas().reverse();
	let fechadas = 0;
	for (const nome of nomes) {
		const d = _registro.get(nome);
		if (!d || d.tipo === TIPO.DECISAO) {
			continue;
		}
		try {
			d.fechar();
			fechadas++;
		} catch (erro) {
			/* Uma janela que explode ao fechar não pode prender as outras
			   abertas: o jogador apertou ESC para limpar a tela. */
			console.error('[pilhaDeJanelas] falha ao fechar', nome, erro);
		}
	}
	abertas();
	limparHistorico();
	return fechadas;
}

/**
 * O foco está num campo de texto?
 *
 * Atravessa Shadow DOM: `document.activeElement` para no HOST do componente, e
 * o campo de verdade está dentro do `shadowRoot` dele. Sem descer, o chat
 * (que é shadow) nunca seria reconhecido como "digitando".
 */
export function campoDeTextoFocado(doc) {
	let el = (doc || document).activeElement;
	while (el && el.shadowRoot && el.shadowRoot.activeElement) {
		el = el.shadowRoot.activeElement;
	}
	if (!el) {
		return null;
	}
	const tag = (el.tagName || '').toLowerCase();
	if (tag === 'input' || tag === 'textarea' || el.isContentEditable) {
		return el;
	}
	return null;
}

/**
 * O que o ESC (e o voltar do Android) fazem. Devolve o que aconteceu, para o
 * chamador decidir se deixa o evento seguir.
 *
 * @returns {'desfocou'|'desarmou'|'decisao'|'fechou'|'nada'}
 */
export function aoEscapar(doc) {
	const campo = campoDeTextoFocado(doc);
	if (campo) {
		campo.blur();
		return 'desfocou';
	}
	/*
	 * ALGO NA MAO DESARMA PRIMEIRO (D-938).
	 *
	 * Com uma habilidade pega esperando um slot, o voltar do Android e o ESC
	 * estao desistindo DAQUELE gesto — fechar a janela inteira aqui faria o
	 * jogador perder a arvore de habilidades por causa de uma acao que nem
	 * chegou a acontecer. Um passo, uma desfeita.
	 *
	 * Vem DEPOIS do campo de texto de proposito: desfocar o chat e o unico
	 * caso mais imediato que este, e a ordem antiga fica intocada para quem
	 * nao tem nada na mao.
	 */
	if (desarmarAtalhoPendente()) {
		return 'desarmou';
	}
	if (temDecisaoAberta()) {
		return 'decisao';
	}
	if (temAberta()) {
		fecharTodas();
		return 'fechou';
	}
	return 'nada';
}

/* ═══════════════════════════════════════════════════════════════════════
   O TECLADO
   ═══════════════════════════════════════════════════════════════════════ */

function tratarTecla(evento) {
	if (evento.which !== KEYS.ESCAPE && evento.key !== 'Escape') {
		return;
	}
	const resultado = aoEscapar(evento.target && evento.target.ownerDocument);
	if (resultado === 'nada') {
		/* Sem janela aberta o ESC segue o caminho de sempre e abre as
		   Configurações — o handler do `Escape` continua vivo e intocado. */
		return;
	}
	/*
	 * `stopImmediatePropagation` e não `stopPropagation`: os tratadores de ESC
	 * deste fork moram todos em `window`, e `stopPropagation` não impede
	 * outros listeners do MESMO alvo de rodar. Era exatamente essa a diferença
	 * entre "o ESC fechou a Mochila" e "o ESC fechou a Mochila E abriu as
	 * Configurações por cima".
	 */
	evento.stopImmediatePropagation();
	evento.preventDefault();
}

/* ═══════════════════════════════════════════════════════════════════════
   O BOTÃO VOLTAR DO ANDROID

   Não havia NADA disto no cliente: zero `history.pushState`, zero `popstate`.
   Em `standalone` o voltar sai do app — e sair do app é perder a sessão de
   quem está jogando.

   Cada janela aberta empilha UMA entrada. O voltar consome a entrada e cai na
   mesma função do ESC. Com nada aberto, ele PERGUNTA.
   ═══════════════════════════════════════════════════════════════════════ */

function empilharHistorico() {
	if (!_ligado || typeof history === 'undefined' || !history.pushState) {
		return;
	}
	try {
		history.pushState({ ragidleJanela: _pilha.length }, '');
		_entradasNoHistorico++;
	} catch (erro) {
		/* Alguns contextos (file://, sandbox restrito) recusam pushState. O
		   ESC continua funcionando; só o voltar do Android fica de fora. */
	}
}

function limparHistorico() {
	_entradasNoHistorico = 0;
}

function tratarVoltar() {
	const resultado = aoEscapar(document);
	if (resultado === 'desfocou' || resultado === 'fechou') {
		return;
	}
	if (resultado === 'desarmou') {
		/* Desarmar nao fechou janela nenhuma, entao a entrada de historico que
		   o navegador acabou de consumir ainda pertence a uma janela aberta —
		   devolve, ou o proximo voltar sairia do jogo com a mochila na tela. */
		empilharHistorico();
		return;
	}
	if (resultado === 'decisao') {
		/* Modal na tela: o voltar não pode levar embora quem ainda precisa
		   responder. Devolve a entrada que o navegador acabou de consumir. */
		empilharHistorico();
		return;
	}
	if (_pedindoConfirmacaoDeSaida) {
		return;
	}
	_pedindoConfirmacaoDeSaida = true;
	try {
		const sair = window.confirm('Sair do jogo? O seu personagem continua caçando no servidor.');
		if (!sair) {
			history.pushState({ ragidleJanela: 0 }, '');
		}
	} finally {
		_pedindoConfirmacaoDeSaida = false;
	}
}

/**
 * Liga a pilha. Idempotente — chamar duas vezes não duplica listener.
 *
 * O `true` do `addEventListener` é a fase de CAPTURA, e ela é o ponto do
 * conserto: os tratadores de ESC deste fork moram em `window` na fase de
 * bolha, e a captura roda ANTES de todos eles. Registrar mais um na bolha só
 * somaria mais um competidor à mesma fila desordenada.
 */
export function ligar() {
	if (_ligado || typeof window === 'undefined') {
		return;
	}
	_ligado = true;
	window.addEventListener('keydown', tratarTecla, true);
	window.addEventListener('popstate', tratarVoltar);
}

export function desligar() {
	if (!_ligado || typeof window === 'undefined') {
		return;
	}
	_ligado = false;
	window.removeEventListener('keydown', tratarTecla, true);
	window.removeEventListener('popstate', tratarVoltar);
	_pilha.length = 0;
	limparHistorico();
}

/** Só para os testes: esquece tudo. */
export function _zerar() {
	desligar();
	_registro.clear();
}

export default {
	TIPO,
	registrar,
	aoAbrir,
	aoFechar,
	abertas,
	temAberta,
	topo,
	temDecisaoAberta,
	fecharTodas,
	campoDeTextoFocado,
	aoEscapar,
	ligar,
	desligar,
	_zerar,
};
