/**
 * A PORTA DO GRUPO (D-975, 08/09/2026) — qual das DUAS janelas de grupo abre,
 * e quem troca de janela quando a party muda.
 *
 * ===========================================================================
 * O QUE O DONO PEDIU, EM QUATRO LINHAS
 * ===========================================================================
 *
 *   sem party + clicar "Grupo"  -> o Localizador (LFGIdle)
 *   com party + clicar "Grupo"  -> a janela de Grupo (GrupoIdle)
 *   entrou num grupo            -> o Localizador FECHA e o Grupo ABRE sozinho
 *   saiu do grupo               -> o Grupo fecha e o Localizador abre NO LUGAR
 *                                  (só se o Grupo estava aberto: quem não
 *                                  estava olhando não tem a tela roubada)
 *
 * ===========================================================================
 * A FONTE DA VERDADE É `Session.hasParty`, E ISSO NÃO É DETALHE
 * ===========================================================================
 *
 * A tentação óbvia era perguntar à janela de Grupo ("você tem grupo?"), já que
 * ela guarda `GrupoIdle.estado` com o grupo inteiro dentro. **É armadilha**: o
 * servidor só empurra `ZC_RAGIDLE_GRUPO` para quem está INSCRITO, e a inscrição
 * é feita por `abrir()` e desfeita por `fechar()`. Com a janela fechada — que é
 * exatamente o instante em que o botão do menu precisa decidir — esse estado
 * não chega, e o último que chegou pode ser de meia hora atrás.
 *
 * `Session.hasParty` não tem esse buraco: ele é ligado/desligado pelos pacotes
 * NATIVOS de party (`Engine/MapEngine/Group.js`), que o servidor manda tenha
 * janela aberta ou não. É a mesma verdade que o `EntityControl` já usa para
 * decidir o menu do clique num jogador.
 *
 * ===========================================================================
 * "ENTRAR NO MUNDO" NÃO É "ENTRAR NUM GRUPO" — por isso há DOIS verbos
 * ===========================================================================
 *
 * `Session.hasParty` vira `true` em duas situações que parecem a mesma coisa e
 * não são:
 *
 *   1. o jogador acabou de ENTRAR num grupo (aceitou um convite, ou entrou
 *      pela lista do Localizador) — o servidor manda `ZC_ADD_MEMBER_TO_GROUP4`
 *      para o grupo inteiro, o próprio recém-chegado incluso;
 *   2. o jogador LOGOU e já estava em grupo — o servidor manda a lista inteira
 *      (`ZC_GROUP_LIST3`, D-1097), porque o cliente zera `hasParty` em todo
 *      `ZC_ACCEPT_ENTER`.
 *
 * Nos dois a borda de `false` para `true` é idêntica. Abrir a janela de Grupo
 * no caso 2 seria roubar a tela de quem só entrou no jogo — e seria a mesma
 * grosseria que o pedido do dono proíbe explicitamente no caminho de saída.
 *
 * Daí os dois verbos: `partyMudou()` é **evento** (aconteceu agora, aja) e
 * `sincronizar()` é **retrato** (é assim que está, anote e não faça nada).
 * Quem sabe qual é qual é quem recebe o pacote, e é lá que a chamada mora.
 *
 * CRIAR um grupo entra como RETRATO de propósito: o Localizador já trata o
 * 'criar' de um jeito escolhido (ele NÃO está em `ACOES_QUE_FECHAM`, e a aba
 * volta para 'grupos' para o líder ver o próprio anúncio na lista). Trocar a
 * janela debaixo dele desfaria esse desenho, e criar não é um dos dois
 * caminhos que o dono enumerou.
 *
 * ===========================================================================
 * AS JANELAS CHEGAM INJETADAS, e a razão é a mesma do `aoPedirLocalizador`
 * ===========================================================================
 *
 * Este módulo não importa `LFGIdle` nem `GrupoIdle`: quem os conhece é o
 * `Engine/MapEngine.js`, que já liga a ponte irmã (`GrupoIdle.aoPedirLocalizador`,
 * `GrupoIdle.aoPedirTeleporte`). Import cruzado entre componentes de UI prende
 * a ordem de carga de um à do outro — e, de quebra, deixaria este módulo
 * impossível de provar sem subir Renderer, Network e o GRF inteiro.
 *
 * `estaAberta()` do descritor lê a flag de MÓDULO (`estavaAberta`), e NÃO a
 * classe `is-open` do DOM: as duas janelas registram por escrito que o
 * `is-open` já sumiu por baixo dos panos numa troca de mapa (sonda de
 * 03/09/2026, no cabeçalho do `LFGIdle.onAppend`).
 */

import Session from 'Engine/SessionStorage.js';

/**
 * @typedef {object} JanelaDeGrupo
 * @property {object} componente  o GUIComponent — quem acende o aro do menu
 * @property {string} seletor     '.lfg-window' / '.gi-window', para o mesmo aro
 * @property {() => void} abrir
 * @property {() => void} fechar
 * @property {() => boolean} estaAberta
 */

/** @type {JanelaDeGrupo|null} */
let _localizador = null;
/** @type {JanelaDeGrupo|null} */
let _grupo = null;

/**
 * A última verdade de party que a porta VIU. Nasce `false` pelo mesmo motivo
 * que `SessionStorage.hasParty` nasce `false`: sem personagem no mundo não há
 * grupo. Ela é o outro lado da borda — sem ela, "entrou" e "continua dentro"
 * seriam o mesmo evento, e um segundo membro chegando reabriria a janela de
 * quem a tinha fechado.
 */
let _ultima = false;

function temParty() {
	return !!Session.hasParty;
}

const PortaDoGrupo = {};

/**
 * Liga a porta às duas janelas. `MapEngine` chama isto a cada carga de mapa,
 * pelo mesmo motivo que ele re-registra a pilha de janelas: é idempotente e
 * não custa nada, e um dia em que a ordem de carga mude ele continua certo.
 *
 * NÃO sincroniza a verdade de propósito — carregar mapa não é notícia de
 * party, e engolir aqui uma borda que chegou pelo fio seria perder o pedido.
 *
 * @param {{localizador: JanelaDeGrupo, grupo: JanelaDeGrupo}} janelas
 */
PortaDoGrupo.ligar = function ligar(janelas) {
	_localizador = janelas.localizador;
	_grupo = janelas.grupo;
};

/**
 * A janela que o item "Grupo" do menu abriria AGORA.
 *
 * Ela existe para que os DOIS switches do `TopMenuIdle` (o que abre e o
 * `isActionOpen()`, que acende o aro) derivem da MESMA decisão. Esse par já
 * produziu QUATRO casos de "só um dos dois foi editado" — os quatro comentados
 * no próprio arquivo, com o pedido literal de "faça UMA tabela e derive os dois
 * dela". Esta função é essa tabela para o item "Grupo".
 *
 * @returns {JanelaDeGrupo|null} `null` antes do `ligar()` (fora do jogo).
 */
PortaDoGrupo.janelaDoBotao = function janelaDoBotao() {
	return temParty() ? _grupo : _localizador;
};

/** O clique no item "Grupo": alterna a janela que a decisão acima escolheu. */
PortaDoGrupo.abrirPeloMenu = function abrirPeloMenu() {
	const alvo = PortaDoGrupo.janelaDoBotao();
	if (!alvo) {
		return;
	}
	if (alvo.estaAberta()) {
		alvo.fechar();
	} else {
		alvo.abrir();
	}
};

/**
 * RETRATO: "é assim que a party está". Anota e não mexe em janela nenhuma.
 *
 * Chamado do `ZC_ACCEPT_ENTER` (que zera `hasParty`), da lista inteira
 * (`ZC_GROUP_LIST*`) e da criação de grupo. Sem esta anotação, a memória de um
 * personagem atravessaria a troca para o próximo — e o primeiro grupo do
 * personagem novo não abriria janela nenhuma, porque a porta acharia que ele
 * já estava em grupo.
 */
PortaDoGrupo.sincronizar = function sincronizar() {
	_ultima = temParty();
};

/**
 * EVENTO: "a party mudou agora". Só age na BORDA — outro membro entrando ou
 * saindo do meu grupo não muda a minha verdade, e não pode mexer na minha tela.
 */
PortaDoGrupo.partyMudou = function partyMudou() {
	const agora = temParty();
	const antes = _ultima;
	_ultima = agora;
	if (antes === agora) {
		return;
	}
	if (agora) {
		entrei();
	} else {
		sai();
	}
};

/**
 * ENTREI NUM GRUPO. O Localizador some (ele já cumpriu o papel dele) e a
 * janela de Grupo abre — inclusive quando o Localizador nem estava na tela,
 * que é o caso do convite aceito, um dos dois caminhos que o dono enumerou.
 */
function entrei() {
	if (_localizador && _localizador.estaAberta()) {
		_localizador.fechar();
	}
	if (_grupo && !_grupo.estaAberta()) {
		_grupo.abrir();
	}
}

/**
 * SAÍ DO GRUPO (saí, fui expulso, o grupo se desfez — o servidor avisa os três
 * pelo mesmo `ZC_DELETE_MEMBER_FROM_GROUP`).
 *
 * A troca só acontece para quem ESTAVA COM A JANELA ABERTA: era ela que ficou
 * mentindo, e é ela que precisa dar lugar. Para quem estava caçando de janela
 * fechada, abrir o Localizador do nada seria a tela roubada que o pedido do
 * dono proíbe com todas as letras.
 */
function sai() {
	if (!_grupo || !_grupo.estaAberta()) {
		return;
	}
	_grupo.fechar();
	if (_localizador) {
		_localizador.abrir();
	}
}

/** Só para as provas — devolve o módulo ao estado de antes do jogo. */
PortaDoGrupo._zerar = function _zerar() {
	_localizador = null;
	_grupo = null;
	_ultima = false;
};

export default PortaDoGrupo;
