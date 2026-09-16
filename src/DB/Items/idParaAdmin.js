/**
 * DB/Items/idParaAdmin.js
 *
 * O ID DO ITEM, VISIVEL SO PARA O ADMINISTRADOR (11/09/2026, D-1331).
 *
 * Pedido do dono: *"quero que um usuario administrador, ao dar look/hover num
 * item (que esta no inventario ou equipado), apareca qual e o ID dele na
 * descricao"*.
 *
 * ## Por que um modulo, e nao duas linhas nas duas telas
 *
 * A descricao de item tem DUAS superficies neste fork, e elas nao compartilham
 * codigo nenhum:
 *
 *  1. `UI/Components/ItemInfo` — a janela de Detalhes, do cliente nativo;
 *  2. `UI/Components/MochilaIdle` — a dica rica do hover, nossa.
 *
 * Escrever `Session.Entity.isAdmin` nas duas seria "duas rotas, e a segunda
 * escrita a mao" — o defeito que este projeto mais repete, e que ja custou o
 * dia em que uma das duas telas ficou para tras. Aqui ha UM lugar que pergunta
 * pela Session, e as duas telas so renderizam o que ele devolve.
 *
 * O formato de chamada e o de `legendaDeVip` de proposito: devolve `null`
 * quando nao se aplica, e as duas superficies ja sabem tratar `null` como
 * "nao mostra nada". Quem for somar a terceira linha de item segue o mesmo
 * molde em vez de inventar um.
 *
 * ## ISTO E COSMETICO, E NAO AUTORIZACAO
 *
 * `Session.AdminList` e uma lista de EXIBICAO que o servidor manda
 * (`ZC_RAGIDLE_ADMINS`) para o cliente pintar o sprite de GM e o nome amarelo.
 * Um jogador pode reescreve-la no proprio navegador e ver a linha aparecer.
 *
 * **Tudo bem, e o motivo precisa ficar escrito**: o id do item nao e segredo —
 * ele esta no `item_db` do rAthena, que e publico, e o proprio jogo publica
 * fichas por id em `fichas-de-item.json`. Nao ha nada a proteger aqui.
 *
 * O que NAO se pode fazer e usar esta funcao para liberar acao: quem decide o
 * que um administrador pode FAZER e o servidor (`ehAdministrador`,
 * `servidor/mapa/servidor-mapa.ts`), e ele nunca pergunta ao cliente. Se um dia
 * alguem quiser esconder um dado de verdade atras de "sou admin", o lugar e
 * la, e nao aqui.
 */

import Session from 'Engine/SessionStorage.js';

/**
 * O texto da linha, sem perguntar quem esta olhando.
 *
 * Separado de proposito: ele e PURO e da para medir sem `Session`, sem DOM e
 * sem o cliente de pe — e e onde mora a unica regra que pode errar (o que
 * conta como id valido).
 *
 * @param {number|string} itemId
 * @returns {string|null}
 */
export function textoDoIdDeItem(itemId) {
	const id = typeof itemId === 'string' ? parseInt(itemId, 10) : itemId;
	/*
	 * `Number.isFinite` e nao `!= null`: `NaN` passa em quase toda guarda frouxa
	 * e sairia impresso como "ID: NaN", que e pior que nao mostrar nada — a
	 * linha existe para o administrador confiar nela ao abrir um chamado.
	 */
	if (!Number.isFinite(id)) {
		return null;
	}
	return `ID: ${id}`;
}

/**
 * Quem esta olhando e administrador?
 *
 * O UNICO lugar deste fork que faz esta pergunta para decidir o que DESENHAR.
 * `Session.Entity` nao existe fora do mapa (tela de login, char select, os
 * visualizadores), e por isso o encadeamento opcional — uma ficha aberta ali
 * nao pode derrubar a tela.
 *
 * @returns {boolean}
 */
export function souAdmin() {
	return Boolean(Session && Session.Entity && Session.Entity.isAdmin);
}

/**
 * A linha de id para ESTA tela, ou `null` quando ela nao deve aparecer.
 *
 * @param {number|string} itemId
 * @returns {string|null}
 */
export function linhaDeIdParaAdmin(itemId) {
	return souAdmin() ? textoDoIdDeItem(itemId) : null;
}
