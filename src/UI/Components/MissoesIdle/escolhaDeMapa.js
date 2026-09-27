/**
 * UI/Components/MissoesIdle/escolhaDeMapa.js
 *
 * O FLUXO DO "IR AO MAPA" (26/09/2026, pedido do dono), UM SO para as DUAS
 * janelas que desenham missao:
 *
 * - a aba "Missoes Gerais" do Codex, que e a porta do MENU ("Codex & Missoes");
 * - a janela de Missoes (MissoesIdle), aberta pelo rastreador e pelo atalho.
 *
 * As duas desenham o objetivo de coleta com a mesma linha (`linhaDoCaiDe`, em
 * `ondeCaiHtml.js`) e mandam o clique para ca. Daqui sai o pedido da lista
 * (`onde-cai`), chega a resposta (o `ondeCai` que vem no pacote das missoes),
 * sai a decisao (ir direto ou perguntar) e, quando pergunta, a janela de
 * escolha — injetada DENTRO da janela que pediu, para cobrir ela e nao outra.
 *
 * Por que um modulo e nao duas copias: duas rotas escritas a mao para a mesma
 * coisa e o defeito mais repetido deste projeto — a segunda envelhece calada.
 *
 * Uma JANELA aqui e so o que o fluxo precisa dela:
 *   { container(): Element|null, fecharJanela(): void }
 * `container` e a CAIXA VISIVEL da janela (a `.cx-window`/`.mi-window`), e o
 * modal nasce dentro dela. NAO e o elemento raiz (`#CodexIdle`), e isto foi
 * MEDIDO: no computador o raiz mede 0x0 — a janela e absoluta, com tamanho
 * proprio, transbordando um raiz vazio — e um modal `inset: 0` nele colapsou
 * para 2x2 px, invisivel (a sonda `scripts/diag-onde-cai-na-janela.ts`, no
 * rag-idle). A janela e bloco de referencia nos dois aparelhos: absoluta no
 * computador, e com `backdrop-filter` (que tambem prende filhos absolutos) no
 * painel de tela cheia do celular.
 */

import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import UIManager from 'UI/UIManager.js';
import { corpoDaEscolha, decidirAoReceber } from './ondeCaiHtml.js';

/* A moldura e a do design system (`.ri-window`/`.ri-header`/`.ri-close`); o
   resto do desenho esta em `escolhaDeMapa.css`, que as duas janelas somam ao
   proprio CSS. */
const MODAL_HTML =
	'<div class="oc-modal" hidden>' +
	'<div class="oc-modal-fundo" data-fechar-escolha="1"></div>' +
	'<div class="oc-modal-caixa ri-window" role="dialog" aria-modal="true">' +
	'<div class="oc-modal-cabecalho ri-header">' +
	'<span class="oc-modal-titulo ri-title">Onde farmar</span>' +
	'<button type="button" class="oc-modal-fechar ri-close" data-fechar-escolha="1" title="Fechar">&times;</button>' +
	'</div>' +
	'<div class="oc-modal-corpo ri-scroll"></div>' +
	'</div>' +
	'</div>';

/** O pedido em voo: so a resposta DESTE clique abre a escolha. */
let _pedido = null;

/** A escolha aberta agora: quem a pediu e para qual missao. */
let _aberta = null;

/**
 * O clique em "Ir ao mapa": pede ao servidor os mapas onde o item cai.
 *
 * A resposta vem no pacote das missoes, que o servidor tambem empurra a toda
 * hora — por isso o pedido fica guardado, e `receberOndeCai` so age na lista
 * DESTE item.
 */
export function pedirOndeCai(itemId, missaoId, janela) {
	const id = Number(itemId);
	if (!Number.isInteger(id) || id <= 0) {
		return;
	}
	_pedido = { itemId: id, missaoId: missaoId || null, janela };
	const pkt = new PACKET.CZ.RAGIDLE_MISSAO_ACAO();
	pkt.json = JSON.stringify({ acao: 'onde-cai', id: missaoId || null, itemId: id });
	Network.sendPacket(pkt);
}

/**
 * A lista chegou. Devolve `true` quando ela respondia ao pedido em voo.
 *
 * @param {{itemId: number, missaoId?: string, mapas: object[]}} ondeCai
 */
export function receberOndeCai(ondeCai) {
	if (!ondeCai || !_pedido || ondeCai.itemId !== _pedido.itemId) {
		return false;
	}
	const pedido = _pedido;
	_pedido = null;
	const missaoId = ondeCai.missaoId || pedido.missaoId;
	const decisao = decidirAoReceber(ondeCai);
	if (decisao.tipo === 'ir') {
		irAoMapa(decisao.mapa, missaoId, pedido.janela);
		return true;
	}
	abrirEscolha(ondeCai, missaoId, pedido.janela);
	return true;
}

/** A viagem: fecha a escolha e a janela, para nao cobrir a chegada. A recusa
 * (nivel, morto, ja esta la) chega pelo feed. */
function irAoMapa(mapa, missaoId, janela) {
	const pkt = new PACKET.CZ.RAGIDLE_MISSAO_ACAO();
	pkt.json = JSON.stringify({ acao: 'ir-para-mapa', id: missaoId || null, mapa });
	Network.sendPacket(pkt);
	fecharEscolha(janela);
	if (janela && typeof janela.fecharJanela === 'function') {
		janela.fecharJanela();
	}
}

/** O modal da janela, criado na primeira vez que ela precisa dele. */
function garantirModal(container) {
	let modal = null;
	for (const filho of Array.from(container.children)) {
		if (filho.classList && filho.classList.contains('oc-modal')) {
			modal = filho;
		}
	}
	if (modal) {
		return modal;
	}
	container.insertAdjacentHTML('beforeend', MODAL_HTML);
	modal = container.lastElementChild;
	// Um ouvinte so, por delegacao: o corpo e reescrito a cada abertura.
	modal.addEventListener('click', onCliqueNoModal);
	return modal;
}

function onCliqueNoModal(e) {
	const alvo = e.target && e.target.closest ? e.target : null;
	if (!alvo) {
		return;
	}
	// O modal mora ao lado do corpo da janela: o clique aqui nao e da janela.
	e.stopImmediatePropagation();

	if (alvo.closest('[data-fechar-escolha]')) {
		fecharEscolha(_aberta && _aberta.janela);
		return;
	}
	const ir = alvo.closest('[data-ir-mapa]');
	if (ir && _aberta) {
		irAoMapa(ir.dataset.irMapa, _aberta.missaoId, _aberta.janela);
		return;
	}
	const ver = alvo.closest('[data-ver-no-mapa-de-caca]');
	if (ver && _aberta) {
		const termo = ver.dataset.verNoMapaDeCaca;
		const janela = _aberta.janela;
		fecharEscolha(janela);
		if (janela && typeof janela.fecharJanela === 'function') {
			janela.fecharJanela();
		}
		abrirMapaDeCacaComBusca(termo);
	}
}

/*
 * O Mapa de Caca e pedido ao `UIManager` no clique, e nao importado: o import
 * puxa o renderizador inteiro para dentro de quem importa este modulo, e os
 * testes da janela de Missoes (jsdom, sem canvas) morriam na carga — medido em
 * 26/09/2026.
 */
function abrirMapaDeCacaComBusca(termo) {
	try {
		const huntMap = UIManager.getComponent('HuntMap');
		if (huntMap && typeof huntMap.abrirComBusca === 'function') {
			huntMap.abrirComBusca(termo);
		}
	} catch (err) {
		console.error('[escolhaDeMapa] o Mapa de Caca nao esta montado', err);
	}
}

function abrirEscolha(ondeCai, missaoId, janela) {
	const container = janela && typeof janela.container === 'function' ? janela.container() : null;
	if (!container) {
		return;
	}
	const modal = garantirModal(container);
	const titulo = modal.querySelector('.oc-modal-titulo');
	if (titulo) {
		titulo.textContent = 'Onde farmar: ' + (ondeCai.nomeDoItem || 'item');
	}
	const corpo = modal.querySelector('.oc-modal-corpo');
	if (corpo) {
		corpo.innerHTML = corpoDaEscolha(ondeCai);
		corpo.scrollTop = 0;
	}
	_aberta = { janela, missaoId: missaoId || null };
	modal.hidden = false;
}

/**
 * Fecha a escolha — so a da janela pedida, quando ela e dada: fechar a janela
 * de Missoes nao pode fechar uma escolha aberta no Codex.
 */
export function fecharEscolha(janela) {
	if (janela && _aberta && _aberta.janela !== janela) {
		return;
	}
	const dona = _aberta ? _aberta.janela : janela;
	_aberta = null;
	const container = dona && typeof dona.container === 'function' ? dona.container() : null;
	if (!container) {
		return;
	}
	for (const filho of Array.from(container.children)) {
		if (filho.classList && filho.classList.contains('oc-modal')) {
			filho.hidden = true;
		}
	}
}

/** A escolha esta aberta agora? (para o ESC da janela fechar ela primeiro) */
export function escolhaAberta(janela) {
	return !!_aberta && (!janela || _aberta.janela === janela);
}
