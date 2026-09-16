/**
 * UI/Components/Refine/Refine.js
 *
 * "Refinar equipamento" — a bancada.
 *
 * ===========================================================================
 * O DEFEITO QUE ESTE ARQUIVO FOI REESCRITO PARA MATAR (07/09/2026)
 * ===========================================================================
 * Queixa do dono, com print: *"a gente coloca o item, seleciona o material e
 * clica, e nao tem o botao de refinar"*. A frase e LITERAL, e o caminho dela
 * estava todo aqui:
 *
 *   1. `.refine_enabled` nascia com `style.display = 'none'` no `init()`;
 *   2. a UNICA linha que o acendia morava dentro do clique no ladrilho do
 *      material (`onPopulateMaterials`);
 *   3. e esse clique comecava com `if (clickedCount === 0) return;` — ou seja,
 *      **quem nao tinha o minerio clicava e nao acontecia absolutamente nada**.
 *      Nem botao, nem mensagem, nem cursor diferente.
 *
 * Entao o botao "Refinar" nao estava desabilitado: ele NAO EXISTIA na tela ate
 * o jogador ter o material e acertar o clique num ladrilho de 24px. O jogador
 * descreve o que ve, e o que se via era uma janela sem botao.
 *
 * Havia um QUARTO silencio, do lado do servidor, e ele foi consertado junto:
 * `CZ_REFINING_SELECT_ITEM` simplesmente RETORNAVA sem responder quando a peca
 * estava vestida, no teto, ou fora da tabela de refino. A janela ficava
 * mostrando o degrau da peca ANTERIOR enquanto o jogador achava que tinha
 * escolhido esta. Hoje a recusa viaja (`ZC_RAGIDLE_REFINO`, 0x0fd3, com
 * `degrau: null` e o motivo por extenso).
 *
 * ===========================================================================
 * O DESENHO NOVO NAO TEM ESSES DEGRAUS
 * ===========================================================================
 *  - a peca entra por CLIQUE numa LISTA do que da para refinar. O arrasto saiu
 *    inteiro: alem de ser um passo escondido, ele **nao existe no toque**
 *    (D-938, a mesma cicatriz da barra de atalhos);
 *  - o material NAO SE ESCOLHE. O degrau tem um so, dito pelo `refine.yml`; a
 *    janela mostra quanto voce tem contra quanto precisa;
 *  - o botao esta SEMPRE na tela. Quando esta apagado, o rodape diz por que —
 *    "Falta 1 x Phracon", "Faltam 6.943 zeny", "Tire a peca para refinar".
 *
 * ===========================================================================
 * QUEM MANDA NOS NUMEROS
 * ===========================================================================
 * O SERVIDOR, e so ele. Chance, preco, material, niveis perdidos na falha,
 * bonus e teto chegam prontos em `ZC_RAGIDLE_REFINO`, tirados do `refine.yml`
 * (regra 1 do CLAUDE.md). Esta janela **nao calcula nada** — nem o veredito do
 * botao: o `motivo` que ela mostra e o `podeRefinar` do servidor, a MESMA
 * funcao que o `CZ_REQ_REFINING` consulta antes de gastar. Uma janela que
 * decidisse sozinha acabaria discordando do servidor, e a discordancia so
 * apareceria no dia em que ela dissesse "pode" e o zeny nao saisse.
 *
 * O `ZC_REFINING_MATERIAL_LIST` (0x0aa2) continua sendo ouvido: e ele que diz
 * QUAL peca o servidor entendeu que foi escolhida, e a ficha nova chega logo
 * atras com o resto.
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 */

import DB from 'DB/DBManager.js';
import ItemType from 'DB/Items/ItemType.js';
import Configs from 'Core/Configs.js';
import Preferences from 'Core/Preferences.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import PACKETVER from 'Network/PacketVerManager.js';
import Client from 'Core/Client.js';
import Session from 'Engine/SessionStorage.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import Announce from 'UI/Components/Announce/Announce.js';
import ChatBox from 'UI/Components/ChatBox/ChatBox.js';
import Equipment from 'UI/Components/Equipment/Equipment.js';
import Inventory from 'UI/Components/Inventory/Inventory.js';
import ItemInfo from 'UI/Components/ItemInfo/ItemInfo.js';
import { abaLembrada, lembrarAba } from '../memoriaDeAba.js';
import 'UI/Elements/Elements.js';
import htmlText from './Refine.html?raw';
import cssText from './Refine.css?raw';

/**
 * Create Component
 */
const Refine = new GUIComponent('Refine', cssText);
/* Janela nativa entra/sai com a animacao unica (Fase 3, 01/09/2026). */
Refine.riAnimaJanela = true;

/**
 * A aba do filtro e preferencia da PESSOA, e nao dado de personagem — mesma
 * razao de `memoriaDeAba.js`. Versao 1.0 de proposito: somar chave nova aos
 * padroes nao exige subir a versao, e subir apagaria a posicao ja salva.
 */
const _preferences = Preferences.get('Refine', { x: null, y: null, aba: null }, 1.0);

/** As abas que existem hoje — `abaLembrada` recusa o que sair desta lista. */
const ABAS = ['todos', 'armas', 'armaduras'];

/** De quanto em quanto tempo a lista reconfere a mochila (o padrao da casa). */
const INTERVALO_DO_POLL_MS = 250;

/**
 * O ESTADO DA JANELA, num objeto so.
 *
 * A janela anterior tinha DEZESSEIS variaveis de modulo (`refine_item_mat`,
 * `refine_no_bsb`, `refine_new_mats`...) e nenhuma funcao que as zerasse toda.
 * Um objeto unico e `zerarEstado()` fazem a limpeza ser uma linha — e a
 * limpeza esquecida era metade dos estados presos da janela velha.
 */
const estado = {
	aberta: false,
	/** O indice NO FIO da peca escolhida (o que o servidor devolveu). */
	indice: 0,
	/** A ficha do `ZC_RAGIDLE_REFINO`, crua. `null` = nada escolhido. */
	ficha: null,
	/** Enquanto o servidor nao responde o `CZ_REQ_REFINING`. */
	emCurso: false,
	/** Assinatura da lista desenhada, para o poll nao redesenhar a toa. */
	assinatura: null,
	/** O que dizer no rodape depois de um resultado, ate a proxima escolha. */
	recado: null,
	/**
	 * Enquanto a animacao de sucesso/falha corre no palco.
	 *
	 * Ela existe para a ficha nova NAO interromper o quadro do resultado: os
	 * NUMEROS voltam na hora (ver `onRefineResult`), a ANIMACAO segue ate o
	 * fim, e as duas coisas deixaram de depender uma da outra.
	 */
	mostrandoResultado: false
};

let filtro = 'todos';
let pollHandle = null;
let animHandle = null;

/**
 * Os quadros da fornalha, do GRF. Continuam intactos: o palco e a UNICA peca
 * de arte desta janela (regra 4 — o que informa e arte, o que delimita e CSS).
 */
const quadros = {
	waiting: [
		'bg_refining_wait_00.bmp',
		'bg_refining_wait_01.bmp',
		'bg_refining_wait_02.bmp',
		'bg_refining_wait_03.bmp'
	],
	ready: ['bg_refiningb_ready_00.bmp', 'bg_refiningb_ready_01.bmp', 'bg_refiningb_ready_02.bmp'],
	process: [
		'bg_refiningb_process_00.bmp',
		'bg_refiningb_process_01.bmp',
		'bg_refiningb_process_02.bmp',
		'bg_refiningb_process_03.bmp',
		'bg_refiningb_process_04.bmp',
		'bg_refiningb_process_05.bmp',
		'bg_refiningb_process_06.bmp',
		'bg_refiningb_process_07.bmp',
		'bg_refiningb_process_08.bmp',
		'bg_refining_process_09.bmp',
		'bg_refining_process_10.bmp',
		'bg_refining_process_11.bmp',
		'bg_refining_process_12.bmp',
		'bg_refining_process_13.bmp'
	],
	success: [
		'bg_refining_success_00.bmp',
		'bg_refining_success_01.bmp',
		'bg_refining_success_02.bmp',
		'bg_refining_success_03.bmp',
		'bg_refining_success_04.bmp',
		'bg_refining_success_05.bmp',
		'bg_refining_success_06.bmp',
		'bg_refining_success_07.bmp',
		'bg_refining_success_08.bmp'
	],
	fail: [
		'bg_refining_fail_00.bmp',
		'bg_refining_fail_01.bmp',
		'bg_refining_fail_02.bmp',
		'bg_refining_fail_03.bmp',
		'bg_refining_fail_04.bmp',
		'bg_refining_fail_05.bmp',
		'bg_refining_fail_06.bmp',
		'bg_refining_fail_07.bmp',
		'bg_refining_fail_08.bmp',
		'bg_refining_fail_09.bmp',
		'bg_refining_fail_10.bmp',
		'bg_refining_fail_11.bmp',
		'bg_refining_fail_12.bmp',
		'bg_refining_fail_13.bmp',
		'bg_refining_fail_14.bmp'
	]
};

/* ═══════════════════════════════════════════════════════════════════════ */
/* Utilidades                                                              */
/* ═══════════════════════════════════════════════════════════════════════ */

function _root() {
	return Refine._shadow || Refine._host;
}

function $(seletor) {
	const root = _root();
	return root ? root.querySelector(seletor) : null;
}

/** Zeny com separador de milhar: "1000000" e ilegivel do lado de um botao. */
function zeny(valor) {
	const numero = Number(valor);
	return Number.isFinite(numero) ? numero.toLocaleString('pt-BR') : '—';
}

/**
 * A taxa da grade de 10000 em porcento, com DUAS casas.
 *
 * `6000` e 60,00%. A grade e a do `refine.yml` e a do resto do jogo (D-215), e
 * arredondar para inteiro aqui apagaria a diferenca em degraus onde ela
 * existe — foi por caber so num byte que o pacote nativo do RO nao serviu.
 */
function porcento(taxa) {
	return (Number(taxa) / 100).toLocaleString('pt-BR', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	});
}

/** Plural sem gambiarra de `s` solto no meio da frase. */
function plural(n, um, muitos) {
	return n === 1 ? um : muitos;
}

/**
 * OS ICONES JA CARREGADOS, por nome de recurso.
 *
 * Ele nao e otimizacao: e o que faz o icone APARECER. Medido em jogo em
 * 07/09/2026 — a lista saiu com cinco ladrilhos VAZIOS enquanto o icone do
 * palco e o do material apareciam normalmente.
 *
 * A causa e a corrida entre o `Client.loadFile` (assincrono) e o redesenho da
 * lista: escolher uma peca dispara DOIS redesenhos em sequencia (o
 * `ZC_REFINING_MATERIAL_LIST` e a ficha logo atras), e o `<div>` que esperava
 * o arquivo ja tinha sido descartado com a linha dele quando o arquivo chegou.
 * Com o cache, todo redesenho depois do primeiro pinta SINCRONO — e a corrida
 * deixa de existir em vez de ficar mais rara.
 */
const iconesCarregados = new Map();

/**
 * Poe o icone 24x24 do cliente dentro de um ladrilho.
 *
 * O ladrilho fica `is-empty` (sem aro dourado) ate a arte chegar — sem isso um
 * quadro dourado vazio pisca a cada troca de peca.
 */
function pintarIcone(alvo, ITID, identificado) {
	if (!alvo) {
		return;
	}
	alvo.innerHTML = '';
	alvo.classList.add('is-empty');

	const info = ITID ? DB.getItemInfo(ITID) : null;
	if (!info) {
		return;
	}

	const nomeDoRecurso = identificado === false ? info.unidentifiedResourceName : info.identifiedResourceName;
	if (!nomeDoRecurso) {
		return;
	}

	const icone = document.createElement('div');
	icone.className = 'icone';
	alvo.appendChild(icone);

	const pintar = dados => {
		icone.style.backgroundImage = 'url(' + dados + ')';
		alvo.classList.remove('is-empty');
	};

	const emCache = iconesCarregados.get(nomeDoRecurso);
	if (emCache) {
		pintar(emCache);
		return;
	}

	Client.loadFile(DB.INTERFACE_PATH + 'item/' + nomeDoRecurso + '.bmp', dados => {
		iconesCarregados.set(nomeDoRecurso, dados);
		// A linha pode ter sido descartada por um redesenho enquanto o arquivo
		// vinha; o cache acima garante que a PROXIMA pinte na hora.
		if (icone.isConnected) {
			pintar(dados);
		}
	});
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* O palco: os quadros da fornalha                                         */
/* ═══════════════════════════════════════════════════════════════════════ */

/**
 * Roda uma fase da animacao no palco.
 *
 * @param {string} fase        chave de `quadros`
 * @param {boolean} emLaco     repete do inicio ao terminar
 * @param {number} intervalo   ms entre quadros
 * @param {function} [aoFim]   so quando `emLaco` e falso
 */
function rodarFase(fase, emLaco, intervalo, aoFim) {
	const lista = quadros[fase];
	if (!lista) {
		return;
	}

	pararFase();
	let i = 0;

	function proximo() {
		Client.loadFile(DB.INTERFACE_PATH + 'refining_renewal/' + lista[i], data => {
			const palco = $('.rf-palco');
			if (!palco) {
				return;
			}
			palco.style.backgroundImage = 'url(' + data + ')';
			i++;

			if (i >= lista.length) {
				if (!emLaco) {
					if (typeof aoFim === 'function') {
						aoFim();
					}
					return;
				}
				i = 0;
			}

			animHandle = setTimeout(proximo, intervalo);
		});
	}

	proximo();
}

function pararFase() {
	if (animHandle) {
		clearTimeout(animHandle);
		animHandle = null;
	}
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* O trilho: a lista do que da para refinar                                */
/* ═══════════════════════════════════════════════════════════════════════ */

/**
 * O que a janela mostra: arma e armadura da mochila.
 *
 * A triagem FINA (acessorio nao refina, `refineable: false` no item_db) e do
 * SERVIDOR, e ela chega como `motivo: 'nao-refinavel'` quando o jogador
 * escolhe. Filtrar aqui pelo mesmo criterio seria uma segunda regra a manter,
 * e uma peca que sumisse da lista sem explicacao e exatamente o tipo de
 * silencio que esta reescrita existe para acabar.
 */
function pecasDaMochila() {
	const ui = Inventory.getUI();
	const naMochila = (ui && ui.list) || [];

	/*
	 * A PECA VESTIDA NAO ESTA NA MOCHILA, e por isso ela vem de outro lugar.
	 *
	 * `InventoryCommon.addItemSub` devolve `false` para todo item com
	 * `WearState` e o entrega a `Equipment` — entao `Inventory.list` NAO
	 * contem o que o jogador esta usando. Medido em jogo em 07/09/2026: com
	 * seis peças na ficha, a lista mostrava cinco, e a que faltava era
	 * justamente a arma na mao.
	 *
	 * Deixar a peça vestida FORA seria o pior dos dois mundos num jogo idle,
	 * onde o equipamento passa a vida inteira vestido: o jogador abriria a
	 * forja e nao acharia a arma dele. Ela entra apagada, e a bancada explica
	 * que e preciso tirar — que e a regra do servidor
	 * (`MOTIVO_DO_REFINO.ESTA_VESTIDA`), dita em portugues.
	 */
	const equipamento = Equipment.getUI();
	const vestidas =
		equipamento && typeof equipamento.getEquippedList === 'function' ? equipamento.getEquippedList() : [];

	return [...naMochila, ...vestidas].filter(item => item.type === ItemType.WEAPON || item.type === ItemType.ARMOR);
}

/**
 * O nome SEM o "+N" que `DB.getItemName` prefixa por padrao.
 *
 * A janela ja mostra o refino em coluna propria, e o prefixo fazia duas coisas
 * ruins ao mesmo tempo: repetia a informacao na linha ("+2 Camisa de Algodao"
 * ao lado de um selo "+2") e **quebrava a ordenacao alfabetica** — as peças
 * refinadas subiam para o topo porque a comparacao via o "+". Medido na
 * primeira foto em jogo de 07/09.
 */
function nomeDaPeca(item) {
	return DB.getItemName(item, { showItemRefine: false });
}

function passaNoFiltro(item) {
	if (filtro === 'armas') {
		return item.type === ItemType.WEAPON;
	}
	if (filtro === 'armaduras') {
		return item.type === ItemType.ARMOR;
	}
	return true;
}

/**
 * A assinatura da lista desenhada.
 *
 * O poll roda 4x por segundo; redesenhar a lista inteira nesse ritmo apagaria
 * o `:hover` e o foco do teclado a cada quadro. Mesmo recurso (e mesma razao)
 * do `_lastGradeSig` da Mochila.
 */
function assinaturaDaLista(pecas) {
	return (
		filtro +
		'|' +
		estado.indice +
		'|' +
		pecas.map(i => i.index + ':' + i.ITID + ':' + (i.RefiningLevel || 0) + ':' + (i.WearState ? 1 : 0)).join(',')
	);
}

function montarLista(forcar) {
	const lista = $('.rf-lista');
	const vazia = $('.rf-lista-vazia');
	const conta = $('.rf-conta');
	if (!lista) {
		return;
	}

	const todas = pecasDaMochila();
	const pecas = todas.filter(passaNoFiltro).sort(ordenarPecas);

	if (conta) {
		conta.textContent = String(todas.length);
	}

	const assinatura = assinaturaDaLista(pecas);
	if (!forcar && assinatura === estado.assinatura) {
		return;
	}
	estado.assinatura = assinatura;

	lista.innerHTML = '';

	for (const item of pecas) {
		lista.appendChild(linhaDaPeca(item));
	}

	if (vazia) {
		vazia.hidden = pecas.length > 0;
		vazia.textContent =
			todas.length === 0 ? 'Nenhuma arma ou armadura na mochila.' : 'Nada nesta aba. Tente "Tudo".';
	}
}

/** Vestidas por ULTIMO (nao dao para refinar), depois em ordem alfabetica. */
function ordenarPecas(a, b) {
	const va = a.WearState ? 1 : 0;
	const vb = b.WearState ? 1 : 0;
	if (va !== vb) {
		return va - vb;
	}
	return nomeDaPeca(a).localeCompare(nomeDaPeca(b), 'pt-BR');
}

function linhaDaPeca(item) {
	const li = document.createElement('li');
	li.className = 'rf-item';
	li.setAttribute('role', 'option');
	li.dataset.indice = String(item.index);
	li.dataset.itid = String(item.ITID);

	const vestida = !!item.WearState;
	const escolhida = estado.indice === item.index;
	li.classList.toggle('is-vestida', vestida);
	li.classList.toggle('is-active', escolhida);
	li.setAttribute('aria-selected', escolhida ? 'true' : 'false');

	const ladrilho = document.createElement('span');
	ladrilho.className = 'rf-item-icone ri-tile';
	li.appendChild(ladrilho);
	pintarIcone(ladrilho, item.ITID, item.IsIdentified);

	const texto = document.createElement('span');
	texto.className = 'rf-item-texto';

	const nome = document.createElement('span');
	nome.className = 'rf-item-nome';
	nome.textContent = nomeDaPeca(item);
	texto.appendChild(nome);

	const nota = document.createElement('span');
	nota.className = 'rf-item-nota';
	nota.textContent = vestida ? 'Vestida' : item.type === ItemType.WEAPON ? 'Arma' : 'Defesa';
	texto.appendChild(nota);
	li.appendChild(texto);

	const refino = document.createElement('span');
	const nivel = item.RefiningLevel || 0;
	refino.className = 'rf-item-refino' + (nivel > 0 ? ' esta-refinada' : '');
	refino.textContent = '+' + nivel;
	li.appendChild(refino);

	return li;
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* A bancada: a peca escolhida                                             */
/* ═══════════════════════════════════════════════════════════════════════ */

/**
 * Pede ao servidor a ficha desta peca.
 *
 * A peca VESTIDA tambem passa por aqui de proposito: quem responde "nao da" e
 * o servidor, e a resposta dele vem por escrito. Recusar do lado de ca seria
 * uma segunda regra dizendo a mesma coisa — e o dia em que as duas
 * discordassem seria o dia em que a janela mentiria.
 */
function escolher(indice) {
	if (estado.emCurso) {
		return;
	}
	/*
	 * O RECADO DO RESULTADO NAO SE APAGA AQUI — e isso foi medido em jogo.
	 *
	 * Esta funcao tem DOIS chamadores: o clique do jogador e o refresco
	 * automatico logo depois de um refino (a ficha inteira volta do servidor:
	 * refino novo, zeny novo, um minerio a menos). Zerar o recado aqui apagava
	 * "Subiu para +1!" cerca de um segundo depois de ele aparecer — a foto em
	 * jogo de 07/09 pegou o rodape ja vazio.
	 *
	 * Quem limpa e o CLIQUE, porque escolher outra peca e o gesto que diz "ja
	 * vi o resultado".
	 */
	const pkt = new PACKET.CZ.REFINING_SELECT_ITEM();
	pkt.index = indice;
	Network.sendPacket(pkt);
}

/** Desenha a bancada inteira a partir da ficha que chegou do servidor. */
function pintarBancada() {
	const ficha = estado.ficha;

	const nome = $('.rf-peca-nome');
	const tipo = $('.rf-peca-tipo');
	const peca = $('.rf-peca');
	const ganho = $('.rf-salto-ganho');
	const nota = $('.rf-risco-nota');

	if (!ficha) {
		if (nome) {
			nome.textContent = 'Escolha uma peça';
		}
		if (tipo) {
			tipo.textContent = 'A lista ao lado mostra o que a forja aceita.';
		}
		if (peca) {
			peca.innerHTML = '';
			peca.classList.add('is-empty');
		}
		if (ganho) {
			ganho.hidden = true;
		}
		if (nota) {
			nota.textContent = 'Escolha uma peça para ver o degrau.';
			nota.classList.remove('esta-alerta');
		}
		pintarTrilha(0, 0);
		pintarSalto(0, 0);
		pintarRisco(null);
		pintarFatos(null);
		const vazia = $('.rf-bancada');
		if (vazia) {
			vazia.classList.remove('esta-bloqueada');
		}
		pintarRodape();
		return;
	}

	if (nome) {
		// O nome LOCALIZADO e do cliente (o servidor manda o dele para o log).
		const naMochila = pecasDaMochila().find(i => i.index === ficha.indice);
		nome.textContent = naMochila ? nomeDaPeca(naMochila) : ficha.nome;
	}
	if (tipo) {
		const familia = ficha.grupo === 'Weapon' ? 'Arma' : ficha.grupo === 'Armor' ? 'Defesa' : 'Peça';
		tipo.textContent = ficha.nivelItem ? familia + ' · nível ' + ficha.nivelItem : familia;
	}
	pintarIcone(peca, ficha.itemId, true);

	pintarTrilha(ficha.refino, ficha.teto);
	pintarSalto(ficha.refino, ficha.degrau ? ficha.refino + 1 : ficha.refino);

	if (ganho) {
		const d = ficha.degrau;
		// `bonus` vem em CENTESIMOS, como no refine.yml — e a divisao inteira e
		// a do proprio emulador (`wa->atk2 += info->bonus / 100`).
		const de = d ? Math.floor(d.bonusAtual / 100) : 0;
		const para = d ? Math.floor(d.bonusProximo / 100) : 0;
		const vale = !!d && para > de;
		ganho.hidden = !vale;
		if (vale) {
			ganho.textContent = d.atributo + ' ' + de + ' → ' + para;
		}
	}

	pintarRisco(ficha.degrau);
	pintarFatos(ficha);

	/*
	 * O degrau continua na tela quando o servidor recusa — ele e verdade, e e
	 * o que custaria com a peca guardada —, mas ele passa a LER como previa.
	 * Sem isto a bancada mostrava "100,00%" e "Custo 50 z" para uma peca
	 * vestida, e so o rodape discordava.
	 */
	const bancada = $('.rf-bancada');
	if (bancada) {
		bancada.classList.toggle('esta-bloqueada', ficha.motivo !== 'pode');
	}

	pintarRodape();
}

/** Um pino por degrau, do +1 ao teto: quanto ja andou e qual e o proximo. */
function pintarTrilha(refino, teto) {
	const trilha = $('.rf-trilha');
	if (!trilha) {
		return;
	}
	trilha.innerHTML = '';
	if (!teto) {
		trilha.setAttribute('aria-label', 'Progresso do refino');
		return;
	}
	for (let n = 1; n <= teto; n++) {
		const pino = document.createElement('span');
		pino.className = 'rf-pino' + (n <= refino ? ' esta-feito' : n === refino + 1 ? ' e-o-proximo' : '');
		trilha.appendChild(pino);
	}
	trilha.setAttribute('aria-label', 'Refino +' + refino + ' de ' + teto);
}

function pintarSalto(de, para) {
	const elDe = $('.rf-salto-de');
	const elPara = $('.rf-salto-para');
	if (elDe) {
		elDe.textContent = '+' + de;
	}
	if (elPara) {
		elPara.textContent = '+' + para;
	}
}

function pintarRisco(degrau) {
	const valor = $('.rf-risco-valor');
	const barra = $('.rf-risco-barra');
	const sucesso = $('.rf-risco-sucesso');
	const nota = $('.rf-risco-nota');

	if (!degrau) {
		if (valor) {
			valor.textContent = '—';
		}
		if (sucesso) {
			sucesso.style.width = '0%';
		}
		if (barra) {
			barra.setAttribute('aria-valuenow', '0');
		}
		return;
	}

	const pct = Math.max(0, Math.min(100, degrau.taxa / 100));
	if (valor) {
		valor.textContent = porcento(degrau.taxa) + '%';
	}
	if (sucesso) {
		sucesso.style.width = pct + '%';
	}
	if (barra) {
		barra.setAttribute('aria-valuenow', String(Math.round(pct)));
	}
	/*
	 * A NOTA CARREGA O QUE A FALHA CUSTA.
	 *
	 * "40% de subir" so significa alguma coisa junto com "e se nao subir?", e
	 * ate 07/09 as duas metades moravam em cartoes separados — com 263px de
	 * bancada os tres cartoes se espremiam a ponto de o nome do minerio virar
	 * reticencia. Aqui elas sao uma frase so, e ela diz a verdade DESTE
	 * servidor: ele desce o refino quando `niveisPerdidosNaFalha` e maior que
	 * zero, e nunca quebra a peca (o `BreakingRate` do rAthena e ignorado de
	 * proposito, `servidor/refino.ts`).
	 */
	if (nota && !estado.recado) {
		if (pct >= 100) {
			nota.textContent = 'Degrau garantido: este não tem como falhar.';
			nota.classList.remove('esta-alerta');
		} else {
			const perde = degrau.niveisPerdidosNaFalha;
			nota.textContent =
				perde > 0
					? `Se falhar, a peça cai ${perde} ${plural(perde, 'nível', 'níveis')} — e a tentativa é cobrada.`
					: 'Se falhar, a peça fica como está — mas a tentativa é cobrada.';
			nota.classList.add('esta-alerta');
		}
	}
}

function pintarFatos(ficha) {
	const d = ficha && ficha.degrau;

	const fatoMat = $('.rf-fato--material');
	const iconeMat = $('.rf-mat-icone');
	const textoMat = $('.rf-mat-texto');
	const fatoTaxa = $('.rf-fato--taxa');
	const taxa = $('.rf-taxa-valor');

	if (!d) {
		if (iconeMat) {
			iconeMat.innerHTML = '';
			iconeMat.classList.add('is-empty');
		}
		if (textoMat) {
			textoMat.textContent = '—';
		}
		if (taxa) {
			taxa.textContent = '—';
		}
		if (fatoMat) {
			fatoMat.classList.remove('esta-faltando');
		}
		if (fatoTaxa) {
			fatoTaxa.classList.remove('esta-faltando');
		}
		return;
	}

	// Degrau SEM material (`Material: null` no refine.yml) existe: ali o custo
	// e so zeny, e o ladrilho fica vazio em vez de mostrar um item id 0.
	if (d.materialId) {
		pintarIcone(iconeMat, d.materialId, true);
		const info = DB.getItemInfo(d.materialId);
		const nomeMat = info ? info.identifiedDisplayName : d.materialNome;
		if (textoMat) {
			textoMat.textContent = d.materialTem + ' / 1 · ' + nomeMat;
		}
		if (fatoMat) {
			fatoMat.classList.toggle('esta-faltando', d.materialTem < 1);
		}
	} else {
		if (iconeMat) {
			iconeMat.innerHTML = '';
			iconeMat.classList.add('is-empty');
		}
		if (textoMat) {
			textoMat.textContent = 'Nenhum';
		}
		if (fatoMat) {
			fatoMat.classList.remove('esta-faltando');
		}
	}

	if (taxa) {
		taxa.textContent = zeny(d.preco) + ' z';
	}
	if (fatoTaxa) {
		fatoTaxa.classList.toggle('esta-faltando', bolso() < d.preco);
	}
}

/** O zeny de que a janela dispoe: o do servidor manda, a sessao e a reserva. */
function bolso() {
	if (estado.ficha && typeof estado.ficha.zeny === 'number') {
		return estado.ficha.zeny;
	}
	return Number(Session.zeny) || 0;
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* O rodape: o botao e o motivo                                            */
/* ═══════════════════════════════════════════════════════════════════════ */

/**
 * O VEREDITO, e ele e sempre uma frase.
 *
 * Nada aqui inventa regra: `motivo` e o `podeRefinar` do servidor, e as duas
 * unicas contas locais (falta minerio, falta zeny) sao as MESMAS que o
 * `CZ_REQ_REFINING` faz antes de gastar. O que esta janela acrescenta e o
 * texto — porque um botao apagado sem frase e o defeito que ela veio matar.
 *
 * @returns {{pode: boolean, texto: string, cor: string}}
 */
function veredito() {
	const ficha = estado.ficha;

	if (estado.emCurso) {
		return { pode: false, texto: 'Na forja…', cor: '' };
	}
	if (!ficha) {
		return { pode: false, texto: 'Escolha uma peça na lista.', cor: '' };
	}

	switch (ficha.motivo) {
		case 'esta-vestida':
			return { pode: false, texto: 'Tire a peça para poder refinar.', cor: 'esta-vermelho' };
		case 'no-teto':
			return { pode: false, texto: 'Esta peça chegou ao topo (+' + ficha.refino + ').', cor: '' };
		case 'nao-refinavel':
			return { pode: false, texto: 'Esta peça não aceita refino.', cor: '' };
		default:
			break;
	}

	const d = ficha.degrau;
	if (!d) {
		return { pode: false, texto: 'A tabela não cobre o próximo degrau.', cor: '' };
	}
	if (d.materialId && d.materialTem < 1) {
		const info = DB.getItemInfo(d.materialId);
		const nomeMat = info ? info.identifiedDisplayName : d.materialNome;
		return { pode: false, texto: 'Falta 1 × ' + nomeMat + '.', cor: 'esta-vermelho' };
	}
	if (bolso() < d.preco) {
		return {
			pode: false,
			texto: 'Faltam ' + zeny(d.preco - bolso()) + ' zeny.',
			cor: 'esta-vermelho'
		};
	}
	return { pode: true, texto: '', cor: '' };
}

function pintarRodape() {
	const bolsoEl = $('.rf-bolso-valor');
	const motivoEl = $('.rf-motivo');
	const acao = $('.rf-acao');

	if (bolsoEl) {
		bolsoEl.textContent = zeny(bolso()) + ' z';
	}

	const v = veredito();

	if (acao) {
		acao.disabled = !v.pode;
		acao.classList.toggle('is-disabled', !v.pode);
		const proximo = estado.ficha && estado.ficha.degrau ? estado.ficha.refino + 1 : null;
		acao.textContent = proximo === null ? 'Refinar' : 'Refinar +' + proximo;
	}

	if (motivoEl) {
		motivoEl.classList.remove('esta-vermelho', 'esta-verde');
		// O RECADO do ultimo resultado vence o motivo enquanto durar: logo
		// depois de refinar, "Subiu para +1!" e a informacao que o jogador
		// esta esperando, e nao "Falta 1 x Phracon" do proximo degrau.
		const recado = estado.recado;
		if (recado) {
			motivoEl.textContent = recado.texto;
			if (recado.cor) {
				motivoEl.classList.add(recado.cor);
			}
			return;
		}
		motivoEl.textContent = v.texto;
		if (v.cor) {
			motivoEl.classList.add(v.cor);
		}
	}
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* Refinar                                                                 */
/* ═══════════════════════════════════════════════════════════════════════ */

function refinar() {
	const v = veredito();
	if (!v.pode || !estado.ficha || !estado.ficha.degrau) {
		return;
	}

	estado.emCurso = true;
	estado.recado = null;
	pintarRodape();

	rodarFase('process', true, 100);

	const pkt = new PACKET.CZ.REQ_REFINING();
	pkt.index = estado.ficha.indice;
	pkt.itemId = estado.ficha.degrau.materialId;
	pkt.blacksmithBlessing = 0;
	Network.sendPacket(pkt);
}

/**
 * O RESULTADO (`ZC.ACK_ITEMREFINING`, 0x0188).
 *
 * `result` e 0 para SUCESSO — invertido em relacao a intuicao, e e a convencao
 * do cliente que manda (o servidor a segue de proposito, ver o comentario do
 * `CZ_REQMAKINGITEM` em servidor-mapa.ts).
 *
 * Chamada de fora: `Engine/MapEngine/Item.js:424`.
 */
Refine.onRefineResult = function onRefineResult(pkt) {
	if (!pkt || !estado.aberta) {
		return;
	}

	estado.emCurso = false;
	pararFase();

	const deuCerto = pkt.result === 0;
	const nivel = pkt.RefiningLevel;

	estado.recado = deuCerto
		? { texto: 'Subiu para +' + nivel + '!', cor: 'esta-verde' }
		: { texto: 'Falhou. A peça ficou em +' + nivel + '.', cor: 'esta-vermelho' };

	// O indice pode ter ANDADO: consumir o material compacta o inventario
	// quando a pilha acaba, e o servidor devolve o indice novo no proprio ACK.
	estado.indice = pkt.itemIndex;

	/*
	 * OS NUMEROS VOLTAM AGORA; a animacao corre por fora.
	 *
	 * Ate 07/09/2026 o pedido da ficha nova ficava no FIM da animacao de
	 * sucesso — nove quadros do GRF, carregados um a um. No intervalo a janela
	 * mostrava o degrau que acabou de ser comprado, com o bolso de antes do
	 * gasto: a prova em jogo pegou "9.950 z / +0" logo depois de um refino que
	 * ja tinha levado a peca para +1. Enfeite nao pode segurar informacao.
	 */
	estado.mostrandoResultado = true;
	if (estado.aberta) {
		escolher(estado.indice);
	}

	rodarFase(deuCerto ? 'success' : 'fail', false, 90, () => {
		estado.mostrandoResultado = false;
		rodarFase('ready', true, 250);
	});

	montarLista(true);
	pintarRodape();
};

/* ═══════════════════════════════════════════════════════════════════════ */
/* Pacotes                                                                 */
/* ═══════════════════════════════════════════════════════════════════════ */

function janelaLigada() {
	if (!Configs.get('enableRefineUI') || PACKETVER.value < 20161012) {
		console.warn('Renewal Refine is enabled in your server. Please enable refine UI in your configs.');
		return false;
	}
	return true;
}

/** `ZC.OPEN_REFINING_UI` (0x0aa0) — o NPC abriu a bancada. */
function onOpenRefineUI() {
	if (!janelaLigada()) {
		return false;
	}
	Refine.append();
	return false;
}

/**
 * `ZC.REFINING_MATERIAL_LIST` (0x0aa2) — o pacote NATIVO do RO.
 *
 * Aqui ele serve a UMA coisa: dizer qual peca o servidor entendeu que foi
 * escolhida. Os numeros do degrau vem na ficha (0x0fd3) logo atras, com a
 * precisao que o bloco de 9 bytes deste nao tem. Ele fica ouvido, e nao
 * ignorado, porque e ele que o servidor manda primeiro — e um cliente que so
 * ouvisse a extensao dependeria da ordem de chegada.
 */
function onRefineMaterialList(pkt) {
	if (!janelaLigada() || !pkt) {
		return;
	}
	/*
	 * So o INDICE. O redesenho da lista fica para a ficha, que chega logo
	 * atras: redesenhar aqui tambem descartava as linhas duas vezes em
	 * sequencia, e era nessa segunda vez que o icone recem-carregado se
	 * perdia (ver `iconesCarregados`).
	 */
	estado.indice = pkt.itemIndex;
}

/** `ZC_RAGIDLE_REFINO` (0x0fd3) — a ficha do degrau, ou a recusa por extenso. */
function onFichaDeRefino(pkt) {
	let ficha;
	try {
		ficha = JSON.parse(pkt.json);
	} catch (e) {
		console.error('Refine: ficha de refino ilegivel', e);
		return;
	}
	if (!ficha || ficha.v !== 1) {
		return;
	}

	estado.ficha = ficha;
	estado.indice = ficha.indice;
	montarLista(true);
	pintarBancada();

	// `mostrandoResultado`: a ficha nova chega DURANTE a animacao de sucesso
	// ou falha (de proposito — ver `onRefineResult`), e trocar de fase aqui
	// cortaria o quadro do resultado no meio.
	if (!estado.emCurso && !estado.mostrandoResultado) {
		rodarFase(ficha.degrau ? 'ready' : 'waiting', true, 250);
	}
}

/** O anuncio global de refino (`ZC.BROADCAST_ITEMREFINING_RESULT`). */
function onBroadcastRefineResult(pkt) {
	if (!pkt) {
		return;
	}
	const item = DB.getItemInfo(pkt.itemId);
	const nomeDoItem = item ? item.identifiedDisplayName : String(pkt.itemId);
	const messageID = pkt.status === 0 ? 3272 : pkt.status === 1 ? 3271 : null;
	if (messageID === null) {
		return;
	}
	const mensagem = DB.getMessage(messageID)
		.replace('%s', pkt.charName)
		.replace('%d', pkt.refineLevel)
		.replace('%s', nomeDoItem);
	ChatBox.addText(mensagem, ChatBox.TYPE.ANNOUNCE, ChatBox.FILTER.PUBLIC_CHAT, '#FFB563');
	Announce.append();
	Announce.set(mensagem, '#FFB563');
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* Ciclo de vida                                                           */
/* ═══════════════════════════════════════════════════════════════════════ */

Refine.render = () => htmlText;

Refine.init = function init() {
	const root = _root();

	this._host.style.top = '160px';
	this._host.style.left = '260px';
	this.draggable('.rf-header');

	const fechar = root.querySelector('.rf-close');
	if (fechar) {
		fechar.addEventListener('click', onRefineClose);
	}

	const abas = root.querySelector('.rf-abas');
	if (abas) {
		abas.addEventListener('click', event => {
			const botao = event.target.closest('.rf-aba');
			if (!botao) {
				return;
			}
			event.stopImmediatePropagation();
			filtro = botao.dataset.aba;
			lembrarAba(_preferences, filtro);
			pintarAbas();
			montarLista(true);
		});
	}

	const lista = root.querySelector('.rf-lista');
	if (lista) {
		lista.addEventListener('click', event => {
			const linha = event.target.closest('.rf-item');
			if (!linha) {
				return;
			}
			event.stopImmediatePropagation();
			estado.recado = null;
			escolher(parseInt(linha.dataset.indice, 10));
		});
		/*
		 * O TECLADO ESCOLHE TAMBEM.
		 *
		 * A lista nasceu com `tabindex="0"` e um anel de foco — e sem tecla
		 * nenhuma ligada, que e pior do que nao ser focavel: quem chega nela
		 * pelo Tab fica preso num elemento que parece interativo e nao faz
		 * nada. Setas andam, Enter/Espaco escolhem, e o `role="listbox"` do
		 * HTML passa a dizer a verdade.
		 */
		lista.addEventListener('keydown', event => {
			const linhas = [...lista.querySelectorAll('.rf-item')];
			if (linhas.length === 0) {
				return;
			}
			const atual = linhas.findIndex(l => l.classList.contains('is-active'));
			let alvo = -1;

			if (event.key === 'ArrowDown') {
				alvo = Math.min(linhas.length - 1, atual + 1);
			} else if (event.key === 'ArrowUp') {
				alvo = Math.max(0, atual <= 0 ? 0 : atual - 1);
			} else if (event.key === 'Home') {
				alvo = 0;
			} else if (event.key === 'End') {
				alvo = linhas.length - 1;
			} else if (event.key === 'Enter' || event.key === ' ') {
				// Escolher ja aconteceu na seta; aqui Enter/Espaco REFINAM, que
				// e a acao da janela — e o botao pode estar apagado.
				event.preventDefault();
				refinar();
				return;
			} else {
				return;
			}

			event.preventDefault();
			const linha = linhas[alvo];
			if (linha) {
				linha.scrollIntoView({ block: 'nearest' });
				estado.recado = null;
				escolher(parseInt(linha.dataset.indice, 10));
			}
		});

		// Botao direito na peca: a ficha do item, como em toda lista do jogo.
		lista.addEventListener('contextmenu', event => {
			const linha = event.target.closest('.rf-item');
			if (!linha) {
				return;
			}
			event.preventDefault();
			event.stopImmediatePropagation();
			abrirFichaDoItem(parseInt(linha.dataset.indice, 10));
		});
	}

	const acao = root.querySelector('.rf-acao');
	if (acao) {
		acao.addEventListener('click', event => {
			event.stopImmediatePropagation();
			refinar();
		});
	}

	filtro = abaLembrada(_preferences, 'todos', ABAS);
	pintarAbas();
};

function pintarAbas() {
	const root = _root();
	if (!root) {
		return;
	}
	root.querySelectorAll('.rf-aba').forEach(botao => {
		const ativa = botao.dataset.aba === filtro;
		botao.classList.toggle('is-active', ativa);
		botao.setAttribute('aria-selected', ativa ? 'true' : 'false');
	});
}

function abrirFichaDoItem(indice) {
	const ui = Inventory.getUI();
	const item = ui && ui.getItemByIndex(indice);
	if (!item) {
		return;
	}
	if (ItemInfo.uid === item.ITID) {
		ItemInfo.remove();
		return;
	}
	ItemInfo.append();
	ItemInfo.uid = item.ITID;
	ItemInfo.setItem(item);
}

Refine.onAppend = function onAppend() {
	zerarEstado();
	estado.aberta = true;

	pintarAbas();
	montarLista(true);
	pintarBancada();
	rodarFase('waiting', true, 250);

	/*
	 * ABRIR JA COM A PRIMEIRA PECA ESCOLHIDA.
	 *
	 * A janela antiga abria vazia e esperava um arrasto. Abrir escolhendo
	 * poupa o passo mais caro do fluxo e — mais importante — faz a bancada
	 * chegar com NUMEROS na tela: uma janela que abre util nunca parece
	 * quebrada. A escolha e a primeira peca que da para refinar; se so houver
	 * vestidas, escolhe a primeira mesmo assim, e a bancada explica.
	 */
	const pecas = pecasDaMochila().filter(passaNoFiltro).sort(ordenarPecas);
	if (pecas.length > 0) {
		escolher(pecas[0].index);
	}

	if (pollHandle === null) {
		pollHandle = setInterval(() => montarLista(false), INTERVALO_DO_POLL_MS);
	}
};

Refine.onRemove = function onRemove() {
	if (pollHandle !== null) {
		clearInterval(pollHandle);
		pollHandle = null;
	}
	pararFase();
	zerarEstado();
};

/**
 * Fechar tem de AVISAR o servidor.
 *
 * `conexao.estado.refinoAberto` e a guarda que impede um cliente de mandar
 * `CZ_REQ_REFINING` fora da janela — e deixar de fechar a deixaria aberta para
 * sempre do lado de la (`servidor/mapa/janela-de-refino.test.ts`).
 */
function onRefineClose() {
	Refine.remove();
	Network.sendPacket(new PACKET.CZ.CLOSE_REFINING_UI());
}

function zerarEstado() {
	estado.aberta = false;
	estado.indice = 0;
	estado.ficha = null;
	estado.emCurso = false;
	estado.assinatura = null;
	estado.recado = null;
	estado.mostrandoResultado = false;
}

/**
 * A porta que a Mochila usa: duplo clique num item com a bancada aberta.
 *
 * `Inventory/InventoryCommon.js:938` chama isto. Ela continua existindo — e
 * hoje e um ATALHO, e nao o unico caminho como era antes.
 */
Refine.onRequestItemRefine = function onRequestItemRefine(item) {
	if (!item) {
		return;
	}
	estado.recado = null;
	escolher(item.index);
};

/** `InventoryCommon.js` pergunta isto antes de oferecer o atalho acima. */
Refine.isRefineOpen = function isRefineOpen() {
	return !!(Refine._host && Refine._host.isConnected);
};

/**
 * Packet Hooks to functions
 */
Network.hookPacket(PACKET.ZC.OPEN_REFINING_UI, onOpenRefineUI);
Network.hookPacket(PACKET.ZC.REFINING_MATERIAL_LIST, onRefineMaterialList);
Network.hookPacket(PACKET.ZC.RAGIDLE_REFINO, onFichaDeRefino);
Network.hookPacket(PACKET.ZC.BROADCAST_ITEMREFINING_RESULT, onBroadcastRefineResult);

/**
 * Create component and export it
 */
export default UIManager.addComponent(Refine);
