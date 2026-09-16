/**
 * UI/Components/Reconexao/Reconexao.js
 *
 * O AVISO DE RECONEXAO AUTOMATICA (R12, 14/09/2026).
 *
 * O lado VISUAL apenas: quem decide QUANDO mostrar, por quantos segundos e
 * com qual texto e o `src/Network/reconexao.js` (o estado mora la, nao
 * aqui — este componente so pinta o que mandarem). Molde:
 * `UI/Components/AvisoDeAtualizacao/AvisoDeAtualizacao.js`.
 *
 * SEM BOTAO, de proposito (mesma razao do molde): o jogo esta sem servidor
 * neste estado, entao nao ha "cancelar" que va ter efeito no servidor — o
 * unico jeito de sair de verdade e' o F5 do navegador ou fechar a aba, e os
 * dois ja funcionam sem ajuda deste componente. `pointer-events: none` no
 * `:host` deixa o clique atravessar para o jogo (congelado) embaixo.
 */

import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import htmlText from './Reconexao.html?raw';
import cssText from './Reconexao.css?raw';

const Reconexao = new GUIComponent('Reconexao', cssText);

Reconexao.mouseMode = GUIComponent.MouseMode.CROSS;
Reconexao.needFocus = false;

Reconexao.render = () => htmlText;

Reconexao.init = function init() {
	this.titulo = this.getRoot().querySelector('.rc-titulo');
	this.texto = this.getRoot().querySelector('.rc-texto');
	this.contagem = this.getRoot().querySelector('.rc-contagem');
};

/**
 * Mostra (ou atualiza) o aviso.
 *
 * @param {object} estado
 * @param {string} estado.titulo
 * @param {string} estado.texto
 * @param {number} [estado.segundos] - contagem regressiva; omitido = sem numero (ex.: "tentando agora")
 */
Reconexao.mostrar = function mostrar(estado) {
	if (!this.__loaded) {
		this.append();
	}

	this.titulo.textContent = estado.titulo;
	this.texto.textContent = estado.texto;
	this.contagem.textContent = Number.isFinite(estado.segundos) ? `${Math.max(0, Math.ceil(estado.segundos))}s` : '';
};

Reconexao.esconder = function esconder() {
	if (this.__loaded) {
		this.remove();
	}
};

export default UIManager.addComponent(Reconexao);
