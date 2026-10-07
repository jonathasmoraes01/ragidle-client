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
 * Manda a declaracao. `dependencias` e injetado para o teste: as duas janelas
 * (`revisaoDaLista`, `revisaoDaArvore`) e o fio.
 */
export function declararBasesDasJanelas({ MissoesIdle, IdleSkills, Network, PACKET }) {
	const lista = typeof MissoesIdle.revisaoDaLista === 'function' ? MissoesIdle.revisaoDaLista() : null;
	const arvore = typeof IdleSkills.revisaoDaArvore === 'function' ? IdleSkills.revisaoDaArvore() : null;
	const pkt = new PACKET.CZ.RAGIDLE_MISSAO_ACAO();
	pkt.json = JSON.stringify(declaracaoDasBases(lista, arvore));
	Network.sendPacket(pkt);
}
