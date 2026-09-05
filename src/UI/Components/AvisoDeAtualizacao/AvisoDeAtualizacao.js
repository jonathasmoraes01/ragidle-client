/**
 * UI/Components/AvisoDeAtualizacao/AvisoDeAtualizacao.js
 *
 * A caixa central de aviso de atualizacao (o lado do cliente da D-880).
 *
 * Quando o deploy vai reiniciar o servidor, o supervisor difunde um
 * ZC_BROADCAST cujo texto comeca com o marcador 'ri-aviso:'. Em vez da
 * faixa do Announce (que passa e some no topo), o jogador ve UMA caixa
 * parada no meio da tela, sem botao nenhum — o pedido do dono (04/09/2026):
 * aviso, nao dialogo, "pro player nao achar que toda hora o game cai".
 *
 * O marcador viaja no proprio texto porque o ZC_BROADCAST nao tem campo
 * para isso — e o mesmo truque do prefixo 'blue' do emulador
 * (clif.cpp:6722-6724), que o onGlobalAnnounce ja arranca antes de pintar.
 */

import Events from 'Core/Events.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import htmlText from './AvisoDeAtualizacao.html?raw';
import cssText from './AvisoDeAtualizacao.css?raw';

const AvisoDeAtualizacao = new GUIComponent('AvisoDeAtualizacao', cssText);

/**
 * O mouse atravessa: e um aviso, nao uma janela — nada aqui e clicavel e a
 * caixa nao pode roubar o clique de quem esta jogando embaixo dela.
 */
AvisoDeAtualizacao.mouseMode = GUIComponent.MouseMode.CROSS;
AvisoDeAtualizacao.needFocus = false;

let _timer = 0;

/**
 * Os avisos do deploy chegam em contagem (60s, 30s, 10s) e cada um RENOVA o
 * prazo: a caixa fica na tela do primeiro aviso ate ~25s depois do ultimo —
 * que e quando o proprio restart derruba a conexao. Um aviso avulso some
 * sozinho depois desses 25s.
 */
const _life = 25 * 1000;

AvisoDeAtualizacao.render = () => htmlText;

AvisoDeAtualizacao.init = function init() {
	this.texto = this.getRoot().querySelector('.texto');
};

AvisoDeAtualizacao.onRemove = function onRemove() {
	if (_timer) {
		Events.clearTimeout(_timer);
		_timer = 0;
	}
};

/**
 * Mostra (ou atualiza) o aviso e renova o prazo de vida.
 *
 * @param {string} text o aviso, ja sem o marcador 'ri-aviso:'
 */
AvisoDeAtualizacao.set = function set(text) {
	this.texto.textContent = text;

	if (_timer) {
		Events.clearTimeout(_timer);
	}
	_timer = Events.setTimeout(() => this.remove(), _life);
};

export default UIManager.addComponent(AvisoDeAtualizacao);
