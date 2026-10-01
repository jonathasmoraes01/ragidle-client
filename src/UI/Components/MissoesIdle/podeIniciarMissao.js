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
 * `servidor/mapa/pode-iniciar-missao.test.ts` o importa e executa (no fork:
 * `tests/ui/missoesSimultaneas.test.js`).
 */

/*
 * ===========================================================================
 * ATE TRES MISSOES AO MESMO TEMPO (01/10/2026, pedido do dono)
 * ===========================================================================
 * *"permitir até 3 missões ao mesmo tempo, sem entrar na 'fila'"*. O modelo
 * que o jogador ve mudou: nao ha mais "a ativa", fila nem pausa. Ele ACEITA ate
 * `execucao.maximo` missoes ("Iniciar"), e todas as aceitas andam juntas. O
 * pacote passou a mandar `missoes[i].aceita` e `execucao = {aceitas, maximo}`.
 *
 * O TETO MORA AQUI, e nao em cada tela, pelo mesmo motivo de o I16 morar aqui:
 * a janela, o cartao da HUD e a aba "Missões Gerais" do Codex decidem o MESMO
 * botao. Escrever "3 de 3" em cada uma seria a segunda rota escrita a mao.
 *
 * O SERVIDOR CONTINUA SENDO QUEM RECUSA a quarta (com motivo no feed). A tela so
 * para de oferecer o que ele vai negar — e oferece no lugar o texto do teto,
 * para o jogador saber POR QUE nao ha "Iniciar".
 *
 * OS CAMPOS ANTIGOS (`ativaId`, `naFila`) CONTINUAM LIDOS: o servidor novo nao
 * os manda mais, e eles caem sempre no "nao se aplica"; mas o portao do
 * repositorio do servidor (`servidor/mapa/pode-iniciar-missao.test.ts`) executa
 * esta funcao com a forma antiga, e um cliente novo diante de um servidor velho
 * (o deploy nao e atomico entre os dois) continua dizendo a verdade.
 */

/**
 * A missao esta ACEITA (em andamento) pelo jogador?
 *
 * `missao.aceita` e o campo do pacote novo; `execucao.aceitas` e a mesma
 * resposta pela lista. `execucao.ativaId` e a forma antiga (uma so ativa).
 *
 * @param {{id: string, aceita?: boolean}|null} missao
 * @param {{aceitas?: string[], ativaId?: string|null}|null} [execucao]
 * @returns {boolean}
 */
export function missaoAceita(missao, execucao) {
	if (!missao) return false;
	if (missao.aceita === true) return true;
	if (execucao && Array.isArray(execucao.aceitas) && execucao.aceitas.includes(missao.id)) return true;
	return !!(execucao && execucao.ativaId && execucao.ativaId === missao.id);
}

/**
 * O TETO de missoes aceitas ao mesmo tempo, ou `null` quando o servidor nao
 * mandou um (servidor de antes do teto: nada a conferir aqui).
 *
 * @param {{maximo?: number}|null} [execucao]
 * @returns {number|null}
 */
export function maximoDeAceitas(execucao) {
	const n = execucao ? Number(execucao.maximo) : NaN;
	return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Quantas o jogador tem aceitas agora — o tamanho de `execucao.aceitas`.
 *
 * @param {{aceitas?: string[]}|null} [execucao]
 * @returns {number}
 */
export function quantasAceitas(execucao) {
	return execucao && Array.isArray(execucao.aceitas) ? execucao.aceitas.length : 0;
}

/**
 * O teto foi alcancado? `>=` e nao `===`: um personagem antigo pode ter MAIS
 * de tres aceitas, herdadas da fila de antes. Ele ve todas, e so nao aceita
 * outra ate cair abaixo do teto.
 *
 * @param {{aceitas?: string[], maximo?: number}|null} [execucao]
 * @returns {boolean}
 */
export function limiteDeMissoesAtingido(execucao) {
	const maximo = maximoDeAceitas(execucao);
	return maximo !== null && quantasAceitas(execucao) >= maximo;
}

/**
 * O texto que ocupa o lugar do "Iniciar" quando o teto foi alcancado:
 * "3 de 3 em andamento". Acima do teto (o personagem antigo) o "4 de 3" seria
 * esquisito; ali sai "4 em andamento (máx. 3)", que diz as duas coisas.
 *
 * @param {{aceitas?: string[], maximo?: number}|null} [execucao]
 * @returns {string}
 */
export function textoDoLimiteDeMissoes(execucao) {
	const maximo = maximoDeAceitas(execucao);
	const n = quantasAceitas(execucao);
	if (maximo === null) {
		return '';
	}
	return n > maximo ? `${n} em andamento (máx. ${maximo})` : `${n} de ${maximo} em andamento`;
}

/**
 * @param {{id: string, estado: string, executavel?: boolean, aceita?: boolean,
 *          naFila?: boolean, repetivel?: boolean, cooldownS?: number}} missao
 *   Uma linha do pacote de missoes, como o servidor a manda.
 * @param {{aceitas?: string[], maximo?: number, ativaId?: string|null}} [execucao]
 *   a execucao corrente (`{aceitas, maximo}` desde 01/10/2026).
 * @param {{ignorarLimite?: boolean}} [opcoes] - `ignorarLimite: true` responde
 *   "comecaria, se nao fosse o teto?" — e assim que as telas sabem desenhar o
 *   botao APAGADO com "3 de 3 em andamento" em vez de nao desenhar nada. Sem
 *   o terceiro argumento a regra e a de sempre, com o teto.
 * @returns {boolean} o botao "Iniciar" deve existir (e estar ACESO) para esta missao?
 */
export function podeIniciarMissao(missao, execucao, opcoes) {
	if (!missao || !missao.executavel) return false;

	// Ja aceita: o botao dela e "Finalizar"/"Ir caçar"/"Abandonar", e nao
	// "Iniciar". Clicar de novo so faria o servidor recusar.
	if (missaoAceita(missao, execucao)) return false;
	// A fila de antes (forma antiga do pacote): mesma resposta da aceita.
	if (missao.naFila) return false;
	// Em recarga: o servidor recusa com o tempo que falta, e a tela mostra a
	// contagem no lugar do botao.
	if (missao.cooldownS > 0) return false;

	/*
	 * `em-andamento` ENTRA, e e o conserto do I16.
	 *
	 * Chegando aqui, ela nao esta aceita — ou seja, tem progresso guardado e
	 * NENHUMA execucao (o jogador a abandonou; antes de 01/10, a morte a
	 * derrubava). Comecar de novo aproveita o contador que sobreviveu.
	 */
	const estadoComeca =
		missao.estado === 'disponivel' ||
		missao.estado === 'em-andamento' ||
		// Repetivel ja concluida, fora da recarga: comeca de novo.
		(missao.estado === 'concluida' && !!missao.repetivel);

	// `bloqueada` (requisito por cumprir) e `concluida` nao repetivel ficam de
	// fora — sao as duas que o SERVIDOR tambem recusa, e as unicas.
	if (!estadoComeca) return false;

	// O TETO vem por ULTIMO de proposito: com `ignorarLimite`, todo o resto da
	// regra continua valendo, e a resposta vira "so o teto impede".
	if (!(opcoes && opcoes.ignorarLimite) && limiteDeMissoesAtingido(execucao)) return false;

	return true;
}
