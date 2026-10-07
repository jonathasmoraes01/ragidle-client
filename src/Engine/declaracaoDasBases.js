/**
 * Engine/declaracaoDasBases.js
 *
 * A DECLARACAO DAS BASES NA ENTRADA NO MAPA (07/10/2026, D-2071).
 *
 * O servidor EMPURRA duas janelas grandes no lote de entrada: a lista de
 * missoes (`ZC_RAGIDLE_MISSOES`, ate 40 KB) e a arvore de habilidades
 * (`ZC_RAGIDLE_SKILLS`, ate 46 KB). Numa conexao NOVA (a volta da aba no
 * celular, a queda de rede, a reconexao automatica) o cliente ainda tem as
 * duas na memoria - nada recarregou a pagina -, mas o servidor nao sabia, e
 * as duas desciam inteiras.
 *
 * Aqui o cliente diz a revisao que tem de cada uma, ANTES de o lote descer:
 * `{acao: 'bases', missoes, skills}` no `CZ_RAGIDLE_MISSAO_ACAO` (0x0feb).
 * Com a mesma revisao da conexao anterior do personagem, o servidor manda so
 * o que mudou (`servidor/mapa/retomada-entre-conexoes.ts`, no repositorio do
 * jogo); com qualquer outra, o inteiro de sempre. O servidor antigo ignora o
 * verbo (o handler cai no `return` do fim), e um opcode NOVO nao serviria: o
 * transporte dele para de ler no opcode que nao conhece.
 *
 * O QUANDO: em `onConnectionAccepted`, DEPOIS de `onMapChange` voltar e
 * dentro de `try/catch`. O lote de entrada so desce no `CZ_NOTIFY_ACTORINIT`,
 * que sai quando o mapa termina de carregar (num `setTimeout`, D-993/F28):
 * esta declaracao sai antes dele no fio, e uma excecao aqui nao o alcanca.
 */

import { declaracaoDasBases } from 'UI/Components/MissoesIdle/parcialDaLista.js';

/**
 * Manda a declaracao. `dependencias` e injetado para o teste: as janelas
 * (`revisaoDaLista`, `revisaoDaArvore` e, desde D-2077, `revisaoDaConfig` e
 * `revisaoDoPainel`) e o fio.
 *
 * A CONFIG IDLE E A JANELA DE GRUPO (D-2077, `UI/janelaPorDiferenca.js`): a
 * chave `config`/`grupo` vai SEMPRE que a janela e passada - declarar e o que
 * diz ao servidor que este cliente aplica o parcial delas -, com a revisao
 * que a memoria tem (ou `null`). O servidor antigo ignora as duas chaves.
 */
export function declararBasesDasJanelas({ MissoesIdle, IdleSkills, IdleConfig, GrupoIdle, Network, PACKET }) {
	const lista = typeof MissoesIdle.revisaoDaLista === 'function' ? MissoesIdle.revisaoDaLista() : null;
	const arvore = typeof IdleSkills.revisaoDaArvore === 'function' ? IdleSkills.revisaoDaArvore() : null;
	const corpo = declaracaoDasBases(lista, arvore);
	if (IdleConfig) {
		corpo.config = revisaoDe(IdleConfig.revisaoDaConfig);
	}
	if (GrupoIdle) {
		corpo.grupo = revisaoDe(GrupoIdle.revisaoDoPainel);
	}
	const pkt = new PACKET.CZ.RAGIDLE_MISSAO_ACAO();
	pkt.json = JSON.stringify(corpo);
	Network.sendPacket(pkt);
}

function revisaoDe(leitor) {
	const rev = typeof leitor === 'function' ? leitor() : null;
	return typeof rev === 'number' ? rev : null;
}

/**
 * O PEDIDO DO INTEIRO de uma janela por diferenca (D-2077): o parcial nao caiu
 * sobre o que a memoria tem, entao o cliente declara `null` para aquela janela
 * (`chave` e `config` ou `grupo`) - o servidor esquece a base da conexao e o
 * proximo envio e inteiro. Quem chama repete o pedido fixo logo depois (o TCP
 * entrega os dois em ordem).
 */
export function declararBaseNula(chave, { Network, PACKET }) {
	const pkt = new PACKET.CZ.RAGIDLE_MISSAO_ACAO();
	pkt.json = JSON.stringify({ acao: 'bases', [chave]: null });
	Network.sendPacket(pkt);
}
