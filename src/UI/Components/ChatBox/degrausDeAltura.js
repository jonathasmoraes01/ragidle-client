/**
 * UI/Components/ChatBox/degrausDeAltura.js
 *
 * A ESCADA DE ALTURA DO CHAT — a aritmetica, e so ela.
 *
 * ===========================================================================
 * POR QUE ISTO E UM MODULO, E NAO UMAS LINHAS DENTRO DO ChatBox.js
 * ===========================================================================
 * Os portoes que o `rag-idle` mantem sobre este fork LEEM O FONTE
 * (`servidor/mapa/canal-de-logs.test.ts`), e ler texto nao mede aritmetica.
 * Clampar pelo teto, deduplicar degrau que o teto engoliu, escolher o degrau
 * atual por PISO quando o jogador arrastou para um valor que nao e degrau
 * nenhum, e fechar o ciclo de volta ao 1x sao quatro regras com conta — e
 * nenhuma delas se prova com `toContain`.
 *
 * Entao ela sai daqui sem imports, sem DOM e sem estado, e
 * `servidor/mapa/degraus-do-chat.test.ts` a IMPORTA e EXECUTA. E a mesma
 * escolha de `HuntMap/dropsDoMapa.js` (D-775) e de
 * `MissoesIdle/podeIniciarMissao.js`.
 *
 * ===========================================================================
 * O CONTRATO: O PIXEL E A VERDADE, O DEGRAU E DERIVADO
 * ===========================================================================
 * O unico estado persistido continua sendo `ChatBoxAltura.altura`, em pixels
 * (`ChatBox.js`). O degrau NAO e guardado — ele e calculado a partir da
 * altura em pixels toda vez que alguem pergunta.
 *
 * O motivo e concreto: a alca de arrasto grava pixels SEM passar pelo botao.
 * Se o degrau fosse um segundo campo persistido, um arrasto o deixaria
 * mentindo — o botao diria "1x" com o chat em 2x — e um F5 congelaria a
 * mentira. Com o degrau derivado, arrastar e clicar escrevem no MESMO campo e
 * nao ha como discordarem.
 *
 * Consequencia direta, e ela e desejada: quem arrastou para 100px num painel
 * de base 71 le `1x` (piso), e o proximo clique leva a 142. O botao nunca
 * mostra um estado "livre" sem nome.
 */

/**
 * Os fatores da escada, sobre a altura-base do log: 1x -> 2x -> 4x -> 1x.
 *
 * O 4x entrou no mesmo dia que o 2x, a pedido do dono, e **custou este numero
 * e mais nada** — nenhuma outra linha do projeto mudou. Era a aposta feita
 * quando isto virou um array em vez de um `if`, e ela se pagou em horas.
 *
 * Por que 4 e nao 3: os degraus sao multiplicadores, e o salto precisa ser
 * sentido. De 2x para 3x sao 71px num painel que ja tem 142 — pouco para
 * justificar um clique. E o 4x ainda cabe no teto de metade da tela em 1080
 * (284 de 540); em tela curta ele clampa e o modulo deduplica sozinho.
 */
export const DEGRAUS = [1, 2, 4];

/**
 * Quanto um pixel pode desviar do degrau e ainda contar como "esta nele".
 *
 * O arrasto grava inteiros arredondados e a base vem de um `clamp()` em `vh`,
 * que muda com a janela: sem folga, redimensionar o navegador em 2px faria o
 * botao esquecer em que degrau estava.
 */
const TOLERANCIA_PX = 4;

/**
 * `Math.round` que nao propaga lixo: o que nao e numero utilizavel vira `null`,
 * e `null` neste modulo significa AUSENTE — "nunca arrastei", "sem teto".
 *
 * A guarda de `null`/`undefined`/`''` vem ANTES do `Number()` por causa de uma
 * armadilha do JavaScript que este modulo pisou: **`Number(null)` e `0`, e nao
 * `NaN`**. Sem esta linha, passar `null` como teto nao dizia "sem teto" —
 * dizia "teto ZERO", e ai todo degrau clampava a zero, a escada saia vazia e a
 * UI escondia o botao. O jogador perderia a escada inteira porque um valor
 * chegou ausente, em silencio, que e o pior modo de falhar.
 *
 * `''` entra na mesma guarda pelo mesmo motivo (`Number('') === 0`), e ela e o
 * que `getPropertyValue` devolve para uma custom property que nao existe.
 */
function inteiroOuNulo(valor) {
	if (valor === null || valor === undefined || valor === '') return null;
	const n = Number(valor);
	if (!isFinite(n)) return null;
	return Math.round(n);
}

/**
 * As alturas concretas da escada, em pixels, ja clampadas pelo teto e sem
 * repetidas.
 *
 * O dedupe nao e capricho: quando o teto e baixo (tela curta), `base*2` e
 * `base*3` colapsam no mesmo pixel do teto, e uma escada com dois degraus
 * IGUAIS e um botao que o jogador aperta e nada acontece. Com o dedupe, quem
 * chama consegue perguntar `length < 2` e ESCONDER o botao — que e o
 * comportamento honesto.
 */
export function alturasDosDegraus(basePx, tetoPx) {
	const base = inteiroOuNulo(basePx);
	const teto = inteiroOuNulo(tetoPx);
	if (base === null || base <= 0) return [];

	const alturas = [];
	for (let i = 0; i < DEGRAUS.length; ++i) {
		let altura = Math.round(base * DEGRAUS[i]);
		if (teto !== null && altura > teto) altura = teto;
		if (altura > 0 && alturas.indexOf(altura) === -1) alturas.push(altura);
	}
	return alturas;
}

/**
 * Em que degrau esta uma altura em pixels — por PISO, nao por proximidade.
 *
 * Piso e nao arredondamento porque a pergunta que o botao faz e "de onde eu
 * subo agora?". Com arredondamento, uma altura arrastada para 120 (entre 71 e
 * 142) responderia "1" e o proximo clique DESCERIA para 71 — o jogador
 * arrastou para cima e o botao encolheu o chat.
 *
 * `null` (nunca arrastei) e qualquer valor invalido contam como a base.
 * Altura acima do ultimo degrau conta como o ultimo — assim o proximo clique
 * fecha o ciclo em vez de travar.
 */
export function degrauAtual(alturaPx, basePx, tetoPx) {
	const alturas = alturasDosDegraus(basePx, tetoPx);
	if (alturas.length === 0) return 0;

	const altura = inteiroOuNulo(alturaPx);
	if (altura === null) return 0;

	let indice = 0;
	for (let i = 0; i < alturas.length; ++i) {
		if (altura >= alturas[i] - TOLERANCIA_PX) indice = i;
	}
	return indice;
}

/**
 * O proximo degrau do ciclo: `{ indice, altura }`.
 *
 * Depois do ultimo vem o primeiro — e o "volta ao normal" que o dono pediu,
 * e nao um teto onde o botao morre.
 */
export function proximoDegrau(alturaPx, basePx, tetoPx) {
	const alturas = alturasDosDegraus(basePx, tetoPx);
	if (alturas.length === 0) return { indice: 0, altura: null };

	const indice = (degrauAtual(alturaPx, basePx, tetoPx) + 1) % alturas.length;
	return { indice: indice, altura: alturas[indice] };
}

/**
 * O rotulo do botao: `1x`, `2x`, ...
 *
 * Ele diz o degrau ATUAL, e nao a acao — o dono nomeou os ESTADOS ("1x, 2x, e
 * depois volta ao normal"), e e o que cliente de MMO faz com escala. A acao
 * vai no `title`/`aria-label`, como `aplicarRecolhido` ja faz com o botao de
 * recolher.
 *
 * E texto, e nao glifo, por uma razao dura: o design system nao tem icone de
 * "maximizar" entre os 56 de `UI/ri-icones.js`, e desenhar um e proibido
 * ("No emoji, and no hand-drawn SVG illustration anywhere in this system").
 * Reciclar uma seta mentiria, porque o botao CICLA em vez de so subir.
 */
export function rotuloDoDegrau(indice) {
	const i = inteiroOuNulo(indice);
	const fator = DEGRAUS[i === null ? 0 : i];
	return `${fator === undefined ? DEGRAUS[0] : fator}x`;
}
