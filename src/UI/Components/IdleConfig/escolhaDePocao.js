/**
 * A POÇÃO QUE O INTERRUPTOR ESCOLHE (D-536).
 *
 * ## O que o jogador via
 *
 * Personagem recém-criado: o kit do correio traz Poção Vermelha x200 (501) e
 * Poção Azul x200 (505). O jogador abre a Configuração idle, aba Descanso,
 * liga "Recuperação automática de HP", o `<select>` logo abaixo mostra
 * "Poção Vermelha — 200 em estoque", ele clica em Aplicar — e o servidor
 * responde:
 *
 * ```
 * pocaoDeHp: o item 0 nao e um consumivel de cura do jogo
 * pocaoDeSp: o item 0 nao e um consumivel de cura do jogo
 * ```
 *
 * ## Por que
 *
 * `configPadrao()` nasce com `itemId: 0` — "nenhuma escolhida". O `<option>`
 * marcado com `selected` é o que casa com esse id, e nenhum casa com 0; o
 * navegador então EXIBE a primeira opção da lista sem que nada tenha sido
 * escolhido. O `change` do `<select>` nunca dispara (ninguém mexeu nele), o
 * `editConfig` continua com 0, e o payload sai com 0. O estado visível mentia
 * sobre o estado real: o jogador não tinha como acertar sem antes trocar a
 * opção para outra e voltar.
 *
 * O servidor está certo em recusar — 0 não é poção. Quem estava errado era a
 * janela, que ligava o interruptor sem escolher nada.
 *
 * ## O eixo
 *
 * A segunda metade do mesmo defeito: a lista servida era a MESMA nos dois
 * eixos, e a validação do servidor (D-285) recusa poção do eixo errado
 * ("o item 501 nao restaura SP"). Agora cada consumível desce com `curaHp` /
 * `curaSp`, calculados no servidor pelas mesmas funções que a validação usa —
 * a janela filtra, em vez de repetir a regra por conta própria.
 *
 * Os campos são ADITIVOS: servidor antigo não os manda, `undefined !== false`,
 * e a lista inteira vale para os dois eixos — o comportamento de antes.
 */

/** Os consumíveis que servem para UM eixo. `campoDoEixo`: 'curaHp' | 'curaSp'. */
export function pocoesDoEixo(itens, campoDoEixo) {
	return (itens || []).filter(it => it[campoDoEixo] !== false);
}

/**
 * O `itemId` que o interruptor deve gravar ao ser LIGADO.
 *
 * Mantém a escolha do jogador quando ela ainda é válida para o eixo; senão
 * pega a primeira COM ESTOQUE — ligar a poção automática apontando para uma
 * poção que o personagem não carrega é ligar coisa nenhuma. Sem nenhuma
 * disponível devolve 0, e aí quem chama não deve deixar ligar.
 */
export function escolherPocaoPadrao(disponiveis, itemIdAtual) {
	if (disponiveis.some(it => it.itemId === itemIdAtual)) {
		return itemIdAtual;
	}
	const comEstoque = disponiveis.find(it => it.estoque > 0);
	return (comEstoque || disponiveis[0] || { itemId: 0 }).itemId;
}
