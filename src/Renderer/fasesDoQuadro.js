/**
 * Renderer/fasesDoQuadro.js
 *
 * ONDE O PIOR QUADRO GASTOU O TEMPO (15/09/2026).
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTE MODULO NAO IMPORTA NADA
 * ---------------------------------------------------------------------------
 * Ele e chamado de tres camadas diferentes: o laco de quadro
 * (`Renderer/Renderer.js`), o numero de dano (`Renderer/Effects/Damage.js`) e
 * a carga de sprite (`Core/Client.js`). Esse ultimo e um modulo de BASE, e
 * `quadrosNoCampo.js` — onde esta medicao nasceu — puxa UI (`escalaDaHud`,
 * `hudVertical`, `relatoDeErro`). Importar aquele daqui poria a UI dentro do
 * `Core` e abriria risco de ciclo.
 *
 * Folha sem imports nao tem ciclo possivel: quem precisa medir importa esta, e
 * `quadrosNoCampo.js` le o resultado na hora de montar o relato.
 *
 * ---------------------------------------------------------------------------
 * O QUE ELE MEDE, E A ARMADILHA QUE ISSO EVITA
 * ---------------------------------------------------------------------------
 * O relato do dono mede 73 travadas de mais de 100 ms em 66 s no iPhone (pior
 * quadro 578 ms), e o Chromium desta maquina nao reproduz — 60 fps cravados a
 * 1/6 de processador, CPU 73,7% ociosa. "E o WebKit" e endereco, nao causa; o
 * que falta e saber ONDE.
 *
 * **A fase `QUADRO` e a chave.** O contador de FPS mede o INTERVALO entre
 * carimbos do `requestAnimationFrame`; esta mede o JS que roda DENTRO do
 * quadro. Entre um carimbo e o proximo tambem cabem coisas que nao sao
 * desenho: processamento de pacote, coleta de lixo, composicao do navegador.
 * Se o intervalo for muito maior que `QUADRO`, **a travada nao esta no
 * desenho** — e procurar no renderizador seria cavar no lugar errado.
 *
 * ---------------------------------------------------------------------------
 * OS DOIS SUSPEITOS NOMEADOS
 * ---------------------------------------------------------------------------
 * `DANO` e `SPRITE` nao repartem o quadro: medem UMA operacao cada, porque sao
 * as duas candidatas desta rodada e merecem veredito proprio.
 *
 * - **`SPRITE`** (`Core/Client.js`, ramo `case 'spr'`): sobe UMA TEXTURA POR
 *   QUADRO DO SPRITE, e um monstro tem centenas — numa tarefa de JS so, no
 *   instante em que algo novo entra na tela. E o formato certo para o PIOR
 *   quadro: esporadico e pesado.
 * - **`DANO`** (`Renderer/Effects/Damage.js`): sobe um CANVAS para a GPU a
 *   cada numero de dano. Leve e constante — o formato certo para a CADENCIA de
 *   ~1,1 travada por segundo.
 *
 * As duas juntas explicariam o relato inteiro, e por isso as duas sao medidas
 * em vez de eu escolher uma de antemao. A textura do dano E apagada depois, e
 * a do sprite vive com ele: nenhum dos dois e vazamento como D-1378/D-1412 —
 * o custo aqui e de CHURN, nao de acumulo.
 *
 * ---------------------------------------------------------------------------
 * POR QUE O PIOR, E NAO A SOMA
 * ---------------------------------------------------------------------------
 * Somar ao longo da amostra responderia "onde o jogo gasta o tempo em geral",
 * que ja sabemos: no desenho, e cabe em 16 ms. A pergunta aberta e sobre os
 * 0,3% de quadros que estouram — por isso guardamos a REPARTICAO DO PIOR.
 */

/*
   ── A FASE `SOM`, e o A/B que o dono fez sem saber ───────────────────────
   Depois do orcamento da fila (D-1481) o dono mediu o mais direto dos testes:
   *"com o som desabilitado, continua funcionando perfeitamente, mas quando eu
   ativo o som, continua travando (agora menos do que antes, mas continua)"*.

   Isso e conclusivo sobre ONDE, e nao sobre o QUE: o custo esta no caminho do
   som, mas `SoundManager.play` faz tres coisas diferentes — tira do cache,
   chama `play()` num `<audio>`, ou carrega o arquivo e cria um elemento novo.
   Sao consertos diferentes, e um deles (trocar `<audio>` por Web Audio) e uma
   reescrita do sistema de som inteiro.

   `somMs` mede o caminho todo e `sons` conta as chamadas. Com os dois, o custo
   POR SOM sai por divisao — e e ele que decide se o conserto e reduzir o
   numero de chamadas ou trocar a tecnologia.
*/
export const FASE = { QUADRO: 0, EVENTOS: 1, DESENHO: 2, REDE: 3, DANO: 4, SPRITE: 5, SOM: 6 };
const NOMES_DE_FASE = [
	'quadroMs',
	'eventosMs',
	'desenhoMs',
	'redeMs',
	'danoMs',
	'spriteMs',
	'somMs'
];

/** Quantas vezes o som foi pedido na amostra. Nao e por quadro: e o total. */
let _sons = 0;
/** O tempo somado de TODOS os pedidos de som da amostra. */
let _somTotalMs = 0;

/**
 * Um pedido de som, com o que ele custou.
 *
 * Conta sempre, mesmo quando sai barato: o custo POR SOM e o numero que decide
 * o conserto, e ele precisa do denominador.
 *
 * @param {number} ms
 */
export function contarSom(ms) {
	_sons++;
	_somTotalMs += ms;
	registrarFase(FASE.SOM, ms);
}

/** O que a fase gastou NESTE quadro. Zerado ao fechar cada quadro. */
const _fase = new Float64Array(NOMES_DE_FASE.length);
/** A reparticao do PIOR quadro da amostra, e o total dele. */
const _piorFase = new Float64Array(NOMES_DE_FASE.length);
let _piorQuadroMs = 0;

/**
 * Soma tempo a uma fase do quadro corrente.
 * @param {number} indice - uma chave de `FASE`
 * @param {number} ms
 */
export function registrarFase(indice, ms) {
	if (ms > 0) {
		_fase[indice] += ms;
	}
}

/**
 * Fecha o quadro: se ele foi o pior ate agora, guarda a reparticao dele.
 *
 * A REDE entra na conta do pior de proposito, mesmo rodando FORA do laco: ela
 * acontece entre um quadro e o outro, e e justamente uma das candidatas a
 * explicar um intervalo grande com desenho pequeno.
 */
export function fecharQuadro() {
	const total = _fase[FASE.QUADRO] + _fase[FASE.REDE];
	if (total > _piorQuadroMs) {
		_piorQuadroMs = total;
		_piorFase.set(_fase);
	}
	_fase.fill(0);
}

/** A reparticao do pior quadro, pronta para o corpo do relato. */
export function reparticaoDoPior() {
	const saida = {};
	if (_piorQuadroMs <= 0) {
		return saida;
	}
	for (let i = 0; i < NOMES_DE_FASE.length; i++) {
		saida[NOMES_DE_FASE[i]] = Math.round(_piorFase[i] * 10) / 10;
	}
	// A CONTAGEM E DA AMOSTRA INTEIRA, e nao do pior quadro — de proposito: o
	// custo por som so sai dividindo um total de tempo por um total de
	// chamadas, e o pior quadro sozinho e uma amostra de um.
	saida.sons = _sons;
	saida.somTotalMs = Math.round(_somTotalMs);
	return saida;
}

/** Recomeca a medicao por fase. Chamado junto com o resto da amostra. */
export function zerarFases() {
	_fase.fill(0);
	_piorFase.fill(0);
	_piorQuadroMs = 0;
	_sons = 0;
	_somTotalMs = 0;
}
