/**
 * UI/Components/HuntAnalyzer/registroDaCaca.js
 *
 * O REGISTRO da cacada em curso. Estado puro: sem DOM, sem rede, sem timer --
 * so contas sobre eventos que os handlers do motor JA recebem. Por isso ele
 * roda no Node dos testes sem navegador nenhum.
 *
 * ── POR QUE UM MODULO SEPARADO, E NAO UM HOOK ────────────────────────────
 * `Network.hookPacket()` guarda UM callback por pacote
 * (Network/NetworkManager.js:210 -- `Packets.list[packet.id].callback = cb`).
 * Fisgar ZC_NOTIFY_EXP ou ZC_NOTIFY_VANISH aqui SUBSTITUIRIA em silencio os
 * handlers de Engine/MapEngine/Entity.js e apagaria o feed do canal Farm, sem
 * erro nenhum na tela. Entao o caminho e o contrario: quem ja recebe o pacote
 * chama este modulo. Uma linha em cada handler, nada sobrescrito.
 *
 * ── DE ONDE VEM CADA DADO, E O QUE ELE GARANTE ───────────────────────────
 *   - ABATE: `onEntityVanish` com `pkt.type === Entity.VT.DEAD` sobre uma
 *     entidade `TYPE_MOB` (Engine/MapEngine/Entity.js). A identidade sai de
 *     `entity.job` -> `DB.getMonsterName(job)`, que e o nome do proprio
 *     cliente -- nao ha tabela escrita aqui.
 *   - EXP: `onNotifyExp` (0x07f6), que o servidor de mapa manda A CADA ABATE
 *     em servidor/mapa/servidor-mapa.ts:1569-1573. `varID === 1` e base,
 *     `varID === 2` e classe; `expType === 0` e o abate (1 e missao, e NAO
 *     entra: nao e caca).
 *   - ITEM: `onItemPickup` (Engine/MapEngine/Item.js), o item que caiu e foi
 *     apanhado.
 *
 * ── AS TRES COISAS QUE ELE SE RECUSA A DIZER ─────────────────────────────
 *   1. **Taxa de drop POR MONSTRO.** O pacote do item que cai nao diz de qual
 *      mob ele veio. Casar o drop com a ultima morte por proximidade de tempo
 *      seria um palpite com cara de medida -- e no spot do dono morrem ate 4
 *      bichos juntos. Entao a taxa e GLOBAL (itens por 100 abates) e diz isso
 *      no rotulo.
 *   2. **Zeny da cacada.** O servidor manda o mesmo ZC_PAR_CHANGE para o zeny
 *      do mob_db e para uma venda em loja (Engine/MapEngine/Main.js:423-427
 *      registra a ambiguidade). Sem separar, "zeny/hora da caca" seria falso.
 *      Fora, ate existir pacote que distinga.
 *   3. **Ritmo antes de haver tempo medido.** Ver `MS_MINIMOS_PARA_RITMO`.
 *
 * ── UMA RESSALVA HONESTA SOBRE A CONTAGEM DE ABATES ──────────────────────
 * `VT.DEAD` conta todo mob que morre A VISTA, e nao "todo mob que EU matei".
 * Hoje as duas coisas coincidem porque a caca e solo (D-246), mas num mapa
 * compartilhado a contagem incluiria a morte alheia. A alternativa -- contar
 * por ZC_NOTIFY_EXP, que so chega pelo MEU abate -- nao carrega identidade
 * nenhuma, entao nao da ranking. A escolha e essa, e esta escrita para quem
 * mexer nisso depois do multiplayer saber o que esta trocando.
 */

/**
 * Abaixo disto, `agora - inicio` e curto demais para virar "por hora": um
 * abate aos 300 ms projetaria 12.000 abates/hora, um numero que a tela
 * mostraria com toda a seriedade. Enquanto nao ha janela medida o ritmo sai
 * como `null`, e quem desenha escreve "--".
 *
 * E a armadilha que este projeto mais repete em outra forma: criterio que
 * passa (ou numero que aparece) com amostra vazia.
 */
export const MS_MINIMOS_PARA_RITMO = 10_000;

const MS_POR_HORA = 3_600_000;

/** Dono do registro. Trocar de personagem sem recarregar zera tudo. */
let _dono = null;
/** Instante do PRIMEIRO evento deste dono -- nao o do login. */
let _inicio = null;
/** Instante do ultimo evento, para a tela poder dizer "parado ha X". */
let _ultimo = null;

let _abatesPorMonstro = new Map();
let _abatesTotal = 0;
let _expBase = 0;
let _expClasse = 0;
let _itens = new Map();

/**
 * O relogio comeca no PRIMEIRO evento, e nao no login.
 *
 * Quem fica dez minutos na cidade e depois caca dois minutos tem um ritmo de
 * dois minutos, nao de doze. Comecar no login diluiria a medida com um tempo
 * em que nao havia caca nenhuma -- e o numero serve justamente para responder
 * "este spot presta?".
 */
function marcar(gid, agora) {
	if (_dono !== gid) {
		zerar();
		_dono = gid;
	}
	if (_inicio === null) {
		_inicio = agora;
	}
	_ultimo = agora;
}

/**
 * Este item entrando no inventario conta como DROP DA CACA?
 *
 * `ZC_ITEM_PICKUP_ACK` nao e "o item que caiu": e a resposta a qualquer item
 * entrando no inventario. No nosso servidor ele sai de cinco lugares, e so um
 * e caca -- os outros quatro sao correio, loja, carrinho e armazem (a lista
 * com `arquivo:linha` esta em Engine/MapEngine/Item.js, em onItemPickAnswer).
 * O pacote nao carrega a origem, entao o discriminador e do JOGO: as quatro
 * rotas que nao sao drop acontecem na cidade, e na cidade nao ha caca (D-246).
 *
 * A CONDICAO E "SEI QUE E CIDADE", NAO "NAO SEI SE E CACA". `contexto` chega
 * por resposta do servidor e pode faltar ou atrasar; com a condicao invertida
 * esse instante descartaria drop de verdade, em silencio. Contar a mais
 * aparece na tela; descartar nao aparece em lugar nenhum.
 *
 * @param {{ehCidade?: boolean}|null|undefined} contexto IdleConfig.contexto
 */
export function ehDropDeCaca(contexto) {
	return !(contexto && contexto.ehCidade === true);
}

/** Zera o registro inteiro. O botao "Zerar" da janela chama isto. */
export function zerar() {
	_dono = null;
	_inicio = null;
	_ultimo = null;
	_abatesPorMonstro = new Map();
	_abatesTotal = 0;
	_expBase = 0;
	_expClasse = 0;
	_itens = new Map();
}

/**
 * Um mob morreu a vista. `nome` ja vem resolvido por quem chama (o motor tem
 * `DB.getMonsterName`); nome vazio cai num balde explicito em vez de sumir.
 */
export function registrarAbate(gid, nome, agora = Date.now()) {
	marcar(gid, agora);
	const chave = nome || 'Nao identificado';
	_abatesPorMonstro.set(chave, (_abatesPorMonstro.get(chave) || 0) + 1);
	_abatesTotal += 1;
}

/**
 * Experiencia de um abate. `tipo` e 'base' ou 'classe'.
 *
 * Valor nao-positivo NAO marca o relogio: um pacote de 0 nao e caca, e deixar
 * ele iniciar a janela de medida faria o ritmo nascer diluido.
 */
export function registrarExp(gid, tipo, valor, agora = Date.now()) {
	const ganho = Number(valor) || 0;
	if (ganho <= 0) {
		return;
	}
	marcar(gid, agora);
	if (tipo === 'base') {
		_expBase += ganho;
	} else if (tipo === 'classe') {
		_expClasse += ganho;
	}
}

/** Um item que caiu e foi apanhado. */
export function registrarItem(gid, nome, quantidade, agora = Date.now()) {
	const qtd = Number(quantidade) || 0;
	if (qtd <= 0 || !nome) {
		return;
	}
	marcar(gid, agora);
	_itens.set(nome, (_itens.get(nome) || 0) + qtd);
}

/** `total` por hora, ou `null` enquanto a janela medida for curta demais. */
function porHora(total, decorridoMs) {
	if (decorridoMs < MS_MINIMOS_PARA_RITMO) {
		return null;
	}
	return (total * MS_POR_HORA) / decorridoMs;
}

/**
 * Quanto falta para o proximo nivel, no ritmo medido.
 *
 * Devolve `null` -- e nao Infinity, nem um numero grande -- em todos os casos
 * em que a conta nao tem resposta: sem ritmo ainda, ritmo zero, ou o cliente
 * ainda nao sabe o teto (`restante` nao-positivo). Quem desenha escreve "--".
 */
export function estimarMsAteONivel(restante, expPorHora) {
	if (expPorHora === null || expPorHora <= 0) {
		return null;
	}
	const falta = Number(restante) || 0;
	if (falta <= 0) {
		return null;
	}
	return (falta / expPorHora) * MS_POR_HORA;
}

/**
 * O retrato do registro. Nada aqui e guardado: e tudo derivado na hora, para
 * nao haver um segundo contador que possa divergir do primeiro.
 */
export function ler(gid, agora = Date.now()) {
	if (_dono !== gid || _inicio === null) {
		return vazio();
	}

	const decorridoMs = Math.max(0, agora - _inicio);

	const ranking = [..._abatesPorMonstro.entries()]
		.map(([nome, abates]) => ({ nome, abates }))
		.sort((a, b) => b.abates - a.abates || a.nome.localeCompare(b.nome, 'pt-BR'));

	const itens = [..._itens.entries()]
		.map(([nome, quantidade]) => ({ nome, quantidade }))
		.sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, 'pt-BR'));

	const itensTotal = itens.reduce((soma, i) => soma + i.quantidade, 0);

	return {
		decorridoMs,
		ociosoMs: _ultimo === null ? 0 : Math.max(0, agora - _ultimo),
		abatesTotal: _abatesTotal,
		abatesPorHora: porHora(_abatesTotal, decorridoMs),
		expBase: _expBase,
		expClasse: _expClasse,
		expBasePorHora: porHora(_expBase, decorridoMs),
		expClassePorHora: porHora(_expClasse, decorridoMs),
		ranking,
		itens,
		itensTotal,
		/*
		 * Por 100 abates, e nao por abate: com taxa de carta em 1% (D-215) o
		 * numero por abate seria 0,01 e a tela mostraria "0,0" o tempo todo.
		 * `null` sem abate nenhum -- dividir por zero nao vira "0%".
		 */
		itensPor100Abates: _abatesTotal === 0 ? null : (itensTotal * 100) / _abatesTotal
	};
}

function vazio() {
	return {
		decorridoMs: 0,
		ociosoMs: 0,
		abatesTotal: 0,
		abatesPorHora: null,
		expBase: 0,
		expClasse: 0,
		expBasePorHora: null,
		expClassePorHora: null,
		ranking: [],
		itens: [],
		itensTotal: 0,
		itensPor100Abates: null
	};
}

export default {
	MS_MINIMOS_PARA_RITMO,
	ehDropDeCaca,
	zerar,
	registrarAbate,
	registrarExp,
	registrarItem,
	estimarMsAteONivel,
	ler
};
