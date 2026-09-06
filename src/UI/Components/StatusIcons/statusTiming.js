/**
 * Normaliza as duas familias de pacote de status usadas pelo cliente.
 * ZC_MSG_STATE_CHANGE traz `state`; ZC_EFST_SET_ENTER/ENTER2 omite o campo
 * porque o proprio pacote ja significa "ativo".
 */
export function isStatusActive(state) {
	return state == null ? true : Boolean(state);
}

/**
 * Buff ativo sem duracao e permanente. O valor 9999 e o sentinela legado
 * que o cliente oficial tambem trata como infinito.
 */
export function getStatusEnd(start, life) {
	const duration = Number(life);
	if (!Number.isFinite(duration) || duration <= 0 || duration === 9999) {
		return Infinity;
	}
	return start + duration;
}

/* ------------------------------------------------------------------------- *
 * AS MEDIDAS DA COLUNA DE BUFFS (06/09/2026 — pedido do dono, com print)
 * ------------------------------------------------------------------------- *
 *
 * "Hoje o nosso sistema de buffs fica solto ali na direita, eu gostaria que
 * voce fizesse algo parecido com este da print."
 *
 * A print e a coluna do cliente oficial: cada buff e uma CELULA — moldura
 * quadrada com o icone dentro, e logo abaixo, colada, a faixa com o tempo que
 * falta (`14:50`, `3:10`, `0:11`). O que estava aqui era o icone solto de 32px
 * com um passo de 36, sem faixa nenhuma: dai o "solto".
 *
 * Os numeros moram AQUI, e nao no CSS, porque quem posiciona e o JS
 * (`resetElementsPosition` empilha por `top`/`right` absoluto, e transborda
 * para uma segunda coluna a esquerda quando a tela acaba). Com metade em cada
 * arquivo, mexer na altura da moldura desalinharia a pilha em silencio — que e
 * exatamente o modo de falha registrado no cabecalho de `StatusIcons.css`,
 * onde o `top` fixo caiu dentro do minimapa.
 *
 * A MOLDURA e CSS e o CONTEUDO e arte do cliente (regra 4 do projeto): o
 * quadrado, o bisel e a faixa do relogio sao gradiente e sombra; o icone
 * continua sendo o TGA do GRF, em 32px inteiros e `image-rendering: pixelated`.
 */

/** O lado do icone do GRF. Ampliacao so por numero INTEIRO — aqui, 1x. */
export const LADO_DO_ICONE = 32;
/** 32 do icone + 2px de recheio + 1px de borda, dos dois lados. */
export const LARGURA_DA_CELULA = 38;
/** A faixa do relogio, colada embaixo da moldura. */
export const ALTURA_DO_RELOGIO = 13;
export const ALTURA_DA_CELULA = LARGURA_DA_CELULA + ALTURA_DO_RELOGIO;
/** O respiro entre uma celula e a seguinte — elas nao se encostam. */
export const RESPIRO_ENTRE_CELULAS = 3;
export const PASSO_VERTICAL = ALTURA_DA_CELULA + RESPIRO_ENTRE_CELULAS;
export const PASSO_HORIZONTAL = LARGURA_DA_CELULA + 6;

/**
 * Calcula quantos icones cabem a partir da posicao REAL do host. Isso evita
 * reutilizar o top antigo do componente depois que a HUD muda de lugar.
 *
 * O passo entra por parametro para o teste medir a conta sem depender da
 * medida da celula — e para a celula poder mudar sem esta funcao mudar junto.
 */
export function getStatusIconsPerColumn(viewportHeight, hostTop, bottomGap = 16, passo = PASSO_VERTICAL) {
	const availableHeight = Math.max(passo, viewportHeight - hostTop - bottomGap);
	return Math.max(1, Math.floor(availableHeight / passo));
}

/**
 * O RELOGIO DA CELULA, no formato da print: `M:SS`, e `H:MM:SS` depois de uma
 * hora.
 *
 * Tres decisoes, e as tres tem consequencia na tela:
 *
 * - **vazio para o que nao expira** (`Infinity`, `NaN`) e para o que ja venceu.
 *   Escrever `0:00` num buff permanente seria numero inventado, e a faixa vazia
 *   e escondida pelo CSS (`.relogio:empty`) — a celula fica so com a moldura,
 *   como no cliente oficial;
 * - **arredonda para CIMA**: com `floor`, o ultimo segundo inteiro do buff
 *   apareceria como `0:00` — um zero que ainda tem efeito le como defeito. Com
 *   `ceil`, o ultimo valor visivel e `0:01` e o vazio so chega no fim de
 *   verdade;
 * - **minuto sem zero a esquerda, segundo COM** (`3:10`, e nao `03:10`): e o
 *   que a print mostra, e o zero a esquerda no minuto gasta um caractere numa
 *   faixa de 38px.
 */
export function formatarRelogioDoBuff(restanteMs) {
	const restante = Number(restanteMs);
	if (!Number.isFinite(restante) || restante <= 0) {
		return '';
	}
	const total = Math.ceil(restante / 1000);
	const segundos = total % 60;
	const minutos = ((total / 60) | 0) % 60;
	const horas = (total / 3600) | 0;
	const doisDigitos = n => String(n).padStart(2, '0');
	return horas > 0
		? `${String(horas)}:${doisDigitos(minutos)}:${doisDigitos(segundos)}`
		: `${String(minutos)}:${doisDigitos(segundos)}`;
}

/**
 * Nome legivel para um EFST sem descricao carregada do GRF.
 */
export function getStatusLabel(statusConstants, index) {
	const key = Object.keys(statusConstants).find(name => statusConstants[name] === Number(index));
	if (!key || key === 'MAX') {
		return `Status ${index}`;
	}
	return key
		.toLowerCase()
		.split('_')
		.map(word => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}
