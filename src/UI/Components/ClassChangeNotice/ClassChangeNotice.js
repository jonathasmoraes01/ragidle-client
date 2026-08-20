/**
 * O AVISO DE EVOLUÇÃO DE CLASSE (D-410).
 *
 * O que ele resolve: até aqui a mudança de classe existia no servidor e
 * **ninguém descobria**. Um jogador comum não sabe que precisa de nível de
 * classe 40, não sabe que precisa gastar todo ponto de habilidade, e não sabe
 * que o Mestre dele mora em `gef_tower`. O aviso responde as três de uma vez e
 * leva o jogador até lá.
 *
 * Duas escolhas de desenho que não são estéticas:
 *
 * 1. **Quem decide se o aviso aparece é o SERVIDOR.** Este componente não
 *    calcula nível nem ponto: ele desenha o que `ZC_RAGIDLE_MUDANCA_DE_CLASSE`
 *    manda. Recalcular aqui daria uma segunda cópia da regra do 2º grau — e a
 *    cópia da janela é a que ninguém lembra de atualizar.
 * 2. **`destinos` vazio FECHA o aviso**, em vez de ser ignorado. É assim que
 *    ele some depois da troca: sem isso o popup continuaria na tela oferecendo
 *    algo que já aconteceu.
 *
 * O botão manda `CZ_RAGIDLE_VIAJAR` — o MESMO pacote da janela "Mapa de Caça",
 * e não um caminho novo. O servidor já sabe recusar mapa que não carrega.
 *
 * @author RagIdle
 */

import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import htmlText from './ClassChangeNotice.html?raw';
import cssText from './ClassChangeNotice.css?raw';

const ClassChangeNotice = new GUIComponent('ClassChangeNotice', htmlText, cssText);

/** Os destinos que o servidor mandou por último. */
ClassChangeNotice.destinos = [];

function _root() {
	return ClassChangeNotice.ui[0] || ClassChangeNotice.ui;
}

function escapeHtml(texto) {
	return String(texto).replace(
		/[&<>"']/g,
		(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
	);
}

ClassChangeNotice.init = function init() {
	const root = _root();
	root.querySelector('.ccn-close').addEventListener('click', () => esconder());
	render();
};

function esconder() {
	const toast = _root().querySelector('.ccn-toast');
	if (toast) {
		toast.dataset.hidden = 'true';
	}
}

function render() {
	const root = _root();
	if (!root) {
		return;
	}
	const toast = root.querySelector('.ccn-toast');
	const body = root.querySelector('.ccn-body');
	if (!toast || !body) {
		return;
	}

	const destinos = ClassChangeNotice.destinos || [];
	if (!destinos.length) {
		toast.dataset.hidden = 'true';
		body.innerHTML = '';
		return;
	}

	// O plural muda a frase inteira, e a diferença importa: com dois ramos a
	// escolha é do jogador, e é a decisão mais marcante do Ragnarok.
	const linha =
		destinos.length === 1
			? 'Você já pode evoluir de classe. Fale com o Mestre:'
			: 'Você já pode evoluir de classe. Escolha um caminho — a escolha é definitiva:';

	const botoes = destinos
		.map(
			(d) => `
			<button type="button" class="ccn-btn" data-mapa="${escapeHtml(d.mapa)}">
				Tornar-se ${escapeHtml(d.nomePt)}
				<span class="ccn-onde">${escapeHtml(d.mestre)} · ${escapeHtml(d.mapa)}</span>
			</button>`
		)
		.join('');

	body.innerHTML = `<div class="ccn-linha">${linha}</div>${botoes}`;
	toast.dataset.hidden = 'false';

	body.querySelectorAll('[data-mapa]').forEach((btn) => {
		btn.addEventListener('click', () => {
			const pkt = new PACKET.CZ.RAGIDLE_VIAJAR();
			pkt.mapName = btn.dataset.mapa;
			Network.sendPacket(pkt);
			// O aviso NÃO some aqui: quem o fecha é o servidor, mandando a
			// lista vazia depois da troca. Fechar agora esconderia o caminho de
			// volta se o jogador desistir no menu do Mestre.
		});
	});
}

/**
 * O servidor mandou a lista.
 *
 * Ele só manda quando o CONJUNTO muda, então não há o que filtrar aqui — e
 * filtrar seria justamente reimplementar a regra do servidor na janela.
 */
function onAvisoRecebido(pkt) {
	let dados;
	try {
		dados = JSON.parse(pkt.json);
	} catch (err) {
		console.error('[ClassChangeNotice] payload nao e JSON valido', err);
		return;
	}
	if (!dados || dados.v !== 1) {
		return;
	}
	ClassChangeNotice.destinos = Array.isArray(dados.destinos) ? dados.destinos : [];
	render();
}

Network.hookPacket(PACKET.ZC.RAGIDLE_MUDANCA_DE_CLASSE, onAvisoRecebido);

export default UIManager.addComponent(ClassChangeNotice);
