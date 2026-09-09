/**
 * UI/Components/avisoDoCodex.js
 *
 * A BOLINHA VERMELHA DO CODEX — um fato, e um lugar só (D-1232, 08/09/2026).
 *
 * ## O pedido
 *
 * *"Adicione uma bolinha vermelha no acesso Menu → Codex quando houver um
 * objetivo concluído que precise da atenção do jogador."*
 *
 * ## Por que um módulo de uma linha, e não um campo dentro de uma janela
 *
 * Três peças precisam do MESMO fato, e nenhuma delas manda nas outras:
 *
 * - **`MissoesIdle`** RECEBE o valor: ele viaja no `ZC_RAGIDLE_MISSOES`
 *   (`codexComNovidade`), que é o pacote empurrado a cada mudança e forçado na
 *   entrada — o único que chega antes de o jogador abrir o Codex;
 * - **`CodexIdle`** também o recebe, no `temNovidade` do próprio retrato, e é
 *   ele quem tem o valor mais fresco depois de um resgate;
 * - **`TopMenuIdle`** só LÊ, no tique de polling que já sincroniza os pontos
 *   do Correio e das Skills.
 *
 * Pendurar o fato em qualquer uma das três faria as outras duas importarem uma
 * janela inteira para ler um booleano — e criaria a pergunta "qual delas é a
 * dona?", que é como um valor passa a ter duas fontes que discordam.
 *
 * ## Ele NÃO decide nada
 *
 * Quem decide é o servidor (`temNovidadeNoCodex`, `servidor/codex.ts`): entrada
 * cumprida com prêmio não resgatado, ou cumprida sem prêmio e ainda não
 * consultada. Este módulo é só a caixa onde o veredito espera até o menu
 * perguntar — refazer a regra aqui seria a segunda rota escrita à mão que este
 * projeto mais repete.
 */

let temNovidade = false;

/** O servidor disse que há (ou deixou de haver) novidade no Codex. */
export function anotarAvisoDoCodex(valor) {
	temNovidade = valor === true;
}

/** Há algo no Codex pedindo a atenção do jogador AGORA? */
export function temAvisoDoCodex() {
	return temNovidade;
}

/**
 * Zera o aviso — trocar de personagem tem de zerar.
 *
 * O Codex é DO PERSONAGEM (ordem do dono, ver `servidor/codex.ts`), então uma
 * bolinha herdada do personagem anterior estaria falando de um progresso que
 * este não tem. Ela volta sozinha no primeiro `ZC_RAGIDLE_MISSOES` da sessão
 * nova, que é forçado na entrada.
 */
export function limparAvisoDoCodex() {
	temNovidade = false;
}
