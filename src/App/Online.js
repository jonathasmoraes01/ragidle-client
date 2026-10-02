import GameEngine from 'Engine/GameEngine.js';
import Plugins from 'Plugins/PluginManager.js';
import { roInitSpinner } from 'App/PreLoader.js';
import { iniciarIdioma } from 'Core/inicioDoIdioma.js';

export { roInitSpinner };

export function init() {
	// Grab (or create) the preloader
	roInitSpinner.add();

	// O jogo em ingles (D-1929): busca o catalogo sem segurar a subida.
	iniciarIdioma();

	Plugins.init();
	GameEngine.init();

	window.onbeforeunload = function () {
		return 'Are you sure to exit roBrowser ?';
	};
}

export default {
	init: init,
	roInitSpinner: roInitSpinner
};

init();
