/**
 * Preferences/Map.js
 *
 * Map user preferences
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import Preferences from 'Core/Preferences.js';

/**
 * Export
 */
export default Preferences.get(
	'Map',
	{
		/**
		 * Display the fog ?
		 *
		 * Toggle by using "/fog" in the chatbox
		 */
		fog: true,

		/**
		 * Display lightmap ?
		 *
		 * Toggle using "/lightmap" in the chatbox
		 */
		lightmap: true,

		/**
		 * Posterize lightmap ?
		 *
		 * Toggle using "/smoothlight" in the chatbox
		 */
		smoothlight: 0,

		/**
		 * Display effects ?
		 *
		 * Toggle using "/effect" in the chatbox
		 */
		effect: true,

		/**
		 * Display minify effects ?
		 *
		 * Toggle using "/mineeffect" in the chatbox
		 */
		mineffect: false,

		/**
		 * Should we display "miss" when monster/player miss an attack ?
		 *
		 * Toggle using "/miss" in the chatbox
		 */
		miss: true,

		/**
		 * Display aura (2) or simplified aura (1) or disable entirely (0)
		 *
		 * Toggle using "/aura" or "/aura2" in the chatbox
		 *
		 * RAGIDLE (12/09/2026, tarefa 6 do dono): a aura COMPLETA e o padrao,
		 * como no cliente oficial — o `/aura` e que a SIMPLIFICA ("Minimizes the
		 * aura effect", a descricao do proprio comando). Com `1` o jogador nivel
		 * 99 so ganhava o efeito 202 (`Level99Bubble`, as "bolinhas" de que o
		 * dono se queixou), sem a faixa azul (200) nem o anel no chao (201).
		 * A versao subiu de 1.1 para 1.2 para o padrao novo alcancar quem ja
		 * tinha a preferencia gravada (`Core/Preferences.js:43` troca tudo pelo
		 * padrao quando a versao muda).
		 */
		aura: 2,

		/**
		 * Display different font style ?
		 *
		 * Toggle using "/showname" changes font styles.
		 */
		showname: true
	},
	1.2
);
