/**
 * UI/Components/ItemObtain/ItemObtain.js
 *
 * Item Obtain window (when you get an item, a window popup near the announce box)
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import DB from 'DB/DBManager.js';
import Client from 'Core/Client.js';
import Events from 'Core/Events.js';
import Renderer from 'Renderer/Renderer.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import htmlText from './ItemObtain.html?raw';
import cssText from './ItemObtain.css?raw';

/**
 * Create component
 */
const ItemObtain = new GUIComponent('ItemObtain', cssText);

ItemObtain.render = () => htmlText;

/* Toast entra/sai com a animacao unica (Fase 3, 01/09/2026). ItemObtain vive
   por append()/remove() (nao show()/hide()) — o mesmo padrao que o proprio
   GUIComponent.js cita como alvo de "riAnimaJanela" para popups. */
ItemObtain.riAnimaJanela = true;

/**
 * Mouse can cross this UI
 */
ItemObtain.mouseMode = GUIComponent.MouseMode.CROSS;

/**
 * @var {boolean} do not focus this UI
 */
ItemObtain.needFocus = false;

/**
 * Sanitize HTML, allowing only whitelisted tags (font, i, b)
 */
function _sanitizeHtml(str) {
	const whitelist = ['font', 'i', 'b'];
	const div = document.createElement('div');
	div.innerHTML = str;
	div.querySelectorAll('*').forEach(el => {
		if (!whitelist.includes(el.tagName.toLowerCase())) {
			el.replaceWith(...el.childNodes);
		}
	});
	return div.innerHTML;
}

/**
 * @var {TimeOut} timer
 */
let _timer = 0;

/**
 * @var {number} time to display
 */
const _life = 5 * 1000;

/**
 * Initialize component
 */
ItemObtain.init = function init() {
	// this._host.style.zIndex = '45'; // Between Interface and Game Announce
};

/**
 * Poe o aviso onde ele CABE — e as duas contas sao diferentes.
 *
 * HORIZONTAL: centralizado, como sempre foi (`Renderer.width` menos a largura
 * medida do toast). Ela ja era feita aqui e em `set()`, porque a largura muda
 * com o nome do item.
 *
 * VERTICAL, e so na HUD do celular em pe (RAGIDLE, 07/09/2026): o `top` daquele
 * arranjo era `--vr-abaixo-do-topo + 130px`, um numero escolhido quando o
 * cartao de missoes mostrava UMA missao. Com duas o cartao passa dos 130px e o
 * aviso do drop nasce EM CIMA dele — a foto do celular em
 * `prove:anuncio-de-drop` (repo do servidor) mostra o toast cobrindo o "Ver
 * todas as missoes". O cartao cresce com o numero de missoes, entao nenhum
 * numero fixo serve: quem sabe onde ele termina e o navegador.
 *
 * A medida vai para `--vr-item-obtido-topo` (lida em `UI/Common.css`) em vez de
 * um `top` inline: a regra de la e `!important` (a moldura vertical inteira e,
 * ver o cabecalho daquele bloco) e venceria o inline sem `!important` — e um
 * inline COM `!important` sequestraria a posicao tambem no dia em que o
 * arranjo mudar. Sem cartao na tela a variavel nao e definida, e o `calc` de
 * nascenca continua valendo.
 */
function posicionar(host, root) {
	const el = root.querySelector('#ItemObtain');
	host.style.left = `${(Renderer.width - (el ? el.offsetWidth : 0)) >> 1}px`;

	if (!document.documentElement.classList.contains('ri-vertical')) {
		host.style.removeProperty('--vr-item-obtido-topo');
		return;
	}
	const cartao = document.querySelector('div[id^="MissoesTrackerIdle"]');
	const caixa = cartao ? cartao.getBoundingClientRect() : null;
	if (!caixa || caixa.height <= 0) {
		host.style.removeProperty('--vr-item-obtido-topo');
		return;
	}
	/*
	 * O VAO CAIU DE 10 PARA 4 (08/09/2026, pedido do dono: *"Posicione-o
	 * mais acima sem cobrir informacoes importantes da HUD"*).
	 *
	 * As duas metades do pedido brigam: "mais acima" e "sem cobrir" apontam
	 * para lados opostos enquanto o cartao de missoes estiver aberto — ele e
	 * quem ocupa o alto da tela. A medida continua sendo a borda de baixo do
	 * cartao, que e o que garante o "sem cobrir"; o que encolhe e o respiro.
	 *
	 * E o "mais acima" ganhou uma segunda porta no mesmo dia: o cartao
	 * passou a RECOLHER (`.mt-recolher-v`). Recolhido, ele encurta, e este
	 * `calc` sobe o aviso sozinho — sem numero novo em lugar nenhum.
	 */
	host.style.setProperty('--vr-item-obtido-topo', `${Math.round(caixa.bottom + 4)}px`);
}

/**
 * Once append to body
 */
ItemObtain.onAppend = function onAppend() {
	posicionar(this._host, this.getRoot());
};

/**
 * Once removed from HTML, clean timer
 */
ItemObtain.onRemove = function onRemove() {
	if (_timer) {
		Events.clearTimeout(_timer);
		_timer = 0;
	}
};

/**
 * Timer end, cleaning box
 */
ItemObtain.timeEnd = function timeEnd() {
	this.remove();
};

/**
 * Add item informations
 *
 * @param {object} item
 */
ItemObtain.set = function set(item) {
	const root = this.getRoot();
	const it = DB.getItemInfo(item.ITID);
	const display = DB.getItemName(item, { showItemSlots: false, showItemOptions: false });
	const resource = item.IsIdentified ? it.identifiedResourceName : it.unidentifiedResourceName;

	this.placeOnTop();

	const content = root.querySelector('.content');
	if (content) {
		content.innerHTML =
			`<img src="data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==" class="item-${item.ITID}" width="24" height="24" /> ` +
			// RAGIDLE (D-796): o jogo e pt-br por decisao do dono ("a troca de
			// idioma nao sera hoje"). A msg 696 vinha do msgstringtable EN do
			// GRF ("- %d obtained.") porque a versao PT nao existe no formato
			// que o loader entende — o texto fixo segue o padrao dos demais
			// componentes RAGIDLE ate a troca de idioma existir.
			_sanitizeHtml(`${display} - ${item.count || 1} obtido(s).`);
	}

	posicionar(this._host, root);

	Client.loadFile(DB.INTERFACE_PATH + 'item/' + resource + '.bmp', url => {
		const img = root.querySelector(`img.item-${item.ITID}`);
		if (img) {
			img.src = url;
		}
	});

	// Start timer
	if (_timer) {
		Events.clearTimeout(_timer);
	}

	_timer = Events.setTimeout(this.timeEnd.bind(this), _life);
};

/**
 * Create component and return it
 */
export default UIManager.addComponent(ItemObtain);
