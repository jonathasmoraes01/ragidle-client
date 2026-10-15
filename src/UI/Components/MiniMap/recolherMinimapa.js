/**
 * UI/Components/MiniMap/recolherMinimapa.js
 *
 * MINIMIZAR O MINIMAPA NA HUD MOBILE PREMIUM (pedido do dono, 15/10/2026): *"coloque a possibilidade da pessoa
 * minimizar o mapa tambem e ficar apenas o nome do mapa atual"*.
 *
 * O controle e o `.mm-recolher` da pilula do nome (MiniMapV2.html), que so a premium mostra. O toque vira a
 * preferencia (`hudPremium.js`, guardada no aparelho) e reaplica a HUD vertical, que carimba a marca
 * `ri-minimapa-recolhido` no documento e em todo shadow - quem esconde o mapa, encolhe o host e sobe o trilho e o
 * CSS. Com a marca, o minimapa tambem para de desenhar (`minimapaNoQuadro.js`).
 *
 * This file is part of the ragidle fork of ROBrowser.
 */

import { definirMinimapaRecolhido, minimapaRecolhido } from 'UI/HudPremium/hudPremium.js';
import { reaplicar as reaplicarHudVertical } from 'UI/hudVertical.js';

/** O rotulo diz o que o toque faz (como o chevron do chat). */
export function pintarRecolherMinimapa(root) {
	const botao = root && root.querySelector('.mm-recolher');
	if (!botao) {
		return;
	}
	const recolhido = minimapaRecolhido();
	const rotulo = recolhido ? 'Abrir o mapa' : 'Minimizar o mapa';
	botao.setAttribute('aria-expanded', recolhido ? 'false' : 'true');
	botao.setAttribute('aria-label', rotulo);
	botao.title = rotulo;
}

/** Alterna, reaplica a marca na hora e repinta o rotulo. */
export function alternarMinimapa(root) {
	definirMinimapaRecolhido(!minimapaRecolhido());
	reaplicarHudVertical();
	pintarRecolherMinimapa(root);
}

/** Liga o botao (o init do minimapa). Sem o botao (as versoes antigas do minimapa), nao faz nada. */
export function ligarRecolherMinimapa(root) {
	const botao = root && root.querySelector('.mm-recolher');
	if (!botao) {
		return false;
	}
	botao.addEventListener('click', evento => {
		// o toque e do botao: nao vira clique no mundo nem arrasto da janela
		evento.stopImmediatePropagation();
		alternarMinimapa(root);
	});
	pintarRecolherMinimapa(root);
	return true;
}
