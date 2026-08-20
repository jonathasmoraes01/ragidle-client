/**
 * UI/Components/CharCreate/CharCreatev4/CharCreatev4.js
 *
 * Chararacter Creation windows
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import htmlText from './CharCreatev4.html?raw';
import cssText from './CharCreatev4.css?raw';
import { createCharCreate } from '../CharCreateCommon.js';

export default createCharCreate({
	name: 'CharCreatev4',
	htmlText,
	cssText,
	// Corrigido pra bater com "#charcreate_v4"/":host" em CharCreatev4.css
	// (794x422). Estava 576x342 -- outro tamanho, nao usado em lugar nenhum
	// deste arquivo -- e a centralizacao em onAppend()
	// ("(Renderer.width - hostWidth) / 2") usa exatamente este numero, entao
	// a janela sempre abria deslocada (109px pra esquerda, 40px pra cima do
	// centro real). CUIDADO (regra do design system): se o tamanho da janela
	// mudar de novo, mude os DOIS -- aqui e o CSS -- e prove com Playwright.
	hostHeight: 422,
	hostWidth: 794,
	hasRace: true,
	gridHairstyle: true,
	humanCanvasSelector: '#human',
	doramCanvasSelector: '#doram',
	modelCanvasSelector: '#style_model',
	nameInputSelector: '#char_name',
	nameInputEvent: 'mousedown',
	cancelSelectors: ['.cancel', '.return'],
	makeSelector: '.make'
});
