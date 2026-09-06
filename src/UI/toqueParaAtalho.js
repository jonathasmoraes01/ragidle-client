/**
 * UI/toqueParaAtalho.js — PEGAR E POR: o caminho por TOQUE para a barra de
 * atalhos (D-938, 05/09/2026).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * O BURACO
 * ═══════════════════════════════════════════════════════════════════════
 * Pôr uma habilidade ou um consumível na barra de atalhos tem UM caminho
 * neste cliente, e ele é o arrasto HTML5 (`dragstart`/`dragover`/`drop`).
 *
 * Arrasto HTML5 **não existe no toque**. Não é "funciona mal": o navegador de
 * celular não gera `dragstart` a partir de um dedo, então a sequência inteira
 * — payload, `dropEffect`, `drop` — nunca começa. Um jogador de celular hoje
 * não consegue pôr nada na barra, e a barra é o jeito de usar habilidade e
 * poção durante a caça.
 *
 * É o último buraco FUNCIONAL da frente de HUD adaptável: o resto era layout
 * (cabia ou não cabia na tela), este é uma ação que simplesmente não tem como
 * ser feita.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * POR QUE "PEGAR E PÔR", E NÃO UM POLIFILL DE ARRASTO
 * ═══════════════════════════════════════════════════════════════════════
 * A tentação é traduzir `touchstart/touchmove/touchend` em eventos de arrasto
 * sintéticos e deixar o resto do código como está. Recusada, por três motivos
 * medidos neste projeto:
 *
 * 1. **Arrastar com o dedo esconde o alvo.** O dedo cobre ~10mm de tela; a
 *    barra tem slots de 32px. O jogador não vê onde está soltando.
 * 2. **O arrasto disputa com a rolagem.** A árvore de habilidades e a grade da
 *    mochila rolam. Um polifill precisa decidir, em ~100ms, se aquele dedo é
 *    rolagem ou arrasto — e errar significa ou uma lista que não rola ou um
 *    atalho que não sai.
 * 3. **A HUD tem `zoom`** (D-934). Todo polifill de arrasto vive de comparar
 *    `getBoundingClientRect()` com coordenadas de toque, e essas duas grandezas
 *    param de bater na presença de `zoom` — a mesma armadilha que já pôs o
 *    rastreador de missões 58px fora do lugar.
 *
 * **Pegar e pôr** não tem nenhum dos três: são dois toques discretos, cada um
 * com o dedo parado, e nenhuma conta de coordenada. É também o gesto que todo
 * jogo de celular usa para a mesma coisa.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * ESTE MÓDULO É SÓ O ESTADO, DE PROPÓSITO
 * ═══════════════════════════════════════════════════════════════════════
 * Aqui mora o que está "na mão" e mais nada — nenhum DOM, nenhuma pintura.
 *
 * Quem PEGA (a árvore de habilidades, a mochila) chama `pegar()`. Quem PÕE (a
 * barra de atalhos) assina `assinar()`, acende os próprios slots e chama
 * `entregar()`. O aviso na tela é desenhado pela BARRA, e não por este módulo:
 * o destino é quem sabe explicar o que ele espera, e um banner solto no
 * `document.body` é a receita conhecida deste projeto para órfão vazando por
 * cima da HUD (ver `nome-e-telas-de-carregamento`).
 *
 * O payload é EXATAMENTE o `{type, from, data}` que o arrasto já escrevia em
 * `window._OBJ_DRAG_`, e ele desemboca na MESMA função de aplicação. Um
 * segundo formato aqui significaria duas regras de "o que pode ir para a
 * barra" envelhecendo em paralelo.
 */

/** O que está na mão. `null` quando não há nada. */
let _pendente = null;

/** Quem quer saber quando isso muda. */
const _assinantes = [];

/**
 * A CHAVE DE IDENTIDADE de um pegado.
 *
 * Serve para UMA coisa: tocar de novo no MESMO botão que armou desarma, que é
 * como o jogador desiste sem precisar procurar um "cancelar". Duas habilidades
 * diferentes trocam o que está na mão em vez de cancelar.
 *
 * `SKID` para habilidade e `ITID`+`index` para item porque são as chaves que o
 * resto do cliente já usa nesses dois payloads — a mochila pode ter duas
 * pilhas do mesmo item em posições diferentes.
 */
function chave(payload) {
	if (!payload || !payload.data) {
		return '';
	}
	const d = payload.data;
	if (payload.type === 'skill') {
		return 'skill:' + d.SKID;
	}
	return 'item:' + d.ITID + ':' + (typeof d.index === 'number' ? d.index : '');
}

function avisar() {
	/* Cópia da lista: um assinante que se desassina de dentro do próprio aviso
	   não pode encurtar o laço no meio. */
	const copia = _assinantes.slice();
	for (let i = 0; i < copia.length; i++) {
		try {
			copia[i](_pendente);
		} catch (erro) {
			/* Um assinante quebrado não pode impedir os outros de saber. */
		}
	}
}

/**
 * Põe algo na mão. Devolve `true` se ficou algo na mão, `false` se este
 * chamado foi o segundo toque no mesmo alvo e portanto DESARMOU.
 *
 * @param {{type:string, from:string, data:object, rotulo?:string}} payload
 */
export function pegar(payload) {
	if (!payload || !payload.data || (payload.type !== 'skill' && payload.type !== 'item')) {
		return false;
	}
	if (_pendente && chave(_pendente) === chave(payload)) {
		cancelar();
		return false;
	}
	_pendente = payload;
	avisar();
	return true;
}

/** O que está na mão, ou `null`. */
export function pendente() {
	return _pendente;
}

/** Esvazia a mão. Idempotente. */
export function cancelar() {
	if (!_pendente) {
		return false;
	}
	_pendente = null;
	avisar();
	return true;
}

/**
 * Tira o que está na mão para ser aplicado. Diferente de `pendente()`: este
 * ESVAZIA, e é por isso que ele existe — quem entrega precisa da garantia de
 * que o mesmo pegado não vai ser aplicado duas vezes se dois toques chegarem
 * juntos (um `click` e um `pointerup`, por exemplo).
 */
export function entregar() {
	const carga = _pendente;
	if (!carga) {
		return null;
	}
	_pendente = null;
	avisar();
	return carga;
}

/**
 * Assina as mudanças. Chama o retorno JÁ com o estado atual — quem assina
 * depois de algo ter sido pegado precisa nascer certo, e não esperar a
 * próxima mudança para descobrir que há algo na mão.
 *
 * @returns {function} desassinar
 */
export function assinar(retorno) {
	if (typeof retorno !== 'function') {
		return () => {};
	}
	_assinantes.push(retorno);
	try {
		retorno(_pendente);
	} catch (erro) {
		/* mesmo argumento do `avisar` */
	}
	return function desassinar() {
		const i = _assinantes.indexOf(retorno);
		if (i >= 0) {
			_assinantes.splice(i, 1);
		}
	};
}

/**
 * O ESC (e o VOLTAR do Android) desarmam ANTES de fechar janela.
 *
 * Chamado por `pilhaDeJanelas.aoEscapar()`, e a ordem ali não é detalhe: com
 * algo na mão, o jogador que aperta voltar está desistindo DAQUELE gesto — se
 * o voltar fechasse a mochila inteira, ele perderia a janela por causa de uma
 * ação que nem chegou a acontecer. Um passo, uma desfeita.
 *
 * @returns {boolean} consumiu o evento?
 */
export function aoEscapar() {
	return cancelar();
}

/** Só para os testes: volta ao estado de módulo recém-carregado. */
export function esquecerTudo() {
	_pendente = null;
	_assinantes.length = 0;
}

export default {
	pegar,
	pendente,
	cancelar,
	entregar,
	assinar,
	aoEscapar,
	esquecerTudo
};
