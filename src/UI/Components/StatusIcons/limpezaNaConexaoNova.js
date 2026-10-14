/**
 * A BARRA DE ICONES LIMPA NA CONEXAO NOVA (D-2440, achado da D-2397 do servidor).
 *
 * O DEFEITO: o status que VENCE com o jogador desconectado ficava aceso na barra
 * (`StatusIcons`) da pagina que reconecta, sem relogio, ate a morte. O icone so
 * se apaga com o `estado: 0` do servidor, e esse pacote foi para a conexao que
 * caiu; a entrada nova so apaga o `NoSave` anotado. A barra so era limpa no
 * logout e na volta ao menu (`cleanGameUI`), e a reconexao automatica, a volta
 * do sono e a troca de processo nao passam por la: a pagina e a mesma.
 *
 * O CONSERTO: limpar a barra UMA vez por conexao nova, e no instante certo:
 *  - ARMADA em `onConnectionAccepted` (o `ZC_ACCEPT_ENTER`), o mesmo criterio de
 *    "conexao nova" do `BotMenu.novaConexaoDoServidor()` — login, reconexao,
 *    volta do sono, troca de servidor de mapa. No login a barra ja esta vazia, e
 *    limpar o vazio nao custa nada;
 *  - FEITA no primeiro `estouPronto` depois dela, logo DEPOIS de o
 *    `CZ_NOTIFY_ACTORINIT` sair (D-993: nada cosmetico antes dele), de forma
 *    sincrona: nenhuma resposta do servidor e processada antes, e o que ele manda
 *    em resposta (os reenvios da entrada) acende de novo. Antes desse instante o
 *    icone que chega nem entra na barra: a entidade do proprio so volta no
 *    `onLoad` (`Entity.js`, o `if (!entity) return`);
 *  - UMA VEZ: a reconexao pode carregar o mapa DUAS vezes para um lote so (o
 *    `ZC_NPCACK_MAPMOVE` logo atras do aceite troca o `onLoad`), e o servidor so
 *    manda o lote (com os icones do que atravessa e o carrinho) na primeira. Uma
 *    segunda limpeza apagaria o lote. A troca de mapa comum nunca limpa: o
 *    servidor nao reenvia tudo nela, e a barra dela esta certa.
 *
 * O servidor de D-2440 devolve, nessa primeira carga, os dois icones que antes
 * nao voltavam (o SC_DANCING do cantor e o Devotion de fora da cena): ele PRECISA
 * estar no ar antes deste cliente, senao a limpeza apaga os dois ate eles
 * acabarem.
 *
 * Custo: um booleano conferido por carga de mapa. Nada por quadro, nada por
 * pacote.
 */

/**
 * @param {() => void} limpar - quem esvazia a barra (o `StatusIcons.clean`)
 * @param {(erro: unknown) => void} relatar - para onde vai a falha (ela nunca sobe)
 */
export function criarLimpezaNaConexaoNova(limpar, relatar) {
	let armada = false;
	return {
		/** O aceite de uma conexao nova (`onConnectionAccepted`). */
		armar() {
			armada = true;
		},
		/**
		 * Logo depois do `CZ_NOTIFY_ACTORINIT` sair. A marca sai ANTES de limpar: se
		 * a limpeza lancar, a carga seguinte nao tenta de novo por cima do lote.
		 */
		depoisDoEstouPronto() {
			if (!armada) return false;
			armada = false;
			try {
				limpar();
			} catch (erro) {
				relatar(erro);
			}
			return true;
		},
		/** So para a prova: a limpeza esta armada? */
		get armada() {
			return armada;
		}
	};
}
