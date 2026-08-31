/**
 * A MISSAO PODE SER INICIADA AGORA? (pedido do dono, 31/08/2026 — I16).
 *
 * Palavras dele: *"quando o player morre, a missao e cancelada e some da lista,
 * ela nao pode sumir. Quando ele voltar para Prontera, precisa conseguir
 * continuar a missao normalmente, apenas clicando novamente na missao"*.
 *
 * ===========================================================================
 * O DEFEITO, MEDIDO — E A CAUSA NAO ERA A QUE EU TINHA ESCRITO
 * ===========================================================================
 * A suspeita anotada no backlog era faixa de nivel: o personagem dele estava em
 * base 6, e talvez a "Primeiros Passos" tivesse saido da faixa. **Ela esta
 * refutada por construcao**: o requisito de nivel e um PISO
 * (`visao.nivelBase < r.nivelBase`, `servidor/missoes.ts`), entao subir de nivel
 * nunca faz uma missao deixar de valer — e ela estava rodando um instante antes
 * de ele morrer, logo os requisitos estavam satisfeitos.
 *
 * A causa e outra, e e uma engrenagem batendo na vizinha:
 *
 *   1. morrer CANCELA a missao ativa e esvazia a fila (D-609);
 *   2. mas o `progresso` de caca **sobrevive** — ordem do dono em 25/08:
 *      *"ao morrer a quest esta resetando, ela deve continuar contabilizando
 *      quantos mobs matou"* (D-615);
 *   3. e `estadoDaMissao` chama de **`em-andamento`** toda missao cujo
 *      progresso andou.
 *
 * Entao, depois da morte, ela fica `em-andamento` **sem execucao ativa** — um
 * estado legitimo que nenhuma das duas telas previa. As duas filtravam por
 * `estado === 'disponivel'`, e a missao caiu no vao: fora da lista de
 * clicaveis, e fora da execucao. O jogador via "Nenhuma missao disponivel
 * agora — suba de nivel!" com a missao dele parada no meio.
 *
 * O AVISO NO CHAT ESTAVA CERTO O TEMPO TODO — *"e so iniciar de novo quando
 * renascer"* — e era impossivel de seguir: nao havia onde clicar.
 *
 * ===========================================================================
 * O SERVIDOR SEMPRE ACEITOU. FALTAVA O BOTAO.
 * ===========================================================================
 * Medido nos dois portoes do lado de la: o handler de `iniciar` recusa apenas
 * `bloqueada` e `concluida`-sem-cooldown (`servidor-mapa.ts:19580`), e
 * `podeIniciar` recusa apenas ja-na-fila e recarga
 * (`executor-de-missoes.ts:295`). Nenhum dos dois olha `em-andamento`.
 *
 * O comentario do cancelamento por morte chega a DIZER o que era para
 * acontecer: *"ao reiniciar, o passo de caca le o mesmo contador e continua de
 * onde parou"*. A peca estava pronta e o consumidor nao existia — o padrao que
 * esta auditoria encontrou treze vezes em duas rodadas, e cujo sintoma e sempre
 * ZERO.
 *
 * ===========================================================================
 * POR QUE UM MODULO, E NAO DUAS LINHAS CONSERTADAS
 * ===========================================================================
 * O filtro estava escrito DUAS vezes, uma em cada tela
 * (`MissoesTrackerIdle.js` e `MissoesIdle.js`), com o mesmo erro nas duas — e
 * elas nao foram copiadas uma da outra, foram pensadas separadas. Consertar as
 * duas a mao deixaria as duas rotas de pe para a proxima divergencia.
 *
 * E como aqui ha uma regra com condicoes, ela precisa de teste que RODE: este
 * arquivo nao importa nada (sem DOM, sem rede, sem estado) e
 * `servidor/mapa/pode-iniciar-missao.test.ts` o importa e executa.
 */

/**
 * @param {{id: string, estado: string, executavel?: boolean, naFila?: boolean,
 *          repetivel?: boolean, cooldownS?: number}} missao
 *   Uma linha do pacote de missoes, como o servidor a manda.
 * @param {{ativaId?: string|null}} [execucao] - a execucao corrente.
 * @returns {boolean} o botao "Iniciar" deve existir para esta missao?
 */
export function podeIniciarMissao(missao, execucao) {
	if (!missao || !missao.executavel) return false;

	// Ja e a que esta rodando: o botao dela e "Pausar", e nao "Iniciar".
	if (execucao && execucao.ativaId === missao.id) return false;
	// Ja enfileirada: clicar de novo so duplicaria. O servidor recusa
	// ("a missao ja esta na fila") — mostrar o botao seria prometer o que ele
	// nega.
	if (missao.naFila) return false;
	// Em recarga: o servidor recusa com o tempo que falta, e a tela mostra a
	// contagem no lugar do botao.
	if (missao.cooldownS > 0) return false;

	/*
	 * `em-andamento` ENTRA, e e o conserto do I16.
	 *
	 * Chegando aqui, ela nao e a ativa nem esta na fila — ou seja, tem
	 * progresso e NENHUMA execucao. E exatamente o estado em que a morte
	 * deixa a missao, e reinicia-la aproveita o contador que sobreviveu.
	 */
	if (missao.estado === 'disponivel' || missao.estado === 'em-andamento') return true;

	// Repetivel ja concluida, fora da recarga: comeca de novo.
	if (missao.estado === 'concluida' && missao.repetivel) return true;

	// `bloqueada` (requisito por cumprir) e `concluida` nao repetivel ficam de
	// fora — sao as duas que o SERVIDOR tambem recusa, e as unicas.
	return false;
}
