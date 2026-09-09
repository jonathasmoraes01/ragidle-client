/**
 * UI/decisaoDoModoLeitura.js — A CONDICAO do modo leitura, sozinha.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * POR QUE ELA MORA NUM ARQUIVO SO DELA
 * ═══════════════════════════════════════════════════════════════════════
 * Porque ela e a unica parte TESTAVEL sem navegador, e o vizinho
 * (`telaAcesaNoFarm.js`) nao e: ele importa `IdleConfig`, que arrasta a cadeia
 * de render inteira — a primeira versao do teste morreu em
 * `Renderer/Map/Water.js` tentando WebGL no jsdom.
 *
 * Separar nao foi elegancia: foi a medicao mandando. E o mesmo padrao de
 * `atlasDeCaca.js` e `degrausDeAltura.js` — a regra sem DOM sai do componente
 * para poder ser executada.
 *
 * **Este arquivo nao importa nada, e nao pode passar a importar.** No instante
 * em que ele puxar um modulo do jogo, o teste dele volta a morrer.
 */

/**
 * A tela deve ficar acesa AGORA?
 *
 * As duas pernas da condicao, e por que cada uma:
 *
 *   1. **`cacaAutomatica`** — a declaracao do jogador, ACEITA PELO SERVIDOR.
 *      E a mesma fonte que o botao "Auto" desenha; se o servidor recusou a
 *      caca, o botao apaga e a tela deixa de ser mantida junto, sem combinar
 *      nada entre os dois;
 *   2. **nao estar na CIDADE** — o pedido cobra "nao consumir bateria
 *      desnecessariamente fora do momento de uso", e parado na cidade com o
 *      Auto armado e exatamente isso. Cidade nao tem populacao de mobs
 *      (D-246), entao nao ha farm acontecendo.
 *
 * E a terceira pergunta, que nao e uma perna e sim uma RESSALVA:
 * `contextoObsoleto` marca que o contexto na mao descreve o mapa ANTERIOR (o
 * aviso mora em `IdleConfig.js`, e existe porque `contexto` nunca volta a ser
 * `null`). Nesse instante o `ehCidade` que temos e o do mapa de ONDE o jogador
 * saiu — decidir com ele apagaria a tela no meio de uma viagem entre dois
 * mapas de caca. Entao a resposta e "continue como estava", e nao um palpite.
 *
 * **Mas o Auto desligado ganha do obsoleto**, e a assimetria e deliberada: a
 * ressalva existe para nao APAGAR por engano; segurar o lock com o Auto
 * desligado seria o desperdicio que o pedido manda evitar.
 *
 * @param {object} estado
 * @param {boolean} estado.cacaAutomatica o Auto aceito pelo servidor
 * @param {boolean} estado.ehCidade o mapa atual nao tem populacao de mobs
 * @param {boolean} estado.contextoObsoleto o contexto descreve o mapa anterior
 * @param {boolean} estado.estavaAcesa o modo leitura estava ligado ate agora
 * @returns {boolean}
 */
export function deveManterAcesa(estado) {
	if (!estado || !estado.cacaAutomatica) {
		return false;
	}
	if (estado.contextoObsoleto) {
		return !!estado.estavaAcesa;
	}
	return !estado.ehCidade;
}

/** A primeira espera: dois tiques do relogio de 1 s. */
const ESPERA_INICIAL_MS = 2000;
/** O teto. Um minuto e curto para o jogador e longo para a bateria. */
const ESPERA_MAXIMA_MS = 60000;

/**
 * Quanto esperar antes de tentar de novo, depois de N recusas seguidas.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * POR QUE ELA EXISTE — MEDIDO, E NAO PREVISTO
 * ═══════════════════════════════════════════════════════════════════════
 * `scripts/diag-modo-leitura.ts` mediu **8 tentativas** no punhado de segundos
 * em que o Auto ficou ligado, num navegador que recusa o lock: sem freio, o
 * modulo repete o pedido a cada tique do relogio, para sempre, e cada um deles
 * e uma promessa rejeitada. Com o freio, a MESMA fase mede 2.
 *
 * E a recusa mais comum da especificacao e **bateria fraca** — ou seja,
 * exatamente o aparelho em que insistir custa mais caro. O pedido do dono
 * cobra "nao consumir bateria desnecessariamente", e um laco de pedido
 * recusado por segundo e a forma mais pura de desobedecer isso.
 *
 * A espera DOBRA a cada recusa e para de crescer no teto: a recusa pode ser
 * passageira (o aparelho entrou no carregador), entao desistir de vez seria
 * trocar um desperdicio por um modo leitura que nunca mais volta.
 *
 * **O contador zera quando a condicao vira** — quem chama reseta ao sair e
 * voltar do farm. Sem isso, uma recusa de manha ainda estaria penalizando o
 * jogador a tarde.
 *
 * @param {number} recusas quantas recusas seguidas, sem nenhum sucesso
 * @returns {number} milissegundos a esperar antes da proxima tentativa
 */
export function esperaAposRecusa(recusas) {
	if (!recusas || recusas < 1) {
		return 0;
	}
	const dobrando = ESPERA_INICIAL_MS * Math.pow(2, recusas - 1);
	return Math.min(dobrando, ESPERA_MAXIMA_MS);
}

export default { deveManterAcesa, esperaAposRecusa };
